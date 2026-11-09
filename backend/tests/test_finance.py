"""Financial workflow invariants: isolation, eligibility, state, replay and capacity.

All amounts are sandbox USD minor units. No external provider is contacted.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from uuid import uuid4

import pytest

from app import db, finance_store
from app.routers.finance import quote, RULES
from conftest import bearer, owner, run, signup


def request(**fields):
    return {"request_id": str(uuid4()), "acknowledged_sandbox": True, **fields}


@pytest.fixture
def actors(client):
    reviewer = owner(client)
    applicant = signup(client, email="applicant@example.com", role="freelancer")
    investor = signup(client, email="investor@example.com", role="client")
    return bearer(reviewer["token"]), bearer(applicant["token"]), bearer(investor["token"])


def decide(client, reviewer, record, action="approve"):
    response = client.post(f"/api/finance/reviews/{record['id']}", headers=reviewer,
                           json={"version": record["version"], "action": action,
                                 "note": "Sandbox evidence checked by an independent reviewer."})
    assert response.status_code == 200, response.text
    return response.json()


def verify_profile(client, reviewer, applicant, entity_type="freelancer"):
    response = client.post("/api/finance/verifications", headers=applicant, json=request(
        title="Applicant Studio", entity_type=entity_type, profile_url="https://example.com/profile",
        notes="A professional profile and work history supplied for sandbox review."))
    assert response.status_code == 200, response.text
    return decide(client, reviewer, response.json())


def project(client, reviewer, applicant, amount=100_000):
    response = client.post("/api/finance/projects", headers=applicant, json=request(
        title="Dashboard delivery", platform="Upwork", reference=f"order-{uuid4()}",
        evidence_url="https://example.com/contract", amount_minor=amount,
        due_date=(date.today() + timedelta(days=30)).isoformat(),
        notes="Awarded project with a defined scope, milestones and test evidence."))
    assert response.status_code == 200, response.text
    return decide(client, reviewer, response.json())


def offering(client, reviewer, applicant, target=100_000):
    response = client.post("/api/finance/offerings", headers=applicant, json=request(
        title="Applicant Studio opportunity", entity_type="freelancer",
        summary="An illustrative opportunity to fund tools and support delivery of freelance projects.",
        target_minor=target, minimum_minor=1000, term_months=6,
        profile_url="https://example.com/profile"))
    assert response.status_code == 200, response.text
    return decide(client, reviewer, response.json())


def test_sandbox_is_explicit_and_private(client, actors):
    reviewer, applicant, investor = actors
    assert client.get("/api/finance/overview").status_code == 401
    info = client.get("/api/finance/overview", headers=applicant).json()
    assert info["mode"] == "sandbox" and info["money_movement_enabled"] is False
    assert info["records"] == [] and info["commitments"] == []
    assert info["infrastructure"]["token_contract"] is None
    assert info["infrastructure"]["token_issued"] is False
    assert client.get("/api/finance/reviews", headers=applicant).status_code == 403
    assert client.get("/api/finance/reviews", headers=investor).status_code == 403


def test_owner_cannot_be_claimed_or_injected_through_signup(client):
    data = signup(client, email="owner@example.com", owner=True, platform_owner=True)
    assert data["user"]["owner"] is False
    assert client.get("/api/finance/reviews", headers=bearer(data["token"])).status_code == 403


def test_deleted_disabled_and_revoked_owners_lose_access(client):
    session = owner(client)
    header = bearer(session["token"])
    assert client.get("/api/finance/reviews", headers=header).status_code == 200
    run(client, db.set_platform_owner, "owner@example.com", False)
    assert client.get("/api/finance/reviews", headers=header).status_code == 403

    async def disable():
        if db.enabled():
            await db._get_db().users.update_one({"_id": "owner@example.com"}, {"$set": {"disabled": True}})
        else:
            db._mem_users["owner@example.com"]["disabled"] = True
    run(client, disable)
    assert client.get("/api/finance/overview", headers=header).status_code == 401

    async def remove():
        if db.enabled():
            await db._get_db().users.delete_one({"_id": "owner@example.com"})
        else:
            db._mem_users.pop("owner@example.com")
    run(client, remove)
    assert client.get("/api/finance/overview", headers=header).status_code == 401


@pytest.mark.parametrize("field,value", [
    ("nangoConnections", {"upwork": {"connectionId": "someone-else"}}),
    ("inboundTokenHash", "arbitrary"), ("platform_owner", True),
    ("bidRules", {"dailyBidCap": -10}), ("skillProfile", "invalid"),
])
def test_protected_settings_are_not_browser_writeable(client, actors, field, value):
    _, applicant, _ = actors
    assert client.patch("/api/settings", headers=applicant, json={field: value}).status_code == 422


def test_profile_project_review_and_funding_flow(client, actors):
    reviewer, applicant, investor = actors
    # Unreviewed profiles cannot create projects.
    body = request(title="A valid project", platform="Upwork", reference="order-123",
                   evidence_url="https://example.com/evidence", amount_minor=100_000,
                   due_date=(date.today() + timedelta(days=30)).isoformat(), notes="A valid awarded project evidence description.")
    assert client.post("/api/finance/projects", headers=applicant, json=body).status_code == 409
    verify_profile(client, reviewer, applicant)
    pending = client.post("/api/finance/projects", headers=applicant, json=body).json()
    funding = request(project_id=pending["id"], amount_minor=80_000)
    assert client.post("/api/finance/funding", headers=applicant, json=funding).status_code == 409
    approved = decide(client, reviewer, pending)
    assert approved["quote"]["advance_cap_minor"] == 80_000
    excessive = {**funding, "amount_minor": 80_001}
    assert client.post("/api/finance/funding", headers=applicant, json=excessive).status_code == 422
    assert client.post("/api/finance/funding", headers=investor, json=funding).status_code in (404, 409)
    response = client.post("/api/finance/funding", headers=applicant, json=funding)
    assert response.status_code == 200
    case = response.json()
    assert case["quote"]["fee_minor"] == 2000
    assert case["quote"]["net_minor"] == 78_000
    assert case["quote"]["settlement_minor"] == 80_000
    assert client.post("/api/finance/funding", headers=applicant, json=funding).json()["id"] == case["id"]
    assert client.post("/api/finance/funding", headers=applicant, json={**funding, "amount_minor": 50_000}).status_code == 409
    assert client.post(f"/api/finance/reviews/{case['id']}", headers=applicant,
                       json={"version": 1, "action": "approve", "note": "Trying to approve my own request."}).status_code == 403
    case = decide(client, reviewer, case)
    stale = client.post(f"/api/finance/reviews/{case['id']}", headers=reviewer,
                        json={"version": 1, "action": "approve", "note": "Stale version must not overwrite a review."})
    assert stale.status_code == 409
    case = decide(client, reviewer, case, "simulate_advance")
    assert case["status"] == "simulated"
    case = decide(client, reviewer, case, "settle")
    assert case["status"] == "settled" and len(case["events"]) == 4
    private = client.get("/api/finance/overview", headers=investor).json()
    assert private["records"] == []


@pytest.mark.parametrize("amount", [-1, 0, 1.5, "10000", 100_000_001])
def test_financial_amounts_require_positive_bounded_integers(client, actors, amount):
    _, applicant, _ = actors
    response = client.post("/api/finance/funding", headers=applicant,
                           json=request(project_id="some-project-id", amount_minor=amount))
    assert response.status_code == 422


def test_extra_fields_no_acknowledgement_and_insecure_evidence_are_rejected(client, actors):
    _, applicant, investor = actors
    body = request(title="My profile", entity_type="freelancer", profile_url="https://example.com/me",
                   notes="Sufficient professional evidence for a sandbox profile review.")
    assert client.post("/api/finance/verifications", headers=applicant, json={**body, "status": "approved"}).status_code == 422
    assert client.post("/api/finance/verifications", headers=applicant, json={**body, "acknowledged_sandbox": False}).status_code == 422
    assert client.post("/api/finance/verifications", headers=applicant, json={**body, "profile_url": "javascript:alert(1)"}).status_code == 422
    assert client.post("/api/finance/verifications", headers=investor, json=body).status_code == 403


def test_owner_cannot_self_review(client):
    reviewer = bearer(owner(client)["token"])
    response = client.post("/api/finance/verifications", headers=reviewer, json=request(
        title="Owner Agency", entity_type="agency", profile_url="https://example.com/agency",
        notes="Owner professional profile supplied for independent sandbox review."))
    assert response.status_code == 200
    case = response.json()
    assert client.post(f"/api/finance/reviews/{case['id']}", headers=reviewer,
                       json={"version": 1, "action": "approve", "note": "My own agency should require another reviewer."}).status_code == 403


def test_protection_and_claim_lifecycle(client, actors):
    reviewer, applicant, _ = actors
    verify_profile(client, reviewer, applicant)
    p = project(client, reviewer, applicant)
    response = client.post("/api/finance/protection", headers=applicant, json=request(project_id=p["id"]))
    protection = response.json()
    assert protection["quote"]["protection_fee_minor"] == 3000
    assert protection["quote"]["coverage_minor"] == 80_000
    claim_body = request(protection_id=protection["id"], amount_minor=50_000,
                         reason="A project failure event described with sufficient details and evidence.",
                         evidence_url="https://example.com/claim-evidence")
    assert client.post("/api/finance/claims", headers=applicant, json=claim_body).status_code == 409
    protection = decide(client, reviewer, protection)
    protection = decide(client, reviewer, protection, "activate")
    assert client.post("/api/finance/claims", headers=applicant, json={**claim_body, "amount_minor": 80_001}).status_code == 422
    response = client.post("/api/finance/claims", headers=applicant, json=claim_body)
    assert response.status_code == 200
    claim = response.json()
    assert client.post("/api/finance/claims", headers=applicant, json=claim_body).json()["id"] == claim["id"]
    claim = decide(client, reviewer, claim)
    claim = decide(client, reviewer, claim, "simulate_payout")
    assert claim["status"] == "paid_sandbox"


@pytest.mark.parametrize("project_minor,expected_fee", [
    (5000, 150), (10_000, 300), (25_000, 750), (50_000, 1500),
    (100_000, 3000), (250_000, 7500), (500_000, 15_000),
    (1_000_000, 30_000), (5555, 167), (100_055, 3002),
])
def test_founder_three_percent_service_fee_examples(project_minor, expected_fee):
    # Includes the founder's $50 -> $1.50 example: no implicit $3 minimum.
    assert quote(project_minor)["protection_fee_minor"] == expected_fee


def test_new_pricing_refreshes_project_estimates_but_preserves_saved_policies(client, actors, monkeypatch):
    reviewer, applicant, _ = actors
    verify_profile(client, reviewer, applicant)
    with monkeypatch.context() as legacy:
        legacy.setitem(RULES, "version", "illustrative-v1")
        legacy.setitem(RULES, "protection_fee_bps", 150)
        old_project = project(client, reviewer, applicant)
        next_project = project(client, reviewer, applicant)
        body = request(project_id=old_project["id"])
        old_policy = client.post("/api/finance/protection", headers=applicant, json=body).json()
        assert old_policy["quote"]["protection_fee_minor"] == 1500
    records = client.get("/api/finance/overview", headers=applicant).json()["records"]
    estimate = next(r for r in records if r["id"] == next_project["id"])
    assert estimate["quote"]["protection_fee_minor"] == 3000
    assert estimate["quote"]["rules_version"] == RULES["version"]
    # Reading the new estimate must not mutate the original stored project.
    stored = run(client, finance_store.get, next_project["id"])
    assert stored["quote"]["protection_fee_minor"] == 1500
    replay = client.post("/api/finance/protection", headers=applicant, json=body).json()
    assert replay["quote"] == old_policy["quote"]
    new_policy = client.post("/api/finance/protection", headers=applicant,
                             json=request(project_id=next_project["id"])).json()
    assert new_policy["quote"]["protection_fee_minor"] == 3000
    assert new_policy["quote"]["rules_version"] == RULES["version"]


def test_marketplace_commitments_capacity_replays_and_privacy(client, actors):
    reviewer, applicant, investor = actors
    verify_profile(client, reviewer, applicant)
    listing = offering(client, reviewer, applicant)
    market = client.get("/api/finance/marketplace", headers=investor).json()["offerings"]
    assert market[0]["remaining_minor"] == 100_000
    assert "user_id" not in market[0] and "commitments" not in market[0] and "events" not in market[0]
    path = f"/api/finance/offerings/{listing['id']}/commitments"
    body = request(amount_minor=60_000)
    assert client.post(path, headers=applicant, json=body).status_code == 403
    first = client.post(path, headers=investor, json=body)
    assert first.status_code == 200
    assert client.post(path, headers=investor, json=body).json()["id"] == first.json()["id"]
    assert client.post(path, headers=investor, json={**body, "amount_minor": 50_000}).status_code == 409
    assert client.post(path, headers=investor, json=request(amount_minor=41_000)).status_code == 409
    portfolio = client.get("/api/finance/overview", headers=investor).json()["commitments"]
    assert len(portfolio) == 1 and portfolio[0]["amount_minor"] == 60_000
    assert client.get("/api/finance/overview", headers=applicant).json()["commitments"] == []
    assert client.get("/api/finance/marketplace", headers=reviewer).json()["offerings"][0]["committed_minor"] == 60_000


def test_concurrent_commitments_cannot_overfill_or_duplicate(client, actors):
    reviewer, applicant, investor = actors
    verify_profile(client, reviewer, applicant)
    listing = offering(client, reviewer, applicant, target=10_000)
    path = f"/api/finance/offerings/{listing['id']}/commitments"
    bodies = [request(amount_minor=7000), request(amount_minor=7000)]
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda b: client.post(path, headers=investor, json=b), bodies))
    assert sorted(r.status_code for r in responses) == [200, 409]
    market = client.get("/api/finance/marketplace", headers=investor).json()["offerings"][0]
    assert market["committed_minor"] == 7000 and market["remaining_minor"] == 3000


def test_closed_listing_rejects_new_commitments_but_replays_existing(client, actors):
    reviewer, applicant, investor = actors
    verify_profile(client, reviewer, applicant)
    listing = offering(client, reviewer, applicant)
    path = f"/api/finance/offerings/{listing['id']}/commitments"
    body = request(amount_minor=1000)
    first = client.post(path, headers=investor, json=body).json()
    latest = next(r for r in client.get("/api/finance/reviews", headers=reviewer).json()["records"] if r["id"] == listing["id"])
    decide(client, reviewer, latest, "close")
    assert client.get("/api/finance/marketplace", headers=investor).json()["offerings"] == []
    assert client.post(path, headers=investor, json=request(amount_minor=1000)).status_code == 409
    assert client.post(path, headers=investor, json=body).json()["id"] == first["id"]


def test_workspace_cannot_forge_finance_approvals(client, actors):
    _, applicant, _ = actors
    client.put("/api/state", headers=applicant,
               json={"state": {"finance": {"verified": True, "funding": [{"status": "approved"}]}}, "version": 0})
    assert client.get("/api/finance/overview", headers=applicant).json()["records"] == []
    assert client.post("/api/finance/funding", headers=applicant,
                       json=request(project_id="forged-project", amount_minor=5000)).status_code == 409


def test_platform_offerings_require_owner_and_independent_review(client, actors):
    reviewer, applicant, _ = actors
    body = request(title="Platform opportunity", entity_type="platform",
                   summary="An overall platform sandbox listing; economic rights are not defined or issued.",
                   target_minor=100_000, minimum_minor=1000, term_months=12,
                   profile_url="https://example.com/platform")
    assert client.post("/api/finance/offerings", headers=applicant, json=body).status_code == 403
    response = client.post("/api/finance/offerings", headers=reviewer, json=body)
    assert response.status_code == 200
    assert client.post(f"/api/finance/reviews/{response.json()['id']}", headers=reviewer,
                       json={"version": 1, "action": "approve", "note": "Self-review must remain prohibited for platform cases too."}).status_code == 403


def test_offering_type_and_minimum_match_eligibility(client, actors):
    reviewer, applicant, _ = actors
    verify_profile(client, reviewer, applicant, entity_type="freelancer")
    body = request(title="New opportunity", entity_type="agency",
                   summary="Illustrative use of working capital for a proposed sandbox opportunity.",
                   target_minor=100_000, minimum_minor=1000, term_months=6,
                   profile_url="https://example.com/profile")
    assert client.post("/api/finance/offerings", headers=applicant, json=body).status_code == 409
    assert client.post("/api/finance/offerings", headers=applicant, json={**body, "entity_type": "freelancer", "minimum_minor": 999}).status_code == 422


def test_quote_rounding_and_invalid_status_changes(client, actors):
    reviewer, applicant, _ = actors
    verify_profile(client, reviewer, applicant)
    p = project(client, reviewer, applicant, amount=100_055)
    body = request(project_id=p["id"], amount_minor=70_025)
    r = client.post("/api/finance/funding", headers=applicant, json=body).json()
    assert r["quote"]["fee_minor"] == 1751 and r["quote"]["net_minor"] == 68_274
    assert client.post(f"/api/finance/reviews/{r['id']}", headers=reviewer,
                       json={"version": 1, "action": "simulate_advance", "note": "Cannot skip an approval to simulate an advance."}).status_code == 409
    assert client.post(f"/api/finance/reviews/{r['id']}", headers=reviewer,
                       json={"version": 1, "action": "approve", "note": "ok"}).status_code == 422
