# ==============================================================================
# SmartLib RFID Middleware — Backend API Client
# Communicates with the Express backend. Never connects to Neon directly.
# Implements: auth, retry, timeout, structured error handling.
# ==============================================================================

from __future__ import annotations
import time
from typing import Any, Optional
import httpx
from tenacity import (
    retry,
    stop_after_attempt,
    wait_fixed,
    retry_if_exception_type,
    before_sleep_log,
)
import logging

from config import get_settings
from logger import get_logger

log = get_logger(__name__)
settings = get_settings()

# Cached JWT token for service-to-service auth
_access_token: Optional[str] = None
_token_fetched_at: float = 0.0
_TOKEN_TTL_SECONDS = 800  # refresh well before the 15-min JWT expiry


def _build_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=settings.backend_api_url,
        timeout=httpx.Timeout(settings.backend_request_timeout),
        headers={"Content-Type": "application/json"},
    )


async def _get_token() -> str:
    """
    Fetch or return a cached JWT access token from the backend.
    The RFID middleware authenticates with the backend using the
    configured service account credentials.
    """
    global _access_token, _token_fetched_at

    now = time.monotonic()
    if _access_token and (now - _token_fetched_at) < _TOKEN_TTL_SECONDS:
        return _access_token

    log.info("rfid_client.auth", action="fetching_backend_token")
    async with _build_client() as client:
        resp = await client.post(
            "/auth/login",
            json={
                "email": settings.backend_login_email,
                "password": settings.backend_login_password,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        _access_token = data["data"]["accessToken"]
        _token_fetched_at = now
        log.info("rfid_client.auth", action="token_obtained")
        return _access_token


async def _authorized_headers() -> dict[str, str]:
    token = await _get_token()
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Backend connectivity probe
# ---------------------------------------------------------------------------

async def probe_backend() -> bool:
    """Returns True if the backend health endpoint responds successfully."""
    try:
        async with _build_client() as client:
            resp = await client.get("/health")
            return resp.status_code == 200
    except Exception as exc:
        log.warning("rfid_client.probe", status="unreachable", error=str(exc))
        return False


# ---------------------------------------------------------------------------
# Book item lookup by EPC
# ---------------------------------------------------------------------------

@retry(
    stop=stop_after_attempt(settings.backend_max_retries),
    wait=wait_fixed(settings.backend_retry_delay),
    retry=retry_if_exception_type((httpx.TimeoutException, httpx.ConnectError)),
    before_sleep=before_sleep_log(logging.getLogger(__name__), logging.WARNING),
    reraise=True,
)
async def lookup_tag_by_epc(epc: str) -> Optional[dict[str, Any]]:
    """
    Look up a book item in the backend by RFID EPC.
    Returns the book item data dict, or None if not found.
    """
    try:
        headers = await _authorized_headers()
        async with _build_client() as client:
            # Query the backend RFID tags endpoint
            resp = await client.get(
                "/rfid/tags",
                headers=headers,
                params={"epc": epc, "limit": 1},
            )
            if resp.status_code == 200:
                data = resp.json()
                items = data.get("data", [])
                if items:
                    return items[0]
        return None
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code in (401, 403):
            # Token may be expired — invalidate cache and retry once
            global _access_token
            _access_token = None
            log.warning("rfid_client.lookup", action="token_invalidated", epc=epc)
        raise
    except Exception as exc:
        log.error("rfid_client.lookup", error=str(exc), epc=epc)
        raise


# ---------------------------------------------------------------------------
# Record gate event in backend
# ---------------------------------------------------------------------------

async def post_gate_event_to_backend(payload: dict[str, Any]) -> bool:
    """
    POST a gate event to the backend for persistence.
    Returns True on success, False on failure (triggers offline buffering).
    """
    try:
        headers = await _authorized_headers()
        async with _build_client() as client:
            resp = await client.post(
                "/rfid/gate-events",
                headers=headers,
                json=payload,
            )
            if resp.status_code in (200, 201):
                log.info(
                    "rfid_client.gate_event",
                    action="posted",
                    event_id=payload.get("event_id"),
                )
                return True
            log.warning(
                "rfid_client.gate_event",
                action="backend_rejected",
                status=resp.status_code,
                body=resp.text[:200],
            )
            return False
    except Exception as exc:
        log.warning(
            "rfid_client.gate_event",
            action="backend_unavailable",
            error=str(exc),
        )
        return False


# ---------------------------------------------------------------------------
# Sync a buffered event (used by offline sync worker)
# ---------------------------------------------------------------------------

async def sync_buffered_event(payload: dict[str, Any]) -> bool:
    """
    Attempt to sync a single buffered gate event to the backend.
    Returns True on success.
    """
    return await post_gate_event_to_backend(payload)

