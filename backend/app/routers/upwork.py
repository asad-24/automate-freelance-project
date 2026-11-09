"""Upwork connector — sanctioned platform automation via the official GraphQL API.

Upwork publishes a GraphQL API (OAuth 2.0, official SDKs). This connector queries
it where an access token is configured and falls back to a realistic demo feed
otherwise — same graceful-degradation pattern as the Freelancer connector.

Compliance stance (see PLATFORM_AUTOMATION_RESEARCH.md):
  - Official GraphQL API only, acting on the user's own account via their token.
  - Proposals are AI-*drafted* here; submission is HITL — the frontend requires
    explicit human approval before `proposal/submit` runs.
  - Every action is logged to the audit log.

Endpoints
  GET  /api/upwork/status                 -> connected? live or demo?
  GET  /api/upwork/jobs?q=&limit=          -> job search (official GraphQL or demo)
  POST /api/upwork/proposal/prepare        -> AI-drafted proposal (no submit)
  POST /api/upwork/proposal/submit         -> submit (requires approved=true)
"""
import logging
import time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .. import llm, repo
from ..auth import current_user
from ..config import get_settings
from ..integrations import nango_request

log = logging.getLogger("autopilot.upwork")
router = APIRouter(tags=["upwork"])

def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


# --------------------------------------------------------------------------- #
# Demo feed — realistic shape mirroring an Upwork marketplace job search result.
# --------------------------------------------------------------------------- #
_DEMO_JOBS = [
    {"title": "React + TypeScript dashboard (ongoing)", "skills": ["React", "TypeScript", "GraphQL"], "type": "hourly", "rate": (40, 70), "duration": "3-6 months", "proposals": 12, "verified": True},
    {"title": "Next.js marketing site rebuild", "skills": ["Next.js", "Tailwind", "SEO"], "type": "fixed", "budget": 2500, "proposals": 20, "verified": True},
    {"title": "Python data pipeline + API", "skills": ["Python", "FastAPI", "AWS"], "type": "hourly", "rate": (50, 85), "duration": "1-3 months", "proposals": 7, "verified": True},
    {"title": "Shopify Plus custom app", "skills": ["Shopify", "Node.js", "React"], "type": "fixed", "budget": 4000, "proposals": 9, "verified": False},
    {"title": "AI/LLM integration for SaaS", "skills": ["Python", "LLM", "LangChain"], "type": "hourly", "rate": (60, 100), "duration": "1-3 months", "proposals": 15, "verified": True},
    {"title": "Mobile app (React Native) MVP", "skills": ["React Native", "Expo", "Firebase"], "type": "fixed", "budget": 6000, "proposals": 18, "verified": True},
    {"title": "WordPress → headless migration", "skills": ["WordPress", "Next.js", "GraphQL"], "type": "fixed", "budget": 3200, "proposals": 6, "verified": True},
    {"title": "Figma to responsive code", "skills": ["Figma", "HTML", "CSS", "React"], "type": "fixed", "budget": 900, "proposals": 25, "verified": False},
]


def _demo_jobs(q: str, limit: int) -> list[dict]:
    terms = {t.strip().lower() for t in q.split(",") if t.strip()} if q else set()
    out = []
    for i, j in enumerate(_DEMO_JOBS):
        hay = f"{j['title']} {' '.join(j['skills'])}".lower()
        if terms and not any(t in hay for t in terms):
            continue
        hourly = j["type"] == "hourly"
        lo, hi = (j.get("rate") or (0, 0))
        out.append({
            "id": f"uw-demo-{i+1}",
            "title": j["title"],
            "description": f"{j['title']}. We need an experienced freelancer; please share relevant work and your approach.",
            "skills": j["skills"],
            "type": j["type"],
            "hourlyMin": lo if hourly else None,
            "hourlyMax": hi if hourly else None,
            "budget": None if hourly else j.get("budget"),
            "duration": j.get("duration", ""),
            "proposals": j["proposals"],
            "clientVerified": j["verified"],
            "url": f"https://www.upwork.com/jobs/~demo{i+1}",
            "postedAt": _now(),
            "source": "Upwork (demo)",
        })
    return out[:limit]


# Current MarketplaceJobPostingsSearch query from Upwork's GraphQL reference.
# Runtime behavior still needs a contract check using the approved app scopes.
_JOB_SEARCH_QUERY = """
query marketplaceJobPostingsSearch($filter: MarketplaceJobPostingsSearchFilter) {
  marketplaceJobPostingsSearch(
    marketPlaceJobFilter: $filter
    searchType: USER_JOBS_SEARCH
    sortAttributes: [{ field: RECENCY }]
  ) {
    totalCount
    edges { node {
      id title description
      skills { name }
      amount { rawValue currency }
      hourlyBudgetMin { rawValue } hourlyBudgetMax { rawValue }
      createdDateTime publishedDateTime
      totalApplicants
      ciphertext
    } }
  }
}
"""


def _normalize_gql(data: dict) -> list[dict]:
    out = []
    edges = (((data.get("data") or {}).get("marketplaceJobPostingsSearch") or {}).get("edges")) or []
    for e in edges:
        n = e.get("node", {}) or {}
        amount = n.get("amount") or {}
        hmin = (n.get("hourlyBudgetMin") or {}).get("rawValue")
        hmax = (n.get("hourlyBudgetMax") or {}).get("rawValue")
        cipher = n.get("ciphertext") or n.get("id")
        out.append({
            "id": f"uw-{n.get('id')}",
            "title": n.get("title", ""),
            "description": (n.get("description") or "")[:600],
            "skills": [s.get("name") for s in (n.get("skills") or []) if s.get("name")],
            "type": "hourly" if hmin or hmax else "fixed",
            "hourlyMin": float(hmin) if hmin else None,
            "hourlyMax": float(hmax) if hmax else None,
            "budget": float(amount["rawValue"]) if amount.get("rawValue") else None,
            "duration": "",
            "proposals": n.get("totalApplicants", 0),
            # Don't infer payment verification from a field we didn't request.
            "clientVerified": None,
            "url": f"https://www.upwork.com/jobs/{cipher}",
            "postedAt": n.get("publishedDateTime") or n.get("createdDateTime") or "",
            "currency": amount.get("currency"),
            "source": "Upwork",
        })
    return out


@router.get("/upwork/status")
async def status(user: dict = Depends(current_user)):
    settings = get_settings()
    saved = await repo.get_settings_doc(user["id"], {})
    connections = saved.get("nangoConnections", {})
    connection = connections.get("upwork") if isinstance(connections, dict) else None
    connected = bool(isinstance(connection, dict) and connection.get("connectionId"))
    approved = settings.upwork_commercial_approved
    configured = bool(settings.nango_secret_key and "upwork" in {
        value.strip() for value in settings.nango_integrations.split(",") if value.strip()
    })
    return {
        "connected": connected and approved and configured,
        "canConnect": approved and configured,
        "mode": "live" if connected and approved and configured else ("approval-required" if not approved else "demo"),
        "note": "Live search uses the signed-in user's OAuth connection. Commercial use requires Upwork API approval and written permission; Nango integration id must be `upwork`.",
    }


@router.get("/upwork/jobs")
async def jobs(q: str = "", limit: int = 30, user: dict = Depends(current_user)):
    limit = max(1, min(limit, 50))
    status_info = await status(user=user)
    if not status_info["connected"]:
        return {"jobs": _demo_jobs(q, limit), "live": False}
    try:
        data = await nango_request(user["id"], "upwork", "POST", "graphql", json_body={
            "query": _JOB_SEARCH_QUERY,
            "variables": {"filter": {
                "searchExpression_eq": q or "developer",
                "pagination_eq": {"after": "0", "first": limit},
            }},
        })
        jobs_out = _normalize_gql(data)
        if not jobs_out and data.get("errors"):
            log.warning("Upwork GraphQL errors: %s", data["errors"][:1])
            return {"jobs": _demo_jobs(q, limit), "live": False, "error": "schema/permission — check token scopes"}
        return {"jobs": jobs_out, "live": True}
    except HTTPException as exc:
        return {"jobs": _demo_jobs(q, limit), "live": False, "error": exc.detail}
    except Exception as exc:
        log.warning("Upwork job fetch failed: %s", exc)
        return {"jobs": _demo_jobs(q, limit), "live": False, "error": str(exc)}


class ProposalPrepareBody(BaseModel):
    jobId: str
    title: str
    description: str = ""
    skills: list[str] = []
    type: str = "fixed"
    budget: float | None = None
    hourlyMax: float | None = None
    userName: str = ""


@router.post("/upwork/proposal/prepare")
async def proposal_prepare(body: ProposalPrepareBody, user: dict = Depends(current_user)):
    """Draft an Upwork proposal (cover letter + suggested rate). Does NOT submit."""
    if body.type == "hourly":
        suggested = body.hourlyMax or 50
    else:
        suggested = body.budget or 500
    raw = await llm.achat(
        [
            {"role": "system", "content": (
                "You write winning Upwork proposals. 100-150 words, open with a specific hook from "
                "the job, give a crisp 2-3 step plan, show one relevant proof point, end with a "
                "question. Confident, human, no buzzwords. Plain text only."
            )},
            {"role": "user", "content": (
                f"Job: {body.title}. Details: {body.description[:500]}. "
                f"Skills: {', '.join(body.skills)}. Type: {body.type}. "
                f"Applicant: {body.userName or 'an experienced freelancer'}."
            )},
        ],
        max_tokens=3000,
    )
    proposal = (raw or "").strip()
    ai = bool(proposal and len(proposal) > 40)
    if not ai:
        proposal = (
            f"Hi — your '{body.title}' post is right in my wheelhouse. Here's my plan: "
            f"(1) a quick call to lock scope and success criteria, (2) build in small, reviewable "
            f"milestones, (3) hand off with clean docs. I work with "
            f"{', '.join(body.skills[:3]) or 'your stack'} every week and can share directly relevant "
            f"samples. What's your ideal start date?"
        )
    await repo.log_activity(user["id"], "Upwork Connector", f"Prepared Upwork proposal for '{body.title}'")
    saved = await repo.add("proposals", user["id"], {
        "jobId": body.jobId, "jobTitle": body.title, "platform": "Upwork",
        "body": proposal, "amount": suggested, "status": "draft", "aiGenerated": ai,
    })
    return {"suggestedRate": suggested, "proposal": proposal, "proposalId": saved["id"], "aiGenerated": ai}


class ProposalSubmitBody(BaseModel):
    jobId: str
    proposal: str
    rate: float
    approved: bool = False   # HITL gate — must be explicitly true
    proposalId: str | None = Field(default=None, max_length=100)


@router.post("/upwork/proposal/submit")
async def proposal_submit(body: ProposalSubmitBody, user: dict = Depends(current_user)):
    if not body.approved:
        raise HTTPException(422, "Proposal not approved — human approval required before submitting.")
    if not body.proposal or len(body.proposal) < 30:
        raise HTTPException(422, "Proposal too short.")
    # The API mutation exists, but its complete input (screening answers,
    # terms, attachments and Connects options) is not implemented here.
    raise HTTPException(501, "Live Upwork proposal submission is not implemented yet — copy the proposal and submit it on Upwork.")
