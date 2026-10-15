// src/pages/FeeUpdatePage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard, Search, CheckCircle, AlertCircle, Printer,
  Calendar, ArrowRight, RefreshCw, FileText, User, IndianRupee, ShieldCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { studentsApi, paymentsApi } from '../services/api';
import { formatCurrency, formatDate } from '../utils/formatters';

// Generate years 2026 to 2050
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

export default function FeeUpdatePage({ onNavigate = () => {}, initialParams = {} }) {
  const { token, user } = useAuth();
  const toast = useToast();

  const now = new Date();
  const defaultYear = now.getFullYear() >= 2026 ? now.getFullYear() : 2026;
  const defaultMonth = now.getMonth() + 1;
  const todayStr = now.toISOString().slice(0, 10);

  // Student Search & Selection
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentProfile, setStudentProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Payment Form Fields
  const [startYear, setStartYear] = useState(defaultYear);
  const [startMonth, setStartMonth] = useState(defaultMonth);
  const [numMonths, setNumMonths] = useState(1);
  const [enteredAmount, setEnteredAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayStr);
  const [paymentMethod, setPaymentMethod] = useState('UPI'); // UPI | CASH | BANK_TRANSFER | OTHER
  const [transactionRef, setTransactionRef] = useState('');
  const [notes, setNotes] = useState('');

  // Allocation Preview
  const [allocationPreview, setAllocationPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Submission & Receipt Modal
  const [submitting, setSubmitting] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => `fee_pay_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);

  // Auto-load if initialParams has studentReg
  useEffect(() => {
    if (initialParams?.studentReg) {
      loadStudentByReg(initialParams.studentReg);
    }
  }, [initialParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Search students
  async function handleStudentSearch(q) {
    setStudentSearchQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await studentsApi.search(token, q.trim());
      setSearchResults(res.students || []);
    } catch {
      // Ignore background search error
    } finally {
      setSearching(false);
    }
  }

  // Load selected student
  async function loadStudentByReg(regNum) {
    setProfileLoading(true);
    try {
      const res = await studentsApi.getProfile(token, regNum);
      setSelectedStudent(res.student);
      setStudentProfile(res);
      setSearchResults([]);
      setStudentSearchQuery(`${res.student.studentName} (${res.student.registrationNumber})`);

      // Auto-compute next starting month from paid-through
      if (res.summary?.paidThrough) {
        const parts = res.summary.paidThrough.split('-');
        let nextY = parseInt(parts[0]);
        let nextM = parseInt(parts[1]) + 1;
        if (nextM > 12) { nextM = 1; nextY++; }
        setStartYear(nextY);
        setStartMonth(nextM);
      }

      // Default amount for 1 month
      const rate = res.student.monthlyFee || 1000;
      setEnteredAmount(rate);
      setNumMonths(1);
    } catch (err) {
      toast.error(err.message || 'Failed to load student details.');
    } finally {
      setProfileLoading(false);
    }
  }

  // Compute allocation preview whenever inputs change
  const fetchAllocationPreview = useCallback(async () => {
    if (!selectedStudent || !enteredAmount) {
      setAllocationPreview(null);
      return;
    }
    const startMonthLabel = `${startYear}-${String(startMonth).padStart(2, '0')}`;
    setPreviewLoading(true);
    try {
      const res = await paymentsApi.previewAllocation(
        token,
        selectedStudent.registrationNumber,
        parseFloat(enteredAmount) || 0,
        startMonthLabel,
        parseInt(numMonths) || 1
      );
      setAllocationPreview(res.preview);
    } catch (err) {
      console.warn('Preview error:', err);
    } finally {
      setPreviewLoading(false);
    }
  }, [token, selectedStudent, startYear, startMonth, numMonths, enteredAmount]);

  useEffect(() => {
    fetchAllocationPreview();
  }, [fetchAllocationPreview]);

  // Handle number of months change
  function handleNumMonthsChange(months) {
    const m = Math.max(1, parseInt(months) || 1);
    setNumMonths(m);
    if (selectedStudent?.monthlyFee) {
      setEnteredAmount(m * selectedStudent.monthlyFee);
    }
  }

  // Submit payment
  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting || !selectedStudent) return;

    const amount = parseFloat(enteredAmount);
    if (!amount || amount <= 0) {
      toast.error('Payment amount must be greater than ₹0.');
      return;
    }

    setSubmitting(true);
    try {
      const startMonthLabel = `${startYear}-${String(startMonth).padStart(2, '0')}`;
      const payload = {
        registrationNumber: selectedStudent.registrationNumber,
        amount,
        paymentDate,
        paymentMethod,
        transactionRef: transactionRef.trim(),
        notes: notes.trim(),
        startMonth: startMonthLabel,
        numMonths: parseInt(numMonths) || 1,
      };

      const result = await paymentsApi.record(token, payload, idempotencyKey);

      setReceiptData(result);
      toast.success(`Fee recorded! Receipt: ${result.receiptNumber}`);
      loadStudentByReg(selectedStudent.registrationNumber);
    } catch (err) {
      toast.error(err.message || 'Failed to record fee payment.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setSelectedStudent(null);
    setStudentProfile(null);
    setStudentSearchQuery('');
    setSearchResults([]);
    setAllocationPreview(null);
    setReceiptData(null);
    setEnteredAmount('');
    setNumMonths(1);
    setTransactionRef('');
    setNotes('');
    setIdempotencyKey(`fee_pay_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Monthly Fee Updation</h1>
          <p className="page-subtitle">
            Record regular and multi-month advance fee payments with automatic monthly ledger allocation
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={handleReset}>
          <RefreshCw size={14} /> New Entry
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedStudent ? '1.2fr 1fr' : '1fr', gap: 'var(--space-5)' }}>
        {/* ── Left Column: Form ──────────────────────────────────────── */}
        <div>
          {/* Step 1: Student Selection */}
          <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
            <h2 style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-primary-light)', fontWeight: 700, marginBottom: 'var(--space-3)' }}>
              1. Select Student
            </h2>

            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: 36 }}
                placeholder="Search student by Name, Reg Number, or Phone…"
                value={studentSearchQuery}
                onChange={(e) => handleStudentSearch(e.target.value)}
              />

              {/* Dropdown Results */}
              {searchResults.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: 'var(--shadow-xl)',
                    zIndex: 50,
                    maxHeight: 240,
                    overflowY: 'auto',
                    marginTop: 4,
                  }}
                >
                  {searchResults.map((s) => (
                    <div
                      key={s.registrationNumber}
                      onClick={() => loadStudentByReg(s.registrationNumber)}
                      style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid var(--color-border)',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-base)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div>
                        <strong style={{ color: 'var(--color-text-primary)' }}>{s.studentName}</strong>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', display: 'block' }}>
                          Reg: {s.registrationNumber} • Phone: {s.phone}
                        </span>
                      </div>
                      <span className="badge badge-primary">{s.slotPlan}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Student Banner */}
            {selectedStudent && (
              <div style={{ marginTop: 'var(--space-4)', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3) var(--space-4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
                      {selectedStudent.studentName}
                    </h3>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                      Reg: <strong style={{ color: 'var(--color-primary-light)' }}>{selectedStudent.registrationNumber}</strong> • Phone: {selectedStudent.phone} • {selectedStudent.slotPlan}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Monthly Rate</span>
                    <strong style={{ display: 'block', color: 'var(--color-lime)', fontSize: 'var(--text-lg)' }}>
                      {formatCurrency(selectedStudent.monthlyFee)}
                    </strong>
                  </div>
                </div>

                {studentProfile?.summary && (
                  <div style={{ display: 'flex', gap: 'var(--space-4)', borderTop: '1px dashed var(--color-border)', marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', fontSize: 'var(--text-xs)' }}>
                    <div>
                      <span style={{ color: 'var(--color-text-muted)' }}>Paid Through: </span>
                      <strong style={{ color: 'var(--color-primary-light)' }}>{studentProfile.summary.paidThrough || 'None (due)'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-text-muted)' }}>Pending Dues: </span>
                      <strong style={{ color: studentProfile.summary.outstandingDues > 0 ? 'var(--color-danger)' : 'var(--color-lime)' }}>
                        {formatCurrency(studentProfile.summary.outstandingDues)}
                      </strong>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 2: Payment Details Form */}
          {selectedStudent && (
            <div className="card">
              <form onSubmit={handleSubmit}>
                <h2 style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-primary-light)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
                  2. Payment Coverage & Method
                </h2>

                {/* Starting Month & Year Selector (2026 - 2050) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                  <div className="form-group">
                    <label className="form-label">Starting Month</label>
                    <select
                      className="form-input"
                      value={startMonth}
                      onChange={(e) => setStartMonth(parseInt(e.target.value))}
                      disabled={submitting}
                    >
                      {MONTHS.map((m) => (
                        <option key={m.num} value={m.num}>{m.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Starting Year (2026 - 2050)</label>
                    <select
                      className="form-input"
                      value={startYear}
                      onChange={(e) => setStartYear(parseInt(e.target.value))}
                      disabled={submitting}
                    >
                      {YEARS.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Advance Months Slider / Input */}
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label className="form-label" style={{ margin: 0 }}>
                      Number of Months to Pay ({numMonths} {numMonths === 1 ? 'Month' : 'Months Advance'})
                    </label>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-primary-light)', fontWeight: 600 }}>
                      Expected Total: {formatCurrency(numMonths * selectedStudent.monthlyFee)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="36"
                    value={numMonths}
                    onChange={(e) => handleNumMonthsChange(e.target.value)}
                    style={{ width: '100%', accentColor: 'var(--color-primary)' }}
                    disabled={submitting}
                  />
                  <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                    {[1, 3, 6, 12, 23, 24].map((count) => (
                      <button
                        type="button"
                        key={count}
                        className={`btn btn-sm ${numMonths === count ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '2px 10px', fontSize: 'var(--text-xs)' }}
                        onClick={() => handleNumMonthsChange(count)}
                      >
                        {count}m
                      </button>
                    ))}
                  </div>
                </div>

                {/* Amount Received & Date */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                  <div className="form-group">
                    <label className="form-label">
                      Amount Received (₹) <span style={{ color: 'var(--color-danger)' }}>*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      className="form-input"
                      value={enteredAmount}
                      onChange={(e) => setEnteredAmount(e.target.value)}
                      placeholder="e.g. 1000"
                      required
                      disabled={submitting}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Payment Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      disabled={submitting}
                    />
                  </div>
                </div>

                {/* Method & Txn Reference */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                  <div className="form-group">
                    <label className="form-label">Payment Method</label>
                    <select
                      className="form-input"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      disabled={submitting}
                    >
                      <option value="UPI">UPI / Google Pay / PhonePe</option>
                      <option value="CASH">Cash Payment</option>
                      <option value="BANK_TRANSFER">Bank Transfer / IMPS</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Txn / UTR Reference #</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. UPI-9876543210"
                      value={transactionRef}
                      onChange={(e) => setTransactionRef(e.target.value)}
                      disabled={submitting}
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="form-group">
                  <label className="form-label">Receipt / Payment Notes</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Optional remarks (e.g. advance for competitive exam session)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={submitting}
                  />
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  className="btn btn-primary btn-full btn-lg"
                  disabled={submitting || !enteredAmount}
                  style={{ marginTop: 'var(--space-4)' }}
                  id="submit-fee-payment-btn"
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={18} className="spin-icon" /> Recording Fee & Generating Receipt…
                    </>
                  ) : (
                    <>
                      <CreditCard size={18} /> Confirm Payment of ₹{parseFloat(enteredAmount || 0).toLocaleString('en-IN')}
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* ── Right Column: Allocation Preview ───────────────────────── */}
        {selectedStudent && (
          <div>
            <div className="card" style={{ position: 'sticky', top: 80 }}>
              <h2 style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-lime)', fontWeight: 700, marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle size={16} /> Fee Allocation Breakdown
              </h2>

              {allocationPreview ? (
                <div>
                  <div style={{ background: 'var(--color-bg-base)', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', marginBottom: 4 }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Coverage Period</span>
                      <strong style={{ color: 'var(--color-primary-light)' }}>
                        {allocationPreview.allocations[0]?.monthLabel} to {allocationPreview.allocations[allocationPreview.allocations.length - 1]?.monthLabel}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', marginBottom: 4 }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Monthly Fee Rate</span>
                      <strong>{formatCurrency(allocationPreview.monthlyFee)}/mo</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', fontWeight: 700, borderTop: '1px dashed var(--color-border)', paddingTop: 4, marginTop: 4 }}>
                      <span>Total Expected</span>
                      <span style={{ color: 'var(--color-lime)' }}>{formatCurrency(allocationPreview.expectedTotal)}</span>
                    </div>
                  </div>

                  {/* Month-by-month table */}
                  <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                    <table className="table" style={{ fontSize: 'var(--text-xs)' }}>
                      <thead>
                        <tr>
                          <th>Month</th>
                          <th>Due</th>
                          <th>Allocated</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allocationPreview.allocations.map((alloc) => (
                          <tr key={alloc.monthLabel}>
                            <td><strong>{alloc.monthLabel}</strong></td>
                            <td>{formatCurrency(alloc.dueAmount)}</td>
                            <td>
                              <span style={{ color: alloc.allocatedAmount > 0 ? 'var(--color-lime)' : 'var(--color-text-muted)', fontWeight: 600 }}>
                                {formatCurrency(alloc.allocatedAmount)}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${alloc.status === 'PAID' ? 'badge-success' : alloc.status === 'PARTIALLY_PAID' ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: 10, padding: '1px 6px' }}>
                                {alloc.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {allocationPreview.balanceDiff !== 0 && (
                    <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)', background: allocationPreview.balanceDiff < 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: allocationPreview.balanceDiff < 0 ? 'var(--color-danger)' : 'var(--color-lime)' }}>
                      {allocationPreview.balanceDiff < 0 ? (
                        <span>⚠️ Payment is short by {formatCurrency(Math.abs(allocationPreview.balanceDiff))}. Final month will be marked Partially Paid.</span>
                      ) : (
                        <span>✓ Excess credit of {formatCurrency(allocationPreview.balanceDiff)} available for future months.</span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--space-6)' }}>
                  Enter payment amount to view allocation
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Receipt Modal Screen ──────────────────────────────────────── */}
      {receiptData && (
        <div className="dialog-overlay" style={{ zIndex: 150 }}>
          <div className="dialog-content card" style={{ maxWidth: 640, padding: 0 }}>
            {/* Printable Receipt */}
            <div className="receipt-slip" style={{ padding: 'var(--space-6)' }}>
              {/* Header */}
              <div style={{ textAlign: 'center', borderBottom: '2px solid var(--color-border)', paddingBottom: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                  ZENITH LIBRARY & STUDY HALL
                </h2>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
                  Official Fee Payment Receipt
                </p>
                <div style={{ display: 'inline-block', marginTop: 'var(--space-3)', background: 'var(--color-primary-dim)', color: 'var(--color-primary-light)', padding: '4px 14px', borderRadius: 'var(--radius-full)', fontWeight: 700, fontFamily: 'monospace', fontSize: 'var(--text-sm)' }}>
                  Receipt #: {receiptData.receiptNumber}
                </div>
              </div>

              {/* Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
                <div>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Student Name:</span>
                  <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{receiptData.studentName}</div>
                </div>
                <div>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Registration #:</span>
                  <div style={{ fontWeight: 700, color: 'var(--color-primary-light)', fontFamily: 'monospace' }}>{receiptData.registrationNumber}</div>
                </div>
                <div>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Payment Date:</span>
                  <div>{formatDate(receiptData.paymentDate)}</div>
                </div>
                <div>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Payment Method:</span>
                  <div><span className="badge badge-primary">{receiptData.paymentMethod}</span></div>
                </div>
                {receiptData.transactionRef && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Transaction Reference:</span>
                    <div style={{ fontFamily: 'monospace' }}>{receiptData.transactionRef}</div>
                  </div>
                )}
              </div>

              {/* Covered Months */}
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                <span style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', color: 'var(--color-text-muted)', display: 'block', marginBottom: 6 }}>
                  Months Covered ({receiptData.allocatedMonths?.length || 0})
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {receiptData.allocatedMonths?.map((m) => (
                    <span key={m.monthLabel} className="badge" style={{ background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', fontSize: 'var(--text-xs)' }}>
                      {m.monthLabel} (₹{m.allocatedAmount})
                    </span>
                  ))}
                </div>
              </div>

              {/* Total Paid Banner */}
              <div style={{ background: 'var(--color-bg-base)', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
                <span style={{ fontWeight: 600 }}>Total Amount Received</span>
                <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--color-lime)' }}>
                  {formatCurrency(receiptData.amount)}
                </span>
              </div>

              {/* Signatures */}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 'var(--space-4)', borderTop: '1px dashed var(--color-border)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                <span>Entered by: {user?.name || 'Manager'}</span>
                <span>Authorized Signatory / Seal</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="no-print" style={{ padding: 'var(--space-4) var(--space-6)', background: 'var(--color-bg-base)', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
              <button className="btn btn-secondary" onClick={() => window.print()}>
                <Printer size={16} /> Print Receipt
              </button>
              <button className="btn btn-primary" onClick={handleReset}>
                Done & Record Another
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
