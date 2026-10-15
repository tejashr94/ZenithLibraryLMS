// src/services/api.js — Step 2 expanded API layer
import config from '../config';
import { mockDispatchRequest } from './mockBackend';

class ApiError extends Error {
  constructor(message, code, details) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

async function appsScriptRequest(action, payload = {}, sessionToken = null, customSignal = null) {
  const url = config.appsScriptUrl;
  
  // If backend URL is not set or set to mock, use the local mock simulator
  if (!url || url === 'mock' || url === 'demo' || url.includes('YOUR_DEPLOYMENT_ID')) {
    const res = await mockDispatchRequest(action, payload, sessionToken);
    if (!res.success) {
      throw new ApiError(res.message || 'Operation failed.', res.code || 'ERROR', res.details);
    }
    return res;
  }

  const body = {
    action,
    ...payload,
    ...(sessionToken ? { sessionToken } : {}),
  };

  const controller = new AbortController();
  const timeoutMs = 25000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    // If a custom signal is provided, combine it or listen to both
    const activeSignal = customSignal || controller.signal;
    if (customSignal) {
      customSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      signal: activeSignal,
    });
  } catch (networkError) {
    clearTimeout(timeoutId);
    if (networkError.name === 'AbortError') {
      throw new ApiError(
        'Server took too long to respond. The Google Sheets backend is waking up or connection timed out.',
        'TIMEOUT_ERROR'
      );
    }
    throw new ApiError(
      'Unable to reach backend. Check your internet connection and the Apps Script URL.',
      'NETWORK_ERROR',
      networkError.message
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new ApiError(
      `Server returned HTTP ${response.status}. Verify the Apps Script Web App is deployed as "Anyone" access.`,
      'HTTP_ERROR',
      { status: response.status }
    );
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(
      'Backend returned an invalid response. The Apps Script may have a deployment error.',
      'PARSE_ERROR'
    );
  }

  if (!data.success) {
    throw new ApiError(
      data.message || 'An unexpected server error occurred.',
      data.code || 'SERVER_ERROR',
      data.details
    );
  }

  return data;
}

// ── Auth API ────────────────────────────────────────────────────────────────
export const authApi = {
  login: (username, password) =>
    appsScriptRequest('AUTH_LOGIN', { username, password }),
  validateSession: (sessionToken, signal = null) =>
    appsScriptRequest('AUTH_VALIDATE_SESSION', {}, sessionToken, signal),
  logout: (sessionToken) =>
    appsScriptRequest('AUTH_LOGOUT', {}, sessionToken),
  changePassword: (sessionToken, targetUserId, newPassword, currentPassword) =>
    appsScriptRequest('AUTH_CHANGE_PASSWORD', { targetUserId, newPassword, currentPassword }, sessionToken),
};

// ── Students API ────────────────────────────────────────────────────────────
export const studentsApi = {
  list: (sessionToken, filters = {}) =>
    appsScriptRequest('STUDENTS_LIST', { filters }, sessionToken),

  search: (sessionToken, query, searchType = 'name') =>
    appsScriptRequest('STUDENTS_SEARCH', { query, searchType }, sessionToken),

  getById: (sessionToken, registrationNumber) =>
    appsScriptRequest('STUDENTS_GET', { registrationNumber }, sessionToken),

  getProfile: (sessionToken, registrationNumber) =>
    appsScriptRequest('STUDENTS_GET_PROFILE', { registrationNumber }, sessionToken),

  checkDuplicate: (sessionToken, studentData) =>
    appsScriptRequest('STUDENTS_CHECK_DUPLICATE', { studentData }, sessionToken),

  create: (sessionToken, studentData, idempotencyKey) =>
    appsScriptRequest('STUDENTS_CREATE', { studentData, idempotencyKey }, sessionToken),

  update: (sessionToken, registrationNumber, updates) =>
    appsScriptRequest('STUDENTS_UPDATE', { registrationNumber, updates }, sessionToken),

  discontinue: (sessionToken, registrationNumber, reason, date) =>
    appsScriptRequest('STUDENTS_DISCONTINUE', { registrationNumber, reason, date }, sessionToken),

  reactivate: (sessionToken, registrationNumber, effectiveDate) =>
    appsScriptRequest('STUDENTS_REACTIVATE', { registrationNumber, effectiveDate }, sessionToken),
};

// ── Payments API ────────────────────────────────────────────────────────────
export const paymentsApi = {
  list: (sessionToken, filters = {}) =>
    appsScriptRequest('PAYMENTS_LIST', { filters }, sessionToken),

  record: (sessionToken, paymentData, idempotencyKey) =>
    appsScriptRequest('PAYMENTS_RECORD', { paymentData, idempotencyKey }, sessionToken),

  getStudentHistory: (sessionToken, registrationNumber) =>
    appsScriptRequest('PAYMENTS_STUDENT_HISTORY', { registrationNumber }, sessionToken),

  // Preview allocation before committing
  previewAllocation: (sessionToken, registrationNumber, amount, startMonth, numMonths) =>
    appsScriptRequest('PAYMENTS_PREVIEW_ALLOCATION', {
      registrationNumber, amount, startMonth, numMonths
    }, sessionToken),
};

// ── Ledger API ──────────────────────────────────────────────────────────────
export const ledgerApi = {
  getStudentLedger: (sessionToken, registrationNumber) =>
    appsScriptRequest('LEDGER_GET_STUDENT', { registrationNumber }, sessionToken),

  getMonthlyStatus: (sessionToken, year, month, filters = {}) =>
    appsScriptRequest('LEDGER_MONTHLY_STATUS', { year, month, filters }, sessionToken),
};

// ── Users/Accounts API ──────────────────────────────────────────────────────
export const usersApi = {
  list: (sessionToken) =>
    appsScriptRequest('USERS_LIST', {}, sessionToken),
  create: (sessionToken, userData) =>
    appsScriptRequest('USERS_CREATE', { userData }, sessionToken),
  update: (sessionToken, userId, updates) =>
    appsScriptRequest('USERS_UPDATE', { userId, updates }, sessionToken),
  disable: (sessionToken, userId) =>
    appsScriptRequest('USERS_DISABLE', { userId }, sessionToken),
  enable: (sessionToken, userId) =>
    appsScriptRequest('USERS_ENABLE', { userId }, sessionToken),
  toggleStatus: (sessionToken, userId, status) =>
    appsScriptRequest('USERS_TOGGLE_STATUS', { userId, status }, sessionToken),
  resetPassword: (sessionToken, userId, tempPassword) =>
    appsScriptRequest('USERS_RESET_PASSWORD', { userId, tempPassword }, sessionToken),
};

// ── Reports API ─────────────────────────────────────────────────────────────
export const reportsApi = {
  dashboard: (sessionToken) =>
    appsScriptRequest('REPORTS_DASHBOARD', {}, sessionToken),
  ownerDashboard: (sessionToken, params = {}) =>
    appsScriptRequest('REPORTS_OWNER_DASHBOARD', params, sessionToken),
  collectionAnalytics: (sessionToken, params = {}) =>
    appsScriptRequest('REPORTS_COLLECTION_ANALYTICS', params, sessionToken),
  admissionAnalytics: (sessionToken, params = {}) =>
    appsScriptRequest('REPORTS_ADMISSION_ANALYTICS', params, sessionToken),
  monthlyCollection: (sessionToken, year, month) =>
    appsScriptRequest('REPORTS_MONTHLY_COLLECTION', { year, month }, sessionToken),
  feeDefaulters: (sessionToken) =>
    appsScriptRequest('REPORTS_FEE_DEFAULTERS', {}, sessionToken),
  auditLogs: (sessionToken, params = {}) =>
    appsScriptRequest('AUDIT_LOG_LIST', params, sessionToken),
};

export { ApiError };
