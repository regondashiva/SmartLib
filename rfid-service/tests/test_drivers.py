# ==============================================================================
# Tests for Mock RFID Device Drivers
# ==============================================================================

from drivers import staff_station, handheld_scanner, security_gate
from schemas import ScanStatus, DeviceType

def test_staff_station_single_tag():
    """Verify single tag scanning on desk reader."""
    res = staff_station.simulate_scan(tag_count=1)
    assert res.tags_detected == 1
    assert len(res.tags) == 1
    tag = res.tags[0]
    assert len(tag.rfid_epc) == 24
    assert tag.rssi_dbm < 0  # Typical UHF RSSI is negative dBm
    assert res.device_type == DeviceType.STAFF_STATION.value
    assert res.mock_emulator is True

def test_staff_station_multiple_tags():
    """Verify scanning up to 5 multiple simultaneous tags."""
    res = staff_station.simulate_scan(tag_count=4)
    assert res.tags_detected == 4
    assert len(res.tags) == 4

def test_staff_station_specific_epcs():
    """Verify specific EPC catalog binding & reference check."""
    # Circulating book copy
    circulating_epc = "3034257BF4000B4000000001"
    res = staff_station.simulate_scan(epc_list=[circulating_epc])
    assert res.tags_detected == 1
    tag = res.tags[0]
    assert tag.is_known is True
    assert tag.book_item is not None
    assert tag.book_item["accession_number"] == "ACC-2026-00001"
    assert tag.eas_armed is False  # Issued book

def test_staff_station_duplicate_detection():
    """Verify duplicate tags passed in the same scan payload."""
    staff_station.reset_duplicate_cache()
    dup_epc = "3034257BF4000B4000000003"
    res = staff_station.simulate_scan(epc_list=[dup_epc, dup_epc])
    assert res.tags_detected == 2
    assert res.tags[0].duplicate is False
    assert res.tags[1].duplicate is True

def test_handheld_scanner_reconciliation():
    """Verify handheld shelf audit correctly categorizes items."""
    target_shelf = "STACK-A/AISLE-01/SHELF-03"
    res = handheld_scanner.simulate_shelf_scan(
        target_shelf=target_shelf,
        tag_count=8,
        session_id="SESS-TEST-001"
    )
    assert res.target_shelf == target_shelf
    assert res.session_id == "SESS-TEST-001"
    assert res.total_scanned > 0
    assert (res.verified + res.misplaced + res.missing + res.uncataloged) == res.total_scanned
    assert len(res.items) == res.total_scanned

def test_handheld_misplaced_detection():
    """Verify detection of misplaced book when explicit EPCs are given."""
    # ACC-2026-00006 is on STACK-D/AISLE-04/SHELF-02
    misplaced_epc = "3034257BF4000B4000000006"
    res = handheld_scanner.simulate_shelf_scan(
        target_shelf="STACK-A/AISLE-01/SHELF-01",
        epc_list=[misplaced_epc]
    )
    assert res.total_scanned == 1
    assert res.misplaced == 1
    item = res.items[0]
    assert item.scan_status == ScanStatus.MISPLACED
    assert item.expected_shelf == "STACK-D/AISLE-04/SHELF-02"
    assert item.scanned_shelf == "STACK-A/AISLE-01/SHELF-01"

def test_security_gate_authorized_transit():
    """Issued book passing through gate with EAS bit cleared does not trigger alarm."""
    issued_epc = "3034257BF4000B4000000001"  # eas_armed = False
    event = security_gate.simulate_gate_event(rfid_epc=issued_epc)
    assert event.rfid_epc == issued_epc
    assert event.eas_armed is False
    assert event.alarm_triggered is False
    assert event.alarm_reason is None
    assert event.footfall_count > 0
    assert event.cctv_timestamp_ref.startswith("CCTV-")
    assert event.hardware_timestamp is not None

def test_security_gate_unauthorized_transit():
    """Un-issued / reference book passing through gate with EAS bit armed triggers alarm."""
    reference_epc = "3034257BF4000B4000000002"  # eas_armed = True
    event = security_gate.simulate_gate_event(rfid_epc=reference_epc)
    assert event.rfid_epc == reference_epc
    assert event.eas_armed is True
    assert event.alarm_triggered is True
    assert event.alarm_reason is not None
    assert "EAS_ARMED" in event.alarm_reason or "ITEM_NOT_ISSUED" in event.alarm_reason

def test_security_gate_force_alarm():
    """Test manual test override flag force_alarm."""
    event = security_gate.simulate_gate_event(force_alarm=True)
    assert event.alarm_triggered is True
    assert event.eas_armed is True

    event2 = security_gate.simulate_gate_event(force_alarm=False)
    assert event2.alarm_triggered is False
    assert event2.eas_armed is False
