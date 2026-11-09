"""Acquisition pipeline — jobs, freelance leads, proposals, B2B sales."""
from fastapi import APIRouter, HTTPException

from ..store import DB, audit, get_by_id

router = APIRouter(tags=["pipeline"])


# --- Job Hunter (Agent 1) ---
@router.get("/jobs")
def list_jobs():
    return DB["jobs"]


@router.post("/jobs/rescan")
def rescan_jobs():
    audit("Job Hunter", "Manual rescan triggered")
    return {"ok": True, "message": "Job scan queued"}


# --- Bidding & Acquisition (Agent 3) ---
@router.get("/leads")
def list_leads():
    return DB["leads"]


@router.get("/leads/{lead_id}")
def get_lead(lead_id: str):
    lead = get_by_id("leads", lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")
    return lead


@router.post("/leads/rescan")
def rescan_leads():
    audit("Bidding & Acquisition", "Manual scrape triggered")
    return {"ok": True, "message": "Scrape queued"}


@router.get("/proposals")
def list_proposals():
    return DB["proposals"]


@router.post("/proposals/{proposal_id}/regenerate")
def regenerate_proposal(proposal_id: str):
    proposal = get_by_id("proposals", proposal_id)
    if not proposal:
        raise HTTPException(404, "Proposal not found")
    proposal["status"] = "Drafting"
    audit("Bidding & Acquisition", f"Regenerating proposal {proposal_id}")
    return proposal


# --- Marketing & Sales (Agent 2) ---
@router.get("/sales-leads")
def list_sales_leads():
    return DB["sales_leads"]


@router.get("/sequences")
def list_sequences():
    return DB["sequences"]
