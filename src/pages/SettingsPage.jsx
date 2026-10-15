// src/pages/SettingsPage.jsx
import React, { useState } from 'react';
import { Settings, Key, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { authApi } from '../services/api';
import Spinner from '../components/ui/Spinner';
import { required, minLength, validateForm, hasErrors } from '../utils/validators';

export default function SettingsPage() {
  const { token, user } = useAuth();
  const toast = useToast();

  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [showNew, setShowNew] = useState(false);

  async function handleChangePassword(e) {
    e.preventDefault();
    const schema = {
      currentPassword: [(v) => required(v, 'Current password')],
      newPassword: [(v) => required(v, 'New password'), (v) => minLength(v, 8, 'New password')],
      confirmPassword: [(v) => v !== form.newPassword ? 'Passwords do not match' : null],
    };
    const errs = validateForm(form, schema);
    setErrors(errs);
    if (hasErrors(errs)) return;

    setSubmitting(true);
    try {
      await authApi.changePassword(token, user.id, form.newPassword, form.currentPassword);
      toast.success('Password changed successfully.', { title: 'Password Updated' });
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.message, { title: 'Failed to change password' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your account preferences</p>
        </div>
      </div>

      <div style={{ maxWidth: 560 }}>
        {/* Profile Info */}
        <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
            Account Information
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {[
              { label: 'Full Name', value: user?.name },
              { label: 'Username', value: user?.id },
              { label: 'Role', value: user?.role },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-3) 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>{label}</span>
                <span style={{ color: 'var(--color-text-primary)', fontWeight: 500, fontSize: 'var(--text-sm)' }}>{value || '—'}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Change Password */}
        <div className="card">
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-1)' }}>
            Change Password
          </h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-5)' }}>
            Use a strong password of at least 8 characters.
          </p>
          <form onSubmit={handleChangePassword} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label required" htmlFor="current-pw">Current Password</label>
              <input id="current-pw" type="password" className={`form-input ${errors.currentPassword ? 'error' : ''}`}
                value={form.currentPassword} onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
                placeholder="Your current password" autoComplete="current-password" />
              {errors.currentPassword && <span className="form-error"><AlertCircle size={12}/>{errors.currentPassword}</span>}
            </div>
            <div className="form-group">
              <label className="form-label required" htmlFor="new-pw">New Password</label>
              <div style={{ position: 'relative' }}>
                <input id="new-pw" type={showNew ? 'text' : 'password'} className={`form-input ${errors.newPassword ? 'error' : ''}`}
                  value={form.newPassword} onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
                  placeholder="Min. 8 characters" autoComplete="new-password" />
                <button type="button" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
                  onClick={() => setShowNew((v) => !v)} aria-label="Toggle password visibility">
                  {showNew ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
              {errors.newPassword && <span className="form-error"><AlertCircle size={12}/>{errors.newPassword}</span>}
            </div>
            <div className="form-group">
              <label className="form-label required" htmlFor="confirm-pw">Confirm New Password</label>
              <input id="confirm-pw" type="password" className={`form-input ${errors.confirmPassword ? 'error' : ''}`}
                value={form.confirmPassword} onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                placeholder="Repeat new password" autoComplete="new-password" />
              {errors.confirmPassword && <span className="form-error"><AlertCircle size={12}/>{errors.confirmPassword}</span>}
            </div>
            <div>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? <><Spinner />Updating…</> : <><Key size={16}/>Change Password</>}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
