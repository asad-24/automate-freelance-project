"""Security layer — headers, rate limiting, request IDs, optional API-key auth.

Cybersecurity posture for the in-memory phase:
- SecurityHeadersMiddleware: hardened HTTP response headers on every request.
- RateLimitMiddleware: per-IP sliding-window rate limit (abuse protection).
- ApiKeyMiddleware: when API_KEY env is set, all non-GET requests require
  the X-API-Key header. Disabled by default in local dev.
- Every request gets an X-Request-Id for traceability (audit correlation).
"""
import time
import uuid
from collections import defaultdict, deque

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from .config import get_settings

# Sliding window: max N requests per IP per 60s window
_RATE_WINDOW = 60.0
_RATE_MAX = 240
_hits: dict[str, deque] = defaultdict(deque)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request.state.request_id = uuid.uuid4().hex[:12]
        response = await call_next(request)
        response.headers["X-Request-Id"] = request.state.request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["X-XSS-Protection"] = "0"
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        ip = request.client.host if request.client else "unknown"
        now = time.monotonic()
        q = _hits[ip]
        while q and now - q[0] > _RATE_WINDOW:
            q.popleft()
        if len(q) >= _RATE_MAX:
            return JSONResponse(
                {"detail": "Rate limit exceeded"}, status_code=429,
                headers={"Retry-After": str(int(_RATE_WINDOW))},
            )
        q.append(now)
        return await call_next(request)


class ApiKeyMiddleware(BaseHTTPMiddleware):
    """Optional hard gate for mutating requests.

    Set API_KEY in backend/.env to require X-API-Key on POST/PATCH/DELETE.
    Health + GETs stay open (dashboard read paths). Disabled when unset.
    """

    _SAFE_PREFIXES = ("/health", "/docs", "/openapi.json", "/api/meta")

    async def dispatch(self, request: Request, call_next):
        api_key = getattr(get_settings(), "api_key", None) or None
        if not api_key:
            return await call_next(request)
        # The inbound webhook has its own constant-time Bearer secret check.
        # Exempt it from the general browser/API key so mail providers can post.
        if request.url.path.endswith("/inbox/inbound"):
            return await call_next(request)
        if request.method in ("GET", "HEAD", "OPTIONS") or request.url.path.startswith(self._SAFE_PREFIXES):
            return await call_next(request)
        if request.headers.get("x-api-key") != api_key:
            return JSONResponse({"detail": "Invalid or missing API key"}, status_code=401)
        return await call_next(request)
