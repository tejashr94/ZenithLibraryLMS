# Backend Setup Guide — Zenith Library Management System

## Prerequisites
- A Google account
- Access to Google Drive and Google Sheets

---

## Step 1: Create the Google Spreadsheet

1. Go to [Google Sheets](https://sheets.google.com) and create a **new blank spreadsheet**.
2. Name it: `Zenith Library Management System`
3. Note the **Spreadsheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit
   ```

---

## Step 2: Create the Apps Script Project

1. In your spreadsheet, go to **Extensions → Apps Script**
2. A new Apps Script project opens. Rename it to `ZLMS Backend`
3. Delete the default `Code.gs` content

---

## Step 3: Add the Backend Source Files

In the Apps Script editor, create **5 files** (use the + button → Script):

| File Name | Content |
|-----------|---------|
| `Code.gs` | Copy from `backend/Code.gs` |
| `Auth.gs` | Copy from `backend/Auth.gs` |
| `Sheets.gs` | Copy from `backend/Sheets.gs` |
| `Handlers.gs` | Copy from `backend/Handlers.gs` |
| `Setup.gs` | Copy from `backend/Setup.gs` |

**Important:** The file order matters in Apps Script. Use exactly these names.

---

## Step 4: Configure Script Properties

1. In the Apps Script editor, go to **Project Settings** (⚙ gear icon)
2. Scroll to **Script Properties** → click **Add script property**
3. Add these three properties:

| Property | Value |
|----------|-------|
| `SPREADSHEET_ID` | The ID you copied in Step 1 |
| `PASSWORD_SALT` | A random 64-character hex string (see below) |
| `SESSION_SECRET` | A different random 64-character hex string |
| `SESSION_TTL_MS` | `28800000` (= 8 hours, optional) |

### Generating Secrets

Run `generateSecret()` from the Apps Script editor twice to get two secrets:

1. Click **Run → generateSecret** (or select from dropdown)
2. An alert shows the generated hex string — copy it as `PASSWORD_SALT`
3. Click **Run → generateSecret** again — copy as `SESSION_SECRET`

> ⚠️ Keep these values secret. Anyone with `PASSWORD_SALT` can reverse password hashes.

---

## Step 5: Initialize Sheets

1. In the Apps Script editor, select **runInitializeSheets** from the function dropdown
2. Click **Run**
3. Grant permissions when prompted (first-time authorization)
4. The script creates all 5 sheets with correct headers in your spreadsheet

---

## Step 6: Create the Initial Owner Account

1. Open `Setup.gs` in the editor
2. Find `createInitialOwner()` and **change the values**:
   ```javascript
   const OWNER_NAME = 'Your Name';
   const OWNER_USERNAME = 'admin';       // lowercase
   const OWNER_PASSWORD = 'YourStrongPassword@2024!';
   ```
3. Select **createInitialOwner** from the dropdown and click **Run**
4. An alert confirms success
5. **Security:** After running, comment out or delete this function body

---

## Step 7: Deploy as Web App

1. In the Apps Script editor, click **Deploy → New deployment**
2. Configure:
   - **Type:** Web app
   - **Description:** ZLMS v1.0
   - **Execute as:** Me (your Google account)
   - **Who has access:** Anyone
3. Click **Deploy**
4. **Copy the Web App URL** — it looks like:
   ```
   https://script.google.com/macros/s/AKfycby...../exec
   ```

> ℹ️ "Anyone" access means the endpoint is publicly reachable (required for your frontend to call it). The App Script **does not** expose your spreadsheet directly — all access goes through your authenticated handlers.

---

## Step 8: Configure the Frontend

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Edit `.env.local` and paste your Web App URL:
   ```
   VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_ID/exec
   ```
3. Start the dev server: `npm run dev`

---

## Updating the Web App

After editing any `.gs` file:
1. Click **Deploy → Manage deployments**
2. Click ✏️ Edit on your deployment
3. Change version to **"New version"**
4. Click **Deploy**

> The Web App URL stays the same after updates.

---

## Troubleshooting

| Problem | Solution |
|---------|---------|
| "Backend not configured" on login | Set `VITE_APPS_SCRIPT_URL` in `.env.local` |
| "Script Property not set" error | Add all 3 properties in Project Settings |
| CORS error in browser | Ensure Web App access is set to "Anyone" |
| Sheet not found | Run `runInitializeSheets()` again |
| "Authorization required" | Re-authorize the script in the editor |
| Login fails with correct password | Check `PASSWORD_SALT` matches what was used when creating the user |

---

## Security Recommendations

- [ ] Change the initial owner password immediately after first login
- [ ] Delete or disable the `createInitialOwner()` function body after use
- [ ] Keep `PASSWORD_SALT` and `SESSION_SECRET` secure and backed up
- [ ] Do not share Apps Script editor access with untrusted parties
- [ ] Regularly review the Audit Log sheet for suspicious activity
- [ ] Enable 2FA on the Google account that owns the Apps Script project
