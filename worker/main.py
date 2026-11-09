"""Autopilot Automation Worker — browser-automation service.

Runs as a SEPARATE service from the main API because it needs a real browser
(Playwright / browser-use), which can't run on Vercel or a plain web dyno.

Contract (called by the main backend's /api/automation router):
  POST /run   { job_id, kind, platform, url, instructions, fields, dry_run }
              -> executes the task in a real browser on the USER'S OWN session,
                 PAUSING before any outbound/irreversible step so the main app
                 can require human approval. Returns a step log + status.
  GET  /health

Compliance (see PLATFORM_AUTOMATION_RESEARCH.md):
  - Acts only on the user's own authenticated session (their consent).
  - Stops at submit/send/pay steps unless the job was explicitly approved.
  - Human-scale only; every step is reported back for the audit log.

Graceful degradation: if `browser-use` isn't installed (e.g. local dev), the
worker runs in SIMULATION mode — it returns a realistic step log so the whole
queue + approval flow is exercisable without a browser. Install browser-use +
playwright on the deployed worker to execute for real.
"""
import hmac
import os

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Autopilot Automation Worker", version="0.1.0")


def _load_engine():
    """Return (Agent, ChatOpenAI) if the real engine is importable, else (None, None).

    browser-use 0.1.x takes a langchain chat model; newer versions ship their own.
    Try the newest import path first, then the langchain one.
    """
    try:
        from browser_use import Agent  # type: ignore
    except Exception:
        return None, None
    try:
        from browser_use import ChatOpenAI  # type: ignore
        return Agent, ChatOpenAI
    except Exception:
        pass
    try:
        from langchain_openai import ChatOpenAI  # type: ignore
        return Agent, ChatOpenAI
    except Exception:
        return Agent, None


Agent, ChatOpenAI = _load_engine()  # type: ignore
_ENGINE = "browser-use" if (Agent and ChatOpenAI) else "simulation"

# Shared secret the main backend sends as X-Worker-Key. Required: without it
# /run refuses every call, so the worker can't be driven by anyone who finds its URL.
WORKER_KEY = os.environ.get("WORKER_KEY", "")


class RunBody(BaseModel):
    job_id: str
    kind: str                       # "auto_apply" | "post_gig" | "send_message" | "custom"
    platform: str = ""
    url: str = ""
    instructions: str = ""
    fields: dict = {}
    dry_run: bool = True            # when True, stop before the final submit


# Each kind maps to the human-readable steps we report back. The final
# "outbound" step is only executed when dry_run is False (i.e. approved).
_PLANS: dict[str, list[dict]] = {
    "auto_apply": [
        {"step": "Open the job posting", "outbound": False},
        {"step": "Read the application form fields", "outbound": False},
        {"step": "Fill name, contact and profile details", "outbound": False},
        {"step": "Attach resume / portfolio", "outbound": False},
        {"step": "Answer screening questions from your profile", "outbound": False},
        {"step": "Submit the application", "outbound": True},
    ],
    "post_gig": [
        {"step": "Open the gig creation form", "outbound": False},
        {"step": "Fill title, description and packages", "outbound": False},
        {"step": "Add tags and FAQ", "outbound": False},
        {"step": "Publish the gig", "outbound": True},
    ],
    "send_message": [
        {"step": "Open the conversation thread", "outbound": False},
        {"step": "Compose the reply", "outbound": False},
        {"step": "Send the message", "outbound": True},
    ],
    "custom": [
        {"step": "Plan the task from instructions", "outbound": False},
        {"step": "Execute browser actions", "outbound": False},
        {"step": "Complete the final action", "outbound": True},
    ],
}


@app.get("/health")
def health():
    return {"status": "ok", "engine": _ENGINE}


def _simulate(body: RunBody) -> dict:
    plan = _PLANS.get(body.kind, _PLANS["custom"])
    log = []
    for s in plan:
        if s["outbound"] and body.dry_run:
            log.append({"step": s["step"], "status": "paused", "detail": "Awaiting human approval before this step."})
            return {"job_id": body.job_id, "engine": _ENGINE, "status": "needs_approval", "steps": log}
        log.append({"step": s["step"], "status": "done"})
    return {"job_id": body.job_id, "engine": _ENGINE, "status": "completed", "steps": log}


async def _run_real(body: RunBody) -> dict:  # pragma: no cover - needs browser
    """Execute with browser-use. Kept conservative; the main app enforces HITL
    by only sending dry_run=False once a human approved."""
    from browser_use import Agent, ChatOpenAI  # type: ignore
    goal = body.instructions or f"{body.kind} on {body.platform}: {body.url}"
    if body.dry_run:
        goal += (
            "\n\nIMPORTANT: Prepare everything but DO NOT click the final "
            "submit/send/publish/pay button. Stop and report what you prepared."
        )
    llm = ChatOpenAI(model=os.environ.get("WORKER_MODEL", "gpt-4o-mini"))  # type: ignore
    agent = Agent(task=goal, llm=llm)
    result = await agent.run(max_steps=int(os.environ.get("WORKER_MAX_STEPS", "25")))
    status = "needs_approval" if body.dry_run else "completed"
    return {"job_id": body.job_id, "engine": _ENGINE, "status": status,
            "steps": [{"step": "browser-use run", "status": "done", "detail": str(result)[:2000]}]}


@app.post("/run")
async def run(body: RunBody, x_worker_key: str = Header(default="")):
    # No key configured = locked: this endpoint drives a real browser, so it is
    # never open to whoever finds the URL.
    if not WORKER_KEY:
        raise HTTPException(503, "WORKER_KEY is not configured on the worker")
    if not hmac.compare_digest(x_worker_key, WORKER_KEY):
        raise HTTPException(401, "Invalid worker key")
    if _ENGINE == "simulation" or Agent is None:
        return _simulate(body)
    try:
        return await _run_real(body)
    except Exception as exc:  # fall back to a reported failure, never crash
        return {"job_id": body.job_id, "engine": _ENGINE, "status": "failed",
                "steps": [{"step": "run", "status": "failed", "detail": str(exc)}]}
