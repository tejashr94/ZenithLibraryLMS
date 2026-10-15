/** ZENITH LIBRARY MANAGEMENT SYSTEM - COMPLETE BACKEND BUNDLE **/

/* ===================== FILE: Code.gs ===================== */

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

    if (action === 'SETUP_RESET_DEFAULT_PASSWORDS') {
      resetDefaultPasswords();
      return okResponse({ message: 'Default passwords reset successfully.' });
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
      case 'REPORTS_OWNER_DASHBOARD':
        return handleReportsOwnerDashboard(session, payload);
      case 'REPORTS_COLLECTION_ANALYTICS':
        return handleReportsCollectionAnalytics(session, payload);
      case 'REPORTS_ADMISSION_ANALYTICS':
        return handleReportsAdmissionAnalytics(session, payload);
      case 'REPORTS_MONTHLY_COLLECTION':
        return handleReportsMonthlyCollection(session, payload);
      case 'REPORTS_FEE_DEFAULTERS':
        return handleReportsFeeDefaulters(session);
      case 'AUDIT_LOG_LIST':
        return handleAuditLogList(session, payload);
      case 'USERS_ENABLE':
        return handleUsersEnable(session, payload);
      case 'USERS_TOGGLE_STATUS':
        return handleUsersToggleStatus(session, payload);
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


/* ===================== FILE: Auth.gs ===================== */

/**
 * ============================================================
 * Auth.gs — Authentication, Session Management, Password Hashing
 * ============================================================
 *
 * SECURITY NOTES:
 * - Apps Script does not support bcrypt natively.
 * - We use SHA-256 with a server-side salt stored in Script Properties.
 *   This is significantly more secure than storing plaintext passwords.
 * - Session tokens are HMAC-SHA256 signed with a server-side secret.
 * - Brute-force protection: server-side login attempt tracking per username.
 * - Sessions are stored in Script Cache (short-lived) + Spreadsheet (persistent).
 *   Cache is checked first for performance; Spreadsheet is the source of truth.
 */

// ── Constants ──────────────────────────────────────────────────────────────

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes server-side
const SESSION_TTL_DEFAULT_MS = 8 * 60 * 60 * 1000; // 8 hours

// ── Script Properties Helpers ──────────────────────────────────────────────

function getScriptProp(key) {
  const props = PropertiesService.getScriptProperties();
  const value = props.getProperty(key);
  if (!value) {
    if (key === 'PASSWORD_SALT') return 'zenith_salt_9876543210_abcdef1234567890_secure';
    if (key === 'SESSION_SECRET') return 'zenith_session_secret_1234567890_abcdef_secure';
    if (key === 'SESSION_TTL_MS') return '28800000';
    if (key === 'SPREADSHEET_ID') {
      try {
        const act = SpreadsheetApp.getActiveSpreadsheet();
        if (act) return act.getId();
      } catch (e) {}
      return '1BsSfNbA4z9fJXoafNr5gw2h8SMBaTiL5zue03k-WLwI';
    }
    throw new Error(`Script Property "${key}" is not set. See setup guide.`);
  }
  return value;
}

function getOptionalProp(key, defaultValue) {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty(key) || defaultValue;
}

// ── Password Hashing ───────────────────────────────────────────────────────

/**
 * Hash a password using SHA-256 with a server-side salt.
 * Format: SHA256(salt + ":" + username.toLowerCase() + ":" + password)
 * Including the username makes rainbow table attacks per-user harder.
 */
function hashPassword(username, password) {
  const salt = getScriptProp('PASSWORD_SALT');
  const raw = salt + ':' + username.toLowerCase() + ':' + password;
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
  return digest.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

/**
 * Verify a plain-text password against a stored hash.
 */
function verifyPassword(username, password, storedHash) {
  const computed = hashPassword(username, password);
  // Constant-time comparison to prevent timing attacks
  if (computed.length !== storedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return diff === 0;
}

// ── Session Tokens ─────────────────────────────────────────────────────────

/**
 * Create a session token: base64url(payload) + "." + HMAC-SHA256 signature
 * Payload contains userId, role, issuedAt, expiresAt.
 */
function createSessionToken(userId, role, permissions) {
  const secret = getScriptProp('SESSION_SECRET');
  const ttl = parseInt(getOptionalProp('SESSION_TTL_MS', SESSION_TTL_DEFAULT_MS));
  const now = Date.now();

  const payload = {
    uid: userId,
    role,
    perms: permissions || [],
    iat: now,
    exp: now + ttl,
  };

  const payloadB64 = Utilities.base64EncodeWebSafe(JSON.stringify(payload));
  const sig = computeHmac(secret, payloadB64);
  return payloadB64 + '.' + sig;
}

/**
 * Verify a session token. Returns the decoded payload or null if invalid/expired.
 */
function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  try {
    const secret = getScriptProp('SESSION_SECRET');
    const [payloadB64, sig] = parts;

    // Verify signature
    const expectedSig = computeHmac(secret, payloadB64);
    if (!constantTimeEqual(sig, expectedSig)) return null;

    // Decode payload
    const payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(payloadB64)).getDataAsString());

    // Check expiry
    if (Date.now() > payload.exp) return null;

    return {
      userId: payload.uid,
      role: payload.role,
      permissions: payload.perms || [],
    };
  } catch (err) {
    console.warn('Session verification failed:', err.message);
    return null;
  }
}

function computeHmac(secret, data) {
  const key = Utilities.newBlob(secret).getBytes();
  const msg = Utilities.newBlob(data).getBytes();
  const mac = Utilities.computeHmacSha256Signature(msg, key);
  return Utilities.base64EncodeWebSafe(mac);
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// ── Brute-Force Protection ─────────────────────────────────────────────────

function getLockoutKey(username) {
  return 'lockout_' + username.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

function checkRateLimit(username) {
  const cache = CacheService.getScriptCache();
  const key = getLockoutKey(username);
  const data = cache.get(key);

  if (!data) return { locked: false, attempts: 0 };

  const parsed = JSON.parse(data);
  if (Date.now() > parsed.lockedUntil) {
    cache.remove(key);
    return { locked: false, attempts: 0 };
  }

  if (parsed.attempts >= MAX_LOGIN_ATTEMPTS) {
    return { locked: true, remainingMs: parsed.lockedUntil - Date.now() };
  }

  return { locked: false, attempts: parsed.attempts };
}

function recordFailedAttempt(username) {
  const cache = CacheService.getScriptCache();
  const key = getLockoutKey(username);
  const data = cache.get(key);
  const parsed = data ? JSON.parse(data) : { attempts: 0, lockedUntil: 0 };

  parsed.attempts = (parsed.attempts || 0) + 1;
  if (parsed.attempts >= MAX_LOGIN_ATTEMPTS) {
    parsed.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
  }

  // Store for lockout duration + 1 minute
  cache.put(key, JSON.stringify(parsed), Math.ceil(LOCKOUT_DURATION_MS / 1000) + 60);
}

function clearFailedAttempts(username) {
  const cache = CacheService.getScriptCache();
  cache.remove(getLockoutKey(username));
}

// ── Auth Handlers ──────────────────────────────────────────────────────────

function handleLogin(payload) {
  const { username, password } = payload;

  if (!username || !password) {
    return errorResponse('Username and password are required.', 'VALIDATION_ERROR');
  }

  // Rate limit check
  const rateLimit = checkRateLimit(username);
  if (rateLimit.locked) {
    return errorResponse(
      `Too many failed attempts. Try again in ${Math.ceil(rateLimit.remainingMs / 60000)} minute(s).`,
      'RATE_LIMITED'
    );
  }

  // Look up user
  let user;
  try {
    user = findUserByUsername(username.trim().toLowerCase());
  } catch (err) {
    return errorResponse(err.message, 'CONFIG_ERROR');
  }

  if (!user) {
    recordFailedAttempt(username);
    return errorResponse('Invalid username or password.', 'INVALID_CREDENTIALS');
  }

  if (user.status !== 'ACTIVE') {
    return errorResponse('This account has been disabled. Contact the administrator.', 'ACCOUNT_DISABLED');
  }

  // Verify password
  if (!verifyPassword(username.trim().toLowerCase(), password, user.passwordHash)) {
    recordFailedAttempt(username);
    return errorResponse('Invalid username or password.', 'INVALID_CREDENTIALS');
  }

  // Successful login
  clearFailedAttempts(username);

  // Update last login
  updateUserLastLogin(user.id);

  // Write audit log
  writeAuditLog(user.id, 'LOGIN', null, null, 'SUCCESS');

  const token = createSessionToken(user.id, user.role, user.permissions);

  return okResponse({
    token,
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      permissions: user.permissions,
    },
  });
}

function handleValidateSession(sessionToken) {
  const session = verifySessionToken(sessionToken);
  if (!session) {
    return errorResponse('Session invalid or expired.', 'INVALID_SESSION');
  }

  // Fetch fresh user data (to catch disables/role changes)
  const user = findUserById(session.userId);
  if (!user || user.status !== 'ACTIVE') {
    return errorResponse('Account not found or disabled.', 'ACCOUNT_DISABLED');
  }

  return okResponse({
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      permissions: user.permissions,
    },
  });
}

function handleLogout(sessionToken) {
  // Token-based sessions are stateless — client discards the token.
  // For future: implement a server-side revocation list using CacheService.
  const session = verifySessionToken(sessionToken);
  if (session) {
    writeAuditLog(session.userId, 'LOGOUT', null, null, 'SUCCESS');
  }
  return okResponse({ message: 'Logged out.' });
}

function handleChangePassword(session, payload) {
  const { targetUserId, newPassword, currentPassword } = payload;

  if (!newPassword || newPassword.length < 8) {
    return errorResponse('New password must be at least 8 characters.', 'VALIDATION_ERROR');
  }

  // Only owners can change other users' passwords
  const isChangingOwn = targetUserId === session.userId;
  if (!isChangingOwn && session.role !== ROLES.OWNER) {
    return errorResponse('Only owners can change other users\' passwords.', 'FORBIDDEN');
  }

  const targetUser = findUserById(targetUserId);
  if (!targetUser) {
    return errorResponse('Target user not found.', 'NOT_FOUND');
  }

  // If changing own password, verify current password
  if (isChangingOwn && currentPassword) {
    if (!verifyPassword(targetUser.username, currentPassword, targetUser.passwordHash)) {
      return errorResponse('Current password is incorrect.', 'INVALID_CREDENTIALS');
    }
  }

  const newHash = hashPassword(targetUser.username, newPassword);
  updateUserPassword(targetUserId, newHash);

  writeAuditLog(session.userId, 'CHANGE_PASSWORD', 'USER', targetUserId, 'SUCCESS');
  return okResponse({ message: 'Password updated.' });
}


/* ===================== FILE: Sheets.gs ===================== */

/**
 * ============================================================
 * Sheets.gs — Google Sheets Data Access Layer
 * ============================================================
 * All spreadsheet reads/writes go through these functions.
 * Sheet initialization, column headers, and schema are defined here.
 */

// ── Column Definitions ─────────────────────────────────────────────────────

const PASSWORD_DATA_COLS = {
  USER_ID: 0,       // A — Unique user ID (e.g. USR-001)
  NAME: 1,          // B — Full name
  USERNAME: 2,      // C — Username (lowercase, unique)
  ROLE: 3,          // D — OWNER | MANAGER
  PASSWORD_HASH: 4, // E — SHA-256 salted hash (NEVER plaintext)
  STATUS: 5,        // F — ACTIVE | DISABLED
  PERMISSIONS: 6,   // G — JSON array string of permission keys
  CREATED_DATE: 7,  // H — ISO timestamp
  LAST_LOGIN: 8,    // I — ISO timestamp
  TEMP_PW_FLAG: 9,  // J — TRUE if user must change password on next login
};

const STUDENT_COLS = {
  REG_NUMBER: 0,      // A
  STUDENT_NAME: 1,    // B
  FATHER_NAME: 2,     // C
  AADHAAR: 3,         // D — Stored masked or encrypted; never log full Aadhaar
  PHONE: 4,           // E
  ADDRESS: 5,         // F
  REG_FEE: 6,         // G — One-time registration fee (INR)
  LOCKER_CHARGE: 7,   // H — Refundable locker/security deposit
  MONTHLY_FEE: 8,     // I — Monthly fee amount
  ADMISSION_DATE: 9,  // J — YYYY-MM-DD
  SLOT_PLAN: 10,      // K — e.g. "Morning", "Evening", "Full Day"
  STATUS: 11,         // L — ACTIVE | INACTIVE
  DISCONT_DATE: 12,   // M — Date of discontinuation
  NOTES: 13,          // N
  CREATED_AT: 14,     // O
  UPDATED_AT: 15,     // P
};

const FEE_UPDATE_COLS = {
  PAYMENT_ID: 0,      // A
  REG_NUMBER: 1,      // B
  PAYMENT_DATE: 2,    // C
  AMOUNT: 3,          // D
  PAYMENT_METHOD: 4,  // E — CASH | UPI | BANK_TRANSFER | CHEQUE
  TXN_REF: 5,         // F — UPI/bank transaction reference
  RECEIPT_NUMBER: 6,  // G
  NOTES: 7,           // H
  ENTERED_BY: 8,      // I — User ID
  CREATED_AT: 9,      // J
};

const FEE_LEDGER_COLS = {
  LEDGER_ID: 0,       // A
  REG_NUMBER: 1,      // B
  YEAR: 2,            // C
  MONTH: 3,           // D — 1-12
  MONTH_LABEL: 4,     // E — "YYYY-MM"
  DUE_AMOUNT: 5,      // F
  PAID_AMOUNT: 6,     // G
  BALANCE: 7,         // H
  COVERED_BY: 8,      // I — Payment ID(s) that cover this month
  STATUS: 9,          // J — PAID | PARTIAL | UNPAID | ADVANCE
  NOTES: 10,          // K
  UPDATED_AT: 11,     // L
};

const AUDIT_LOG_COLS = {
  LOG_ID: 0,          // A
  TIMESTAMP: 1,       // B
  USER_ID: 2,         // C
  ACTION: 3,          // D
  ENTITY_TYPE: 4,     // E — STUDENT | PAYMENT | USER | SESSION
  ENTITY_ID: 5,       // F
  RESULT: 6,          // G — SUCCESS | FAILURE
  DETAILS: 7,         // H — JSON string (sanitized — no passwords/Aadhaar)
};

// ── Sheet Headers ──────────────────────────────────────────────────────────

const HEADERS = {
  [SHEET_NAMES.PASSWORDS]: [
    'User ID', 'Name', 'Username', 'Role', 'Password Hash',
    'Status', 'Permissions', 'Created Date', 'Last Login', 'Temp Password Flag'
  ],
  [SHEET_NAMES.STUDENTS]: [
    'Registration Number', 'Student Name', "Father's Name", 'Aadhaar Number',
    'Phone Number', 'Home Address', 'Registration Fee', 'Locker Charge',
    'Monthly Fee', 'Admission Date', 'Slot/Plan', 'Status',
    'Discontinuation Date', 'Notes', 'Created At', 'Updated At'
  ],
  [SHEET_NAMES.FEE_UPDATE]: [
    'Payment ID', 'Registration Number', 'Payment Date', 'Amount Received',
    'Payment Method', 'Transaction Reference', 'Receipt Number',
    'Notes', 'Entered By', 'Created At'
  ],
  [SHEET_NAMES.FEE_LEDGER]: [
    'Ledger ID', 'Registration Number', 'Year', 'Month', 'Month Label',
    'Due Amount', 'Paid Amount', 'Balance', 'Covered By', 'Status', 'Notes', 'Updated At'
  ],
  [SHEET_NAMES.AUDIT_LOG]: [
    'Log ID', 'Timestamp', 'User ID', 'Action', 'Entity Type',
    'Entity ID', 'Result', 'Details'
  ],
};

// ── Spreadsheet & Sheet Access ─────────────────────────────────────────────

function getSpreadsheet() {
  try {
    const id = getScriptProp('SPREADSHEET_ID');
    if (id) return SpreadsheetApp.openById(id);
  } catch (e) {}
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {}
  throw new Error('Spreadsheet not accessible. Set SPREADSHEET_ID in Script Properties.');
}

function getSheet(sheetName) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  // Self-healing: if header row is missing or empty, auto-write headers immediately
  const headers = HEADERS[sheetName];
  if (headers && headers.length > 0) {
    const lastRow = sheet.getLastRow();
    if (lastRow === 0) {
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setValues([headers]);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#1a1a3e');
      headerRange.setFontColor('#b8b0e8');
      sheet.setFrozenRows(1);
    } else {
      const firstCell = String(sheet.getRange(1, 1).getValue() || '').trim();
      if (!firstCell) {
        const headerRange = sheet.getRange(1, 1, 1, headers.length);
        headerRange.setValues([headers]);
        headerRange.setFontWeight('bold');
        headerRange.setBackground('#1a1a3e');
        headerRange.setFontColor('#b8b0e8');
        sheet.setFrozenRows(1);
      }
    }
  }
  return sheet;
}

function resetDefaultPasswords() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.PASSWORDS);
  if (!sheet) {
    initializeSheets();
    sheet = ss.getSheetByName(SHEET_NAMES.PASSWORDS);
  }
  const data = sheet.getDataRange().getValues();
  let adminFound = false;
  let managerFound = false;
  
  for (let i = 1; i < data.length; i++) {
    const username = String(data[i][PASSWORD_DATA_COLS.USERNAME] || '').toLowerCase().trim();
    if (username === 'admin') {
      const h = hashPassword('admin', 'ChangeMe@2024!');
      sheet.getRange(i + 1, PASSWORD_DATA_COLS.PASSWORD_HASH + 1).setValue(h);
      sheet.getRange(i + 1, PASSWORD_DATA_COLS.STATUS + 1).setValue('ACTIVE');
      adminFound = true;
    } else if (username === 'manager') {
      const h = hashPassword('manager', 'Zenith@2026');
      sheet.getRange(i + 1, PASSWORD_DATA_COLS.PASSWORD_HASH + 1).setValue(h);
      sheet.getRange(i + 1, PASSWORD_DATA_COLS.STATUS + 1).setValue('ACTIVE');
      managerFound = true;
    }
  }

  const now = new Date().toISOString();
  if (!adminFound) {
    const adminHash = hashPassword('admin', 'ChangeMe@2024!');
    writeRowToFirstEmptyOrAppend(sheet, PASSWORD_DATA_COLS.USER_ID, [
      'USR_OWNER_001',
      'System Administrator',
      'admin',
      ROLES.OWNER,
      adminHash,
      'ACTIVE',
      JSON.stringify(['ALL']),
      now,
      '',
      false,
    ]);
  }
  if (!managerFound) {
    const managerHash = hashPassword('manager', 'Zenith@2026');
    writeRowToFirstEmptyOrAppend(sheet, PASSWORD_DATA_COLS.USER_ID, [
      'USR_0002',
      'Library Manager',
      'manager',
      ROLES.MANAGER,
      managerHash,
      'ACTIVE',
      JSON.stringify(['students.view', 'students.create', 'students.update', 'payments.view', 'payments.record', 'reports.view']),
      now,
      '',
      false,
    ]);
  }
}

function getOrCreateSheet(sheetName) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  return sheet;
}

// ── Initialization ─────────────────────────────────────────────────────────

/**
 * Call this function ONCE from the Apps Script editor to create all sheets
 * and write the correct headers.
 * Menu: Run → initializeSheets (or call from Setup.gs)
 */
function initializeSheets() {
  const ss = getSpreadsheet();

  for (const [sheetName, headers] of Object.entries(HEADERS)) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      console.log('Created sheet:', sheetName);
    }

    // Write header row if missing
    const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    const hasHeaders = firstRow.some(cell => cell !== '');
    if (!hasHeaders) {
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setValues([headers]);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#1a1a3e');
      headerRange.setFontColor('#b8b0e8');
      sheet.setFrozenRows(1);
      console.log('Wrote headers for:', sheetName);
    }
  }

  console.log('Sheet initialization complete.');
  return 'OK';
}

// ── ID Generation ──────────────────────────────────────────────────────────

/**
 * Generate a unique sequential ID with a prefix.
 * Uses a script lock to prevent race conditions.
 */
function generateId(prefix, sheet, idColumn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const data = sheet.getDataRange().getValues();
    const existingNums = new Set();
    for (let i = 1; i < data.length; i++) {
      const id = String(data[i][idColumn] || '').trim();
      const match = id.match(/\d+$/);
      if (match) existingNums.add(parseInt(match[0], 10));
    }
    let nextNum = 1;
    while (existingNums.has(nextNum)) {
      nextNum++;
    }
    return prefix + String(nextNum).padStart(4, '0');
  } finally {
    lock.releaseLock();
  }
}

/**
 * Writes a row into the first empty row available (filling gaps or starting from Row 2 if table is empty),
 * or appends at the bottom if no empty row exists.
 */
function writeRowToFirstEmptyOrAppend(sheet, idColIndex, rowValues) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    sheet.getRange(2, 1, 1, rowValues.length).setValues([rowValues]);
    return 2;
  }

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const isRowEmpty = data[i].every(cell => cell === '' || cell === null || cell === undefined);
    const isIdEmpty = !data[i][idColIndex] || String(data[i][idColIndex]).trim() === '';
    if (isRowEmpty || isIdEmpty) {
      const rowNum = i + 1;
      sheet.getRange(rowNum, 1, 1, rowValues.length).setValues([rowValues]);
      return rowNum;
    }
  }

  const nextRowNum = lastRow + 1;
  sheet.getRange(nextRowNum, 1, 1, rowValues.length).setValues([rowValues]);
  return nextRowNum;
}

function generateUserId() {
  return generateId('USR-', getSheet(SHEET_NAMES.PASSWORDS), PASSWORD_DATA_COLS.USER_ID);
}

function generateRegistrationNumber() {
  return generateId('ZL-', getSheet(SHEET_NAMES.STUDENTS), STUDENT_COLS.REG_NUMBER);
}

function generatePaymentId() {
  return generateId('PAY-', getSheet(SHEET_NAMES.FEE_UPDATE), FEE_UPDATE_COLS.PAYMENT_ID);
}

function generateReceiptNumber() {
  const year = new Date().getFullYear();
  return generateId(`RCP-${year}-`, getSheet(SHEET_NAMES.FEE_UPDATE), FEE_UPDATE_COLS.RECEIPT_NUMBER);
}

function generateLedgerId() {
  return generateId('LDG-', getSheet(SHEET_NAMES.FEE_LEDGER), FEE_LEDGER_COLS.LEDGER_ID);
}

function generateLogId() {
  return generateId('LOG-', getSheet(SHEET_NAMES.AUDIT_LOG), AUDIT_LOG_COLS.LOG_ID);
}

// ── Audit Log ──────────────────────────────────────────────────────────────

function writeAuditLog(userId, action, entityType, entityId, result, details) {
  try {
    const sheet = getSheet(SHEET_NAMES.AUDIT_LOG);
    const logId = generateLogId();
    const now = new Date().toISOString();
    // Sanitize details — never include passwords or full Aadhaar
    const safeDetails = details
      ? JSON.stringify(sanitizeForAudit(details))
      : '';

    const rowValues = [
      logId,
      now,
      userId || 'SYSTEM',
      action,
      entityType || '',
      entityId || '',
      result,
      safeDetails,
    ];
    writeRowToFirstEmptyOrAppend(sheet, AUDIT_LOG_COLS.LOG_ID, rowValues);
  } catch (err) {
    // Audit log failure should not break the main operation
    console.error('Failed to write audit log:', err.message);
  }
}

function sanitizeForAudit(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;
  const forbidden = ['password', 'passwordHash', 'hash', 'aadhaar', 'aadhaarNumber'];
  const clean = {};
  for (const [k, v] of Object.entries(obj)) {
    if (forbidden.some(f => k.toLowerCase().includes(f))) {
      clean[k] = '[REDACTED]';
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

function getAllAuditLogs() {
  const sheet = getSheet(SHEET_NAMES.AUDIT_LOG);
  const data = sheet.getDataRange().getValues();
  return data.slice(1)
    .filter(row => row[AUDIT_LOG_COLS.LOG_ID])
    .map(row => {
      let details = {};
      try { details = JSON.parse(row[AUDIT_LOG_COLS.DETAILS] || '{}'); } catch (e) {}
      return {
        logId: row[AUDIT_LOG_COLS.LOG_ID],
        timestamp: row[AUDIT_LOG_COLS.TIMESTAMP],
        userId: row[AUDIT_LOG_COLS.USER_ID],
        action: row[AUDIT_LOG_COLS.ACTION],
        entityType: row[AUDIT_LOG_COLS.ENTITY_TYPE],
        entityId: row[AUDIT_LOG_COLS.ENTITY_ID],
        result: row[AUDIT_LOG_COLS.RESULT],
        details: details,
      };
    });
}

// ── User Data Access ───────────────────────────────────────────────────────

function findUserByUsername(username) {
  const sheet = getSheet(SHEET_NAMES.PASSWORDS);
  const data = sheet.getDataRange().getValues();
  const lower = username.toLowerCase();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][PASSWORD_DATA_COLS.USERNAME]).toLowerCase() === lower) {
      return rowToUser(data[i]);
    }
  }
  return null;
}

function findUserById(userId) {
  const sheet = getSheet(SHEET_NAMES.PASSWORDS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][PASSWORD_DATA_COLS.USER_ID]) === String(userId)) {
      return rowToUser(data[i]);
    }
  }
  return null;
}

function rowToUser(row) {
  let permissions = [];
  try {
    permissions = JSON.parse(row[PASSWORD_DATA_COLS.PERMISSIONS] || '[]');
  } catch { permissions = []; }

  return {
    id: row[PASSWORD_DATA_COLS.USER_ID],
    name: row[PASSWORD_DATA_COLS.NAME],
    username: row[PASSWORD_DATA_COLS.USERNAME],
    role: row[PASSWORD_DATA_COLS.ROLE],
    passwordHash: row[PASSWORD_DATA_COLS.PASSWORD_HASH],
    status: row[PASSWORD_DATA_COLS.STATUS],
    permissions,
    createdDate: row[PASSWORD_DATA_COLS.CREATED_DATE],
    lastLogin: row[PASSWORD_DATA_COLS.LAST_LOGIN],
    tempPasswordFlag: row[PASSWORD_DATA_COLS.TEMP_PW_FLAG],
  };
}

function updateUserLastLogin(userId) {
  const sheet = getSheet(SHEET_NAMES.PASSWORDS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][PASSWORD_DATA_COLS.USER_ID]) === String(userId)) {
      sheet.getRange(i + 1, PASSWORD_DATA_COLS.LAST_LOGIN + 1)
        .setValue(new Date().toISOString());
      return;
    }
  }
}

function updateUserPassword(userId, newHash) {
  const sheet = getSheet(SHEET_NAMES.PASSWORDS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][PASSWORD_DATA_COLS.USER_ID]) === String(userId)) {
      sheet.getRange(i + 1, PASSWORD_DATA_COLS.PASSWORD_HASH + 1).setValue(newHash);
      sheet.getRange(i + 1, PASSWORD_DATA_COLS.TEMP_PW_FLAG + 1).setValue(false);
      return;
    }
  }
  throw new Error('User not found for password update.');
}

function getAllUsers() {
  const sheet = getSheet(SHEET_NAMES.PASSWORDS);
  const data = sheet.getDataRange().getValues();
  return data.slice(1)
    .filter(row => row[PASSWORD_DATA_COLS.USER_ID])
    .map(rowToUser);
}

function createUserRecord(userData) {
  const sheet = getSheet(SHEET_NAMES.PASSWORDS);
  const now = new Date().toISOString();
  const rowValues = [
    userData.id,
    userData.name,
    userData.username,
    userData.role,
    userData.passwordHash,
    'ACTIVE',
    JSON.stringify(userData.permissions || []),
    now,
    '',      // lastLogin
    false,   // tempPasswordFlag
  ];
  writeRowToFirstEmptyOrAppend(sheet, PASSWORD_DATA_COLS.USER_ID, rowValues);
}

function updateUserRecord(userId, updates) {
  const sheet = getSheet(SHEET_NAMES.PASSWORDS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][PASSWORD_DATA_COLS.USER_ID]) === String(userId)) {
      if (updates.status !== undefined) {
        sheet.getRange(i + 1, PASSWORD_DATA_COLS.STATUS + 1).setValue(updates.status);
      }
      if (updates.permissions !== undefined) {
        sheet.getRange(i + 1, PASSWORD_DATA_COLS.PERMISSIONS + 1)
          .setValue(JSON.stringify(updates.permissions));
      }
      if (updates.role !== undefined) {
        sheet.getRange(i + 1, PASSWORD_DATA_COLS.ROLE + 1).setValue(updates.role);
      }
      return true;
    }
  }
  return false;
}

// ── Student Data Access ────────────────────────────────────────────────────

function getAllStudents() {
  const sheet = getSheet(SHEET_NAMES.STUDENTS);
  const data = sheet.getDataRange().getValues();
  return data.slice(1)
    .filter(row => row[STUDENT_COLS.REG_NUMBER])
    .map(rowToStudent);
}

function normalizeDateStr(val) {
  if (!val) return '';
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.slice(0, 10);
  }
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return s;
}

function formatMonthLabel(val, year, month) {
  const y = parseInt(year);
  const m = parseInt(month);
  if (y >= 2000 && m >= 1 && m <= 12) {
    return `${y}-${String(m).padStart(2, '0')}`;
  }
  if (!val) return '';
  if (val instanceof Date) {
    const dy = val.getFullYear();
    const dm = String(val.getMonth() + 1).padStart(2, '0');
    return `${dy}-${dm}`;
  }
  const s = String(val).trim();
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 7);
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const dy = d.getFullYear();
    const dm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dy}-${dm}`;
  }
  return s;
}

function rowToStudent(row) {
  return {
    registrationNumber: row[STUDENT_COLS.REG_NUMBER],
    studentName: row[STUDENT_COLS.STUDENT_NAME],
    fatherName: row[STUDENT_COLS.FATHER_NAME],
    // Aadhaar is returned masked for list views (full value only for detail view)
    aadhaarMasked: maskAadhaar(String(row[STUDENT_COLS.AADHAAR] || '')),
    phone: row[STUDENT_COLS.PHONE],
    address: row[STUDENT_COLS.ADDRESS],
    registrationFee: parseFloat(row[STUDENT_COLS.REG_FEE]) || 0,
    lockerCharge: parseFloat(row[STUDENT_COLS.LOCKER_CHARGE]) || 0,
    monthlyFee: parseFloat(row[STUDENT_COLS.MONTHLY_FEE]) || 0,
    admissionDate: normalizeDateStr(row[STUDENT_COLS.ADMISSION_DATE]),
    slotPlan: row[STUDENT_COLS.SLOT_PLAN],
    status: row[STUDENT_COLS.STATUS],
    discontinuationDate: normalizeDateStr(row[STUDENT_COLS.DISCONT_DATE]),
    notes: row[STUDENT_COLS.NOTES],
    createdAt: row[STUDENT_COLS.CREATED_AT],
    updatedAt: row[STUDENT_COLS.UPDATED_AT],
  };
}

function maskAadhaar(aadhaar) {
  if (!aadhaar || aadhaar.length < 4) return '****';
  const clean = aadhaar.replace(/\s/g, '');
  return 'XXXXXXXX' + clean.slice(-4);
}

function createStudentRecord(studentData) {
  const sheet = getSheet(SHEET_NAMES.STUDENTS);
  const now = new Date().toISOString();
  const regNum = generateRegistrationNumber();

  const rowValues = [
    regNum,
    studentData.studentName,
    studentData.fatherName || '',
    studentData.aadhaar || '',
    studentData.phone || '',
    studentData.address || '',
    parseFloat(studentData.registrationFee) || 0,
    parseFloat(studentData.lockerCharge) || 0,
    parseFloat(studentData.monthlyFee) || 0,
    studentData.admissionDate || '',
    studentData.slotPlan || '',
    'ACTIVE',
    '',   // discontinuationDate
    studentData.notes || '',
    now,
    now,
  ];

  writeRowToFirstEmptyOrAppend(sheet, STUDENT_COLS.REG_NUMBER, rowValues);
  return regNum;
}

function findStudentByRegNumber(regNum) {
  const sheet = getSheet(SHEET_NAMES.STUDENTS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][STUDENT_COLS.REG_NUMBER]) === String(regNum)) {
      return { row: i + 1, student: rowToStudent(data[i]) };
    }
  }
  return null;
}

// ── Payment Data Access ────────────────────────────────────────────────────

function createPaymentRecord(paymentData) {
  const sheet = getSheet(SHEET_NAMES.FEE_UPDATE);
  const now = new Date().toISOString();
  const paymentId = generatePaymentId();
  const receiptNumber = generateReceiptNumber();

  const rowValues = [
    paymentId,
    paymentData.registrationNumber,
    paymentData.paymentDate || now.slice(0, 10),
    parseFloat(paymentData.amount) || 0,
    paymentData.paymentMethod || 'CASH',
    paymentData.transactionRef || '',
    receiptNumber,
    paymentData.notes || '',
    paymentData.enteredBy || 'SYSTEM',
    now,
  ];

  writeRowToFirstEmptyOrAppend(sheet, FEE_UPDATE_COLS.PAYMENT_ID, rowValues);
  return { paymentId, receiptNumber };
}

function getAllPayments() {
  const sheet = getSheet(SHEET_NAMES.FEE_UPDATE);
  const data = sheet.getDataRange().getValues();
  return data.slice(1)
    .filter(row => row[FEE_UPDATE_COLS.PAYMENT_ID])
    .map(row => ({
      paymentId: row[FEE_UPDATE_COLS.PAYMENT_ID],
      registrationNumber: row[FEE_UPDATE_COLS.REG_NUMBER],
      paymentDate: normalizeDateStr(row[FEE_UPDATE_COLS.PAYMENT_DATE]),
      amount: parseFloat(row[FEE_UPDATE_COLS.AMOUNT]) || 0,
      paymentMethod: row[FEE_UPDATE_COLS.PAYMENT_METHOD],
      transactionRef: row[FEE_UPDATE_COLS.TXN_REF],
      receiptNumber: row[FEE_UPDATE_COLS.RECEIPT_NUMBER],
      notes: row[FEE_UPDATE_COLS.NOTES],
      enteredBy: row[FEE_UPDATE_COLS.ENTERED_BY],
      createdAt: row[FEE_UPDATE_COLS.CREATED_AT],
    }));
}

function findStudentByPhone(phone) {
  if (!phone) return null;
  const sheet = getSheet(SHEET_NAMES.STUDENTS);
  const data = sheet.getDataRange().getValues();
  const clean = String(phone).replace(/\D/g, '');
  for (let i = 1; i < data.length; i++) {
    const studentPhone = String(data[i][STUDENT_COLS.PHONE] || '').replace(/\D/g, '');
    if (studentPhone && studentPhone === clean) {
      return { row: i + 1, student: rowToStudent(data[i]) };
    }
  }
  return null;
}

function findStudentByAadhaar(aadhaar) {
  if (!aadhaar) return null;
  const sheet = getSheet(SHEET_NAMES.STUDENTS);
  const data = sheet.getDataRange().getValues();
  const clean = String(aadhaar).replace(/\D/g, '');
  for (let i = 1; i < data.length; i++) {
    const studentAadhaar = String(data[i][STUDENT_COLS.AADHAAR] || '').replace(/\D/g, '');
    if (studentAadhaar && studentAadhaar === clean) {
      return { row: i + 1, student: rowToStudent(data[i]) };
    }
  }
  return null;
}

// ── Ledger Data Access ─────────────────────────────────────────────────────

function getAllLedgerRecords() {
  const sheet = getSheet(SHEET_NAMES.FEE_LEDGER);
  const data = sheet.getDataRange().getValues();
  return data.slice(1)
    .filter(row => row[FEE_LEDGER_COLS.LEDGER_ID])
    .map(row => {
      const year = parseInt(row[FEE_LEDGER_COLS.YEAR]) || 0;
      const month = parseInt(row[FEE_LEDGER_COLS.MONTH]) || 0;
      const label = formatMonthLabel(row[FEE_LEDGER_COLS.MONTH_LABEL], year, month);
      return {
        ledgerId: String(row[FEE_LEDGER_COLS.LEDGER_ID] || ''),
        registrationNumber: String(row[FEE_LEDGER_COLS.REG_NUMBER] || ''),
        year: year || (label ? parseInt(label.slice(0, 4)) : 0),
        month: month || (label ? parseInt(label.slice(5, 7)) : 0),
        monthLabel: label,
        dueAmount: parseFloat(row[FEE_LEDGER_COLS.DUE_AMOUNT]) || 0,
        paidAmount: parseFloat(row[FEE_LEDGER_COLS.PAID_AMOUNT]) || 0,
        balance: parseFloat(row[FEE_LEDGER_COLS.BALANCE]) || 0,
        coveredBy: String(row[FEE_LEDGER_COLS.COVERED_BY] || ''),
        status: String(row[FEE_LEDGER_COLS.STATUS] || 'PENDING'),
        notes: String(row[FEE_LEDGER_COLS.NOTES] || ''),
        updatedAt: normalizeDateStr(row[FEE_LEDGER_COLS.UPDATED_AT]),
      };
    });
}

function getStudentLedgerRecords(regNumber) {
  return getAllLedgerRecords()
    .filter(r => r.registrationNumber === regNumber)
    .sort((a, b) => String(a.monthLabel || '').localeCompare(String(b.monthLabel || '')));
}

function upsertLedgerRecord(record) {
  const sheet = getSheet(SHEET_NAMES.FEE_LEDGER);
  const data = sheet.getDataRange().getValues();
  const now = new Date().toISOString();
  const label = formatMonthLabel(record.monthLabel, record.year, record.month);
  const recYear = parseInt(record.year) || (label ? parseInt(label.slice(0, 4)) : 0);
  const recMonth = parseInt(record.month) || (label ? parseInt(label.slice(5, 7)) : 0);
  
  for (let i = 1; i < data.length; i++) {
    const rReg = String(data[i][FEE_LEDGER_COLS.REG_NUMBER] || '').trim();
    const rYear = parseInt(data[i][FEE_LEDGER_COLS.YEAR]) || 0;
    const rMonth = parseInt(data[i][FEE_LEDGER_COLS.MONTH]) || 0;
    const rLabel = formatMonthLabel(data[i][FEE_LEDGER_COLS.MONTH_LABEL], rYear, rMonth);

    if (rReg === String(record.registrationNumber).trim() && (
      (rYear && recYear && rYear === recYear && rMonth === recMonth) ||
      (rLabel && label && rLabel === label)
    )) {
      const rowNum = i + 1;
      sheet.getRange(rowNum, FEE_LEDGER_COLS.YEAR + 1).setValue(recYear);
      sheet.getRange(rowNum, FEE_LEDGER_COLS.MONTH + 1).setValue(recMonth);
      sheet.getRange(rowNum, FEE_LEDGER_COLS.MONTH_LABEL + 1).setValue("'" + label);
      sheet.getRange(rowNum, FEE_LEDGER_COLS.DUE_AMOUNT + 1).setValue(record.dueAmount);
      sheet.getRange(rowNum, FEE_LEDGER_COLS.PAID_AMOUNT + 1).setValue(record.paidAmount);
      sheet.getRange(rowNum, FEE_LEDGER_COLS.BALANCE + 1).setValue(record.balance);
      sheet.getRange(rowNum, FEE_LEDGER_COLS.COVERED_BY + 1).setValue(record.coveredBy);
      sheet.getRange(rowNum, FEE_LEDGER_COLS.STATUS + 1).setValue(record.status);
      sheet.getRange(rowNum, FEE_LEDGER_COLS.NOTES + 1).setValue(record.notes || '');
      sheet.getRange(rowNum, FEE_LEDGER_COLS.UPDATED_AT + 1).setValue(now);
      return data[i][FEE_LEDGER_COLS.LEDGER_ID];
    }
  }

  const newId = generateLedgerId();
  const newRowValues = [
    newId,
    record.registrationNumber,
    recYear,
    recMonth,
    "'" + label,
    record.dueAmount,
    record.paidAmount,
    record.balance,
    record.coveredBy,
    record.status,
    record.notes || '',
    now,
  ];
  writeRowToFirstEmptyOrAppend(sheet, FEE_LEDGER_COLS.LEDGER_ID, newRowValues);
  return newId;
}


/* ===================== FILE: Handlers.gs ===================== */

/**
 * ============================================================
 * Handlers.gs — Business Logic Handlers for All API Actions
 * ============================================================
 */

// ── Permission Checking ────────────────────────────────────────────────────

function requirePermission(session, permission) {
  if (session.role === ROLES.OWNER) return true;
  if (!session.permissions.includes(permission)) {
    throw new Error(`Permission denied: ${permission}`);
  }
  return true;
}

// ── User Handlers ──────────────────────────────────────────────────────────

function handleUsersList(session) {
  if (session.role !== ROLES.OWNER) {
    return errorResponse('Only owners can manage user accounts.', 'FORBIDDEN');
  }

  const users = getAllUsers().map(u => ({
    id: u.id,
    name: u.name,
    username: u.username,
    role: u.role,
    status: u.status,
    permissions: u.permissions,
    createdDate: u.createdDate,
    lastLogin: u.lastLogin,
    // Never return passwordHash to the frontend
  }));

  return okResponse({ users });
}

function handleUsersCreate(session, payload) {
  if (session.role !== ROLES.OWNER) {
    return errorResponse('Only owners can create user accounts.', 'FORBIDDEN');
  }

  const { userData } = payload;
  if (!userData || !userData.name || !userData.username || !userData.password) {
    return errorResponse('Name, username, and password are required.', 'VALIDATION_ERROR');
  }

  if (userData.password.length < 8) {
    return errorResponse('Password must be at least 8 characters.', 'VALIDATION_ERROR');
  }

  // Check username uniqueness
  const existing = findUserByUsername(userData.username);
  if (existing) {
    return errorResponse('Username already exists.', 'DUPLICATE');
  }

  const userId = generateUserId();
  const passwordHash = hashPassword(userData.username.toLowerCase(), userData.password);

  createUserRecord({
    id: userId,
    name: userData.name,
    username: userData.username.toLowerCase(),
    role: userData.role === ROLES.OWNER ? ROLES.OWNER : ROLES.MANAGER,
    passwordHash,
    permissions: userData.permissions || [],
  });

  writeAuditLog(session.userId, 'CREATE_USER', 'USER', userId, 'SUCCESS',
    { username: userData.username, role: userData.role });

  return okResponse({ userId, message: 'User account created.' });
}

function handleUsersUpdate(session, payload) {
  if (session.role !== ROLES.OWNER) {
    return errorResponse('Only owners can update user accounts.', 'FORBIDDEN');
  }

  const { userId, updates } = payload;
  const found = updateUserRecord(userId, updates);
  if (!found) {
    return errorResponse('User not found.', 'NOT_FOUND');
  }

  writeAuditLog(session.userId, 'UPDATE_USER', 'USER', userId, 'SUCCESS', updates);
  return okResponse({ message: 'User updated.' });
}

function handleUsersDisable(session, payload) {
  if (session.role !== ROLES.OWNER) {
    return errorResponse('Only owners can disable user accounts.', 'FORBIDDEN');
  }

  const { userId } = payload;
  if (userId === session.userId) {
    return errorResponse('You cannot disable your own account.', 'FORBIDDEN');
  }

  const targetUser = findUserById(userId);
  if (!targetUser) {
    return errorResponse('User not found.', 'NOT_FOUND');
  }

  if (targetUser.role === ROLES.OWNER) {
    const allUsers = getAllUsers();
    const activeOwners = allUsers.filter(u => u.role === ROLES.OWNER && u.status === 'ACTIVE');
    if (activeOwners.length <= 1) {
      return errorResponse('Cannot disable the last active owner/admin account.', 'FORBIDDEN');
    }
  }

  const found = updateUserRecord(userId, { status: 'DISABLED' });
  if (!found) {
    return errorResponse('User not found.', 'NOT_FOUND');
  }

  writeAuditLog(session.userId, 'DISABLE_USER', 'USER', userId, 'SUCCESS', { targetUsername: targetUser.username });
  return okResponse({ message: `User "${targetUser.username}" disabled successfully.` });
}

function handleUsersEnable(session, payload) {
  if (session.role !== ROLES.OWNER) {
    return errorResponse('Only owners can enable user accounts.', 'FORBIDDEN');
  }

  const { userId } = payload;
  const targetUser = findUserById(userId);
  if (!targetUser) {
    return errorResponse('User not found.', 'NOT_FOUND');
  }

  const found = updateUserRecord(userId, { status: 'ACTIVE' });
  if (!found) {
    return errorResponse('User not found.', 'NOT_FOUND');
  }

  writeAuditLog(session.userId, 'ENABLE_USER', 'USER', userId, 'SUCCESS', { targetUsername: targetUser.username });
  return okResponse({ message: `User "${targetUser.username}" activated successfully.` });
}

function handleUsersToggleStatus(session, payload) {
  const { userId, status } = payload;
  if (status === 'DISABLED') {
    return handleUsersDisable(session, { userId });
  } else {
    return handleUsersEnable(session, { userId });
  }
}

function handleUsersResetPassword(session, payload) {
  if (session.role !== ROLES.OWNER) {
    return errorResponse('Only owners can reset passwords.', 'FORBIDDEN');
  }

  const { userId, tempPassword } = payload;
  if (!tempPassword || tempPassword.length < 8) {
    return errorResponse('Temporary password must be at least 8 characters.', 'VALIDATION_ERROR');
  }

  const user = findUserById(userId);
  if (!user) {
    return errorResponse('User not found.', 'NOT_FOUND');
  }

  const newHash = hashPassword(user.username, tempPassword);
  updateUserPassword(userId, newHash);

  // Mark that user must change password on next login
  updateUserRecord(userId, {});
  const sheet = getSheet(SHEET_NAMES.PASSWORDS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][PASSWORD_DATA_COLS.USER_ID]) === String(userId)) {
      sheet.getRange(i + 1, PASSWORD_DATA_COLS.TEMP_PW_FLAG + 1).setValue(true);
      break;
    }
  }

  writeAuditLog(session.userId, 'RESET_PASSWORD', 'USER', userId, 'SUCCESS');
  return okResponse({ message: 'Password reset. User must change it on next login.' });
}

// ── Students Handlers ──────────────────────────────────────────────────────

// ── Students Handlers ──────────────────────────────────────────────────────

function handleStudentsList(session, payload) {
  try { requirePermission(session, 'students.view'); }
  catch (e) { return errorResponse(e.message, 'FORBIDDEN'); }

  const students = getAllStudents();
  const { filters } = payload || {};

  let filtered = students;
  if (filters) {
    if (filters.status) filtered = filtered.filter(s => s.status === filters.status);
    if (filters.slotPlan) filtered = filtered.filter(s => s.slotPlan === filters.slotPlan);
    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      filtered = filtered.filter(s =>
        (s.studentName && s.studentName.toLowerCase().includes(q)) ||
        (s.registrationNumber && s.registrationNumber.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q)) ||
        (s.fatherName && s.fatherName.toLowerCase().includes(q))
      );
    }
  }

  return okResponse({ students: filtered, total: filtered.length });
}

function handleStudentsSearch(session, payload) {
  try { requirePermission(session, 'students.view'); }
  catch (e) { return errorResponse(e.message, 'FORBIDDEN'); }

  const query = (payload.query || '').trim().toLowerCase();
  const searchType = payload.searchType || 'all'; // all | name | reg | phone | aadhaar
  const students = getAllStudents();

  if (!query) {
    return okResponse({ students: students.slice(0, 50), total: students.length });
  }

  const results = students.filter(s => {
    if (searchType === 'name') return s.studentName.toLowerCase().includes(query);
    if (searchType === 'reg') return s.registrationNumber.toLowerCase().includes(query);
    if (searchType === 'phone') return s.phone && s.phone.includes(query);
    if (searchType === 'aadhaar') {
      const cleanQ = query.replace(/\D/g, '');
      return s.aadhaarMasked && s.aadhaarMasked.includes(cleanQ);
    }
    // 'all' search
    const cleanQ = query.replace(/\D/g, '');
    return (
      (s.studentName && s.studentName.toLowerCase().includes(query)) ||
      (s.registrationNumber && s.registrationNumber.toLowerCase().includes(query)) ||
      (s.phone && s.phone.includes(query)) ||
      (s.fatherName && s.fatherName.toLowerCase().includes(query)) ||
      (cleanQ.length >= 4 && s.aadhaarMasked && s.aadhaarMasked.includes(cleanQ))
    );
  });

  return okResponse({ students: results, total: results.length });
}

function handleStudentsGet(session, payload) {
  try { requirePermission(session, 'students.view'); }
  catch (e) { return errorResponse(e.message, 'FORBIDDEN'); }

  const found = findStudentByRegNumber(payload.registrationNumber);
  if (!found) return errorResponse('Student not found.', 'NOT_FOUND');

  return okResponse({ student: found.student });
}

function handleStudentsGetProfile(session, payload) {
  try { requirePermission(session, 'students.view'); }
  catch (e) { return errorResponse(e.message, 'FORBIDDEN'); }

  const regNum = payload.registrationNumber;
  const found = findStudentByRegNumber(regNum);
  if (!found) return errorResponse('Student not found.', 'NOT_FOUND');

  const student = found.student;
  const payments = getAllPayments()
    .filter(p => p.registrationNumber === regNum)
    .sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));

  const ledger = getStudentLedgerRecords(regNum);

  // Compute fee summary & paid-through month
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalDue = ledger.reduce((sum, r) => sum + r.dueAmount, 0);
  const outstandingDues = ledger
    .filter(r => r.status === 'PENDING' || r.status === 'PARTIALLY_PAID')
    .reduce((sum, r) => sum + r.balance, 0);

  // Determine paid-through month
  const paidMonths = ledger.filter(r => r.status === 'PAID');
  const paidThrough = paidMonths.length > 0 ? paidMonths[paidMonths.length - 1].monthLabel : null;

  return okResponse({
    student,
    payments,
    ledger,
    summary: {
      totalPaid,
      totalDue,
      outstandingDues,
      paidThrough,
      ledgerCount: ledger.length,
      paymentsCount: payments.length,
    },
  });
}

function handleStudentsCheckDuplicate(session, payload) {
  try { requirePermission(session, 'students.create'); }
  catch (e) { return errorResponse(e.message, 'FORBIDDEN'); }

  const { studentData } = payload || {};
  if (!studentData) return okResponse({ isDuplicate: false });

  if (studentData.phone) {
    const existing = findStudentByPhone(studentData.phone);
    if (existing) {
      return okResponse({
        isDuplicate: true,
        field: 'phone',
        message: `Student with phone ${studentData.phone} already exists (${existing.student.studentName}, ${existing.student.registrationNumber})`,
        existingStudent: existing.student,
      });
    }
  }

  if (studentData.aadhaar) {
    const existing = findStudentByAadhaar(studentData.aadhaar);
    if (existing) {
      return okResponse({
        isDuplicate: true,
        field: 'aadhaar',
        message: `Student with Aadhaar already exists (${existing.student.studentName}, ${existing.student.registrationNumber})`,
        existingStudent: existing.student,
      });
    }
  }

  return okResponse({ isDuplicate: false });
}

function handleStudentsCreate(session, payload) {
  try { requirePermission(session, 'students.create'); }
  catch (e) { return errorResponse(e.message, 'FORBIDDEN'); }

  const { studentData, idempotencyKey } = payload || {};
  if (!studentData || !studentData.studentName) {
    return errorResponse('Student name is required.', 'VALIDATION_ERROR');
  }

  // Idempotency check via cache
  if (idempotencyKey) {
    const cache = CacheService.getScriptCache();
    const cached = cache.get(`idemp_std_${idempotencyKey}`);
    if (cached) {
      try { return okResponse(JSON.parse(cached)); } catch(e){}
    }
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    // Check duplicates before creating
    if (studentData.phone) {
      const dup = findStudentByPhone(studentData.phone);
      if (dup) {
        return errorResponse(`Student with phone ${studentData.phone} already admitted: ${dup.student.studentName} (${dup.student.registrationNumber})`, 'DUPLICATE');
      }
    }
    if (studentData.aadhaar) {
      const dup = findStudentByAadhaar(studentData.aadhaar);
      if (dup) {
        return errorResponse(`Student with this Aadhaar number already admitted: ${dup.student.studentName} (${dup.student.registrationNumber})`, 'DUPLICATE');
      }
    }

    const regNumber = createStudentRecord({ ...studentData });
    writeAuditLog(session.userId, 'CREATE_STUDENT', 'STUDENT', regNumber, 'SUCCESS',
      { studentName: studentData.studentName, phone: studentData.phone, slotPlan: studentData.slotPlan });

    const responseData = {
      registrationNumber: regNumber,
      studentName: studentData.studentName,
      message: 'Student admitted successfully.',
    };

    if (idempotencyKey) {
      CacheService.getScriptCache().put(`idemp_std_${idempotencyKey}`, JSON.stringify(responseData), 3600);
    }

    return okResponse(responseData);
  } finally {
    lock.releaseLock();
  }
}

function handleStudentsUpdate(session, payload) {
  try { requirePermission(session, 'students.update'); }
  catch (e) { return errorResponse(e.message, 'FORBIDDEN'); }

  const { registrationNumber, updates } = payload || {};
  const found = findStudentByRegNumber(registrationNumber);
  if (!found) return errorResponse('Student not found.', 'NOT_FOUND');

  const sheet = getSheet(SHEET_NAMES.STUDENTS);
  const rowNum = found.row;
  const now = new Date().toISOString();

  const fieldMap = {
    studentName: STUDENT_COLS.STUDENT_NAME,
    fatherName: STUDENT_COLS.FATHER_NAME,
    phone: STUDENT_COLS.PHONE,
    address: STUDENT_COLS.ADDRESS,
    registrationFee: STUDENT_COLS.REG_FEE,
    lockerCharge: STUDENT_COLS.LOCKER_CHARGE,
    monthlyFee: STUDENT_COLS.MONTHLY_FEE,
    slotPlan: STUDENT_COLS.SLOT_PLAN,
    notes: STUDENT_COLS.NOTES,
    status: STUDENT_COLS.STATUS,
  };

  for (const [key, colIdx] of Object.entries(fieldMap)) {
    if (updates[key] !== undefined) {
      sheet.getRange(rowNum, colIdx + 1).setValue(updates[key]);
    }
  }
  sheet.getRange(rowNum, STUDENT_COLS.UPDATED_AT + 1).setValue(now);

  writeAuditLog(session.userId, 'UPDATE_STUDENT', 'STUDENT', registrationNumber, 'SUCCESS',
    { modifiedFields: Object.keys(updates) });

  return okResponse({ message: 'Student record updated successfully.' });
}

function handleStudentsDiscontinue(session, payload) {
  try { requirePermission(session, 'students.discontinue'); }
  catch (e) { return errorResponse(e.message, 'FORBIDDEN'); }

  const { registrationNumber, reason, date } = payload || {};
  const found = findStudentByRegNumber(registrationNumber);
  if (!found) return errorResponse('Student not found.', 'NOT_FOUND');
  if (found.student.status === 'INACTIVE') {
    return errorResponse('Student is already marked as inactive.', 'CONFLICT');
  }

  const sheet = getSheet(SHEET_NAMES.STUDENTS);
  const rowNum = found.row;
  const now = new Date().toISOString();
  const discDate = date || now.slice(0, 10);

  sheet.getRange(rowNum, STUDENT_COLS.STATUS + 1).setValue('INACTIVE');
  sheet.getRange(rowNum, STUDENT_COLS.DISCONT_DATE + 1).setValue(discDate);
  sheet.getRange(rowNum, STUDENT_COLS.NOTES + 1).setValue(
    (found.student.notes ? found.student.notes + '\n' : '') + `Discontinued on ${discDate}: ${reason || 'No reason provided'}`
  );
  sheet.getRange(rowNum, STUDENT_COLS.UPDATED_AT + 1).setValue(now);

  writeAuditLog(session.userId, 'DISCONTINUE_STUDENT', 'STUDENT', registrationNumber, 'SUCCESS',
    { reason, date: discDate });

  return okResponse({ message: `Student ${registrationNumber} marked as inactive.` });
}

function handleStudentsReactivate(session, payload) {
  try { requirePermission(session, 'students.update'); }
  catch (e) { return errorResponse(e.message, 'FORBIDDEN'); }

  const { registrationNumber, effectiveDate } = payload || {};
  const found = findStudentByRegNumber(registrationNumber);
  if (!found) return errorResponse('Student not found.', 'NOT_FOUND');
  if (found.student.status === 'ACTIVE') {
    return errorResponse('Student is already active.', 'CONFLICT');
  }

  const sheet = getSheet(SHEET_NAMES.STUDENTS);
  const rowNum = found.row;
  const now = new Date().toISOString();
  const effDate = effectiveDate || now.slice(0, 10);

  sheet.getRange(rowNum, STUDENT_COLS.STATUS + 1).setValue('ACTIVE');
  sheet.getRange(rowNum, STUDENT_COLS.DISCONT_DATE + 1).setValue('');
  sheet.getRange(rowNum, STUDENT_COLS.NOTES + 1).setValue(
    (found.student.notes ? found.student.notes + '\n' : '') + `Reactivated on ${effDate}`
  );
  sheet.getRange(rowNum, STUDENT_COLS.UPDATED_AT + 1).setValue(now);

  writeAuditLog(session.userId, 'REACTIVATE_STUDENT', 'STUDENT', registrationNumber, 'SUCCESS',
    { effectiveDate: effDate });

  return okResponse({ message: `Student ${registrationNumber} reactivated successfully.` });
}

// ── Payments Handlers ──────────────────────────────────────────────────────

function handlePaymentsList(session, payload) {
  try { requirePermission(session, 'payments.view'); }
  catch (e) { return errorResponse(e.message, 'FORBIDDEN'); }

  let payments = getAllPayments();
  const { filters } = payload || {};

  if (filters) {
    if (filters.registrationNumber) {
      payments = payments.filter(p => p.registrationNumber === filters.registrationNumber);
    }
    if (filters.dateFrom) {
      payments = payments.filter(p => p.paymentDate >= filters.dateFrom);
    }
    if (filters.dateTo) {
      payments = payments.filter(p => p.paymentDate <= filters.dateTo);
    }
    if (filters.paymentMethod) {
      payments = payments.filter(p => p.paymentMethod === filters.paymentMethod);
    }
  }

  // Sort newest first
  payments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return okResponse({ payments, total: payments.length });
}

function handlePaymentsPreviewAllocation(session, payload) {
  try { requirePermission(session, 'payments.view'); }
  catch (e) { return errorResponse(e.message, 'FORBIDDEN'); }

  const { registrationNumber, amount, startMonth, numMonths } = payload || {};
  const found = findStudentByRegNumber(registrationNumber);
  if (!found) return errorResponse('Student not found.', 'NOT_FOUND');

  const student = found.student;
  const monthlyRate = parseFloat(student.monthlyFee) || 0;
  const totalAmount = parseFloat(amount) || 0;

  // Determine starting month (YYYY-MM)
  let currYear, currMonth;
  if (startMonth && /^\d{4}-\d{2}$/.test(startMonth)) {
    const parts = startMonth.split('-');
    currYear = parseInt(parts[0]);
    currMonth = parseInt(parts[1]);
  } else {
    // Find next unpaid month from ledger
    const ledger = getStudentLedgerRecords(registrationNumber);
    const paidMonths = ledger.filter(r => r.status === 'PAID');
    if (paidMonths.length > 0) {
      const last = paidMonths[paidMonths.length - 1];
      currYear = last.year;
      currMonth = last.month + 1;
      if (currMonth > 12) { currMonth = 1; currYear++; }
    } else {
      const now = new Date();
      currYear = now.getFullYear();
      currMonth = now.getMonth() + 1;
    }
  }

  const count = parseInt(numMonths) || Math.max(1, Math.floor(totalAmount / (monthlyRate || 1)));
  const allocations = [];
  let remaining = totalAmount;

  for (let i = 0; i < count; i++) {
    const label = `${currYear}-${String(currMonth).padStart(2, '0')}`;
    const due = monthlyRate;
    let allocated = 0;
    let status = 'PENDING';

    if (remaining >= due) {
      allocated = due;
      remaining -= due;
      status = 'PAID';
    } else if (remaining > 0) {
      allocated = remaining;
      remaining = 0;
      status = 'PARTIALLY_PAID';
    } else {
      allocated = 0;
      status = 'PENDING';
    }

    allocations.push({
      year: currYear,
      month: currMonth,
      monthLabel: label,
      dueAmount: due,
      allocatedAmount: allocated,
      balance: Math.max(0, due - allocated),
      status,
    });

    currMonth++;
    if (currMonth > 12) { currMonth = 1; currYear++; }
  }

  const expectedTotal = count * monthlyRate;

  return okResponse({
    preview: {
      registrationNumber,
      studentName: student.studentName,
      monthlyFee: monthlyRate,
      numMonths: count,
      expectedTotal,
      enteredAmount: totalAmount,
      balanceDiff: totalAmount - expectedTotal,
      allocations,
      remainingUnallocated: remaining,
    },
  });
}

function handlePaymentsRecord(session, payload) {
  try { requirePermission(session, 'payments.record'); }
  catch (e) { return errorResponse(e.message, 'FORBIDDEN'); }

  const { paymentData, idempotencyKey } = payload || {};
  if (!paymentData || !paymentData.registrationNumber || !paymentData.amount) {
    return errorResponse('Registration number and amount are required.', 'VALIDATION_ERROR');
  }

  const totalAmount = parseFloat(paymentData.amount);
  if (totalAmount <= 0) {
    return errorResponse('Payment amount must be greater than zero.', 'VALIDATION_ERROR');
  }

  // Idempotency check via cache
  if (idempotencyKey) {
    const cache = CacheService.getScriptCache();
    const cached = cache.get(`idemp_pay_${idempotencyKey}`);
    if (cached) {
      try { return okResponse(JSON.parse(cached)); } catch(e){}
    }
  }

  const found = findStudentByRegNumber(paymentData.registrationNumber);
  if (!found) return errorResponse('Student not found.', 'NOT_FOUND');
  const student = found.student;

  const lock = LockService.getScriptLock();
  lock.waitLock(12000);
  try {
    // 1. Record payment transaction in Fee Updation
    const paymentResult = createPaymentRecord({
      ...paymentData,
      amount: totalAmount,
      enteredBy: session.userId,
    });

    // 2. Compute allocation & update Monthly Fee Ledger
    let currYear, currMonth;
    if (paymentData.startMonth && /^\d{4}-\d{2}$/.test(paymentData.startMonth)) {
      const parts = paymentData.startMonth.split('-');
      currYear = parseInt(parts[0]);
      currMonth = parseInt(parts[1]);
    } else {
      const ledger = getStudentLedgerRecords(paymentData.registrationNumber);
      const paid = ledger.filter(r => r.status === 'PAID');
      if (paid.length > 0) {
        const last = paid[paid.length - 1];
        currYear = last.year;
        currMonth = last.month + 1;
        if (currMonth > 12) { currMonth = 1; currYear++; }
      } else {
        const now = new Date();
        currYear = now.getFullYear();
        currMonth = now.getMonth() + 1;
      }
    }

    const numMonths = parseInt(paymentData.numMonths) || Math.max(1, Math.round(totalAmount / (student.monthlyFee || 1)));
    const monthlyRate = parseFloat(student.monthlyFee) || 0;
    let remaining = totalAmount;
    const allocatedMonths = [];

    for (let i = 0; i < numMonths; i++) {
      const label = `${currYear}-${String(currMonth).padStart(2, '0')}`;
      const due = monthlyRate;
      let allocated = 0;
      let status = 'PENDING';

      if (remaining >= due) {
        allocated = due;
        remaining -= due;
        status = 'PAID';
      } else if (remaining > 0) {
        allocated = remaining;
        remaining = 0;
        status = 'PARTIALLY_PAID';
      } else {
        allocated = 0;
        status = 'PENDING';
      }

      upsertLedgerRecord({
        registrationNumber: paymentData.registrationNumber,
        year: currYear,
        month: currMonth,
        monthLabel: label,
        dueAmount: due,
        paidAmount: allocated,
        balance: Math.max(0, due - allocated),
        coveredBy: paymentResult.paymentId,
        status,
        notes: `Paid via ${paymentData.paymentMethod || 'CASH'} (RCP: ${paymentResult.receiptNumber})`,
      });

      allocatedMonths.push({
        monthLabel: label,
        dueAmount: due,
        allocatedAmount: allocated,
        balance: Math.max(0, due - allocated),
        status,
      });

      currMonth++;
      if (currMonth > 12) { currMonth = 1; currYear++; }
    }

    writeAuditLog(session.userId, 'RECORD_PAYMENT', 'PAYMENT', paymentResult.paymentId, 'SUCCESS', {
      registrationNumber: paymentData.registrationNumber,
      amount: totalAmount,
      receiptNumber: paymentResult.receiptNumber,
      monthsCovered: allocatedMonths.length,
    });

    const responseData = {
      paymentId: paymentResult.paymentId,
      receiptNumber: paymentResult.receiptNumber,
      amount: totalAmount,
      studentName: student.studentName,
      registrationNumber: paymentData.registrationNumber,
      paymentDate: paymentData.paymentDate || new Date().toISOString().slice(0, 10),
      paymentMethod: paymentData.paymentMethod || 'CASH',
      allocatedMonths,
      remainingCredit: remaining,
      message: `Payment of ₹${totalAmount.toLocaleString('en-IN')} recorded successfully.`,
    };

    if (idempotencyKey) {
      CacheService.getScriptCache().put(`idemp_pay_${idempotencyKey}`, JSON.stringify(responseData), 3600);
    }

    return okResponse(responseData);
  } finally {
    lock.releaseLock();
  }
}

function handlePaymentsStudentHistory(session, payload) {
  try { requirePermission(session, 'payments.view'); }
  catch (e) { return errorResponse(e.message, 'FORBIDDEN'); }

  const payments = getAllPayments()
    .filter(p => p.registrationNumber === payload.registrationNumber)
    .sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));

  return okResponse({ payments });
}

// ── Ledger Handlers ────────────────────────────────────────────────────────

function handleLedgerGetStudent(session, payload) {
  try { requirePermission(session, 'payments.view'); }
  catch (e) { return errorResponse(e.message, 'FORBIDDEN'); }

  const ledger = getStudentLedgerRecords(payload.registrationNumber);
  return okResponse({ ledger });
}

function handleLedgerMonthlyStatus(session, payload) {
  try { requirePermission(session, 'reports.view'); }
  catch (e) { return errorResponse(e.message, 'FORBIDDEN'); }

  const year = parseInt(payload.year) || new Date().getFullYear();
  const month = parseInt(payload.month) || (new Date().getMonth() + 1);
  const targetLabel = `${year}-${String(month).padStart(2, '0')}`;

  const students = getAllStudents();
  const allLedger = getAllLedgerRecords();
  const targetLedger = allLedger.filter(l => l.monthLabel === targetLabel);

  const statusList = students.map(s => {
    const lRecord = targetLedger.find(l => l.registrationNumber === s.registrationNumber);
    const isInactive = s.status === 'INACTIVE' && s.discontinuationDate && s.discontinuationDate < `${targetLabel}-01`;

    let feeStatus = 'PENDING';
    let paidAmount = 0;
    let dueAmount = parseFloat(s.monthlyFee) || 0;
    let balance = dueAmount;

    if (isInactive) {
      feeStatus = 'NOT_APPLICABLE';
      dueAmount = 0;
      balance = 0;
    } else if (lRecord) {
      feeStatus = lRecord.status;
      paidAmount = lRecord.paidAmount;
      balance = lRecord.balance;
      dueAmount = lRecord.dueAmount;
    }

    return {
      registrationNumber: s.registrationNumber,
      studentName: s.studentName,
      fatherName: s.fatherName,
      phone: s.phone,
      slotPlan: s.slotPlan,
      studentStatus: s.status,
      monthlyFee: s.monthlyFee,
      feeStatus,
      dueAmount,
      paidAmount,
      balance,
      coveredBy: lRecord?.coveredBy || '',
      updatedAt: lRecord?.updatedAt || '',
    };
  });

  const activeStudentsInMonth = statusList.filter(s => s.studentStatus === 'ACTIVE');
  const paidCount = activeStudentsInMonth.filter(s => s.feeStatus === 'PAID').length;
  const partialCount = activeStudentsInMonth.filter(s => s.feeStatus === 'PARTIALLY_PAID').length;
  const pendingCount = activeStudentsInMonth.filter(s => s.feeStatus === 'PENDING').length;
  const totalDue = activeStudentsInMonth.reduce((sum, s) => sum + s.dueAmount, 0);
  const totalCollected = activeStudentsInMonth.reduce((sum, s) => sum + s.paidAmount, 0);
  const totalOutstanding = activeStudentsInMonth.reduce((sum, s) => sum + s.balance, 0);

  return okResponse({
    monthLabel: targetLabel,
    year,
    month,
    summary: {
      totalStudents: activeStudentsInMonth.length,
      paidCount,
      partialCount,
      pendingCount,
      totalDue,
      totalCollected,
      totalOutstanding,
    },
    students: statusList,
  });
}

// ── Reports Handlers ───────────────────────────────────────────────────────

function handleReportsDashboard(session) {
  try { requirePermission(session, 'reports.view'); }
  catch (e) { return errorResponse(e.message, 'FORBIDDEN'); }

  const students = getAllStudents();
  const payments = getAllPayments();
  const ledger = getAllLedgerRecords();

  const activeStudents = students.filter(s => s.status === 'ACTIVE').length;
  const totalStudents = students.length;

  const now = new Date();
  const currentMonthLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Collections this month
  const thisMonthPayments = payments.filter(p => {
    const d = String(p.paymentDate || p.createdAt || '');
    return d.startsWith(currentMonthLabel);
  });
  const monthlyCollection = thisMonthPayments.reduce((sum, p) => sum + p.amount, 0);

  // New admissions this month
  const newAdmissions = students.filter(s => {
    const d = String(s.admissionDate || s.createdAt || '');
    return d.startsWith(currentMonthLabel);
  }).length;

  // Pending student fees this month
  const currentMonthLedger = ledger.filter(l => l.monthLabel === currentMonthLabel);
  let pendingFeesThisMonth = 0;
  let defaultersCount = 0;

  students.filter(s => s.status === 'ACTIVE').forEach(s => {
    const entry = currentMonthLedger.find(l => l.registrationNumber === s.registrationNumber);
    if (!entry) {
      // No ledger entry means entirely pending for current month
      pendingFeesThisMonth += (parseFloat(s.monthlyFee) || 0);
      defaultersCount++;
    } else if (entry.status === 'PENDING' || entry.status === 'PARTIALLY_PAID') {
      pendingFeesThisMonth += entry.balance;
      defaultersCount++;
    }
  });

  // Last 6 months collection trend
  const monthly = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const shortLabel = d.toLocaleString('en-IN', { month: 'short' });

    const monthPayments = payments.filter(p => String(p.paymentDate || '').startsWith(label));
    const amount = monthPayments.reduce((sum, p) => sum + p.amount, 0);
    const admissions = students.filter(s => String(s.admissionDate || '').startsWith(label)).length;
    const discontinuations = students.filter(s => String(s.discontinuationDate || '').startsWith(label)).length;

    monthly.push({ month: shortLabel, amount, admissions, discontinuations });
  }

  // Recent 10 payments
  const recentPayments = payments
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 10)
    .map(p => {
      const student = students.find(s => s.registrationNumber === p.registrationNumber);
      return { ...p, studentName: student?.studentName || p.registrationNumber };
    });

  return okResponse({
    data: {
      stats: {
        activeStudents,
        totalStudents,
        monthlyCollection,
        paymentsThisMonth: thisMonthPayments.length,
        pendingStudentFees: pendingFeesThisMonth,
        defaulters: defaultersCount,
        newAdmissions,
      },
      monthly,
      recentPayments,
    },
  });
}

function handleReportsMonthlyCollection(session, payload) {
  try { requirePermission(session, 'reports.view'); }
  catch (e) { return errorResponse(e.message, 'FORBIDDEN'); }

  const { year, month } = payload || {};
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const payments = getAllPayments().filter(p => String(p.paymentDate || '').startsWith(monthStr));
  const total = payments.reduce((sum, p) => sum + p.amount, 0);

  return okResponse({ payments, total, month: monthStr });
}

function handleReportsFeeDefaulters(session) {
  try { requirePermission(session, 'reports.view'); }
  catch (e) { return errorResponse(e.message, 'FORBIDDEN'); }

  const now = new Date();
  const currentMonthLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const students = getAllStudents().filter(s => s.status === 'ACTIVE');
  const allLedger = getAllLedgerRecords().filter(l => l.monthLabel === currentMonthLabel);

  const defaulters = [];
  students.forEach(s => {
    const l = allLedger.find(r => r.registrationNumber === s.registrationNumber);
    if (!l) {
      defaulters.push({
        registrationNumber: s.registrationNumber,
        studentName: s.studentName,
        phone: s.phone,
        monthlyFee: s.monthlyFee,
        dueAmount: s.monthlyFee,
        status: 'PENDING',
      });
    } else if (l.status === 'PENDING' || l.status === 'PARTIALLY_PAID') {
      defaulters.push({
        registrationNumber: s.registrationNumber,
        studentName: s.studentName,
        phone: s.phone,
        monthlyFee: s.monthlyFee,
        dueAmount: l.balance,
        status: l.status,
      });
    }
  });

  return okResponse({ defaulters, month: currentMonthLabel });
}

/**
 * Complete Owner/Admin Dashboard Analytics with true Google Sheets metrics
 */
function handleReportsOwnerDashboard(session, payload) {
  try { requirePermission(session, 'reports.view'); }
  catch (e) { return errorResponse(e.message, 'FORBIDDEN'); }

  const now = new Date();
  const year = parseInt(payload && payload.year) || now.getFullYear();
  const month = parseInt(payload && payload.month) || (now.getMonth() + 1);
  const targetMonthLabel = `${year}-${String(month).padStart(2, '0')}`;
  const targetYearLabel = `${year}`;
  const dateFrom = payload && payload.dateFrom;
  const dateTo = payload && payload.dateTo;
  const statusFilter = payload && payload.statusFilter;

  const students = getAllStudents();
  const payments = getAllPayments();
  const ledger = getAllLedgerRecords();

  const activeStudents = students.filter(s => s.status === 'ACTIVE').length;
  const nonActiveStudents = students.filter(s => s.status === 'INACTIVE').length;

  const newAdmissionsMonth = students.filter(s => {
    const d = String(s.admissionDate || s.createdAt || '');
    return d.startsWith(targetMonthLabel);
  }).length;

  const newAdmissionsYear = students.filter(s => {
    const d = String(s.admissionDate || s.createdAt || '');
    return d.startsWith(targetYearLabel);
  }).length;

  let cashCollectedMonth = 0;
  let cashCollectedYear = 0;
  let customRangeCollected = 0;

  payments.forEach(p => {
    const pDate = String(p.paymentDate || p.createdAt || '').slice(0, 10);
    const amt = parseFloat(p.amount) || 0;
    if (pDate.startsWith(targetMonthLabel)) {
      cashCollectedMonth += amt;
    }
    if (pDate.startsWith(targetYearLabel)) {
      cashCollectedYear += amt;
    }
    if (dateFrom && dateTo && pDate >= dateFrom && pDate <= dateTo) {
      customRangeCollected += amt;
    }
  });

  const targetMonthStart = `${targetMonthLabel}-01`;
  const targetMonthEnd = `${targetMonthLabel}-31`;

  let monthlyFeeDue = 0;
  let feeAllocatedMonth = 0;
  let outstandingFeeBalances = 0;
  let paidInMonthCount = 0;
  let partialInMonthCount = 0;
  let pendingInMonthCount = 0;

  const eligibleStudents = students.filter(s => {
    const adm = String(s.admissionDate || '').slice(0, 10);
    if (adm && adm > targetMonthEnd) return false;
    if (s.status === 'INACTIVE' && s.discontinuationDate && s.discontinuationDate < targetMonthStart) return false;
    if (statusFilter && statusFilter !== 'ALL' && s.status !== statusFilter) return false;
    return true;
  });

  const monthLedger = ledger.filter(l => l.monthLabel === targetMonthLabel);

  eligibleStudents.forEach(s => {
    const rate = parseFloat(s.monthlyFee) || 0;
    monthlyFeeDue += rate;

    const entry = monthLedger.find(l => l.registrationNumber === s.registrationNumber);
    if (!entry) {
      outstandingFeeBalances += rate;
      pendingInMonthCount++;
    } else {
      feeAllocatedMonth += entry.paidAmount;
      outstandingFeeBalances += entry.balance;
      if (entry.status === 'PAID') paidInMonthCount++;
      else if (entry.status === 'PARTIALLY_PAID') partialInMonthCount++;
      else pendingInMonthCount++;
    }
  });

  const registrationFeesCollected = students.reduce((sum, s) => sum + (parseFloat(s.registrationFee) || 0), 0);
  const refundableLockerDepositsHeld = students
    .filter(s => s.status === 'ACTIVE')
    .reduce((sum, s) => sum + (parseFloat(s.lockerCharge) || 0), 0);

  const advancePaidStudentRegs = {};
  ledger.forEach(l => {
    if (l.status === 'PAID' && l.monthLabel > targetMonthLabel) {
      advancePaidStudentRegs[l.registrationNumber] = true;
    }
  });
  const advancePaidStudentsCount = Object.keys(advancePaidStudentRegs).length;

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyTrend = [];
  for (let m = 1; m <= 12; m++) {
    const mStr = String(m).padStart(2, '0');
    const label = `${year}-${mStr}`;
    const name = monthNames[m - 1];

    const cash = payments
      .filter(p => String(p.paymentDate || p.createdAt || '').startsWith(label))
      .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

    const feeAlloc = ledger
      .filter(l => l.monthLabel === label)
      .reduce((sum, l) => sum + (parseFloat(l.paidAmount) || 0), 0);

    const admCount = students
      .filter(s => String(s.admissionDate || s.createdAt || '').startsWith(label))
      .length;

    monthlyTrend.push({
      month: name,
      monthLabel: label,
      cashCollection: cash,
      feeCoverage: feeAlloc,
      admissions: admCount,
    });
  }

  const planCounts = {};
  students.filter(s => s.status === 'ACTIVE').forEach(s => {
    const plan = s.slotPlan || 'General';
    planCounts[plan] = (planCounts[plan] || 0) + 1;
  });
  const planDistribution = Object.keys(planCounts).map(name => ({ name, count: planCounts[name] }));

  const recentTransactions = payments
    .slice()
    .sort((a, b) => new Date(b.createdAt || b.paymentDate) - new Date(a.createdAt || a.paymentDate))
    .slice(0, 10)
    .map(p => {
      const st = students.find(s => s.registrationNumber === p.registrationNumber);
      return {
        ...p,
        studentName: st ? st.studentName : p.registrationNumber,
      };
    });

  return okResponse({
    selectedYear: year,
    selectedMonth: month,
    selectedMonthLabel: targetMonthLabel,
    stats: {
      totalActiveStudents: activeStudents,
      totalNonActiveStudents: nonActiveStudents,
      newAdmissionsMonth,
      newAdmissionsYear,
      actualCashCollectedMonth: cashCollectedMonth,
      actualCashCollectedYear: cashCollectedYear,
      monthlyFeeDue,
      feeAllocatedMonth,
      outstandingFeeBalances,
      registrationFeesCollected,
      refundableLockerDepositsHeld,
      advancePaidStudentsCount,
      paidInMonthCount,
      partialInMonthCount,
      pendingInMonthCount,
      customRangeCollected: dateFrom && dateTo ? customRangeCollected : null,
    },
    monthlyTrend,
    planDistribution,
    recentTransactions,
  });
}

/**
 * Monthly Fee Collection Analytics Handler
 */
function handleReportsCollectionAnalytics(session, payload) {
  try { requirePermission(session, 'reports.view'); }
  catch (e) { return errorResponse(e.message, 'FORBIDDEN'); }

  const now = new Date();
  const year = parseInt(payload && payload.year) || now.getFullYear();
  const selectedMonthNum = parseInt(payload && payload.month) || (now.getMonth() + 1);
  const selectedMonthLabel = `${year}-${String(selectedMonthNum).padStart(2, '0')}`;
  const dateFrom = payload && payload.dateFrom;
  const dateTo = payload && payload.dateTo;

  const students = getAllStudents();
  const payments = getAllPayments();
  const ledger = getAllLedgerRecords();
  const auditLogs = getAllAuditLogs();

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthByMonth = [];

  let yearlyCash = 0;
  let yearlyFeeAlloc = 0;
  let yearlyFeeDue = 0;
  let yearlyOutstanding = 0;
  let yearlyRegFees = 0;
  let yearlyLockerDeposits = 0;
  let yearlyAdmissions = 0;

  for (let m = 1; m <= 12; m++) {
    const mStr = String(m).padStart(2, '0');
    const label = `${year}-${mStr}`;
    const name = monthNames[m - 1];

    const cash = payments
      .filter(p => String(p.paymentDate || p.createdAt || '').startsWith(label))
      .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

    const monthLedger = ledger.filter(l => l.monthLabel === label);
    const feeAllocated = monthLedger.reduce((sum, l) => sum + (parseFloat(l.paidAmount) || 0), 0);

    const activeInMonth = students.filter(s => {
      const adm = String(s.admissionDate || '').slice(0, 10);
      if (adm && adm > `${label}-31`) return false;
      if (s.status === 'INACTIVE' && s.discontinuationDate && s.discontinuationDate < `${label}-01`) return false;
      return true;
    });

    const feeDue = activeInMonth.reduce((sum, s) => sum + (parseFloat(s.monthlyFee) || 0), 0);
    const outstanding = Math.max(0, feeDue - feeAllocated);
    const collectionPercentage = feeDue > 0 ? Math.min(100, Math.round((feeAllocated / feeDue) * 100)) : 0;

    const admittedInMonth = students.filter(s => String(s.admissionDate || s.createdAt || '').startsWith(label));
    const newAdmissions = admittedInMonth.length;
    const regFees = admittedInMonth.reduce((sum, s) => sum + (parseFloat(s.registrationFee) || 0), 0);
    const lockerDeposits = admittedInMonth.reduce((sum, s) => sum + (parseFloat(s.lockerCharge) || 0), 0);

    const discontinued = students.filter(s => String(s.discontinuationDate || '').startsWith(label)).length;

    const reactivated = auditLogs.filter(a =>
      a.action === 'REACTIVATE_STUDENT' &&
      String(a.timestamp || '').startsWith(label) &&
      a.result === 'SUCCESS'
    ).length;

    yearlyCash += cash;
    yearlyFeeAlloc += feeAllocated;
    yearlyFeeDue += feeDue;
    yearlyOutstanding += outstanding;
    yearlyRegFees += regFees;
    yearlyLockerDeposits += lockerDeposits;
    yearlyAdmissions += newAdmissions;

    monthByMonth.push({
      monthNum: m,
      monthName: name,
      monthLabel: label,
      cashCollected: cash,
      feeAllocated,
      feeDue,
      outstanding,
      collectionPercentage,
      newAdmissions,
      regFees,
      lockerDeposits,
      discontinued,
      reactivated,
    });
  }

  const selectedMonthData = monthByMonth.find(m => m.monthNum === selectedMonthNum) || monthByMonth[0];
  const targetLedger = ledger.filter(l => l.monthLabel === selectedMonthLabel);

  const studentBreakdown = students.map(s => {
    const lRecord = targetLedger.find(l => l.registrationNumber === s.registrationNumber);
    const isInactive = s.status === 'INACTIVE' && s.discontinuationDate && s.discontinuationDate < `${selectedMonthLabel}-01`;

    let feeStatus = 'PENDING';
    let paidAmount = 0;
    let dueAmount = parseFloat(s.monthlyFee) || 0;
    let balance = dueAmount;

    if (isInactive) {
      feeStatus = 'NOT_APPLICABLE';
      dueAmount = 0;
      balance = 0;
    } else if (lRecord) {
      feeStatus = lRecord.status;
      paidAmount = lRecord.paidAmount;
      balance = lRecord.balance;
      dueAmount = lRecord.dueAmount;
    }

    return {
      registrationNumber: s.registrationNumber,
      studentName: s.studentName,
      fatherName: s.fatherName,
      phone: s.phone,
      slotPlan: s.slotPlan,
      status: s.status,
      monthlyFee: s.monthlyFee,
      feeStatus,
      dueAmount,
      paidAmount,
      balance,
      coveredBy: lRecord ? lRecord.coveredBy : '',
    };
  });

  const activeBreakdown = studentBreakdown.filter(s => s.feeStatus !== 'NOT_APPLICABLE');
  const paidCount = activeBreakdown.filter(s => s.feeStatus === 'PAID').length;
  const partialCount = activeBreakdown.filter(s => s.feeStatus === 'PARTIALLY_PAID').length;
  const pendingCount = activeBreakdown.filter(s => s.feeStatus === 'PENDING').length;

  let customRangePayments = [];
  let customRangeTotal = 0;
  if (dateFrom && dateTo) {
    customRangePayments = payments.filter(p => {
      const pd = String(p.paymentDate || p.createdAt || '').slice(0, 10);
      return pd >= dateFrom && pd <= dateTo;
    });
    customRangeTotal = customRangePayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  }

  return okResponse({
    year,
    selectedMonthNum,
    selectedMonthLabel,
    monthByMonth,
    yearlyTotals: {
      totalCashCollected: yearlyCash,
      totalFeeAllocated: yearlyFeeAlloc,
      totalFeeDue: yearlyFeeDue,
      totalOutstanding: yearlyOutstanding,
      totalRegFees: yearlyRegFees,
      totalLockerDeposits: yearlyLockerDeposits,
      totalAdmissions: yearlyAdmissions,
      overallCollectionPercentage: yearlyFeeDue > 0 ? Math.min(100, Math.round((yearlyFeeAlloc / yearlyFeeDue) * 100)) : 0,
    },
    selectedMonthDetails: {
      monthNum: selectedMonthData.monthNum,
      monthName: selectedMonthData.monthName,
      monthLabel: selectedMonthData.monthLabel,
      cashCollected: selectedMonthData.cashCollected,
      feeAllocated: selectedMonthData.feeAllocated,
      feeDue: selectedMonthData.feeDue,
      outstanding: selectedMonthData.outstanding,
      collectionPercentage: selectedMonthData.collectionPercentage,
      newAdmissions: selectedMonthData.newAdmissions,
      regFees: selectedMonthData.regFees,
      lockerDeposits: selectedMonthData.lockerDeposits,
      discontinued: selectedMonthData.discontinued,
      reactivated: selectedMonthData.reactivated,
      paidCount,
      partialCount,
      pendingCount,
      students: studentBreakdown,
    },
    customRange: dateFrom && dateTo ? {
      dateFrom,
      dateTo,
      totalCash: customRangeTotal,
      count: customRangePayments.length,
    } : null,
  });
}

/**
 * Admission Analytics Handler
 */
function handleReportsAdmissionAnalytics(session, payload) {
  try { requirePermission(session, 'reports.view'); }
  catch (e) { return errorResponse(e.message, 'FORBIDDEN'); }

  const now = new Date();
  const year = parseInt(payload && payload.year) || now.getFullYear();
  const dateFrom = payload && payload.dateFrom;
  const dateTo = payload && payload.dateTo;
  const status = payload && payload.status;
  const slotPlan = payload && payload.slotPlan;

  let students = getAllStudents();

  if (status && status !== 'ALL') {
    students = students.filter(s => s.status === status);
  }
  if (slotPlan && slotPlan !== 'ALL') {
    students = students.filter(s => s.slotPlan === slotPlan);
  }
  if (dateFrom && dateTo) {
    students = students.filter(s => {
      const adm = String(s.admissionDate || s.createdAt || '').slice(0, 10);
      return adm >= dateFrom && adm <= dateTo;
    });
  }

  const allStudents = getAllStudents();

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const byMonth = monthNames.map((name, idx) => {
    const mStr = String(idx + 1).padStart(2, '0');
    const label = `${year}-${mStr}`;
    const count = allStudents.filter(s => String(s.admissionDate || s.createdAt || '').startsWith(label)).length;
    return { month: name, label, admissions: count };
  });

  const yearlyCounts = {};
  allStudents.forEach(s => {
    const y = String(s.admissionDate || s.createdAt || '').slice(0, 4);
    if (y && /^\d{4}$/.test(y)) {
      yearlyCounts[y] = (yearlyCounts[y] || 0) + 1;
    }
  });
  const byYear = Object.keys(yearlyCounts)
    .sort()
    .map(y => ({ year: y, admissions: yearlyCounts[y] }));

  const activeCount = allStudents.filter(s => s.status === 'ACTIVE').length;
  const discontinuedCount = allStudents.filter(s => s.status === 'INACTIVE').length;

  const planStats = {};
  allStudents.forEach(s => {
    const plan = s.slotPlan || 'General';
    if (!planStats[plan]) {
      planStats[plan] = { name: plan, count: 0, totalFee: 0 };
    }
    planStats[plan].count++;
    planStats[plan].totalFee += (parseFloat(s.monthlyFee) || 0);
  });
  const bySlotPlan = Object.keys(planStats).map(k => {
    const p = planStats[k];
    return {
      name: p.name,
      count: p.count,
      percentage: allStudents.length > 0 ? Math.round((p.count / allStudents.length) * 100) : 0,
      totalMonthlyRevenue: p.totalFee,
      avgFee: p.count > 0 ? Math.round(p.totalFee / p.count) : 0,
    };
  });

  const history = students
    .slice()
    .sort((a, b) => (b.admissionDate || '').localeCompare(a.admissionDate || ''))
    .map(s => ({
      registrationNumber: s.registrationNumber,
      studentName: s.studentName,
      fatherName: s.fatherName,
      phone: s.phone,
      admissionDate: s.admissionDate,
      slotPlan: s.slotPlan,
      monthlyFee: s.monthlyFee,
      registrationFee: s.registrationFee,
      lockerCharge: s.lockerCharge,
      status: s.status,
    }));

  return okResponse({
    selectedYear: year,
    byMonth,
    byYear,
    activeVsDiscontinued: { activeCount, discontinuedCount },
    bySlotPlan,
    history,
  });
}

/**
 * Searchable Audit Log Handler
 */
function handleAuditLogList(session, payload) {
  if (session.role !== ROLES.OWNER) {
    return errorResponse('Only owners can view the audit log.', 'FORBIDDEN');
  }

  let logs = getAllAuditLogs();
  const action = payload && payload.action;
  const entityType = payload && payload.entityType;
  const userId = payload && payload.userId;
  const dateFrom = payload && payload.dateFrom;
  const dateTo = payload && payload.dateTo;
  const limit = (payload && parseInt(payload.limit)) || 100;
  const offset = (payload && parseInt(payload.offset)) || 0;

  if (action) logs = logs.filter(l => l.action === action);
  if (entityType) logs = logs.filter(l => l.entityType === entityType);
  if (userId) logs = logs.filter(l => l.userId === userId);
  if (dateFrom) logs = logs.filter(l => l.timestamp >= dateFrom);
  if (dateTo) logs = logs.filter(l => l.timestamp <= dateTo);

  logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const total = logs.length;
  const paged = logs.slice(offset, offset + limit);

  return okResponse({ logs: paged, total });
}



/* ===================== FILE: Setup.gs ===================== */

/**
 * ============================================================
 * Setup.gs — One-time Setup and Admin Utilities
 * ============================================================
 * Run these functions ONCE from the Apps Script editor to set up
 * the spreadsheet and create the initial owner account.
 * DO NOT deploy these as web app endpoints.
 */

/**
 * STEP 1: Initialize all sheets with correct headers.
 * Run this from the Apps Script editor: Run → initializeSheets
 */
function runInitializeSheets() {
  const result = initializeSheets();
  console.log('initializeSheets result:', result);
  SpreadsheetApp.getUi().alert('Sheets initialized successfully! Check the spreadsheet.');
}

/**
 * STEP 2: Create the initial Owner account.
 * Run this ONCE from the Apps Script editor.
 * Change the values below before running.
 *
 * SECURITY: After running, delete or comment out this function to prevent
 * accidental re-execution from the editor.
 */
function createInitialOwner() {
  // ── CHANGE THESE BEFORE RUNNING ──────────────────────────────────────────
  const OWNER_NAME = 'Library Owner';         // Full name
  const OWNER_USERNAME = 'admin';             // Login username (will be lowercased)
  const OWNER_PASSWORD = 'ChangeMe@2024!';   // Strong temporary password
  // ─────────────────────────────────────────────────────────────────────────

  // Validate script properties are set
  try {
    getScriptProp('SPREADSHEET_ID');
    getScriptProp('PASSWORD_SALT');
    getScriptProp('SESSION_SECRET');
  } catch (e) {
    SpreadsheetApp.getUi().alert(
      'ERROR: Script Properties are not set!\n\n' +
      'Go to Project Settings → Script Properties and add:\n' +
      '• SPREADSHEET_ID\n• PASSWORD_SALT\n• SESSION_SECRET\n\nThen try again.'
    );
    return;
  }

  const existing = findUserByUsername(OWNER_USERNAME.toLowerCase());
  if (existing) {
    SpreadsheetApp.getUi().alert(`Username "${OWNER_USERNAME}" already exists. Delete the row and try again.`);
    return;
  }

  const userId = generateUserId();
  const passwordHash = hashPassword(OWNER_USERNAME.toLowerCase(), OWNER_PASSWORD);

  createUserRecord({
    id: userId,
    name: OWNER_NAME,
    username: OWNER_USERNAME.toLowerCase(),
    role: ROLES.OWNER,
    passwordHash,
    permissions: [],  // Owners have all permissions implicitly
  });

  console.log(`Owner created: ${OWNER_NAME} (${OWNER_USERNAME}) → ${userId}`);
  SpreadsheetApp.getUi().alert(
    `✅ Owner account created!\n\n` +
    `Username: ${OWNER_USERNAME}\n` +
    `Password: ${OWNER_PASSWORD}\n\n` +
    `⚠️ Log in and change this password immediately!\n\n` +
    `Then comment out or delete createInitialOwner() for security.`
  );
}

/**
 * Utility: Generate a random secret suitable for PASSWORD_SALT or SESSION_SECRET.
 * Run this to get a value to paste into Script Properties.
 */
function generateSecret() {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    Math.random().toString() + Date.now().toString()
  );
  const hex = bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
  console.log('Generated secret (copy to Script Properties):', hex);
  SpreadsheetApp.getUi().alert(
    'Generated Secret (copy this):\n\n' + hex +
    '\n\nRun generateSecret() again for a second secret (SESSION_SECRET).'
  );
  return hex;
}

/**
 * Verify current configuration — useful for debugging.
 */
function verifyConfiguration() {
  const results = [];

  try {
    const id = getScriptProp('SPREADSHEET_ID');
    SpreadsheetApp.openById(id);
    results.push('✅ SPREADSHEET_ID — valid');
  } catch (e) {
    results.push('❌ SPREADSHEET_ID — ' + e.message);
  }

  try {
    getScriptProp('PASSWORD_SALT');
    results.push('✅ PASSWORD_SALT — set');
  } catch (e) {
    results.push('❌ PASSWORD_SALT — not set');
  }

  try {
    getScriptProp('SESSION_SECRET');
    results.push('✅ SESSION_SECRET — set');
  } catch (e) {
    results.push('❌ SESSION_SECRET — not set');
  }

  for (const name of Object.values(SHEET_NAMES)) {
    try {
      getSheet(name);
      results.push(`✅ Sheet "${name}" — exists`);
    } catch {
      results.push(`❌ Sheet "${name}" — MISSING`);
    }
  }

  const message = results.join('\n');
  console.log(message);
  try {
    SpreadsheetApp.getUi().alert('Configuration Check:\n\n' + message);
  } catch (e) {}
}

/**
 * Seed canonical user accounts for testing and production
 * (admin / ChangeMe@2024! and manager / Zenith@2026)
 */
function seedUsersWithCanonicalHash() {
  const ss = getSpreadsheet();
  initializeSheets();
  const sheet = getSheet(SHEET_NAMES.PASSWORDS);
  const data = sheet.getDataRange().getValues();

  const usersToSeed = [
    {
      id: 'USR_OWNER_001',
      name: 'System Administrator',
      username: 'admin',
      role: 'OWNER',
      password: 'ChangeMe@2024!',
      permissions: ['ALL']
    },
    {
      id: 'USR_MGR_001',
      name: 'Library Branch Manager',
      username: 'manager',
      role: 'MANAGER',
      password: 'Zenith@2026',
      permissions: ['VIEW_STUDENTS', 'ADD_STUDENT', 'EDIT_STUDENT', 'RECORD_FEE', 'VIEW_FEES', 'EXPORT_REPORTS']
    }
  ];

  const now = new Date().toISOString();

  usersToSeed.forEach(u => {
    let existingIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][PASSWORD_DATA_COLS.USERNAME]).toLowerCase() === u.username.toLowerCase()) {
        existingIndex = i;
        break;
      }
    }

    const hash = hashPassword(u.username.toLowerCase(), u.password);
    const rowValues = [
      u.id,
      u.name,
      u.username,
      u.role,
      hash,
      'ACTIVE',
      JSON.stringify(u.permissions),
      now,
      '',
      false
    ];

    if (existingIndex > 0) {
      sheet.getRange(existingIndex + 1, 1, 1, rowValues.length).setValues([rowValues]);
      console.log('Updated existing user:', u.username);
    } else {
      sheet.appendRow(rowValues);
      console.log('Inserted new user:', u.username);
    }
  });

  console.log('Seeding completed successfully!');
}
