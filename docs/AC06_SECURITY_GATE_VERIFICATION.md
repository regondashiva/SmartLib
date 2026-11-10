# SmartLib — AC06 Security Gate, EAS, Footfall & Mock CCTV Verification Report

**Document ID:** `VER-AC06-5B`  
**Phase:** Phase 5B Final Acceptance Verification  
**Verification Date:** November 9, 2026  
**Status:** **PASS (Verified via Software Adapter & Mock CCTV Frame Generator)**

---

## 1. Scope of Verification

This report records the end-to-end verification of AISYS requirement **AC06** (Security Gate EAS Monitoring, Unauthorized Item Detection, Offline Security-Bit Reading, Bidirectional Footfall Tracking, and CCTV Correlation):

1. **EAS Security-Bit Reading (`easArmed`):**
   - Books encoded at the RFID tagging station default to `easArmed = true`.
   - Checkout (`POST /api/v1/circulation/issue`, NCIP `CheckOutItem`, or SIP2 `11`) disarms the tag (`easArmed = false`).
   - Check-in (`POST /api/v1/circulation/return`, NCIP `CheckInItem`, or SIP2 `09`) re-arms the tag (`easArmed = true`).
2. **Unauthorized Item Detection & Accession Recording:**
   - When an armed tag (`easArmed = true`) or uncatalogued tag transits the gate (`POST /api/v1/rfid/gate-events` or `POST /devices/security-gate/event`), the gate flags `alarmTriggered = true` and `unauthorizedItemDetected = true`, resolves the physical copy (`accessionNumber`), and records an immutable `AuditLog` entry (`entityName = 'GateEvent'`).
3. **Offline Security-Bit Reading & SQLite Buffering:**
   - The Python FastAPI security gate driver (`rfid-service/drivers/security_gate.py`) evaluates `eas_armed` locally (`offline_security_bit_read = true`) and persists transit events into `rfid-service/data/offline_events.db` when the backend is unreachable, replaying them in FIFO order upon reconnection.
4. **Mock CCTV Synthetic Image Attachment:**
   - Every security gate event generates a deterministic `cctvTimestampRef` (`CAM-GATE-01_<ISO-Timestamp>`) and attaches a valid, renderable synthetic SVG camera frame (`cctvImageAttachment.dataUri` / `svgMarkup`, `640x360`, `image/svg+xml`) displaying the gate code, direction, EPC, accession number, footfall counter, and target pedestal zone overlay.
   - Retrievable via `GET /api/v1/rfid/gate-events/:id/cctv-snapshot` and `POST /api/v1/adapters/devices/CAMERA/command` (`CAPTURE_SNAPSHOT`).
5. **Bidirectional Footfall Entry & Exit Recording:**
   - Supports `direction: 'ENTRY' | 'EXIT'` on gate events and dedicated footfall sensors (`POST /api/v1/rfid/footfall`, `GET /api/v1/rfid/footfall`), aggregating `totalEntries` and `totalExits` in `DeviceEvent` (`FOOTFALL_ENTRY` / `FOOTFALL_EXIT`).

---

## 2. Implementation & Test Evidence

- **Backend Implementation:** `backend/src/modules/rfid/rfid.service.ts` (`recordGateEvent`, `getGateEventCctvSnapshot`, `recordFootfallEvent`, `getFootfallSummary`, `generateSyntheticCctvSnapshot`)
- **Python Middleware Implementation:** `rfid-service/drivers/security_gate.py`, `rfid-service/routers/scan.py`, `rfid-service/buffer/offline_sync.py`
- **Verification Commands & Results:**
  - `npx --prefix backend vitest run tests/phase5b-acceptance.test.ts` — **Test 1 & Test 2 PASSED (`EXIT 0`)**
  - `python -m pytest rfid-service/tests` — **21 / 21 PASSED (`EXIT 0`)**

---

## 3. Documented Hardware Boundary

- **Mock Hardware & Synthetic Camera Frame:** All gate transits, siren/strobe triggers, and CCTV snapshots use deterministic mock drivers (`MOCK_RFID_MODE=true`) and synthetic SVG frame rendering. No physical LLRP dual-pedestal gate or live RTSP/ONVIF NVR camera stream is connected in this evaluation environment.

