"""Optional adapters for product connections and external workflow engines.

All integrations fail closed when their service is not configured. Marketplace
access still needs its own provider authorization and is never enabled here by
Nango/Composio credentials alone.
"""
import logging
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from . import job_sources, repo, seed
from .auth import current_user, is_owner
from .config import get_settings

router = APIRouter(prefix="/integrations", tags=["integrations"])
log = logging.getLogger("autopilot.integrations")


class NangoSessionBody(BaseModel):
    integration_id: str = Field(min_length=1, max_length=120)


class NangoConnectionBody(BaseModel):
    provider_config_key: str = Field(alias="providerConfigKey", min_length=1, max_length=120)
    connection_id: str = Field(alias="connectionId", min_length=1, max_length=200)


def _nango_integrations_allowed(settings) -> set[str]:
    """Hide marketplace OAuth flows until their explicit approval gates pass."""
    configured = {value.strip() for value in settings.nango_integrations.split(",") if value.strip()}
    if "microsoft-outlook" in configured and not (
        settings.outlook_inbox_read_approved and settings.inbound_email_platforms.strip()
    ):
        configured.remove("microsoft-outlook")
    if "upwork" in configured and not settings.upwork_commercial_approved:
        configured.remove("upwork")
    return configured


async def nango_request(user_id: str, integration_id: str, method: str,
                        endpoint: str, *, json_body: dict | None = None) -> dict:
    """Proxy a provider request through the authenticated user's Nango connection."""
    settings = get_settings()
    if not settings.nango_secret_key or integration_id not in _nango_integrations_allowed(settings):
        raise HTTPException(503, f"{integration_id} is not enabled for this environment.")
    user_settings = await repo.get_settings_doc(user_id, seed.SETTINGS)
    connections = user_settings.get("nangoConnections", {})
    connection = connections.get(integration_id) if isinstance(connections, dict) else None
    connection_id = connection.get("connectionId") if isinstance(connection, dict) else None
    if not connection_id:
        raise HTTPException(409, f"Connect your {integration_id} account first.")
    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=False) as client:
            response = await client.request(
                method,
                f"{settings.nango_base_url.rstrip('/')}/proxy/{endpoint.lstrip('/')}",
                headers={
                    "Authorization": f"Bearer {settings.nango_secret_key}",
                    "Connection-Id": connection_id,
                    "Provider-Config-Key": integration_id,
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
                json=json_body,
            )
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict):
            raise ValueError("Invalid provider response")
        return payload
    except httpx.HTTPStatusError as exc:
        # Never return the upstream body, which may contain private account data.
        log.warning("Nango provider request failed: integration=%s status=%s", integration_id,
                    exc.response.status_code)
        raise HTTPException(502, f"{integration_id} API request failed with status {exc.response.status_code}.")
    except (httpx.HTTPError, ValueError):
        log.exception("Nango provider request failed: integration=%s", integration_id)
        raise HTTPException(502, f"Could not call the {integration_id} API.")


@router.get("/nango")
async def list_nango_integrations(user: dict = Depends(current_user)):
    settings = get_settings()
    configured_integrations = sorted(_nango_integrations_allowed(settings))
    configured = bool(settings.nango_secret_key and configured_integrations)
    values = await repo.get_settings_doc(user["id"], seed.SETTINGS)
    saved = values.get("nangoConnections", {})
    connections = {
        key: {"connectionId": item.get("connectionId"), "connectedAt": item.get("connectedAt")}
        for key, item in saved.items() if isinstance(item, dict) and item.get("connectionId")
    } if isinstance(saved, dict) else {}
    return {"configured": configured,
            "integrations": configured_integrations if configured else [],
            "connections": connections}


@router.get("/capabilities")
async def list_marketplace_capabilities(user: dict = Depends(current_user)):
    """Report live feature readiness without exposing credentials.

    `ready` means configuration and the corresponding approval switch are
    present. It does not claim an end-user OAuth connection exists.
    """
    settings = get_settings()
    user_settings = await repo.get_settings_doc(user["id"], seed.SETTINGS)
    user_connections = user_settings.get("nangoConnections", {})
    upwork_connection = user_connections.get("upwork") if isinstance(user_connections, dict) else None
    upwork_ready = bool(
        settings.upwork_commercial_approved and settings.nango_secret_key
        and "upwork" in _nango_integrations_allowed(settings)
        and isinstance(upwork_connection, dict) and upwork_connection.get("connectionId")
    )
    freelancer_token = bool(settings.freelancer_oauth_token)
    freelancer_sandbox = bool(freelancer_token and settings.freelancer_sandbox)
    freelancer_live_ready = bool(
        freelancer_token and not freelancer_sandbox and settings.freelancer_api_approved
    )
    freelancer_bid_ready = bool(
        (freelancer_sandbox or freelancer_live_ready) and freelancer_token and is_owner(user)
    )
    inbound_domain_ready = bool(
        settings.inbound_email_domain and settings.inbound_email_webhook_secret
    )
    allowed_email_platforms = {
        name.strip().lower() for name in settings.inbound_email_platforms.split(",") if name.strip()
    }
    from .routers.inbox import _PLATFORM_DOMAINS  # inbox imports this module
    supported_email_platforms = {name.lower() for name in _PLATFORM_DOMAINS}
    configured_email_platforms = allowed_email_platforms & supported_email_platforms

    def capability(ready: bool, reason: str, mode: str = "manual") -> dict:
        return {"ready": ready, "mode": mode if ready else "disabled", "reason": reason}

    forwarded_platforms = {
        platform: capability(
            inbound_domain_ready and platform.lower() in configured_email_platforms,
            "Forwarded notification emails can be imported; direct marketplace inbox access is not connected.",
            "forwarded_email",
        )
        for platform in ("Upwork", "Freelancer.com", "Fiverr")
    }

    return {
        "platforms": {
            "Upwork": {
                "job_search": capability(upwork_ready, "Requires an API token and approved commercial access.", "api"),
                "proposal_submit": capability(
                    False,
                    "Proposal submission is not implemented yet; it also requires the approved Submit Proposal scope.",
                ),
                "message_read": forwarded_platforms["Upwork"],
                "message_send": capability(
                    False,
                    "Message sending is not implemented yet; it requires an approved messaging write scope and user confirmation.",
                ),
                "gig_publish": capability(False, "Publishing access has not been implemented or approved."),
            },
            "Freelancer.com": {
                "job_search": capability(
                    settings.freelancer_api_approved,
                    "Production search requires written API permission.",
                    "api",
                ),
                "bid_submit": capability(
                    freelancer_bid_ready,
                    "Current API token supports bidding only for the configured owner; per-user OAuth is still needed for multi-user bidding.",
                    "sandbox" if freelancer_sandbox else "api",
                ),
                "message_read": forwarded_platforms["Freelancer.com"],
                "message_send": capability(False, "Message sending is not implemented."),
                "gig_publish": capability(False, "Publishing access has not been implemented or approved."),
            },
            "Fiverr": {
                "message_read": forwarded_platforms["Fiverr"],
                "message_send": capability(False, "Use the Fiverr site manually unless Fiverr explicitly approves an integration."),
                "job_search": capability(False, "No approved job-search integration is available."),
                "gig_publish": capability(False, "Drafts are supported; publishing remains manual."),
            },
        },
        "job_finder": {
            **{
                source["name"]: capability(source["enabled"], source["reason"], source["mode"])
                for source in job_sources.source_report(settings)
            },
            "Upwork": capability(upwork_ready, "Requires an API token and approved commercial access.", "api"),
        },
        "product_features": {
            "unified_inbox": capability(
                inbound_domain_ready and bool(configured_email_platforms),
                "Imports configured marketplace notification emails; approved Outlook sync is optional. Replies are drafts and must be sent manually.",
                "forwarded_email",
            ),
            "reply_drafts": capability(
                True,
                "Generate and save reply drafts; sending them from marketplace accounts is not connected.",
                "draft",
            ),
            "job_finder": capability(
                True,
                f"Searches {len(job_sources.enabled_sources(settings))} enabled public job feeds and APIs "
                "and can notify on strong scheduled matches.",
                "feed",
            ),
            "proposal_drafts": capability(
                True,
                "Creates personalized proposal drafts; submission remains review-gated and platform-dependent.",
                "draft",
            ),
            "review_gated_bidding": capability(
                True,
                "Prepares bids and enforces review, match, budget, and daily-cap rules. Live submission depends on approved platform access.",
                "draft",
            ),
            "gig_drafts": capability(
                True,
                "Creates reusable multi-platform listing drafts; publishing and updates remain manual.",
                "draft",
            ),
            "inbound_email_alias": capability(
                inbound_domain_ready and bool(configured_email_platforms),
                "Creates a unique receiving address for marketplace notification forwarding; it is not a full email mailbox.",
                "alias",
            ),
            "guided_account_setup": capability(
                True,
                "Provides official signup links and per-platform checklists; users complete registration and verification.",
                "guided",
            ),
            "marketplace_account_creation": capability(False, "Marketplace registration and verification remain user-led."),
            "app_account_signup": capability(True, "Users can create an account for this application.", "enabled"),
        },
        "inbox_sources": {
            "Forwarded marketplace email": capability(
                inbound_domain_ready and bool(configured_email_platforms),
                "Requires an inbound email domain, webhook secret, and platform allowlist.",
                "forwarded_email",
            ),
            "Microsoft Outlook": capability(
                bool(settings.outlook_inbox_read_approved and settings.nango_secret_key
                     and settings.inbound_email_platforms.strip()
                     and "microsoft-outlook" in _nango_integrations_allowed(settings)),
                "Read-only mailbox import requires user OAuth, reviewed Mail.Read consent, and an approved sender allowlist.",
                "api",
            ),
        },
        "user_oauth": {
            "configured": bool(settings.nango_secret_key and settings.nango_integrations.strip()),
            "integrations": sorted(_nango_integrations_allowed(settings)),
        },
    }


@router.post("/nango/session")
async def create_nango_session(body: NangoSessionBody, user: dict = Depends(current_user)):
    """Mint a short-lived Nango Connect token for an explicitly enabled app."""
    settings = get_settings()
    allowed = _nango_integrations_allowed(settings)
    if not settings.nango_secret_key or not allowed:
        raise HTTPException(503, "User connections are not configured.")
    if body.integration_id not in allowed:
        raise HTTPException(403, "This integration is not enabled.")
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                f"{settings.nango_base_url.rstrip('/')}/connect/sessions",
                headers={"Authorization": f"Bearer {settings.nango_secret_key}"},
                json={
                    "end_user": {"id": user["id"], "email": user["email"],
                                 "display_name": user.get("name", "")},
                    "allowed_integrations": [body.integration_id],
                },
            )
            response.raise_for_status()
        data = response.json().get("data", {})
        if not data.get("token"):
            raise ValueError("Missing Connect session token")
        return {"sessionToken": data["token"], "expiresAt": data.get("expires_at")}
    except (httpx.HTTPError, ValueError, TypeError):
        log.exception("Nango Connect session creation failed for integration %s", body.integration_id)
        raise HTTPException(502, "Could not start the account connection flow.")


@router.post("/nango/connection")
async def save_nango_connection(body: NangoConnectionBody, user: dict = Depends(current_user)):
    """Associate an SDK-reported connection only after verifying it with Nango."""
    settings = get_settings()
    allowed = _nango_integrations_allowed(settings)
    if not settings.nango_secret_key or body.provider_config_key not in allowed:
        raise HTTPException(403, "This Nango integration is not enabled.")
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(
                f"{settings.nango_base_url.rstrip('/')}/connections/{body.connection_id}",
                params={"provider_config_key": body.provider_config_key},
                headers={"Authorization": f"Bearer {settings.nango_secret_key}"},
            )
            response.raise_for_status()
        connection = response.json()
        if not isinstance(connection, dict):
            raise HTTPException(502, "Nango returned an invalid connection record.")
        if isinstance(connection.get("data"), dict):
            connection = connection["data"]
        if not isinstance(connection, dict):
            raise HTTPException(502, "Nango returned an invalid connection record.")
        if (connection.get("connection_id") != body.connection_id
                or connection.get("provider_config_key") != body.provider_config_key):
            raise HTTPException(403, "Nango connection details did not match the request.")
        end_user = connection.get("end_user")
        end_user_id = end_user.get("id") if isinstance(end_user, dict) else None
        tags = connection.get("tags") or {}
        linked_user_id = end_user_id or tags.get("end_user_id")
        if linked_user_id != user["id"]:
            raise HTTPException(403, "This Nango connection belongs to another app user.")
    except HTTPException:
        raise
    except (httpx.HTTPError, ValueError, TypeError):
        log.exception("Nango connection verification failed for integration %s", body.provider_config_key)
        raise HTTPException(502, "Could not verify the Nango connection.")

    values = await repo.get_settings_doc(user["id"], seed.SETTINGS)
    connections = values.get("nangoConnections", {})
    if not isinstance(connections, dict):
        connections = {}
    connections[body.provider_config_key] = {
        "connectionId": body.connection_id,
        "connectedAt": datetime.now(timezone.utc).isoformat(),
    }
    await repo.update_settings_doc(user["id"], {"nangoConnections": connections}, seed.SETTINGS)
    await repo.log_activity(user["id"], "Integrations", f"Connected Nango integration {body.provider_config_key}")
    return {"ok": True, "integrationId": body.provider_config_key,
            "connectionId": body.connection_id}


@router.post("/composio/session")
async def create_composio_session(user: dict = Depends(current_user)):
    """Create a user-scoped Composio agent session with an explicit toolkit allowlist."""
    settings = get_settings()
    toolkits = sorted({name.strip().lower() for name in settings.composio_allowed_toolkits.split(",")
                       if name.strip()})
    if not settings.composio_api_key or not toolkits:
        raise HTTPException(503, "Agent tool connections are not configured.")
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                "https://backend.composio.dev/api/v3.1/tool_router/session",
                headers={"x-api-key": settings.composio_api_key},
                json={"user_id": user["id"], "toolkits": {"enable": toolkits}},
            )
            response.raise_for_status()
        data = response.json()
        session_id = data.get("session_id")
        if not session_id:
            raise ValueError("Missing Composio session ID")
        await repo.update_settings_doc(user["id"], {"composioSessionId": session_id}, seed.SETTINGS)
        return {"configured": True, "sessionId": session_id, "toolkits": toolkits}
    except (httpx.HTTPError, ValueError, TypeError):
        log.exception("Composio session creation failed for user %s", user["id"])
        raise HTTPException(502, "Could not start the agent integration session.")


async def emit_activepieces_event(event: str, fields: dict) -> bool:
    """Send a minimal event to a configured Activepieces webhook flow."""
    settings = get_settings()
    if not settings.activepieces_webhook_url or not settings.activepieces_webhook_secret:
        return False
    headers = {"Authorization": f"Bearer {settings.activepieces_webhook_secret}"}
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.post(
                settings.activepieces_webhook_url,
                headers=headers,
                json={"event": event, **fields},
            )
            response.raise_for_status()
        return True
    except httpx.HTTPError:
        log.warning("Activepieces webhook delivery failed for event %s", event, exc_info=True)
        return False
