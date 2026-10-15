// src/pages/FeeStatusPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  CalendarCheck, Search, Filter, RefreshCw, CreditCard,
  AlertCircle, CheckCircle, Clock, ChevronRight, UserX, UserCheck, Eye
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ledgerApi, studentsApi } from '../services/api';
import { formatCurrency } from '../utils/formatters';

const YEARS = Array.from({ length: 25 }, (_, i) => 2026 + i);
const MONTHS = [
  { num: 1, label: 'January' },
  { num: 2, label: 'February' },
  { num: 3, label: 'March' },
  { num: 4, label: 'April' },
  { num: 5, label: 'May' },
  { num: 6, label: 'June' },
  { num: 7, label: 'July' },
  { num: 8, label: 'August' },
  { num: 9, label: 'September' },
  { num: 10, label: 'October' },
  { num: 11, label: 'November' },
  { num: 12, label: 'December' },
];

export default function FeeStatusPage({ onNavigate = () => {}, initialParams = {} }) {
  const { token, hasPermission, isOwner } = useAuth();
  const toast = useToast();

  const now = new Date();
  const defaultYear = now.getFullYear() >= 2026 ? now.getFullYear() : 2026;
  const defaultMonth = now.getMonth() + 1;

  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL | PAID | PARTIALLY_PAID | PENDING | ADVANCE
  const [searchQuery, setSearchQuery] = useState('');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Status Action Modal (Discontinue / Reactivate)
  const [selectedStudentForAction, setSelectedStudentForAction] = useState(null);
  const [actionType, setActionType] = useState('discontinue'); // discontinue | reactivate
  const [actionReason, setActionReason] = useState('');
  const [actionDate, setActionDate] = useState(() => now.toISOString().slice(0, 10));
  const [actionSubmitting, setActionSubmitting] = useState(false);

  // Fetch monthly status
  const fetchMonthlyStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ledgerApi.getMonthlyStatus(token, selectedYear, selectedMonth);
      setData(res);
    } catch (err) {
      toast.error(err.message || 'Failed to load fee status for this month.');
    } finally {
      setLoading(false);
    }
  }, [token, selectedYear, selectedMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchMonthlyStatus();
  }, [fetchMonthlyStatus]);

  // Handle Discontinue submit
  async function handleDiscontinueConfirm() {
    if (!actionReason.trim()) {
      toast.error('Please enter a reason for discontinuation.');
      return;
    }
    setActionSubmitting(true);
    try {
      await studentsApi.discontinue(token, selectedStudentForAction.registrationNumber, actionReason, actionDate);
      toast.success(`Student ${selectedStudentForAction.registrationNumber} marked as inactive.`);
      setSelectedStudentForAction(null);
      fetchMonthlyStatus();
    } catch (err) {
      toast.error(err.message || 'Failed to update student status.');
    } finally {
      setActionSubmitting(false);
    }
  }

  // Handle Reactivate submit
  async function handleReactivateConfirm() {
    setActionSubmitting(true);
    try {
      await studentsApi.reactivate(token, selectedStudentForAction.registrationNumber, actionDate);
      toast.success(`Student ${selectedStudentForAction.registrationNumber} reactivated.`);
      setSelectedStudentForAction(null);
      fetchMonthlyStatus();
    } catch (err) {
      toast.error(err.message || 'Failed to reactivate student.');
    } finally {
      setActionSubmitting(false);
    }
  }

  // Filter students based on status filter & search query
  const studentList = data?.students || [];
  const filteredStudents = studentList.filter((s) => {
    // Status filter
    if (statusFilter === 'PAID' && s.feeStatus !== 'PAID') return false;
    if (statusFilter === 'PARTIALLY_PAID' && s.feeStatus !== 'PARTIALLY_PAID') return false;
    if (statusFilter === 'PENDING' && s.feeStatus !== 'PENDING') return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const match =
        s.studentName.toLowerCase().includes(q) ||
        s.registrationNumber.toLowerCase().includes(q) ||
        (s.phone && s.phone.includes(q));
      if (!match) return false;
    }
    return true;
  });

  const summary = data?.summary || {};
  const monthName = MONTHS.find((m) => m.num === selectedMonth)?.label;

  return (
    <div className="fee-status-page">
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Fee Status & Ledger Overview</h1>
          <p className="page-subtitle">
            Month-wise fee collection tracking, pending defaulters, and active student continuation
          </p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-ghost btn-sm" onClick={fetchMonthlyStatus}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Month & Year Picker ──────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <CalendarCheck size={18} style={{ color: 'var(--color-primary-light)', flexShrink: 0 }} />
            <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '0.88rem' }}>Select Target Fee Month:</span>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', width: 'auto' }}>
            {/* Month select */}
            <select
              className="form-input"
              style={{ width: 'auto', minWidth: 120, flex: 1 }}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            >
              {MONTHS.map((m) => (
                <option key={m.num} value={m.num}>{m.label}</option>
              ))}
            </select>

            {/* Year select (2026 - 2050) */}
            <select
              className="form-input"
              style={{ width: 'auto', minWidth: 80 }}
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Summary Stats for Target Month ───────────────────────────── */}
      <div className="dashboard-stats-grid" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-icon" style={{ background: 'rgba(124, 111, 205, 0.15)', color: 'var(--color-primary-light)' }}>
              <Clock size={20} />
            </div>
          </div>
          <div className="stat-value">{summary.totalStudents ?? '—'}</div>
          <div className="stat-label">Active Students</div>
          <div className="stat-sub">{monthName} {selectedYear}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--color-lime)' }}>
              <CheckCircle size={20} />
            </div>
          </div>
          <div className="stat-value" style={{ color: 'var(--color-lime)' }}>{summary.paidCount ?? '0'}</div>
          <div className="stat-label">Fully Paid Students</div>
          <div className="stat-sub">Includes advance payments</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--color-accent-amber)' }}>
              <CreditCard size={20} />
            </div>
          </div>
          <div className="stat-value">{summary.totalCollected != null ? formatCurrency(summary.totalCollected) : '—'}</div>
          <div className="stat-label">Collected for Month</div>
          <div className="stat-sub">{summary.partialCount ?? 0} partially paid</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-icon" style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--color-danger)' }}>
              <AlertCircle size={20} />
            </div>
          </div>
          <div className="stat-value" style={{ color: 'var(--color-danger)' }}>
            {summary.totalOutstanding != null ? formatCurrency(summary.totalOutstanding) : '—'}
          </div>
          <div className="stat-label">Outstanding Balance</div>
          <div className="stat-sub">{summary.pendingCount ?? 0} students pending</div>
        </div>
      </div>

      {/* ── Search & Filter Tabs ──────────────────────────────────────── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', minWidth: 0, maxWidth: '100%' }}>
        <div style={{
          padding: 'var(--space-3) var(--space-4)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          {/* Status Tabs - horizontally scrollable without breaking mobile layout */}
          <div style={{
            display: 'flex',
            gap: 'var(--space-2)',
            overflowX: 'auto',
            maxWidth: '100%',
            WebkitOverflowScrolling: 'touch',
            paddingBottom: 2,
            boxSizing: 'border-box'
          }}>
            <button
              className={`btn btn-sm ${statusFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setStatusFilter('ALL')}
              style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
            >
              All Students ({studentList.length})
            </button>
            <button
              className={`btn btn-sm ${statusFilter === 'PAID' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setStatusFilter('PAID')}
              style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
            >
              Paid ({summary.paidCount || 0})
            </button>
            <button
              className={`btn btn-sm ${statusFilter === 'PARTIALLY_PAID' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setStatusFilter('PARTIALLY_PAID')}
              style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
            >
              Partial ({summary.partialCount || 0})
            </button>
            <button
              className={`btn btn-sm ${statusFilter === 'PENDING' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setStatusFilter('PENDING')}
              style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
            >
              Pending ({summary.pendingCount || 0})
            </button>
          </div>

          {/* Quick Search - flex responsive */}
          <div style={{ position: 'relative', flex: '1 1 180px', minWidth: 140, maxWidth: '100%' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: 32, fontSize: 'var(--text-xs)', width: '100%' }}
              placeholder="Filter by name / reg…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* ── Students Table ──────────────────────────────────────────── */}
        {loading ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <RefreshCw size={24} className="spin-icon" style={{ marginBottom: 'var(--space-2)' }} />
            <p>Loading status for {monthName} {selectedYear}…</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No students found matching this status filter for {monthName} {selectedYear}.
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table" aria-label="Fee status table">
              <thead>
                <tr>
                  <th>Reg #</th>
                  <th>Student Name</th>
                  <th>Slot / Plan</th>
                  <th>Monthly Due</th>
                  <th>Paid Amount</th>
                  <th>Balance</th>
                  <th>Month Status</th>
                  <th>Student Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s) => {
                  const isPaid = s.feeStatus === 'PAID';
                  const isPartial = s.feeStatus === 'PARTIALLY_PAID';
                  const isPending = s.feeStatus === 'PENDING';
                  const isActive = s.studentStatus === 'ACTIVE';

                  return (
                    <tr key={s.registrationNumber}>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-primary-light)' }}>
                          {s.registrationNumber}
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: 'var(--color-text-primary)' }}>{s.studentName}</strong>
                        <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                          {s.phone}
                        </span>
                      </td>
                      <td>
                        <span className="badge" style={{ background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', fontSize: 'var(--text-xs)' }}>
                          {s.slotPlan}
                        </span>
                      </td>
                      <td>{formatCurrency(s.dueAmount)}</td>
                      <td>
                        <span style={{ color: s.paidAmount > 0 ? 'var(--color-lime)' : 'var(--color-text-muted)', fontWeight: 600 }}>
                          {formatCurrency(s.paidAmount)}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: s.balance > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)', fontWeight: 600 }}>
                          {formatCurrency(s.balance)}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${isPaid ? 'badge-success' : isPartial ? 'badge-warning' : isPending ? 'badge-danger' : ''}`}>
                          {s.feeStatus}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${isActive ? 'badge-success' : 'badge-danger'}`}>
                          {s.studentStatus}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {/* Record fee shortcut */}
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '3px 8px', fontSize: 'var(--text-xs)' }}
                            title="Record fee for this student"
                            onClick={() => onNavigate('fee-update', { studentReg: s.registrationNumber })}
                          >
                            <CreditCard size={12} /> Pay
                          </button>

                          {/* Profile link */}
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '3px 8px', fontSize: 'var(--text-xs)' }}
                            title="View student profile"
                            onClick={() => onNavigate('students', { studentReg: s.registrationNumber })}
                          >
                            <Eye size={12} />
                          </button>

                          {/* Discontinue / Reactivate toggle */}
                          {isActive ? (
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '3px 8px', fontSize: 'var(--text-xs)', color: 'var(--color-danger)' }}
                              title="Mark student inactive"
                              onClick={() => {
                                setSelectedStudentForAction(s);
                                setActionType('discontinue');
                              }}
                            >
                              <UserX size={12} />
                            </button>
                          ) : (
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '3px 8px', fontSize: 'var(--text-xs)', color: 'var(--color-lime)' }}
                              title="Reactivate student"
                              onClick={() => {
                                setSelectedStudentForAction(s);
                                setActionType('reactivate');
                              }}
                            >
                              <UserCheck size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Status Action Modal (Discontinue / Reactivate) ────────────── */}
      {selectedStudentForAction && (
        <div className="dialog-overlay" onClick={() => setSelectedStudentForAction(null)} style={{ zIndex: 140 }}>
          <div className="dialog-content card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, margin: '0 0 var(--space-3)' }}>
              {actionType === 'discontinue' ? 'Discontinue Student' : 'Reactivate Student'}
            </h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
              Student: <strong>{selectedStudentForAction.studentName}</strong> ({selectedStudentForAction.registrationNumber})
            </p>

            {actionType === 'discontinue' ? (
              <div>
                <div className="form-group">
                  <label className="form-label">Effective Discontinuation Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={actionDate}
                    onChange={(e) => setActionDate(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Reason</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    placeholder="Reason for discontinuation"
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                  <button className="btn btn-secondary" onClick={() => setSelectedStudentForAction(null)}>
                    Cancel
                  </button>
                  <button className="btn btn-danger" onClick={handleDiscontinueConfirm} disabled={actionSubmitting}>
                    {actionSubmitting ? 'Saving…' : 'Confirm Discontinue'}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="form-group">
                  <label className="form-label">Reactivation Effective Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={actionDate}
                    onChange={(e) => setActionDate(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                  <button className="btn btn-secondary" onClick={() => setSelectedStudentForAction(null)}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" onClick={handleReactivateConfirm} disabled={actionSubmitting}>
                    {actionSubmitting ? 'Saving…' : 'Confirm Reactivate'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
