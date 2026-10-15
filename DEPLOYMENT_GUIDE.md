# ZENITH LIBRARY MANAGEMENT SYSTEM — Complete Production Deployment Guide

## System Architecture

```
┌─────────────────────────────────┐       HTTPS POST / JSON        ┌───────────────────────────────────┐
│     React + Vite Frontend       │ ─────────────────────────────> │     Google Apps Script Backend    │
│  (Vercel / Netlify / Cloudflare)│ <───────────────────────────── │    (Deployed as Web App: Anyone)  │
└─────────────────────────────────┘      Session Token + Data      └─────────────────┬─────────────────┘
                                                                                     │
                                                                   SpreadsheetApp API│
                                                                                     ▼
                                                                   ┌───────────────────────────────────┐
                                                                   │       Google Spreadsheet          │
                                                                   │     (ZenithLibDashboard)          │
                                                                   │  - Password Data                  │
                                                                   │  - Student Admitted               │
                                                                   │  - Fee Updation                   │
                                                                   │  - Monthly Fee Ledger             │
                                                                   │  - Audit Log                      │
                                                                   └───────────────────────────────────┘
```

---

## Part A: Google Spreadsheet Setup

### 1. Create Spreadsheet
1. Open [Google Sheets](https://sheets.new) and create a new blank spreadsheet.
2. Name it: `ZenithLibDashboard`.
3. Copy the Spreadsheet ID from the browser URL:
   `https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit`

### 2. Required Tabs and Headers

Create exactly 5 tabs with the following headers:

#### Tab 1: `Password Data`
Headers (Row 1):
`USER_ID` | `USER_NAME` | `ROLE` | `PASSWORD_HASH` | `SALT` | `TEMP_PASSWORD` | `MUST_CHANGE_PASSWORD` | `STATUS` | `LAST_LOGIN` | `CREATED_AT` | `CREATED_BY` | `UPDATED_AT`

#### Tab 2: `Student Admitted`
Headers (Row 1):
`REGISTRATION_NUMBER` | `STUDENT_NAME` | `FATHER_NAME` | `AADHAAR` | `PHONE` | `ADDRESS` | `REGISTRATION_FEE` | `LOCKER_CHARGE` | `MONTHLY_FEE` | `ADMISSION_DATE` | `SLOT_PLAN` | `STATUS` | `DISCONTINUATION_DATE` | `DISCONTINUATION_REASON` | `REACTIVATION_DATE` | `CREATED_AT` | `CREATED_BY` | `UPDATED_AT`

#### Tab 3: `Fee Updation`
Headers (Row 1):
`PAYMENT_ID` | `REGISTRATION_NUMBER` | `PAYMENT_DATE` | `AMOUNT` | `PAYMENT_METHOD` | `TXN_REF` | `RECEIPT_NUMBER` | `NOTES` | `ENTERED_BY` | `CREATED_AT`

#### Tab 4: `Monthly Fee Ledger`
Headers (Row 1):
`LEDGER_ID` | `REGISTRATION_NUMBER` | `YEAR` | `MONTH` | `MONTH_LABEL` | `DUE_AMOUNT` | `PAID_AMOUNT` | `BALANCE` | `COVERED_BY` | `STATUS` | `NOTES` | `UPDATED_AT`

> **Note on Month Label Formatting**: The backend automatically prefixes `MONTH_LABEL` values with `'` (e.g. `'2026-10`) so that Google Sheets stores them strictly as ISO strings (`YYYY-MM`) and does not convert them into date objects.

#### Tab 5: `Audit Log`
Headers (Row 1):
`LOG_ID` | `TIMESTAMP` | `USER_ID` | `ACTION` | `TARGET_TYPE` | `TARGET_ID` | `STATUS` | `DETAILS`

---

## Part B: Google Apps Script Backend Deployment

### 1. Create Script Project
1. Open Google Sheets → **Extensions** → **Apps Script**.
2. Rename project to: `Zenith LMS Backend`.

### 2. Add Code
1. Open `backend/Code_Bundle.gs` from this repository.
2. Select all code in `Code.gs` in the Apps Script editor and replace with `backend/Code_Bundle.gs`.
3. Save (`Ctrl+S`).

### 3. Configure Script Properties
1. Go to **Project Settings** (gear icon on left).
2. Scroll down to **Script Properties** → Click **Add script property**:
   - `SPREADSHEET_ID`: `<Your Google Spreadsheet ID>`
   - `PASSWORD_SALT`: `zenith_lib_salt_2026_super_secure_key_98471` (or any random 64-char string)
   - `SESSION_SECRET`: `zenith_lib_session_secret_jwt_sign_key_84920` (or any random 64-char string)
   - `SESSION_TTL_MS`: `28800000` (8 hours in milliseconds)
3. Click **Save script properties**.

### 4. Initialize Database & Owner Account
1. In the Apps Script code editor, select the function `setupDatabase` or `runInitialSetup` from the function dropdown.
2. Click **Run**.
3. Authorize permissions when prompted by Google.
4. This creates the initial Owner account:
   - **Username**: `admin`
   - **Password**: `ChangeMe@2024!`

### 5. Deploy as Web App
1. Click **Deploy** → **New deployment** (or **Manage deployments** → **Edit** → **New version** when updating).
2. Configuration:
   - **Type**: Web app
   - **Execute as**: `Me (<your_email@gmail.com>)`
   - **Who has access**: `Anyone` *(Crucial: allows frontend to send POST requests without Google login prompt)*
3. Click **Deploy**.
4. Copy the Web App URL:
   `https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec`

---

## Part C: Frontend Setup & Deployment

### 1. Environment Configuration
In the project root, create or edit `.env.local`:
```env
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec
```

### 2. Development Run
```bash
npm install
npm run dev
```
Open `http://localhost:5173/`.

### 3. Production Build
```bash
npm run build
```
The output bundle will be in `dist/`.

### 4. Deploying to Hosting Services

#### Vercel
1. Import repository into Vercel.
2. Framework Preset: **Vite**.
3. Add Environment Variable:
   - Key: `VITE_APPS_SCRIPT_URL`
   - Value: `https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec`
4. Deploy!

#### Netlify
1. Create `netlify.toml` or connect repository in Netlify.
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Environment variable: `VITE_APPS_SCRIPT_URL`

---

## Part D: Payment Recording vs Online Gateways

### Manual Payment Recording (Currently Implemented)
- The system allows library managers and owners to record fees paid via **UPI**, **Cash**, **Bank Transfer**, or **Cheque**.
- It captures the transaction reference / UTR number, issues an internal sequential receipt (`RCP-2026-XXXX`), and updates the student ledger.
- It does **not** deduct funds from student bank accounts directly.

### Online Payment Gateway Integration (Optional Future Step)
- To accept live credit card, debit card, or QR payments directly on the site, integrate a licensed payment gateway like **Razorpay**, **Cashfree**, or **Stripe**.
- Webhook endpoints would receive payment status notifications and automatically call `PAYMENTS_RECORD`.

---

## Part E: Quotas and Limitations of Google Apps Script

1. **Daily Execution Time**: Free Gmail accounts have a limit of 90 minutes/day total execution time; Google Workspace accounts have 6 hours/day.
2. **Concurrent Write Lock**: Handled using `LockService.getScriptLock()` with a 12-second timeout to prevent race conditions during student admission or fee submission.
3. **Payload Size**: Keep request and response payloads under 10MB (more than sufficient for typical library records).
4. **Sheets Cell Limit**: Google Sheets supports up to 10 million cells (enough for over 100,000 students and multi-year payment history).
