"""Job Radar source registry: normalization, approval gates, shared caching,
and contract tests for each source parser against saved response shapes.

Fixtures are trimmed copies of each provider's documented/observed response
shape with synthetic listings. No test touches the network.
"""
import asyncio
import json
import re
from pathlib import Path

import httpx
import pytest

from conftest import bearer, signup
from app import job_sources
from app.config import get_settings

SOURCES = {s.id: s for s in job_sources.SOURCES}


class FakeClient:
    """Answers `client.get(url)` from a {url-prefix: body} map; records calls."""

    def __init__(self, routes: dict[str, object]):
        self.routes = routes
        self.calls: list[str] = []

    async def get(self, url, params=None, headers=None, **kwargs):
        full = str(httpx.URL(url, params=params)) if params else url
        self.calls.append(full)
        for prefix, body in self.routes.items():
            if full.startswith(prefix):
                if isinstance(body, Exception):
                    raise body
                content = body if isinstance(body, (str, bytes)) else json.dumps(body)
                return httpx.Response(200, content=content, request=httpx.Request("GET", full))
        return httpx.Response(404, request=httpx.Request("GET", full))

    async def post(self, url, json=None, **kwargs):
        return await self.get(url)


def fetch(source_id: str, routes: dict, skills=("python",)) -> list[dict]:
    return asyncio.run(SOURCES[source_id].fetch(FakeClient(routes), list(skills)))


def assert_rows(rows: list[dict], source_id: str, minimum: int = 1):
    assert len(rows) >= minimum, rows
    for row in rows:
        assert row["id"].startswith(f"{source_id}-")
        assert row["source"] == SOURCES[source_id].name
        assert row["url"].startswith("https://")
        assert row["title"] and row["company"]
        assert row["kind"] in ("job", "gig")
        assert row["postedAt"] == "" or re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ", row["postedAt"])
        assert row["budget"] is None or row["currency"]


@pytest.fixture(autouse=True)
def fresh_cache():
    job_sources.reset_cache()
    yield
    job_sources.reset_cache()


# --------------------------------------------------------------------------- #
# Helpers and registry rules
# --------------------------------------------------------------------------- #
def test_iso_normalizes_every_date_style_feeds_use():
    assert job_sources.iso(1735689600) == "2025-01-01T00:00:00Z"
    assert job_sources.iso(1735689600000) == "2025-01-01T00:00:00Z"
    assert job_sources.iso("1735689600") == "2025-01-01T00:00:00Z"
    assert job_sources.iso("Wed, 01 Jan 2025 00:00:00 +0000") == "2025-01-01T00:00:00Z"
    assert job_sources.iso("2025-01-01T02:00:00+02:00") == "2025-01-01T00:00:00Z"
    assert job_sources.iso("2025-01-01 00:00:00") == "2025-01-01T00:00:00Z"
    assert job_sources.iso("2025-01-01 00:00:00 UTC") == "2025-01-01T00:00:00Z"
    assert job_sources.iso("not a date") == ""
    assert job_sources.iso(None) == ""


def test_rows_without_a_creditable_https_link_are_dropped():
    source = SOURCES["rok"]
    assert job_sources.job(source, ref=1, title="Role", url="http://insecure.example/job") is None
    assert job_sources.job(source, ref=1, title="", url="https://example.com/job") is None
    row = job_sources.job(source, ref=1, title="<b>Role</b> &amp; more", url="https://example.com/job",
                          budget="1,500", currency="eur")
    assert row["title"] == "Role & more"
    assert row["budget"] == 1500 and row["currency"] == "EUR"


def test_freelance_and_contract_roles_are_classified_as_gigs():
    assert job_sources.is_freelance("Senior Dev (Contract)")
    assert job_sources.is_freelance("full_time", "Freelance")
    assert not job_sources.is_freelance("Full-time Backend Engineer")


def test_source_ids_and_names_are_unique():
    ids = [s.id for s in job_sources.SOURCES] + list(job_sources.BOARD_PROVIDERS)
    names = [s.name for s in job_sources.SOURCES]
    assert len(ids) == len(set(ids))
    assert len(names) == len(set(names))
    assert all(re.fullmatch(r"[a-z0-9]{2,6}", i) for i in ids)


def test_every_source_states_its_reason_and_terms():
    for source in job_sources.SOURCES:
        assert source.reason, source.id
        assert source.terms.startswith("https://"), source.id


def test_gated_and_keyed_sources_are_off_by_default(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "job_sources_approved", "")
    monkeypatch.setattr(settings, "job_sources_disabled", "")
    enabled = {s.id for s in job_sources.enabled_sources(settings)}
    assert {"rok", "wwr"} <= enabled
    assert not {"rdt", "hn", "flx"} & enabled
    for source in job_sources.SOURCES:
        if source.mode == "api":
            assert source.id not in enabled, f"{source.id} needs credentials or approval"


def test_disabled_list_switches_off_a_default_feed(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "job_sources_disabled", "rok, WWR")
    enabled = {s.id for s in job_sources.enabled_sources(settings)}
    assert "rok" not in enabled and "wwr" not in enabled


def test_shared_cache_fetches_once_and_serves_stale_rows_on_failure():
    source = SOURCES["rok"]
    client = FakeClient({"https://remoteok.com/api": [
        {"legal": "notice"},
        {"id": 7, "position": "Python Dev", "company": "Acme", "url": "https://remoteok.com/remote-jobs/7"},
    ]})
    first = asyncio.run(job_sources.fetch_source(source, client, ["python"]))
    again = asyncio.run(job_sources.fetch_source(source, client, ["react"]))
    assert len(client.calls) == 1, "feeds that ignore the query are shared across searches"
    assert first == again and len(first) == 1

    key = source.id
    expiry, rows = job_sources._CACHE[key]
    job_sources._CACHE[key] = (0, rows)  # expire it
    broken = FakeClient({"https://remoteok.com/api": httpx.ConnectError("down")})
    stale = asyncio.run(job_sources.fetch_source(source, broken, ["python"]))
    assert stale == rows
    report = {r["id"]: r for r in job_sources.source_report()}
    assert report["rok"]["health"]["ok"] is False
    assert report["rok"]["health"]["count"] == 1


def test_radar_sources_endpoint_reports_every_source(client):
    token = signup(client)["token"]
    body = client.get("/api/radar/sources", headers=bearer(token)).json()
    ids = {s["id"] for s in body["sources"]}
    assert ids == set(SOURCES) | set(job_sources.BOARD_PROVIDERS)
    assert all({"enabled", "reason", "mode", "terms"} <= set(s) for s in body["sources"])


def test_frontend_matrix_source_ids_exist_in_the_backend_registry():
    matrix = Path(__file__).resolve().parents[2] / "lib" / "platforms.ts"
    if not matrix.exists():
        pytest.skip("frontend checkout not present")
    text = matrix.read_text()
    referenced = set(re.findall(r'sourceId:\s*"([a-z0-9]+)"', text))
    assert referenced, "lib/platforms.ts should link rows to radar sources"
    known = set(SOURCES) | set(job_sources.BOARD_PROVIDERS)
    assert referenced <= known, referenced - known
    platforms = re.findall(r'^\s*\{ id: "([a-z0-9-]+)"', text, flags=re.M)
    assert len(platforms) == len(set(platforms)), "duplicate platform ids"


# --------------------------------------------------------------------------- #
# Contract tests — one per source parser
# --------------------------------------------------------------------------- #
RSS = """<?xml version="1.0"?><rss version="2.0"><channel><title>Jobs</title>
<item><title>Acme: Senior Python Developer</title><link>https://weworkremotely.com/remote-jobs/acme-python</link>
<description>&lt;p&gt;Build APIs&lt;/p&gt;</description><pubDate>Mon, 03 Nov 2025 10:00:00 +0000</pubDate>
<category>Programming</category></item>
<item><title>Beta: Contract React Engineer</title><link>https://weworkremotely.com/remote-jobs/beta-react</link>
<description>6 month contract</description><pubDate>Mon, 03 Nov 2025 09:00:00 +0000</pubDate></item>
</channel></rss>"""


def test_remoteok_contract():
    rows = fetch("rok", {"https://remoteok.com/api": [
        {"last_updated": 1, "legal": "API terms"},
        {"id": "1", "epoch": 1762164000, "position": "Backend Engineer", "company": "Acme",
         "tags": ["python", "aws"], "description": "<p>Hi</p>", "salary_max": 150000,
         "url": "https://remoteok.com/remote-jobs/1"},
    ]})
    assert_rows(rows, "rok")
    assert rows[0]["budget"] == 150000 and rows[0]["tags"] == ["python", "aws"]


def test_weworkremotely_contract():
    rows = fetch("wwr", {"https://weworkremotely.com/": RSS})
    assert_rows(rows, "wwr", minimum=2)
    first = next(r for r in rows if "Python" in r["title"])
    assert first["company"] == "Acme" and first["title"] == "Senior Python Developer"
    assert first["description"] == "Build APIs"
    assert next(r for r in rows if "React" in r["title"])["kind"] == "gig"


def test_reddit_contract(monkeypatch):
    monkeypatch.setattr(get_settings(), "reddit_access_token", "token")
    rows = fetch("rdt", {"https://oauth.reddit.com/": {"data": {"children": [
        {"data": {"id": "a1", "title": "[Hiring] Logo designer", "author": "bob",
                  "permalink": "/r/forhire/comments/a1/x/", "selftext": "Need a logo", "created_utc": 1762164000}},
        {"data": {"id": "a2", "title": "[For Hire] Me", "permalink": "/r/forhire/comments/a2/x/"}},
    ]}}})
    assert_rows(rows, "rdt")
    assert len(rows) == 1 and rows[0]["title"] == "Logo designer" and rows[0]["kind"] == "gig"


def test_hackernews_reads_only_seeking_freelancer_posts_as_gigs():
    rows = fetch("hn", {
        "https://hn.algolia.com/api/v1/search_by_date?tags=story%2Cauthor_whoishiring": {"hits": []},
        "https://hn.algolia.com/api/v1/search_by_date?query=": {"hits": [
            {"objectID": "7", "title": "Ask HN: Freelancer? Seeking freelancer? (November 2026)", "author": "spammer"},
            {"objectID": "8", "title": "Ask HN: Freelancer? Seeking freelancer? (November 2026)", "author": "jon_north"}]},
        "https://hn.algolia.com/api/v1/items/8": {"children": [
            {"id": 81, "author": "acme", "created_at_i": 1762164000,
             "text": "SEEKING FREELANCER | Acme | React dashboard rebuild, 3 months, remote, $90/hr"},
            {"id": 82, "author": "dev", "text": "SEEKING WORK | Remote | Python developer with ten years of experience"}]},
    })
    assert_rows(rows, "hn")
    assert len(rows) == 1 and rows[0]["kind"] == "gig" and rows[0]["title"] == "Acme"


def test_hackernews_contract():
    rows = fetch("hn", {
        "https://hn.algolia.com/api/v1/search_by_date": {"hits": [
            {"objectID": "99", "title": "Ask HN: Who is hiring? (November 2025)"}]},
        "https://hn.algolia.com/api/v1/items/99": {"children": [
            {"id": 100, "author": "acme", "created_at_i": 1762164000,
             "text": "Acme | Senior Rust Engineer | Remote | We build databases and need help."},
            {"id": 101, "text": "short"},
        ]},
    })
    assert_rows(rows, "hn")
    assert len(rows) == 1 and rows[0]["title"].startswith("Acme")


def test_freelancer_contract():
    rows = fetch("flx", {"https://www.freelancer.com/api/projects/0.1/projects/active/": {"result": {"projects": [
        {"id": 5, "title": "Build a Django site", "seo_url": "python/build-django-site",
         "preview_description": "Need Django", "budget": {"minimum": 250, "maximum": 750},
         "currency": {"code": "AUD"}, "jobs": [{"name": "Django"}], "time_submitted": 1762164000},
    ]}}})
    assert_rows(rows, "flx")
    assert rows[0]["budget"] == 750 and rows[0]["currency"] == "AUD" and rows[0]["kind"] == "gig"


# --------------------------------------------------------------------------- #
# Company career boards
# --------------------------------------------------------------------------- #
def board(provider_id: str, slug: str, routes: dict) -> list[dict]:
    provider = job_sources.BOARD_PROVIDERS[provider_id]
    return asyncio.run(provider.build(provider, slug)(FakeClient(routes)))


def assert_board_rows(rows: list[dict], provider_id: str, slug: str):
    assert rows
    for row in rows:
        assert row["id"].startswith(f"{provider_id}-{slug}-")
        assert row["source"] == job_sources.BOARD_PROVIDERS[provider_id].name
        assert row["url"].startswith("https://") and row["title"]


def test_board_providers_are_off_until_their_reuse_review(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "job_sources_approved", "")
    alice = bearer(signup(client, email="boards-gated@example.com")["token"])
    body = client.get("/api/radar/boards", headers=alice).json()
    assert body["providers"] and not any(p["enabled"] for p in body["providers"])
    rejected = client.put("/api/radar/boards", headers=alice, json={"boards": [{"provider": "gh", "slug": "gitlab"}]})
    assert rejected.status_code == 422 and "not enabled" in rejected.json()["detail"]
    assert asyncio.run(job_sources.fetch_board(FakeClient({}), "gh", "gitlab")) == []


def test_watched_boards_are_per_user_and_validated(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "job_sources_approved", "gh,lev")
    alice = bearer(signup(client, email="boards-alice@example.com")["token"])
    bob = bearer(signup(client, email="boards-bob@example.com")["token"])
    saved = client.put("/api/radar/boards", headers=alice, json={"boards": [
        {"provider": "gh", "slug": "gitlab"}, {"provider": "gh", "slug": "gitlab"}, {"provider": "lev", "slug": "acme"}]})
    assert saved.status_code == 200
    assert saved.json()["boards"] == [{"provider": "gh", "slug": "gitlab"}, {"provider": "lev", "slug": "acme"}]
    assert {p["id"] for p in saved.json()["providers"]} == set(job_sources.BOARD_PROVIDERS)
    assert client.get("/api/radar/boards", headers=bob).json()["boards"] == []

    for bad in ({"provider": "gh", "slug": "../admin"}, {"provider": "gh", "slug": "a/b"},
                {"provider": "nope", "slug": "acme"}):
        assert client.put("/api/radar/boards", headers=alice, json={"boards": [bad]}).status_code == 422
    too_many = [{"provider": "gh", "slug": f"co{i}"} for i in range(job_sources.MAX_WATCHED_BOARDS + 1)]
    assert client.put("/api/radar/boards", headers=alice, json={"boards": too_many}).status_code == 422


def test_settings_values_cannot_smuggle_an_invalid_board(client):
    alice = bearer(signup(client, email="boards-smuggle@example.com")["token"])
    client.patch("/api/settings", headers=alice, json={"radarWatchedBoards": [
        {"provider": "gh", "slug": "../../internal"}, {"provider": "gh", "slug": "gitlab"}]})
    assert client.get("/api/radar/boards", headers=alice).json()["boards"] in (
        [], [{"provider": "gh", "slug": "gitlab"}])


def test_greenhouse_contract():
    rows = board("gh", "gitlab", {"https://boards-api.greenhouse.io/v1/boards/gitlab/jobs": {"jobs": [
        {"id": 1, "title": "Backend Engineer", "absolute_url": "https://job-boards.greenhouse.io/gitlab/jobs/1",
         "company_name": "GitLab", "content": "&lt;p&gt;Ruby&lt;/p&gt;", "location": {"name": "Remote"},
         "departments": [{"name": "Engineering"}], "first_published": "2025-10-01T10:00:00-04:00"}]}})
    assert_board_rows(rows, "gh", "gitlab")
    assert rows[0]["description"] == "Ruby" and rows[0]["company"] == "GitLab"
    assert rows[0]["postedAt"] == "2025-10-01T14:00:00Z"


def test_lever_contract():
    rows = board("lev", "acme", {"https://api.lever.co/v0/postings/acme": [
        {"id": "u1", "text": "Contract Designer", "hostedUrl": "https://jobs.lever.co/acme/u1",
         "descriptionPlain": "Figma", "createdAt": 1762164000000,
         "categories": {"location": "Remote", "team": "Design", "commitment": "Contract"},
         "salaryRange": {"min": 50, "max": 90, "currency": "EUR"}}]})
    assert_board_rows(rows, "lev", "acme")
    assert rows[0]["kind"] == "gig" and rows[0]["currency"] == "EUR" and rows[0]["budget"] == 90


def test_ashby_contract_skips_unlisted_postings():
    rows = board("ash", "acme", {"https://api.ashbyhq.com/posting-api/job-board/acme": {"jobs": [
        {"id": "a", "title": "Engineer", "jobUrl": "https://jobs.ashbyhq.com/acme/a", "isListed": True,
         "employmentType": "FullTime", "descriptionPlain": "Go", "publishedAt": "2025-10-01T00:00:00.000+00:00"},
        {"id": "b", "title": "Hidden", "jobUrl": "https://jobs.ashbyhq.com/acme/b", "isListed": False}]}})
    assert_board_rows(rows, "ash", "acme")
    assert [r["title"] for r in rows] == ["Engineer"]


def test_smartrecruiters_contract():
    rows = board("smr", "acme", {"https://api.smartrecruiters.com/v1/companies/acme/postings": {"content": [
        {"id": "744", "name": "Data Engineer", "company": {"name": "Acme Inc"}, "releasedDate": "2025-10-28T15:14:43.941Z",
         "location": {"city": "Berlin"}, "typeOfEmployment": {"label": "Full-time"}}]}})
    assert_board_rows(rows, "smr", "acme")
    assert rows[0]["url"] == "https://jobs.smartrecruiters.com/acme/744"


def test_freelance_classifier_handles_board_vocabulary():
    assert job_sources.is_freelance("Freelancer / indepedent contractor")
    assert job_sources.is_freelance("Freiberufler / selbstständiger")
    assert not job_sources.is_freelance("Indefinite contract (unbefristeter arbeitsvertrag)")
    assert not job_sources.is_freelance("Cdi - contrat à durée indéterminée")


def test_remotive_contract_and_gate(monkeypatch):
    rows = fetch("rmt", {"https://remotive.com/api/remote-jobs": {"0-legal-notice": "...", "jobs": [
        {"id": 1, "url": "https://remotive.com/remote-jobs/dev/1", "title": "Django Dev", "company_name": "Acme",
         "category": "Software Development", "tags": ["python"], "job_type": "freelance",
         "publication_date": "2025-10-29T18:22:41", "description": "<p>Hi</p>"}]}})
    assert_rows(rows, "rmt")
    assert rows[0]["kind"] == "gig" and rows[0]["postedAt"] == "2025-10-29T18:22:41Z"
    # Remotive's terms bar listings shown behind a signup: off until approved.
    settings = get_settings()
    monkeypatch.setattr(settings, "job_sources_approved", "")
    assert not job_sources.is_enabled(SOURCES["rmt"], settings)
    monkeypatch.setattr(settings, "job_sources_approved", "rmt")
    assert job_sources.is_enabled(SOURCES["rmt"], settings)
    assert SOURCES["rmt"].ttl >= 6 * 3600, "Remotive asks for at most 4 calls a day"


def test_arbeitnow_contract_keeps_remote_and_freelance_roles_only():
    rows = fetch("arb", {"https://www.arbeitnow.com/api/job-board-api": {"data": [
        {"slug": "a", "title": "Remote Dev", "company_name": "A", "remote": True, "job_types": ["Full Time"],
         "url": "https://www.arbeitnow.com/jobs/companies/a/a", "tags": [], "location": "Berlin", "created_at": 1762164000},
        {"slug": "b", "title": "Freelance Designer", "company_name": "B", "remote": False,
         "job_types": ["Freelancer / indepedent contractor"], "url": "https://www.arbeitnow.com/jobs/companies/b/b"},
        {"slug": "c", "title": "Onsite Clerk", "company_name": "C", "remote": False, "job_types": ["Full Time"],
         "url": "https://www.arbeitnow.com/jobs/companies/c/c"}]}})
    assert_rows(rows, "arb", minimum=2)
    assert {r["title"]: r["kind"] for r in rows} == {"Remote Dev": "job", "Freelance Designer": "gig"}


def test_jobicy_contract():
    rows = fetch("jcy", {"https://jobicy.com/api/v2/remote-jobs": {"friendlyNotice": "...", "jobs": [
        {"id": 9, "url": "https://jobicy.com/jobs/9-dev", "jobTitle": "Contract Go Dev", "companyName": "Acme",
         "jobIndustry": ["Programming"], "jobType": ["Contract"], "jobGeo": "Anywhere", "jobExcerpt": "Go",
         "salaryMin": 60000, "salaryMax": 80000, "salaryCurrency": "EUR", "pubDate": "2025-11-02T18:05:09+00:00"}]}})
    assert_rows(rows, "jcy")
    assert rows[0]["kind"] == "gig" and rows[0]["budget"] == 80000 and rows[0]["currency"] == "EUR"


def test_himalayas_contract():
    rows = fetch("him", {"https://himalayas.app/jobs/api": {"jobs": [
        {"title": "Planner", "excerpt": "Plan", "companyName": "Micro", "employmentType": "Contractor",
         "minSalary": 30000, "maxSalary": 40000, "currency": "PHP", "parentCategories": ["Marketing"],
         "pubDate": 1762164000, "applicationLink": "https://himalayas.app/companies/micro/jobs/planner"}]}})
    assert_rows(rows, "him")
    assert rows[0]["kind"] == "gig" and rows[0]["currency"] == "PHP"


def test_working_nomads_contract():
    rows = fetch("wn", {"https://www.workingnomads.com/api/exposed_jobs/": [
        {"url": "https://www.workingnomads.com/job/go/1/", "title": "Magento Dev", "company_name": "Lemon.io",
         "category_name": "Development", "tags": "php,magento", "pub_date": "2025-10-29T09:50:51-04:00",
         "description": "<p>PHP</p>"}]})
    assert_rows(rows, "wn")
    assert rows[0]["tags"] == ["Development", "php", "magento"]


def test_the_muse_contract():
    rows = fetch("muse", {"https://www.themuse.com/api/public/jobs": {"results": [
        {"id": 5, "name": "Product Manager", "contents": "<p>PM</p>", "publication_date": "2025-03-06T00:50:37Z",
         "refs": {"landing_page": "https://www.themuse.com/jobs/acme/pm"}, "company": {"name": "Acme"},
         "categories": [{"name": "Product"}], "levels": [{"name": "Senior Level"}]}]}})
    assert_rows(rows, "muse")



def rss(items: str, ns: str = "") -> str:
    return f'<?xml version="1.0"?><rss version="2.0" {ns}><channel><title>x</title>{items}</channel></rss>'


DC = 'xmlns:dc="http://purl.org/dc/elements/1.1/"'


def test_rss_title_styles_split_role_and_company():
    assert job_sources.split_title("Acme: Engineer", ":") == ("Engineer", "Acme")
    assert job_sources.split_title("Backend Engineer, Python, UNICEF", ",") == ("Backend Engineer, Python", "UNICEF")
    assert job_sources.split_title("Designer at Work at Home Co", " at ") == ("Designer at Work", "Home Co")
    assert job_sources.split_title("Just a role", " at ") == ("Just a role", "")


def test_feed_with_bare_ampersands_is_still_parsed():
    body = rss('<item><title>Writer at Acme</title><link>https://www.realworkfromanywhere.com/jobs/w?a=1&b=2</link>'
               '<author>Acme</author><enclosure url="https://cdn.example/logo.png?w=1&h=2"/></item>')
    rows = fetch("rwfa", {"https://www.realworkfromanywhere.com/": body})
    assert_rows(rows, "rwfa")
    assert rows[0]["title"] == "Writer" and rows[0]["company"] == "Acme"


@pytest.mark.parametrize("source_id, prefix, items, ns, expected", [
    ("pyj", "https://www.python.org/", '<item><title>Backend Dev, UNICEF</title>'
     '<link>https://www.python.org/jobs/1/</link><description>Remote</description></item>', "", ("Backend Dev", "UNICEF")),
    ("lara", "https://larajobs.com/", '<item><title>Laravel Dev</title><link>https://larajobs.com/job/1</link>'
     '<job:company>Shout</job:company><job:job_type>CONTRACTOR</job:job_type>'
     '<pubDate>Thu, 29 Oct 2026 15:31:18 +0000</pubDate></item>', 'xmlns:job="https://larajobs.com"', ("Laravel Dev", "Shout")),
    ("auj", "https://authenticjobs.com/", '<item><title>Designer</title><link>https://authenticjobs.com/job/1/x</link>'
     '<dc:creator>poster</dc:creator><job_listing:company>Studio</job_listing:company></item>',
     f'{DC} xmlns:job_listing="https://authenticjobs.com"', ("Designer", "Studio")),
    ("nod", "https://nodesk.co/", '<item><title>Sales Lead at Amadeus</title>'
     '<link>https://nodesk.co/remote-jobs/a/</link></item>', "", ("Sales Lead", "Amadeus")),
    ("pbl", "https://problogger.com/", '<item><title>Script Writer</title><link>https://problogger.com/jobs/job/1/</link>'
     '<category>Freelance</category><category>Blog / Article Writing</category></item>', "", ("Script Writer", None)),
    ("cjl", "https://api.cryptojobslist.com/", '<item><title>Solidity Dev</title>'
     '<link>https://cryptojobslist.com/jobs/1</link><dc:creator>Paxos</dc:creator></item>', DC, ("Solidity Dev", "Paxos")),
    ("drb", "https://dribbble.com/", '<item><title>Acme is hiring a UI Designer</title>'
     '<link>https://dribbble.com/jobs/1?source=feed</link><dc:creator>Acme</dc:creator></item>', DC,
     ("Acme is hiring a UI Designer", "Acme")),
    ("vue", "https://app.vuejobs.com/", '<item><title>Vue Dev</title><link>https://vuejobs.com/jobs/1</link>'
     '<description>&lt;strong&gt;Employer:&lt;/strong&gt; HighLevel&lt;br&gt;Remote</description></item>', "",
     ("Vue Dev", "HighLevel")),
])
def test_rss_board_contracts(source_id, prefix, items, ns, expected):
    rows = fetch(source_id, {prefix: rss(items, ns)})
    assert_rows(rows, source_id)
    title, company = expected
    assert rows[0]["title"] == title
    if company:
        assert rows[0]["company"] == company
    if source_id in ("lara", "pbl"):
        assert rows[0]["kind"] == "gig"


def test_four_day_week_contract_converts_cents():
    rows = fetch("fdw", {"https://4dayweek.io/api/v2/jobs": {"data": [
        {"id": "01a", "title": "Data Analyst", "url": "https://4dayweek.io/job/data-analyst",
         "description": "- Remote", "company": {"name": "Kent"}, "contract_type": "contract",
         "salary_min": 3272200, "salary_max": 3736900, "salary_currency": "GBP",
         "skills": [{"name": "SQL"}], "posted_at": "2026-11-01T00:46:11Z"}]}})
    assert_rows(rows, "fdw")
    assert rows[0]["budget"] == 37369 and rows[0]["currency"] == "GBP" and rows[0]["kind"] == "gig"


def test_himalayas_drops_expired_jobs():
    rows = fetch("him", {"https://himalayas.app/jobs/api": {"jobs": [
        {"title": "Old", "companyName": "A", "applicationLink": "https://himalayas.app/companies/a/jobs/old",
         "expiryDate": 1000},
        {"title": "Live", "companyName": "B", "applicationLink": "https://himalayas.app/companies/b/jobs/live",
         "expiryDate": 4102444800}]}})
    assert [r["title"] for r in rows] == ["Live"]


def test_topcoder_contract():
    rows = fetch("tc", {"https://api.topcoder.com/v6/challenges": [
        {"id": "e68b", "name": "Storefront Design Challenge", "description": "**Design**", "tags": ["Web Design"],
         "skills": [{"name": "UI"}], "overview": {"totalPrizes": 1050, "type": "USD"},
         "registrationStartDate": "2026-10-23T08:30:01.833Z"}]})
    assert_rows(rows, "tc")
    assert rows[0]["url"] == "https://www.topcoder.com/challenges/e68b" and rows[0]["budget"] == 1050


def test_web3_career_finds_the_nested_job_list():
    rows = fetch("w3c", {"https://web3.career/api/v1": ["notice", "terms", [
        {"id": 1, "title": "Rust Engineer", "company": "Chain", "apply_url": "https://web3.career/rust-engineer-chain/1",
         "tags": ["rust"], "date_epoch": 1762164000}]]})
    assert_rows(rows, "w3c")


def test_usajobs_contract():
    rows = fetch("usaj", {"https://data.usajobs.gov/api/Search": {"SearchResult": {"SearchResultItems": [
        {"MatchedObjectId": "123", "MatchedObjectDescriptor": {
            "PositionTitle": "IT Specialist", "PositionURI": "https://www.usajobs.gov/job/123",
            "OrganizationName": "GSA", "UserArea": {"Details": {"JobSummary": "Cloud work"}},
            "JobCategory": [{"Name": "Information Technology"}],
            "PositionRemuneration": [{"MinimumRange": "90000", "MaximumRange": "120000"}],
            "PublicationStartDate": "2026-10-30T00:00:00"}}]}}})
    assert_rows(rows, "usaj")
    assert rows[0]["budget"] == 120000 and rows[0]["company"] == "GSA"


def test_adzuna_contract_hides_predicted_salaries():
    rows = fetch("adz", {"https://api.adzuna.com/v1/api/jobs/": {"results": [
        {"id": "1", "title": "Python Contractor", "redirect_url": "https://www.adzuna.com/details/1",
         "company": {"display_name": "Acme"}, "description": "Snippet", "category": {"label": "IT Jobs"},
         "contract_type": "contract", "salary_max": 90000, "salary_is_predicted": "1", "created": "2026-10-30T10:00:00Z"}]}})
    assert_rows(rows, "adz")
    assert rows[0]["budget"] is None and rows[0]["kind"] == "gig"


def test_jooble_reed_findwork_contracts():
    jooble = fetch("jbl", {"https://jooble.org/api/": {"jobs": [
        {"id": 5, "title": "Freelance Copywriter", "link": "https://jooble.org/desc/5", "company": "Acme",
         "snippet": "Write", "type": "Freelance", "updated": "2026-10-30T10:00:00.0000000"}]}})
    assert_rows(jooble, "jbl")
    assert jooble[0]["kind"] == "gig"
    reed = fetch("reed", {"https://www.reed.co.uk/api/1.0/search": {"results": [
        {"jobId": 9, "jobTitle": "Contract Developer", "jobUrl": "https://www.reed.co.uk/jobs/contract-developer/9",
         "employerName": "Acme", "jobDescription": "Go", "maximumSalary": 500, "currency": "GBP", "date": "30/10/2026"}]}})
    assert_rows(reed, "reed")
    assert reed[0]["postedAt"] == "2026-10-30T00:00:00Z" and reed[0]["currency"] == "GBP"
    findwork = fetch("fw", {"https://findwork.dev/api/jobs/": {"results": [
        {"id": 3, "role": "Django Dev", "url": "https://findwork.dev/3/django-dev", "company_name": "Acme",
         "text": "Django", "keywords": ["django"], "employment_type": "contract", "date_posted": "2026-10-30T10:00:00Z"}]}})
    assert_rows(findwork, "fw")


def test_workable_and_recruitee_board_contracts():
    rows = board("wkb", "huggingface", {"https://apply.workable.com/api/v1/widget/accounts/huggingface": {
        "name": "Hugging Face", "jobs": [{"title": "ML Engineer", "shortcode": "81B4", "employment_type": "Contract",
                                          "url": "https://apply.workable.com/j/81B4", "published_on": "2026-05-29"}]}})
    assert_board_rows(rows, "wkb", "huggingface")
    assert rows[0]["company"] == "Hugging Face" and rows[0]["kind"] == "gig"
    rows = board("rct", "acme", {"https://acme.recruitee.com/api/offers/": {"offers": [
        {"id": 1, "title": "Designer", "careers_url": "https://acme.recruitee.com/o/designer",
         "salary": {"min": 40, "max": 60, "currency": "EUR"}, "published_at": "2026-10-01 10:00:00 UTC"}]}})
    assert_board_rows(rows, "rct", "acme")
    assert rows[0]["postedAt"] == "2026-10-01T10:00:00Z"
    assert not job_sources.BOARD_PROVIDERS["rct"].valid("acme.evil.com")


def test_documented_notification_senders_map_to_platforms():
    from app.routers.inbox import _link, _platform
    assert _platform("Lancers <no-reply@lancers.jp>") == "Lancers"
    assert _platform("FlexJobs <alerts@mail.flexjobs.com>") == "FlexJobs"
    assert _platform("team@bark.com") == "Bark"
    assert _platform("someone@notbark.com") is None
    assert _link("Bark", "no links here") == "https://www.bark.com/"
    assert _link("Fiverr", "see https://www.fiverr.com/inbox/abc") == "https://www.fiverr.com/inbox/abc"


def test_blank_switches_from_hosting_dashboards_fall_back_to_defaults(monkeypatch):
    """Render prompts for every `sync: false` key; a value left blank must not
    crash startup or flip an approval on."""
    from app.config import Settings
    for name in ("HN_COMMERCIAL_REUSE_APPROVED", "REDDIT_COMMERCIAL_APPROVED", "FREELANCER_API_APPROVED",
                 "FREELANCER_SANDBOX", "SMTP_PORT"):
        monkeypatch.setenv(name, "")
    settings = Settings()
    assert settings.hn_commercial_reuse_approved is False
    assert settings.reddit_commercial_approved is False
    assert settings.freelancer_api_approved is False
    assert settings.freelancer_sandbox is True
    assert settings.smtp_port == 587
