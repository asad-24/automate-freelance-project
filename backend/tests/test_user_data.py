"""Per-user data: isolation between accounts, server-owned credits, and the
safety rules on actions that leave the platform."""
import json

import httpx
import pytest

from app import repo
from app.routers import activity
from app.config import get_settings
from conftest import bearer, run, signup, owner as provision_owner


@pytest.fixture
def two_users(client):
    a = signup(client, email="alice@example.com")
    b = signup(client, email="bob@example.com")
    return bearer(a["token"]), bearer(b["token"]), a["user"]["id"]


# --- Workspace ---------------------------------------------------------------
def test_workspace_is_private_to_each_user(client, two_users):
    alice, bob, _ = two_users
    res = client.put("/api/state", headers=alice, json={"state": {"accounts": [{"platform": "Upwork"}]}, "version": 0})
    assert res.json() == {"version": 1}
    assert client.get("/api/state", headers=bob).json() == {"state": {}, "version": 0}
    assert client.get("/api/accounts", headers=alice).json() == [{"platform": "Upwork"}]
    assert client.get("/api/accounts", headers=bob).json() == []


def test_stale_save_from_another_tab_is_rejected(client, two_users):
    alice, _, _ = two_users
    client.put("/api/state", headers=alice, json={"state": {"gigs": [{"title": "first"}]}, "version": 0})
    stale = client.put("/api/state", headers=alice, json={"state": {"gigs": []}, "version": 0})
    assert stale.status_code == 409
    assert stale.json()["version"] == 1
    assert stale.json()["state"]["gigs"] == [{"title": "first"}]


def test_browser_cannot_write_credits_through_the_workspace(client, two_users):
    alice, _, _ = two_users
    client.put("/api/state", headers=alice, json={
        "state": {"monetization": {"plan": "pro", "bidCredits": 999}, "billingHistory": [{"x": 1}]}, "version": 0,
    })
    assert "monetization" not in client.get("/api/state", headers=alice).json()["state"]
    billing = client.get("/api/user-monetization", headers=alice).json()
    assert billing["plan"] == "free" and billing["bidCredits"] == 10


def test_oversized_workspace_is_rejected(client, two_users):
    alice, _, _ = two_users
    res = client.put("/api/state", headers=alice, json={"state": {"blob": "x" * 1_100_000}, "version": 0})
    assert res.status_code == 413


# --- Billing -----------------------------------------------------------------
def test_profile_credits_are_spent_on_the_server(client, two_users):
    alice, bob, _ = two_users
    for remaining in (1, 0):
        res = client.post("/api/billing/spend", headers=alice, json={"kind": "profile"})
        assert res.status_code == 200
        assert res.json()["monetization"]["profileCredits"] == remaining
    assert client.post("/api/billing/spend", headers=alice, json={"kind": "profile"}).status_code == 402
    assert client.get("/api/user-monetization", headers=bob).json()["profileCredits"] == 2


def test_browser_cannot_spend_bid_credits_directly(client, two_users):
    alice, _, _ = two_users
    assert client.post("/api/billing/spend", headers=alice, json={"kind": "bid"}).status_code == 422


def test_purchases_are_recorded_as_simulated(client, two_users):
    alice, _, _ = two_users
    res = client.post("/api/billing/credits", headers=alice, json={"kind": "profiles"})
    assert res.json()["monetization"]["profileCredits"] == 3
    assert res.json()["purchase"]["status"] == "Simulated"
    assert client.get("/api/billing-history", headers=alice).json()[0]["item"] == "1 Platform Profile"


def test_pro_plan_has_unlimited_credits(client, two_users):
    alice, _, _ = two_users
    client.post("/api/billing/upgrade", headers=alice)
    for _ in range(5):
        res = client.post("/api/billing/spend", headers=alice, json={"kind": "profile"})
        assert res.status_code == 200 and res.json()["monetization"]["plan"] == "pro"


# --- Activity, notifications, settings --------------------------------------
def test_audit_log_only_shows_your_own_activity(client, two_users):
    alice, bob, _ = two_users
    client.patch("/api/settings", headers=alice, json={"matchThreshold": 90})
    alice_log = [e["action"] for e in client.get("/api/audit-log", headers=alice).json()]
    bob_log = [e["action"] for e in client.get("/api/audit-log", headers=bob).json()]
    assert "Settings updated" in alice_log
    assert "Settings updated" not in bob_log


def test_notifications_are_per_user(client, two_users):
    alice, bob, _ = two_users
    job = client.post("/api/automation/jobs", headers=alice, json={"kind": "post_gig", "title": "Gig"}).json()
    client.post(f"/api/automation/jobs/{job['id']}/approve", headers=alice)
    alice_notes = client.get("/api/notifications", headers=alice).json()
    assert len(alice_notes) == 1 and "simulation" in alice_notes[0]["body"]
    assert client.get("/api/notifications", headers=bob).json() == []
    assert client.post(f"/api/notifications/{alice_notes[0]['id']}/read", headers=bob).status_code == 404
    client.post("/api/notifications/read-all", headers=bob)
    assert client.get("/api/notifications", headers=alice).json()[0]["read"] is False


def test_settings_are_per_user(client, two_users):
    alice, bob, _ = two_users
    assert client.patch("/api/settings", headers=alice, json={"matchThreshold": 95}).json()["matchThreshold"] == 95
    assert client.get("/api/settings", headers=bob).json()["matchThreshold"] == 80


@pytest.mark.parametrize("body", [
    {"values.plan": "pro"},
    {"$set": 1},
    {"salesWebhook": "http://example.com/hook"},
])
def test_settings_reject_unsafe_input(client, two_users, body):
    alice, _, _ = two_users
    assert client.patch("/api/settings", headers=alice, json=body).status_code == 422


@pytest.mark.parametrize("url", ["https://127.0.0.1/hook", "https://localhost/hook", "https://10.0.0.5/hook"])
def test_sales_webhook_cannot_target_internal_addresses(client, two_users, url):
    alice, _, _ = two_users
    client.patch("/api/settings", headers=alice, json={"salesWebhook": url})
    res = client.post("/api/sales/alert", headers=alice, json={"event": "test"})
    assert res.json()["delivered"] is False
    assert "public internet address" in res.json()["reason"]


def test_purchase_pings_only_the_buyers_sales_webhook(client, monkeypatch, two_users):
    alice, bob, _ = two_users
    sent = []

    async def record(self, request, **kwargs):
        sent.append(json.loads(request.content))
        return httpx.Response(200, request=request)

    monkeypatch.setattr(httpx.AsyncClient, "send", record)
    monkeypatch.setattr(activity, "_public_webhook_error", lambda url: None)
    client.patch("/api/settings", headers=alice, json={"salesWebhook": "https://hooks.example.com/sale"})
    client.post("/api/billing/credits", headers=alice, json={"kind": "bids"})
    client.post("/api/billing/credits", headers=bob, json={"kind": "bids"})
    assert len(sent) == 1
    assert sent[0]["event"] == "purchase" and "simulated" in sent[0]["label"]


# --- Automation --------------------------------------------------------------
def test_automation_jobs_are_private_and_approve_once(client, two_users):
    alice, bob, _ = two_users
    job = client.post("/api/automation/jobs", headers=alice, json={"kind": "auto_apply", "title": "Apply"}).json()
    assert job["status"] == "needs_approval" and job["engine"] == "simulation"
    assert client.get("/api/automation/jobs", headers=bob).json() == []
    assert client.post(f"/api/automation/jobs/{job['id']}/approve", headers=bob).status_code == 404

    first = client.post(f"/api/automation/jobs/{job['id']}/approve", headers=alice)
    assert first.status_code == 200 and first.json()["status"] == "completed"
    assert client.post(f"/api/automation/jobs/{job['id']}/approve", headers=alice).status_code == 409
    assert client.post(f"/api/automation/jobs/{job['id']}/cancel", headers=alice).status_code == 409


def test_simulated_jobs_never_spend_credits(client, two_users):
    alice, _, _ = two_users
    job = client.post("/api/automation/jobs", headers=alice, json={"kind": "auto_apply"}).json()
    client.post(f"/api/automation/jobs/{job['id']}/approve", headers=alice)
    assert client.get("/api/user-monetization", headers=alice).json()["bidCredits"] == 10


def test_shared_worker_is_owner_only(client, monkeypatch, two_users):
    alice, _, _ = two_users
    monkeypatch.setattr(get_settings(), "worker_url", "https://worker.example.com")
    monkeypatch.setattr(get_settings(), "worker_key", "k")
    status = client.get("/api/automation/status", headers=alice).json()
    assert status["engine"] == "simulation" and status["workerConfigured"] is False


# --- Platform connectors -----------------------------------------------------
def test_sandbox_bid_is_free_and_marked_not_sent(client, two_users):
    alice, _, _ = two_users
    res = client.post("/api/freelancer/bid/place", headers=alice, json={
        "projectId": "fl-1", "amount": 100, "proposal": "x" * 40, "approved": True,
    })
    assert res.json()["live"] is False
    assert client.get("/api/user-monetization", headers=alice).json()["bidCredits"] == 10


def test_real_bids_on_the_shared_token_are_owner_only(client, monkeypatch, two_users):
    alice, _, _ = two_users
    monkeypatch.setattr(get_settings(), "freelancer_oauth_token", "platform-token")
    monkeypatch.setattr(get_settings(), "freelancer_api_approved", True)
    res = client.post("/api/freelancer/bid/place", headers=alice, json={
        "projectId": "fl-1", "amount": 100, "proposal": "x" * 40, "approved": True,
    })
    assert res.status_code == 403


def test_real_bid_needs_a_bid_credit(client, monkeypatch):
    owner = provision_owner(client)
    for _ in range(repo.DEFAULT_BILLING["bidCredits"]):
        run(client, repo.spend_credit, owner["user"]["id"], "bid")
    monkeypatch.setattr(get_settings(), "freelancer_oauth_token", "platform-token")
    monkeypatch.setattr(get_settings(), "freelancer_api_approved", True)
    res = client.post("/api/freelancer/bid/place", headers=bearer(owner["token"]), json={
        "projectId": "fl-1", "amount": 100, "proposal": "x" * 40, "approved": True,
    })
    assert res.status_code == 402


def test_upwork_submit_never_claims_a_send_it_did_not_make(client, two_users):
    alice, _, _ = two_users
    body = {"jobId": "uw-1", "proposal": "x" * 40, "rate": 50, "approved": True}
    # Live submission isn't implemented: the API says so instead of reporting a send.
    res = client.post("/api/upwork/proposal/submit", headers=alice, json=body)
    assert res.status_code == 501
    assert "submit it on Upwork" in res.json()["detail"]
    assert "ok" not in res.json()
    # Human approval is still checked first.
    unapproved = client.post("/api/upwork/proposal/submit", headers=alice, json={**body, "approved": False})
    assert unapproved.status_code == 422


# --- Beta testers ------------------------------------------------------------
def test_beta_signups_are_stored_for_owners(client):
    assert client.post("/api/beta-testers", json={"name": "Bea", "email": "bea@example.com"}).status_code == 200
    assert client.post("/api/beta-testers", json={"name": "Bea", "email": "BEA@example.com"}).status_code == 409
    owner = provision_owner(client)["token"]
    testers = client.get("/api/beta-testers", headers=bearer(owner)).json()
    assert [t["email"] for t in testers] == ["bea@example.com"]
