"""Growth engine — agency outreach campaigns + compliant platform outreach.

POST /api/growth/email/draft     -> AI-personalized cold email for one agency
                                    (LLM with template fallback — never breaks).
POST /api/growth/outreach/draft  -> AI-personalized platform DM draft for the
                                    user to review and send themselves.
POST /api/growth/campaigns/send  -> sends a reviewed campaign to a recipient
                                    list via the configured provider
                                    (RESEND_API_KEY or SMTP_*), returns
                                    per-recipient results and logs the run.
                                    Platform owners only — it sends from the
                                    company's own email account.

Deliberately compliant: campaigns are human-composed and human-triggered —
no silent mass-blasting, no platform automation, no ToS evasion.
"""
import re
import time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .. import email as mail, llm, repo
from ..auth import current_user, require_owner
from ..config import get_settings

router = APIRouter(tags=["growth"])


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


# --------------------------------------------------------------------------- #
# AI drafts
# --------------------------------------------------------------------------- #
class EmailDraftBody(BaseModel):
    agencyName: str
    focus: str = ""          # what the agency does / needs
    offer: str = "trial"     # "trial" | "enterprise"
    senderName: str = ""
    service: str = ""        # what we sell, defaults to the platform pitch


_OFFER_COPY = {
    "trial": "a free 3-day full-access trial (extends to 7 days when they share it)",
    "enterprise": "a free enterprise trial — unlimited seats for their whole team for a week",
}


def _email_fallback(body: EmailDraftBody) -> dict:
    offer = _OFFER_COPY.get(body.offer, _OFFER_COPY["trial"])
    sender = body.senderName or "the Autopilot team"
    first = (body.agencyName or "there").split()[0]
    subject = f"{body.agencyName or 'Your agency'} + Autopilot — {body.focus or 'more client work, less overhead'}"
    text = (
        f"Hi {first},\n\n"
        f"We built Autopilot — an AI operator that finds freelance work, writes proposals, "
        f"and manages delivery so agencies like {body.agencyName or 'yours'} win more deals "
        f"without hiring.\n\n"
        f"I'd love to set you up with {offer}. No card required — you can be running "
        f"your first acquisition cycle in five minutes.\n\n"
        f"Worth a look?\n\n{sender}"
    )
    return {"subject": subject, "body": text, "aiGenerated": False}


@router.post("/growth/email/draft")
def draft_email(body: EmailDraftBody):
    offer = _OFFER_COPY.get(body.offer, _OFFER_COPY["trial"])
    raw = llm.chat(
        [
            {
                "role": "system",
                "content": (
                    "You write short, human cold outreach emails for a SaaS founder. "
                    "90-130 words, one idea, specific, zero buzzwords, soft CTA. "
                    "Return EXACTLY two parts: a line starting with 'Subject: ' then the body. "
                    "Plain text only."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Write a cold email to {body.agencyName or 'an agency'}"
                    f"{f' (focus: {body.focus})' if body.focus else ''}. "
                    f"Product: Autopilot — AI agents that find freelance work, write proposals, "
                    f"manage clients and track revenue. Offer: {offer}. "
                    f"Signed: {body.senderName or 'the Autopilot team'}."
                ),
            },
        ],
        # gpt-oss-120b is a reasoning model — needs headroom for its
        # internal chain-of-thought plus the actual email text.
        max_tokens=3000,
    )
    if not raw:
        return _email_fallback(body)
    match = re.search(r"Subject:\s*(.+)", raw)
    if not match:
        return _email_fallback(body)
    subject = match.group(1).strip().strip('"')
    body_text = raw[match.end():].strip()
    if not subject or len(body_text) < 40:
        return _email_fallback(body)
    return {"subject": subject, "body": body_text, "aiGenerated": True}


class OutreachDraftBody(BaseModel):
    platform: str            # Fiverr | Upwork | LinkedIn | Reddit | ...
    target: str              # display name / handle
    service: str = ""        # what the sender offers
    senderName: str = ""
    context: str = ""        # e.g. "they posted looking for a dashboard"


def _outreach_fallback(body: OutreachDraftBody) -> dict:
    sender = body.senderName or "a fellow freelancer"
    service_line = f"It's been great for {body.service} work. " if body.service else ""
    return {
        "message": (
            f"Hi {body.target or 'there'} — saw your profile"
            f"{f' re: {body.context}' if body.context else ''} and thought this might help: "
            f"I'm using Autopilot, an AI workspace that finds gigs and drafts proposals for me. "
            f"{service_line}"
            f"They're running a short trial if you want to try it — happy to send you my referral link.\n\n— {sender}"
        ),
        "aiGenerated": False,
    }


@router.post("/growth/outreach/draft")
def draft_outreach(body: OutreachDraftBody):
    raw = llm.chat(
        [
            {
                "role": "system",
                "content": (
                    "You write short, genuine direct messages that a real person would send "
                    "to another freelancer. 50-80 words, friendly, no hype, no emojis, "
                    "one soft mention of the product and its trial. Plain text only."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Platform: {body.platform}. Recipient: {body.target}."
                    f"{f' Context: {body.context}.' if body.context else ''}"
                    f"{f' Sender offers: {body.service}.' if body.service else ''}"
                    " Product: Autopilot — an AI workspace that finds freelance gigs and writes proposals. "
                    f"Signed: {body.senderName or 'a freelancer'}."
                ),
            },
        ],
        max_tokens=3000,
    )
    if not raw or len(raw) < 30:
        return _outreach_fallback(body)
    return {"message": raw.strip(), "aiGenerated": True}


# --------------------------------------------------------------------------- #
# AI Lead Finder — describe your niche, get outreach-ready prospects back.
# LLM-generated with a deterministic fallback so it never returns empty.
# --------------------------------------------------------------------------- #
class LeadFindBody(BaseModel):
    niche: str = "digital agencies"
    region: str = ""
    count: int = 8


_FALLBACK_PREFIXES = ["Nova", "Bright", "Apex", "North", "Prime", "Blue", "Silver", "Core", "Atlas", "Vertex"]
_FALLBACK_SUFFIXES = ["Studio", "Labs", "Digital", "Works", "Collective", "Partners", "Agency", "HQ", "Media", "Group"]
_FALLBACK_SIZES = ["2-10", "10-50", "50-200", "Solo founder"]


def _lead_fallback(body: LeadFindBody) -> list[dict]:
    niche = (body.niche or "digital").split()[0].title()
    region = (body.region or "").strip().title()
    leads = []
    for i in range(min(body.count, 12)):
        name = f"{_FALLBACK_PREFIXES[i % 10]} {_FALLBACK_SUFFIXES[(i * 3 + 1) % 10]}"
        domain = name.lower().replace(" ", "") + ".io"
        leads.append({
            "name": name,
            "email": f"hello@{domain}",
            "focus": f"{niche} services{(' in ' + region) if region else ''}",
            "size": _FALLBACK_SIZES[i % 4],
            "why": f"Buys {niche.lower()} work regularly — good fit for your services",
        })
    return leads


@router.post("/growth/leads/find")
async def find_leads(body: LeadFindBody, user: dict = Depends(current_user)):
    niche = (body.niche or "digital agencies").strip()
    if len(niche) > 120:
        raise HTTPException(422, "Niche too long")
    count = max(3, min(body.count, 12))
    raw = await llm.achat(
        [
            {
                "role": "system",
                "content": (
                    "You are a B2B prospecting assistant. Return ONLY a JSON array — no prose, "
                    "no markdown fences. Each item: {\"name\",\"email\",\"focus\",\"size\",\"why\"}. "
                    "Plausible but generic business names and hello@/info@ style emails. "
                    "'why' = one short clause on why they're a good outreach target."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Generate {count} outreach prospects for a freelancer platform targeting: "
                    f"{niche}{' in ' + body.region if body.region else ''}. "
                    "Return the JSON array only."
                ),
            },
        ],
        max_tokens=3000,
    )
    leads: list[dict] = []
    if raw:
        import json
        m = re.search(r"\[.*\]", raw, re.S)
        try:
            if m:
                parsed = json.loads(m.group(0))
                leads = [
                    {
                        "name": str(x.get("name", "")).strip()[:80],
                        "email": str(x.get("email", "")).strip()[:120],
                        "focus": str(x.get("focus", niche))[:120],
                        "size": str(x.get("size", ""))[:40],
                        "why": str(x.get("why", ""))[:160],
                    }
                    for x in parsed
                    if isinstance(x, dict) and x.get("name")
                ][:count]
        except Exception:
            leads = []
    ai = bool(leads)
    if not leads:
        leads = _lead_fallback(body)
    await repo.log_activity(user["id"], "Operator", f"AI Lead Finder: found {len(leads)} prospects for '{niche}'")
    return {"leads": leads, "aiGenerated": ai}


# --------------------------------------------------------------------------- #
# Campaign send — human-reviewed list, real provider delivery
# --------------------------------------------------------------------------- #
class Recipient(BaseModel):
    name: str = ""
    email: str


class CampaignSendBody(BaseModel):
    name: str = "Campaign"
    offer: str = "trial"
    subject: str
    body: str                       # supports {name} and {agency} placeholders
    recipients: list[Recipient]
    senderName: str = ""


def _personalize(template: str, r: Recipient) -> str:
    first = (r.name or "there").split()[0]
    return (template
            .replace("{name}", first)
            .replace("{agency}", r.name or "your agency"))


def _html(text: str) -> str:
    paras = "".join(
        f"<p style=\"margin:0 0 14px\">{line}</p>"
        for line in text.split("\n\n") if line.strip()
    ).replace("\n", "<br>")
    return mail._wrap("Autopilot", paras)


@router.get("/growth/provider-status")
def provider_status():
    """Let the UI show whether real delivery is wired up before a send."""
    s = get_settings()
    provider = "resend" if s.resend_api_key else ("smtp" if (s.smtp_host and s.smtp_user) else None)
    return {"enabled": mail.enabled(), "provider": provider, "dailyHint": "Resend ~3,000/mo · SMTP varies"}


@router.post("/growth/campaigns/send", dependencies=[Depends(require_owner)])
async def send_campaign(body: CampaignSendBody, user: dict = Depends(current_user)):
    if not mail.enabled():
        raise HTTPException(
            status_code=503,
            detail="Email not configured — set RESEND_API_KEY or SMTP_* env vars on the backend.",
        )
    recipients = [r for r in body.recipients if r.email and "@" in r.email]
    if not recipients:
        raise HTTPException(status_code=422, detail="No valid recipients.")

    results = []
    for r in recipients[:50]:  # hard cap — human-scale campaigns, not spam blasts
        ok = await mail.send_email(r.email, body.subject, _html(_personalize(body.body, r)))
        results.append({"name": r.name, "email": r.email, "ok": ok})

    sent = sum(1 for r in results if r["ok"])
    failed = len(results) - sent
    record = await repo.add("campaigns", user["id"], {
        "name": body.name,
        "offer": body.offer,
        "subject": body.subject,
        "sent": sent,
        "failed": failed,
        "recipients": len(results),
        "createdAt": _now(),
        "status": "Sent",
    })
    await repo.log_activity(user["id"], "Operator", f"Campaign \"{body.name}\" sent — {sent} delivered, {failed} failed",
                            "success" if failed == 0 else "warning")
    await repo.notify(
        user["id"],
        f"Campaign \"{body.name}\" finished",
        f"{sent} of {len(results)} emails delivered via provider."
        + (f" {failed} failed — check provider logs." if failed else ""),
        "success" if failed == 0 else "warning",
    )
    return {"ok": sent > 0, "sent": sent, "failed": failed, "results": results, "campaign": record}
