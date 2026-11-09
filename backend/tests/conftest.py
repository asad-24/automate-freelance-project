"""Test setup — isolates the app from real services.

Environment variables override backend/.env, so tests never touch the real
MongoDB, Groq or email provider even when a developer's .env has them set.

By default storage is in memory. To run the same suite against a real MongoDB
(a throwaway one — the test database is dropped before every test):
    TEST_MONGODB_URI=mongodb://localhost:27017 pytest
"""
import os

TEST_MONGODB_URI = os.environ.get("TEST_MONGODB_URI", "")
TEST_DB = "autopilot_test"

os.environ.update({
    "ENVIRONMENT": "test",
    "SECRET_KEY": "test-secret-key-that-is-at-least-32-characters",
    "OWNER_EMAILS": "owner@example.com",
    "MONGODB_URI": TEST_MONGODB_URI,
    "MONGODB_DB": TEST_DB,
    "GROQ_API_KEY": "",
    "RESEND_API_KEY": "",
    "SMTP_HOST": "",
    "API_KEY": "",
    "WORKER_URL": "",
    "WORKER_KEY": "",
    "SEED_DEMO_DATA": "false",
    "FREELANCER_OAUTH_TOKEN": "",
    "UPWORK_ACCESS_TOKEN": "",
})

import httpx  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import auth, db, repo, finance_store  # noqa: E402
from app.security import _hits  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(autouse=True)
def no_outbound_http(monkeypatch):
    """The app's outbound calls (job feeds, Freelancer.com, Upwork, webhooks,
    the worker) all use httpx.AsyncClient — fail them loudly in tests."""
    async def blocked(self, request, **kwargs):
        raise RuntimeError(f"Outbound HTTP in a test: {request.url}")
    monkeypatch.setattr(httpx.AsyncClient, "send", blocked)


@pytest.fixture
def client():
    db._mem_users.clear()
    repo.reset_memory()
    finance_store.reset_memory()
    auth._failures.clear()
    _hits.clear()
    if TEST_MONGODB_URI:
        from pymongo import MongoClient
        MongoClient(TEST_MONGODB_URI).drop_database(TEST_DB)
        # Motor clients are bound to an event loop; each TestClient has its own.
        db._client = db._db = None
    with TestClient(app) as c:
        yield c


def signup(client, email="agency@example.com", password="correct-horse", role="admin", **extra):
    res = client.post("/api/auth/signup", json={"email": email, "password": password, "role": role, **extra})
    assert res.status_code == 200, res.text
    return res.json()


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def owner(client, email="owner@example.com", **extra):
    """Explicit test-only provisioning; claiming this email in signup is insufficient."""
    signup(client, email=email, **extra)
    assert run(client, db.set_platform_owner, email, True)
    response = client.post("/api/auth/login", json={"email": email, "password": "correct-horse"})
    assert response.status_code == 200
    return response.json()


def run(client, fn, *args):
    """Call an async app function (repo/db) on the app's own event loop."""
    return client.portal.call(fn, *args)
