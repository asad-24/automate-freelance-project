"""Pure unit coverage for inbound email normalization and deduplication."""
import asyncio
import pytest

from app import repo, db
from app.routers.inbox import InboundEmail, _platform, _plain


@pytest.fixture(autouse=True)
def memory_only(monkeypatch):
    # These are pure unit tests that use multiple asyncio.run loops. MongoDB
    # behavior is covered by TestClient integration tests on one owned loop.
    monkeypatch.setattr(db, "enabled", lambda: False)
    repo.reset_memory()


def test_postmark_payload_aliases_and_html_normalization():
    email = InboundEmail.model_validate({
        "To": "u-exampletoken1234567890@in.example.com",
        "From": "Taylor <notifications@fiverr.com>",
        "Subject": "New message",
        "TextBody": "",
        "HtmlBody": "<p>Hello&nbsp;there</p>",
        "MessageID": "<message-123@example.com>",
    })
    assert email.message_id == "<message-123@example.com>"
    assert _plain(email.text_body, email.html_body) == "Hello there"
    assert _platform(email.from_email) == "Fiverr"
    assert _platform("notice@notfiverr.com") is None


def test_per_user_message_deduplication():
    repo.reset_memory()
    fields = {"platform": "Upwork", "thread_ref": "thread-1", "sender": "Client",
              "preview": "Hello", "body": "Hello", "deep_link": "https://upwork.com", "unread": True}

    async def add_twice():
        first = await repo.add_message("user-a", fields, "mail-id-1")
        duplicate = await repo.add_message("user-a", fields, "mail-id-1")
        other_user = await repo.add_message("user-b", fields, "mail-id-1")
        return first, duplicate, other_user

    first, duplicate, other_user = asyncio.run(add_twice())
    assert first and duplicate is None and other_user
    assert len(asyncio.run(repo.list_for("messages", "user-a"))) == 1
    assert len(asyncio.run(repo.list_for("messages", "user-b"))) == 1


def test_daily_bid_slots_are_atomic_and_user_scoped():
    repo.reset_memory()

    async def reserve_many():
        results = await asyncio.gather(*[
            repo.reserve_daily_bid_slot("user-a", "2026-11-01", 3) for _ in range(12)
        ])
        other = await repo.reserve_daily_bid_slot("user-b", "2026-11-01", 3)
        return results, other

    results, other = asyncio.run(reserve_many())
    assert sum(results) == 3
    assert other is True
