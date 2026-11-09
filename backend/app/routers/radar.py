"""Job Radar — live, compliant job aggregation + AI proposals.

Pulls real openings only from sources that *allow* programmatic read access, so
nothing here risks a user's marketplace account. The source list, approval
gates and shared fetch cache live in app/job_sources.py; this router adds the
per-user sources (the user's Upwork connection and watched company boards),
scores matches against the user's skills, and serves proposals.

Endpoints
  GET  /api/radar/jobs?q=react,next.js&limit=30  -> normalized jobs + match score
  GET  /api/radar/sources                         -> every source, gate state and health
  POST /api/radar/proposal                        -> Groq-written proposal for a job

The match score is computed locally (fast, free). The proposal uses Groq.
"""
import asyncio
import hashlib
import re
import time

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .. import job_sources, llm
from .. import repo, seed
from ..auth import current_user
from ..config import get_settings
from ..job_sources import UA as _UA, clean as _clean
from . import upwork

router = APIRouter(tags=["radar"])

_RESULT_CACHE: dict[str, tuple[float, dict]] = {}
_RESULT_CACHE_TTL = 600
_RESULT_CACHE_ROWS = 300  # limit is capped at 100; keep headroom, not every row


def _tokens(s: str) -> set[str]:
    return {t for t in re.split(r"[^a-z0-9+#.]+", (s or "").lower()) if len(t) > 1}


def _match_score(skills: list[str], haystack: str) -> int:
    """Local keyword overlap → 0-100. No LLM cost."""
    if not skills:
        return 70
    hay = _tokens(haystack)
    hits = sum(1 for sk in skills if _tokens(sk) & hay)
    pct = round(hits * 100 / max(len(skills), 1))
    # Floor so nothing shows as 0 when it still surfaced for a search term.
    return max(35, min(99, pct or 40))


def _scored(job: dict, skills: list[str]) -> dict:
    hay = f"{job.get('title', '')} {' '.join(job.get('tags') or [])} {job.get('company', '')} {job.get('description', '')}"
    return {**job, "matchScore": _match_score(skills, hay)}


async def _upwork(client: httpx.AsyncClient, skills: list[str], user: dict) -> list[dict]:
    """Upwork GraphQL jobs — only contributes when the connector is live;
    demo feed never leaks into the real radar results."""
    try:
        res = await upwork.jobs(q=", ".join(skills) or "developer", limit=25, user=user)
    except Exception:
        return []
    if not res.get("live"):
        return []
    out = []
    for j in res.get("jobs", []):
        out.append({
            "kind": "gig",
            "id": j["id"],
            "title": j["title"],
            "company": "Upwork client" + (" ✓" if j.get("clientVerified") else ""),
            "source": "Upwork",
            "url": j.get("url") or "https://www.upwork.com",
            "tags": (j.get("skills") or [])[:6],
            "budget": j.get("budget") or j.get("hourlyMax") or None,
            "currency": "USD",
            "description": j.get("description", ""),
            "postedAt": j.get("postedAt", ""),
        })
    return out


@router.get("/radar/sources")
async def radar_sources():
    """Every registered source, whether it is enabled here, and its last fetch."""
    return {"sources": job_sources.source_report()}


def _watched_boards(profile: dict) -> list[dict]:
    return [b for b in profile.get("radarWatchedBoards", [])
            if isinstance(b, dict) and b.get("provider") in job_sources.BOARD_PROVIDERS
            and job_sources.BOARD_PROVIDERS[b["provider"]].valid(b.get("slug", ""))]


class WatchedBoard(BaseModel):
    provider: str = Field(min_length=1, max_length=10)
    slug: str = Field(min_length=1, max_length=80)


class WatchedBoardsBody(BaseModel):
    boards: list[WatchedBoard] = Field(default_factory=list, max_length=job_sources.MAX_WATCHED_BOARDS)


def _boards_response(boards: list[dict]) -> dict:
    return {
        "boards": boards,
        "providers": [{"id": p.id, "name": p.name, "hint": p.hint, "terms": p.terms, "enabled": p.enabled()}
                      for p in job_sources.BOARD_PROVIDERS.values()],
        "max": job_sources.MAX_WATCHED_BOARDS,
    }


@router.get("/radar/boards")
async def get_watched_boards(user: dict = Depends(current_user)):
    """Company career boards (public ATS job-board APIs) this user watches."""
    profile = await repo.get_settings_doc(user["id"], seed.SETTINGS)
    return _boards_response(_watched_boards(profile))


@router.put("/radar/boards")
async def put_watched_boards(body: WatchedBoardsBody, user: dict = Depends(current_user)):
    profile = await repo.get_settings_doc(user["id"], seed.SETTINGS)
    existing = _watched_boards(profile)
    boards: list[dict] = []
    for board in body.boards:
        provider = job_sources.BOARD_PROVIDERS.get(board.provider)
        slug = board.slug.strip()
        if not provider:
            raise HTTPException(422, f"Unknown careers-board provider: {board.provider}")
        if not provider.valid(slug):
            raise HTTPException(422, f"“{slug}” is not a valid {provider.name} board name. {provider.hint}")
        entry = {"provider": provider.id, "slug": slug}
        if not provider.enabled() and entry not in existing:
            raise HTTPException(422, f"{provider.name} boards are not enabled here yet (pending reuse review).")
        if entry not in boards:
            boards.append(entry)
    await repo.update_settings_doc(user["id"], {"radarWatchedBoards": boards}, seed.SETTINGS)
    return _boards_response(boards)


@router.get("/radar/jobs")
async def radar_jobs(q: str = "", limit: int = 30, kind: str = "all", user: dict = Depends(current_user)):
    if not 1 <= limit <= 100:
        raise HTTPException(422, "limit must be between 1 and 100")
    profile = await repo.get_settings_doc(user["id"], seed.SETTINGS)
    if not q.strip():
        q = ", ".join(profile.get("skillProfile", []))
    skills = [s.strip() for s in q.split(",") if s.strip()]
    boards = _watched_boards(profile)
    settings = get_settings()
    sources = job_sources.enabled_sources(settings)
    boards = [b for b in boards if job_sources.BOARD_PROVIDERS[b["provider"]].enabled(settings)]
    capability_state = (
        f"{','.join(s.id for s in sources)}:{settings.upwork_commercial_approved}:"
        f"{','.join(b['provider'] + '/' + b['slug'] for b in boards)}"
    )
    # Upwork's marketplace search is scoped to the user's connected OAuth
    # account; never share a cached aggregate across app users. Source fetches
    # themselves are shared (job_sources caches them per source).
    cache_key = hashlib.sha256(
        f"{user['id']}:{','.join(sorted(s.lower() for s in skills))}:{kind}:{capability_state}".encode()
    ).hexdigest()
    cached = _RESULT_CACHE.get(cache_key)
    if cached and cached[0] > time.monotonic():
        result = dict(cached[1])
        result["jobs"] = result["jobs"][:limit]
        return result
    async with httpx.AsyncClient(timeout=12, follow_redirects=True, headers={"User-Agent": _UA}) as client:
        results = await asyncio.gather(
            *(job_sources.fetch_source(source, client, skills) for source in sources),
            *(job_sources.fetch_board(client, b["provider"], b["slug"]) for b in boards),
            _upwork(client, skills, user),
            return_exceptions=True,
        )
    jobs: list[dict] = []
    for r in results:
        if isinstance(r, list):
            jobs.extend(_scored(job, skills) for job in r)
    # Keep one canonical result per source URL; if a listing is syndicated,
    # prefer the row with the richer description and highest match score.
    deduped: dict[str, dict] = {}
    for job in jobs:
        url = (job.get("url") or "").strip().rstrip("/").lower()
        identity = url or f"{job.get('title','').strip().lower()}:{job.get('company','').strip().lower()}"
        prior = deduped.get(identity)
        if not prior or (len(job.get("description", "")), job.get("matchScore", 0)) > (len(prior.get("description", "")), prior.get("matchScore", 0)):
            deduped[identity] = job
    jobs = list(deduped.values())
    # Best matches first; cap the payload.
    if kind in ("gig", "job"):
        jobs = [j for j in jobs if j.get("kind") == kind]
    jobs.sort(key=lambda j: j["matchScore"], reverse=True)
    result = {
        "jobs": jobs[:_RESULT_CACHE_ROWS],
        "total": len(jobs),
        "sources": list(dict.fromkeys(job["source"] for job in jobs)),
        "fetchedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    _RESULT_CACHE[cache_key] = (time.monotonic() + _RESULT_CACHE_TTL, result)
    if len(_RESULT_CACHE) > 256:
        now = time.monotonic()
        for key in [k for k, (expiry, _) in _RESULT_CACHE.items() if expiry <= now][:128]:
            _RESULT_CACHE.pop(key, None)
    response = dict(result)
    response["jobs"] = jobs[:limit]
    return response


class SkillProfileBody(BaseModel):
    skills: list[str] = Field(default_factory=list, max_length=40)


class SavedJobBody(BaseModel):
    id: str = Field(min_length=1, max_length=160)
    kind: str = Field(default="job", pattern="^(job|gig)$")
    title: str = Field(min_length=1, max_length=300)
    company: str = Field(default="", max_length=200)
    source: str = Field(default="", max_length=100)
    url: str = Field(min_length=1, max_length=1000)
    tags: list[str] = Field(default_factory=list, max_length=20)
    budget: float | str | None = None
    currency: str | None = Field(default=None, max_length=3)
    description: str = Field(default="", max_length=4000)
    postedAt: str = Field(default="", max_length=100)
    matchScore: int = Field(default=0, ge=0, le=100)


class SavedSearchBody(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    query: str = Field(min_length=1, max_length=500)
    alertEnabled: bool = True


@router.get("/radar/profile")
async def get_skill_profile(user: dict = Depends(current_user)):
    settings = await repo.get_settings_doc(user["id"], seed.SETTINGS)
    return {"skills": settings.get("skillProfile", [])}


@router.put("/radar/profile")
async def put_skill_profile(body: SkillProfileBody, user: dict = Depends(current_user)):
    skills = list(dict.fromkeys(s.strip()[:80] for s in body.skills if s.strip()))
    await repo.update_settings_doc(user["id"], {"skillProfile": skills}, seed.SETTINGS)
    return {"skills": skills}


@router.get("/radar/saved")
async def get_saved_radar_items(user: dict = Depends(current_user)):
    settings = await repo.get_settings_doc(user["id"], seed.SETTINGS)
    return {
        "jobs": settings.get("radarSavedJobs", []),
        "searches": settings.get("radarSavedSearches", []),
    }


@router.put("/radar/saved-jobs/{job_id}")
async def save_radar_job(job_id: str, body: SavedJobBody, user: dict = Depends(current_user)):
    if job_id != body.id:
        raise HTTPException(422, "Job id does not match the URL.")
    if not body.url.startswith("https://"):
        raise HTTPException(422, "Saved job URL must use HTTPS.")
    settings = await repo.get_settings_doc(user["id"], seed.SETTINGS)
    jobs = [item for item in settings.get("radarSavedJobs", []) if item.get("id") != job_id]
    jobs.insert(0, body.model_dump())
    await repo.update_settings_doc(user["id"], {"radarSavedJobs": jobs[:200]}, seed.SETTINGS)
    return {"saved": True, "jobs": jobs[:200]}


@router.delete("/radar/saved-jobs/{job_id}")
async def unsave_radar_job(job_id: str, user: dict = Depends(current_user)):
    settings = await repo.get_settings_doc(user["id"], seed.SETTINGS)
    jobs = [item for item in settings.get("radarSavedJobs", []) if item.get("id") != job_id]
    await repo.update_settings_doc(user["id"], {"radarSavedJobs": jobs}, seed.SETTINGS)
    return {"saved": False, "jobs": jobs}


@router.post("/radar/saved-searches")
async def save_radar_search(body: SavedSearchBody, user: dict = Depends(current_user)):
    settings = await repo.get_settings_doc(user["id"], seed.SETTINGS)
    searches = [item for item in settings.get("radarSavedSearches", []) if item.get("query", "").lower() != body.query.strip().lower()]
    search = {"id": hashlib.sha256(f"{user['id']}:{body.query.strip().lower()}".encode()).hexdigest()[:24],
              "name": body.name.strip(), "query": body.query.strip(), "alertEnabled": body.alertEnabled}
    searches.insert(0, search)
    if len(searches) > 5:
        raise HTTPException(422, "You can save up to 5 scheduled searches per account.")
    await repo.update_settings_doc(user["id"], {"radarSavedSearches": searches}, seed.SETTINGS)
    return {"search": search, "searches": searches}


@router.delete("/radar/saved-searches/{search_id}")
async def remove_radar_search(search_id: str, user: dict = Depends(current_user)):
    settings = await repo.get_settings_doc(user["id"], seed.SETTINGS)
    searches = [item for item in settings.get("radarSavedSearches", []) if item.get("id") != search_id]
    await repo.update_settings_doc(user["id"], {"radarSavedSearches": searches}, seed.SETTINGS)
    return {"searches": searches}


class ProposalBody(BaseModel):
    jobId: str = Field(default="", max_length=160)
    jobTitle: str = Field(min_length=1, max_length=300)
    jobDescription: str = Field(default="", max_length=4000)
    jobUrl: str = Field(default="", max_length=1000)
    platform: str = Field(default="", max_length=100)
    matchScore: int = Field(default=0, ge=0, le=100)
    skills: str = Field(default="", max_length=1000)
    userName: str = Field(default="", max_length=160)
    tone: str = Field(default="professional", max_length=40)


class ProposalDraftUpdate(BaseModel):
    body: str = Field(min_length=1, max_length=5000)
    amount: float | None = Field(default=None, ge=0)


@router.get("/radar/proposals")
async def list_proposal_drafts(user: dict = Depends(current_user)):
    return await repo.list_for("proposals", user["id"], limit=200)


@router.put("/radar/proposals/{proposal_id}")
async def update_proposal_draft(proposal_id: str, body: ProposalDraftUpdate,
                                user: dict = Depends(current_user)):
    existing = await repo.get("proposals", user["id"], proposal_id)
    if not existing:
        raise HTTPException(404, "Proposal draft not found")
    if existing.get("status") != "draft":
        raise HTTPException(409, "Only draft proposals can be edited.")
    updated = await repo.update("proposals", user["id"], proposal_id, {
        **body.model_dump(exclude_none=True),
        "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    })
    return updated


@router.post("/radar/proposal")
async def radar_proposal(body: ProposalBody, user: dict = Depends(current_user)):
    name = body.userName or "a specialist"
    skills = body.skills or "full-stack development"
    generated = llm.chat(
        [
            {
                "role": "system",
                "content": (
                    "You write winning freelance proposals. 120-160 words, first person, "
                    f"{body.tone} tone. Open with a specific hook about THIS job, show relevant "
                    "experience, give a concrete 2-3 step plan, end with one question. "
                    "No greetings like 'Dear', no placeholders, plain text."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Freelancer: {name}. Skills: {skills}.\n"
                    f"Job title: {body.jobTitle}\n"
                    f"Job description: {body.jobDescription[:1200]}\n\n"
                    "Write the proposal to submit."
                ),
            },
        ],
        max_tokens=500,
    )
    # aiGenerated must reflect whether the LLM actually produced text — not
    # just whether a key is configured (llm.enabled() lied when calls failed).
    if generated:
        text = generated
    else:
        # Groq offline → still useful template.
        text = (
            f"Hi — your posting for \"{body.jobTitle}\" is a strong fit for my work in {skills}. "
            "I've delivered similar projects recently and can start right away. "
            "My plan: (1) quick call to confirm scope, (2) a working first version fast, "
            "(3) revisions until you're happy. Could you share your ideal timeline?"
        )
    saved = await repo.add("proposals", user["id"], {
        "jobId": body.jobId, "jobTitle": body.jobTitle, "jobUrl": body.jobUrl,
        "platform": body.platform, "matchScore": body.matchScore, "body": text,
        "status": "draft", "aiGenerated": bool(generated),
    })
    return {"ok": True, "proposal": text, "proposalId": saved["id"], "aiGenerated": bool(generated)}
