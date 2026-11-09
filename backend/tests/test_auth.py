import hashlib

import pytest

from app import auth, db
from app.config import Settings
from conftest import bearer, run, signup, owner as provision_owner


# --- Signup / login ----------------------------------------------------------
def test_signup_returns_session_and_hashes_with_argon2(client):
    data = signup(client, name="Ada", company="Ada Agency")
    assert data["token"]
    assert data["user"]["email"] == "agency@example.com"
    assert data["user"]["role"] == "admin"
    assert data["user"]["owner"] is False
    assert run(client, db.find_user, "agency@example.com")["password_hash"].startswith("$argon2")


@pytest.mark.parametrize("payload, detail", [
    ({"email": "not-an-email", "password": "long-enough"}, "valid email"),
    ({"email": "a@example.com", "password": "short"}, "at least 8"),
    ({"email": "a@example.com", "password": "long-enough", "role": "superuser"}, "account type"),
])
def test_signup_rejects_bad_input(client, payload, detail):
    res = client.post("/api/auth/signup", json=payload)
    assert res.status_code == 422
    assert detail in res.json()["detail"]


def test_signup_rejects_duplicate_email(client):
    signup(client)
    res = client.post("/api/auth/signup", json={"email": "AGENCY@example.com", "password": "another-pass"})
    assert res.status_code == 409


def test_login_with_correct_and_wrong_password(client):
    signup(client)
    ok = client.post("/api/auth/login", json={"email": "agency@example.com", "password": "correct-horse"})
    assert ok.status_code == 200 and ok.json()["token"]
    bad = client.post("/api/auth/login", json={"email": "agency@example.com", "password": "wrong-pass"})
    assert bad.status_code == 401


def test_unknown_email_gets_same_error_as_wrong_password(client):
    res = client.post("/api/auth/login", json={"email": "nobody@example.com", "password": "whatever-123"})
    assert res.status_code == 401
    assert res.json()["detail"] == "Invalid email or password."


def test_old_demo_logins_no_longer_work(client):
    for email, password in (("demo@autopilot.ai", "password"), ("agent@autopilot.ai", "demo1234")):
        res = client.post("/api/auth/login", json={"email": email, "password": password})
        assert res.status_code == 401


def test_login_enforces_account_role(client):
    signup(client, role="client")
    res = client.post("/api/auth/login", json={"email": "agency@example.com", "password": "correct-horse", "role": "admin"})
    assert res.status_code == 403


def test_login_is_throttled_after_repeated_failures(client):
    signup(client)
    for _ in range(5):
        client.post("/api/auth/login", json={"email": "agency@example.com", "password": "wrong-pass"})
    res = client.post("/api/auth/login", json={"email": "agency@example.com", "password": "correct-horse"})
    assert res.status_code == 429


def test_legacy_sha256_password_still_works_and_is_upgraded(client):
    salt = "abc123"
    legacy = {
        "_id": "legacy@example.com", "id": "u-legacy", "name": "Legacy", "email": "legacy@example.com",
        "role": "admin", "company": "", "salt": salt,
        "password_hash": hashlib.sha256(f"{salt}.old-password".encode()).hexdigest(),
    }

    async def insert_legacy_user():
        if db.enabled():
            await db._get_db().users.insert_one(legacy)
        else:
            db._mem_users[legacy["_id"]] = legacy

    run(client, insert_legacy_user)
    res = client.post("/api/auth/login", json={"email": "legacy@example.com", "password": "old-password"})
    assert res.status_code == 200
    upgraded = run(client, db.find_user, "legacy@example.com")
    assert upgraded["password_hash"].startswith("$argon2")
    assert "salt" not in upgraded
    again = client.post("/api/auth/login", json={"email": "legacy@example.com", "password": "old-password"})
    assert again.status_code == 200


# --- Sessions ----------------------------------------------------------------
def test_me_returns_current_user(client):
    token = signup(client)["token"]
    res = client.get("/api/auth/me", headers=bearer(token))
    assert res.status_code == 200
    assert res.json()["user"]["email"] == "agency@example.com"


@pytest.mark.parametrize("headers", [
    {},
    {"Authorization": "Bearer not-a-real-token"},
    {"Authorization": "Basic abc"},
])
def test_protected_routes_reject_missing_or_bad_tokens(client, headers):
    assert client.get("/api/automation/jobs", headers=headers).status_code == 401
    assert client.get("/api/notifications", headers=headers).status_code == 401
    assert client.get("/api/auth/me", headers=headers).status_code == 401


def test_expired_token_is_rejected(client, monkeypatch):
    monkeypatch.setattr(auth.get_settings(), "access_token_expire_minutes", -1)
    token = signup(client)["token"]
    res = client.get("/api/notifications", headers=bearer(token))
    assert res.status_code == 401
    assert "expired" in res.json()["detail"]


def test_token_signed_with_another_key_is_rejected(client):
    import jwt
    forged = jwt.encode({"sub": "u-x", "email": "owner@example.com", "role": "admin", "exp": 9999999999},
                        "some-other-secret-that-is-long-enough!!", algorithm="HS256")
    assert client.get("/api/notifications", headers=bearer(forged)).status_code == 401


# --- Public routes -----------------------------------------------------------
def test_public_routes_work_without_a_token(client):
    assert client.get("/health").status_code == 200
    assert client.get("/api/plans").status_code == 200
    res = client.post("/api/beta-testers", json={"name": "Bea", "email": "bea@example.com"})
    assert res.status_code == 200


# --- Roles -------------------------------------------------------------------
def test_admin_routes_reject_other_roles(client):
    token = signup(client, email="free@example.com", role="freelancer")["token"]
    assert client.get("/api/automation/jobs", headers=bearer(token)).status_code == 403
    assert client.get("/api/upwork/status", headers=bearer(token)).status_code == 403


def test_job_radar_is_per_user_for_every_role_but_never_anonymous(client):
    # main.py mounts the radar with the per-user routers: every signed-in role
    # can scan (results and saved items are scoped to the caller), nobody else.
    token = signup(client, email="radar-free@example.com", role="freelancer")["token"]
    assert client.get("/api/radar/jobs", headers=bearer(token)).status_code == 200
    assert client.get("/api/radar/jobs").status_code == 401


@pytest.mark.parametrize("method, path", [
    ("get", "/api/kpis"),
    ("get", "/api/freelancer/specs"),
    ("get", "/api/credentials"),
    ("get", "/api/users"),
    ("post", "/api/demo/reset"),
    ("get", "/api/meta"),
])
def test_demo_data_routes_are_not_served_without_seed_demo_data(client, method, path):
    owner = provision_owner(client)["token"]
    assert getattr(client, method)(path, headers=bearer(owner)).status_code == 404


def test_shared_routes_work_for_every_role(client):
    for i, role in enumerate(("admin", "freelancer", "client")):
        token = signup(client, email=f"user{i}@example.com", role=role)["token"]
        assert client.get("/api/notifications", headers=bearer(token)).status_code == 200


@pytest.mark.parametrize("method, path, body", [
    ("get", "/api/beta-testers", None),
    ("post", "/api/email/test", {"to": "x@example.com"}),
    ("post", "/api/growth/campaigns/send", {"subject": "s", "body": "b", "recipients": []}),
])
def test_owner_only_routes(client, method, path, body):
    agency = signup(client)["token"]
    owner = provision_owner(client)["token"]
    kwargs = {"json": body} if body is not None else {}
    assert getattr(client, method)(path, headers=bearer(agency), **kwargs).status_code == 403
    assert getattr(client, method)(path, headers=bearer(owner), **kwargs).status_code != 403


def test_owner_flag_in_session(client):
    assert signup(client, email="owner@example.com")["user"]["owner"] is False


# --- Production settings -----------------------------------------------------
@pytest.mark.parametrize("secret", ["dev-secret", "change-me-in-production", "too-short"])
def test_production_refuses_weak_secret(secret):
    with pytest.raises(RuntimeError):
        Settings(environment="production", secret_key=secret).validate_for_production()


def test_production_accepts_strong_secret():
    Settings(environment="production", secret_key="x" * 48).validate_for_production()
