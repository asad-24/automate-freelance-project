"""Arq worker and recurring public-job and approved mailbox sync jobs."""
import asyncio
import json
import logging

from arq import cron
from arq.connections import RedisSettings

from .config import get_settings
from .routers.radar import radar_jobs

log = logging.getLogger("autopilot.queue")


async def startup(ctx: dict) -> None:
    log.info("queue worker started")


async def shutdown(ctx: dict) -> None:
    log.info("queue worker stopped")


async def scheduled_job_scan(ctx: dict) -> dict:
    """Refresh public feeds and notify users about new strong matches."""
    # Scheduled scans aggregate public sources without an end-user profile.
    result = await radar_jobs(q="", limit=100, kind="all", user={"id": "scheduler"})
    await ctx["redis"].set("autopilot:radar:latest", json.dumps(result), ex=900)
    from . import db, repo, seed

    notified = 0
    for account in await db.list_users():
        user_id = account.get("id")
        if not user_id:
            continue
        profile = await repo.get_settings_doc(user_id, seed.SETTINGS)
        queries = []
        skills = profile.get("skillProfile") or []
        if skills:
            queries.append(", ".join(skills))
        queries.extend(
            str(search.get("query", "")).strip()
            for search in profile.get("radarSavedSearches", [])
            if search.get("alertEnabled", True) and str(search.get("query", "")).strip()
        )
        queries = list(dict.fromkeys(queries))
        if not queries:
            continue
        prior = set(profile.get("radarNotifiedJobIds", []))
        matches = {}
        for query in queries:
            personalized = await radar_jobs(q=query, limit=100, kind="all", user={"id": user_id})
            for job in personalized["jobs"]:
                if job.get("matchScore", 0) >= 80 and job.get("id") not in prior:
                    matches[job["id"]] = job
        fresh = list(matches.values())
        to_notify = fresh[:10]
        for job in to_notify:
            await repo.notify(user_id, f"Strong job match: {job['title']}",
                              f"{job.get('source', 'Job Radar')} · {job.get('matchScore')}% match · {job.get('url', '')}",
                              kind="job_match")
            notified += 1
        if to_notify:
            seen = (profile.get("radarNotifiedJobIds", []) + [j["id"] for j in to_notify])[-500:]
            await repo.update_settings_doc(user_id, {"radarNotifiedJobIds": seen}, seed.SETTINGS)
    log.info("scheduled job scan completed: %s results", result["total"])
    return {"total": result["total"], "notified": notified, "fetchedAt": result["fetchedAt"]}


async def scheduled_email_sync(ctx: dict) -> dict:
    """Poll approved per-user Outlook connections; the importer is read-only."""
    from . import db
    from .routers.inbox import inbox_sync_status, sync_outlook_inbox

    accounts = await db.list_users()
    eligible = []
    for account in accounts:
        if not account.get("id"):
            continue
        try:
            status = await inbox_sync_status(user=account)
            if status.get("ready"):
                eligible.append(account)
        except Exception:
            log.exception("Outlook sync eligibility check failed for user %s", account.get("id"))

    if not eligible:
        log.info("scheduled email sync skipped: no approved Outlook connections are ready")
        return {"status": "not_configured", "users": 0, "added": 0, "failed": 0}

    semaphore = asyncio.Semaphore(5)

    async def sync_one(account: dict) -> dict:
        async with semaphore:
            user_id = account["id"]
            try:
                result = await sync_outlook_inbox(user=account)
                return {"added": result.get("added", 0), "failed": 0}
            except Exception:
                # Do not log provider responses, message content, or credentials.
                log.exception("scheduled Outlook sync failed for user %s", user_id)
                return {"added": 0, "failed": 1}

    outcomes = await asyncio.gather(*(sync_one(account) for account in eligible))
    added = sum(item["added"] for item in outcomes)
    failed = sum(item["failed"] for item in outcomes)
    log.info("scheduled Outlook sync completed: users=%s added=%s failed=%s", len(eligible), added, failed)
    return {"status": "ok", "users": len(eligible), "added": added, "failed": failed}


def _redis_settings() -> RedisSettings:
    url = get_settings().redis_url
    if not url:
        raise RuntimeError("REDIS_URL is required to run the background queue")
    return RedisSettings.from_dsn(url)


class WorkerSettings:
    redis_settings = _redis_settings()
    functions = [scheduled_job_scan, scheduled_email_sync]
    cron_jobs = [
        cron(scheduled_job_scan, minute={0, 15, 30, 45}, run_at_startup=False),
        cron(scheduled_email_sync, minute={5, 20, 35, 50}, run_at_startup=False),
    ]
    on_startup = startup
    on_shutdown = shutdown
    max_jobs = 10
    job_timeout = 120
    keep_result = 300
