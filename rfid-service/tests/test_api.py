# ==============================================================================
# Tests for FastAPI REST Endpoints & Integration
# ==============================================================================

import pytest
from unittest.mock import AsyncMock, patch
from schemas import ProcessingStatus

@pytest.mark.asyncio
async def test_get_health(async_client):
    """Verify GET /health returns expected system telemetry."""
    res = await async_client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "HEALTHY"
    assert data["service"] == "smartlib-rfid-middleware"
    assert data["mock_hardware"] is True
    assert "devices_online" in data
    assert "uptime_seconds" in data

@pytest.mark.asyncio
async def test_get_devices(async_client):
    """Verify GET /devices lists the 3 mock hardware readers."""
    res = await async_client.get("/devices")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 3
    assert data["mock_mode"] is True
    ids = [d["device_id"] for d in data["devices"]]
    assert "DEV-SS-001" in ids
    assert "DEV-HH-001" in ids
    assert "DEV-SG-001" in ids

@pytest.mark.asyncio
async def test_get_devices_status(async_client):
    """Verify GET /devices/status checks online state."""
    res = await async_client.get("/devices/status")
    assert res.status_code == 200
    data = res.json()
    assert data["all_online"] is True
    assert len(data["devices"]) == 3

@pytest.mark.asyncio
async def test_post_staff_station_scan(async_client):
    """Verify POST /devices/staff-station/scan handles scanning multiple items."""
    payload = {
        "tag_count": 3
    }
    res = await async_client.post("/devices/staff-station/scan", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["tags_detected"] == 3
    assert len(data["tags"]) == 3
    assert data["mock_emulator"] is True

@pytest.mark.asyncio
async def test_post_handheld_scan(async_client):
    """Verify POST /devices/handheld/scan reconciles bulk scans against a shelf."""
    payload = {
        "target_shelf": "STACK-B/AISLE-02/SHELF-05",
        "tag_count": 6,
        "session_id": "AUDIT-2026-X"
    }
    res = await async_client.post("/devices/handheld/scan", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["target_shelf"] == "STACK-B/AISLE-02/SHELF-05"
    assert data["session_id"] == "AUDIT-2026-X"
    assert data["total_scanned"] == 6

@pytest.mark.asyncio
async def test_security_gate_event_offline_buffering(async_client):
    """
    Verify POST /devices/security-gate/event falls back to offline SQLite buffer
    when backend Express API is unavailable.
    """
    payload = {
        "rfid_epc": "3034257BF4000B4000000002",  # Reference copy -> alarm
        "footfall_count": 42
    }
    res = await async_client.post("/devices/security-gate/event", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["rfid_epc"] == "3034257BF4000B4000000002"
    assert data["alarm_triggered"] is True
    assert data["footfall_count"] == 42
    # Because backend test port is down, should have buffered offline
    assert data["buffered_offline"] is True
    assert data["processing_status"] == ProcessingStatus.PENDING.value

    # Verify event appears in pending events endpoint
    pending_res = await async_client.get("/events/pending")
    assert pending_res.status_code == 200
    p_data = pending_res.json()
    assert p_data["pending"] >= 1
    assert any(e["event_id"] == data["event_id"] for e in p_data["events"])

@pytest.mark.asyncio
async def test_events_sync_simulation(async_client):
    """
    Verify POST /events/sync replays pending events when backend connection is restored.
    """
    # 1. Trigger a gate event to buffer it
    payload = {"rfid_epc": "3034257BF4000B4000000001"}
    await async_client.post("/devices/security-gate/event", json=payload)

    # 2. Check pending
    pending_res = await async_client.get("/events/pending")
    assert pending_res.json()["pending"] >= 1

    # 3. Simulate backend restored by mocking sync_buffered_event to return True
    with patch("routers.events.sync_buffered_event", new_callable=AsyncMock) as mock_sync:
        mock_sync.return_value = True
        sync_res = await async_client.post("/events/sync", json={"force_all": True})
        assert sync_res.status_code == 200
        sync_data = sync_res.json()
        assert sync_data["synced"] >= 1
        assert sync_data["remaining_pending"] == 0

    # 4. Confirm pending count is now 0
    pending_after = await async_client.get("/events/pending")
    assert pending_after.json()["pending"] == 0

