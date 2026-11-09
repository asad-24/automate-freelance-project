"""Outbound email — free-tier friendly, zero extra dependencies.

Two providers, tried in order (first configured wins):
  1. Resend API        (resend.com — 3,000 emails/mo free; env RESEND_API_KEY)
  2. Any SMTP          (Brevo 300/day, MailerSend, Gmail app password;
                        env SMTP_HOST / SMTP_USER / SMTP_PASSWORD)

SMTP uses stdlib smtplib inside a thread so the event loop never blocks.
Everything degrades to a no-op when unconfigured — never breaks a request.
"""
import asyncio
import smtplib
from email.message import EmailMessage

import httpx

from .config import get_settings


def enabled() -> bool:
    s = get_settings()
    return bool(s.resend_api_key or (s.smtp_host and s.smtp_user))


async def _send_resend(to: str, subject: str, html: str) -> bool:
    s = get_settings()
    try:
        r = await httpx.AsyncClient(timeout=15).post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {s.resend_api_key}"},
            json={"from": s.resend_from, "to": [to], "subject": subject, "html": html},
        )
        return r.status_code in (200, 201)
    except Exception:
        return False


def _smtp_send_sync(to: str, subject: str, html_body: str) -> bool:
    s = get_settings()
    msg = EmailMessage()
    msg["From"] = s.smtp_from or s.smtp_user
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content("This message requires an HTML-capable mail client.")
    msg.add_alternative(html_body, subtype="html")
    try:
        with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=15) as smtp:
            smtp.starttls()
            smtp.login(s.smtp_user, s.smtp_password)
            smtp.send_message(msg)
        return True
    except Exception:
        return False


async def send_email(to: str, subject: str, html: str) -> bool:
    """Send a single email. Returns True on success; never raises."""
    s = get_settings()
    if s.resend_api_key:
        if await _send_resend(to, subject, html):
            return True
    if s.smtp_host and s.smtp_user:
        return await asyncio.to_thread(_smtp_send_sync, to, subject, html)
    return False


# --------------------------------------------------------------------------- #
# Templates
# --------------------------------------------------------------------------- #
def _wrap(title: str, body_html: str) -> str:
    return f"""
<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;
            background:#0b0f14;color:#e6edf3;padding:32px;border-radius:12px">
  <h1 style="font-size:20px;color:#4f7cff;margin:0 0 16px">{title}</h1>
  <div style="font-size:14px;line-height:1.6;color:#c9d1d9">{body_html}</div>
  <p style="font-size:11px;color:#6b7280;margin-top:28px">
    Autopilot — your autonomous freelance platform
  </p>
</div>"""


def welcome_email(name: str, role: str) -> tuple[str, str]:
    first = (name or "there").split()[0]
    return (
        "Welcome to Autopilot",
        _wrap(
            f"Welcome aboard, {first}!",
            f"""
<p>Your <b>{role}</b> account is ready. Here's what to do first:</p>
<ol>
  <li><b>Job Radar</b> — enter your skills, get real openings ranked by match.</li>
  <li><b>AI proposals</b> — one click writes a tailored bid; you review &amp; send.</li>
  <li><b>Agents</b> — run them, watch live activity in the command center.</li>
</ol>
<p>You have <b>10 free bids + 2 free profile connections</b> on the free plan.</p>""",
        ),
    )
