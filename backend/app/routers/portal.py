"""Portal endpoints — freelancer & client role-scoped views."""
import time
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..auth import require_roles
from ..store import DB, audit, get_by_id

router = APIRouter(tags=["portal"])


# ============================ FREELANCER ============================
@router.get("/freelancer/overview", dependencies=[Depends(require_roles("freelancer"))])
def freelancer_overview():
    return {
        "earnings": DB["freelancer_earnings"],
        "openSpecs": DB["freelancer_specs"],
        "contracts": DB["freelancer_contracts"],
        "bids": DB["freelancer_bids"],
    }


@router.get("/freelancer/specs", dependencies=[Depends(require_roles("freelancer"))])
def list_specs():
    return DB["freelancer_specs"]


class SubmitBid(BaseModel):
    hours: int
    rate: float


@router.post("/freelancer/specs/{spec_id}/bid", dependencies=[Depends(require_roles("freelancer"))])
def submit_bid(spec_id: str, body: SubmitBid):
    spec = get_by_id("freelancer_specs", spec_id)
    if not spec:
        raise HTTPException(404, "Spec not found")
    spec["bidsIn"] = spec.get("bidsIn", 0) + 1
    bid = {
        "id": f"fb{len(DB['freelancer_bids']) + 1}",
        "spec": spec["title"],
        "hours": body.hours,
        "rate": body.rate,
        "total": body.hours * body.rate,
        "status": "Under Review",
        "submitted": time.strftime("%Y-%m-%d", time.gmtime()),
    }
    DB["freelancer_bids"].insert(0, bid)
    audit("Arbitrage Dispatcher", f"New blind bid received on '{spec['title']}'")
    return bid


@router.get("/freelancer/bids", dependencies=[Depends(require_roles("freelancer"))])
def list_freelancer_bids():
    return DB["freelancer_bids"]


@router.get("/freelancer/contracts", dependencies=[Depends(require_roles("freelancer"))])
def list_freelancer_contracts():
    return DB["freelancer_contracts"]


@router.get("/freelancer/earnings", dependencies=[Depends(require_roles("freelancer"))])
def freelancer_earnings():
    return DB["freelancer_earnings"]


@router.get("/freelancer/qa", dependencies=[Depends(require_roles("freelancer"))])
def freelancer_qa():
    return [q for q in DB["qa_runs"] if q.get("freelancer") == "FL-3821"]


@router.get("/freelancer/messages", dependencies=[Depends(require_roles("freelancer"))])
def freelancer_messages():
    return [c for c in DB["conversations"] if "Freelancer" in c["contact"]]


# ============================ CLIENT ============================
@router.get("/client/overview", dependencies=[Depends(require_roles("client"))])
def client_overview():
    return {
        "projects": DB["client_projects"],
        "invoices": DB["client_invoices"],
        "milestones": DB["milestones"],
    }


@router.get("/client/projects", dependencies=[Depends(require_roles("client"))])
def list_client_projects():
    return DB["client_projects"]


@router.get("/client/milestones", dependencies=[Depends(require_roles("client"))])
def list_client_milestones():
    return DB["milestones"]


@router.post("/client/milestones/{milestone_id}/approve", dependencies=[Depends(require_roles("client"))])
def client_approve_milestone(milestone_id: str):
    ms = get_by_id("milestones", milestone_id)
    if not ms:
        raise HTTPException(404, "Milestone not found")
    ms["status"] = "Approved"
    audit("Payments", f"Client approved milestone '{ms['title']}' — escrow release queued")
    return ms


@router.get("/client/files", dependencies=[Depends(require_roles("client"))])
def list_client_files():
    return DB["client_files"]


@router.post("/client/files", dependencies=[Depends(require_roles("client"))])
def upload_client_file(body: dict):
    f = {
        "id": f"cf{len(DB['client_files']) + 1}",
        "name": body.get("name", f"upload-{uuid4().hex[:6]}"),
        "type": body.get("type", "File"),
        "size": body.get("size", "—"),
        "date": time.strftime("%Y-%m-%d", time.gmtime()),
    }
    DB["client_files"].insert(0, f)
    return f


@router.get("/client/invoices", dependencies=[Depends(require_roles("client"))])
def list_client_invoices():
    return DB["client_invoices"]


@router.post("/client/invoices/{invoice_id}/pay", dependencies=[Depends(require_roles("client"))])
def pay_client_invoice(invoice_id: str):
    inv = get_by_id("client_invoices", invoice_id)
    if not inv:
        raise HTTPException(404, "Invoice not found")
    inv["status"] = "Paid"
    audit("Payments", f"Client paid '{inv['title']}' (${inv['amount']})")
    return inv


@router.get("/client/messages", dependencies=[Depends(require_roles("client"))])
def client_messages():
    return [c for c in DB["conversations"] if "Freelancer" not in c["contact"]]
