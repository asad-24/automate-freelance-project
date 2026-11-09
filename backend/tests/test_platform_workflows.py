"""Coverage for persisted skill profiles and server-enforced bid rules."""
from conftest import bearer, signup
from app.config import get_settings


def test_skill_profiles_are_per_user(client):
    alice = bearer(signup(client, email="skills-alice@example.com")["token"])
    bob = bearer(signup(client, email="skills-bob@example.com")["token"])
    saved = client.put("/api/radar/profile", headers=alice, json={"skills": ["Python", "Python", " FastAPI "]})
    assert saved.status_code == 200
    assert saved.json()["skills"] == ["Python", "FastAPI"]
    assert client.get("/api/radar/profile", headers=alice).json()["skills"] == ["Python", "FastAPI"]
    assert client.get("/api/radar/profile", headers=bob).json()["skills"] == []


def test_bid_rules_are_user_scoped_and_enforced_before_submission(client):
    alice = bearer(signup(client, email="rules-alice@example.com")["token"])
    bob = bearer(signup(client, email="rules-bob@example.com")["token"])
    saved = client.put("/api/freelancer/bid-rules", headers=alice, json={
        "minimumMatchScore": 80, "minimumBudget": 250, "dailyBidCap": 3,
    })
    assert saved.status_code == 200
    assert client.get("/api/freelancer/bid-rules", headers=bob).json()["dailyBidCap"] == 5

    body = {"projectId": "fl-123", "amount": 100, "proposal": "A sufficiently long approved bid proposal for the project.",
            "approved": True, "matchScore": 90}
    rejected = client.post("/api/freelancer/bid/place", headers=alice, json=body)
    assert rejected.status_code == 422
    assert "minimum budget" in rejected.json()["detail"]


def test_zero_daily_bid_cap_blocks_even_an_approved_bid(client):
    alice = bearer(signup(client, email="rules-cap@example.com")["token"])
    client.put("/api/freelancer/bid-rules", headers=alice, json={"dailyBidCap": 0})
    rejected = client.post("/api/freelancer/bid/place", headers=alice, json={
        "projectId": "fl-123", "amount": 500, "proposal": "A sufficiently long approved bid proposal for the project.",
        "approved": True,
    })
    assert rejected.status_code == 429


def test_inbound_mailbox_is_per_user_and_deduplicates_messages(client, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "inbound_email_domain", "in.example.test")
    monkeypatch.setattr(settings, "inbound_email_webhook_secret", "test-webhook-secret")
    monkeypatch.setattr(settings, "inbound_email_platforms", "Fiverr")
    alice = bearer(signup(client, email="inbox-alice@example.com")["token"])
    bob = bearer(signup(client, email="inbox-bob@example.com")["token"])
    address = client.get("/api/inbox/address", headers=alice).json()["address"]
    assert address and address.endswith("@in.example.test")
    assert client.get("/api/inbox/address", headers=bob).json()["address"] != address

    headers = {"Authorization": "Bearer test-webhook-secret"}
    message = {"To": address, "From": "Client <notifications@fiverr.com>", "Subject": "New message",
               "TextBody": "Please review the project details.", "MessageID": "<inbox-1@example.test>"}
    first = client.post("/api/inbox/inbound", headers=headers, json=message)
    duplicate = client.post("/api/inbox/inbound", headers=headers, json=message)
    assert first.status_code == 200 and first.json()["duplicate"] is False
    assert duplicate.status_code == 200 and duplicate.json()["duplicate"] is True
    conversations = client.get("/api/conversations", headers=alice).json()
    assert len(conversations) == 1 and conversations[0]["channel"] == "Fiverr"
    assert client.get("/api/conversations", headers=bob).json() == []


def test_capability_report_covers_mvp_and_keeps_external_actions_gated(client, monkeypatch):
    user = bearer(signup(client)["token"])
    settings = get_settings()
    monkeypatch.setattr(settings, "inbound_email_domain", "in.example.test")
    monkeypatch.setattr(settings, "inbound_email_webhook_secret", "webhook-secret")
    monkeypatch.setattr(settings, "inbound_email_platforms", "Upwork,Fiverr,Freelancer.com")

    capabilities = client.get("/api/integrations/capabilities", headers=user).json()

    for feature in (
        "unified_inbox",
        "reply_drafts",
        "job_finder",
        "proposal_drafts",
        "review_gated_bidding",
        "gig_drafts",
        "guided_account_setup",
        "inbound_email_alias",
    ):
        assert capabilities["product_features"][feature]["ready"] is True
    for platform in ("Upwork", "Fiverr", "Freelancer.com"):
        assert capabilities["platforms"][platform]["message_read"]["mode"] == "forwarded_email"
        assert capabilities["platforms"][platform]["message_read"]["ready"] is True
        assert capabilities["platforms"][platform]["message_send"]["ready"] is False
    assert capabilities["product_features"]["marketplace_account_creation"]["ready"] is False


def test_forwarded_inbox_readiness_requires_allowlisted_platform(client, monkeypatch):
    user = bearer(signup(client)["token"])
    settings = get_settings()
    monkeypatch.setattr(settings, "inbound_email_domain", "in.example.test")
    monkeypatch.setattr(settings, "inbound_email_webhook_secret", "webhook-secret")
    monkeypatch.setattr(settings, "inbound_email_platforms", "Fiverr")

    capabilities = client.get("/api/integrations/capabilities", headers=user).json()

    assert capabilities["platforms"]["Fiverr"]["message_read"]["ready"] is True
    assert capabilities["platforms"]["Upwork"]["message_read"]["ready"] is False
    assert capabilities["product_features"]["unified_inbox"]["ready"] is True
