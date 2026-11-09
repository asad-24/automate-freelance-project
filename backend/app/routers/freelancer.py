"""Freelancer.com API connector — production access is approval-gated.

Freelancer.com publishes a full official REST API (OAuth, with a sandbox at
freelancer-sandbox.com). Production calls are disabled unless written
permission for this product has been confirmed and FREELANCER_API_APPROVED is
set. Without a token, this module serves a clearly marked sandbox/demo feed.

Compliance stance (see docs/platform-matrix.md):
  - Production API use is disabled until written product-scope permission is confirmed.
  - The configured token is platform-owned; real bids remain owner-only until
    per-user OAuth connections are implemented.
  - Auto-bid is HITL-capped: a bid is only *prepared* here; the frontend requires
    explicit human approval (or a user-set daily cap) before `place_bid` runs.
  - Every action is logged to the audit log.

Endpoints
  GET  /api/freelancer/status                 -> connected? live or sandbox?
  GET  /api/freelancer/projects?q=&limit=      -> active projects (official or sandbox)
  POST /api/freelancer/bid/prepare             -> AI-drafted bid proposal (no submit)
  POST /api/freelancer/bid/place               -> place a bid (requires approved=true)
"""
import logging
import time

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .. import llm, repo, seed
from ..auth import current_user, is_owner
from ..config import get_settings

log = logging.getLogger("autopilot.freelancer")
router = APIRouter(tags=["freelancer"])

_API_BASE = "https://www.freelancer.com/api"
_SANDBOX_BASE = "https://www.freelancer-sandbox.com/api"


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _cfg():
    s = get_settings()
    token = getattr(s, "freelancer_oauth_token", None)
    sandbox = getattr(s, "freelancer_sandbox", True)
    return token, (_SANDBOX_BASE if sandbox else _API_BASE), sandbox


# --------------------------------------------------------------------------- #
# Sandbox feed — realistic shape mirroring the official /projects/active payload
# so the UI is fully exercisable before real OAuth credentials are added.
# --------------------------------------------------------------------------- #
_SANDBOX_PROJECTS = [
    {"title": "Next.js SaaS dashboard with Stripe billing", "skills": ["Next.js", "React", "Stripe"], "budget": (1500, 3000), "bids": 12, "type": "fixed"},
    {"title": "FastAPI backend for a mobile app (REST + auth)", "skills": ["Python", "FastAPI", "MongoDB"], "budget": (800, 1500), "bids": 8, "type": "fixed"},
    {"title": "Shopify store setup + theme customization", "skills": ["Shopify", "Liquid", "CSS"], "budget": (400, 900), "bids": 21, "type": "fixed"},
    {"title": "Scrape + dashboard for product price tracking", "skills": ["Python", "Playwright", "React"], "budget": (600, 1200), "bids": 5, "type": "fixed"},
    {"title": "WordPress to Next.js migration", "skills": ["Next.js", "WordPress", "SEO"], "budget": (1000, 2500), "bids": 15, "type": "fixed"},
    {"title": "AI chatbot integration (OpenAI) for support site", "skills": ["Python", "LLM", "React"], "budget": (700, 1800), "bids": 9, "type": "fixed"},
    {"title": "Hourly React Native engineer — 3 month contract", "skills": ["React Native", "TypeScript"], "budget": (25, 45), "bids": 18, "type": "hourly"},
    {"title": "Landing page design + build (Figma to code)", "skills": ["Figma", "Tailwind", "React"], "budget": (300, 700), "bids": 27, "type": "fixed"},
]


def _sandbox_projects(q: str, limit: int) -> list[dict]:
    terms = {t.strip().lower() for t in q.split(",") if t.strip()} if q else set()
    out = []
    for i, p in enumerate(_SANDBOX_PROJECTS):
        hay = f"{p['title']} {' '.join(p['skills'])}".lower()
        if terms and not any(t in hay for t in terms):
            continue
        lo, hi = p["budget"]
        out.append({
            "id": f"fl-sb-{i+1}",
            "title": p["title"],
            "description": f"Looking for an experienced freelancer. {p['title']}. Please share relevant portfolio and a short plan.",
            "skills": p["skills"],
            "type": p["type"],
            "currency": "USD",
            "budgetMin": lo, "budgetMax": hi,
            "bidCount": p["bids"],
            "url": f"https://www.freelancer.com/projects/sandbox-{i+1}",
            "postedAt": _now(),
            "source": "Freelancer (sandbox)",
        })
    return out[:limit]


def _normalize_official(raw: dict) -> list[dict]:
    """Map the official /projects/active projection into our shape."""
    out = []
    for p in (raw.get("result", {}) or {}).get("projects", []) or []:
        budget = p.get("budget", {}) or {}
        out.append({
            "id": f"fl-{p.get('id')}",
            "title": p.get("title", ""),
            "description": (p.get("preview_description") or "")[:600],
            "skills": [j.get("name") for j in (p.get("jobs") or []) if j.get("name")],
            "type": p.get("type", "fixed"),
            "currency": (p.get("currency", {}) or {}).get("code", "USD"),
            "budgetMin": budget.get("minimum"),
            "budgetMax": budget.get("maximum"),
            "bidCount": p.get("bid_stats", {}).get("bid_count", 0),
            "url": f"https://www.freelancer.com/projects/{p.get('seo_url', p.get('id'))}",
            "postedAt": time.strftime(
                "%Y-%m-%dT%H:%M:%SZ", time.gmtime(p.get("time_submitted", 0))
            ) if p.get("time_submitted") else "",
            "source": "Freelancer",
        })
    return out


@router.get("/freelancer/status")
def status():
    token, base, sandbox = _cfg()
    approved = get_settings().freelancer_api_approved
    return {
        "connected": bool(token) and (sandbox or approved),
        "mode": "live" if token and not sandbox and approved else ("approval-required" if token and not sandbox else ("sandbox-auth" if token else "demo-sandbox")),
        "base": base,
        "note": "Production API use also requires written permission covering this product; set FREELANCER_API_APPROVED=true only after approval.",
    }


@router.get("/freelancer/projects")
async def projects(q: str = "", limit: int = 30):
    token, base, _ = _cfg()
    limit = max(1, min(limit, 50))
    if not token:
        return {"projects": _sandbox_projects(q, limit), "live": False}
    if not get_settings().freelancer_sandbox and not get_settings().freelancer_api_approved:
        return {"projects": [], "live": False, "error": "Freelancer.com written API permission is required before production access."}
    # Official API path — currently uses the platform token; per-user OAuth is Phase 3.
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                f"{base}/projects/0.1/projects/active",
                params={"query": q, "limit": limit, "job_details": "true", "full_description": "false"},
                headers={"freelancer-oauth-v1": token},
            )
            data = r.json()
        return {"projects": _normalize_official(data), "live": True}
    except Exception as exc:
        log.warning("Freelancer.com project fetch failed: %s", exc)
        return {"projects": _sandbox_projects(q, limit), "live": False, "error": str(exc)}


class BidPrepareBody(BaseModel):
    projectId: str
    title: str
    description: str = ""
    skills: list[str] = []
    budgetMin: float | None = None
    budgetMax: float | None = None
    userName: str = ""


@router.post("/freelancer/bid/prepare")
async def bid_prepare(body: BidPrepareBody, user: dict = Depends(current_user)):
    """Draft a bid (amount + proposal). Does NOT submit — HITL by design."""
    lo, hi = body.budgetMin or 0, body.budgetMax or 0
    suggested = round((lo + hi) / 2) if (lo and hi) else (hi or lo or 500)
    raw = await llm.achat(
        [
            {"role": "system", "content": (
                "You write winning, concise Freelancer.com bid proposals. 90-140 words, "
                "specific, reference the project, give a short plan + one question, no fluff. "
                "Plain text only."
            )},
            {"role": "user", "content": (
                f"Project: {body.title}. Details: {body.description[:500]}. "
                f"Skills: {', '.join(body.skills)}. Budget: {lo}-{hi}. "
                f"Bidder: {body.userName or 'an experienced freelancer'}."
            )},
        ],
        max_tokens=3000,
    )
    proposal = (raw or "").strip()
    ai = bool(proposal and len(proposal) > 40)
    if not ai:
        proposal = (
            f"Hi — I read your '{body.title}' brief and can deliver it cleanly. "
            f"My plan: (1) confirm scope & success criteria, (2) build in small reviewable "
            f"milestones, (3) hand off with docs. I work with {', '.join(body.skills[:3]) or 'your stack'} "
            f"daily. One question: what's your target timeline? Happy to start right away."
        )
    await repo.log_activity(user["id"], "Freelancer Connector", f"Prepared bid for '{body.title}' (${suggested})")
    saved = await repo.add("proposals", user["id"], {
        "jobId": body.projectId, "jobTitle": body.title, "platform": "Freelancer.com",
        "body": proposal, "amount": suggested, "status": "draft", "aiGenerated": ai,
    })
    return {"suggestedAmount": suggested, "proposal": proposal, "proposalId": saved["id"], "aiGenerated": ai}


class BidPlaceBody(BaseModel):
    projectId: str
    amount: float
    periodDays: int = 7
    proposal: str
    approved: bool = False   # must be explicitly true — human-in-the-loop gate
    matchScore: int = 0
    proposalId: str | None = Field(default=None, max_length=100)


class BidRulesBody(BaseModel):
    minimumMatchScore: int = Field(default=0, ge=0, le=100)
    minimumBudget: float = Field(default=0, ge=0)
    dailyBidCap: int = Field(default=5, ge=0, le=100)


class BidStatusBody(BaseModel):
    status: str


@router.get("/freelancer/bid-rules")
async def get_bid_rules(user: dict = Depends(current_user)):
    settings = await repo.get_settings_doc(user["id"], seed.SETTINGS)
    return settings.get("bidRules", {"minimumMatchScore": 0, "minimumBudget": 0, "dailyBidCap": 5})


@router.put("/freelancer/bid-rules")
async def put_bid_rules(body: BidRulesBody, user: dict = Depends(current_user)):
    rules = body.model_dump()
    await repo.update_settings_doc(user["id"], {"bidRules": rules}, seed.SETTINGS)
    return rules


@router.get("/freelancer/bids")
async def list_bids(user: dict = Depends(current_user)):
    return await repo.list_for("bids", user["id"], limit=200)


@router.patch("/freelancer/bids/{bid_id}")
async def update_bid_status(bid_id: str, body: BidStatusBody, user: dict = Depends(current_user)):
    allowed = {"placed", "shortlisted", "won", "lost"}
    if body.status not in allowed:
        raise HTTPException(422, f"Status must be one of: {', '.join(sorted(allowed))}.")
    bid = await repo.update("bids", user["id"], bid_id, {"status": body.status, "statusUpdatedAt": _now()})
    if not bid:
        raise HTTPException(404, "Bid not found")
    await repo.log_activity(user["id"], "Freelancer Connector", f"Bid {bid_id} status updated to {body.status}")
    return bid


@router.post("/freelancer/bid/place")
async def bid_place(body: BidPlaceBody, user: dict = Depends(current_user)):
    if not body.approved:
        raise HTTPException(422, "Bid not approved — human approval required before placing.")
    if not body.proposal or len(body.proposal) < 30:
        raise HTTPException(422, "Proposal too short.")
    settings = await repo.get_settings_doc(user["id"], seed.SETTINGS)
    rules = settings.get("bidRules", {"minimumMatchScore": 0, "minimumBudget": 0, "dailyBidCap": 5})
    if body.matchScore < int(rules.get("minimumMatchScore", 0)):
        raise HTTPException(422, "This job is below your minimum match score.")
    if body.amount < float(rules.get("minimumBudget", 0)):
        raise HTTPException(422, "This bid is below your minimum budget rule.")
    today = time.strftime("%Y-%m-%d", time.gmtime())
    token, base, _ = _cfg()
    if token and not get_settings().freelancer_sandbox and not get_settings().freelancer_api_approved:
        raise HTTPException(503, "Freelancer.com written API permission is required before production access.")
    if token and not is_owner(user):
        raise HTTPException(403, "Real bidding needs your own connected Freelancer.com account — coming soon.")
    cap = int(rules.get("dailyBidCap", 5))
    if not await repo.reserve_daily_bid_slot(user["id"], today, cap):
        raise HTTPException(429, "Your daily bid cap has been reached.")
    if not token:
        # Demo/sandbox: record the intent so the pipeline is exercisable.
        await repo.add("bids", user["id"], {"platform": "Freelancer.com", "projectId": body.projectId,
                                             "amount": body.amount, "status": "sandbox", "matchScore": body.matchScore})
        if body.proposalId:
            await repo.update("proposals", user["id"], body.proposalId,
                              {"status": "sandbox", "amount": body.amount})
        await repo.log_activity(user["id"], "Freelancer Connector", f"[sandbox] Bid recorded on {body.projectId} — ${body.amount} (not sent)")
        return {"ok": True, "live": False, "bidId": f"sb-bid-{int(time.time())}", "message": "Recorded in sandbox — connect a token to place real bids."}
    if await repo.spend_credit(user["id"], "bid") is None:
        await repo.release_daily_bid_slot(user["id"], today)
        raise HTTPException(402, "No bid credits left — top up to place this bid.")
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                f"{base}/projects/0.1/bids/",
                headers={"freelancer-oauth-v1": token},
                json={
                    "project_id": int(body.projectId.replace("fl-", "")),
                    "amount": body.amount,
                    "period": body.periodDays,
                    "milestone_percentage": 100,
                    "description": body.proposal,
                },
            )
            data = r.json()
    except Exception as exc:
        await repo.refund_credit(user["id"], "bid")
        await repo.release_daily_bid_slot(user["id"], today)
        log.warning("Freelancer.com bid place failed: %s", exc)
        await repo.log_activity(user["id"], "Freelancer Connector", f"Bid on {body.projectId} failed — nothing was placed", "error")
        raise HTTPException(502, f"Freelancer API error: {exc}")
    ok = r.status_code < 300 and data.get("status") != "error"
    if not ok:
        await repo.refund_credit(user["id"], "bid")
        await repo.release_daily_bid_slot(user["id"], today)
    await repo.log_activity(user["id"], "Freelancer Connector",
                            f"Placed real bid on {body.projectId} — ${body.amount}" if ok else f"Bid on {body.projectId} rejected by Freelancer.com",
                            "success" if ok else "warning")
    if ok:
        await repo.add("bids", user["id"], {"platform": "Freelancer.com", "projectId": body.projectId,
                                             "amount": body.amount, "status": "placed", "matchScore": body.matchScore})
        if body.proposalId:
            await repo.update("proposals", user["id"], body.proposalId,
                              {"status": "submitted", "amount": body.amount})
    return {"ok": ok, "live": True, "response": data}
