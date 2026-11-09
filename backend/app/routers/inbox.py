"""Per-user inbound notification email routing and unified inbox reads.

The inbound webhook is provider-neutral and authenticates with a shared secret.
Normalized message metadata and a message body capped at 4,000 characters are retained.
Outbound replies are deliberately not implemented here.
"""
import hashlib
import hmac
import html
import re
import secrets
import time
from email.utils import parseaddr
from urllib.parse import parse_qsl, urlparse

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field, model_validator

from .. import repo, seed
from ..auth import current_user
from ..config import get_settings
from .. import llm
from ..integrations import emit_activepieces_event

router = APIRouter(tags=["inbox"])
# Notification sender domains. Only platforms whose sender is documented are
# listed (docs/platform-matrix.md); each still needs INBOUND_EMAIL_PLATFORMS.
_PLATFORM_DOMAINS = {
    "Fiverr": ("fiverr.com",),
    "Upwork": ("upwork.com",),
    "Freelancer.com": ("freelancer.com",),
    "Lancers": ("lancers.jp",),
    "FlexJobs": ("flexjobs.com",),
    "Bark": ("bark.com",),
}
_INBOX_URLS = {
    "Fiverr": "https://www.fiverr.com/inbox",
    "Upwork": "https://www.upwork.com/ab/messages/",
    "Freelancer.com": "https://www.freelancer.com/messages/",
}
_OUTLOOK_INTEGRATION = "microsoft-outlook"


def _platform(sender: str) -> str | None:
    address = parseaddr(sender)[1].lower()
    sender_domain = address.rsplit("@", 1)[-1] if "@" in address else ""
    for name, domains in _PLATFORM_DOMAINS.items():
        if any(sender_domain == domain or sender_domain.endswith(f".{domain}") for domain in domains):
            return name
    return None


def _plain(text: str, html_body: str) -> str:
    html_text = re.sub(r"<(script|style)\b[^>]*>.*?</\1>", " ", html_body or "", flags=re.I | re.S)
    value = text or re.sub(r"<[^>]*>", " ", html_text)
    value = html.unescape(re.sub(r"<[^>]*>", " ", value))
    return re.sub(r"\s+", " ", value).strip()[:4000]


def _link(platform: str, text: str) -> str:
    for url in re.findall(r"https?://[^\s<>\"']+", text):
        host = (urlparse(url).hostname or "").lower()
        if url.lower().startswith("https://") and any(host == domain or host.endswith(f".{domain}") for domain in _PLATFORM_DOMAINS[platform]):
            return url.rstrip(".,)")[:1000]
    return _INBOX_URLS.get(platform, f"https://www.{_PLATFORM_DOMAINS[platform][0]}/")


class InboundEmail(BaseModel):
    to: str = Field(max_length=320)
    from_email: str = Field(max_length=500)
    subject: str = Field(default="", max_length=500)
    text_body: str = Field(default="", max_length=100_000)
    html_body: str = Field(default="", max_length=200_000)
    message_id: str = Field(default="", max_length=500)
    in_reply_to: str = Field(default="", max_length=500)
    received_at: str = Field(default="", max_length=100)

    @model_validator(mode="before")
    @classmethod
    def normalize_provider_fields(cls, value):
        if not isinstance(value, dict):
            return value
        data = dict(value)
        for canonical, variants in {
            "to": ("To",), "from_email": ("from", "From"), "subject": ("Subject",),
            "text_body": ("textBody", "TextBody"), "html_body": ("htmlBody", "HtmlBody"),
            "message_id": ("messageId", "MessageID"), "in_reply_to": ("inReplyTo", "InReplyTo"),
            "received_at": ("receivedAt", "Date"),
        }.items():
            if canonical not in data:
                for variant in variants:
                    if variant in data:
                        data[canonical] = data[variant]
                        break
        return data


@router.get("/inbox/address")
async def inbound_address(user: dict = Depends(current_user)):
    settings = get_settings()
    if not settings.inbound_email_domain or not settings.inbound_email_platforms.strip():
        return {"configured": False, "address": None, "message": "Inbound email domain is not configured."}
    current = await repo.get_settings_doc(user["id"], seed.SETTINGS)
    token = current.get("inboundEmailToken")
    if not token:
        token = secrets.token_urlsafe(24)
        await repo.update_settings_doc(user["id"], {
            "inboundEmailToken": token,
            "inboundTokenHash": hashlib.sha256(token.encode()).hexdigest(),
        }, seed.SETTINGS)
    return {"configured": True, "address": f"u-{token}@{settings.inbound_email_domain}"}


@router.get("/inbox/sync/status")
async def inbox_sync_status(user: dict = Depends(current_user)):
    settings = get_settings()
    enabled_integrations = {value.strip() for value in settings.nango_integrations.split(",") if value.strip()}
    saved = await repo.get_settings_doc(user["id"], seed.SETTINGS)
    connections = saved.get("nangoConnections", {})
    connection = connections.get(_OUTLOOK_INTEGRATION) if isinstance(connections, dict) else None
    configured = bool(settings.nango_secret_key and _OUTLOOK_INTEGRATION in enabled_integrations)
    connected = bool(isinstance(connection, dict) and connection.get("connectionId"))
    approved = settings.outlook_inbox_read_approved
    allowed_platforms = {name.strip().lower() for name in settings.inbound_email_platforms.split(",") if name.strip()}
    ready = configured and connected and approved and bool(allowed_platforms)
    reason = (
        "Outlook mailbox sync is ready. Only messages from supported marketplace notification domains are imported."
        if ready else
        "The server has not enabled the microsoft-outlook Nango integration." if not configured else
        "Mailbox reading is disabled until the Microsoft Mail.Read scope and privacy review are approved." if not approved else
        "Connect Microsoft Outlook from Accounts & Platforms to continue." if not connected else
        "Enable at least one reviewed platform in INBOUND_EMAIL_PLATFORMS before syncing messages."
    )
    return {
        "configured": configured,
        "canConnect": configured and approved,
        "connected": connected,
        "approved": approved,
        "ready": ready,
        "lastSyncAt": saved.get("outlookInboxLastSyncAt"),
        "reason": reason,
    }


@router.post("/inbox/sync/outlook")
async def sync_outlook_inbox(user: dict = Depends(current_user)):
    """Import matching marketplace notification mail through the user's Nango connection.

    This is read-only: no email is sent, marked read, moved, or deleted.
    """
    settings = get_settings()
    if not settings.outlook_inbox_read_approved:
        raise HTTPException(503, "Outlook inbox sync is disabled pending scope and privacy approval.")
    allowed_platforms = {name.strip().lower() for name in settings.inbound_email_platforms.split(",") if name.strip()}
    if not allowed_platforms:
        raise HTTPException(503, "No reviewed platform senders are enabled for Outlook inbox sync.")
    enabled_integrations = {value.strip() for value in settings.nango_integrations.split(",") if value.strip()}
    if not settings.nango_secret_key or _OUTLOOK_INTEGRATION not in enabled_integrations:
        raise HTTPException(503, "Microsoft Outlook is not enabled in Nango.")
    saved_settings = await repo.get_settings_doc(user["id"], seed.SETTINGS)
    connections = saved_settings.get("nangoConnections", {})
    connection = connections.get(_OUTLOOK_INTEGRATION) if isinstance(connections, dict) else None
    connection_id = connection.get("connectionId") if isinstance(connection, dict) else None
    if not connection_id:
        raise HTTPException(409, "Connect your Microsoft Outlook account before syncing.")

    search = '"from:fiverr.com OR from:upwork.com OR from:freelancer.com"'
    params = {
        "$search": search,
        "$top": 50,
        "$select": "id,internetMessageId,conversationId,from,subject,body,bodyPreview,webLink,receivedDateTime,isRead",
    }
    headers = {
        "Authorization": f"Bearer {settings.nango_secret_key}",
        "Connection-Id": connection_id,
        "Provider-Config-Key": _OUTLOOK_INTEGRATION,
        "Accept": "application/json",
        "Prefer": 'outlook.body-content-type="text"',
    }
    rows = []
    pages = 0
    next_url = f"{settings.nango_base_url.rstrip('/')}/proxy/v1.0/me/messages"
    next_params = params
    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=False) as client:
            # Microsoft Graph uses @odata.nextLink for paging. Bound the poll
            # so one unusually busy mailbox cannot monopolize the queue job.
            while next_url and pages < 5:
                response = await client.get(next_url, params=next_params, headers=headers)
                if response.status_code in (401, 403):
                    raise HTTPException(502, "Outlook rejected the mailbox read request. Check the connected account's Mail.Read consent.")
                response.raise_for_status()
                payload = response.json()
                page_rows = payload.get("value", []) if isinstance(payload, dict) else []
                if not isinstance(page_rows, list):
                    raise ValueError("Invalid messages response")
                rows.extend(page_rows)
                pages += 1
                graph_next = payload.get("@odata.nextLink") if isinstance(payload, dict) else None
                if not graph_next:
                    next_url = ""
                    continue
                parsed_next = urlparse(str(graph_next))
                if (parsed_next.scheme != "https" or parsed_next.hostname != "graph.microsoft.com"
                        or not parsed_next.path.startswith("/v1.0/me/messages")):
                    raise ValueError("Unexpected Microsoft Graph continuation URL")
                # Route each page through Nango so Graph credentials stay
                # managed there; never send the Nango key to Graph directly.
                next_url = f"{settings.nango_base_url.rstrip('/')}/proxy{parsed_next.path}"
                next_params = dict(parse_qsl(parsed_next.query, keep_blank_values=True))
    except HTTPException:
        raise
    except (httpx.HTTPError, ValueError, TypeError):
        log.exception("Outlook inbox sync failed for user %s", user["id"])
        raise HTTPException(502, "Could not sync Outlook messages. Check the connection and try again.")

    added = duplicates = ignored = 0
    for row in rows:
        if not isinstance(row, dict):
            ignored += 1
            continue
        from_object = ((row.get("from") or {}).get("emailAddress") or {})
        address = str(from_object.get("address", ""))[:320]
        platform = _platform(address)
        if not platform or platform.lower() not in allowed_platforms:
            ignored += 1
            continue
        body_object = row.get("body") or {}
        body_content = str(body_object.get("content", ""))
        content_type = str(body_object.get("contentType", "text")).lower()
        content = _plain(body_content if content_type == "text" else "",
                         body_content if content_type == "html" else "")
        content = content or _plain(str(row.get("bodyPreview", "")), "")
        if not content:
            ignored += 1
            continue
        provider_id = str(row.get("internetMessageId") or row.get("id") or "")[:500]
        if not provider_id:
            ignored += 1
            continue
        digest = f"outlook:{provider_id}"
        sender = str(from_object.get("name") or address)[:200]
        subject = str(row.get("subject", ""))[:500]
        thread_ref = str(row.get("conversationId") or provider_id)[:200]
        item = await repo.add_message(user["id"], {
            "platform": platform,
            "source": "Microsoft Outlook",
            "thread_ref": thread_ref,
            "message_ref": provider_id,
            "sender": sender,
            "subject": subject,
            "preview": content[:500],
            "body": content,
            "deep_link": _link(platform, content),
            "received_at": str(row.get("receivedDateTime") or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))[:100],
            "unread": not bool(row.get("isRead", False)),
            "direction": "inbound",
        }, digest)
        if not item:
            duplicates += 1
            continue
        added += 1
        await repo.notify(user["id"], f"New {platform} message", f"Message from {sender}", "info")
        await emit_activepieces_event("inbox.message_received", {
            "user_id": user["id"], "platform": platform, "message_id": item["id"],
        })

    synced_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    await repo.update_settings_doc(user["id"], {"outlookInboxLastSyncAt": synced_at}, seed.SETTINGS)
    return {"added": added, "duplicates": duplicates, "ignored": ignored,
            "pages": pages, "syncedAt": synced_at}


@router.post("/inbox/inbound")
async def receive_inbound(body: InboundEmail, authorization: str | None = Header(default=None)):
    secret = get_settings().inbound_email_webhook_secret
    if not secret or not authorization or not hmac.compare_digest(authorization, f"Bearer {secret}"):
        raise HTTPException(401, "Invalid inbound email webhook credentials.")
    match = re.fullmatch(r"u-([A-Za-z0-9_-]{20,80})@([^@]+)", body.to.strip(), re.I)
    domain = get_settings().inbound_email_domain
    if not match or not domain or match.group(2).lower() != domain.lower():
        raise HTTPException(404, "Unknown inbound mailbox.")
    user_id = await repo.user_for_inbound_hash(hashlib.sha256(match.group(1).encode()).hexdigest())
    if not user_id:
        raise HTTPException(404, "Unknown inbound mailbox.")
    platform = _platform(body.from_email)
    if not platform:
        return {"accepted": False, "reason": "sender_not_supported"}
    allowed_platforms = {name.strip().lower() for name in get_settings().inbound_email_platforms.split(",") if name.strip()}
    if platform.lower() not in allowed_platforms:
        raise HTTPException(403, f"Inbound email for {platform} is disabled pending account/content verification.")
    content = _plain(body.text_body, body.html_body)
    if not content:
        return {"accepted": False, "reason": "empty_message"}
    sender = parseaddr(body.from_email)[0] or parseaddr(body.from_email)[1]
    normalized_subject = re.sub(r"^(re|fw|fwd):\s*", "", body.subject, flags=re.I).strip()
    digest = body.message_id.strip().strip("<>") or hashlib.sha256(
        f"{body.from_email}|{body.subject}|{body.received_at}|{content}".encode()
    ).hexdigest()
    parent_ref = body.in_reply_to.strip().strip("<>")
    parent = await repo.find_message_by_ref(user_id, parent_ref) if parent_ref else None
    conversation_seed = f"{platform}:{parseaddr(body.from_email)[1].lower()}:{normalized_subject.lower()}"
    saved = await repo.add_message(user_id, {
        "platform": platform,
        "thread_ref": (parent or {}).get("thread_ref") or hashlib.sha256(conversation_seed.encode()).hexdigest()[:24],
        "message_ref": body.message_id.strip().strip("<>") or digest,
        "sender": sender[:200],
        "subject": normalized_subject[:500],
        "preview": content[:500],
        "body": content,
        "deep_link": _link(platform, content),
        "received_at": body.received_at or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "unread": True,
        "direction": "inbound",
    }, digest)
    if not saved:
        return {"accepted": True, "duplicate": True}
    await repo.notify(user_id, f"New {platform} message", f"Message from {sender}", "info")
    await emit_activepieces_event("inbox.message_received", {
        "user_id": user_id, "platform": platform, "message_id": saved["id"],
    })
    return {"accepted": True, "duplicate": False, "messageId": saved["id"]}


@router.get("/conversations")
async def conversations(user: dict = Depends(current_user)):
    messages = await repo.list_for("messages", user["id"], limit=500)
    grouped: dict[str, list[dict]] = {}
    for message in messages:
        key = f"{message.get('platform')}:{message.get('thread_ref')}"
        grouped.setdefault(key, []).append(message)
    result = []
    for key, thread in grouped.items():
        thread.sort(key=lambda item: item.get("received_at", ""))
        latest = thread[-1]
        result.append({
            "id": key,
            "channel": latest.get("platform", "Email"),
            "contact": latest.get("sender", "Marketplace contact"),
            "persona": "Manual reply",
            "unread": sum(bool(m.get("unread")) for m in thread),
            "last": latest.get("preview", ""),
            "time": latest.get("received_at", ""),
            "deepLink": latest.get("deep_link", ""),
            "thread": [{"id": m["id"], "from": "contact", "author": m.get("sender", "Contact"),
                        "text": m.get("body", m.get("preview", "")), "time": m.get("received_at", ""),
                        "unread": bool(m.get("unread")), "replyDraft": m.get("reply_draft", "")}
                       for m in thread],
        })
    return sorted(result, key=lambda item: item["time"], reverse=True)


@router.post("/inbox/messages/{message_id}/read")
async def mark_read(message_id: str, user: dict = Depends(current_user)):
    message = await repo.update("messages", user["id"], message_id, {"unread": False})
    if not message:
        raise HTTPException(404, "Message not found")
    return {"ok": True}


class ReplyDraftBody(BaseModel):
    message_id: str = Field(alias="messageId", max_length=100)
    tone: str = Field(default="professional", max_length=40)


class SaveReplyDraftBody(BaseModel):
    reply: str = Field(max_length=5000)


@router.put("/inbox/messages/{message_id}/reply-draft")
async def save_reply_draft(message_id: str, body: SaveReplyDraftBody, user: dict = Depends(current_user)):
    message = await repo.get("messages", user["id"], message_id)
    if not message or message.get("direction") != "inbound":
        raise HTTPException(404, "Inbound message not found")
    saved = await repo.update("messages", user["id"], message_id, {
        "reply_draft": body.reply.strip(),
        "reply_draft_updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    })
    return {"reply": saved.get("reply_draft", ""), "updatedAt": saved.get("reply_draft_updated_at")}


@router.post("/inbox/reply-draft")
async def reply_draft(body: ReplyDraftBody, user: dict = Depends(current_user)):
    message = await repo.get("messages", user["id"], body.message_id)
    if not message:
        raise HTTPException(404, "Message not found")
    generated = await llm.achat([
        {"role": "system", "content": f"Draft a concise {body.tone} reply to a freelance marketplace message. Do not claim commitments or facts not present in the context. Return only the draft text."},
        {"role": "user", "content": f"Platform: {message.get('platform')}\nSender: {message.get('sender')}\nSubject: {message.get('subject')}\nMessage: {message.get('body', '')[:2500]}"},
    ], max_tokens=500)
    reply = generated or "Thanks for your message. I’ve reviewed the details and will follow up with a clear response shortly."
    reply = reply.strip()
    saved = await repo.update("messages", user["id"], body.message_id, {
        "reply_draft": reply,
        "reply_draft_updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    })
    return {"reply": saved.get("reply_draft", reply), "aiGenerated": bool(generated)}
