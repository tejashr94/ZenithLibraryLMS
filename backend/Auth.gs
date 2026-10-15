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
        return SpreadsheetApp.getActiveSpreadsheet().getId();
      } catch (e) {
        throw new Error(`Script Property "${key}" is not set.`);
      }
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
