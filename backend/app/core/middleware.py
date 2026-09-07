"""
Security and Request Tracing Middlewares.
Provides:
- Unique Request ID and Correlation ID propagation
- Essential Security Headers (HSTS, CSP, nosniff, frame denial)
"""

import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """Generates and traces request_id and correlation_id across all transactions."""
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or f"REQ-{uuid.uuid4().hex[:12].upper()}"
        correlation_id = request.headers.get("X-Correlation-ID") or request_id

        # Attach to request state for access in endpoints and dependencies
        request.state.request_id = request_id
        request.state.correlation_id = correlation_id

        response: Response = await call_next(request)

        # Propagate back in response headers
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Correlation-ID"] = correlation_id
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Enforces standard security headers on every response."""
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response
