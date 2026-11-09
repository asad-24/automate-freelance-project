"""Agent control center — list, start/pause, run-now, configure."""
import time

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..store import DB, audit, get_by_id

router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("")
def list_agents():
    return DB["agents"]


@router.get("/{agent_id}")
def get_agent(agent_id: str):
    agent = get_by_id("agents", agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found")
    return agent


@router.post("/{agent_id}/toggle")
def toggle_agent(agent_id: str):
    agent = get_by_id("agents", agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found")
    agent["status"] = "paused" if agent["status"] == "running" else "running"
    agent["lastRun"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    audit(agent["name"], f"Agent {agent['status']}")
    return agent


@router.post("/{agent_id}/run")
def run_agent(agent_id: str):
    agent = get_by_id("agents", agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found")
    agent["status"] = "running"
    agent["runsToday"] = agent.get("runsToday", 0) + 1
    agent["lastRun"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    audit(agent["name"], "Manual run triggered")
    return {"ok": True, "agent": agent}


class AgentConfigBody(BaseModel):
    schedule: str | None = None
    model: str | None = None
    instructions: str | None = None


@router.post("/{agent_id}/config")
def configure_agent(agent_id: str, body: AgentConfigBody):
    agent = get_by_id("agents", agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found")
    for field in ("schedule", "model", "instructions"):
        value = getattr(body, field)
        if value is not None:
            agent[field] = value
    audit(agent["name"], "Configuration updated")
    return {"ok": True, "agent": agent}


@router.post("/resume-all")
def resume_all():
    for a in DB["agents"]:
        if a["status"] != "error":
            a["status"] = "running"
    audit("System", "All agents resumed")
    return {"ok": True}
