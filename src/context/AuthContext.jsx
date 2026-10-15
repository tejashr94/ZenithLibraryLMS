// src/context/AuthContext.jsx
// ── Authentication Context ───────────────────────────────────────────────────
// Provides authentication state and actions to the entire app.
// Authorization is enforced SERVER-SIDE — this context only stores the result
// of successful server-side authentication for UI purposes.

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { authApi } from '../services/api';
import { saveSession, loadSession, clearSession } from '../utils/session';

// ── State Initialization ─────────────────────────────────────────────────────
// Synchronously read existing session so the first render is instantaneous
// with 0ms splash delay!
function getInitialAuthState() {
  const saved = typeof window !== 'undefined' ? loadSession() : null;
  return {
    user: saved?.user || null,
    token: saved?.token || null,
    isAuthenticated: Boolean(saved?.token && saved?.user),
    isLoading: false,    // Instant mount — never block the first render
    isLoggingIn: false,  // True only when submitting credentials
    authError: null,
    loginAttempts: 0,
  };
}

// ── Reducer ──────────────────────────────────────────────────────────────────

function authReducer(state, action) {
  switch (action.type) {
    case 'LOGIN_START':
      return { ...state, isLoggingIn: true, authError: null };

    case 'AUTH_INIT_START':
      return { ...state, isLoading: true, authError: null };

    case 'AUTH_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
        isLoggingIn: false,
        authError: null,
        loginAttempts: 0,
      };

    case 'AUTH_USER_UPDATE':
      return {
        ...state,
        user: action.payload.user,
      };

    case 'AUTH_FAILURE':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        isLoggingIn: false,
        authError: action.payload.message,
        loginAttempts: state.loginAttempts + 1,
      };

    case 'AUTH_LOGOUT':
      return {
        ...getInitialAuthState(),
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        isLoggingIn: false,
      };

    case 'AUTH_INIT_DONE_NO_SESSION':
      return { ...state, isLoading: false, isLoggingIn: false };

    case 'CLEAR_ERROR':
      return { ...state, authError: null };

    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, undefined, getInitialAuthState);

  // ── Silent background session verification ───────────────────────────────
  // If the user already has a valid session token, verify it in the background
  // without blocking the UI. If the server invalidates it, then log out.
  useEffect(() => {
    let isMounted = true;
    const savedSession = loadSession();

    if (!savedSession?.token) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

    authApi.validateSession(savedSession.token, controller.signal)
      .then((result) => {
        clearTimeout(timeoutId);
        if (isMounted && result?.user) {
          dispatch({
            type: 'AUTH_USER_UPDATE',
            payload: { user: result.user },
          });
        }
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        // Only log out if explicitly rejected by server (invalid token / disabled account)
        if (err.code === 'INVALID_SESSION' || err.code === 'ACCOUNT_DISABLED') {
          clearSession();
          if (isMounted) {
            dispatch({ type: 'AUTH_LOGOUT' });
          }
        }
        // If it was just a network timeout or temporary blip, retain session UX
      });

    return () => {
      isMounted = false;
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, []);

  // ── Login ────────────────────────────────────────────────────────────────
  const login = useCallback(async (username, password) => {
    dispatch({ type: 'LOGIN_START' });

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
