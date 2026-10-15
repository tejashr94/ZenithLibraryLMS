# ⚡ Zenith Library Management System

A professional, full-stack internal library management system for managing student admissions, monthly fees, advance payments, student records, and collection analytics.

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite 8 |
| Styling | Vanilla CSS (design system) |
| Icons | Lucide React |
| Charts | Recharts v3 |
| Dates | date-fns v4 |
| Backend | Google Apps Script |
| Database | Google Sheets |

---

## Quick Start — Frontend

### Prerequisites
- Node.js 18+ and npm

### Installation

```bash
# 1. Clone / open this directory
cd "zenith fee"

# 2. Install dependencies
npm install

# 3. Configure the backend URL
cp .env.example .env.local
# Then edit .env.local and set VITE_APPS_SCRIPT_URL

# 4. Start development server
npm run dev
```

The app runs at `http://localhost:5173`.

> **Before logging in**, you must complete the [Backend Setup](#backend-setup--google-apps-script) below.

---

## Project Structure

```
zenith fee/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.jsx       # Desktop collapsible sidebar
│   │   │   ├── Sidebar.css
│   │   │   ├── TopBar.jsx        # Top navigation bar
│   │   │   └── TopBar.css
│   │   └── ui/
│   │       ├── Spinner.jsx
│   │       ├── EmptyState.jsx
│   │       ├── SkeletonLoader.jsx
│   │       └── ConfirmDialog.jsx
│   ├── context/
│   │   ├── AuthContext.jsx       # Authentication state & session management
│   │   └── ToastContext.jsx      # Toast notification system
│   ├── pages/
│   │   ├── LoginPage.jsx         # ✅ Fully implemented
│   │   ├── DashboardPage.jsx     # ✅ Fully implemented
│   │   ├── UsersPage.jsx         # ✅ Fully implemented (owner only)
│   │   ├── SettingsPage.jsx      # ✅ Fully implemented
│   │   ├── StudentsPage.jsx      # 🔜 Step 2
│   │   ├── PaymentsPage.jsx      # 🔜 Step 3
│   │   └── ReportsPage.jsx       # 🔜 Step 4
│   ├── services/
│   │   └── api.js                # API layer → Apps Script
│   ├── utils/
│   │   ├── session.js            # Client-side session storage
│   │   ├── formatters.js         # Currency, date, masking utils
│   │   └── validators.js         # Form validation helpers
│   ├── config.js                 # Frontend configuration
│   ├── App.jsx                   # Root component & routing
│   ├── main.jsx                  # Entry point
│   └── index.css                 # Design system CSS
├── backend/
│   ├── Code.gs                   # doPost router
│   ├── Auth.gs                   # Authentication & sessions
│   ├── Sheets.gs                 # Data access layer
│   ├── Handlers.gs               # Business logic
│   └── Setup.gs                  # One-time setup utilities
├── docs/
│   ├── BACKEND_SETUP.md          # Backend deployment guide
│   └── SHEETS_SCHEMA.md          # Google Sheets schema reference
├── .env.example                  # Environment template
└── README.md
```

---

## Backend Setup — Google Apps Script

See **[docs/BACKEND_SETUP.md](docs/BACKEND_SETUP.md)** for the complete step-by-step guide.

Short version:
1. Create a Google Spreadsheet
2. Create an Apps Script project (Extensions → Apps Script)
3. Paste `Code.gs`, `Auth.gs`, `Sheets.gs`, `Handlers.gs`, `Setup.gs`
4. Set Script Properties: `SPREADSHEET_ID`, `PASSWORD_SALT`, `SESSION_SECRET`
5. Run `initializeSheets()` from the editor
6. Run `createInitialOwner()` to create your first account
7. Deploy as Web App (Execute as: Me, Access: Anyone)
8. Copy the Web App URL → paste into `.env.local`

---

## Authentication & Security

- **No public sign-up.** All accounts are created by the owner through the app.
- **Passwords** are hashed server-side using SHA-256 with a server-side salt. Plaintext passwords are never stored.
- **Session tokens** are HMAC-SHA256 signed and validated on every protected API call.
- **Brute-force protection** locks accounts after 5 failed attempts for 5 minutes (server-side via CacheService).
- **Role enforcement** is server-side on every action — the frontend only controls UI visibility.
- **Audit log** records all significant actions with user ID, timestamp, and result.

### Known Security Limitations (Apps Script environment)

- Apps Script does not support bcrypt/argon2 natively. SHA-256 with a long random salt is the strongest available option.
- Session tokens are JWS-style but not revocable before expiry (no centralized revocation list). Logout is effective only client-side. Revocation via CacheService can be added in Step 2.
- Apps Script web app URL is publicly accessible — rate limiting prevents unauthorized access.

---

## Roles & Permissions

| Permission | Manager | Owner |
|-----------|---------|-------|
| View students | ✓ (if granted) | ✓ |
| Admit students | ✓ (if granted) | ✓ |
| Edit students | ✓ (if granted) | ✓ |
| Discontinue students | ✓ (if granted) | ✓ |
| View payments | ✓ (if granted) | ✓ |
| Record payments | ✓ (if granted) | ✓ |
| View reports | ✓ (if granted) | ✓ |
| Manage users | ✗ | ✓ |

---

## Development Roadmap

| Step | Features |
|------|---------|
| **Step 1** ✅ | Foundation, login, dashboard, user management, Apps Script backend |
| **Step 2** 🔜 | Student admission form, search, edit, discontinue, full CRUD |
| **Step 3** 🔜 | Payment recording, monthly ledger, advance payment tracking, receipts |
| **Step 4** 🔜 | Analytics, defaulter reports, export, audit log viewer |
