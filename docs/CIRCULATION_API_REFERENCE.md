# SmartLib — Circulation API Reference
## Complete API Contracts for Book Issue, Return, Renewal, and Fine Management

All endpoints require JWT Bearer Authentication (`Authorization: Bearer <token>`).

Base URL: `http://localhost:5000/api/v1/circulation`

---

### 1. List Circulation Records
**`GET /api/v1/circulation`**

#### Query Parameters
- `page` (integer, optional, default: 1): Page number
- `limit` (integer, optional, default: 10): Items per page
- `status` (string, optional): One of `ACTIVE`, `RETURNED`, `OVERDUE`, `LOST_CLAIMED`
- `memberId` (UUID, optional): Filter by borrower
- `bookItemId` (UUID, optional): Filter by physical book item

#### Response (HTTP 200)
```json
{
  "success": true,
  "message": "Circulation transactions retrieved",
  "data": [
    {
      "id": "c39385bb-26aa-49ee-9d04-bf7286d9a173",
      "status": "ACTIVE",
      "issuedDate": "2026-11-07T10:57:43.000Z",
      "dueDate": "2026-11-21T10:57:43.000Z",
      "returnedDate": null,
      "renewalCount": 0,
      "member": {
        "id": "7662c5b3-3a1b-4f90-84c1-26c715ea0e70",
        "name": "Alex Student",
        "cardNumber": "MEM-2026-0001",
        "email": "alex.student@smartlib.ac.in"
      },
      "item": {
        "id": "a50cbe9f-8c08-4e8e-94d3-cbdb65cf3aa3",
        "accessionNumber": "ACC-2026-00001",
        "title": "Clean Code: A Handbook of Agile Software Craftsmanship",
        "isbn13": "9780132350884",
        "callNumber": "QA76.76.C64 M37 2008",
        "shelfLocation": "Stack-A3",
        "rfidTag": {
          "epc": "E280116060000214B056D401",
          "easArmed": false
        }
      },
      "issuedBy": "Chief Librarian"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

---

### 2. Issue / Checkout Book
**`POST /api/v1/circulation/issue`**
*Authorized Roles:* `ADMIN`, `LIBRARIAN`

#### Request Body
```json
{
  "memberId": "7662c5b3-3a1b-4f90-84c1-26c715ea0e70",
  "bookItemId": "a50cbe9f-8c08-4e8e-94d3-cbdb65cf3aa3",
  "dueDays": 14
}
```

#### Effects
1. Validates member status is `ACTIVE` and fine balance ≤ ₹25.00.
2. Validates book copy status is `AVAILABLE` and `isReferenceOnly == false`.
3. Sets `bookItem.status` to `ISSUED`.
4. Disarms RFID EAS bit: `rfid_tags.easArmed = false`.
5. Creates `Circulation` record with calculated `dueDate`.
6. Appends `AuditLog` entry with action `DISARM_EAS`.

#### Response (HTTP 201)
```json
{
  "success": true,
  "message": "Book checked out successfully and EAS disarmed",
  "data": {
    "id": "c39385bb-26aa-49ee-9d04-bf7286d9a173",
    "memberId": "7662c5b3-3a1b-4f90-84c1-26c715ea0e70",
    "bookItemId": "a50cbe9f-8c08-4e8e-94d3-cbdb65cf3aa3",
    "issuedDate": "2026-11-07T10:57:43.000Z",
    "dueDate": "2026-11-21T10:57:43.000Z",
    "status": "ACTIVE",
    "renewalCount": 0
  }
}
```

---

### 3. Renew Loan
**`POST /api/v1/circulation/renew`**
*Authorized Roles:* `ADMIN`, `LIBRARIAN`

#### Request Body
*Provide at least one identifier:*
```json
{
  "circulationId": "c39385bb-26aa-49ee-9d04-bf7286d9a173"
}
```
*(or `"bookItemId"`, or `"accessionNumber"`)*

#### Rules & Effects
1. Loan status must be `ACTIVE`.
2. `renewalCount < 2` (maximum 2 renewals).
3. Member must be `ACTIVE` with fine balance ≤ ₹25.00.
4. Extends `dueDate` by +14 days (or +30 days for `FACULTY`).
5. Increments `renewalCount`.
6. Logs `UPDATE` action in `AuditLog`.

#### Response (HTTP 200)
```json
{
  "success": true,
  "message": "Loan renewed successfully",
  "data": {
    "id": "c39385bb-26aa-49ee-9d04-bf7286d9a173",
    "renewalCount": 1,
    "dueDate": "2026-12-05T10:57:43.000Z"
  }
}
```

---

### 4. Return Book
**`POST /api/v1/circulation/return`**
*Authorized Roles:* `ADMIN`, `LIBRARIAN`

#### Request Body
```json
{
  "circulationId": "c39385bb-26aa-49ee-9d04-bf7286d9a173",
  "notes": "Returned at circulation counter in pristine condition"
}
```

#### Effects
1. Sets `circulation.status = 'RETURNED'` and `returnedDate = now()`.
2. Sets `bookItem.status = 'AVAILABLE'`.
3. Re-arms RFID tag: `rfid_tags.easArmed = true`.
4. Overdue calculation:
   $$\text{overdueDays} = \max\left(0, \left\lceil \frac{\text{returnedDate} - \text{dueDate}}{86400000} \right\rceil\right)$$
   $$\text{fineAmount} = \text{overdueDays} \times ₹5.00$$
5. If `fineAmount > 0`: Creates `Fine` record (`UNPAID`), increments `member.fineBalance`.
6. Logs `ARM_EAS` action in `AuditLog`.

#### Response (HTTP 200)
```json
{
  "success": true,
  "message": "Book returned successfully and EAS re-armed",
  "data": {
    "circulation": {
      "id": "c39385bb-26aa-49ee-9d04-bf7286d9a173",
      "status": "RETURNED",
      "returnedDate": "2026-11-07T11:01:00.000Z"
    },
    "bookItem": {
      "id": "a50cbe9f-8c08-4e8e-94d3-cbdb65cf3aa3",
      "accessionNumber": "ACC-2026-00001",
      "status": "AVAILABLE",
      "easArmed": true
    },
    "overdueDays": 3,
    "fine": {
      "id": "f81742a2-4a0e-436f-b649-74fca750392f",
      "amount": 15.00,
      "balance": 15.00,
      "status": "UNPAID"
    }
  }
}
```

---

### 5. Collect Fine Payment
**`POST /api/v1/circulation/fines/pay`**
*Authorized Roles:* `ADMIN`, `LIBRARIAN`

#### Request Body
```json
{
  "fineId": "f81742a2-4a0e-436f-b649-74fca750392f",
  "amount": 15.00,
  "paymentMethod": "CASH"
}
```
*`paymentMethod` options:* `CASH`, `CARD`, `UPI`, `ONLINE`

#### Response (HTTP 200)
```json
{
  "success": true,
  "message": "Fine fully settled. Receipt: RCP-1794049800000-421",
  "data": {
    "fine": {
      "id": "f81742a2-4a0e-436f-b649-74fca750392f",
      "amount": 15.00,
      "paidAmount": 15.00,
      "balance": 0.00,
      "status": "PAID",
      "receiptNumber": "RCP-1794049800000-421"
    }
  }
}
```

---

### 6. Waive Fine
**`POST /api/v1/circulation/fines/waive`**
*Authorized Roles:* `ADMIN`

#### Request Body
```json
{
  "fineId": "f81742a2-4a0e-436f-b649-74fca750392f",
  "reason": "Administrative waiver authorized by Dean of Libraries"
}
```

#### Response (HTTP 200)
```json
{
  "success": true,
  "message": "Fine of ₹15.00 waived successfully",
  "data": {
    "id": "f81742a2-4a0e-436f-b649-74fca750392f",
    "status": "WAIVED",
    "balance": 0.00,
    "waivedReason": "Administrative waiver authorized by Dean of Libraries"
  }
}
```

