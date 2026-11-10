# SmartLib Reporting & Analytics — API Reference

> Phase 4D | Advanced Reports & Analytics Module  
> Version 1.0 | November 2026

---

## Base URL

```
/api/v1/reports
```

All endpoints require a valid JWT `Authorization: Bearer <token>` header.

---

## Role-Based Access Control (RBAC) Matrix

| Endpoint | `ADMIN` | `LIBRARIAN` | `RFID_OPERATOR` | `STUDENT` |
|---|---|---|---|---|
| `GET /dashboard` | ✅ | ✅ | ✅ | ❌ (403) |
| `GET /circulation` | ✅ | ✅ | ❌ (403) | ❌ (403) |
| `GET /overdue` | ✅ (Full PII) | ✅ (Full PII) | ✅ (PII Redacted) | ❌ (403) |
| `GET /inventory` | ✅ | ✅ | ✅ | ❌ (403) |
| `GET /members` | ✅ (Full PII) | ✅ (Full PII) | ✅ (PII Redacted) | ❌ (403) |
| `GET /fines` | ✅ | ✅ | ❌ (403) | ❌ (403) |
| `GET /rfid` | ✅ | ✅ | ✅ | ❌ (403) |
| `GET /security-gates` | ✅ | ✅ | ✅ | ❌ (403) |
| `GET /operators` | ✅ | ✅ | ❌ (403) | ❌ (403) |
| `GET /migrations` | ✅ | ✅ | ❌ (403) | ❌ (403) |
| `GET /export/pdf` | ✅ | ✅ | ❌ (403) | ❌ (403) |
| `GET /export/csv` | ✅ | ✅ | ❌ (403) | ❌ (403) |

---

## Common Filter Query Parameters

All report endpoints accept the following validated query parameters:

| Parameter | Type | Validation / Format | Description |
|---|---|---|---|
| `startDate` | `string` | ISO 8601 or `YYYY-MM-DD` | Filter records on or after start date (`startDate <= endDate` enforced) |
| `endDate` | `string` | ISO 8601 or `YYYY-MM-DD` | Filter records on or before end date |
| `academicYear` | `string` | `YYYY` or `YYYY-YYYY` (e.g., `2025-2026`) | Resolves academic calendar window (`July 1` to `June 30`) |
| `department` | `string` | Max 100 chars | Case-insensitive match on patron academic department |
| `memberCategory` | `enum` | `STUDENT` \| `FACULTY` \| `RESEARCH_SCHOLAR` \| `STAFF` \| `GUEST` | Filter by patron membership category |
| `bookCategory` | `string` | Max 100 chars | Case-insensitive match on bibliographic category name or UUID |
| `rfidDevice` | `string` | Max 100 chars | Match on RFID reader `deviceCode`, `name`, or UUID |
| `gateId` | `string` | Max 100 chars | Match on Security Gate `deviceCode`, `name`, or UUID |
| `operator` | `string` | Max 100 chars | Match on staff operator name, email, or UUID |
| `transactionStatus` | `string` | Enum value | Filter by entity status (`ACTIVE`, `RETURNED`, `OVERDUE`, `UNPAID`, `PAID`, `WAIVED`, `COMMITTED`, etc.) |
| `page` | `integer` | `>= 1` (default `1`) | Page number for tabular results |
| `limit` | `integer` | `1..200` (default `25`) | Maximum rows per page (prevents unbounded queries) |

---

## Endpoints

### 1. `GET /api/v1/reports/dashboard`

Returns consolidated institutional KPIs and chart series across catalog, circulation, patrons, fines, security gates, and migrations.

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "catalog": {
      "totalTitles": 42,
      "totalPhysicalCopies": 108,
      "availableCopies": 92,
      "issuedCopies": 14,
      "rfidTaggedCopies": 95
    },
    "circulation": {
      "activeLoans": 14,
      "overdueLoans": 3,
      "returnedLoans": 44,
      "totalTransactions": 58
    },
    "patrons": {
      "activeMembers": 65,
      "blockedMembers": 2
    },
    "fines": {
      "outstandingBalance": 120.5,
      "totalCollected": 340.0,
      "totalWaived": 50.0,
      "totalAssessed": 510.5
    },
    "security": {
      "totalGateEvents": 128,
      "authorizedPassages": 124,
      "unauthorizedAlarms": 4,
      "devicesOnline": 3,
      "devicesTotal": 3
    },
    "migrations": {
      "totalBatches": 4
    },
    "charts": {
      "circulationTrend": [{ "date": "2026-11-09", "issues": 5, "returns": 3 }],
      "categoryDistribution": [{ "name": "Computer Science", "value": 25, "color": "#2563EB" }],
      "inventoryStatusBreakdown": [{ "status": "AVAILABLE", "count": 92, "color": "#2563EB" }]
    },
    "generatedAt": "2026-11-09T12:00:00.000Z"
  }
}
```

---

### 2. `GET /api/v1/reports/circulation`

Returns total issues, returns, active loans, overdue loans, renewals, daily/weekly/monthly trends, most borrowed books, and paginated circulation transactions.

---

### 3. `GET /api/v1/reports/overdue`

Returns overdue loans with dynamically computed `overdueDays`, `fineAmount` (using configured `DAILY_FINE_RATE` or assessed fine ledger), and RBAC-protected patron contact details (`contactEmail` and `contactPhone` are redacted as `***REDACTED***` for roles other than `ADMIN` and `LIBRARIAN`).

---

### 4. `GET /api/v1/reports/inventory`

Returns physical copy reconciliation metrics (`totalPhysicalCopies`, `availableCopies`, `issuedCopies`, `rfidTaggedCopies`, `missingCopies`, `misplacedCopies`, `uncataloguedScans`, `verifiedScans`), status breakdown, category distribution, and paginated copy records.

---

### 5. `GET /api/v1/reports/members`

Returns patron activity summary (`activeMembers`, `inactiveMembers`, `blockedMembers`, `totalOutstandingFines`), membership category breakdown, and paginated member records including `borrowingFrequency`.

---

### 6. `GET /api/v1/reports/fines`

Returns decimal-safe financial totals (`totalAssessedFines`, `paidFines`, `outstandingFines`, `waivedFines`, `partialPayments`, `partialPaymentsCount`), daily collection trends, and paginated fine ledger entries.

---

### 7. `GET /api/v1/reports/rfid`

Returns RFID operations telemetry (`taggedItems`, `totalTagsProvisioned`, `easArmedCount`, `easDisarmedCount`, `readerEvents`, `failedScans`, `deviceAvailabilityPercent`), per-device activity breakdown, and paginated tag records.

---

### 8. `GET /api/v1/reports/security-gates`

Returns security gate metrics (`authorizedPassages`, `unauthorizedPassages`, `alarmEvents`, `resolvedAlarms`, `totalFootfallCount`), per-gate breakdown, and paginated gate passage events with `cctvReference`.

---

### 9. `GET /api/v1/reports/operators`

Returns staff operator activity (`activeOperators`, `totalCirculationOperations`, `totalRfidOperations`, `totalAdministrativeChanges`, `totalAuditEvents`), per-operator summary, and paginated `AuditLog` events.

---

### 10. `GET /api/v1/reports/migrations`

Returns legacy catalog migration batch metrics (`uploadedBatches`, `sourceRowCounts`, `validRecords`, `invalidRecords`, `duplicateRecords`, `committedRecords`, `rolledBackBatches`) and paginated batch records.

---

### 11. `GET /api/v1/reports/export/pdf`

Generates a multi-page compliant PDF 1.4 binary document (`Content-Type: application/pdf`) containing:
- SmartLib institutional header
- Report title and subtitle
- Date range and applied filters summary
- UTC generation timestamp and operator email
- KPI summary boxes
- Tabular records with zebra striping
- Footer with `Page X of Y` numbering

Query parameters: `type` (`CIRCULATION` | `OVERDUE` | `INVENTORY` | `MEMBERS` | `FINES` | `RFID` | `SECURITY_GATES` | `OPERATORS` | `MIGRATIONS` | `DASHBOARD`), plus any filter parameters.

---

### 12. `GET /api/v1/reports/export/csv`

Generates an RFC-4180 compliant CSV download (`Content-Type: text/csv; charset=utf-8`) matching the applied report filters. All cells beginning with `=`, `+`, `-`, `@`, `\t`, or `\r` are prefixed with a single quote (`'`) to prevent spreadsheet formula injection.

