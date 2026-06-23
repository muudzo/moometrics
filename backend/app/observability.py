"""
Observability: structured JSON logging, request-ID propagation, and optional
Sentry error tracking.

Logs are emitted as one JSON object per line (easy to ship to any aggregator),
each tagged with the current request id. The ``Authorization`` header and
cookies are never logged.
"""

import json
import logging
import time
import uuid
from contextvars import ContextVar

from fastapi import FastAPI, Request
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import Settings

_request_id: ContextVar[str] = ContextVar("request_id", default="-")

logger = logging.getLogger("moometrics.access")


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(record.created)),
            "level": record.levelname,
            "logger": record.name,
            "request_id": _request_id.get(),
            "message": record.getMessage(),
        }
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        for key, value in getattr(record, "extra_fields", {}).items():
            payload[key] = value
        return json.dumps(payload, default=str)


def configure_logging(settings: Settings) -> None:
    """Install the JSON formatter on the root logger (idempotent)."""
    handler = logging.StreamHandler()
    if settings.log_format == "json":
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s")
        )
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(settings.log_level.upper())


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Assign/propagate an ``X-Request-ID`` and log one line per request."""

    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex
        token = _request_id.set(request_id)
        start = time.perf_counter()
        try:
            response = await call_next(request)
        finally:
            duration_ms = round((time.perf_counter() - start) * 1000, 1)
        response.headers["X-Request-ID"] = request_id
        logger.info(
            "request",
            extra={
                "extra_fields": {
                    "method": request.method,
                    "path": request.url.path,
                    "status": response.status_code,
                    "duration_ms": duration_ms,
                }
            },
        )
        _request_id.reset(token)
        return response


def init_sentry(settings: Settings) -> None:
    """Initialize Sentry if a DSN is configured; otherwise a no-op."""
    if not settings.sentry_dsn:
        return
    try:
        import sentry_sdk

        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            environment=settings.environment,
            traces_sample_rate=settings.sentry_traces_sample_rate,
        )
        logging.getLogger(__name__).info("Sentry error tracking enabled")
    except Exception:  # pragma: no cover - never block startup on telemetry
        logging.getLogger(__name__).exception("Failed to initialize Sentry")


def install_observability(app: FastAPI, settings: Settings) -> None:
    configure_logging(settings)
    init_sentry(settings)
    app.add_middleware(RequestContextMiddleware)
