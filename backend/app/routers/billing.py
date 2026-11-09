"""Billing — plan, credits and purchases, owned by the server.

Checkout is simulated until Stripe is connected (see SERVICES.md): purchases
are recorded with status "Simulated" and no money moves. Each purchase also
pings the user's sales webhook, if they set one (routers/activity.py).

GET  /api/user-monetization  -> {plan, bidCredits, profileCredits, purchases}
GET  /api/billing-history    -> purchases, newest first
POST /api/billing/credits    {kind: "bids" | "profiles"} -> add a credit pack
POST /api/billing/upgrade    -> switch to Pro
POST /api/billing/spend      {kind: "profile"} -> spend one profile credit;
                             402 when none are left (Pro is unlimited)

Bid credits are spent by the server itself when a real bid goes out (see
routers/freelancer.py and routers/automation.py), never by the browser.
"""
import time
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .. import repo
from ..auth import current_user
from .activity import send_sale_alert

router = APIRouter(tags=["billing"])

CREDIT_PACKS = {
    "bids": {"label": "10 Job Bids", "field": "bidCredits", "credits": 10, "price": 9.9},
    "profiles": {"label": "1 Platform Profile", "field": "profileCredits", "credits": 1, "price": 5.99},
}
PRO_PLAN = {"label": "Pro plan — unlimited bids & profiles", "price": 19}


def _purchase(item: str, amount: float, **extra) -> dict:
    return {
        "id": f"po-{uuid4().hex[:12]}", "item": item, "amount": amount,
        "status": "Simulated", "date": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), **extra,
    }


@router.get("/user-monetization")
async def get_monetization(user: dict = Depends(current_user)):
    return await repo.get_billing(user["id"])


@router.get("/billing-history")
async def billing_history(user: dict = Depends(current_user)):
    return (await repo.get_billing(user["id"]))["purchases"]


class CreditsBody(BaseModel):
    kind: Literal["bids", "profiles"]


@router.post("/billing/credits")
async def buy_credits(body: CreditsBody, user: dict = Depends(current_user)):
    pack = CREDIT_PACKS[body.kind]
    purchase = _purchase(pack["label"], pack["price"])
    billing = await repo.record_purchase(user["id"], purchase, add_credits={pack["field"]: pack["credits"]})
    await repo.log_activity(user["id"], "Operator", f"Added {pack['label']} — ${pack['price']} (simulated checkout)")
    await send_sale_alert(user["id"], "purchase", f"{pack['label']} (simulated)", pack["price"])
    return {"purchase": purchase, "monetization": billing}


@router.post("/billing/upgrade")
async def upgrade(user: dict = Depends(current_user)):
    purchase = _purchase(PRO_PLAN["label"], PRO_PLAN["price"], recurring=True)
    billing = await repo.record_purchase(user["id"], purchase, plan="pro")
    await repo.log_activity(user["id"], "Operator", "Upgraded to Pro plan (simulated checkout)")
    await send_sale_alert(user["id"], "upgrade", "Pro plan (simulated)", PRO_PLAN["price"])
    return {"purchase": purchase, "monetization": billing}


class SpendBody(BaseModel):
    kind: Literal["profile"]


@router.post("/billing/spend")
async def spend(body: SpendBody, user: dict = Depends(current_user)):
    billing = await repo.spend_credit(user["id"], body.kind)
    if billing is None:
        raise HTTPException(402, "No profile credits left.")
    return {"monetization": billing}
