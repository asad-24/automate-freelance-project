"""MongoDB-only behaviour — skipped unless TEST_MONGODB_URI is set."""
import pytest
from fastapi.testclient import TestClient
from pymongo import MongoClient

from app import db
from app.main import app
from conftest import TEST_DB, TEST_MONGODB_URI

pytestmark = pytest.mark.skipif(not TEST_MONGODB_URI, reason="needs TEST_MONGODB_URI")


@pytest.fixture
def mongo():
    client = MongoClient(TEST_MONGODB_URI)
    client.drop_database(TEST_DB)
    db._client = db._db = None
    yield client[TEST_DB]
    client.drop_database(TEST_DB)


def test_legacy_shared_state_is_backed_up_not_lost(mongo):
    mongo.app_state.insert_one({"_id": "state", "data": {
        "kpis": {"liveMargin": 1},
        "beta_testers": [{"id": "bt-1", "email": "Bea@Example.com", "name": "Bea"}],
    }})
    with TestClient(app):
        pass
    assert mongo.app_state.count_documents({}) == 0
    backups = list(mongo.app_state_backup.find())
    assert len(backups) == 1 and backups[0]["data"]["kpis"] == {"liveMargin": 1}
    assert mongo.beta_testers.find_one({"_id": "bea@example.com"})["name"] == "Bea"

    db._client = db._db = None
    with TestClient(app):  # second boot: nothing left to archive
        pass
    assert mongo.app_state_backup.count_documents({}) == 1


def test_notifications_and_activity_expire(mongo):
    with TestClient(app):
        pass
    for coll, days in (("notifications", 90), ("activity", 180)):
        ttl = [i for i in mongo[coll].list_indexes() if "expireAfterSeconds" in i]
        assert len(ttl) == 1 and ttl[0]["expireAfterSeconds"] == days * 86400
