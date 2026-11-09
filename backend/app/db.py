"""MongoDB connection + user accounts (Motor async driver).

When MONGODB_URI is set, accounts live in the `users` collection and per-user
data lives in the collections described in repo.py. Without it, both fall back
to process memory so local development works (data is lost on restart).

Collections
-----------
autopilot.users       one document per registered user, keyed by email
(see repo.py for the per-user data collections)
"""
import secrets
import time

from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import DuplicateKeyError

from .config import get_settings

_client: AsyncIOMotorClient | None = None
_db = None


def enabled() -> bool:
    return bool(get_settings().mongodb_uri)


def _get_db():
    global _client, _db
    if _db is None:
        _client = AsyncIOMotorClient(
            get_settings().mongodb_uri,
            serverSelectionTimeoutMS=5000,
        )
        _db = _client[get_settings().mongodb_db]
    return _db


# --------------------------------------------------------------------------- #
# Real user accounts
# --------------------------------------------------------------------------- #
# Without MONGODB_URI, accounts live in process memory so local development
# works end to end (they're lost on restart).
_mem_users: dict[str, dict] = {}


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


async def find_user(email: str) -> dict | None:
    """Look up an account by email. Database errors propagate to the caller."""
    email = email.strip().lower()
    if not enabled():
        return _mem_users.get(email)
    return await _get_db().users.find_one({"_id": email})


async def list_users() -> list[dict]:
    """Return registered users for scheduled per-user jobs."""
    if not enabled():
        return list(_mem_users.values())
    return [doc async for doc in _get_db().users.find({}, {"_id": 0})]


async def create_user(name: str, email: str, password_hash: str, role: str, company: str | None) -> dict | None:
    """Insert a user; returns the public record, or None if the email exists.
    Database errors propagate to the caller."""
    email = email.strip().lower()
    doc = {
        "_id": email,
        "id": f"u-{secrets.token_hex(6)}",
        "name": name.strip() or email.split("@")[0].title(),
        "email": email,
        "role": role,
        "company": company or "",
        "password_hash": password_hash,
        "created_at": _now(),
    }
    if not enabled():
        if email in _mem_users:
            return None
        _mem_users[email] = doc
        return _public_user(doc)
    try:
        await _get_db().users.insert_one(doc)
    except DuplicateKeyError:
        return None
    return _public_user(doc)


async def update_password_hash(email: str, password_hash: str) -> None:
    email = email.strip().lower()
    if not enabled():
        if email in _mem_users:
            _mem_users[email]["password_hash"] = password_hash
            _mem_users[email].pop("salt", None)
        return
    await _get_db().users.update_one(
        {"_id": email}, {"$set": {"password_hash": password_hash}, "$unset": {"salt": ""}}
    )


async def set_platform_owner(email: str, grant: bool) -> bool:
    """Operator CLI/test fixture only. Never exposed as a browser/API operation."""
    email = email.strip().lower()
    if not enabled():
        doc = _mem_users.get(email)
        if not doc:
            return False
        doc["platform_owner"] = grant
        return True
    result = await _get_db().users.update_one({"_id": email}, {"$set": {"platform_owner": grant}})
    return result.matched_count == 1


def _public_user(doc: dict) -> dict:
    return {
        "id": doc["id"],
        "name": doc["name"],
        "email": doc["email"],
        "role": doc["role"],
        "company": doc.get("company", ""),
        "owner": doc.get("platform_owner") is True,
    }
