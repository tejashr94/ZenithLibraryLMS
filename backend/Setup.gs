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
  SpreadsheetApp.getUi().alert('Configuration Check:\n\n' + message);
}
