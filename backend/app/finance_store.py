"""Sandbox finance records, separate from user-editable workspaces and billing.

Each case/offering is an atomic aggregate with an append-only event history.
MongoDB compare-and-set protects review transitions and offering capacity.
There are deliberately no payment, signing, or external transaction functions.
"""
import hashlib
import json
from copy import deepcopy
from datetime import datetime, timezone
from threading import RLock
from uuid import uuid4

from pymongo.errors import DuplicateKeyError

from . import db

_memory: dict[str, dict] = {}
_lock = RLock()


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def reset_memory() -> None:
    with _lock:
        _memory.clear()


async def ensure_indexes() -> None:
    if db.enabled():
        coll = db._get_db().finance_sandbox
        await coll.create_index([("user_id", 1), ("created_at", -1)])
        await coll.create_index([("kind", 1), ("status", 1), ("created_at", -1)])
        # No TTL: review/decision history must not silently expire.


def event(actor: dict, action: str, note: str = "") -> dict:
    return {"id": uuid4().hex, "actor_id": actor["id"], "action": action,
            "note": note, "at": now()}


def fingerprint(data: dict) -> str:
    return hashlib.sha256(json.dumps(data, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def record_id(user_id: str, key: str) -> str:
    return "fin-" + hashlib.sha256(f"{user_id}:{key}".encode()).hexdigest()[:32]


async def get(item_id: str) -> dict | None:
    if db.enabled():
        doc = await db._get_db().finance_sandbox.find_one({"_id": item_id})
        return {k: v for k, v in doc.items() if k != "_id"} if doc else None
    with _lock:
        return deepcopy(_memory.get(item_id))


async def list_records(user_id: str | None = None, kind: str | None = None,
                       status: str | None = None, limit: int = 500) -> list[dict]:
    query = {k: v for k, v in {"user_id": user_id, "kind": kind, "status": status}.items() if v is not None}
    if db.enabled():
        return [{k: v for k, v in doc.items() if k != "_id"} async for doc in
                db._get_db().finance_sandbox.find(query).sort("created_at", -1).limit(limit)]
    with _lock:
        docs = [deepcopy(d) for d in _memory.values() if all(d.get(k) == v for k, v in query.items())]
    return sorted(docs, key=lambda d: d["created_at"], reverse=True)[:limit]


async def portfolio_listings(user_id: str) -> list[dict]:
    """Do not lose old holdings when unrelated global listings exceed a page."""
    if db.enabled():
        cursor = db._get_db().finance_sandbox.find(
            {"kind": "offering", "commitments.user_id": user_id},
            {"id": 1, "title": 1, "entity_type": 1, "commitments": 1},
        )
        return [{k: v for k, v in doc.items() if k != "_id"} async for doc in cursor]
    with _lock:
        return [deepcopy(doc) for doc in _memory.values() if doc["kind"] == "offering"
                and any(c["user_id"] == user_id for c in doc.get("commitments", []))]


async def insert(user: dict, kind: str, key: str, fields: dict, request_hash: str) -> tuple[dict, bool]:
    """Insert once per business/request key; callers check replay fingerprints."""
    item_id = record_id(user["id"], key)
    stamp = now()
    doc = {"id": item_id, "user_id": user["id"], "kind": kind, "mode": "sandbox",
           "status": "submitted", "version": 1, "created_at": stamp, "updated_at": stamp,
           "request_hash": request_hash, **fields, "events": [event(user, "submitted")]}
    if db.enabled():
        try:
            await db._get_db().finance_sandbox.insert_one({"_id": item_id, **doc})
        except DuplicateKeyError:
            return await get(item_id), False
    else:
        with _lock:
            if item_id in _memory:
                return deepcopy(_memory[item_id]), False
            _memory[item_id] = deepcopy(doc)
    return doc, True


async def replace(doc: dict, expected_version: int) -> bool:
    """All dependent fields, commitments and audit events change together."""
    next_doc = deepcopy(doc)
    next_doc["version"] = expected_version + 1
    next_doc["updated_at"] = now()
    if db.enabled():
        result = await db._get_db().finance_sandbox.replace_one(
            {"_id": doc["id"], "version": expected_version}, {"_id": doc["id"], **next_doc})
        return result.matched_count == 1
    with _lock:
        old = _memory.get(doc["id"])
        if not old or old["version"] != expected_version:
            return False
        _memory[doc["id"]] = next_doc
    return True
