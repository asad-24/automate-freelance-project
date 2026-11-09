"""Public endpoints — reachable without signing in.

Marketing pages use these: the pricing page (plans) and the beta signup form.
Everything else in the API requires a session token (see app/auth.py).
"""
import time
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .. import repo
from ..store import DB

router = APIRouter(tags=["public"])


@router.get("/plans")
def list_plans():
    return DB["plans"]


# --- Beta testers — signups saved to MongoDB (owners review them in /api/beta-testers) ---
class BetaTesterBody(BaseModel):
    name: str
    email: str
    role: str = "freelancer"
    area: str = ""
    feedback: str = ""
    rating: int = 0


@router.post("/beta-testers")
async def create_beta_tester(body: BetaTesterBody):
    record = {
        "id": f"bt-{uuid4().hex[:8]}",
        "name": body.name.strip()[:120],
        "email": body.email.strip().lower()[:200],
        "role": body.role[:40],
        "area": body.area[:200],
        "feedback": body.feedback[:2000],
        "rating": body.rating,
        "status": "Invited",
        "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    if not await repo.add_beta_tester(record):
        raise HTTPException(409, "This email is already registered for the beta")
    return record
