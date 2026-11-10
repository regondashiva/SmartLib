# ==============================================================================
# SmartLib RFID Middleware — FastAPI Application Entry Point
# ==============================================================================

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import time
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from logger import configure_logging, get_logger
from schemas import HealthResponse, SyncRequest
from buffer import offline_sync
from backend_client import probe_backend
from routers import devices, scan, events

configure_logging()
log = get_logger("smartlib.rfid")
settings = get_settings()

start_time: float = time.time()
sync_task: asyncio.Task | None = None


async def background_sync_worker() -> None:
    """Periodic background task that attempts to drain the offline buffer to the backend."""
    log.info("sync_worker.start", interval_seconds=settings.sync_interval_seconds)
    while True:
        try:
            await asyncio.sleep(settings.sync_interval_seconds)
            backend_alive = await probe_backend()
            if backend_alive:
                stats = await offline_sync.get_buffer_stats()
                if stats["pending"] > 0:
                    log.info("sync_worker.trigger", pending_events=stats["pending"])
                    await events.sync_events(SyncRequest(force_all=False))
        except asyncio.CancelledError:
            log.info("sync_worker.cancelled")
            break
        except Exception as exc:
            log.warning("sync_worker.error", error=str(exc))


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    global start_time, sync_task
    start_time = time.time()
    log.info(
        "app.startup",
        service=settings.service_name,
        mock_hardware=settings.mock_hardware,
        backend_url=settings.backend_api_url,
    )
    # Initialize SQLite buffer schema
    await offline_sync.initialize_buffer()

    # Start periodic offline sync task
    sync_task = asyncio.create_task(background_sync_worker())

    yield

    # Graceful shutdown
    if sync_task:
        sync_task.cancel()
        try:
            await sync_task
        except asyncio.CancelledError:
            pass
    log.info("app.shutdown", service=settings.service_name)


app = FastAPI(
    title="SmartLib RFID Middleware Service",
    description=(
        "IoT edge hardware middleware for SmartLib RFID Library Management System. "
        "Provides mock device drivers for Staff Station, Handheld Inventory Wand, "
        "and Security Gate EAS, with local SQLite offline event buffering."
    ),
    version="1.0.0-phase2b",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(devices.router)
app.include_router(scan.router)
app.include_router(events.router)


@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check() -> HealthResponse:
    """
    Service health check:
    - Service status and uptime
    - Mock hardware indicator
    - Backend connectivity probe
    - Local SQLite offline buffer queue metrics
    """
    backend_alive = await probe_backend()
    buffer_stats = await offline_sync.get_buffer_stats()
    uptime = time.time() - start_time

    return HealthResponse(
        status="HEALTHY",
        service=settings.service_name,
        version="1.0.0-phase2b",
        mock_hardware=settings.mock_hardware,
        backend_connected=backend_alive,
        backend_url=settings.backend_api_url,
        buffer_path=settings.sqlite_buffer_path,
        pending_events=buffer_stats["pending"],
        devices_online=3 if settings.mock_hardware else 0,
        uptime_seconds=round(uptime, 2),
        timestamp=datetime.now(timezone.utc),
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.service_port, reload=True)
