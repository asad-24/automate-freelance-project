"""Per-user data — every record belongs to exactly one user.

MongoDB collections (in-memory fallback when MONGODB_URI is unset, so local
development and tests work without a database):

  workspaces       one doc per user — the dashboard's own state (accounts,
                   gigs, radar, growth…), versioned against stale overwrites
  billing          one doc per user — plan, credits, purchases. Server-owned:
                   the browser can read it but never write it directly.
  settings         one doc per user
  notifications    per-user feed, expires after 90 days
  activity         per-user audit log, expires after 180 days
  automation_jobs  per-user automation queue
  campaigns        per-user outreach campaigns
  beta_testers     public beta signups (platform-level, keyed by email)

Every query filters by user_id; callers pass the signed-in user's id.
"""
import logging
import threading
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from pymongo import DESCENDING, ReturnDocument
from pymongo.errors import DuplicateKeyError

from . import db

log = logging.getLogger("autopilot.repo")

LIST_COLLECTIONS = ("notifications", "activity", "automation_jobs", "campaigns", "bids", "messages", "proposals")
_TTL = {"notifications": timedelta(days=90), "messages": timedelta(days=90), "activity": timedelta(days=180)}
# In-memory mode has no TTL index — cap each user's list instead.
_MEM_CAP = 500

DEFAULT_BILLING = {"plan": "free", "bidCredits": 10, "profileCredits": 2, "purchases": []}
CREDIT_FIELDS = {"bid": "bidCredits", "profile": "profileCredits"}

_mem_lists: dict[str, list[dict]] = {c: [] for c in LIST_COLLECTIONS}
_mem_docs: dict[str, dict[str, dict]] = {"workspaces": {}, "billing": {}, "settings": {}, "beta_testers": {}}
_mem_bid_counters: dict[str, int] = {}
_mem_bid_lock = threading.Lock()


def reset_memory() -> None:
    """Tests only — wipe the in-memory fallback."""
    for v in _mem_lists.values():
        v.clear()
    for v in _mem_docs.values():
        v.clear()
    _mem_bid_counters.clear()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _public(doc: dict) -> dict:
    """Strip storage fields; datetimes become ISO strings for the frontend."""
    out = {k: v for k, v in doc.items() if k not in ("_id", "user_id")}
    for k, v in out.items():
        if isinstance(v, datetime):
            out[k] = v.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return out


# --------------------------------------------------------------------------- #
# Startup
# --------------------------------------------------------------------------- #
async def ensure_indexes() -> None:
    if not db.enabled():
        return
    mdb = db._get_db()
    for coll in LIST_COLLECTIONS:
        await mdb[coll].create_index([("user_id", 1), ("created_at", DESCENDING)])
    await mdb.messages.create_index([("user_id", 1), ("dedupe_key", 1)], unique=True, sparse=True)
    await mdb.bid_daily_limits.create_index("created_at", expireAfterSeconds=90 * 24 * 60 * 60)
    for coll, ttl in _TTL.items():
        await mdb[coll].create_index("created_at", expireAfterSeconds=int(ttl.total_seconds()))


async def archive_legacy_state() -> bool:
    """One-time move away from the old single shared `app_state` document.

    The old document mixed every user's data, so it can't be split per user.
    It's copied to `app_state_backup` (never deleted outright), beta signups
    are carried over to their own collection, then it's removed. Safe to re-run
    if interrupted: the backup is written first and tester upserts are
    idempotent.
    """
    if not db.enabled():
        return False
    mdb = db._get_db()
    doc = await mdb.app_state.find_one({"_id": "state"})
    if not doc:
        return False
    data = doc.get("data") or {}
    stamp = _now().strftime("%Y%m%dT%H%M%SZ")
    await mdb.app_state_backup.insert_one({"_id": f"state-{stamp}", "data": data, "archived_at": _now()})
    for t in data.get("beta_testers") or []:
        email = str(t.get("email", "")).strip().lower()
        if email:
            await mdb.beta_testers.update_one({"_id": email}, {"$setOnInsert": {**t, "email": email}}, upsert=True)
    await mdb.app_state.delete_one({"_id": "state"})
    log.warning("Archived legacy shared app_state to app_state_backup/state-%s", stamp)
    return True


# --------------------------------------------------------------------------- #
# Per-user lists — notifications, activity, automation jobs, campaigns
# --------------------------------------------------------------------------- #
async def add(coll: str, user_id: str, fields: dict) -> dict:
    doc = {"id": uuid4().hex, **fields, "user_id": user_id, "created_at": _now()}
    doc["_id"] = doc["id"]
    if not db.enabled():
        items = _mem_lists[coll]
        items.insert(0, doc)
        mine = [d for d in items if d["user_id"] == user_id]
        if len(mine) > _MEM_CAP:
            items.remove(mine[-1])
        return _public(doc)
    await db._get_db()[coll].insert_one(doc)
    return _public(doc)


async def list_for(coll: str, user_id: str, limit: int = 200) -> list[dict]:
    if not db.enabled():
        return [_public(d) for d in _mem_lists[coll] if d["user_id"] == user_id][:limit]
    cursor = db._get_db()[coll].find({"user_id": user_id}).sort("created_at", DESCENDING).limit(limit)
    return [_public(d) async for d in cursor]


async def get(coll: str, user_id: str, item_id: str) -> dict | None:
    if not db.enabled():
        doc = next((d for d in _mem_lists[coll] if d["id"] == item_id and d["user_id"] == user_id), None)
    else:
        doc = await db._get_db()[coll].find_one({"_id": item_id, "user_id": user_id})
    return _public(doc) if doc else None


async def update(coll: str, user_id: str, item_id: str, fields: dict, *, expect: dict | None = None) -> dict | None:
    """Set `fields` on one of the user's records. With `expect`, the update only
    applies if those fields currently match — an atomic compare-and-set, used
    so a double-clicked approval can't run twice. Returns None if the record
    doesn't exist, isn't the user's, or didn't match."""
    expect = expect or {}
    if not db.enabled():
        for d in _mem_lists[coll]:
            if d["id"] == item_id and d["user_id"] == user_id:
                if any(d.get(k) != v for k, v in expect.items()):
                    return None
                d.update(fields)
                return _public(d)
        return None
    doc = await db._get_db()[coll].find_one_and_update(
        {"_id": item_id, "user_id": user_id, **expect},
        {"$set": fields},
        return_document=ReturnDocument.AFTER,
    )
    return _public(doc) if doc else None


async def update_all(coll: str, user_id: str, fields: dict) -> None:
    if not db.enabled():
        for d in _mem_lists[coll]:
            if d["user_id"] == user_id:
                d.update(fields)
        return
    await db._get_db()[coll].update_many({"user_id": user_id}, {"$set": fields})


async def log_activity(user_id: str, agent: str, action: str, status: str = "success") -> None:
    await add("activity", user_id, {"agent": agent, "action": action, "status": status})


async def notify(user_id: str, title: str, body: str, kind: str = "success") -> None:
    await add("notifications", user_id, {"title": title, "body": body, "type": kind, "read": False})


# --------------------------------------------------------------------------- #
# Workspace — one versioned document per user
# --------------------------------------------------------------------------- #
async def get_workspace(user_id: str) -> dict:
    if not db.enabled():
        doc = _mem_docs["workspaces"].get(user_id)
    else:
        doc = await db._get_db().workspaces.find_one({"_id": user_id})
    if not doc:
        return {"state": {}, "version": 0}
    return {"state": doc["state"], "version": doc["version"]}


async def save_workspace(user_id: str, state: dict, version: int) -> int | None:
    """Replace the user's workspace if `version` is still current. Returns the
    new version, or None when another tab/device saved first."""
    if not db.enabled():
        docs = _mem_docs["workspaces"]
        current = docs.get(user_id, {}).get("version", 0)
        if current != version:
            return None
        docs[user_id] = {"state": deepcopy(state), "version": version + 1}
        return version + 1
    coll = db._get_db().workspaces
    if version == 0:
        try:
            await coll.insert_one({"_id": user_id, "state": state, "version": 1, "updated_at": _now()})
        except DuplicateKeyError:
            return None
        return 1
    res = await coll.update_one(
        {"_id": user_id, "version": version},
        {"$set": {"state": state, "updated_at": _now()}, "$inc": {"version": 1}},
    )
    return version + 1 if res.matched_count else None


# --------------------------------------------------------------------------- #
# Settings — one document per user
# --------------------------------------------------------------------------- #
async def get_settings_doc(user_id: str, defaults: dict) -> dict:
    if not db.enabled():
        doc = _mem_docs["settings"].get(user_id)
    else:
        doc = await db._get_db().settings.find_one({"_id": user_id})
    return {**defaults, **((doc or {}).get("values") or {})}


async def update_settings_doc(user_id: str, values: dict, defaults: dict) -> dict:
    if not db.enabled():
        current = _mem_docs["settings"].setdefault(user_id, {"values": {}})
        current["values"].update(values)
    else:
        await db._get_db().settings.update_one(
            {"_id": user_id}, {"$set": {f"values.{k}": v for k, v in values.items()}}, upsert=True,
        )
    return await get_settings_doc(user_id, defaults)


async def user_for_inbound_hash(token_hash: str) -> str | None:
    if not db.enabled():
        return next((uid for uid, doc in _mem_docs["settings"].items()
                     if doc.get("values", {}).get("inboundTokenHash") == token_hash), None)
    doc = await db._get_db().settings.find_one({"values.inboundTokenHash": token_hash}, {"_id": 1})
    return str(doc["_id"]) if doc else None


async def add_message(user_id: str, fields: dict, dedupe_key: str) -> dict | None:
    """Insert one normalized inbox message; return None for duplicate Message-IDs."""
    doc = {"id": uuid4().hex, **fields, "dedupe_key": dedupe_key, "user_id": user_id, "created_at": _now()}
    doc["_id"] = doc["id"]
    if not db.enabled():
        if any(x.get("user_id") == user_id and x.get("dedupe_key") == dedupe_key for x in _mem_lists["messages"]):
            return None
        items = _mem_lists["messages"]
        items.insert(0, doc)
        mine = [item for item in items if item["user_id"] == user_id]
        if len(mine) > _MEM_CAP:
            items.remove(mine[-1])
        return _public(doc)
    try:
        await db._get_db().messages.insert_one(doc)
    except DuplicateKeyError:
        return None
    return _public(doc)


async def find_message_by_ref(user_id: str, message_ref: str) -> dict | None:
    if not message_ref:
        return None
    if not db.enabled():
        doc = next((item for item in _mem_lists["messages"]
                    if item.get("user_id") == user_id and item.get("message_ref") == message_ref), None)
    else:
        doc = await db._get_db().messages.find_one({"user_id": user_id, "message_ref": message_ref})
    return _public(doc) if doc else None


async def reserve_daily_bid_slot(user_id: str, day: str, cap: int) -> bool:
    """Atomically claim one of the user's per-day bid slots."""
    if cap <= 0:
        return False
    key = f"{user_id}:{day}"
    if not db.enabled():
        with _mem_bid_lock:
            count = _mem_bid_counters.get(key, 0)
            if count >= cap:
                return False
            _mem_bid_counters[key] = count + 1
            return True
    coll = db._get_db().bid_daily_limits
    doc = await coll.find_one_and_update(
        {"_id": key, "count": {"$lt": cap}}, {"$inc": {"count": 1}}, return_document=ReturnDocument.AFTER,
    )
    if doc:
        return True
    try:
        await coll.insert_one({"_id": key, "user_id": user_id, "day": day, "count": 1, "created_at": _now()})
        return True
    except DuplicateKeyError:
        # Another request created the counter after our first read. Retry the
        # bounded conditional increment once, which remains atomic.
        doc = await coll.find_one_and_update(
            {"_id": key, "count": {"$lt": cap}}, {"$inc": {"count": 1}}, return_document=ReturnDocument.AFTER,
        )
        return bool(doc)


async def release_daily_bid_slot(user_id: str, day: str) -> None:
    key = f"{user_id}:{day}"
    if not db.enabled():
        with _mem_bid_lock:
            current = _mem_bid_counters.get(key, 0)
            if current <= 1:
                _mem_bid_counters.pop(key, None)
            else:
                _mem_bid_counters[key] = current - 1
        return
    coll = db._get_db().bid_daily_limits
    await coll.update_one({"_id": key, "count": {"$gt": 0}}, {"$inc": {"count": -1}})


# --------------------------------------------------------------------------- #
# Billing — server-owned plan and credits
# --------------------------------------------------------------------------- #
async def get_billing(user_id: str) -> dict:
    if not db.enabled():
        doc = _mem_docs["billing"].get(user_id)
    else:
        doc = await db._get_db().billing.find_one({"_id": user_id})
    return {**deepcopy(DEFAULT_BILLING), **{k: v for k, v in (doc or {}).items() if k != "_id"}}


async def _ensure_billing(user_id: str) -> None:
    if not db.enabled():
        _mem_docs["billing"].setdefault(user_id, deepcopy(DEFAULT_BILLING))
        return
    await db._get_db().billing.update_one(
        {"_id": user_id}, {"$setOnInsert": deepcopy(DEFAULT_BILLING)}, upsert=True,
    )


async def spend_credit(user_id: str, kind: str) -> dict | None:
    """Spend one credit atomically. Pro plans are unlimited. Returns the updated
    billing, or None when a free-plan user has none left."""
    field = CREDIT_FIELDS[kind]
    await _ensure_billing(user_id)
    if not db.enabled():
        doc = _mem_docs["billing"][user_id]
        if doc["plan"] == "pro":
            return await get_billing(user_id)
        if doc[field] <= 0:
            return None
        doc[field] -= 1
        return await get_billing(user_id)
    coll = db._get_db().billing
    if await coll.find_one({"_id": user_id, "plan": "pro"}):
        return await get_billing(user_id)
    doc = await coll.find_one_and_update(
        {"_id": user_id, field: {"$gt": 0}}, {"$inc": {field: -1}}, return_document=ReturnDocument.AFTER,
    )
    return await get_billing(user_id) if doc else None


async def refund_credit(user_id: str, kind: str) -> None:
    """Give back a credit spent on an action that then failed."""
    field = CREDIT_FIELDS[kind]
    if not db.enabled():
        doc = _mem_docs["billing"].get(user_id)
        if doc and doc["plan"] != "pro":
            doc[field] += 1
        return
    await db._get_db().billing.update_one({"_id": user_id, "plan": {"$ne": "pro"}}, {"$inc": {field: 1}})


async def record_purchase(user_id: str, purchase: dict, *, add_credits: dict | None = None, plan: str | None = None) -> dict:
    await _ensure_billing(user_id)
    add_credits = add_credits or {}
    if not db.enabled():
        doc = _mem_docs["billing"][user_id]
        for field, n in add_credits.items():
            doc[field] += n
        if plan:
            doc["plan"] = plan
        doc["purchases"].insert(0, purchase)
        return await get_billing(user_id)
    update: dict[str, Any] = {"$push": {"purchases": {"$each": [purchase], "$position": 0}}}
    if add_credits:
        update["$inc"] = add_credits
    if plan:
        update["$set"] = {"plan": plan}
    await db._get_db().billing.update_one({"_id": user_id}, update)
    return await get_billing(user_id)


# --------------------------------------------------------------------------- #
# Beta testers — platform-level, keyed by email
# --------------------------------------------------------------------------- #
async def add_beta_tester(record: dict) -> bool:
    """Returns False if the email is already registered."""
    email = record["email"]
    if not db.enabled():
        if email in _mem_docs["beta_testers"]:
            return False
        _mem_docs["beta_testers"][email] = record
        return True
    try:
        await db._get_db().beta_testers.insert_one({"_id": email, **record})
    except DuplicateKeyError:
        return False
    return True


async def list_beta_testers() -> list[dict]:
    if not db.enabled():
        return list(_mem_docs["beta_testers"].values())
    return [_public(d) async for d in db._get_db().beta_testers.find().sort("at", DESCENDING)]


async def update_beta_tester(tester_id: str, fields: dict) -> dict | None:
    if not db.enabled():
        t = next((x for x in _mem_docs["beta_testers"].values() if x["id"] == tester_id), None)
        if t:
            t.update(fields)
        return t
    doc = await db._get_db().beta_testers.find_one_and_update(
        {"id": tester_id}, {"$set": fields}, return_document=ReturnDocument.AFTER,
    )
    return _public(doc) if doc else None
