"""Automation engine — per-user job queue + human-in-the-loop approval.

This is the control plane for the Automation Worker (see /worker). The main app
never drives a browser itself; it enqueues jobs, tracks their state, and gates
every outbound step behind human approval.

Flow:
  POST /automation/jobs              -> enqueue a job (runs dry: prepares, then pauses)
  GET  /automation/jobs              -> the user's jobs (newest first)
  POST /automation/jobs/{id}/approve -> human approves -> worker finishes the outbound step
  POST /automation/jobs/{id}/cancel
  GET  /automation/status            -> which engine this user's jobs run on

Engines:
  worker      the real browser worker (WORKER_URL + WORKER_KEY). It drives one
              shared browser, not per-user sessions, so until users connect their
              own accounts (PLAN.md Phase 3) only platform owners can use it.
  simulation  a scripted step log, labelled as such — nothing is sent.

A real auto_apply spends one bid credit on approval, refunded if it fails.
"""
import logging
import time

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .. import repo
from ..auth import current_user, is_owner
from ..config import get_settings

log = logging.getLogger("autopilot.automation")
router = APIRouter(tags=["automation"])

_PLANS = {
    "auto_apply": ["Open the job posting", "Read the application form", "Fill your details",
                   "Attach resume / portfolio", "Answer screening questions", "Submit the application"],
    "post_gig": ["Open the gig form", "Fill title, description, packages", "Add tags & FAQ", "Publish the gig"],
    "send_message": ["Open the thread", "Compose the reply", "Send the message"],
    "custom": ["Plan the task", "Execute browser actions", "Complete the final action"],
}
_OUTBOUND_VERB = {"auto_apply": "Submit the application", "post_gig": "Publish the gig",
                  "send_message": "Send the message", "custom": "Complete the final action"}


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _worker_for(user: dict) -> str | None:
    """The worker URL this user's jobs may use, or None for simulation."""
    s = get_settings()
    if not s.worker_url or not is_owner(user):
        return None
    if not s.worker_key:
        log.error("WORKER_URL is set but WORKER_KEY isn't — refusing to call an unauthenticated worker.")
        return None
    return s.worker_url.rstrip("/")


async def _call_worker(url: str, payload: dict) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.post(f"{url}/run", json=payload, headers={"X-Worker-Key": get_settings().worker_key})
            r.raise_for_status()
            return r.json()
    except Exception:
        log.exception("Worker call failed for job %s", payload.get("job_id"))
        return None


_WORKER_DOWN = {
    "status": "failed",
    "steps": [{"step": "Contact the automation worker", "status": "failed",
               "detail": "The worker didn't respond — nothing was done."}],
}


def _simulate(kind: str, dry_run: bool) -> dict:
    plan = _PLANS.get(kind, _PLANS["custom"])
    steps = []
    for label in plan:
        is_outbound = label == _OUTBOUND_VERB.get(kind)
        if is_outbound and dry_run:
            steps.append({"step": label, "status": "paused", "detail": "Awaiting your approval."})
            return {"status": "needs_approval", "steps": steps, "engine": "simulation"}
        steps.append({"step": label, "status": "done"})
    return {"status": "completed", "steps": steps, "engine": "simulation"}


@router.get("/automation/status")
async def status(user: dict = Depends(current_user)):
    url = _worker_for(user)
    if not url:
        note = ("Jobs are simulated until you connect your own accounts — nothing is sent."
                if get_settings().worker_url else
                "Set WORKER_URL and WORKER_KEY to run real browser automation.")
        return {"workerConfigured": False, "engine": "simulation", "note": note}
    engine = "unknown"
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            engine = (await client.get(f"{url}/health")).json().get("engine", "unknown")
    except Exception:
        engine = "unreachable"
    return {"workerConfigured": True, "engine": engine}


@router.get("/automation/jobs")
async def list_jobs(user: dict = Depends(current_user)):
    return await repo.list_for("automation_jobs", user["id"])


class JobBody(BaseModel):
    kind: str = "custom"            # auto_apply | post_gig | send_message | custom
    platform: str = ""
    title: str = ""                 # human label, e.g. the job/gig title
    url: str = ""
    instructions: str = ""
    fields: dict = {}


@router.post("/automation/jobs")
async def create_job(body: JobBody, user: dict = Depends(current_user)):
    url = _worker_for(user)
    title = body.title or body.kind
    job = await repo.add("automation_jobs", user["id"], {
        "kind": body.kind, "platform": body.platform, "title": title,
        "url": body.url, "instructions": body.instructions, "fields": body.fields,
        "status": "running", "steps": [], "engine": "worker" if url else "simulation",
        "createdAt": _now(), "updatedAt": _now(),
    })
    payload = {"job_id": job["id"], "kind": body.kind, "platform": body.platform,
               "url": body.url, "instructions": body.instructions, "fields": body.fields, "dry_run": True}
    result = (await _call_worker(url, payload) or _WORKER_DOWN) if url else _simulate(body.kind, dry_run=True)
    job = await repo.update("automation_jobs", user["id"], job["id"], {
        "steps": result.get("steps", []),
        "status": result.get("status", "needs_approval"),
        "updatedAt": _now(),
    })
    await repo.log_activity(user["id"], "Automation Engine", f"Automation job '{title}' prepared — {job['status']}")
    return job


@router.post("/automation/jobs/{job_id}/approve")
async def approve_job(job_id: str, user: dict = Depends(current_user)):
    uid = user["id"]
    # Atomic claim: only one approval can move the job out of needs_approval.
    job = await repo.update("automation_jobs", uid, job_id, {"status": "running", "updatedAt": _now()},
                            expect={"status": "needs_approval"})
    if not job:
        existing = await repo.get("automation_jobs", uid, job_id)
        if not existing:
            raise HTTPException(404, "Job not found")
        raise HTTPException(409, f"Job is '{existing['status']}', not awaiting approval.")

    url = _worker_for(user) if job.get("engine") == "worker" else None
    charged = False
    if url and job["kind"] == "auto_apply":
        if await repo.spend_credit(uid, "bid") is None:
            await repo.update("automation_jobs", uid, job_id, {"status": "needs_approval", "updatedAt": _now()})
            raise HTTPException(402, "No bid credits left — top up to send this application.")
        charged = True

    payload = {"job_id": job_id, "kind": job["kind"], "platform": job["platform"],
               "url": job["url"], "instructions": job["instructions"], "fields": job["fields"], "dry_run": False}
    result = (await _call_worker(url, payload) or _WORKER_DOWN) if url else _simulate(job["kind"], dry_run=False)
    status = result.get("status", "completed")
    if charged and status != "completed":
        await repo.refund_credit(uid, "bid")
    job = await repo.update("automation_jobs", uid, job_id, {
        "steps": result.get("steps", []), "status": status, "updatedAt": _now(),
    })

    simulated = not url
    outcome = "simulated — nothing was sent" if simulated else status
    await repo.log_activity(uid, "Automation Engine", f"Automation job '{job['title']}' approved — {outcome}",
                            "success" if status == "completed" else "warning")
    if status == "completed":
        await repo.notify(uid, "Automation completed",
                          f"'{job['title']}' finished after your approval" + (" (simulation — nothing was sent)." if simulated else "."))
    return job


@router.post("/automation/jobs/{job_id}/cancel")
async def cancel_job(job_id: str, user: dict = Depends(current_user)):
    job = await repo.get("automation_jobs", user["id"], job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    if job["status"] in ("completed", "cancelled"):
        raise HTTPException(409, f"Job is already {job['status']}.")
    job = await repo.update("automation_jobs", user["id"], job_id, {"status": "cancelled", "updatedAt": _now()})
    await repo.log_activity(user["id"], "Automation Engine", f"Automation job '{job['title']}' cancelled", "warning")
    return job
