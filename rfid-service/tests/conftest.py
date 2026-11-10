# ==============================================================================
# Pytest Configuration and Shared Fixtures for RFID Middleware
# ==============================================================================

from __future__ import annotations

import os
import shutil
import tempfile
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from config import get_settings
from buffer import offline_sync
from main import app

TEST_DIR = tempfile.mkdtemp(prefix="smartlib_rfid_test_")
DB_PATH = os.path.join(TEST_DIR, "test_events.db")

os.environ["SQLITE_BUFFER_PATH"] = DB_PATH
os.environ["BACKEND_API_URL"] = "http://127.0.0.1:59999/api/v1"
os.environ["MOCK_HARDWARE"] = "true"
os.environ["LOG_LEVEL"] = "WARNING"


@pytest_asyncio.fixture(autouse=True)
async def init_test_db():
    """Reinitialize fresh buffer database for each test."""
    settings = get_settings()
    settings.sqlite_buffer_path = DB_PATH
    if os.path.exists(DB_PATH):
        try:
            os.remove(DB_PATH)
        except Exception:
            pass
    await offline_sync.initialize_buffer()
    yield
    if os.path.exists(DB_PATH):
        try:
            os.remove(DB_PATH)
        except Exception:
            pass


@pytest_asyncio.fixture
async def async_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


@pytest.fixture(scope="session", autouse=True)
def cleanup_temp_dir():
    yield
    shutil.rmtree(TEST_DIR, ignore_errors=True)
