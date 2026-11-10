# SmartLib Phase 4E — System Settings API Reference

Base URL: `/api/v1/settings`  
Authentication: Bearer JWT required on all endpoints (`authenticate` middleware).

---

## 1. `GET /api/v1/settings`

Retrieves all persisted system settings grouped by category along with flat metadata items. Automatically initializes safe defaults on first run if any key is missing in `system_configurations`.

- **Authorized Roles**: `ADMIN`, `LIBRARIAN`
- **Response (`200 OK`)**:

```json
{
  "success": true,
  "message": "Institutional system settings retrieved",
  "data": {
    "circulation": {
      "studentLoanDurationDays": 14,
      "staffLoanDurationDays": 14,
      "facultyLoanDurationDays": 30,
      "maxRenewals": 2,
      "renewalExtensionDays": 14,
      "facultyRenewalExtensionDays": 30,
      "maxActiveLoansStudent": 4,
      "maxActiveLoansStaff": 6,
      "maxActiveLoansFaculty": 10,
      "maxActiveLoansResearchScholar": 8,
      "maxActiveLoansGuest": 2,
      "finePerOverdueDay": 5,
      "fineThresholdForBorrowingRestriction": 25,
      "enforceReferenceOnlyRestriction": true
    },
    "rfid": {
      "mockMode": true,
      "eventRetryAttempts": 3,
      "eventRetryBackoffMs": 2000,
      "duplicateEventWindowSeconds": 5,
      "deviceHealthCheckIntervalSeconds": 30,
      "offlineBufferEnabled": true,
      "offlineBufferMaxRecords": 10000
    },
    "securityGates": {
      "gateEventLoggingEnabled": true,
      "alertThresholdPerHour": 5,
      "easBehavior": "STRICT_ALARM",
      "securityEventRetentionDays": 365
    },
    "notifications": {
      "emailEnabled": true,
      "smsEnabled": false,
      "dueDateReminderEnabled": true,
      "dueDateReminderDaysBefore": 2,
      "overdueAlertEnabled": true,
      "securityGateAlertEnabled": true
    },
    "institutional": {
      "institutionName": "National Institute of Technology",
      "libraryName": "Central RFID Knowledge Resource Centre",
      "academicYear": "2025-2026",
      "timeZone": "Asia/Kolkata",
      "currency": "INR",
      "contactEmail": "library-admin@smartlib.ac.in",
      "contactPhone": "+91-11-2659-7135"
    },
    "items": [
      {
        "key": "DAILY_FINE_RATE",
        "fieldPath": "circulation.finePerOverdueDay",
        "category": "CIRCULATION",
        "dataType": "DECIMAL",
        "value": 5,
        "defaultValue": 5,
        "description": "Overdue fine assessed per calendar day (in institutional currency)",
        "isSensitive": true,
        "updatedAt": "2026-11-09T12:00:00.000Z",
        "updatedBy": "Chief Administrator"
      }
    ],
    "lastUpdatedAt": "2026-11-09T12:00:00.000Z"
  }
}
```

---

## 2. `PUT /api/v1/settings`

Atomically updates one or more settings categories in Neon PostgreSQL and writes an immutable `SYSTEM_CONFIG_CHANGE` entry to `audit_logs` containing both `previousState` and `newState`.

- **Authorized Roles**: `ADMIN` only (`LIBRARIAN` and other roles receive `403 Forbidden`)
- **Validation**: Strict Zod schema (`updateSettingsBodySchema`). Rejects unknown fields, out-of-range numbers, invalid academic year formats, and any secret/credential keys (`400 Bad Request`).
- **Request Body**:

```json
{
  "circulation": {
    "studentLoanDurationDays": 21,
    "finePerOverdueDay": 10.0,
    "fineThresholdForBorrowingRestriction": 50.0
  },
  "securityGates": {
    "easBehavior": "STRICT_ALARM",
    "alertThresholdPerHour": 8
  },
  "reason": "Senate Library Committee approval for 2026-2027 academic session"
}
```

- **Response (`200 OK`)**: Returns the complete updated settings payload (same structure as `GET /api/v1/settings`).

---

## 3. `GET /api/v1/settings/history`

Returns paginated chronological audit history of all system settings changes.

- **Authorized Roles**: `ADMIN`, `LIBRARIAN`
- **Query Parameters**:
  - `page` (optional, default `1`, min `1`)
  - `limit` (optional, default `25`, min `1`, max `100`)
- **Response (`200 OK`)**:

```json
{
  "success": true,
  "message": "Settings configuration history retrieved",
  "data": {
    "items": [
      {
        "id": "uuid-audit-log-id",
        "timestamp": "2026-11-09T12:30:00.000Z",
        "administrator": {
          "id": "uuid-admin-user-id",
          "name": "Chief Administrator",
          "email": "admin@smartlib.ac.in",
          "role": "ADMIN"
        },
        "reason": "Senate Library Committee approval for 2026-2027 academic session",
        "changedFields": ["STUDENT_LOAN_DURATION_DAYS", "DAILY_FINE_RATE"],
        "changes": [
          {
            "key": "STUDENT_LOAN_DURATION_DAYS",
            "previousValue": 14,
            "newValue": 21
          },
          {
            "key": "DAILY_FINE_RATE",
            "previousValue": 5,
            "newValue": 10
          }
        ],
        "previousState": {
          "STUDENT_LOAN_DURATION_DAYS": 14,
          "DAILY_FINE_RATE": 5
        },
        "newState": {
          "STUDENT_LOAN_DURATION_DAYS": 21,
          "DAILY_FINE_RATE": 10
        },
        "ipAddress": "127.0.0.1"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 25,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

