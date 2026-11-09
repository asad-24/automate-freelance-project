"""Revenue — invoices, payouts, affiliates, monetization, market arbitrage,
subscription plans, add-ons, billing."""
from fastapi import APIRouter, Depends, HTTPException

from ..auth import require_roles
from ..store import DB, audit, get_by_id

router = APIRouter(tags=["revenue"])


# --- Invoices ---
@router.get("/invoices")
def list_invoices():
    return DB["invoices"]


@router.post("/invoices/{invoice_id}/remind", dependencies=[Depends(require_roles("admin"))])
def send_reminder(invoice_id: str):
    inv = get_by_id("invoices", invoice_id)
    if not inv:
        raise HTTPException(404, "Invoice not found")
    inv["remindersSent"] = inv.get("remindersSent", 0) + 1
    audit("Payments", f"Reminder #{inv['remindersSent']} sent for {invoice_id}")
    return inv


# --- Payouts (Stripe Connect — stubbed) ---
@router.get("/payouts")
def list_payouts():
    return DB["payouts"]


@router.post("/payouts/{payout_id}/approve", dependencies=[Depends(require_roles("admin"))])
def approve_payout(payout_id: str):
    payout = get_by_id("payouts", payout_id)
    if not payout:
        raise HTTPException(404, "Payout not found")
    payout["status"] = "Completed"
    payout["transferId"] = "tr_demo"
    audit("Payments", f"Payout approved: {payout['freelancer']} ${payout['amount']}")
    return payout


# --- Affiliates ---
@router.get("/affiliates")
def list_affiliates():
    return DB["affiliates"]


# --- Market arbitrage & competitors ---
@router.get("/market-rates")
def list_market_rates():
    return DB["market_rates"]


@router.get("/competitors")
def list_competitors():
    return DB["competitors"]


@router.post("/competitors/{competitor_id}/undercut", dependencies=[Depends(require_roles("admin"))])
def undercut_competitor(competitor_id: str):
    comp = get_by_id("competitors", competitor_id)
    if not comp:
        raise HTTPException(404, "Competitor not found")
    comp["ourAction"] = "Undercut 5% + faster delivery"
    audit("Bidding & Acquisition", f"Undercut enabled vs {comp['name']}")
    return comp


# --- Monetization ---
@router.get("/addons")
def list_addons():
    return DB["addons"]


@router.get("/revenue-streams")
def list_revenue_streams():
    return DB["revenue_streams"]


@router.get("/billing-history")
def list_billing_history():
    return DB["billing_history"]


@router.get("/monetization")
def monetization_summary():
    streams = DB["revenue_streams"]
    return {
        "streams": streams,
        "addons": DB["addons"],
        "plans": DB["plans"],
        "totalMonthly": sum(s["monthly"] for s in streams),
        "marginTimeseries": DB["margin_timeseries"],
    }


class PlanChangeBody(dict):
    pass


@router.post("/billing/plan/{plan_id}")
def change_plan(plan_id: str):
    plan = get_by_id("plans", plan_id)
    if not plan:
        raise HTTPException(404, "Plan not found")
    audit("Billing", f"Plan change requested: {plan['name']}")
    return {"ok": True, "plan": plan, "message": "Plan change queued (Stripe wiring pending)"}


@router.post("/addons/{addon_id}/purchase")
def purchase_addon(addon_id: str):
    addon = get_by_id("addons", addon_id)
    if not addon:
        raise HTTPException(404, "Add-on not found")
    audit("Billing", f"Add-on purchased: {addon['name']}")
    return {"ok": True, "addon": addon}
