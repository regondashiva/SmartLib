# SmartLib Migration API Reference

> Phase 4C | Enterprise Data Migration Suite  
> Version 1.0 | November 2026

---

## Base URL

```
/api/v1/migrations
/api/v1/migration      (alias — both paths are mounted)
```

All endpoints require:
- `Authorization: Bearer <JWT>` header (from `/api/v1/auth/login`)
- Role: **ADMIN** (Librarians receive HTTP 403 on write operations)

---

## Batch Lifecycle

```
UPLOADED → VALIDATING → VALIDATED → DRY_RUN_COMPLETED → COMMITTING → COMMITTED
                              ↓
                      VALIDATION_FAILED
```

Rollback is available from `COMMITTED` only when no copies have active loans.

---

## Endpoints

---

### POST `/upload`

Upload a CSV, XLSX, or JSON file and stage its rows into the migration staging table.

**Request** — `multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | File | Yes | `.csv`, `.xlsx`, `.xls`, `.json`, or `.txt` ≤ 50 MB |
| `batchName` | string | No | Human-readable label (auto-generated if omitted) |
| `mapping` | JSON string | No | Custom column-to-field override map |

**Response `201 Created`**

```json
{
  "success": true,
  "data": {
    "batch": {
      "id": "uuid",
      "batchName": "Batch-legacy_catalog-123456",
      "sourceFileName": "legacy_catalog.csv",
      "totalRecords": 2500,
      "validRecords": 0,
      "errorRecords": 0,
      "migratedRecords": 0,
      "status": "UPLOADED",
      "executedByUserId": "uuid",
      "createdAt": "2026-11-09T05:30:00.000Z"
    },
    "totalRows": 2500,
    "headers": ["title", "isbn", "author", "publisher"],
    "columnMapping": { "isbn": "isbn13", "author": "authors" },
    "unmappedHeaders": []
  }
}
```

**Errors**

| Status | Code | Description |
|---|---|---|
| 400 | VALIDATION_ERROR | Unsupported file type or missing file |
| 400 | VALIDATION_ERROR | File exceeds 50 MB |
| 401 | UNAUTHORIZED | Missing or invalid JWT |
| 403 | FORBIDDEN | Caller role is not ADMIN |

---

### GET `/`

List all migration batches with pagination.

**Query Parameters**

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | integer | 1 | Page number |
| `limit` | integer | 10 | Results per page (max 100) |
| `status` | enum | — | Filter by batch status |

**Status enum values:** `UPLOADED`, `VALIDATING`, `VALIDATED`, `VALIDATION_FAILED`, `DRY_RUN_COMPLETED`, `COMMITTING`, `COMMITTED`, `ROLLBACK_IN_PROGRESS`, `ROLLED_BACK`

**Response `200 OK`**

```json
{
  "success": true,
  "data": {
    "batches": [...],
    "items": [...],
    "total": 42,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}
```

---

### GET `/:id`

Retrieve a specific migration batch by UUID.

**Response `200 OK`**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "batchName": "Batch-legacy-123456",
    "status": "VALIDATED",
    "totalRecords": 2500,
    "validRecords": 2437,
    "errorRecords": 63,
    "migratedRecords": 0,
    "dryRunSummary": null,
    "sourceFileName": "legacy.csv",
    "executedByUserId": "uuid",
    "createdAt": "2026-11-09T05:30:00.000Z",
    "updatedAt": "2026-11-09T05:35:00.000Z"
  }
}
```

**Errors:** `404` if batch UUID not found.

---

### POST `/:id/validate`

Trigger validation engine on staged records.

Checks:
- Required `title` field
- ISBN-13 format and check digit
- Intra-batch duplicate ISBNs
- Duplicate ISBNs against existing catalog
- Duplicate accession numbers within batch
- Invalid publication year range (1000–2099)
- Invalid copy condition enum values

**Response `200 OK`**

```json
{
  "success": true,
  "data": {
    "batch": { "id": "uuid", "status": "VALIDATED", ... },
    "summary": {
      "totalRecords": 2500,
      "validRecords": 2437,
      "errorRecords": 63,
      "validationThroughput": 329
    }
  }
}
```

**Errors:** `409` if batch not in `UPLOADED` status.

---

### POST `/:id/dry-run`

Execute a non-destructive simulation of what would be committed.

Does **not** modify any production catalog tables.

**Response `200 OK`**

```json
{
  "success": true,
  "data": {
    "batch": { "id": "uuid", "status": "DRY_RUN_COMPLETED", ... },
    "dryRunSummary": {
      "sourceRecordCount": 2500,
      "validRecordCount": 2437,
      "estimatedNewBooks": 2437,
      "estimatedNewCopies": 4874,
      "estimatedAuthors": 892,
      "estimatedPublishers": 47,
      "estimatedCategories": 12,
      "skippedDuplicates": 0
    }
  }
}
```

**Errors:** `409` if batch not in `VALIDATED` status.

---

### GET `/:id/preview`

Paginate through staged records with optional status filter.

**Query Parameters**

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | integer | 50 | Records per page (max 200) |
| `status` | enum | `ALL` | `ALL` \| `VALID` \| `INVALID` \| `COMMITTED` |

**Response `200 OK`**

```json
{
  "success": true,
  "data": {
    "batchId": "uuid",
    "totalRecords": 2500,
    "filteredCount": 63,
    "records": [
      {
        "id": "uuid",
        "rowNumber": 42,
        "status": "INVALID",
        "normalized": { "title": "...", "isbn13": null, ... },
        "errors": [{ "field": "isbn13", "message": "Invalid ISBN-13 format" }],
        "raw": { "Title": "...", "ISBN": "BADISBN" }
      }
    ]
  }
}
```

---

### POST `/:id/commit`

**ADMIN only.** Commit all VALID staged records to the production catalog.

Creates `Book`, `BookItem` (physical copies), `Author`, `Publisher`, `Category` records. Auto-generates accession numbers in format `ACC-YYYY-NNNNN` for copies without one. Executes in chunked transactions of 10 records each with 120s timeout per chunk.

**Response `200 OK`**

```json
{
  "success": true,
  "data": {
    "batch": { "id": "uuid", "status": "COMMITTED", "migratedRecords": 2437, ... },
    "status": "COMMITTED",
    "migratedRecords": 2437,
    "reconciliation": {
      "totalRecords": 2500,
      "committedBooksCount": 2437,
      "committedCopiesCount": 4874,
      "errorRecords": 63
    }
  }
}
```

**Errors**

| Status | Code | Description |
|---|---|---|
| 403 | FORBIDDEN | Caller is not ADMIN |
| 404 | NOT_FOUND | Batch not found |
| 409 | CONFLICT | Batch already committed |
| 400 | VALIDATION_ERROR | Batch not in VALIDATED/DRY_RUN_COMPLETED status |
| 400 | VALIDATION_ERROR | No valid records to commit |

---

### POST `/:id/rollback`

**ADMIN only.** Remove all catalog records created by this batch.

**Safety checks before rollback:**
- Batch must be in `COMMITTED` status
- Zero copies from this batch may have active loans

**Response `200 OK`**

```json
{
  "success": true,
  "data": {
    "batch": { "id": "uuid", "status": "ROLLED_BACK", ... },
    "deletedBooksCount": 2437,
    "deletedCopiesCount": 4874,
    "message": "Batch rolled back successfully. 2437 books and 4874 copies removed."
  }
}
```

**Errors**

| Status | Code | Description |
|---|---|---|
| 403 | FORBIDDEN | Caller is not ADMIN |
| 409 | CONFLICT | Batch not committed, or active loans block rollback |

---

### GET `/:id/errors`

Retrieve structured validation error log for a batch.

**Response `200 OK`**

```json
{
  "success": true,
  "data": {
    "batchId": "uuid",
    "totalErrors": 63,
    "errors": [
      {
        "rowNumber": 42,
        "field": "isbn13",
        "message": "Invalid ISBN-13 check digit",
        "rawValue": "9780132350885"
      }
    ]
  }
}
```

---

### GET `/:id/errors/export`

Download validation errors as a CSV file.

**Response:** `Content-Type: text/csv; charset=utf-8` with `Content-Disposition: attachment; filename="errors-<id>.csv"`

CSV columns: `row_number`, `field`, `message`, `raw_value`

---

## Error Response Format

All error responses follow:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description",
    "details": { ... }
  }
}
```

---

## Authentication

Obtain a JWT from:

```
POST /api/v1/auth/login
{ "email": "admin@smartlib.ac.in", "password": "Admin@SmartLib2026!" }
```

Response includes `{ "data": { "token": "eyJ..." } }`. Use as `Authorization: Bearer eyJ...`.

---

## Rate Limits

| Endpoint | Limit |
|---|---|
| `POST /upload` | 10 uploads / minute per user |
| `POST /:id/commit` | 1 active commit per batch |
| All GET endpoints | No limit |

