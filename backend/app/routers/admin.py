"""Admin extras — API credential vault, security posture, user testing,
client onboarding."""
import time
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..auth import require_owner, require_roles
from ..store import DB, audit, get_by_id

router = APIRouter(tags=["admin"])


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


# --- API Credential Vault ---
@router.get("/credentials", dependencies=[Depends(require_owner)])
def list_credentials():
    return DB["credentials"]


@router.post("/credentials/{cred_id}/rotate", dependencies=[Depends(require_owner)])
def rotate_credential(cred_id: str):
    cred = get_by_id("credentials", cred_id)
    if not cred:
        raise HTTPException(404, "Credential not found")
    cred["lastRotated"] = time.strftime("%Y-%m-%d", time.gmtime())
    DB["security_events"].insert(0, {
        "id": f"ev{len(DB['security_events']) + 1}", "event": "Credential rotated",
        "detail": f"{cred['service']} key rotated", "severity": "info", "time": _now(),
    })
    audit("Security", f"Rotated credential: {cred['service']}")
    return cred


@router.post("/credentials/{cred_id}/toggle", dependencies=[Depends(require_owner)])
def toggle_credential(cred_id: str):
    cred = get_by_id("credentials", cred_id)
    if not cred:
        raise HTTPException(404, "Credential not found")
    cred["status"] = "Pending" if cred["status"] == "Connected" else "Connected"
    audit("Security", f"{cred['service']} marked {cred['status']}")
    return cred


# --- Security posture ---
@router.get("/security", dependencies=[Depends(require_owner)])
def security_posture():
    return {
        "controls": DB["security_controls"],
        "events": DB["security_events"],
        "enforced": sum(1 for c in DB["security_controls"] if c["status"] == "Enforced"),
        "total": len(DB["security_controls"]),
    }


# --- User testing ---
@router.get("/user-testing", dependencies=[Depends(require_owner)])
def user_testing():
    scenarios = DB["test_scenarios"]
    return {
        "scenarios": scenarios,
        "feedback": DB["user_feedback"],
        "summary": {
            "total": len(scenarios),
            "passed": sum(1 for s in scenarios if s["status"] == "Passed"),
            "inProgress": sum(1 for s in scenarios if s["status"] == "In progress"),
            "planned": sum(1 for s in scenarios if s["status"] == "Planned"),
        },
    }


class ScenarioUpdate(BaseModel):
    status: str
    notes: str | None = None


@router.post("/user-testing/scenarios/{scenario_id}", dependencies=[Depends(require_owner)])
def update_scenario(scenario_id: str, body: ScenarioUpdate):
    s = get_by_id("test_scenarios", scenario_id)
    if not s:
        raise HTTPException(404, "Scenario not found")
    s["status"] = body.status
    if body.notes is not None:
        s["notes"] = body.notes
    audit("User Testing", f"Scenario '{s['scenario'][:40]}' → {body.status}")
    return s


class FeedbackCreate(BaseModel):
    model_config = {"populate_by_name": True}

    from_: str | None = Field(default=None, alias="from")
    area: str = "General"
    text: str
    severity: str = "Suggestion"


@router.post("/user-testing/feedback", dependencies=[Depends(require_owner)])
def add_feedback(body: FeedbackCreate):
    fb = {
        "id": f"fb{len(DB['user_feedback']) + 1}",
        "from": body.from_ or "Anonymous",
        "area": body.area,
        "text": body.text,
        "severity": body.severity,
        "status": "Open",
        "date": time.strftime("%Y-%m-%d", time.gmtime()),
    }
    DB["user_feedback"].insert(0, fb)
    return fb


# --- Client onboarding ---
class OnboardClient(BaseModel):
    clientName: str
    company: str
    source: str = "Referral"
    projectTitle: str
    projectValue: float
    due: str = "2026-12-01"
    milestones: list[dict] = []


@router.post("/onboarding", dependencies=[Depends(require_roles("admin"))])
def onboard_client(body: OnboardClient):
    client = {
        "id": f"c{len(DB['clients']) + 1}",
        "name": body.clientName,
        "company": body.company,
        "source": body.source,
        "ltv": body.projectValue,
        "sentiment": "neutral",
        "contracts": 1,
        "status": "Onboarding",
    }
    DB["clients"].append(client)
    contract = {
        "id": f"ct{len(DB['contracts']) + 1}",
        "title": body.projectTitle,
        "client": body.company,
        "value": body.projectValue,
        "status": "Onboarding",
        "milestonesDone": 0,
        "milestonesTotal": len(body.milestones) or 1,
        "freelancer": "TBD",
        "qa": "Pending",
        "due": body.due,
    }
    DB["contracts"].append(contract)
    for i, m in enumerate(body.milestones):
        DB["milestones"].append({
            "id": f"m{len(DB['milestones']) + 1}",
            "contract": body.projectTitle,
            "title": m.get("title", f"Milestone {i + 1}"),
            "amount": m.get("amount", 0),
            "status": "Pending",
            "due": m.get("due", body.due),
        })
    audit("Sales", f"New client onboarded: {body.company} — '{body.projectTitle}' (${body.projectValue:,.0f})")
    DB["notifications"].insert(0, {
        "id": f"n{len(DB['notifications']) + 1}",
        "title": "New client onboarded",
        "body": f"{body.company} — {body.projectTitle}",
        "type": "success",
        "time": _now(),
        "read": False,
    })
    return {"ok": True, "client": client, "contract": contract, "id": uuid4().hex[:8]}
