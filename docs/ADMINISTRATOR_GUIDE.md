# SmartLib — Institutional Administrator Guide (v1.5.0)

**Target Audience:** Library System Administrators (`ADMIN` role)  

---

## 1. Administrator Role & Responsibilities

Users assigned the `ADMIN` role have full operational and governance authority across SmartLib:
- Configuring institutional circulation, fine, RFID, security gate, notification, and identity policies (`/settings`).
- Executing production commits and emergency rollbacks of 20,000-record legacy data migration batches (`/migration`).
- Waiving patron fines with mandatory audit justification (`/circulation`).
- Creating verified database backups, running isolated restore readiness checks, validating offline update packages, and executing controlled application updates or rollbacks (`/backup-updates`).
- Viewing unmasked patron PII and operator activity audit logs (`/reports`).

---

## 2. Managing Institutional Policies (`/settings`)

Navigate to **System Settings** in the left navigation bar:

1. **Circulation & Fine Policies:**
   - Configure loan periods (`studentLoanDays`, `facultyLoanDays`, `staffLoanDays`), maximum active loans per category, `maxRenewals`, `renewalExtensionDays`, `finePerDay`, `fineBlockThreshold`, and `enforceReferenceRestriction`.
   - Changes take effect immediately for all subsequent checkouts, renewals, and returns.
2. **RFID & Offline Queue Policies:**
   - Toggle `mockMode` (`true` for software emulation, `false` for live physical readers), configure retry limits, duplicate scan windows, and local SQLite queue thresholds.
3. **Security Gate & EAS Policies:**
   - Configure gate event logging, alert thresholds, EAS alarm behavior (`TRIGGER_ALARM_AND_LOG`, `LOG_ONLY`, `DISABLED`), and retention days.
4. **Configuration Audit History:**
   - Every policy update records the administrator's identity, timestamp, previous JSON state, and updated JSON state in the **Configuration History** panel.

---

## 3. Enterprise Data Migration Governance (`/migration`)

1. **Upload & Column Mapping:** Upload legacy `.csv`, `.xlsx`, or MARC21 `.json` files. Review automatic field mapping and unmapped column warnings.
2. **Staging Validation:** Run **Validate Batch** to inspect missing fields, invalid ISBNs, or duplicate accession/barcode collisions. Export validation errors to CSV if source remediation is needed.
3. **Dry-Run Preview:** Run **Dry-Run** to inspect estimated new books, copies, authors, publishers, and categories without modifying production tables.
4. **Production Commit & Rollback:** Click **Commit to Catalog** (`ADMIN` only) to execute chunked transactional insertion. If a batch must be reversed, click **Rollback Batch** (automatically blocked if any migrated copy has an active patron loan).

---

## 4. Database Backups, Updates & Recovery (`/backup-updates`)

1. **Creating & Verifying Backups:**
   - Open the **Backup & Restore** tab and click **Create Database Snapshot**.
   - Click **Verify Integrity** (`DRY_RUN_VERIFY`) at any time to recompute the file's SHA-256 digest on disk and verify record counts.
2. **Applying Offline Updates:**
   - Open the **Offline Package Validator** tab to verify the package manifest, artifact SHA-256 hashes, and runtime prerequisites.
   - Open the **Controlled Update Manager** tab to execute the 11-step update workflow. SmartLib automatically creates a pre-update backup and rolls back to the last known-good version if any migration or post-update health check fails.

