// src/pages/UsersPage.jsx  — Owner-only account management
import React, { useEffect, useState, useCallback } from 'react';
import {
  Shield, Plus, UserX, UserCheck, RefreshCw, Eye, EyeOff,
  CheckCircle, XCircle, AlertCircle, Key, History, ShieldAlert,
  Lock, Clock, User
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usersApi, reportsApi } from '../services/api';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonTable } from '../components/ui/SkeletonLoader';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Spinner from '../components/ui/Spinner';
import { formatDateTime, formatDate } from '../utils/formatters';
import { validateForm, hasErrors, required, minLength } from '../utils/validators';

const PERMISSIONS_ALL = [
  'students.view', 'students.create', 'students.update', 'students.discontinue',
  'payments.view', 'payments.record',
  'reports.view',
];

const PERMISSION_LABELS = {
  'students.view': 'View Students',
  'students.create': 'Admit Students',
  'students.update': 'Edit Students',
  'students.discontinue': 'Discontinue Students',
  'payments.view': 'View Payments',
  'payments.record': 'Record Payments',
  'reports.view': 'View Reports',
};

// ── Create User Dialog ───────────────────────────────────────────────────────
function CreateUserDialog({ isOpen, onClose, onCreated, token }) {
  const toast = useToast();
  const [form, setForm] = useState({
    userId: '',
    name: '',
    username: '',
    role: 'MANAGER',
    password: '',
    confirmPassword: '',
    permissions: [...PERMISSIONS_ALL],
  });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      setForm({
        userId: `USR_MGR_${randomSuffix}`,
        name: '',
        username: '',
        role: 'MANAGER',
        password: '',
        confirmPassword: '',
        permissions: [...PERMISSIONS_ALL],
      });
      setErrors({});
    }
  }, [isOpen]);

  function handleRoleChange(newRole) {
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    setForm((f) => ({
      ...f,
      role: newRole,
      userId: newRole === 'OWNER' ? `USR_OWNER_${randomSuffix}` : `USR_MGR_${randomSuffix}`,
    }));
  }

  function togglePermission(perm) {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(perm)
        ? f.permissions.filter((p) => p !== perm)
        : [...f.permissions, perm],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const schema = {
      name: [(v) => required(v, 'Full name'), (v) => minLength(v, 2, 'Full name')],
      username: [(v) => required(v, 'Username'), (v) => minLength(v, 3, 'Username')],
      password: [(v) => required(v, 'Password'), (v) => minLength(v, 8, 'Password')],
      confirmPassword: [(v) => v !== form.password ? 'Passwords do not match' : null],
    };
    const errs = validateForm(form, schema);
    setErrors(errs);
    if (hasErrors(errs)) return;

    setSubmitting(true);
    try {
      await usersApi.create(token, {
        id: form.userId.trim() || undefined,
        name: form.name.trim(),
        username: form.username.trim().toLowerCase(),
        role: form.role,
        password: form.password,
        permissions: form.role === 'OWNER' ? ['ALL'] : form.permissions,
      });
      toast.success(`Account for "${form.name}" created successfully.`, { title: 'User Created' });
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err.message, { title: 'Failed to create user' });
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="create-user-title">
      <div className="dialog" style={{ maxWidth: 560 }}>
        <div className="dialog-header">
          <h2 id="create-user-title" className="dialog-title">Create New Staff Account</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={submitting} aria-label="Close dialog">✕</button>
        </div>
        <form onSubmit={handleSubmit} noValidate>
          <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="form-grid form-grid-2">
              <div className="form-group">
                <label className="form-label required" htmlFor="cu-userid">User ID</label>
                <input
                  id="cu-userid"
                  type="text"
                  className="form-input"
                  style={{ fontFamily: 'var(--font-mono)' }}
                  value={form.userId}
                  onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
                />
                <span className="form-hint">Unique identifier for audit logging</span>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="cu-role">Account Role</label>
                <select
                  id="cu-role"
                  className="form-select"
                  value={form.role}
                  onChange={(e) => handleRoleChange(e.target.value)}
                >
                  <option value="MANAGER">Library Manager</option>
                  <option value="OWNER">System Owner / Admin</option>
                </select>
                <span className="form-hint">Owners have full administrative privileges</span>
              </div>
            </div>

            <div className="form-grid form-grid-2">
              <div className="form-group">
                <label className="form-label required" htmlFor="cu-name">Full Name</label>
                <input
                  id="cu-name"
                  type="text"
                  className={`form-input ${errors.name ? 'error' : ''}`}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Rahul Sharma"
                />
                {errors.name && <span className="form-error"><AlertCircle size={12}/>{errors.name}</span>}
              </div>
              <div className="form-group">
                <label className="form-label required" htmlFor="cu-username">Login Username</label>
                <input
                  id="cu-username"
                  type="text"
                  className={`form-input ${errors.username ? 'error' : ''}`}
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  placeholder="e.g. rahul_manager"
                  autoCapitalize="none"
                />
                {errors.username && <span className="form-error"><AlertCircle size={12}/>{errors.username}</span>}
              </div>
            </div>

            <div className="form-grid form-grid-2">
              <div className="form-group">
                <label className="form-label required" htmlFor="cu-password">Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="cu-password"
                    type={showPassword ? 'text' : 'password'}
                    className={`form-input ${errors.password ? 'error' : ''}`}
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="Min. 8 characters"
                  />
                  <button
                    type="button"
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                  </button>
                </div>
                {errors.password && <span className="form-error"><AlertCircle size={12}/>{errors.password}</span>}
              </div>
              <div className="form-group">
                <label className="form-label required" htmlFor="cu-confirm">Confirm Password</label>
                <input
                  id="cu-confirm"
                  type="password"
                  className={`form-input ${errors.confirmPassword ? 'error' : ''}`}
                  value={form.confirmPassword}
                  onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                  placeholder="Repeat password"
                />
                {errors.confirmPassword && <span className="form-error"><AlertCircle size={12}/>{errors.confirmPassword}</span>}
              </div>
            </div>

            {form.role === 'MANAGER' && (
              <div className="form-group">
                <label className="form-label">Granular Manager Permissions</label>
                <div className="form-grid-2" style={{ gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
                  {PERMISSIONS_ALL.map((perm) => (
                    <label key={perm} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                      <input
                        type="checkbox"
                        checked={form.permissions.includes(perm)}
                        onChange={() => togglePermission(perm)}
                        style={{ accentColor: 'var(--color-primary)', width: 16, height: 16 }}
                      />
                      {PERMISSION_LABELS[perm]}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="dialog-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? <><Spinner />Creating…</> : 'Create Staff Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Reset Password Dialog ───────────────────────────────────────────────────
function ResetPasswordDialog({ user, isOpen, onClose, token, onReset }) {
  const toast = useToast();
  const [tempPassword, setTempPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const generated = 'Zenith@' + Math.floor(1000 + Math.random() * 9000);
      setTempPassword(generated);
    }
  }, [isOpen]);

  async function handleReset(e) {
    e.preventDefault();
    if (!tempPassword || tempPassword.length < 8) {
      toast.error('Temporary password must be at least 8 characters.');
      return;
    }
    setSubmitting(true);
    try {
      await usersApi.resetPassword(token, user.id, tempPassword);
      toast.success(`Password for ${user.username} has been reset. Mandatory password change flagged on next login.`);
      onReset();
      onClose();
    } catch (err) {
      toast.error(err.message, { title: 'Password Reset Failed' });
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen || !user) return null;

  return (
    <div className="dialog-overlay" role="dialog" aria-modal="true">
      <div className="dialog" style={{ maxWidth: 460 }}>
        <div className="dialog-header">
          <h2 className="dialog-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Key size={18} style={{ color: 'var(--color-warning)' }} />
            Reset Password
          </h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={submitting}>✕</button>
        </div>
        <form onSubmit={handleReset}>
          <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
              Issue a temporary password for <strong>{user.name}</strong> ({user.username}).
            </p>

            <div style={{ background: 'var(--color-warning-dim)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
              ⚠️ The user will be required to change this temporary password immediately upon their next login.
            </div>

            <div className="form-group">
              <label className="form-label required">Temporary Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  style={{ fontFamily: 'var(--font-mono)' }}
                  required
                />
                <button
                  type="button"
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>
          </div>
          <div className="dialog-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
            <button type="submit" className="btn btn-warning" disabled={submitting}>
              {submitting ? <><Spinner />Resetting…</> : 'Confirm Reset Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── User Audit Trail Modal ───────────────────────────────────────────────────
function UserAuditModal({ isOpen, onClose, token }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      reportsApi.auditLogs(token, { limit: 50 })
        .then((res) => {
          const userLogs = (res.logs || []).filter(l =>
            l.action.includes('USER') || l.action.includes('LOGIN') || l.action.includes('PASSWORD')
          );
          setLogs(userLogs);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [isOpen, token]);

  if (!isOpen) return null;

  return (
    <div className="dialog-overlay" role="dialog" aria-modal="true">
      <div className="dialog" style={{ maxWidth: 650 }}>
        <div className="dialog-header">
          <h2 className="dialog-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <History size={18} style={{ color: 'var(--color-primary-light)' }} />
            Account Management Audit Trail
          </h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="dialog-body" style={{ maxHeight: '60vh', overflowY: 'auto', padding: 0 }}>
          {loading ? (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}><Spinner /></div>
          ) : logs.length === 0 ? (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              No user account audit events recorded yet.
            </div>
          ) : (
            <table className="table" style={{ fontSize: '0.78rem' }}>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.logId}>
                    <td style={{ color: 'var(--color-text-muted)' }}>{formatDateTime(l.timestamp)}</td>
                    <td>
                      <span className="badge badge-neutral" style={{ fontFamily: 'var(--font-mono)' }}>
                        {l.action}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{l.userId}</td>
                    <td>
                      <span className={`badge ${l.result === 'SUCCESS' ? 'badge-success' : 'badge-danger'}`}>
                        {l.result}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="dialog-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Users Page ──────────────────────────────────────────────────────────
export default function UsersPage() {
  const { token, user: currentUser } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState(null);

  const [confirmAction, setConfirmAction] = useState(null); // { type: 'DISABLE' | 'ENABLE', user }
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await usersApi.list(token);
      setUsers(result.users || []);
    } catch (err) {
      setError(err.message);
      toast.error(err.message, { title: 'Failed to load staff accounts' });
    } finally {
      setLoading(false);
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchUsers(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Count active owners to prevent removing the last one
  const activeOwnersCount = users.filter((u) => u.role === 'OWNER' && u.status === 'ACTIVE').length;

  async function handleExecuteAction() {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      if (confirmAction.type === 'DISABLE') {
        await usersApi.disable(token, confirmAction.user.id);
        toast.success(`Account for "${confirmAction.user.name}" has been disabled.`);
      } else {
        await usersApi.enable(token, confirmAction.user.id);
        toast.success(`Account for "${confirmAction.user.name}" has been reactivated.`);
      }
      setConfirmAction(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 className="page-title">Manage User Accounts</h1>
            <span className="badge badge-primary">Owner Control</span>
          </div>
          <p className="page-subtitle">
            Create manager and owner credentials, configure permissions, enforce password resets & inspect audit trails
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowAudit(true)}>
            <History size={14} /> Audit Trail
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)} id="create-user-btn">
            <Plus size={16} />
            Create Staff Account
          </button>
        </div>
      </div>

      {loading ? (
        <SkeletonTable rows={4} cols={6} />
      ) : error ? (
        <EmptyState icon={AlertCircle} title="Failed to load staff accounts" description={error}
          action={<button className="btn btn-primary" onClick={fetchUsers}><RefreshCw size={16}/>Retry</button>} />
      ) : users.length === 0 ? (
        <EmptyState icon={Shield} title="No staff accounts yet"
          description="Create manager or owner accounts for your library operations."
          action={<button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={16}/>Create Account</button>} />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-responsive">
            <table className="table" aria-label="User accounts" style={{ fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Name & Login</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Permissions</th>
                  <th>Last Login</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isCurrent = u.id === currentUser?.id;
                  const isLastActiveOwner = u.role === 'OWNER' && u.status === 'ACTIVE' && activeOwnersCount <= 1;

                  return (
                    <tr key={u.id}>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: '0.78rem' }}>
                          {u.id}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
                          {u.name}
                          {isCurrent && (
                            <span className="badge badge-primary" style={{ marginLeft: 6, fontSize: '0.65rem' }}>You</span>
                          )}
                        </div>
                        <div style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
                          @{u.username}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${u.role === 'OWNER' ? 'badge-primary' : 'badge-neutral'}`}>
                          {u.role === 'OWNER' ? '👑 Owner' : '👤 Manager'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${u.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`}>
                          {u.status === 'ACTIVE' ? <><CheckCircle size={10}/> Active</> : <><XCircle size={10}/> Disabled</>}
                        </span>
                        {u.tempPasswordFlag && (
                          <div style={{ fontSize: '0.65rem', color: 'var(--color-warning)', marginTop: 2 }}>
                            ⚠️ Temp Password
                          </div>
                        )}
                      </td>
                      <td>
                        {u.role === 'OWNER' ? (
                          <span style={{ color: 'var(--color-primary-light)', fontSize: '0.75rem', fontWeight: 600 }}>All Privileges</span>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.72rem' }}>
                            {(u.permissions || []).length} Granted
                          </span>
                        )}
                      </td>
                      <td style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                        {u.lastLogin ? formatDateTime(u.lastLogin) : 'Never'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                          {/* Reset Password Button */}
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={() => setResetTargetUser(u)}
                            title="Reset password and issue temporary credential"
                          >
                            <Key size={13} /> Reset
                          </button>

                          {/* Enable / Disable Button */}
                          {!isCurrent && (
                            u.status === 'ACTIVE' ? (
                              <button
                                className="btn btn-ghost btn-xs"
                                style={{ color: 'var(--color-danger)' }}
                                disabled={isLastActiveOwner}
                                onClick={() => setConfirmAction({ type: 'DISABLE', user: u })}
                                title={isLastActiveOwner ? 'Cannot disable the last active owner account' : 'Disable account'}
                              >
                                <UserX size={13} /> Disable
                              </button>
                            ) : (
                              <button
                                className="btn btn-ghost btn-xs"
                                style={{ color: 'var(--color-success)' }}
                                onClick={() => setConfirmAction({ type: 'ENABLE', user: u })}
                                title="Reactivate account"
                              >
                                <UserCheck size={13} /> Enable
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Dialogs ──────────────────────────────────────────────────────── */}
      <CreateUserDialog
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={fetchUsers}
        token={token}
      />

      <ResetPasswordDialog
        isOpen={!!resetTargetUser}
        user={resetTargetUser}
        onClose={() => setResetTargetUser(null)}
        token={token}
        onReset={fetchUsers}
      />

      <UserAuditModal
        isOpen={showAudit}
        onClose={() => setShowAudit(false)}
        token={token}
      />

      <ConfirmDialog
        isOpen={!!confirmAction}
        title={confirmAction?.type === 'DISABLE' ? 'Disable Account' : 'Reactivate Account'}
        message={
          confirmAction?.type === 'DISABLE'
            ? `Are you sure you want to disable the account for "${confirmAction?.user?.name}"? They will no longer be able to log in to the system.`
            : `Are you sure you want to reactivate the account for "${confirmAction?.user?.name}"?`
        }
        confirmLabel={confirmAction?.type === 'DISABLE' ? 'Disable Account' : 'Activate Account'}
        onConfirm={handleExecuteAction}
        onCancel={() => setConfirmAction(null)}
        isLoading={actionLoading}
      />
    </div>
  );
}
