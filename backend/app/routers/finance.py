"""Funding, protection and investments: reviewable sandbox workflows only.

USD minor units are illustrative; they are never crypto balances or payment
instructions. No endpoint in this module can enable live financial operations.
"""
from datetime import date
from typing import Annotated, Literal
from urllib.parse import urlparse
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator

from .. import db, finance_store as store
from ..auth import current_user, is_owner, require_owner

router = APIRouter(prefix="/finance", tags=["finance sandbox"])

RULES = {
    "version": "sandbox-v2-protection-3pct", "currency": "USD", "advance_cap_bps": 8000,
    "advance_fee_bps": 250, "protection_fee_bps": 300, "coverage_cap_bps": 8000,
    "minimum_commitment_minor": 1000,
}
Money = Annotated[int, Field(strict=True, gt=0, le=100_000_000)]
Kind = Literal["verification", "project", "funding", "protection", "claim", "offering"]


class Body(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    request_id: UUID
    acknowledged_sandbox: Literal[True]


def https_url(value: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Use a public HTTPS link without embedded credentials.")
    if len(value) > 1000:
        raise ValueError("Link is too long.")
    return value


class VerificationBody(Body):
    title: str = Field(min_length=3, max_length=120)
    entity_type: Literal["freelancer", "agency"]
    profile_url: str
    notes: str = Field(min_length=20, max_length=2000)

    _url = field_validator("profile_url")(https_url)


class ProjectBody(Body):
    title: str = Field(min_length=3, max_length=120)
    platform: Literal["Fiverr", "Upwork", "Freelancer.com", "Direct", "Other"]
    reference: str = Field(min_length=3, max_length=160)
    evidence_url: str
    amount_minor: Money
    due_date: date
    notes: str = Field(min_length=20, max_length=2000)

    _url = field_validator("evidence_url")(https_url)


class FundingBody(Body):
    project_id: str = Field(min_length=10, max_length=80)
    amount_minor: Money


class ProtectionBody(Body):
    project_id: str = Field(min_length=10, max_length=80)


class ClaimBody(Body):
    protection_id: str = Field(min_length=10, max_length=80)
    amount_minor: Money
    reason: str = Field(min_length=30, max_length=2000)
    evidence_url: str

    _url = field_validator("evidence_url")(https_url)


class OfferingBody(Body):
    title: str = Field(min_length=3, max_length=120)
    entity_type: Literal["agency", "freelancer", "platform"]
    summary: str = Field(min_length=40, max_length=2000)
    target_minor: Money
    minimum_minor: Money
    profile_url: str
    term_months: int = Field(strict=True, ge=1, le=60)

    _url = field_validator("profile_url")(https_url)


class ReviewBody(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    version: int = Field(strict=True, ge=1)
    action: Literal["approve", "reject", "simulate_advance", "settle", "activate", "simulate_payout", "close"]
    note: str = Field(min_length=10, max_length=1000)


class CommitmentBody(Body):
    amount_minor: Money


def public_record(doc: dict, user: dict, *, marketplace: bool = False) -> dict:
    if marketplace:
        allowed = ("id", "title", "entity_type", "summary", "target_minor", "minimum_minor",
                   "committed_minor", "term_months", "profile_url", "status", "mode", "created_at", "version")
        return {**{k: doc.get(k) for k in allowed}, "is_mine": doc["user_id"] == user["id"],
                "remaining_minor": doc["target_minor"] - doc.get("committed_minor", 0)}
    result = {k: v for k, v in doc.items() if k not in ("user_id", "request_hash", "commitments")}
    # A project quote is a current estimate for a new application. Refresh it
    # when pricing changes; accepted funding/protection quotes remain snapshots.
    if doc["kind"] == "project":
        result["quote"] = quote(doc["amount_minor"])
    return result


def quote(project_amount: int, advance: int | None = None) -> dict:
    cap = project_amount * RULES["advance_cap_bps"] // 10000
    amount = advance if advance is not None else cap
    fee = (amount * RULES["advance_fee_bps"] + 9999) // 10000
    return {"rules_version": RULES["version"], "currency": "USD", "advance_cap_minor": cap,
            "amount_minor": amount, "fee_minor": fee, "net_minor": amount - fee,
            "settlement_minor": amount,
            "protection_fee_minor": (project_amount * RULES["protection_fee_bps"] + 9999) // 10000,
            "coverage_minor": project_amount * RULES["coverage_cap_bps"] // 10000}


async def owned(item_id: str, user: dict, kind: str | None = None) -> dict:
    doc = await store.get(item_id)
    if not doc or doc["user_id"] != user["id"] or (kind and doc["kind"] != kind):
        raise HTTPException(404, "Record not found.")
    return doc


async def verified(user: dict, entity_type: str | None = None) -> dict:
    docs = await store.list_records(user["id"], "verification", "approved")
    match = next((d for d in docs if entity_type is None or d["entity_type"] == entity_type), None)
    if not match:
        raise HTTPException(409, "Complete a sandbox profile review first.")
    return match


async def eligible_project(project_id: str, user: dict) -> dict:
    await verified(user)
    project = await owned(project_id, user, "project")
    if project["status"] != "approved":
        raise HTTPException(409, "The project must pass sandbox review first.")
    if date.fromisoformat(project["due_date"]) < date.today():
        raise HTTPException(409, "This project's due date has passed.")
    return project


def submitted_fields(body: Body) -> dict:
    return body.model_dump(mode="json", exclude={"request_id", "acknowledged_sandbox"})


async def create(user: dict, kind: str, body: Body, fields: dict,
                 business_key: str | None = None) -> dict:
    request_hash = store.fingerprint(submitted_fields(body))
    key = business_key or f"{kind}:{body.request_id}"
    # Check replay before limits; a retry must always retrieve the same result.
    existing = await store.get(store.record_id(user["id"], key))
    if existing:
        if existing["request_hash"] != request_hash:
            raise HTTPException(409, "This request already exists with different details.")
        return public_record(existing, user)
    if len(await store.list_records(user["id"], limit=501)) >= 500:
        raise HTTPException(409, "Sandbox record limit reached. Contact the reviewer.")
    doc, _ = await store.insert(user, kind, key, fields, request_hash)
    if doc["request_hash"] != request_hash:
        raise HTTPException(409, "This request already exists with different details.")
    return public_record(doc, user)


@router.get("/overview")
async def overview(user: dict = Depends(current_user)):
    records = await store.list_records(user["id"])
    commitments = []
    # Public listing responses never disclose investor identities/commitments.
    # Portfolio queries filter embedded commitments by their authenticated owner.
    for listing in await store.portfolio_listings(user["id"]):
        for commitment in listing.get("commitments", []):
            if commitment["user_id"] == user["id"]:
                commitments.append({**{k: v for k, v in commitment.items() if k not in ("user_id", "request_hash")},
                                    "offering_id": listing["id"], "title": listing["title"],
                                    "entity_type": listing["entity_type"], "mode": "sandbox"})
    return {"mode": "sandbox", "money_movement_enabled": False, "storage": "mongodb" if db.enabled() else "memory",
            "reviewer": is_owner(user), "rules": RULES,
            "records": [public_record(d, user) for d in records], "commitments": commitments,
            "infrastructure": {"chain": None, "token_contract": None, "custody_provider": None,
                               "capital_provider": None, "token_issued": False}}


@router.get("/marketplace")
async def marketplace(user: dict = Depends(current_user)):
    listings = await store.list_records(kind="offering", status="open", limit=200)
    return {"mode": "sandbox", "offerings": [public_record(d, user, marketplace=True) for d in listings]}


@router.post("/verifications")
async def submit_verification(body: VerificationBody, user: dict = Depends(current_user)):
    if user["role"] not in ("admin", "freelancer"):
        raise HTTPException(403, "An agency or freelancer account is required.")
    return await create(user, "verification", body, submitted_fields(body))


@router.post("/projects")
async def submit_project(body: ProjectBody, user: dict = Depends(current_user)):
    await verified(user)
    if body.due_date < date.today():
        raise HTTPException(422, "Choose a due date today or later.")
    return await create(user, "project", body, {**submitted_fields(body), "quote": quote(body.amount_minor)},
                        business_key=f"project:{body.platform}:{body.reference.casefold()}")


@router.post("/funding")
async def submit_funding(body: FundingBody, user: dict = Depends(current_user)):
    project = await eligible_project(body.project_id, user)
    terms = quote(project["amount_minor"], body.amount_minor)
    if body.amount_minor > terms["advance_cap_minor"]:
        raise HTTPException(422, "Requested advance exceeds the sandbox project's 80% limit.")
    return await create(user, "funding", body,
                        {**submitted_fields(body), "title": project["title"], "quote": terms},
                        business_key=f"funding:{project['id']}")


@router.post("/protection")
async def submit_protection(body: ProtectionBody, user: dict = Depends(current_user)):
    project = await eligible_project(body.project_id, user)
    return await create(user, "protection", body,
                        {**submitted_fields(body), "title": project["title"], "quote": quote(project["amount_minor"])},
                        business_key=f"protection:{project['id']}")


@router.post("/claims")
async def submit_claim(body: ClaimBody, user: dict = Depends(current_user)):
    protection = await owned(body.protection_id, user, "protection")
    if protection["status"] != "active":
        raise HTTPException(409, "This sandbox protection must be active before a claim is submitted.")
    if body.amount_minor > protection["quote"]["coverage_minor"]:
        raise HTTPException(422, "Claim exceeds the illustrative coverage limit.")
    return await create(user, "claim", body, {**submitted_fields(body), "title": protection["title"]},
                        business_key=f"claim:{protection['id']}")


@router.post("/offerings")
async def submit_offering(body: OfferingBody, user: dict = Depends(current_user)):
    if body.entity_type == "platform":
        if not is_owner(user):
            raise HTTPException(403, "Only a provisioned platform owner can propose a platform listing.")
    else:
        await verified(user, body.entity_type)
    if body.minimum_minor < RULES["minimum_commitment_minor"] or body.minimum_minor > body.target_minor:
        raise HTTPException(422, "Minimum must be at least $10 and no greater than the target.")
    return await create(user, "offering", body,
                        {**submitted_fields(body), "commitments": [], "committed_minor": 0})


@router.post("/offerings/{offering_id}/commitments")
async def commit(offering_id: str, body: CommitmentBody, user: dict = Depends(current_user)):
    digest = store.fingerprint(submitted_fields(body))
    for _ in range(8):
        listing = await store.get(offering_id)
        if not listing or listing["kind"] != "offering":
            raise HTTPException(404, "Listing not found.")
        prior = next((x for x in listing.get("commitments", [])
                      if x["user_id"] == user["id"] and x["request_id"] == str(body.request_id)), None)
        if prior:
            if prior["request_hash"] != digest:
                raise HTTPException(409, "This commitment key was already used with another amount.")
            return {k: v for k, v in prior.items() if k not in ("user_id", "request_hash")}
        if listing["user_id"] == user["id"]:
            raise HTTPException(403, "You cannot commit to your own listing.")
        if listing["status"] != "open":
            raise HTTPException(409, "This sandbox listing is not open.")
        if body.amount_minor < listing["minimum_minor"]:
            raise HTTPException(422, "Commitment is below the listing minimum.")
        if body.amount_minor > listing["target_minor"] - listing["committed_minor"]:
            raise HTTPException(409, "Commitment exceeds the remaining sandbox target.")
        if len(listing["commitments"]) >= 500:
            raise HTTPException(409, "This sandbox listing has reached its commitment limit.")
        commitment = {"id": "commit-" + str(body.request_id), "request_id": str(body.request_id),
                      "request_hash": digest, "user_id": user["id"], "amount_minor": body.amount_minor,
                      "created_at": store.now(), "status": "simulated", "mode": "sandbox"}
        listing["commitments"].append(commitment)
        listing["committed_minor"] += body.amount_minor
        listing["events"].append(store.event(user, "sandbox_commitment", "No funds transferred."))
        if await store.replace(listing, listing["version"]):
            return {k: v for k, v in commitment.items() if k not in ("user_id", "request_hash")}
    raise HTTPException(409, "This listing changed. Refresh and retry with the same request key.")


@router.get("/reviews")
async def reviews(user: dict = Depends(require_owner)):
    records = await store.list_records(limit=500)
    # Purpose-specific reviewer access. Personal inboxes/workspaces are never read.
    return {"mode": "sandbox", "records": [{**public_record(d, user), "applicant_id": d["user_id"]}
                                           for d in records]}


@router.post("/reviews/{record_id}")
async def review(record_id: str, body: ReviewBody, user: dict = Depends(require_owner)):
    doc = await store.get(record_id)
    if not doc:
        raise HTTPException(404, "Record not found.")
    if doc["user_id"] == user["id"]:
        raise HTTPException(403, "Another provisioned reviewer must review your own submission.")
    if doc["version"] != body.version:
        raise HTTPException(409, "This record changed. Reload before reviewing it.")
    target = None
    if doc["status"] == "submitted" and body.action in ("approve", "reject"):
        target = "rejected" if body.action == "reject" else ("open" if doc["kind"] == "offering" else "approved")
    elif doc["kind"] == "funding":
        target = {("approved", "simulate_advance"): "simulated", ("simulated", "settle"): "settled"}.get((doc["status"], body.action))
    elif doc["kind"] == "protection" and (doc["status"], body.action) == ("approved", "activate"):
        target = "active"
    elif doc["kind"] == "claim" and (doc["status"], body.action) == ("approved", "simulate_payout"):
        target = "paid_sandbox"
    elif doc["kind"] == "offering" and (doc["status"], body.action) == ("open", "close"):
        target = "closed"
    if not target:
        raise HTTPException(409, "That action is not allowed from this status.")
    doc["status"] = target
    doc["events"].append(store.event(user, body.action, body.note))
    if not await store.replace(doc, body.version):
        raise HTTPException(409, "Another reviewer changed this record. Reload to see the decision.")
    return public_record(await store.get(record_id), user)
