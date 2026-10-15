/**
 * ============================================================
 * ZENITH LIBRARY MANAGEMENT SYSTEM — Google Apps Script Backend
 * File: Code.gs (main entry point)
 * ============================================================
 *
 * DEPLOYMENT NOTE:
 *   Deploy as Web App:
 *   - Execute as: Me (your Google account)
 *   - Who has access: Anyone (required for frontend to reach the endpoint)
 *
 * All sensitive data (spreadsheet ID, salt) lives in Script Properties,
 * NOT in this source code.
 *
 * SCRIPT PROPERTIES REQUIRED (Project Settings → Script Properties):
 *   SPREADSHEET_ID   — The Google Spreadsheet ID
 *   PASSWORD_SALT    — A long random string (e.g. 64 hex chars) used in hashing
 *   SESSION_SECRET   — Another long random string for session token signing
 *   SESSION_TTL_MS   — Session lifetime in milliseconds (default: 28800000 = 8h)
 */

// ── Constants ──────────────────────────────────────────────────────────────

const SHEET_NAMES = {
  PASSWORDS:  'Password Data',
  STUDENTS:   'Student Admitted',
  FEE_UPDATE: 'Fee Updation',
  FEE_LEDGER: 'Monthly Fee Ledger',
  AUDIT_LOG:  'Audit Log',
};

const ROLES = { OWNER: 'OWNER', MANAGER: 'MANAGER' };

// ── Utility: Response Builder ──────────────────────────────────────────────

function okResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: true, ...data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(message, code, status) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: false, message, code: code || 'ERROR' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Main doPost Entry Point ────────────────────────────────────────────────

function doPost(e) {
  try {
    let body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch {
      return errorResponse('Invalid request body — expected JSON.', 'PARSE_ERROR');
    }

    const { action, sessionToken, ...payload } = body;

    // ── Public actions (no auth required) ────────────────────────────────
    if (action === 'AUTH_LOGIN') {
      return handleLogin(payload);
    }

    if (action === 'AUTH_VALIDATE_SESSION') {
      return handleValidateSession(sessionToken);
    }

    // ── All other actions require a valid session ─────────────────────────
    const session = verifySessionToken(sessionToken);
    if (!session) {
      return errorResponse('Session expired or invalid. Please log in again.', 'AUTH_REQUIRED');
    }

    // Refresh last login on every request (optional — comment out for performance)
    // updateLastLogin(session.userId);

    switch (action) {
      case 'AUTH_LOGOUT':
        return handleLogout(sessionToken);
      case 'AUTH_CHANGE_PASSWORD':
        return handleChangePassword(session, payload);
      case 'STUDENTS_LIST':
        return handleStudentsList(session, payload);
      case 'STUDENTS_SEARCH':
        return handleStudentsSearch(session, payload);
      case 'STUDENTS_GET':
        return handleStudentsGet(session, payload);
      case 'STUDENTS_GET_PROFILE':
        return handleStudentsGetProfile(session, payload);
      case 'STUDENTS_CHECK_DUPLICATE':
        return handleStudentsCheckDuplicate(session, payload);
      case 'STUDENTS_CREATE':
        return handleStudentsCreate(session, payload);
      case 'STUDENTS_UPDATE':
        return handleStudentsUpdate(session, payload);
      case 'STUDENTS_DISCONTINUE':
        return handleStudentsDiscontinue(session, payload);
      case 'STUDENTS_REACTIVATE':
        return handleStudentsReactivate(session, payload);
      case 'PAYMENTS_LIST':
        return handlePaymentsList(session, payload);
      case 'PAYMENTS_RECORD':
        return handlePaymentsRecord(session, payload);
      case 'PAYMENTS_PREVIEW_ALLOCATION':
        return handlePaymentsPreviewAllocation(session, payload);
      case 'PAYMENTS_STUDENT_HISTORY':
        return handlePaymentsStudentHistory(session, payload);
      case 'LEDGER_GET_STUDENT':
        return handleLedgerGetStudent(session, payload);
      case 'LEDGER_MONTHLY_STATUS':
        return handleLedgerMonthlyStatus(session, payload);
      case 'USERS_LIST':
        return handleUsersList(session);
      case 'USERS_CREATE':
        return handleUsersCreate(session, payload);
      case 'USERS_UPDATE':
        return handleUsersUpdate(session, payload);
      case 'USERS_DISABLE':
        return handleUsersDisable(session, payload);
      case 'USERS_RESET_PASSWORD':
        return handleUsersResetPassword(session, payload);
      case 'REPORTS_DASHBOARD':
        return handleReportsDashboard(session);
      case 'REPORTS_MONTHLY_COLLECTION':
        return handleReportsMonthlyCollection(session, payload);
      case 'REPORTS_FEE_DEFAULTERS':
        return handleReportsFeeDefaulters(session);
      default:
        return errorResponse(`Unknown action: ${action}`, 'UNKNOWN_ACTION');
    }
  } catch (err) {
    // Log unexpected errors but don't expose stack traces to the client
    console.error('Unhandled error in doPost:', err.message, err.stack);
    return errorResponse('An internal server error occurred.', 'INTERNAL_ERROR');
  }
}

// doGet is not used — return a helpful message
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({
      app: 'Zenith Library Management System',
      message: 'This endpoint accepts POST requests only.',
    }))
    .setMimeType(ContentService.MimeType.JSON);
}
