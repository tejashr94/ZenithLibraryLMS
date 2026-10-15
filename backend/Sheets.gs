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
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found. Run initializeSheets() first.`);
  }
  return sheet;
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
    admissionDate: row[STUDENT_COLS.ADMISSION_DATE],
    slotPlan: row[STUDENT_COLS.SLOT_PLAN],
    status: row[STUDENT_COLS.STATUS],
    discontinuationDate: row[STUDENT_COLS.DISCONT_DATE],
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
      paymentDate: row[FEE_UPDATE_COLS.PAYMENT_DATE],
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
