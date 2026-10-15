// src/pages/LoginPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, Lock, User, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import config from '../config';
import './LoginPage.css';

const MAX_ATTEMPTS = config.maxLoginAttemptsBeforeLockoutHint;
const LOCKOUT_SECONDS = 30;

export default function LoginPage() {
  const { login, isLoading, isLoggingIn, authError, loginAttempts, clearError } = useAuth();
  const toast = useToast();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [lockoutTimer, setLockoutTimer] = useState(0);
  const [configError, setConfigError] = useState(false);

  const usernameRef = useRef(null);
  const lockoutIntervalRef = useRef(null);

  const isLocalDemo = !config.appsScriptUrl || config.appsScriptUrl === 'mock' || config.appsScriptUrl.includes('YOUR_DEPLOYMENT_ID');

  // Check backend configuration on mount
  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  // Start lockout timer after too many failed attempts
  useEffect(() => {
    if (loginAttempts >= MAX_ATTEMPTS && lockoutTimer === 0) {
      setLockoutTimer(LOCKOUT_SECONDS);
    }
  }, [loginAttempts]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (lockoutTimer > 0) {
      lockoutIntervalRef.current = setInterval(() => {
        setLockoutTimer((prev) => {
          if (prev <= 1) {
            clearInterval(lockoutIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(lockoutIntervalRef.current);
  }, [lockoutTimer]);

  // Clear auth error when user starts typing
  useEffect(() => {
    if (authError) clearError();
  }, [username, password]); // eslint-disable-line react-hooks/exhaustive-deps

  function validate() {
    const errors = {};
    if (!username.trim()) errors.username = 'Username is required';
    if (!password) errors.password = 'Password is required';
    else if (password.length < 4) errors.password = 'Password must be at least 4 characters';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (lockoutTimer > 0) return;
    if (!validate()) return;

    const result = await login(username.trim(), password);

    if (!result.success) {
      // Show specific messages for known error codes
      if (result.code === 'CONFIG_ERROR') {
        setConfigError(true);
      } else if (result.code === 'ACCOUNT_DISABLED') {
        toast.error('This account has been disabled. Contact the system administrator.', {
          title: 'Account Disabled',
        });
      } else if (result.code === 'RATE_LIMITED') {
        toast.warning('Too many login attempts. Please wait before trying again.', {
          title: 'Rate Limited',
        });
      }
    }
  }

  const isLocked = lockoutTimer > 0;
  const submitting = (isLoggingIn || isLoading) && !configError;

  return (
    <div className="login-page" role="main">
      {/* Animated background */}
      <div className="login-bg" aria-hidden="true">
        <div className="login-bg-orb orb-1" />
        <div className="login-bg-orb orb-2" />
        <div className="login-bg-orb orb-3" />
        <div className="login-bg-grid" />
      </div>

      <div className="login-container">
        {/* Left panel — branding */}
        <div className="login-brand-panel" aria-hidden="true">
          <div className="login-brand-content">
            <div className="login-logo">
              <span className="login-logo-icon">⚡</span>
            </div>
            <h2 className="login-brand-name">ZENITH LIBRARY</h2>
            <p className="login-brand-tagline">
              Professional Library Management System
            </p>
            <div className="login-brand-features">
              {[
                'Student admission management',
                'Fee tracking & payments',
                'Advanced analytics',
                'Multi-role access control',
              ].map((f) => (
                <div key={f} className="login-feature-item">
                  <span className="login-feature-dot" />
                  {f}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right panel — login form */}
        <div className="login-form-panel">
          <div className="login-form-card">
            {/* Header */}
            <div className="login-form-header">
              <div className="login-form-logo">⚡</div>
              <h1 className="login-form-title">Welcome back</h1>
              <p className="login-form-subtitle">
                Sign in to your Zenith Library account
              </p>
            </div>

            {/* Demo mode banner */}
            {isLocalDemo && (
              <div className="login-alert" style={{ background: 'rgba(124, 111, 205, 0.15)', borderColor: 'var(--color-primary-light)', color: 'var(--color-text-primary)' }} role="status">
                <AlertCircle size={16} style={{ color: 'var(--color-primary-light)' }} />
                <div style={{ fontSize: 'var(--text-xs)' }}>
                  <strong style={{ display: 'block', color: 'var(--color-primary-light)', marginBottom: 2 }}>⚡ Local Demo Mode Active</strong>
                  Sign in with <code>manager</code> or <code>owner</code> (password: <code>Zenith@2026</code>).
                </div>
              </div>
            )}

            {/* Auth error banner */}
            {authError && (
              <div className="login-alert login-alert-error" role="alert" aria-live="polite">
                <AlertCircle size={16} />
                <span>{authError}</span>
              </div>
            )}

            {/* Lockout warning */}
            {isLocked && (
              <div className="login-alert login-alert-warning" role="alert">
                <AlertCircle size={16} />
                <span>
                  Too many failed attempts. Please wait{' '}
                  <strong>{lockoutTimer}s</strong> before trying again.
                </span>
              </div>
            )}

            {/* Form */}
            <form
              className="login-form"
              onSubmit={handleSubmit}
              noValidate
              aria-label="Login form"
            >
              {/* Username */}
              <div className="form-group">
                <label className="form-label" htmlFor="login-username">
                  Username
                </label>
                <div className="login-input-wrapper">
                  <User size={16} className="login-input-icon" aria-hidden="true" />
                  <input
                    id="login-username"
                    type="text"
                    className={`form-input login-input ${fieldErrors.username ? 'error' : ''}`}
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    disabled={submitting || isLocked}
                    ref={usernameRef}
                    aria-describedby={fieldErrors.username ? 'username-error' : undefined}
                    aria-invalid={!!fieldErrors.username}
                  />
                </div>
                {fieldErrors.username && (
                  <span id="username-error" className="form-error" role="alert">
                    <AlertCircle size={12} />
                    {fieldErrors.username}
                  </span>
                )}
              </div>

              {/* Password */}
              <div className="form-group">
                <label className="form-label" htmlFor="login-password">
                  Password
                </label>
                <div className="login-input-wrapper">
                  <Lock size={16} className="login-input-icon" aria-hidden="true" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    className={`form-input login-input ${fieldErrors.password ? 'error' : ''}`}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={submitting || isLocked}
                    aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                    aria-invalid={!!fieldErrors.password}
                  />
                  <button
                    type="button"
                    className="login-eye-btn"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={0}
                    disabled={submitting}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <span id="password-error" className="form-error" role="alert">
                    <AlertCircle size={12} />
                    {fieldErrors.password}
                  </span>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="btn btn-primary btn-full btn-xl login-submit"
                disabled={submitting || isLocked}
                aria-busy={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 size={20} className="spin-icon" />
                    Signing in…
                  </>
                ) : isLocked ? (
                  `Locked — wait ${lockoutTimer}s`
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            {/* Footer */}
            <p className="login-footer-note">
              No self-registration. Contact the owner to get an account.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
