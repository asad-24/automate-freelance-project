"""System (demo data) — team users, integrations catalog, personas, portfolio.

Per-user notifications, audit log and settings live in routers/activity.py."""
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..auth import require_owner, require_roles
from ..store import DB, audit, get_by_id

router = APIRouter(tags=["system"])


@router.get("/users", dependencies=[Depends(require_owner)])
def list_users():
    return DB["users"]


class InviteUser(BaseModel):
    name: str
    email: str
    role: str = "Viewer"


@router.post("/users/invite", dependencies=[Depends(require_owner)])
def invite_user(body: InviteUser):
    user = {
        "id": f"du{len(DB['users']) + 1}",
        "name": body.name,
        "email": body.email,
        "role": body.role,
        "status": "Invited",
        "lastActive": "—",
    }
    DB["users"].append(user)
    audit("System", f"User invited: {body.email} ({body.role})")
    return user


# --- Integrations ---
@router.get("/integrations")
def list_integrations():
    return DB["integrations"]


@router.post("/integrations/{integration_id}/toggle", dependencies=[Depends(require_roles("admin"))])
def toggle_integration(integration_id: str):
    integ = get_by_id("integrations", integration_id)
    if not integ:
        raise HTTPException(404, "Integration not found")
    integ["status"] = "Disconnected" if integ["status"] == "Connected" else "Connected"
    audit("System", f"{integ['name']} {integ['status'].lower()}")
    return integ


# --- Personas ---
@router.get("/personas")
def list_personas():
    return DB["personas"]


@router.patch("/personas/{persona_id}")
def update_persona(persona_id: str, body: dict):
    persona = get_by_id("personas", persona_id)
    if not persona:
        raise HTTPException(404, "Persona not found")
    persona.update(body)
    audit("System", f"Persona {persona['name']} updated")
    return persona


@router.post("/personas")
def create_persona(body: dict):
    persona = {"id": f"pr{len(DB['personas']) + 1}", "conversations": 0, "active": True, **body}
    DB["personas"].append(persona)
    audit("System", f"Persona {persona.get('name')} created")
    return persona


# --- Portfolio ---
@router.get("/portfolio")
def list_portfolio():
    return DB["portfolio"]


@router.get("/portfolio/{item_id}")
def get_portfolio_item(item_id: str):
    item = get_by_id("portfolio", item_id)
    if not item:
        raise HTTPException(404, "Item not found")
    return item


@router.post("/portfolio/{item_id}/match")
def match_portfolio(item_id: str, body: dict):
    """Semantic match simulation — returns matched tags for a job description."""
    item = get_by_id("portfolio", item_id)
    if not item:
        raise HTTPException(404, "Item not found")
    return {"ok": True, "item": item, "matchedSemantic": item.get("semantic", [])}


# --- Health / meta ---
@router.get("/meta", dependencies=[Depends(require_owner)])
def meta():
    return {
        "collections": sorted(DB.keys()),
        "counts": {k: (len(v) if isinstance(v, list) else 1) for k, v in DB.items()},
        "session": uuid4().hex[:8],
    }
