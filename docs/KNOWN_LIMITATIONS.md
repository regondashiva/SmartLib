# SmartLib v1.6.0 — Known Limitations & Honest Disclosure

**Document ID:** `SMARTLIB-KNOWN-LIMITATIONS-v1.6.0`  
**Application:** SmartLib RFID-Enabled Integrated Library Management System  
**Audit & Closure Date:** November 10, 2026  
**Standard:** AISYS Technical Evaluation Guidelines (Truthful and Honest Disclosure)  

---

## 1. Executive Disclosure

In strict compliance with AISYS evaluation criteria and ethical engineering principles, this document formally records all operational, environmental, and architectural limitations of SmartLib v1.6.0.

No mock implementation is claimed as physical hardware, and no simulated capability is presented as physical execution.

---

## 2. Documented System Limitations

### Limitation 1: RFID Hardware Operates via Software Emulation
- **Current Implementation**: The Python FastAPI middleware (`rfid-service/`) provides complete software emulation drivers for the RFID Staff Station pad, Handheld Inventory Scanner, and Dual-Pedestal Security Gate (`MOCK_HARDWARE=true`, `MOCK_RFID_MODE=true`).
- **Limitation**: Physical LLRP (Low-Level Reader Protocol), Zebra, Impinj, or Feig RFID readers and antennas were not physically connected, RF-tuned, or field-tested.
- **Production Commissioning Requirement**: Deployment engineers must connect physical reader USB/Ethernet interfaces and implement vendor-specific SDK bindings against the `IAdapter` interface before live facility cutover.

---

### Limitation 2: Security Gate CCTV Uses Synthetic Reference Frames
- **Current Implementation**: When an unauthorized transit triggers a security gate alarm, SmartLib generates a synthetic timestamped reference snapshot (`CAM-GATE-01_[timestamp]`) and associates it with the `GateEvent` record.
- **Limitation**: Live RTSP / ONVIF IP surveillance cameras and NVR/DVR video encoders were not physically integrated.
- **Production Commissioning Requirement**: Integration with physical video management systems (e.g. Milestone, Genetec, Hikvision) requires configuring the RTSP video stream endpoint.

---

### Limitation 3: Multi-Channel Notification Dispatch is Mocked
- **Current Implementation**: The asynchronous notification queue state machine (`PENDING` -> `SENT` / `FAILED` -> `RETRY` -> `SENT`), template rendering, patron channel opt-in/opt-out preferences, and delivery logs are fully functional in software.
- **Limitation**: Actual external SMTP mail servers, SMS gateways (e.g., Twilio, AWS SNS), and physical thermal receipt printers are mocked via software adapter boundaries (`externalDeliveryClaimed: false`). Real cellular text messages or external emails were not transmitted over the public telephone or mail network.
- **Production Commissioning Requirement**: Production deployment requires configuring institutional SMTP credentials and SMS provider API keys in system settings.

---

### Limitation 4: Database Disaster Recovery Tested via Isolated Local Schema
- **Current Implementation**: Automated SQL backup generation, SHA-256 manifest verification, and disaster recovery restore were tested and verified via `POST /api/v1/system/restore`.
- **Limitation**: The recovery test verified schema generation and table population into an isolated temporary schema (`test_restore_[timestamp]` / `smartlib_pg_rst_...`) on the same PostgreSQL host. Full multi-node, cross-server disaster recovery and physical standby replication were not tested.
- **Production Commissioning Requirement**: Enterprise disaster recovery across geographically distinct database clusters requires physical standby replication (e.g. PostgreSQL streaming replication or WAL archiving).

---

### Limitation 5: Full Air-Gapped Windows Installation Not Formally Demonstrated
- **Current Implementation**: The offline installation package (`deploy/offline-package/`) verifies SHA-256 receipts of pre-bundled frontend assets, backend JavaScript bundles, and Prisma schema files.
- **Limitation**: While offline file staging and Python SQLite event queue buffering operate completely offline, the core backend currently communicates with a cloud-hosted Neon serverless PostgreSQL database. Full air-gapped installation on a completely isolated Windows machine without internet access requires pre-installing a local PostgreSQL 16 Windows service.
- **Production Commissioning Requirement**: For air-gapped facilities, install the official PostgreSQL Windows MSI before executing the SmartLib offline installer script.

---

### Limitation 6: Transient Remote Cloud Latency in Repeatability Benchmark
- **Current Implementation**: Three consecutive repeatability runs of the 129-test backend suite were executed under `backend/scripts/repeatability-runs.ps1`.
- **Results**:
  - Run 1: **17/17 suites passed, 129/129 tests passed, Exit Code 0** (1191s).
  - Run 2: **16/17 suites passed, 128/129 tests passed, Exit Code 1** (1328s).
  - Run 3: **17/17 suites passed, 129/129 tests passed, Exit Code 0** (1178s).
- **Limitation**: In Run 2, a single test encountered a cross-continental TCP socket drop to Neon AWS US-East (`Prisma error [P1001]: Can't reach database server at ep-noisy-dream-bd6bdm2n-pooler.c-8.us-east-2.aws.neon.tech:5432`). Zero application bugs or logic errors occurred.
- **Production Commissioning Requirement**: For CI/CD automation, provision a dedicated local Docker PostgreSQL container or local PostgreSQL instance (`TEST_DATABASE_URL`) to eliminate public internet socket drops.

---

### Limitation 7: Shared Database Contains Test-Created Entities
- **Current Implementation**: Automated integration tests execute against the configured Neon PostgreSQL database.
- **Preservation Status**: Institutional baseline seed records remain 100% intact:
  - `users`: **7**
  - `roles`: **4**
  - `books`: **52** (All 29 baseline titles intact + test records)
  - `members`: **14** (All baseline patrons intact)
  - `circulations`: **19**
- **Limitation**: Because integration tests dynamically provision isolated monographs and test patrons without dropping tables, the database contains accumulated test-created records alongside baseline seed records.
- **Production Commissioning Requirement**: Execute `npx prisma db push --force-reset && npm run seed` when deploying to a clean, fresh production environment.
