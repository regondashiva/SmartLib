# SmartLib Phase 4E — Dynamic Circulation Policy Configuration Guide

## Overview

In Phase 4E, all institutional circulation rules have been decoupled from hardcoded constants and connected to Neon PostgreSQL via `SystemConfiguration` and `settingsService.getCirculationPolicies()`. Every checkout (`POST /api/v1/circulation/issue`), renewal (`POST /api/v1/circulation/renew`), return (`POST /api/v1/circulation/return`), and overdue report (`GET /api/v1/reports/overdue`) reads from the same single source of truth.

---

## 1. Policy Parameters & Canonical Defaults

| Config Key (`system_configurations`) | API Field Path | Data Type | Default Value | Allowed Range | Governs |
|---|---|---|---|---|---|
| `STUDENT_LOAN_DURATION_DAYS` | `circulation.studentLoanDurationDays` | `INTEGER` | `14` | `1 – 365` days | Initial checkout due date for `STUDENT` members |
| `STAFF_LOAN_DURATION_DAYS` | `circulation.staffLoanDurationDays` | `INTEGER` | `14` | `1 – 365` days | Initial checkout due date for `STAFF` members |
| `FACULTY_LOAN_DURATION_DAYS` | `circulation.facultyLoanDurationDays` | `INTEGER` | `30` | `1 – 365` days | Initial checkout due date for `FACULTY` members |
| `MAX_RENEWALS` | `circulation.maxRenewals` | `INTEGER` | `2` | `0 – 20` renewals | Maximum times an active loan can be renewed |
| `RENEWAL_EXTENSION_DAYS` | `circulation.renewalExtensionDays` | `INTEGER` | `14` | `1 – 180` days | Days added to `dueDate` when a non-faculty loan is renewed |
| `FACULTY_RENEWAL_EXTENSION_DAYS` | `circulation.facultyRenewalExtensionDays` | `INTEGER` | `30` | `1 – 365` days | Days added to `dueDate` when a `FACULTY` loan is renewed |
| `MAX_ACTIVE_LOANS_STUDENT` | `circulation.maxActiveLoansStudent` | `INTEGER` | `4` | `1 – 50` books | Borrowing cap for `STUDENT` category |
| `MAX_ACTIVE_LOANS_STAFF` | `circulation.maxActiveLoansStaff` | `INTEGER` | `6` | `1 – 100` books | Borrowing cap for `STAFF` category |
| `MAX_ACTIVE_LOANS_FACULTY` | `circulation.maxActiveLoansFaculty` | `INTEGER` | `10` | `1 – 200` books | Borrowing cap for `FACULTY` category |
| `MAX_ACTIVE_LOANS_RESEARCH_SCHOLAR` | `circulation.maxActiveLoansResearchScholar` | `INTEGER` | `8` | `1 – 100` books | Borrowing cap for `RESEARCH_SCHOLAR` category |
| `MAX_ACTIVE_LOANS_GUEST` | `circulation.maxActiveLoansGuest` | `INTEGER` | `2` | `1 – 20` books | Borrowing cap for `GUEST` category |
| `DAILY_FINE_RATE` | `circulation.finePerOverdueDay` | `DECIMAL` | `5.00` | `0.00 – 1000.00` | Overdue fine assessed per calendar day (`Prisma.Decimal`) |
| `FINE_BORROWING_THRESHOLD` | `circulation.fineThresholdForBorrowingRestriction` | `DECIMAL` | `25.00` | `0.00 – 50000.00` | Maximum unpaid `fineBalance` before checkout/renewal is blocked |
| `ENFORCE_REFERENCE_ONLY_RESTRICTION` | `circulation.enforceReferenceOnlyRestriction` | `BOOLEAN` | `true` | `true` / `false` | Blocks checkout/renewal of items with `isReferenceOnly = true` or `status = REFERENCE_ONLY` |

---

## 2. How the Dynamic Policy Engine Evaluates Rules

### A. Checkout (`CirculationService.issueBook`)
1. Loads active circulation policies via `settingsService.getCirculationPolicies()`.
2. **Reference-Only Check**: If `policy.enforceReferenceOnly` is `true` and `item.isReferenceOnly` or `item.status === 'REFERENCE_ONLY'`, rejects with HTTP 400. If `policy.enforceReferenceOnly` is `false`, permits reference checkout.
3. **Fine Threshold Check**: Compares `member.fineBalance` against `policy.fineThreshold` using `Prisma.Decimal.greaterThan()`. If `member.fineBalance > policy.fineThreshold`, rejects checkout with the exact threshold amount in the error message.
4. **Borrowing Limit Check**: Computes effective limit as `Math.min(member.maxBorrowLimit, policy.resolveCategoryMaxLoans(member.memberType))`. If active loans `>=` effective limit, rejects checkout.
5. **Loan Duration Calculation**: Computes `dueDate = now + policy.resolveLoanDuration(member.memberType)` (unless an explicit `dueDays` override was supplied).
6. **Concurrency Protection**: Inside `prisma.$transaction`, re-verifies the physical copy status before creating the `Circulation` record, updating `BookItem.status = 'ISSUED'`, and disarming `RFIDTag.easArmed = false`.

### B. Renewal (`CirculationService.renewLoan`)
1. Loads active circulation policies via `settingsService.getCirculationPolicies()`.
2. Verifies `loan.renewalCount < policy.maxRenewals`. If `loan.renewalCount >= policy.maxRenewals`, rejects with HTTP 400 (`Borrowing renewal limit (N) reached for this item`).
3. Verifies reference-only restriction (`policy.enforceReferenceOnly`) and patron fine threshold (`policy.fineThreshold`).
4. Extends `dueDate` from `max(now, currentDueDate)` by `policy.resolveRenewalExtension(loan.member.memberType)` days (`renewalExtensionDays` for students/staff, `facultyRenewalExtensionDays` for faculty).

### C. Return & Overdue Fine Assessment (`CirculationService.returnLoan`)
1. Loads active circulation policies via `settingsService.getCirculationPolicies()`.
2. Computes elapsed overdue days: `ceil((now - dueDate) / 86_400_000)`.
3. Performs Decimal-safe multiplication:
   $$\text{fineAmount} = \text{policy.finePerOverdueDay} \times \text{overdueDays}$$
4. Inside `prisma.$transaction`, verifies `loan.status !== 'RETURNED'` (preventing duplicate returns or double fines), transitions `BookItem.status = 'AVAILABLE'`, re-arms `RFIDTag.easArmed = true`, creates a `Fine` record if `fineAmount > 0`, and increments `member.fineBalance`.

