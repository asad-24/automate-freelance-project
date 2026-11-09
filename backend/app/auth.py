"""Authentication — password hashing, signed access tokens, request guards.

Every API route except the public ones (routers/public.py, /auth/login,
/auth/signup, /health) requires an `Authorization: Bearer <token>` header.
Tokens are HS256 JWTs signed with SECRET_KEY. Guards also load the active
account so deleted/disabled users and revoked roles lose access immediately.

Roles
  admin       agency operator — the main dashboard
  freelancer  freelancer portal
  client      client portal
Explicitly provisioned platform owners (also listed in OWNER_EMAILS) can reach platform-wide
endpoints — credential vault, all users, audit log, demo reset — and pass
every role check.
"""
import hashlib
import hmac
import time
from collections import defaultdict, deque

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Depends, HTTPException, Request

from .config import get_settings
from . import db

ROLES = ("admin", "freelancer", "client")
MIN_PASSWORD_LENGTH = 8
_ALGORITHM = "HS256"
_ph = PasswordHasher()


# --------------------------------------------------------------------------- #
# Passwords
# --------------------------------------------------------------------------- #
def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(user_doc: dict, password: str) -> bool:
    stored = user_doc.get("password_hash", "")
    if stored.startswith("$argon2"):
        try:
            return _ph.verify(stored, password)
        except (VerificationError, InvalidHashError):
            return False
    # Legacy salted SHA-256 from before argon2 — the login route upgrades the
    # hash after the first successful check.
    legacy = hashlib.sha256(f"{user_doc.get('salt', '')}.{password}".encode()).hexdigest()
    return hmac.compare_digest(stored, legacy)


def needs_rehash(user_doc: dict) -> bool:
    stored = user_doc.get("password_hash", "")
    return not stored.startswith("$argon2") or _ph.check_needs_rehash(stored)


# --------------------------------------------------------------------------- #
# Tokens
# --------------------------------------------------------------------------- #
def create_access_token(user: dict) -> str:
    settings = get_settings()
    now = int(time.time())
    claims = {
        "sub": user["id"],
        "email": user["email"],
        "role": user["role"],
        "iat": now,
        "exp": now + settings.access_token_expire_minutes * 60,
    }
    return jwt.encode(claims, settings.secret_key, algorithm=_ALGORITHM)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(401, detail, headers={"WWW-Authenticate": "Bearer"})


async def current_user(request: Request) -> dict:
    scheme, _, token = request.headers.get("authorization", "").partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise _unauthorized("Not signed in.")
    try:
        claims = jwt.decode(token, get_settings().secret_key, algorithms=[_ALGORITHM],
                            options={"require": ["sub", "email", "role", "exp"]})
    except jwt.ExpiredSignatureError:
        raise _unauthorized("Session expired — please sign in again.")
    except jwt.InvalidTokenError:
        raise _unauthorized("Invalid session token.")
    try:
        doc = await db.find_user(claims["email"])
    except Exception:
        raise HTTPException(503, "Account service is temporarily unavailable.")
    if not doc or doc["id"] != claims["sub"] or doc.get("disabled", False):
        raise _unauthorized("This account is no longer active.")
    # Read current roles and explicitly provisioned ownership from storage.
    # An email claim, role chosen during signup, or stale JWT cannot elevate access.
    user = db._public_user(doc)
    request.state.user = user
    return user


def is_owner(user: dict) -> bool:
    return user.get("owner") is True and user["email"].lower() in get_settings().owner_email_set


def require_roles(*roles: str):
    def guard(user: dict = Depends(current_user)) -> dict:
        if user["role"] not in roles and not is_owner(user):
            raise HTTPException(403, "Your account doesn't have access to this area.")
        return user
    return guard


def require_owner(user: dict = Depends(current_user)) -> dict:
    if not is_owner(user):
        raise HTTPException(403, "Platform owner access required.")
    return user


# --------------------------------------------------------------------------- #
# Login throttling — per email, in-process (moves to Redis with the job queue)
# --------------------------------------------------------------------------- #
_LOGIN_WINDOW = 15 * 60.0
_LOGIN_MAX_FAILURES = 5
_failures: dict[str, deque] = defaultdict(deque)


def check_login_allowed(email: str) -> None:
    q = _failures[email]
    now = time.monotonic()
    while q and now - q[0] > _LOGIN_WINDOW:
        q.popleft()
    if len(q) >= _LOGIN_MAX_FAILURES:
        raise HTTPException(
            429, "Too many failed sign-in attempts. Try again in 15 minutes.",
            headers={"Retry-After": str(int(_LOGIN_WINDOW))},
        )


def record_login_failure(email: str) -> None:
    _failures[email].append(time.monotonic())


def clear_login_failures(email: str) -> None:
    _failures.pop(email, None)
