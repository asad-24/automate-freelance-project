"""Accounts — signup, login and the current session.

POST /api/auth/signup  -> create an account, returns {token, user}
POST /api/auth/login   -> verify credentials, returns {token, user}
GET  /api/auth/me      -> the signed-in user (validates a stored token)

Signup and login are public; /me requires a valid bearer token.
"""
import asyncio
import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .. import db, email as mail, repo
from ..auth import (
    MIN_PASSWORD_LENGTH, ROLES, check_login_allowed, clear_login_failures,
    create_access_token, current_user, hash_password, is_owner, needs_rehash,
    record_login_failure, verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _db_unavailable() -> HTTPException:
    return HTTPException(503, "Account service is temporarily unavailable. Please try again.")


def _session(user: dict) -> dict:
    return {"ok": True, "token": create_access_token(user), "user": {**user, "owner": is_owner(user)}}


class SignupBody(BaseModel):
    name: str = ""
    email: str
    password: str
    role: str = "admin"
    company: str = ""


class LoginBody(BaseModel):
    email: str = ""
    password: str = ""
    role: str = ""


@router.post("/signup")
async def signup(body: SignupBody):
    email = body.email.strip().lower()
    if not _EMAIL_RE.match(email):
        raise HTTPException(422, "Enter a valid email address.")
    if len(body.password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(422, f"Password must be at least {MIN_PASSWORD_LENGTH} characters.")
    if body.role not in ROLES:
        raise HTTPException(422, "Choose a valid account type.")
    try:
        user = await db.create_user(body.name, email, hash_password(body.password), body.role, body.company or None)
    except Exception:
        raise _db_unavailable()
    if not user:
        raise HTTPException(409, "An account with this email already exists.")
    await repo.log_activity(user["id"], "Operator", f"Account created ({body.role})")
    # Welcome email — fire-and-forget, never blocks or fails signup.
    if mail.enabled():
        subject, html = mail.welcome_email(user["name"], body.role)
        asyncio.create_task(mail.send_email(email, subject, html))
    return _session(user)


@router.post("/login")
async def login(body: LoginBody):
    email = body.email.strip().lower()
    check_login_allowed(email)
    try:
        doc = await db.find_user(email)
    except Exception:
        raise _db_unavailable()
    if doc is None or not verify_password(doc, body.password):
        record_login_failure(email)
        raise HTTPException(401, "Invalid email or password.")
    # Enforce the account's real role — a client can't sign in as admin.
    if body.role and doc["role"] != body.role:
        raise HTTPException(
            403, f"This account is registered as '{doc['role']}' — select that role above to sign in.",
        )
    clear_login_failures(email)
    if needs_rehash(doc):
        try:
            await db.update_password_hash(email, hash_password(body.password))
        except Exception:
            pass  # the old hash still works; the upgrade retries on the next login
    user = db._public_user(doc)
    await repo.log_activity(user["id"], "Operator", f"Signed in as {doc['role']}")
    return _session(user)


@router.get("/me")
async def me(session: dict = Depends(current_user)):
    try:
        doc = await db.find_user(session["email"])
    except Exception:
        raise _db_unavailable()
    if doc is None:
        raise HTTPException(401, "This account no longer exists.")
    user = db._public_user(doc)
    return {"user": {**user, "owner": is_owner(user)}}
