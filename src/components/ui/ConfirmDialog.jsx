// src/components/ui/ConfirmDialog.jsx
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import Spinner from './Spinner';

export default function ConfirmDialog({
  isOpen,
  title = 'Confirm Action',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',  // 'danger' | 'warning' | 'primary'
  onConfirm,
  onCancel,
  isLoading = false,
}) {
  if (!isOpen) return null;

  const btnClass = {
    danger: 'btn btn-danger',
    warning: 'btn btn-secondary',
    primary: 'btn btn-primary',
  }[variant] || 'btn btn-primary';

  return (
    <div className="dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="dialog" style={{ maxWidth: 420 }}>
        <div className="dialog-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{
              width: 40, height: 40, borderRadius: 'var(--radius-lg)',
              background: variant === 'danger' ? 'var(--color-danger-dim)' : 'var(--color-warning-dim)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <AlertTriangle size={20} color={variant === 'danger' ? 'var(--color-danger)' : 'var(--color-warning)'} />
            </div>
            <h2 id="confirm-title" className="dialog-title">{title}</h2>
          </div>
        </div>
        <div className="dialog-body">
          <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>{message}</p>
        </div>
        <div className="dialog-footer">
          <button className="btn btn-ghost" onClick={onCancel} disabled={isLoading}>
            {cancelLabel}
          </button>
          <button className={btnClass} onClick={onConfirm} disabled={isLoading}>
            {isLoading ? <><Spinner />{confirmLabel}…</> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
