# SmartLib v1.6.0 — Known Limitations & Honest Disclosure

> **Official Submission Document**  
> **Master Reference:** [docs/KNOWN_LIMITATIONS.md](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/docs/KNOWN_LIMITATIONS.md)

## Formal Disclosure of System Limitations

In strict adherence to AISYS technical evaluation guidelines and ethical engineering principles, the following operational and architectural boundaries are formally documented:

1. **RFID Hardware Uses Software Emulation**: The RFID Staff Station, Handheld Inventory Scanner, and Dual-Pedestal Security Gate operate via Python software emulation drivers (`MOCK_HARDWARE=true`, `MOCK_RFID_MODE=true`). Physical Zebra/Impinj LLRP readers were not physically connected.
2. **CCTV Integration Uses Synthetic Reference Frames**: Gate transit alarm events attach synthetic timestamped reference snapshots (`CAM-GATE-01_[timestamp]`); live RTSP IP cameras and physical NVR encoders were not connected.
3. **Multi-Channel Notification Dispatch is Mocked**: The notification queue state machine, template engine, and user preferences are fully implemented in software, but external delivery via SMTP mail servers or SMS gateways (e.g. Twilio) is mocked (`externalDeliveryClaimed: false`).
4. **Disaster Recovery Restore Verified via Local Isolated Schema**: Backup restoration was verified within an isolated temporary PostgreSQL schema on the same database host. Multi-node, cross-server disaster recovery and physical standby replication were not tested.
5. **Full Air-Gapped Windows Installation Not Formally Demonstrated**: Offline package staging and SQLite event buffering operate offline, but the primary system currently connects to cloud Neon PostgreSQL. Full air-gapped installation requires pre-installing a local PostgreSQL 16 Windows service.
6. **Transient Remote Cloud Latency in Repeatability Benchmark**: In Run 2 of the 3-run backend repeatability benchmark, a single test encountered a transient cross-continental TCP socket drop to Neon AWS US-East (`Prisma P1001`). Runs 1 and 3 passed 100% cleanly (129/129 tests). Zero application business logic bugs occurred.
7. **Primary Shared Database Contains Test-Created Entities**: While institutional baseline records (`users: 7, roles: 4, books >= 29, members >= 8`) remain 100% intact, the development database contains accumulated test-created entities.

For complete details on each limitation and production commissioning prerequisites, see [docs/KNOWN_LIMITATIONS.md](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/docs/KNOWN_LIMITATIONS.md).

