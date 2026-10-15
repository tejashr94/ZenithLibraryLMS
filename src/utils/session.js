// src/utils/session.js
// ── Client-side Session Management ──────────────────────────────────────────
// NOTE: The session token is issued by the server and validated server-side
// on every protected request. The frontend does NOT make authorization
// decisions based on local state alone.

import config from '../config';

const SESSION_KEY = config.sessionKey;

/**
 * Persist a server-issued session to sessionStorage.
 * sessionStorage is cleared when the browser tab is closed.
 * We additionally store an expiry time for client-side UX only.
 */
export function saveSession(sessionData) {
  const session = {
    token: sessionData.token,
    user: {
      id: sessionData.user.id,
      name: sessionData.user.name,
      role: sessionData.user.role,
      permissions: sessionData.user.permissions || [],
    },
    expiresAt: Date.now() + config.sessionDurationMs,
    savedAt: Date.now(),
  };
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // If sessionStorage is unavailable, session won't persist across navigation
    // but auth still works for the current page load.
    console.warn('[ZLMS] Could not save session to sessionStorage.');
  }
  return session;
}

/**
 * Load a session from sessionStorage.
 * Returns null if no session exists or the client-side expiry has passed.
 * The token is still validated server-side regardless.
 */
export function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);

    // Client-side expiry check — purely for UX (server enforces real expiry)
    if (Date.now() > session.expiresAt) {
      clearSession();
      return null;
    }

    return session;
  } catch {
    clearSession();
    return null;
  }
}

/**
 * Remove the session from storage.
 */
export function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

/**
 * Get the session token without loading the full session object.
 */
export function getSessionToken() {
  const session = loadSession();
  return session?.token || null;
}
