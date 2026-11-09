"""Job Radar source registry — every public feed or official API the radar reads.

Only sources whose operators publish an API or feed for reuse are listed here;
nothing scrapes HTML pages. Each result keeps the source name and the original
listing URL so the UI can credit and link back, which every feed below asks for.

A source declares:
  - how it is fetched (one coroutine returning normalized rows),
  - its approval gate (public feeds run by default, feeds whose reuse terms are
    unclear wait for JOB_SOURCES_APPROVED, keyed APIs wait for credentials),
  - how long one fetch is reused across ALL users (`ttl`), so adding sources
    never multiplies traffic per user or per saved search.

Any source can be switched off with JOB_SOURCES_DISABLED=<id>,<id>.
Research and terms for every source live in docs/platform-matrix.md.
"""
import asyncio
import hashlib
import html
import logging
import re
import time
import xml.etree.ElementTree as ET
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

import httpx

from .config import Settings, get_settings

log = logging.getLogger("autopilot.job_sources")

UA = "AutopilotJobRadar/1.0 (+https://autopilotv2.vercel.app)"
_STRIP = re.compile(r"<[^>]+>")
_SOURCE_TIMEOUT = 20  # seconds one source may take, retries included
_FAILURE_TTL = 300    # back off this long after a source fails

Fetcher = Callable[[httpx.AsyncClient, list[str]], Awaitable[list[dict]]]


# --------------------------------------------------------------------------- #
# Shared helpers
# --------------------------------------------------------------------------- #
async def get_with_retry(client: httpx.AsyncClient, url: str, **kwargs) -> httpx.Response:
    """Retry transient feed errors with bounded exponential backoff."""
    for attempt in range(4):
        try:
            response = await client.get(url, **kwargs)
            if response.status_code < 500 and response.status_code != 429:
                response.raise_for_status()
                return response
            if attempt == 3:
                response.raise_for_status()
        except (httpx.TimeoutException, httpx.NetworkError, httpx.HTTPStatusError):
            if attempt == 3:
                raise
        await asyncio.sleep(0.25 * (2 ** attempt))
    raise RuntimeError("unreachable retry state")


def clean(text: str, limit: int = 600) -> str:
    text = _STRIP.sub(" ", html.unescape(text or ""))
    text = html.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit]


def iso(value) -> str:
    """Normalize epoch seconds/ms, RFC 2822 or ISO 8601 dates to ISO 8601 UTC."""
    if value in (None, "", 0):
        return ""
    try:
        if isinstance(value, (int, float)) or (isinstance(value, str) and value.isdigit()):
            seconds = float(value)
            if seconds > 1e12:  # milliseconds
                seconds /= 1000
            parsed = datetime.fromtimestamp(seconds, tz=timezone.utc)
        else:
            text = str(value).strip().removesuffix(" UTC")
            try:
                parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
            except ValueError:
                parsed = parsedate_to_datetime(text)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    except (TypeError, ValueError, OverflowError, OSError):
        return ""


def number(value) -> float | None:
    """A positive amount from a number or a numeric string, else None."""
    if isinstance(value, bool) or value in (None, ""):
        return None
    try:
        amount = float(str(value).replace(",", "").strip())
    except ValueError:
        return None
    return amount if amount > 0 else None


_FREELANCE = re.compile(r"\b(freelanc\w*|contract(or|s)?|project[- ]based|temporary|freiberuf\w*|selbstst\w*)\b", re.I)
# "Indefinite contract" / "unbefristeter Arbeitsvertrag" / CDI are permanent employment.
_PERMANENT = re.compile(r"\b(indefinite|permanent|unbefristet\w*|cdi)\b", re.I)


def is_freelance(*values) -> bool:
    """True when a feed labels the role as freelance/contract work."""
    return any(_FREELANCE.search(str(v)) and not _PERMANENT.search(str(v)) for v in values if v)


def job(source: "JobSource", *, ref, title: str, url: str, company: str = "",
        description: str = "", tags=(), budget=None, currency: str | None = None,
        posted_at="", kind: str | None = None) -> dict | None:
    """One normalized radar row, or None when the listing can't be credited."""
    title = clean(title, 300)
    url = (url or "").strip()
    if not title or not url.startswith("https://"):
        return None
    ref = str(ref or hashlib.sha256(url.encode()).hexdigest()[:24])
    amount = number(budget)
    return {
        "kind": kind or source.kind,
        "id": f"{source.id}-{ref}"[:160],
        "title": title,
        "company": clean(company, 200) or f"{source.name} employer",
        "source": source.name,
        "url": url,
        "tags": [clean(str(t), 60) for t in tags if t and str(t).strip()][:6],
        "budget": amount,
        "currency": (currency or "USD").upper()[:3] if amount else None,
        "description": clean(description),
        "postedAt": iso(posted_at),
    }


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def child_text(node: ET.Element, *names: str) -> str:
    """First direct child text matching any local tag name (namespace-agnostic)."""
    for child in node:
        if _local(child.tag) in names and (child.text or "").strip():
            return child.text.strip()
    return ""


def child_texts(node: ET.Element, name: str) -> list[str]:
    return [c.text.strip() for c in node if _local(c.tag) == name and (c.text or "").strip()]


_BARE_AMP = re.compile(rb"&(?!#?\w+;)")


async def feed_items(client: httpx.AsyncClient, url: str, **kwargs) -> list[ET.Element]:
    """Items of an RSS (<item>) or Atom (<entry>) feed."""
    response = await get_with_retry(client, url, **kwargs)
    try:
        root = ET.fromstring(response.content)
    except ET.ParseError:
        # Some feeds ship bare "&" in URLs; escape them and try once more.
        root = ET.fromstring(_BARE_AMP.sub(b"&amp;", response.content))
    return [el for el in root.iter() if _local(el.tag) in ("item", "entry")]


def entry_link(item: ET.Element) -> str:
    link = child_text(item, "link")
    if link:
        return link
    for child in item:  # Atom: <link href="..."/>
        if _local(child.tag) == "link" and child.get("href"):
            return child.get("href", "")
    return child_text(item, "guid", "id")


def split_title(title: str, style: str | None) -> tuple[str, str]:
    """(role, company) from a feed title.

    style ":"    — "Company: Role"     (We Work Remotely)
    style ","    — "Role, Company"     (Python.org)
    style " at " — "Role at Company"   (NoDesk, Real Work From Anywhere)
    """
    if style == ":" and ":" in title:
        company, role = title.split(":", 1)
        return role.strip(), company.strip()
    if style in (",", " at ") and style in title:
        role, company = title.rsplit(style, 1)
        return role.strip(), company.strip()
    return title.strip(), ""


def rss_source(*urls: str, title_style: str | None = None, company_tags: tuple[str, ...] = (),
               company_pattern: str | None = None, limit: int = 50) -> Callable[["JobSource"], Fetcher]:
    """Fetcher for one or more RSS/Atom feeds of job listings.

    title_style: how a title packs role and company (see split_title).
    company_tags: namespaced child elements holding the company name.
    company_pattern: regex whose first group finds the company in the description.
    """
    company_re = re.compile(company_pattern) if company_pattern else None

    def bind(source: "JobSource") -> Fetcher:
        async def fetch(client: httpx.AsyncClient, skills: list[str]) -> list[dict]:
            out: list[dict] = []
            failures = 0
            for url in urls:
                try:
                    items = await feed_items(client, url)
                except Exception:
                    failures += 1
                    continue
                for item in items[:limit]:
                    title, company = split_title(child_text(item, "title"), title_style)
                    description = child_text(item, "encoded", "description", "summary", "content")
                    company = (child_text(item, *company_tags) if company_tags else "") or company
                    if not company and company_re and (found := company_re.search(description)):
                        company = found.group(1)
                    categories = child_texts(item, "category")
                    job_type = child_text(item, "job_type")
                    row = job(source, ref=None, title=title, url=entry_link(item), company=company,
                              description=description, tags=categories + [job_type],
                              posted_at=child_text(item, "pubDate", "published", "updated", "date"),
                              kind="gig" if is_freelance(title, job_type, *categories) else None)
                    if row:
                        out.append(row)
            if failures == len(urls):
                raise RuntimeError(f"all {len(urls)} feeds failed")
            return out
        return fetch
    return bind


# --------------------------------------------------------------------------- #
# Registry
# --------------------------------------------------------------------------- #
def _always(settings: Settings) -> bool:
    return True


def approved(source_id: str) -> Callable[[Settings], bool]:
    """Gate for public endpoints whose commercial reuse needs a recorded review."""
    def gate(settings: Settings) -> bool:
        return source_id in _csv(settings.job_sources_approved)
    return gate


def keyed(*setting_names: str, approval: str | None = None) -> Callable[[Settings], bool]:
    """Gate for APIs that need credentials — and, when their terms require a
    licence for revenue-generating products, a recorded approval as well."""
    def gate(settings: Settings) -> bool:
        has_keys = all(getattr(settings, name) for name in setting_names)
        return has_keys and (approval is None or approval in _csv(settings.job_sources_approved))
    return gate


def _csv(value: str) -> set[str]:
    return {item.strip().lower() for item in (value or "").split(",") if item.strip()}


@dataclass(frozen=True)
class JobSource:
    id: str
    name: str
    build: Callable[["JobSource"], Fetcher]
    mode: str = "feed"         # "feed": public, no credentials · "api": needs credentials
    kind: str = "job"          # default result kind; freelance/contract rows become "gig"
    ttl: int = 900             # seconds one fetch is shared across all users
    query_aware: bool = False  # the upstream call depends on the search terms
    gate: Callable[[Settings], bool] = _always
    reason: str = ""           # shown in the capability report
    terms: str = ""            # primary source for the access / attribution terms

    @property
    def fetch(self) -> Fetcher:
        return self.build(self)


def is_enabled(source: JobSource, settings: Settings | None = None) -> bool:
    settings = settings or get_settings()
    return source.id not in _csv(settings.job_sources_disabled) and bool(source.gate(settings))


def enabled_sources(settings: Settings | None = None) -> list[JobSource]:
    settings = settings or get_settings()
    return [s for s in SOURCES if is_enabled(s, settings)]


# Fetches are cached per source (and per query for search APIs) for every user.
_CACHE: dict[str, tuple[float, list[dict]]] = {}
_HEALTH: dict[str, dict] = {}


def reset_cache() -> None:
    _CACHE.clear()
    _HEALTH.clear()


async def fetch_source(source: JobSource, client: httpx.AsyncClient, skills: list[str]) -> list[dict]:
    """Fetch one source through the shared cache. Never raises."""
    query = ",".join(sorted(s.lower() for s in skills))
    key = f"{source.id}:{query}" if source.query_aware else source.id
    cached = _CACHE.get(key)
    if cached and cached[0] > time.monotonic():
        return cached[1]
    try:
        rows = await asyncio.wait_for(source.fetch(client, skills), timeout=_SOURCE_TIMEOUT)
        _CACHE[key] = (time.monotonic() + source.ttl, rows)
        _HEALTH[source.id] = {"ok": True, "count": len(rows), "checkedAt": iso(time.time())}
    except Exception as exc:
        # Keep serving the last good rows; never log upstream bodies.
        log.warning("job source %s failed: %s", source.id, type(exc).__name__)
        rows = cached[1] if cached else []
        _CACHE[key] = (time.monotonic() + min(source.ttl, _FAILURE_TTL), rows)
        _HEALTH[source.id] = {"ok": False, "count": len(rows), "checkedAt": iso(time.time()),
                              "error": type(exc).__name__}
    if len(_CACHE) > 512:
        now = time.monotonic()
        for stale in [k for k, (expiry, _) in _CACHE.items() if expiry <= now]:
            _CACHE.pop(stale, None)
    return rows


def source_report(settings: Settings | None = None) -> list[dict]:
    """Every registered source and company-board provider with its gate state
    and last fetch health."""
    settings = settings or get_settings()
    return [{
        "id": s.id, "name": s.name, "mode": s.mode, "kind": s.kind,
        "enabled": is_enabled(s, settings), "reason": s.reason, "terms": s.terms,
        "health": _HEALTH.get(s.id),
    } for s in SOURCES] + [{
        "id": p.id, "name": f"{p.name} company boards", "mode": "feed", "kind": "job",
        "enabled": p.enabled(settings),
        "reason": "Public ATS job-board API for companies you watch; it grants no third-party display licence, so it waits for a reuse review.",
        "terms": p.terms, "health": None,
    } for p in BOARD_PROVIDERS.values()]


# --------------------------------------------------------------------------- #
# Sources
# --------------------------------------------------------------------------- #
def _remoteok(source: JobSource) -> Fetcher:
    async def fetch(client, skills):
        rows = (await get_with_retry(client, "https://remoteok.com/api")).json()
        out = []
        for j in rows:
            if not isinstance(j, dict) or not j.get("position"):
                continue  # the first element is a legal/attribution notice
            row = job(source, ref=j.get("id"), title=j.get("position"),
                      url=j.get("url") or j.get("apply_url") or "", company=j.get("company"),
                      description=j.get("description", ""), tags=j.get("tags") or [],
                      budget=j.get("salary_max"), posted_at=j.get("epoch") or j.get("date"))
            if row:
                out.append(row)
        return out
    return fetch


def _reddit(source: JobSource) -> Fetcher:
    async def fetch(client, skills):
        settings = get_settings()
        response = await get_with_retry(
            client, "https://oauth.reddit.com/r/forhire/new.json?limit=60",
            headers={"Authorization": f"Bearer {settings.reddit_access_token}"})
        out = []
        for child in response.json().get("data", {}).get("children", []):
            d = child.get("data", {})
            title = d.get("title", "")
            if "[hiring]" not in title.lower():
                continue
            row = job(source, ref=d.get("id"), title=re.sub(r"\[hiring\]", "", title, flags=re.I).strip(" -—"),
                      url=f"https://reddit.com{d.get('permalink', '')}", company=f"u/{d.get('author', 'redditor')}",
                      description=d.get("selftext", ""), posted_at=d.get("created_utc"))
            if row:
                out.append(row)
        return out
    return fetch


_HN_FREELANCER_TITLE = re.compile(r"^Ask HN: Freelancer\? Seeking freelancer\? \(\w+ \d{4}\)$", re.I)
# Posted by `whoishiring` until Oct 2025 and by `jon_north` since Dec 2025.
_HN_FREELANCER_AUTHORS = ("jon_north", "whoishiring")


def _hn_posts(source: JobSource, thread: dict, *, prefix: str = "", kind: str | None = None) -> list[dict]:
    """Top-level comments of an HN thread as rows; `prefix` keeps only matching posts."""
    out = []
    for c in thread.get("children", []):
        text = clean(c.get("text", ""), limit=900)
        if len(text) < 40 or not text.upper().startswith(prefix):
            continue
        text = text[len(prefix):].lstrip(" :|-–—") if prefix else text
        # First chunk before a pipe/dash is usually the "company | role" headline.
        headline = re.split(r"[|\u2013\u2014]|\. ", text)[0][:90]
        row = job(source, ref=c.get("id"), title=headline or "Hiring (HN)",
                  url=f"https://news.ycombinator.com/item?id={c.get('id')}", company=c.get("author"),
                  description=text, posted_at=c.get("created_at_i"), kind=kind)
        if row:
            out.append(row)
    return out


def _hackernews(source: JobSource) -> Fetcher:
    """The monthly "Who is hiring?" thread (jobs) and "Freelancer? Seeking
    freelancer?" thread (gigs). Only "SEEKING FREELANCER" posts are gigs; the
    "SEEKING WORK" posts are freelancers advertising themselves."""
    async def fetch(client, skills):
        algolia = "https://hn.algolia.com/api/v1"
        out: list[dict] = []
        hiring = await get_with_retry(client, f"{algolia}/search_by_date",
                                      params={"tags": "story,author_whoishiring", "hitsPerPage": 10})
        hits = [h for h in hiring.json().get("hits", []) if "who is hiring" in (h.get("title") or "").lower()]
        if hits:
            thread = await get_with_retry(client, f"{algolia}/items/{hits[0]['objectID']}")
            out.extend(_hn_posts(source, thread.json()))
        freelance = await get_with_retry(client, f"{algolia}/search_by_date", params={
            "query": "Seeking freelancer", "tags": "story", "restrictSearchableAttributes": "title",
            "hitsPerPage": 20})
        threads = [h for h in freelance.json().get("hits", [])
                   if _HN_FREELANCER_TITLE.match(h.get("title") or "") and h.get("author") in _HN_FREELANCER_AUTHORS]
        if threads:
            thread = await get_with_retry(client, f"{algolia}/items/{threads[0]['objectID']}")
            out.extend(_hn_posts(source, thread.json(), prefix="SEEKING FREELANCER", kind="gig"))
        return out
    return fetch


def _freelancer(source: JobSource) -> Fetcher:
    """Freelancer.com official public project search API."""
    async def fetch(client, skills):
        response = await get_with_retry(
            client, "https://www.freelancer.com/api/projects/0.1/projects/active/",
            params={"query": skills[0] if skills else "developer", "limit": 25, "full_description": "true",
                    "job_details": "true", "compact": "true"})
        out = []
        for p in response.json().get("result", {}).get("projects", []):
            budget = p.get("budget") or {}
            seo = p.get("seo_url", "")
            row = job(source, ref=p.get("id"), title=p.get("title", ""),
                      url=f"https://www.freelancer.com/projects/{seo}" if seo else "",
                      company="Freelancer.com client",
                      description=p.get("preview_description") or p.get("description") or "",
                      tags=[j.get("name") for j in (p.get("jobs") or []) if j.get("name")],
                      budget=budget.get("maximum") or budget.get("minimum"),
                      currency=(p.get("currency") or {}).get("code"), posted_at=p.get("time_submitted"))
            if row:
                out.append(row)
        return out
    return fetch


def _remotive(source: JobSource) -> Fetcher:
    async def fetch(client, skills):
        data = (await get_with_retry(client, "https://remotive.com/api/remote-jobs", params={"limit": 200})).json()
        out = []
        for j in data.get("jobs", []):
            row = job(source, ref=j.get("id"), title=j.get("title", ""), url=j.get("url", ""),
                      company=j.get("company_name"), description=j.get("description", ""),
                      tags=[j.get("category")] + (j.get("tags") or []), posted_at=j.get("publication_date"),
                      kind="gig" if j.get("job_type") in ("contract", "freelance") else None)
            if row:
                out.append(row)
        return out
    return fetch


def _arbeitnow(source: JobSource) -> Fetcher:
    async def fetch(client, skills):
        data = (await get_with_retry(client, "https://www.arbeitnow.com/api/job-board-api")).json()
        out = []
        for j in data.get("data", []):
            types = j.get("job_types") or []
            freelance = is_freelance(*types)
            if not (j.get("remote") or freelance):
                continue  # mostly on-site roles in Germany; keep remote and freelance work
            row = job(source, ref=j.get("slug"), title=j.get("title", ""), url=j.get("url", ""),
                      company=j.get("company_name"), description=j.get("description", ""),
                      tags=(j.get("tags") or []) + [j.get("location")], posted_at=j.get("created_at"),
                      kind="gig" if freelance else None)
            if row:
                out.append(row)
        return out
    return fetch


def _jobicy(source: JobSource) -> Fetcher:
    async def fetch(client, skills):
        data = (await get_with_retry(client, "https://jobicy.com/api/v2/remote-jobs", params={"count": 50})).json()
        out = []
        for j in data.get("jobs", []):
            types = j.get("jobType") or []
            row = job(source, ref=j.get("id"), title=j.get("jobTitle", ""), url=j.get("url", ""),
                      company=j.get("companyName"), description=j.get("jobExcerpt") or j.get("jobDescription", ""),
                      tags=(j.get("jobIndustry") or []) + [j.get("jobGeo")],
                      budget=j.get("salaryMax") or j.get("salaryMin"), currency=j.get("salaryCurrency"),
                      posted_at=j.get("pubDate"), kind="gig" if is_freelance(*types) else None)
            if row:
                out.append(row)
        return out
    return fetch


def _himalayas(source: JobSource) -> Fetcher:
    async def fetch(client, skills):
        data = (await get_with_retry(client, "https://himalayas.app/jobs/api", params={"limit": 20})).json()
        out = []
        now = time.time()
        for j in data.get("jobs", []):
            if (number(j.get("expiryDate")) or now + 1) < now:
                continue  # Himalayas asks aggregators to drop expired jobs
            row = job(source, ref=None, title=j.get("title", ""), url=j.get("applicationLink") or j.get("guid", ""),
                      company=j.get("companyName"), description=j.get("excerpt") or j.get("description", ""),
                      tags=(j.get("parentCategories") or []) + (j.get("locationRestrictions") or []),
                      budget=j.get("maxSalary") or j.get("minSalary"), currency=j.get("currency"),
                      posted_at=j.get("pubDate"),
                      kind="gig" if is_freelance(j.get("employmentType")) else None)
            if row:
                out.append(row)
        return out
    return fetch


def _working_nomads(source: JobSource) -> Fetcher:
    async def fetch(client, skills):
        data = (await get_with_retry(client, "https://www.workingnomads.com/api/exposed_jobs/")).json()
        out = []
        for j in data if isinstance(data, list) else []:
            tags = [t for t in (j.get("tags") or "").split(",") if t.strip()]
            row = job(source, ref=None, title=j.get("title", ""), url=j.get("url", ""),
                      company=j.get("company_name"), description=j.get("description", ""),
                      tags=[j.get("category_name")] + tags, posted_at=j.get("pub_date"),
                      kind="gig" if is_freelance(j.get("title")) else None)
            if row:
                out.append(row)
        return out
    return fetch


def _the_muse(source: JobSource) -> Fetcher:
    async def fetch(client, skills):
        params = {"page": 0, "location": "Flexible / Remote"}
        if get_settings().the_muse_api_key:
            params["api_key"] = get_settings().the_muse_api_key
        data = (await get_with_retry(client, "https://www.themuse.com/api/public/jobs", params=params)).json()
        out = []
        for j in data.get("results", []):
            row = job(source, ref=j.get("id"), title=j.get("name", ""), url=(j.get("refs") or {}).get("landing_page", ""),
                      company=(j.get("company") or {}).get("name"), description=j.get("contents", ""),
                      tags=[c.get("name") for c in j.get("categories") or []] + [l.get("name") for l in j.get("levels") or []],
                      posted_at=j.get("publication_date"))
            if row:
                out.append(row)
        return out
    return fetch


def _topcoder(source: JobSource) -> Fetcher:
    """Open Topcoder challenges (v6 — the v5 API was retired)."""
    async def fetch(client, skills):
        data = (await get_with_retry(client, "https://api.topcoder.com/v6/challenges", params={
            "status": "ACTIVE", "perPage": 50, "sortBy": "startDate", "sortOrder": "desc"})).json()
        out = []
        for c in data if isinstance(data, list) else []:
            overview = c.get("overview") or {}
            row = job(source, ref=c.get("id"), title=c.get("name", ""),
                      url=f"https://www.topcoder.com/challenges/{c.get('id')}", company="Topcoder challenge",
                      description=c.get("description", ""),
                      tags=(c.get("tags") or []) + [s.get("name") for s in c.get("skills") or []],
                      budget=overview.get("totalPrizes"), currency=overview.get("type"),
                      posted_at=c.get("registrationStartDate") or c.get("created"))
            if row:
                out.append(row)
        return out
    return fetch


def _usajobs(source: JobSource) -> Fetcher:
    async def fetch(client, skills):
        settings = get_settings()
        data = (await get_with_retry(client, "https://data.usajobs.gov/api/Search", params={
            "RemoteIndicator": "True", "DatePosted": 14, "ResultsPerPage": 100,
        }, headers={"Host": "data.usajobs.gov", "User-Agent": settings.usajobs_user_agent,
                    "Authorization-Key": settings.usajobs_api_key})).json()
        out = []
        for item in (data.get("SearchResult") or {}).get("SearchResultItems", []):
            d = item.get("MatchedObjectDescriptor") or {}
            pay = (d.get("PositionRemuneration") or [{}])[0]
            row = job(source, ref=item.get("MatchedObjectId"), title=d.get("PositionTitle", ""),
                      url=d.get("PositionURI", ""), company=d.get("OrganizationName") or d.get("DepartmentName"),
                      description=((d.get("UserArea") or {}).get("Details") or {}).get("JobSummary", ""),
                      tags=[c.get("Name") for c in d.get("JobCategory") or []],
                      budget=pay.get("MaximumRange"), currency="USD",
                      posted_at=d.get("PublicationStartDate"))
            if row:
                out.append(row)
        return out
    return fetch


def _adzuna(source: JobSource) -> Fetcher:
    async def fetch(client, skills):
        settings = get_settings()
        country = (settings.adzuna_country or "us").lower()
        data = (await get_with_retry(client, f"https://api.adzuna.com/v1/api/jobs/{country}/search/1", params={
            "app_id": settings.adzuna_app_id, "app_key": settings.adzuna_app_key,
            "what_or": " ".join(skills) or "developer", "results_per_page": 50,
            "content-type": "application/json"})).json()
        out = []
        for j in data.get("results", []):
            predicted = str(j.get("salary_is_predicted")) == "1"  # Adzuna estimates; don't show as a real budget
            row = job(source, ref=j.get("id"), title=j.get("title", ""), url=j.get("redirect_url", ""),
                      company=(j.get("company") or {}).get("display_name"), description=j.get("description", ""),
                      tags=[(j.get("category") or {}).get("label"), j.get("contract_type"), j.get("contract_time")],
                      budget=None if predicted else j.get("salary_max") or j.get("salary_min"),
                      currency={"gb": "GBP", "us": "USD", "ca": "CAD", "au": "AUD", "in": "INR"}.get(country, "EUR"),
                      posted_at=j.get("created"),
                      kind="gig" if is_freelance(j.get("contract_type"), j.get("title")) else None)
            if row:
                out.append(row)
        return out
    return fetch


def _jooble(source: JobSource) -> Fetcher:
    async def fetch(client, skills):
        response = await client.post(f"https://jooble.org/api/{get_settings().jooble_api_key}",
                                     json={"keywords": " ".join(skills) or "developer", "location": "Remote"})
        response.raise_for_status()
        out = []
        for j in response.json().get("jobs", []):
            row = job(source, ref=j.get("id"), title=j.get("title", ""), url=j.get("link", ""),
                      company=j.get("company"), description=j.get("snippet", ""),
                      tags=[j.get("type"), j.get("location")], posted_at=j.get("updated"),
                      kind="gig" if is_freelance(j.get("type")) else None)
            if row:
                out.append(row)
        return out
    return fetch


def _reed(source: JobSource) -> Fetcher:
    async def fetch(client, skills):
        data = (await get_with_retry(client, "https://www.reed.co.uk/api/1.0/search", params={
            "keywords": " ".join(skills) or "developer", "resultsToTake": 100,
        }, auth=(get_settings().reed_api_key, ""))).json()
        out = []
        for j in data.get("results", []):
            posted = j.get("date") or ""
            if re.fullmatch(r"\d\d/\d\d/\d{4}", posted):  # dd/mm/yyyy
                posted = f"{posted[6:]}-{posted[3:5]}-{posted[:2]}"
            row = job(source, ref=j.get("jobId"), title=j.get("jobTitle", ""), url=j.get("jobUrl", ""),
                      company=j.get("employerName"), description=j.get("jobDescription", ""),
                      tags=[j.get("locationName")], budget=j.get("maximumSalary") or j.get("minimumSalary"),
                      currency=j.get("currency") or "GBP", posted_at=posted,
                      kind="gig" if is_freelance(j.get("jobTitle")) else None)
            if row:
                out.append(row)
        return out
    return fetch


def _findwork(source: JobSource) -> Fetcher:
    async def fetch(client, skills):
        data = (await get_with_retry(client, "https://findwork.dev/api/jobs/", params={
            "search": " ".join(skills) or "developer", "remote": "true", "sort_by": "date",
        }, headers={"Authorization": f"Token {get_settings().findwork_api_token}"})).json()
        out = []
        for j in data.get("results", []):
            row = job(source, ref=j.get("id"), title=j.get("role", ""), url=j.get("url", ""),
                      company=j.get("company_name"), description=j.get("text", ""),
                      tags=(j.get("keywords") or []) + [j.get("employment_type")], posted_at=j.get("date_posted"),
                      kind="gig" if is_freelance(j.get("employment_type")) else None)
            if row:
                out.append(row)
        return out
    return fetch


def _four_day_week(source: JobSource) -> Fetcher:
    async def fetch(client, skills):
        data = (await get_with_retry(client, "https://4dayweek.io/api/v2/jobs", params={"limit": 100, "page": 1})).json()
        out = []
        for j in data.get("data", []):
            salary = number(j.get("salary_max")) or number(j.get("salary_min"))
            row = job(source, ref=j.get("id"), title=j.get("title", ""), url=j.get("url", ""),
                      company=(j.get("company") or {}).get("name"), description=j.get("description", ""),
                      tags=[s.get("name") for s in j.get("skills") or []] + [j.get("category"), j.get("work_arrangement")],
                      budget=salary / 100 if salary else None,  # 4dayweek reports salaries in cents
                      currency=j.get("salary_currency"), posted_at=j.get("posted_at"),
                      kind="gig" if is_freelance(j.get("contract_type")) else None)
            if row:
                out.append(row)
        return out
    return fetch


def _web3_career(source: JobSource) -> Fetcher:
    """Web3.career API — the payload is an array whose job list may be nested
    after a couple of notice strings, so find the list of objects."""
    async def fetch(client, skills):
        data = (await get_with_retry(client, "https://web3.career/api/v1", params={
            "token": get_settings().web3_career_token, "remote": "true", "limit": 100,
            "show_description": "true"})).json()
        rows = data if isinstance(data, list) else []
        jobs = next((x for x in rows if isinstance(x, list)), None)
        if jobs is None:
            jobs = [x for x in rows if isinstance(x, dict)]
        out = []
        for j in jobs:
            if not isinstance(j, dict):
                continue
            row = job(source, ref=j.get("id"), title=j.get("title", ""), url=j.get("apply_url", ""),
                      company=j.get("company"), description=j.get("description", ""), tags=j.get("tags") or [],
                      posted_at=j.get("date_epoch") or j.get("date"),
                      kind="gig" if is_freelance(j.get("title"), *(j.get("tags") or [])) else None)
            if row:
                out.append(row)
        return out
    return fetch


# --------------------------------------------------------------------------- #
# Company career boards — public ATS job-board APIs, per company the user watches
# --------------------------------------------------------------------------- #
@dataclass(frozen=True)
class BoardProvider:
    id: str
    name: str
    build: Callable[["BoardProvider", str], Callable[[httpx.AsyncClient], Awaitable[list[dict]]]]
    hint: str                   # where the user finds the company's board slug
    terms: str
    slug_pattern: str = r"[A-Za-z0-9][A-Za-z0-9._-]{0,79}"

    def valid(self, slug: str) -> bool:
        return bool(re.fullmatch(self.slug_pattern, slug or ""))

    def enabled(self, settings: Settings | None = None) -> bool:
        # These ATS APIs are public but grant no third-party display licence,
        # so each provider waits for a recorded review (JOB_SOURCES_APPROVED).
        settings = settings or get_settings()
        return (self.id in _csv(settings.job_sources_approved)
                and self.id not in _csv(settings.job_sources_disabled))


def _board_row(provider: BoardProvider, slug: str, **fields) -> dict | None:
    # "gh-gitlab-123": stable per provider, company and posting.
    source = JobSource(f"{provider.id}-{slug.lower()}"[:40], provider.name, lambda s: None)
    return job(source, **fields)


def _greenhouse(provider: BoardProvider, slug: str):
    async def fetch(client):
        data = (await get_with_retry(client, f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs",
                                     params={"content": "true"})).json()
        out = []
        for j in data.get("jobs", []):
            row = _board_row(provider, slug, ref=j.get("id"), title=j.get("title", ""), url=j.get("absolute_url", ""),
                             company=j.get("company_name") or slug, description=j.get("content", ""),
                             tags=[(j.get("location") or {}).get("name")] + [d.get("name") for d in j.get("departments") or []],
                             posted_at=j.get("first_published") or j.get("updated_at"))
            if row:
                out.append(row)
        return out
    return fetch


def _lever(provider: BoardProvider, slug: str):
    async def fetch(client):
        data = (await get_with_retry(client, f"https://api.lever.co/v0/postings/{slug}", params={"mode": "json"})).json()
        out = []
        for j in data if isinstance(data, list) else []:
            categories = j.get("categories") or {}
            salary = j.get("salaryRange") or {}
            row = _board_row(provider, slug, ref=j.get("id"), title=j.get("text", ""), url=j.get("hostedUrl", ""),
                             company=slug, description=j.get("descriptionPlain") or j.get("description", ""),
                             tags=[categories.get("location"), categories.get("team"), categories.get("commitment")],
                             budget=salary.get("max"), currency=salary.get("currency"), posted_at=j.get("createdAt"),
                             kind="gig" if is_freelance(categories.get("commitment")) else None)
            if row:
                out.append(row)
        return out
    return fetch


def _ashby(provider: BoardProvider, slug: str):
    async def fetch(client):
        data = (await get_with_retry(client, f"https://api.ashbyhq.com/posting-api/job-board/{slug}")).json()
        out = []
        for j in data.get("jobs", []):
            if j.get("isListed") is False:
                continue
            row = _board_row(provider, slug, ref=j.get("id"), title=j.get("title", ""), url=j.get("jobUrl", ""),
                             company=slug, description=j.get("descriptionPlain", ""),
                             tags=[j.get("location"), j.get("department"), j.get("employmentType")],
                             posted_at=j.get("publishedAt"),
                             kind="gig" if j.get("employmentType") in ("Contract", "Temporary") else None)
            if row:
                out.append(row)
        return out
    return fetch


def _smartrecruiters(provider: BoardProvider, slug: str):
    async def fetch(client):
        data = (await get_with_retry(client, f"https://api.smartrecruiters.com/v1/companies/{slug}/postings",
                                     params={"limit": 100})).json()
        out = []
        for j in data.get("content", []):
            location = j.get("location") or {}
            employment = (j.get("typeOfEmployment") or {}).get("label")
            row = _board_row(provider, slug, ref=j.get("id"), title=j.get("name", ""),
                             url=f"https://jobs.smartrecruiters.com/{slug}/{j.get('id')}",
                             company=(j.get("company") or {}).get("name") or slug,
                             tags=[location.get("city"), (j.get("department") or {}).get("label"), employment],
                             posted_at=j.get("releasedDate"),
                             kind="gig" if is_freelance(employment) else None)
            if row:
                out.append(row)
        return out
    return fetch


def _workable(provider: BoardProvider, slug: str):
    async def fetch(client):
        data = (await get_with_retry(client, f"https://apply.workable.com/api/v1/widget/accounts/{slug}",
                                     params={"details": "true"})).json()
        out = []
        for j in data.get("jobs", []):
            row = _board_row(provider, slug, ref=j.get("shortcode"), title=j.get("title", ""), url=j.get("url", ""),
                             company=data.get("name") or slug, description=j.get("description", ""),
                             tags=[j.get("city") or j.get("country"), j.get("department"), j.get("employment_type")],
                             posted_at=j.get("published_on"),
                             kind="gig" if is_freelance(j.get("employment_type")) else None)
            if row:
                out.append(row)
        return out
    return fetch


def _recruitee(provider: BoardProvider, slug: str):
    async def fetch(client):
        data = (await get_with_retry(client, f"https://{slug}.recruitee.com/api/offers/")).json()
        out = []
        for j in data.get("offers", []):
            salary = j.get("salary") or {}
            row = _board_row(provider, slug, ref=j.get("id"), title=j.get("title", ""), url=j.get("careers_url", ""),
                             company=j.get("company_name") or slug, description=j.get("description", ""),
                             tags=(j.get("tags") or []) + [j.get("department"), j.get("location")],
                             budget=salary.get("max") or salary.get("min"), currency=salary.get("currency"),
                             posted_at=j.get("published_at") or j.get("created_at"),
                             kind="gig" if is_freelance(j.get("employment_type_code"), j.get("title")) else None)
            if row:
                out.append(row)
        return out
    return fetch


BOARD_PROVIDERS: dict[str, BoardProvider] = {p.id: p for p in [
    BoardProvider("gh", "Greenhouse", _greenhouse,
                  hint="The name after job-boards.greenhouse.io/ in the company's careers link.",
                  terms="https://developers.greenhouse.io/job-board.html"),
    BoardProvider("lev", "Lever", _lever,
                  hint="The name after jobs.lever.co/ in the company's careers link.",
                  terms="https://github.com/lever/postings-api"),
    BoardProvider("ash", "Ashby", _ashby,
                  hint="The name after jobs.ashbyhq.com/ in the company's careers link.",
                  terms="https://developers.ashbyhq.com/docs/public-job-posting-api"),
    BoardProvider("smr", "SmartRecruiters", _smartrecruiters,
                  hint="The name after jobs.smartrecruiters.com/ in the company's careers link.",
                  terms="https://developers.smartrecruiters.com/docs/posting-api"),
    BoardProvider("wkb", "Workable", _workable,
                  hint="The name after apply.workable.com/ in the company's careers link.",
                  terms="https://help.workable.com/hc/en-us/articles/115012771647-Using-the-Workable-API-to-create-a-careers-page"),
    # The slug becomes a subdomain, so no dots or underscores.
    BoardProvider("rct", "Recruitee", _recruitee,
                  hint="The name before .recruitee.com in the company's careers link.",
                  terms="https://docs.recruitee.com/reference/offers", slug_pattern=r"[a-z0-9][a-z0-9-]{0,62}"),
]}

_BOARD_TTL = 3600
MAX_WATCHED_BOARDS = 25


async def fetch_board(client: httpx.AsyncClient, provider_id: str, slug: str) -> list[dict]:
    """One company's public job board through the shared cache. Never raises."""
    provider = BOARD_PROVIDERS.get(provider_id)
    if not provider or not provider.valid(slug) or not provider.enabled():
        return []
    key = f"board:{provider_id}:{slug.lower()}"
    cached = _CACHE.get(key)
    if cached and cached[0] > time.monotonic():
        return cached[1]
    try:
        rows = await asyncio.wait_for(provider.build(provider, slug)(client), timeout=_SOURCE_TIMEOUT)
        _CACHE[key] = (time.monotonic() + _BOARD_TTL, rows)
    except Exception as exc:
        log.warning("company board %s/%s failed: %s", provider_id, slug, type(exc).__name__)
        rows = cached[1] if cached else []
        _CACHE[key] = (time.monotonic() + _FAILURE_TTL, rows)
    return rows


SOURCES: list[JobSource] = [
    JobSource("rok", "RemoteOK", _remoteok, ttl=1800,
              reason="Public JSON feed; results credit RemoteOK and link the original listing.",
              terms="https://remoteok.com/faq"),
    JobSource("wwr", "WeWorkRemotely", rss_source(
        "https://weworkremotely.com/categories/remote-programming-jobs.rss",
        "https://weworkremotely.com/categories/remote-design-jobs.rss",
        title_style=":", limit=25), ttl=1800,
        reason="Public RSS feed; results link the original listing.",
        terms="https://weworkremotely.com/remote-job-rss"),
    JobSource("rdt", "Reddit r/forhire", _reddit, mode="api", kind="gig",
              gate=lambda s: bool(s.reddit_commercial_approved and s.reddit_access_token),
              reason="Requires OAuth credentials and commercial Data API approval.",
              terms="https://redditinc.com/policies/data-api-terms"),
    JobSource("hn", "Hacker News", _hackernews, ttl=3600,
              gate=lambda s: bool(s.hn_commercial_reuse_approved),
              reason="Commercial reuse review must be complete before this feed is enabled.",
              terms="https://news.ycombinator.com/newsfaq.html"),
    JobSource("flx", "Freelancer.com", _freelancer, mode="api", kind="gig", query_aware=True,
              gate=lambda s: bool(s.freelancer_api_approved),
              reason="Automated public search requires written API permission.",
              terms="https://www.freelancer.com/about/apiterms"),

    # ---- Remote job boards with public APIs/feeds ------------------------
    JobSource("jcy", "Jobicy", _jobicy, ttl=3600,
              reason="Public API; Jobicy is credited and every listing links to the original job URL (max one pass an hour).",
              terms="https://jobicy.com/jobs-rss-feed"),
    JobSource("arb", "Arbeitnow", _arbeitnow, ttl=3600,
              reason="Free public API (remote and freelance roles only); terms ask for a link back to Arbeitnow.",
              terms="https://www.arbeitnow.com/blog/job-board-api"),
    JobSource("him", "Himalayas", _himalayas, ttl=12 * 3600,
              reason="Himalayas allows showing its jobs in your own app without asking; links stay unchanged and expired jobs are dropped.",
              terms="https://himalayas.app/api"),
    JobSource("fdw", "4 Day Week", _four_day_week, ttl=3600,
              reason="Free public API; 4dayweek.io is credited and each listing links to its page.",
              terms="https://4dayweek.io/developers"),
    JobSource("rmt", "Remotive", _remotive, ttl=6 * 3600, gate=approved("rmt"),
              reason="Remotive's API terms bar showing its jobs behind a signup; needs written permission or its paid API.",
              terms="https://remotive.com/api-documentation"),
    JobSource("wn", "Working Nomads", _working_nomads, ttl=3600, gate=approved("wn"),
              reason="Public endpoint, but its terms bar commercial exploitation and competing services; needs permission.",
              terms="https://www.workingnomads.com/terms-and-conditions"),
    JobSource("cjl", "Crypto Jobs List", rss_source("https://api.cryptojobslist.com/jobs.rss", company_tags=("creator",),
              limit=100), ttl=3600, gate=approved("cjl"),
              reason="Public RSS marked \"All rights reserved\"; enable once the operator confirms reuse.",
              terms="https://api.cryptojobslist.com/jobs.rss"),
    JobSource("pyj", "Python.org Jobs", rss_source("https://www.python.org/jobs/feed/rss/", title_style=","),
              ttl=3600, gate=approved("pyj"),
              reason="Official RSS with no reuse terms for the jobs board; enable once the PSF confirms reuse.",
              terms="https://www.python.org/about/legal/"),
    JobSource("lara", "LaraJobs", rss_source("https://larajobs.com/feed", company_tags=("company",)),
              ttl=3600, gate=approved("lara"),
              reason="Public RSS with no published reuse terms; enable once the operator confirms.",
              terms="https://larajobs.com/feed"),
    JobSource("auj", "Authentic Jobs", rss_source("https://authenticjobs.com/?feed=job_feed", company_tags=("company",)),
              ttl=3600, gate=approved("auj"),
              reason="RSS exists, but robots.txt disallows the feed path and content is proprietary; needs written permission.",
              terms="https://authenticjobs.com/terms/"),
    JobSource("nod", "NoDesk", rss_source("https://nodesk.co/remote-jobs/index.xml", title_style=" at "),
              ttl=3600, gate=approved("nod"),
              reason="Public RSS; robots.txt allows reference use only and opts out of AI crawlers, so it needs permission.",
              terms="https://nodesk.co/robots.txt"),
    JobSource("pbl", "ProBlogger Jobs", rss_source("https://problogger.com/jobs/wpjobboard/xml/rss/?filter=active"),
              ttl=3600, gate=approved("pbl"),
              reason="Official RSS of writing gigs with no reuse terms (\"All Rights Reserved\"); enable once ProBlogger confirms.",
              terms="https://problogger.com/jobs/"),
    JobSource("vue", "VueJobs", rss_source("https://app.vuejobs.com/feed/posts", limit=100,
              company_pattern=r"<strong>Employer:</strong>\s*([^<]+)"), ttl=6 * 3600, gate=approved("vue"),
              reason="RSS exists, but robots.txt disallows it; needs written permission.",
              terms="https://vuejobs.com/robots.txt"),
    JobSource("rwfa", "Real Work From Anywhere", rss_source("https://www.realworkfromanywhere.com/rss.xml",
              title_style=" at ", company_tags=("author",)), ttl=3600, gate=approved("rwfa"),
              reason="Free public RSS with no reuse terms; enable once the operator confirms.",
              terms="https://www.realworkfromanywhere.com/rss-feeds"),
    JobSource("drb", "Dribbble Jobs", rss_source("https://dribbble.com/jobs.rss", company_tags=("creator",)),
              ttl=3600, gate=approved("drb"),
              reason="Official jobs RSS, but Dribbble's API terms bar using its data for a job search service; needs permission.",
              terms="https://developer.dribbble.com/terms/"),
    JobSource("tc", "Topcoder", _topcoder, kind="gig", ttl=3600, gate=approved("tc"),
              reason="Public challenges API (v6), but the site terms limit use to personal use; needs permission.",
              terms="https://www.topcoder.com/community/how-it-works/terms"),

    # ---- Job search APIs (credentials) ------------------------------------
    JobSource("muse", "The Muse", _the_muse, mode="api", ttl=3600, gate=keyed("the_muse_api_key"),
              reason="Public API; registration (THE_MUSE_API_KEY) is required beyond testing and listings link back to The Muse.",
              terms="https://www.themuse.com/developers/api/v2/terms"),
    JobSource("usaj", "USAJOBS", _usajobs, mode="api", ttl=3600,
              gate=keyed("usajobs_api_key", "usajobs_user_agent"),
              reason="Open-licence federal jobs API; needs a free key (USAJOBS_API_KEY + USAJOBS_USER_AGENT email).",
              terms="https://developer.usajobs.gov/guides/terms-of-service"),
    JobSource("jbl", "Jooble", _jooble, mode="api", query_aware=True, ttl=12 * 3600, gate=keyed("jooble_api_key"),
              reason="Partner API key (JOOBLE_API_KEY); the free plan allows 500 requests in total, so results are cached 12 hours.",
              terms="https://jooblehelpcenter.freshdesk.com/en/support/solutions/articles/60001448238-rest-api-documentation"),
    JobSource("w3c", "Web3.career", _web3_career, mode="api", ttl=3600, gate=keyed("web3_career_token"),
              reason="Free API token (WEB3_CAREER_TOKEN); listings must link back with the unchanged apply URL.",
              terms="https://web3.career/web3-jobs-api"),
    JobSource("adz", "Adzuna", _adzuna, mode="api", query_aware=True, ttl=3600,
              gate=keyed("adzuna_app_id", "adzuna_app_key", approval="adz"),
              reason="Needs ADZUNA_APP_ID/KEY and, for a revenue-generating product, an Adzuna licence; adverts must be labelled \"Adzuna\".",
              terms="https://developer.adzuna.com/docs/terms_of_service"),
    JobSource("reed", "Reed.co.uk", _reed, mode="api", query_aware=True, ttl=3600,
              gate=keyed("reed_api_key", approval="reed"),
              reason="Needs REED_API_KEY and written permission; Reed's terms bar commercial copying.",
              terms="https://www.reed.co.uk/developers/jobseeker"),
    JobSource("fw", "Findwork", _findwork, mode="api", query_aware=True, ttl=3600,
              gate=keyed("findwork_api_token", approval="fw"),
              reason="Needs FINDWORK_API_TOKEN; it republishes other boards and has no published terms, so it needs review.",
              terms="https://findwork.dev"),
]
