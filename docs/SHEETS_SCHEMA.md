# Google Sheets Schema — Zenith Library Management System

## Sheet 1: `Password Data`

Stores user accounts and hashed credentials. **Never share this sheet externally.**

| Column | Header | Type | Example | Notes |
|--------|--------|------|---------|-------|
| A | User ID | String | `USR-0001` | Sequential, unique |
| B | Name | String | `Rahul Sharma` | Display name |
| C | Username | String | `rahul_sharma` | Lowercase, unique login name |
| D | Role | String | `OWNER` or `MANAGER` | |
| E | Password Hash | String | `3a7b...` | SHA-256 salted hash. NEVER plaintext |
| F | Status | String | `ACTIVE` or `DISABLED` | |
| G | Permissions | JSON | `["students.view","payments.record"]` | JSON array; empty for OWNER (has all) |
| H | Created Date | ISO Datetime | `2024-01-15T09:30:00.000Z` | |
| I | Last Login | ISO Datetime | `2024-06-01T14:22:11.000Z` | Updated on each login |
| J | Temp Password Flag | Boolean | `FALSE` | TRUE → force password change on next login |

---

## Sheet 2: `Student Admitted`

Permanent record of all admitted students.

| Column | Header | Type | Example | Notes |
|--------|--------|------|---------|-------|
| A | Registration Number | String | `ZL-0001` | Sequential, unique |
| B | Student Name | String | `Priya Patel` | |
| C | Father's Name | String | `Suresh Patel` | |
| D | Aadhaar Number | String | `XXXXXXXX5678` | Store as-is; display masked |
| E | Phone Number | String | `9876543210` | 10 digits |
| F | Home Address | String | `12 MG Road, Pune` | |
| G | Registration Fee | Number | `500` | One-time fee (INR) |
| H | Locker Charge | Number | `1000` | Refundable security deposit (INR) |
| I | Monthly Fee | Number | `800` | Current monthly fee (INR) |
| J | Admission Date | Date | `2024-06-01` | YYYY-MM-DD |
| K | Slot/Plan | String | `Morning` | e.g. Morning / Evening / Full Day |
| L | Status | String | `ACTIVE` or `INACTIVE` | |
| M | Discontinuation Date | Date | `2024-11-30` | Blank if active |
| N | Notes | String | `Paid advance for 3 months` | Free text |
| O | Created At | ISO Datetime | `2024-06-01T10:00:00.000Z` | |
| P | Updated At | ISO Datetime | `2024-06-15T14:30:00.000Z` | Updated on any edit |

---

## Sheet 3: `Fee Updation`

Immutable payment transaction log. **Never delete rows from this sheet.**

| Column | Header | Type | Example | Notes |
|--------|--------|------|---------|-------|
| A | Payment ID | String | `PAY-0001` | Sequential, unique |
| B | Registration Number | String | `ZL-0001` | Foreign key → Student Admitted |
| C | Payment Date | Date | `2024-07-01` | Date payment was made |
| D | Amount Received | Number | `2400` | INR, must be > 0 |
| E | Payment Method | String | `CASH` | CASH / UPI / BANK_TRANSFER / CHEQUE |
| F | Transaction Reference | String | `UPI123456` | UPI transaction ID, cheque number, etc. |
| G | Receipt Number | String | `RCP-2024-0001` | Unique, year-prefixed |
| H | Notes | String | `3-month advance payment` | |
| I | Entered By | String | `USR-0001` | User ID who recorded the payment |
| J | Created At | ISO Datetime | `2024-07-01T11:15:00.000Z` | Server-set timestamp |

---

## Sheet 4: `Monthly Fee Ledger`

Tracks which months have been paid for each student, supporting advance payments.

| Column | Header | Type | Example | Notes |
|--------|--------|------|---------|-------|
| A | Ledger ID | String | `LDG-0001` | Sequential, unique |
| B | Registration Number | String | `ZL-0001` | Foreign key |
| C | Year | Number | `2024` | |
| D | Month | Number | `7` | 1–12 |
| E | Month Label | String | `2024-07` | YYYY-MM for easy filtering |
| F | Due Amount | Number | `800` | Monthly fee at time of ledger entry |
| G | Paid Amount | Number | `800` | Amount allocated to this month |
| H | Balance | Number | `0` | Due - Paid |
| I | Covered By | String | `PAY-0001` | Payment ID(s) covering this month |
| J | Status | String | `PAID` | PAID / PARTIAL / UNPAID / ADVANCE |
| K | Notes | String | | |
| L | Updated At | ISO Datetime | | |

**Design principle:** A single `PAY-0001` (₹2400 for 3 months) creates 3 separate ledger rows (July, August, September), each with `PAID` status and reference to `PAY-0001`.

---

## Sheet 5: `Audit Log`

Immutable operation log. **Never delete or edit rows here.**

| Column | Header | Type | Example | Notes |
|--------|--------|------|---------|-------|
| A | Log ID | String | `LOG-0001` | Sequential |
| B | Timestamp | ISO Datetime | `2024-07-01T11:15:00.000Z` | Server-side UTC time |
| C | User ID | String | `USR-0001` | Who performed the action |
| D | Action | String | `CREATE_STUDENT` | See action list below |
| E | Entity Type | String | `STUDENT` | STUDENT / PAYMENT / USER / SESSION |
| F | Entity ID | String | `ZL-0001` | The affected record ID |
| G | Result | String | `SUCCESS` | SUCCESS or FAILURE |
| H | Details | JSON | `{"studentName":"Priya"}` | Sanitized — no passwords or full Aadhaar |

### Audit Actions

| Action | Description |
|--------|-------------|
| `LOGIN` | User signed in |
| `LOGOUT` | User signed out |
| `CREATE_STUDENT` | New student admitted |
| `UPDATE_STUDENT` | Student record edited |
| `DISCONTINUE_STUDENT` | Student marked inactive |
| `RECORD_PAYMENT` | Payment recorded |
| `CREATE_USER` | New user account created |
| `DISABLE_USER` | User account disabled |
| `RESET_PASSWORD` | Password reset by owner |
| `CHANGE_PASSWORD` | User changed own password |

---

## Data Integrity Rules

1. **Registration Numbers** are generated server-side with a script lock — never manually entered.
2. **Payment records** are append-only — never update or delete `Fee Updation` rows.
3. **Audit log** is append-only — never update or delete `Audit Log` rows.
4. **Aadhaar** is stored raw in column D but always displayed masked in the UI (last 4 digits only).
5. **Password hashes** must never appear in frontend responses or audit logs.
6. **Monetary amounts** are stored as numbers (INR, no currency symbol).
7. **Dates** are stored as `YYYY-MM-DD` strings for filtering compatibility.
8. **Timestamps** are stored as ISO 8601 UTC strings.
