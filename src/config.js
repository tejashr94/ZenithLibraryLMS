// ── Environment Configuration ──────────────────────────────────────────────
// This file exposes only safe, non-secret frontend configuration.
// The actual Google Spreadsheet ID and private keys stay in Apps Script
// Properties and are NEVER sent to the frontend.

const config = {
  // Apps Script Web App URL — default to production deployment
  // Can be overridden with VITE_APPS_SCRIPT_URL in environment
  appsScriptUrl: import.meta.env.VITE_APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbzy_qJ8m1x1NEiZN_RH-V1yx6Y1wuP36NY_c_HXgSbW5yJcne_47Er3oTz7YNhWw1fr/exec',

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
