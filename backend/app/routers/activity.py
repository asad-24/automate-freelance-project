"""Activity — the signed-in user's notifications, audit log and settings.

GET   /api/notifications              -> newest first (kept 90 days)
POST  /api/notifications/read-all
POST  /api/notifications/{id}/read
GET   /api/audit-log                  -> the user's own activity (kept 180 days)
GET   /api/settings                   -> the user's settings over product defaults
PATCH /api/settings
POST  /api/sales/alert                -> test-ping the user's sales webhook

Platform owner only:
POST  /api/email/test                 -> check the email provider
GET   /api/beta-testers, PATCH /api/beta-testers/{id}
"""
import asyncio
import ipaddress
import re
import socket
import time
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .. import email as mail, repo, seed
from ..auth import current_user, require_owner

router = APIRouter(tags=["activity"])

_SETTING_KEY = re.compile(r"^[A-Za-z][A-Za-z0-9_]{0,40}$")
_MAX_SETTINGS_FIELDS = 40


# --- Notifications -----------------------------------------------------------
@router.get("/notifications")
async def list_notifications(user: dict = Depends(current_user)):
    return await repo.list_for("notifications", user["id"], limit=100)


@router.post("/notifications/read-all")
async def read_all_notifications(user: dict = Depends(current_user)):
    await repo.update_all("notifications", user["id"], {"read": True})
    return {"ok": True}


@router.post("/notifications/{notif_id}/read")
async def read_notification(notif_id: str, user: dict = Depends(current_user)):
    n = await repo.update("notifications", user["id"], notif_id, {"read": True})
    if not n:
        raise HTTPException(404, "Notification not found")
    return n


# --- Audit log ---------------------------------------------------------------
@router.get("/audit-log")
async def list_audit_log(user: dict = Depends(current_user)):
    return await repo.list_for("activity", user["id"])


# --- Settings ----------------------------------------------------------------
@router.get("/settings")
async def get_settings(user: dict = Depends(current_user)):
    return await repo.get_settings_doc(user["id"], seed.SETTINGS)


@router.patch("/settings")
async def update_settings(body: dict, user: dict = Depends(current_user)):
    if len(body) > _MAX_SETTINGS_FIELDS or not all(_SETTING_KEY.match(k) for k in body):
        raise HTTPException(422, "Invalid settings fields.")
    editable = {"mode", "matchThreshold", "budgetFloor", "appsPerDay", "autoBid",
                "autoPayout", "selfHeal", "notifications", "salesWebhook", "profile",
                "clientFacingModel", "internalModel"}
    if not set(body).issubset(editable):
        raise HTTPException(422, "These settings are server-managed. Use the dedicated feature endpoint.")
    hook = body.get("salesWebhook")
    if hook and urlparse(str(hook)).scheme != "https":
        raise HTTPException(422, "The sales webhook must be an https:// URL.")
    settings = await repo.update_settings_doc(user["id"], body, seed.SETTINGS)
    await repo.log_activity(user["id"], "Operator", "Settings updated")
    return settings


# --- Sales alerts — push sale events to the user's own webhook (e.g. phone via
# Telegram/Zapier/n8n). The URL is user-supplied, so it must resolve to a public
# address — never the server's own network — and redirects aren't followed.
class SaleAlertBody(BaseModel):
    event: str = "sale"
    label: str = ""
    amount: float = 0


def _public_webhook_error(url: str) -> str | None:
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname:
        return "The webhook must be an https:// URL."
    try:
        infos = socket.getaddrinfo(parsed.hostname, parsed.port or 443, proto=socket.IPPROTO_TCP)
    except socket.gaierror:
        return "The webhook host can't be resolved."
    if any(not ipaddress.ip_address(info[4][0]).is_global for info in infos):
        return "The webhook must point to a public internet address."
    return None


async def send_sale_alert(user_id: str, event: str, label: str = "", amount: float = 0) -> dict:
    """POST a sale event to the user's webhook. Never raises — a webhook
    problem must not break the purchase that triggered it."""
    url = (await repo.get_settings_doc(user_id, seed.SETTINGS)).get("salesWebhook")
    if not url:
        return {"delivered": False, "reason": "no webhook configured"}
    error = await asyncio.to_thread(_public_webhook_error, url)
    if error:
        return {"delivered": False, "reason": error}
    payload = {
        "source": "autopilot", "event": event, "label": label, "amount": amount,
        "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    try:
        async with httpx.AsyncClient(timeout=8, follow_redirects=False) as client:
            r = await client.post(url, json=payload)
    except httpx.HTTPError as exc:
        return {"delivered": False, "reason": str(exc)}
    return {"delivered": True} if r.status_code < 300 else {"delivered": False, "reason": f"HTTP {r.status_code}"}


@router.post("/sales/alert")
async def sales_alert(body: SaleAlertBody, user: dict = Depends(current_user)):
    result = await send_sale_alert(user["id"], body.event, body.label, body.amount)
    await repo.log_activity(user["id"], "System", f"Sale alert ({body.event}): {body.label or 'ping'}")
    return result


# --- Platform owner ----------------------------------------------------------
class EmailTestBody(BaseModel):
    to: str


@router.post("/email/test", dependencies=[Depends(require_owner)])
async def email_test(body: EmailTestBody):
    if not mail.enabled():
        raise HTTPException(503, "Email not configured — set RESEND_API_KEY or SMTP_* env vars.")
    ok = await mail.send_email(body.to, "Autopilot email test", mail._wrap("It works", "<p>Email delivery is live.</p>"))
    if not ok:
        raise HTTPException(502, "Provider rejected the send — check credentials.")
    return {"ok": True}


@router.get("/beta-testers", dependencies=[Depends(require_owner)])
async def list_beta_testers():
    return await repo.list_beta_testers()


@router.patch("/beta-testers/{tester_id}", dependencies=[Depends(require_owner)])
async def update_beta_tester(tester_id: str, body: dict):
    fields = {k: v for k, v in body.items() if k in ("status", "feedback", "rating", "area")}
    t = await repo.update_beta_tester(tester_id, fields)
    if not t:
        raise HTTPException(404, "Tester not found")
    return t
