# ==============================================================================
# Tests for Local SQLite Offline Event Buffer
# ==============================================================================

from datetime import datetime, timezone
import pytest
from buffer import offline_sync

@pytest.mark.asyncio
async def test_buffer_insert_and_retrieve():
    """Verify storing an offline event and reading it back."""
    event_id = "EVT-TEST-0001"
    now = datetime.now(timezone.utc)
    payload = {"foo": "bar", "test": True}

    inserted = await offline_sync.buffer_gate_event(
        event_id=event_id,
        rfid_epc="3034257BF4000B4000000001",
        device_id="DEV-SG-001",
        device_type="SECURITY_GATE",
        hardware_timestamp=now,
        payload=payload,
        accession_number="ACC-2026-00001",
    )
    assert inserted is True

    pending = await offline_sync.get_pending_events()
    assert len(pending) == 1
    item = pending[0]
    assert item["event_id"] == event_id
    assert item["rfid_epc"] == "3034257BF4000B4000000001"
    assert item["processing_status"] == "PENDING"
    assert item["hardware_timestamp"] == now.isoformat()

@pytest.mark.asyncio
async def test_buffer_duplicate_rejection():
    """Verify duplicate event IDs cannot be inserted twice into the buffer."""
    event_id = "EVT-DUP-0001"
    now = datetime.now(timezone.utc)
    payload = {"sample": 123}

    first = await offline_sync.buffer_gate_event(
        event_id=event_id,
        rfid_epc="3034257BF4000B4000000002",
        device_id="DEV-SG-001",
        device_type="SECURITY_GATE",
        hardware_timestamp=now,
        payload=payload,
    )
    assert first is True

    # Duplicate insertion attempt
    second = await offline_sync.buffer_gate_event(
        event_id=event_id,
        rfid_epc="3034257BF4000B4000000002",
        device_id="DEV-SG-001",
        device_type="SECURITY_GATE",
        hardware_timestamp=now,
        payload=payload,
    )
    assert second is False

    is_dup = await offline_sync.is_duplicate_event(event_id)
    assert is_dup is True

@pytest.mark.asyncio
async def test_buffer_mark_synced_and_stats():
    """Verify status transitions to SYNCED and buffer counters."""
    event_id = "EVT-SYNC-0001"
    now = datetime.now(timezone.utc)

    await offline_sync.buffer_gate_event(
        event_id=event_id,
        rfid_epc="3034257BF4000B4000000003",
        device_id="DEV-SG-001",
        device_type="SECURITY_GATE",
        hardware_timestamp=now,
        payload={},
    )

    stats_before = await offline_sync.get_buffer_stats()
    assert stats_before["pending"] == 1
    assert stats_before["synced"] == 0

    await offline_sync.mark_event_synced(event_id)

    stats_after = await offline_sync.get_buffer_stats()
    assert stats_after["pending"] == 0
    assert stats_after["synced"] == 1

@pytest.mark.asyncio
async def test_buffer_retry_and_failure_transition():
    """Verify marking failure increments retry count and sets FAILED after 5 retries."""
    event_id = "EVT-FAIL-0001"
    now = datetime.now(timezone.utc)

    await offline_sync.buffer_gate_event(
        event_id=event_id,
        rfid_epc="3034257BF4000B4000000004",
        device_id="DEV-SG-001",
        device_type="SECURITY_GATE",
        hardware_timestamp=now,
        payload={},
    )

    # 4 failures should keep it PENDING
    for i in range(4):
        await offline_sync.mark_event_failed(event_id, f"Temporary network timeout {i}")
    
    events, _ = await offline_sync.get_all_events(status="PENDING")
    assert len(events) == 1
    assert events[0]["sync_attempts"] == 4

    # 5th failure transitions to FAILED
    await offline_sync.mark_event_failed(event_id, "Fatal retry threshold exceeded")
    
    events_failed, _ = await offline_sync.get_all_events(status="FAILED")
    assert len(events_failed) == 1
    assert events_failed[0]["sync_attempts"] == 5

@pytest.mark.asyncio
async def test_buffer_persistence_across_restart():
    """Verify SQLite buffer schema and events survive simulated middleware restarts."""
    event_id = "EVT-PERSIST-0001"
    now = datetime.now(timezone.utc)

    await offline_sync.buffer_gate_event(
        event_id=event_id,
        rfid_epc="3034257BF4000B4000000005",
        device_id="DEV-SG-001",
        device_type="SECURITY_GATE",
        hardware_timestamp=now,
        payload={"persistent": True},
    )

    # Simulate restart by re-running initialize_buffer
    await offline_sync.initialize_buffer()

    pending = await offline_sync.get_pending_events()
    assert any(e["event_id"] == event_id for e in pending)

