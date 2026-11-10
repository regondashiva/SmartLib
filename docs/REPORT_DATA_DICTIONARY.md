# SmartLib Reporting & Analytics — Data Dictionary

> Phase 4D | Advanced Reports & Analytics Module  
> Version 1.0 | November 2026

---

## 1. Circulation Report (`GET /api/v1/reports/circulation`)

### Summary Metrics (`data.summary`)
| Field | Type | Source Table / Formula | Description |
|---|---|---|---|
| `totalIssues` | `integer` | `COUNT(circulations)` | Total circulation loan transactions matching filters |
| `totalReturns` | `integer` | `COUNT(circulations WHERE status = 'RETURNED')` | Completed return transactions |
| `activeLoans` | `integer` | `COUNT(circulations WHERE status = 'ACTIVE')` | Currently checked-out items |
| `overdueLoans` | `integer` | `COUNT(circulations WHERE status = 'OVERDUE' OR (status = 'ACTIVE' AND dueDate < NOW()))` | Delinquent loans |
| `totalRenewals` | `integer` | `SUM(circulations.renewalCount)` | Total loan renewal extensions |

### Record Fields (`data.records[]`)
| Field | Type | Source Column |
|---|---|---|
| `id` | `UUID` | `circulations.id` |
| `accessionNumber` | `string` | `book_items.accessionNumber` |
| `bookTitle` | `string` | `books.title` |
| `category` | `string` | `categories.name` |
| `memberName` | `string` | `members.firstName || ' ' || members.lastName` |
| `cardNumber` | `string` | `members.cardNumber` |
| `department` | `string` | `members.department` |
| `issuedDate` | `ISO-8601` | `circulations.issuedDate` |
| `dueDate` | `ISO-8601` | `circulations.dueDate` |
| `returnedDate` | `ISO-8601 \| null` | `circulations.returnedDate` |
| `renewalCount` | `integer` | `circulations.renewalCount` |
| `status` | `CirculationStatus` | `circulations.status` |
| `operator` | `string` | `users.firstName || ' ' || users.lastName` |

---

## 2. Overdue Report (`GET /api/v1/reports/overdue`)

### Summary Metrics (`data.summary`)
| Field | Type | Formula |
|---|---|---|
| `totalOverdueItems` | `integer` | Total delinquent loans matching filters |
| `averageOverdueDays` | `integer` | `ROUND(AVG(overdueDays))` |
| `totalAccruedFine` | `number (2dp)` | Decimal-safe sum of assessed or accrued overdue penalties |
| `dailyFineRate` | `number (2dp)` | Configured `system_configurations.configKey = 'DAILY_FINE_RATE'` (default `5.00`) |

### Record Fields (`data.records[]`)
| Field | Type | Privacy / Calculation |
|---|---|---|
| `accessionNumber` | `string` | `book_items.accessionNumber` |
| `bookTitle` | `string` | `books.title` |
| `memberName` | `string` | Patron full name |
| `cardNumber` | `string` | `members.cardNumber` |
| `contactEmail` | `string` | Visible to `ADMIN` & `LIBRARIAN`; `***REDACTED***` for other roles |
| `contactPhone` | `string` | Visible to `ADMIN` & `LIBRARIAN`; `***REDACTED***` for other roles |
| `dueDate` | `ISO-8601` | `circulations.dueDate` |
| `overdueDays` | `integer` | `MAX(1, CEIL((COALESCE(returnedDate, NOW()) - dueDate) / 86400s))` |
| `fineAmount` | `number (2dp)` | Sum of linked `fines.amount` if assessed, otherwise `overdueDays * dailyFineRate` |

---

## 3. Inventory Report (`GET /api/v1/reports/inventory`)

### Summary Metrics (`data.summary`)
| Field | Type | Source |
|---|---|---|
| `totalPhysicalCopies` | `integer` | `COUNT(book_items WHERE deletedAt IS NULL)` |
| `availableCopies` | `integer` | `COUNT(book_items WHERE status = 'AVAILABLE')` |
| `issuedCopies` | `integer` | `COUNT(book_items WHERE status = 'ISSUED')` |
| `rfidTaggedCopies` | `integer` | `COUNT(book_items WHERE rfidTagId IS NOT NULL)` |
| `missingCopies` | `integer` | `COUNT(book_items WHERE status = 'LOST') + COUNT(inventory_scans WHERE scanStatus = 'MISSING')` |
| `misplacedCopies` | `integer` | `COUNT(inventory_scans WHERE scanStatus = 'MISPLACED')` |
| `uncataloguedScans` | `integer` | `COUNT(inventory_scans WHERE scanStatus = 'UNCATALOGED')` |

---

## 4. Member Activity Report (`GET /api/v1/reports/members`)

| Field | Type | Description |
|---|---|---|
| `activeMembers` | `integer` | `COUNT(members WHERE status = 'ACTIVE')` |
| `inactiveMembers` | `integer` | `COUNT(members WHERE status IN ('EXPIRED', 'SUSPENDED'))` |
| `blockedMembers` | `integer` | `COUNT(members WHERE status = 'BLOCKED')` |
| `borrowingFrequency` | `integer` | `COUNT(circulations)` per member |
| `outstandingFines` | `number (2dp)` | `members.fineBalance` (`@db.Decimal(10, 2)`) |
| `memberCategory` | `MemberType` | `STUDENT` \| `FACULTY` \| `RESEARCH_SCHOLAR` \| `STAFF` \| `GUEST` |

---

## 5. Fine Collection Report (`GET /api/v1/reports/fines`)

| Field | Type | Formula |
|---|---|---|
| `totalAssessedFines` | `number (2dp)` | `SUM(fines.amount)` |
| `paidFines` | `number (2dp)` | `SUM(fines.paidAmount)` |
| `outstandingFines` | `number (2dp)` | `SUM(fines.balance WHERE status IN ('UNPAID', 'PARTIALLY_PAID'))` |
| `waivedFines` | `number (2dp)` | `SUM(fines.amount WHERE status = 'WAIVED')` |
| `partialPayments` | `number (2dp)` | `SUM(fines.paidAmount WHERE status = 'PARTIALLY_PAID')` |

---

## 6. RFID Operations Report (`GET /api/v1/reports/rfid`)

| Field | Type | Description |
|---|---|---|
| `taggedItems` | `integer` | `COUNT(rfid_tags WHERE status = 'ACTIVE')` |
| `easArmedCount` | `integer` | `COUNT(rfid_tags WHERE easArmed = true)` |
| `readerEvents` | `integer` | `COUNT(device_events) + COUNT(gate_events)` |
| `failedScans` | `integer` | `COUNT(device_events WHERE eventType = 'ERROR') + COUNT(inventory_scans WHERE scanStatus = 'UNCATALOGED') + COUNT(rfid_tags WHERE status = 'DAMAGED')` |
| `deviceAvailabilityPercent` | `integer` | `ROUND(onlineDevices / totalDevices * 100)` |

---

## 7. Security Gate Report (`GET /api/v1/reports/security-gates`)

| Field | Type | Description |
|---|---|---|
| `authorizedPassages` | `integer` | `COUNT(gate_events WHERE alarmTriggered = false)` |
| `unauthorizedPassages` | `integer` | `COUNT(gate_events WHERE alarmTriggered = true)` |
| `alarmEvents` | `integer` | `COUNT(gate_events WHERE alarmTriggered = true)` |
| `totalFootfallCount` | `integer` | `COALESCE(SUM(gate_events.footfallCount), COUNT(gate_events))` |
| `cctvReference` | `string` | `gate_events.cctvTimestampRef` |

---

## 8. Operator Activity Report (`GET /api/v1/reports/operators`)

| Field | Type | Description |
|---|---|---|
| `activeOperators` | `integer` | `COUNT(users WHERE status = 'ACTIVE')` |
| `totalCirculationOperations` | `integer` | Total issues + returns processed by staff |
| `totalRfidOperations` | `integer` | EAS arm/disarm events, gate alarm resolutions, and shelf audits |
| `totalAdministrativeChanges` | `integer` | Fine waivers, catalog mutations, migration executions, and system config changes |
| `totalAuditEvents` | `integer` | `COUNT(audit_logs)` |

---

## 9. Migration Report (`GET /api/v1/reports/migrations`)

| Field | Type | Description |
|---|---|---|
| `uploadedBatches` | `integer` | `COUNT(migration_batches)` |
| `sourceRowCounts` | `integer` | `SUM(migration_batches.totalRecords)` |
| `validRecords` | `integer` | `SUM(migration_batches.validRecords)` |
| `invalidRecords` | `integer` | `SUM(migration_batches.errorRecords)` |
| `duplicateRecords` | `integer` | `COUNT(migration_staging_records WHERE status = 'INVALID')` |
| `committedRecords` | `integer` | `SUM(migration_batches.migratedRecords)` |
| `rolledBackBatches` | `integer` | `COUNT(migration_batches WHERE status = 'ROLLED_BACK')` |

