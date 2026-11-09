"""Autopilot — Autonomous AI Agency & Career Ecosystem backend.

FastAPI application entry point. User accounts and per-user data persist in
MongoDB when MONGODB_URI is set (see db.py, repo.py); otherwise in memory.
Run:  uvicorn app.main:app --reload --port 8000
Docs: http://localhost:8000/docs
"""
import logging
import json
import time
import uuid
from contextvars import ContextVar

import sentry_sdk
from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import db, repo, finance_store
from . import integrations
from .auth import current_user, require_roles
from .config import get_settings
from .routers import (
    activity, admin, agents, auth, automation, billing, core, demo, freelancer, growth,
    operations, pipeline, portal, public, radar, revenue, studio, system, upwork, workspace, inbox, finance,
)
from .security import ApiKeyMiddleware, RateLimitMiddleware, SecurityHeadersMiddleware
from .store import init_store

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")


class JsonLogFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(record.created)),
            "level": record.levelname.lower(),
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", request_id_var.get()),
        }
        for key in ("method", "path", "status_code", "duration_ms"):
            if hasattr(record, key):
                payload[key] = getattr(record, key)
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, separators=(",", ":"))


handler = logging.StreamHandler()
handler.setFormatter(JsonLogFormatter())
logging.basicConfig(level=logging.INFO, handlers=[handler], force=True)
log = logging.getLogger("autopilot")

settings = get_settings()
settings.validate_for_production()
if settings.sentry_dsn:
    sentry_sdk.init(dsn=settings.sentry_dsn, environment=settings.environment, traces_sample_rate=0.05)

app = FastAPI(
    title="Autopilot Agency API",
    version="0.3.0",
    description="Backend for the Autonomous AI Agency & Career Ecosystem (MongoDB-persisted).",
)


@app.middleware("http")
async def request_logging(request: Request, call_next):
    supplied_id = request.headers.get("X-Request-ID", "")
    request_id = supplied_id[:128] if supplied_id and all(c.isalnum() or c in "-_." for c in supplied_id[:128]) else uuid.uuid4().hex
    token = request_id_var.set(request_id)
    started = time.monotonic()
    try:
        response = await call_next(request)
    except Exception:
        sentry_sdk.capture_exception()
        log.exception("request failed", extra={"request_id": request_id})
        response = JSONResponse(status_code=500, content={"detail": "Internal server error", "request_id": request_id})
    response.headers["X-Request-ID"] = request_id
    log.info("request completed", extra={"request_id": request_id, "method": request.method,
                                          "path": request.url.path, "status_code": response.status_code,
                                          "duration_ms": round((time.monotonic() - started) * 1000, 2)})
    request_id_var.reset(token)
    return response

# Security middleware (applied outermost → innermost in reverse order)
app.add_middleware(ApiKeyMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(SecurityHeadersMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup() -> None:
    # In-memory catalog + demo data (plans, and the demo-only routers below).
    # Never persisted — real user data lives in repo.py's collections.
    init_store()
    if db.enabled():
        await repo.ensure_indexes()
        await finance_store.ensure_indexes()
        await repo.archive_legacy_state()
        log.info("MongoDB connected")
    else:
        log.warning("MONGODB_URI not set — accounts and data are kept in memory only")


@app.get("/health")
async def health() -> dict:
    database = "in-memory"
    if db.enabled():
        try:
            await db._get_db().command("ping")
            database = "ok"
        except Exception:
            log.exception("health check: MongoDB ping failed")
            return JSONResponse(status_code=503, content={
                "status": "degraded", "environment": settings.environment,
                "version": "0.3.0", "database": "unavailable",
            })
    return {
        "status": "ok",
        "environment": settings.environment,
        "version": "0.3.0",
        "database": database,
    }


# Public — no session needed (login/signup, pricing, beta signup). /auth/me
# guards itself.
for r in (public.router, auth.router):
    app.include_router(r, prefix=settings.api_prefix)

# Per-user data for every signed-in role — each route scopes to the caller.
for r in (workspace.router, billing.router, activity.router):
    app.include_router(r, prefix=settings.api_prefix, dependencies=[Depends(current_user)])
app.include_router(radar.router, prefix=settings.api_prefix, dependencies=[Depends(current_user)])
app.include_router(inbox.router, prefix=settings.api_prefix)
app.include_router(integrations.router, prefix=settings.api_prefix,
                   dependencies=[Depends(current_user)])
app.include_router(finance.router, prefix=settings.api_prefix, dependencies=[Depends(current_user)])

# Agency dashboard — admin accounts only.
for r in (studio.router, growth.router, freelancer.router, upwork.router,
          automation.router):
    app.include_router(r, prefix=settings.api_prefix, dependencies=[Depends(require_roles("admin"))])

# Demo-data features (agents, arbitrage, QA, contracts, portals…) read one
# shared in-memory store, so they're only served when SEED_DEMO_DATA=true —
# never alongside real users' data. The frontend shows them as "Coming soon".
if settings.seed_demo_data:
    for r in (core.router, agents.router, pipeline.router):
        app.include_router(r, prefix=settings.api_prefix, dependencies=[Depends(require_roles("admin"))])
    for r in (operations.router, revenue.router, system.router, portal.router, admin.router, demo.router):
        app.include_router(r, prefix=settings.api_prefix, dependencies=[Depends(current_user)])
