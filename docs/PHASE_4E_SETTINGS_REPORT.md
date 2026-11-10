# SmartLib Phase 4E — System Settings & Institutional Policy Configuration
## Implementation & Verification Report

> Phase 4E | System Settings & Institutional Policy Configuration  
> Status: **COMPLETE** | November 2026  
> Preceding Phases: 1 → 2A → 2B → 2C → 3 → 4A → 4B → 4C → 4D → **4E**

---

## Executive Summary

Phase 4E delivers a centralized **System Settings & Institutional Policy Configuration** module backed by Neon PostgreSQL (`SystemConfiguration` and `AuditLog` tables) and a dynamic policy engine integrated directly into `CirculationService` and `ReportsService`. Administrators can adjust loan periods, renewal limits, category-specific borrowing caps, daily overdue fine rates, fine thresholds, reference-only restrictions, RFID middleware parameters, security gate alarm rules, notification preferences, and institutional branding through the UI without redeploying code.

---

## 1. Settings Categories & Canonical Registry

Implemented in [`backend/src/modules/settings/settings.schema.ts`](../backend/src/modules/settings/settings.schema.ts) (`SETTINGS_REGISTRY` — 37 canonical keys across 5 categories):

### A. Circulation Policies (`CIRCULATION`)
- `STUDENT_LOAN_DURATION_DAYS` (`circulation.studentLoanDurationDays`, default: `14`)
- `STAFF_LOAN_DURATION_DAYS` (`circulation.staffLoanDurationDays`, default: `14`)
- `FACULTY_LOAN_DURATION_DAYS` (`circulation.facultyLoanDurationDays`, default: `30`)
- `MAX_RENEWALS` (`circulation.maxRenewals`, default: `2`)
- `RENEWAL_EXTENSION_DAYS` (`circulation.renewalExtensionDays`, default: `14`)
- `FACULTY_RENEWAL_EXTENSION_DAYS` (`circulation.facultyRenewalExtensionDays`, default: `30`)
- `MAX_ACTIVE_LOANS_STUDENT` (`circulation.maxActiveLoansStudent`, default: `4`)
- `MAX_ACTIVE_LOANS_STAFF` (`circulation.maxActiveLoansStaff`, default: `6`)
- `MAX_ACTIVE_LOANS_FACULTY` (`circulation.maxActiveLoansFaculty`, default: `10`)
- `MAX_ACTIVE_LOANS_RESEARCH_SCHOLAR` (`circulation.maxActiveLoansResearchScholar`, default: `8`)
- `MAX_ACTIVE_LOANS_GUEST` (`circulation.maxActiveLoansGuest`, default: `2`)
- `DAILY_FINE_RATE` (`circulation.finePerOverdueDay`, default: `5.00`)
- `FINE_BORROWING_THRESHOLD` (`circulation.fineThresholdForBorrowingRestriction`, default: `25.00`)
- `ENFORCE_REFERENCE_ONLY_RESTRICTION` (`circulation.enforceReferenceOnlyRestriction`, default: `true`)

### B. RFID Configuration (`RFID`)
- `RFID_MOCK_MODE` (`rfid.mockMode`, default: `true`)
- `RFID_EVENT_RETRY_ATTEMPTS` (`rfid.eventRetryAttempts`, default: `3`)
- `RFID_EVENT_RETRY_BACKOFF_MS` (`rfid.eventRetryBackoffMs`, default: `2000`)
- `RFID_DUPLICATE_EVENT_WINDOW_SECONDS` (`rfid.duplicateEventWindowSeconds`, default: `5`)
- `RFID_DEVICE_HEALTH_CHECK_INTERVAL_SECONDS` (`rfid.deviceHealthCheckIntervalSeconds`, default: `30`)
- `RFID_OFFLINE_BUFFER_ENABLED` (`rfid.offlineBufferEnabled`, default: `true`)
- `RFID_OFFLINE_BUFFER_MAX_RECORDS` (`rfid.offlineBufferMaxRecords`, default: `10000`)

### C. Security Gate Configuration (`SECURITY_GATE`)
- `GATE_EVENT_LOGGING_ENABLED` (`securityGates.gateEventLoggingEnabled`, default: `true`)
- `GATE_ALERT_THRESHOLD_PER_HOUR` (`securityGates.alertThresholdPerHour`, default: `5`)
- `GATE_EAS_BEHAVIOR` (`securityGates.easBehavior`, default: `STRICT_ALARM`)
- `SECURITY_EVENT_RETENTION_DAYS` (`securityGates.securityEventRetentionDays`, default: `365`)

### D. Notification Settings (`NOTIFICATIONS`)
- `NOTIFICATION_EMAIL_ENABLED` (`notifications.emailEnabled`, default: `true`)
- `NOTIFICATION_SMS_ENABLED` (`notifications.smsEnabled`, default: `false`)
- `DUE_DATE_REMINDER_ENABLED` (`notifications.dueDateReminderEnabled`, default: `true`)
- `DUE_DATE_REMINDER_DAYS_BEFORE` (`notifications.dueDateReminderDaysBefore`, default: `2`)
- `OVERDUE_ALERT_ENABLED` (`notifications.overdueAlertEnabled`, default: `true`)
- `SECURITY_GATE_ALERT_ENABLED` (`notifications.securityGateAlertEnabled`, default: `true`)

### E. Institutional Settings (`INSTITUTIONAL`)
- `INSTITUTION_NAME` (`institutional.institutionName`, default: `National Institute of Technology`)
- `LIBRARY_NAME` (`institutional.libraryName`, default: `Central RFID Knowledge Resource Centre`)
- `ACADEMIC_YEAR` (`institutional.academicYear`, default: `2025-2026`)
- `TIME_ZONE` (`institutional.timeZone`, default: `Asia/Kolkata`)
- `CURRENCY` (`institutional.currency`, default: `INR`)
- `INSTITUTION_CONTACT_EMAIL` (`institutional.contactEmail`, default: `library-admin@smartlib.ac.in`)
- `INSTITUTION_CONTACT_PHONE` (`institutional.contactPhone`, default: `+91-11-2659-7135`)

---

## 2. Backend Architecture & Security Controls

Implemented in [`backend/src/modules/settings/settings.service.ts`](../backend/src/modules/settings/settings.service.ts), [`settings.controller.ts`](../backend/src/modules/settings/settings.controller.ts), and [`settings.routes.ts`](../backend/src/modules/settings/settings.routes.ts):

- **Endpoints**:
  - `GET /api/v1/settings` — Accessible to `ADMIN` and `LIBRARIAN`. Auto-seeds missing canonical defaults on first access (`ensureDefaultsExist()`) without overwriting custom values.
  - `PUT /api/v1/settings` — Restricted strictly to `ADMIN`. Validates all incoming fields via strict Zod schemas (`updateSettingsBodySchema`), executes atomic `prisma.$transaction(...)` upserts, and creates an immutable `AuditLog` entry (`AuditAction.SYSTEM_CONFIG_CHANGE`) containing `previousState`, `newState`, `changedFields`, and `reason`.
  - `GET /api/v1/settings/history` — Accessible to `ADMIN` and `LIBRARIAN`. Returns paginated chronological audit history with administrator details, timestamp, justification reason, and field-by-field before/after diffs.
- **Secret & Credential Isolation**:
  - Strict Zod `.strict()` schemas and `FORBIDDEN_KEY_PATTERN` (`/secret|password|token|private_key|api_key|database_url|credential|hash/i`) reject any attempt to read or write sensitive keys.

---

## 3. Dynamic Policy Engine Integration

Implemented in [`backend/src/modules/circulation/circulation.service.ts`](../backend/src/modules/circulation/circulation.service.ts):
- **`validateIssueEligibility`**: Reads live `CirculationPolicies` from `settingsService.getCirculationPolicies()`:
  - Enforces `enforceReferenceOnlyRestriction` on reference-only items.
  - Enforces `fineThresholdForBorrowingRestriction` using `Prisma.Decimal` comparison (`member.fineBalance.greaterThan(policy.fineThreshold)`).
  - Enforces effective borrowing limit (`Math.min(member.maxBorrowLimit, policy.resolveCategoryMaxLoans(member.memberType))`).
- **`issueBook`**: Calculates `dueDate` dynamically using `policy.resolveLoanDuration(member.memberType)` (`14` days for students/staff, `30` days for faculty by default) and performs an inside-transaction concurrency check to prevent duplicate checkouts.
- **`renewLoan`**: Enforces `policy.maxRenewals` (default `2`), `policy.enforceReferenceOnly`, `policy.fineThreshold`, and extends `dueDate` by `policy.resolveRenewalExtension(member.memberType)`.
- **`returnLoan`**: Calculates overdue fines using Decimal-safe multiplication (`policy.finePerOverdueDay.mul(new Prisma.Decimal(overdueDays))`), updates `member.fineBalance`, and guards against concurrent duplicate returns inside the database transaction.

---

## 4. Frontend System Settings Interface

Implemented in [`frontend/src/pages/settings/SystemSettings.tsx`](../frontend/src/pages/settings/SystemSettings.tsx):
- **6 Category Navigation Tabs**: Circulation Policies, RFID Configuration, Security Gates, Notifications, Institutional Identity, and Audit History.
- **Client-Side Validation & Reset Controls**: Real-time field validation with inline error messages and a **Discard Unsaved** control to revert edits back to persisted values.
- **Sensitive Policy Confirmation Modal**: Modifying high-impact rules (daily fine rate, fine threshold, reference-only enforcement, RFID mock mode, or EAS gate behavior) opens a confirmation dialog listing exact before/after diffs and capturing an administrative justification for the audit log.
- **RBAC Read-Only Mode**: When signed in as `LIBRARIAN`, displays a read-only policy banner, disables all form controls, and hides save/reset buttons while still allowing inspection of active policies and audit history.

