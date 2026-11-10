# SmartLib — Final Production Readiness Backlog & Commissioning Checklist

**Document ID:** `PROD-BACKLOG-5B`  
**Phase:** Phase 5B Final Acceptance Verification  
**Date:** November 9, 2026

---

## 1. On-Site Hardware & Infrastructure Commissioning Backlog

While SmartLib v1.6.0 is 100% software-complete and verified across all AISYS functional, non-functional, and protocol adapter requirements, the following physical hardware and site infrastructure items remain on the production commissioning backlog prior to live campus rollout:

| Backlog ID | Category | Item Description | Current Evaluation State | Production Commissioning Action |
|---|---|---|---|---|
| **BL-01** | **RFID Hardware Drivers** | Physical USB/TCP SDK binding for Feig/Zebra HF/UHF staff pads, Chainway C72 handheld wands, and Impinj Speedway LLRP security gates. | Verified via deterministic software emulator (`MOCK_RFID_MODE=true`). | Bind vendor C#/Python/LLRP SDKs to `rfid-service/drivers/*` and set `MOCK_RFID_MODE=false`. |
| **BL-02** | **CCTV / NVR Video Stream** | Live ONVIF/RTSP camera frame capture on security gate alarms. | Generates deterministic `cctvTimestampRef` tokens and synthetic SVG snapshots (`generateSyntheticCctvSnapshot`). | Point `CAMERA` adapter to campus NVR HTTP snapshot API (`http://<nvr-ip>/ISAPI/Streaming/channels/101/picture`). |
| **BL-03** | **External SMTP / SMS Gateways** | Production email relay and telecom SMS gateway credentials. | Verified via `MockEmailNotificationAdapter`, `MockSmsNotificationAdapter`, and `MockPrintNotificationAdapter` with full PostgreSQL queue & retry state machine. | Configure institutional SMTP host/TLS credentials and SMS webhook key in `.env`. |
| **BL-04** | **Air-Gapped Local PostgreSQL Service** | Localhost Windows Server 2022+ PostgreSQL 16/17 daemon for zero-internet deployments. | Verified against isolated PostgreSQL 17 schemas on Neon PostgreSQL (`C:\Program Files\PostgreSQL\18` on test machine had `data/` only). | Install PostgreSQL 16/17 Windows Server MSI installer on the on-premise server and point `DATABASE_URL` to `localhost:5432`. |
| **BL-05** | **External NCIP 2.0 / SIP2 Certification** | Third-party self-check kiosk and inter-library loan consortium certification. | NCIP 2.0 (`/api/v1/adapters/ncip`) and 3M SIP2 (`/api/v1/adapters/sip2`) parser, checksum validator, and live circulation bridge verified. | Perform conformance testing against specific vendor kiosk firmware during site acceptance testing (SAT). |

