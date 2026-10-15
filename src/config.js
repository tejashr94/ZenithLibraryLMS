// ── Environment Configuration ──────────────────────────────────────────────
// This file exposes only safe, non-secret frontend configuration.
// The actual Google Spreadsheet ID and private keys stay in Apps Script
// Properties and are NEVER sent to the frontend.

const config = {
  // Apps Script Web App URL — set after deployment
  // Set VITE_APPS_SCRIPT_URL in your .env.local file
  appsScriptUrl: import.meta.env.VITE_APPS_SCRIPT_URL || '',

  // App metadata
  appName: 'Zenith Library Management System',
  appShortName: 'Zenith Library',
  appVersion: '1.0.0',

  // Session configuration (client-side only — real auth enforced server-side)
  sessionKey: 'zlms_session',
  sessionDurationMs: 8 * 60 * 60 * 1000, // 8 hours

  // UI configuration
  pageSize: 20,
  toastDurationMs: 4000,

  // Rate limiting hint (actual enforcement is server-side)
  maxLoginAttemptsBeforeLockoutHint: 5,
};

export default config;
