// src/context/ToastContext.jsx
// ── Toast Notification System ────────────────────────────────────────────────

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import config from '../config';

const ToastContext = createContext(null);

let toastId = 0;

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const ICON_COLORS = {
  success: 'var(--color-success)',
  error: 'var(--color-danger)',
  warning: 'var(--color-warning)',
  info: 'var(--color-info)',
};

function ToastItem({ toast, onDismiss }) {
  const Icon = ICONS[toast.type] || Info;
  const [exiting, setExiting] = React.useState(false);

  const handleDismiss = () => {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 250);
  };

  React.useEffect(() => {
    const timer = setTimeout(handleDismiss, toast.duration || config.toastDurationMs);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`toast toast-${toast.type} ${exiting ? 'exiting' : ''}`} role="alert">
      <div className="toast-icon">
        <Icon size={18} color={ICON_COLORS[toast.type]} />
      </div>
      <div className="toast-body">
        {toast.title && <div className="toast-title">{toast.title}</div>}
        <div className="toast-message">{toast.message}</div>
      </div>
      <button className="toast-close" onClick={handleDismiss} aria-label="Dismiss notification">
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((type, message, options = {}) => {
    const id = ++toastId;
    setToasts((prev) => [
      ...prev,
      { id, type, message, title: options.title, duration: options.duration },
    ]);
    return id;
  }, []);

  const success = useCallback((message, options) => toast('success', message, options), [toast]);
  const error = useCallback((message, options) => toast('error', message, options), [toast]);
  const warning = useCallback((message, options) => toast('warning', message, options), [toast]);
  const info = useCallback((message, options) => toast('info', message, options), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info, dismiss }}>
      {children}
      <div className="toast-container" aria-live="polite" aria-label="Notifications">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
