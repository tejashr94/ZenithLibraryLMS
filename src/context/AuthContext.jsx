// src/context/AuthContext.jsx
// ── Authentication Context ───────────────────────────────────────────────────
// Provides authentication state and actions to the entire app.
// Authorization is enforced SERVER-SIDE — this context only stores the result
// of successful server-side authentication for UI purposes.

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { authApi } from '../services/api';
import { saveSession, loadSession, clearSession } from '../utils/session';

// ── State ────────────────────────────────────────────────────────────────────

const initialState = {
  user: null,          // Server-authenticated user object
  token: null,         // Server-issued session token
  isAuthenticated: false,
  isLoading: true,     // True during initial session validation
  authError: null,     // Last authentication error message
  loginAttempts: 0,    // Track failed attempts for UX lockout hint
};

// ── Reducer ──────────────────────────────────────────────────────────────────

function authReducer(state, action) {
  switch (action.type) {
    case 'AUTH_INIT_START':
      return { ...state, isLoading: true, authError: null };

    case 'AUTH_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
        authError: null,
        loginAttempts: 0,
      };

    case 'AUTH_FAILURE':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        authError: action.payload.message,
        loginAttempts: state.loginAttempts + 1,
      };

    case 'AUTH_LOGOUT':
      return {
        ...initialState,
        isLoading: false,
      };

    case 'AUTH_INIT_DONE_NO_SESSION':
      return { ...state, isLoading: false };

    case 'CLEAR_ERROR':
      return { ...state, authError: null };

    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // ── Restore session on mount ─────────────────────────────────────────────
  useEffect(() => {
    async function restoreSession() {
      dispatch({ type: 'AUTH_INIT_START' });

      const savedSession = loadSession();
      if (!savedSession?.token) {
        dispatch({ type: 'AUTH_INIT_DONE_NO_SESSION' });
        return;
      }

      // Validate the stored token with the server.
      // If the server rejects it (expired, revoked, tampered), clear local state.
      try {
        const result = await authApi.validateSession(savedSession.token);
        dispatch({
          type: 'AUTH_SUCCESS',
          payload: { user: result.user, token: savedSession.token },
        });
      } catch {
        // Token invalid or server unreachable — clear local session
        clearSession();
        dispatch({ type: 'AUTH_INIT_DONE_NO_SESSION' });
      }
    }

    restoreSession();
  }, []);

  // ── Login ────────────────────────────────────────────────────────────────
  const login = useCallback(async (username, password) => {
    dispatch({ type: 'AUTH_INIT_START' });

    try {
      const result = await authApi.login(username, password);
      const session = saveSession({ token: result.token, user: result.user });
      dispatch({
        type: 'AUTH_SUCCESS',
        payload: { user: session.user, token: session.token },
      });
      return { success: true };
    } catch (err) {
      dispatch({
        type: 'AUTH_FAILURE',
        payload: { message: err.message },
      });
      return { success: false, error: err.message, code: err.code };
    }
  }, []);

  // ── Logout ───────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    const token = state.token;
    // Clear local state immediately for snappy UX
    clearSession();
    dispatch({ type: 'AUTH_LOGOUT' });
    // Best-effort server-side session invalidation
    if (token) {
      try {
        await authApi.logout(token);
      } catch {
        // ignore — local session already cleared
      }
    }
  }, [state.token]);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  // ── Permission Helpers ───────────────────────────────────────────────────
  const hasPermission = useCallback(
    (permission) => {
      if (!state.user) return false;
      if (state.user.role === 'OWNER') return true; // Owner has all permissions
      return state.user.permissions?.includes(permission) ?? false;
    },
    [state.user]
  );

  const isOwner = useCallback(() => state.user?.role === 'OWNER', [state.user]);
  const isManager = useCallback(
    () => state.user?.role === 'MANAGER' || state.user?.role === 'OWNER',
    [state.user]
  );

  const value = {
    ...state,
    login,
    logout,
    clearError,
    hasPermission,
    isOwner,
    isManager,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export default AuthContext;
