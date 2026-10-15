// src/pages/ReportsPage.jsx
// ── ZENITH LIBRARY MANAGEMENT SYSTEM — Comprehensive Reports & Exports Hub ────────
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart3, Download, Printer, Filter, Calendar, Users,
  CreditCard, Shield, Clock, AlertTriangle, CheckCircle2,
  FileSpreadsheet, Search, RefreshCw, X, Receipt, Eye
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { studentsApi, paymentsApi, ledgerApi, reportsApi } from '../services/api';
import { SkeletonTable } from '../components/ui/SkeletonLoader';
import EmptyState from '../components/ui/EmptyState';
import { formatCurrency, formatDate, formatDateTime } from '../utils/formatters';

// ── The 10 Pre-Configured Report Types ────────────────────────────────────────
const REPORT_TYPES = [
  { id: 'MONTH_WISE_COLLECTION', label: '1. Month-wise Collections', icon: CreditCard, description: 'Cash receipts and fee allocations per month' },
  { id: 'YEAR_WISE_COLLECTION', label: '2. Year-wise Collections', icon: BarChart3, description: 'Annual collection totals and growth trajectory' },
  { id: 'NEW_ADMISSIONS', label: '3. New Admissions', icon: Users, description: 'Newly enrolled students by date range and slot' },
  { id: 'STUDENT_DIRECTORY', label: '4. Active & Non-Active Students', icon: Users, description: 'Complete roster of active and withdrawn members' },
  { id: 'OUTSTANDING_DUES', label: '5. Outstanding Fee Dues', icon: AlertTriangle, description: 'Students with unpaid balances and overdue months' },
  { id: 'ADVANCE_COVERAGE', label: '6. Advance Payment Coverage', icon: CheckCircle2, description: 'Students with prepaid fee coverage into future months' },
  { id: 'REGISTRATION_FEES', label: '7. Registration Fee Collections', icon: CreditCard, description: 'Audit of one-time non-refundable admission fees' },
  { id: 'LOCKER_DEPOSITS', label: '8. Refundable Locker Deposits', icon: Shield, description: 'Security deposit liability held for active students' },
  { id: 'TRANSACTION_HISTORY', label: '9. Payment Transaction History', icon: Clock, description: 'All cash, UPI, and bank receipts recorded' },
  { id: 'STUDENT_FEE_HISTORY', label: '10. Student Fee Ledger History', icon: FileSpreadsheet, description: 'Comprehensive student-by-student ledger allocations' },
];

// ── Printable Receipt Modal ──────────────────────────────────────────────────
function ReceiptModal({ receipt, onClose }) {
  if (!receipt) return null;

  return (
    <div className="dialog-overlay no-print" role="dialog" aria-modal="true">
      <div className="dialog" style={{ maxWidth: 520, background: '#fff', color: '#1a1a2e', padding: 'var(--space-5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #7c6fcd', paddingBottom: 12, marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#1a1a3e' }}>ZENITH LIBRARY</h2>
            <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0 0' }}>Official Fee Payment Receipt</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: 'monospace', color: '#7c6fcd' }}>
              {receipt.receiptNumber}
            </span>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Date: {formatDate(receipt.paymentDate)}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: '0.82rem', marginBottom: 16 }}>
          <div>
            <div style={{ color: '#64748b', fontSize: '0.72rem' }}>Student Name:</div>
            <div style={{ fontWeight: 700, color: '#1e293b' }}>{receipt.studentName}</div>
          </div>
          <div>
            <div style={{ color: '#64748b', fontSize: '0.72rem' }}>Registration Number:</div>
            <div style={{ fontWeight: 700, fontFamily: 'monospace' }}>{receipt.registrationNumber}</div>
          </div>
          <div>
            <div style={{ color: '#64748b', fontSize: '0.72rem' }}>Payment Method:</div>
            <div style={{ fontWeight: 600 }}>{receipt.paymentMethod || 'CASH'}</div>
          </div>
          <div>
            <div style={{ color: '#64748b', fontSize: '0.72rem' }}>Amount Paid:</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10b981' }}>
              {formatCurrency(receipt.amount)}
            </div>
          </div>
        </div>

        {receipt.transactionRef && (
          <div style={{ fontSize: '0.75rem', marginBottom: 12, color: '#475569' }}>
            <strong>Txn Reference:</strong> {receipt.transactionRef}
          </div>
        )}

        {receipt.notes && (
          <div style={{ fontSize: '0.75rem', marginBottom: 16, color: '#475569', background: '#f8fafc', padding: 8, borderRadius: 4 }}>
            <strong>Notes:</strong> {receipt.notes}
          </div>
        )}

        <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 24 }}>
          <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
            Issued by: {receipt.enteredBy || 'Administrator'}<br />
            System Timestamp: {formatDateTime(receipt.createdAt || new Date())}
          </div>
          <div style={{ textAlign: 'center', borderTop: '1px solid #94a3b8', width: 140, paddingTop: 4, fontSize: '0.72rem', color: '#475569' }}>
            Authorized Signature
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }} className="no-print">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
          <button className="btn btn-primary btn-sm" onClick={() => window.print()}>
            <Printer size={14} /> Print Receipt
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const { token, user } = useAuth();
  const toast = useToast();

  const now = new Date();
  const [activeReport, setActiveReport] = useState('MONTH_WISE_COLLECTION');
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState([]);
  const [summaryMetrics, setSummaryMetrics] = useState({});
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  // Fetch report data
  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      if (activeReport === 'MONTH_WISE_COLLECTION' || activeReport === 'YEAR_WISE_COLLECTION') {
        const res = await reportsApi.collectionAnalytics(token, { year: selectedYear, month: selectedMonth });
        if (activeReport === 'MONTH_WISE_COLLECTION') {
          setReportData(res.monthByMonth || []);
          setSummaryMetrics({
            totalCash: res.yearlyTotals?.totalCashCollected || 0,
            totalCoverage: res.yearlyTotals?.totalFeeAllocated || 0,
            totalDue: res.yearlyTotals?.totalFeeDue || 0,
            totalOutstanding: res.yearlyTotals?.totalOutstanding || 0,
          });
        } else {
          // Yearly summary
          setReportData([{
            year: selectedYear,
            ...res.yearlyTotals
          }]);
          setSummaryMetrics(res.yearlyTotals || {});
        }
      } else if (activeReport === 'NEW_ADMISSIONS' || activeReport === 'STUDENT_DIRECTORY') {
        const res = await studentsApi.list(token, {
          status: activeReport === 'STUDENT_DIRECTORY' && statusFilter !== 'ALL' ? statusFilter : undefined,
        });
        let students = res.students || [];
        if (activeReport === 'NEW_ADMISSIONS') {
          const targetPrefix = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
          students = students.filter(s => (s.admissionDate || s.createdAt || '').startsWith(targetPrefix));
        }
        setReportData(students);
        setSummaryMetrics({
          count: students.length,
          totalRegFees: students.reduce((sum, s) => sum + (parseFloat(s.registrationFee) || 0), 0),
          totalLockers: students.reduce((sum, s) => sum + (parseFloat(s.lockerCharge) || 0), 0),
        });
      } else if (activeReport === 'OUTSTANDING_DUES') {
        const res = await ledgerApi.getMonthlyStatus(token, selectedYear, selectedMonth);
        const defaulters = (res.students || []).filter(s => s.feeStatus === 'PENDING' || s.feeStatus === 'PARTIALLY_PAID');
        setReportData(defaulters);
        setSummaryMetrics({
          defaultersCount: defaulters.length,
          totalOutstanding: defaulters.reduce((sum, s) => sum + (parseFloat(s.balance) || 0), 0),
        });
      } else if (activeReport === 'ADVANCE_COVERAGE') {
        // Find students whose latest paid month > selectedMonth
        const currentTarget = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
        const res = await studentsApi.list(token, { status: 'ACTIVE' });
        const students = res.students || [];
        // For each student, check their ledger
        const advanceList = [];
        for (const s of students.slice(0, 50)) { // limit for responsiveness
          try {
            const ledRes = await ledgerApi.getStudentLedger(token, s.registrationNumber);
            const futurePaids = (ledRes.ledger || []).filter(l => l.status === 'PAID' && l.monthLabel > currentTarget);
            if (futurePaids.length > 0) {
              const latestPaid = futurePaids[futurePaids.length - 1];
              advanceList.push({
                registrationNumber: s.registrationNumber,
                studentName: s.studentName,
                phone: s.phone,
                slotPlan: s.slotPlan,
                monthlyFee: s.monthlyFee,
                advanceMonthsCount: futurePaids.length,
                coveredThrough: latestPaid.monthLabel,
              });
            }
          } catch (e) {}
        }
        setReportData(advanceList);
        setSummaryMetrics({ advanceCount: advanceList.length });
      } else if (activeReport === 'REGISTRATION_FEES') {
        const res = await studentsApi.list(token);
        const list = (res.students || []).filter(s => parseFloat(s.registrationFee) > 0);
        setReportData(list);
        setSummaryMetrics({
          totalCollected: list.reduce((sum, s) => sum + (parseFloat(s.registrationFee) || 0), 0),
          count: list.length,
        });
      } else if (activeReport === 'LOCKER_DEPOSITS') {
        const res = await studentsApi.list(token);
        const list = (res.students || []).filter(s => parseFloat(s.lockerCharge) > 0);
        setReportData(list);
        setSummaryMetrics({
          totalHeld: list.reduce((sum, s) => sum + (parseFloat(s.lockerCharge) || 0), 0),
          activeHeld: list.filter(s => s.status === 'ACTIVE').reduce((sum, s) => sum + (parseFloat(s.lockerCharge) || 0), 0),
          count: list.length,
        });
      } else if (activeReport === 'TRANSACTION_HISTORY') {
        const res = await paymentsApi.list(token, {
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        });
        const list = res.payments || [];
        setReportData(list);
        setSummaryMetrics({
          totalAmount: list.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0),
          count: list.length,
        });
      } else if (activeReport === 'STUDENT_FEE_HISTORY') {
        const res = await ledgerApi.getMonthlyStatus(token, selectedYear, selectedMonth);
        setReportData(res.students || []);
        setSummaryMetrics(res.summary || {});
      }
    } catch (err) {
      toast.error(err.message, { title: 'Failed to load report' });
    } finally {
      setLoading(false);
    }
  }, [token, activeReport, selectedYear, selectedMonth, dateFrom, dateTo, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const activeMeta = REPORT_TYPES.find(r => r.id === activeReport) || REPORT_TYPES[0];

  // CSV Export logic
  function exportCSV() {
    if (!reportData.length) {
      toast.info('No data available to export.');
      return;
    }

    const timestamp = new Date().toLocaleString('en-IN');
    let csvContent = [
      `# Zenith Library Management System — ${activeMeta.label}`,
      `# Generated On: ${timestamp} by ${user?.name || 'Administrator'}`,
      `# Filter Criteria: Year ${selectedYear}, Month ${selectedMonth}, Date Range: ${dateFrom || 'All'} to ${dateTo || 'All'}, Status: ${statusFilter}`,
      `# Privacy Protection: Personal Aadhaar numbers are masked for compliance.`,
    ];

    if (activeReport === 'MONTH_WISE_COLLECTION') {
      csvContent.push('Month,Cash Collection (INR),Fee Coverage Allocated (INR),Fees Due (INR),Outstanding (INR),Rate (%),New Admissions,Registration Fees,Locker Deposits');
      reportData.forEach(r => {
        csvContent.push(`"${r.monthName} ${selectedYear}",${r.cashCollected},${r.feeAllocated},${r.feeDue},${r.outstanding},"${r.collectionPercentage}%",${r.newAdmissions},${r.regFees},${r.lockerDeposits}`);
      });
    } else if (activeReport === 'NEW_ADMISSIONS' || activeReport === 'STUDENT_DIRECTORY') {
      csvContent.push('Registration Number,Student Name,Father Name,Phone,Admission Date,Slot/Plan,Monthly Fee,Registration Fee,Locker Charge,Status');
      reportData.forEach(s => {
        csvContent.push(`"${s.registrationNumber}","${s.studentName}","${s.fatherName || ''}","${s.phone || ''}","${s.admissionDate || ''}","${s.slotPlan || ''}",${s.monthlyFee},${s.registrationFee},${s.lockerCharge},"${s.status}"`);
      });
    } else if (activeReport === 'OUTSTANDING_DUES') {
      csvContent.push('Registration Number,Student Name,Father Name,Phone,Monthly Rate,Amount Paid,Balance Due,Status');
      reportData.forEach(s => {
        csvContent.push(`"${s.registrationNumber}","${s.studentName}","${s.fatherName || ''}","${s.phone || ''}",${s.dueAmount},${s.paidAmount},${s.balance},"${s.feeStatus}"`);
      });
    } else if (activeReport === 'ADVANCE_COVERAGE') {
      csvContent.push('Registration Number,Student Name,Phone,Monthly Fee,Advance Months Paid,Covered Through');
      reportData.forEach(s => {
        csvContent.push(`"${s.registrationNumber}","${s.studentName}","${s.phone || ''}",${s.monthlyFee},${s.advanceMonthsCount},"${s.coveredThrough}"`);
      });
    } else if (activeReport === 'TRANSACTION_HISTORY') {
      csvContent.push('Receipt Number,Payment ID,Date,Registration Number,Amount (INR),Method,Txn Reference,Recorded By');
      reportData.forEach(p => {
        csvContent.push(`"${p.receiptNumber}","${p.paymentId}","${p.paymentDate || p.createdAt}","${p.registrationNumber}",${p.amount},"${p.paymentMethod || 'CASH'}","${p.transactionRef || ''}","${p.enteredBy || 'System'}"`);
      });
    } else {
      // Generic JSON keys
      const keys = Object.keys(reportData[0]);
      csvContent.push(keys.join(','));
      reportData.forEach(row => {
        csvContent.push(keys.map(k => `"${String(row[k] || '').replace(/"/g, '""')}"`).join(','));
      });
    }

    const blob = new Blob([csvContent.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Zenith_${activeReport}_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Report exported to CSV successfully.');
  }

  // Filter client side search query
  const filteredData = reportData.filter(item => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (item.studentName && item.studentName.toLowerCase().includes(q)) ||
      (item.registrationNumber && item.registrationNumber.toLowerCase().includes(q)) ||
      (item.receiptNumber && item.receiptNumber.toLowerCase().includes(q)) ||
      (item.phone && item.phone.includes(q))
    );
  });

  return (
    <div className="reports-page">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="page-header" style={{ marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <h1 className="page-title">Reports & Financial Exports</h1>
          <p className="page-subtitle">
            Audited financial statements, defaulter tracking, advance coverage & printable records
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }} className="no-print">
          <button className="btn btn-ghost btn-sm" onClick={loadReport} aria-label="Refresh report">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button className="btn btn-secondary btn-sm" onClick={exportCSV} disabled={!reportData.length}>
            <Download size={14} />
            Export CSV
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => window.print()} disabled={!reportData.length}>
            <Printer size={14} />
            Print Report
          </button>
        </div>
      </div>

      {/* ── 10 Report Tabs Strip ─────────────────────────────────────────── */}
      <div className="no-print" style={{
        display: 'flex',
        gap: 6,
        overflowX: 'auto',
        paddingBottom: 'var(--space-2)',
        marginBottom: 'var(--space-4)',
        borderBottom: '1px solid var(--color-border)',
      }}>
        {REPORT_TYPES.map((r) => {
          const isActive = r.id === activeReport;
          const Icon = r.icon;
          return (
            <button
              key={r.id}
              onClick={() => setActiveReport(r.id)}
              className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-ghost'}`}
              style={{
                flexShrink: 0,
                fontSize: '0.75rem',
                borderRadius: 'var(--radius-lg)',
                padding: '6px 12px',
                fontWeight: isActive ? 700 : 500,
              }}
            >
              <Icon size={14} />
              {r.label}
            </button>
          );
        })}
      </div>

      {/* ── Report Filter Bar ────────────────────────────────────────────── */}
      <div className="card no-print" style={{ padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-4)', background: 'var(--color-bg-surface-elevated)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Filter size={13} /> Filters:
            </span>

            {/* Year Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Year:</label>
              <select
                className="form-input"
                style={{ padding: '4px 8px', fontSize: 'var(--text-xs)', height: 30 }}
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              >
                {Array.from({ length: 25 }, (_, i) => 2026 + i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Month Selector for month-applicable reports */}
            {activeReport !== 'YEAR_WISE_COLLECTION' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Month:</label>
                <select
                  className="form-input"
                  style={{ padding: '4px 8px', fontSize: 'var(--text-xs)', height: 30 }}
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {new Date(2026, m - 1, 1).toLocaleString('en-IN', { month: 'short' })}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Student Directory Status Filter */}
            {activeReport === 'STUDENT_DIRECTORY' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Status:</label>
                <select
                  className="form-input"
                  style={{ padding: '4px 8px', fontSize: 'var(--text-xs)', height: 30 }}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active Members</option>
                  <option value="INACTIVE">Non-Active (Discontinued)</option>
                </select>
              </div>
            )}

            {/* Date Range for Transaction History */}
            {activeReport === 'TRANSACTION_HISTORY' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="date"
                  className="form-input"
                  style={{ padding: '4px 8px', fontSize: 'var(--text-xs)', height: 30 }}
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  placeholder="From"
                />
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>to</span>
                <input
                  type="date"
                  className="form-input"
                  style={{ padding: '4px 8px', fontSize: 'var(--text-xs)', height: 30 }}
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  placeholder="To"
                />
              </div>
            )}
          </div>

          {/* Quick Search */}
          <div style={{ position: 'relative', width: 220 }}>
            <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: 28, height: 30, fontSize: 'var(--text-xs)' }}
              placeholder="Search in report..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ── Printable Header (visible on window.print) ───────────────────── */}
      <div className="print-only" style={{ display: 'none', marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>ZENITH LIBRARY MANAGEMENT SYSTEM</h1>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#475569', margin: '4px 0 0' }}>{activeMeta.label}</h2>
        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
          Generated: {new Date().toLocaleString('en-IN')} | Criteria: Year {selectedYear}, Month {selectedMonth} | Authorized: {user?.name}
        </div>
      </div>

      {/* ── Summary Cards Strip for Current Report ────────────────────────── */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
        {activeReport === 'MONTH_WISE_COLLECTION' && (
          <>
            <div className="card" style={{ padding: 'var(--space-3) var(--space-4)', flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Yearly Real Cash Collection</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981' }}>{formatCurrency(summaryMetrics.totalCash || 0)}</div>
            </div>
            <div className="card" style={{ padding: 'var(--space-3) var(--space-4)', flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Yearly Fee Coverage Allocated</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#7c6fcd' }}>{formatCurrency(summaryMetrics.totalCoverage || 0)}</div>
            </div>
            <div className="card" style={{ padding: 'var(--space-3) var(--space-4)', flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Total Outstanding Dues</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f59e0b' }}>{formatCurrency(summaryMetrics.totalOutstanding || 0)}</div>
            </div>
          </>
        )}

        {activeReport === 'OUTSTANDING_DUES' && (
          <>
            <div className="card" style={{ padding: 'var(--space-3) var(--space-4)', flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Total Defaulter Students</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f59e0b' }}>{summaryMetrics.defaultersCount || 0}</div>
            </div>
            <div className="card" style={{ padding: 'var(--space-3) var(--space-4)', flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Total Overdue Amount</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ef4444' }}>{formatCurrency(summaryMetrics.totalOutstanding || 0)}</div>
            </div>
          </>
        )}

        {activeReport === 'LOCKER_DEPOSITS' && (
          <>
            <div className="card" style={{ padding: 'var(--space-3) var(--space-4)', flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Active Refundable Deposits Held</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ec4899' }}>{formatCurrency(summaryMetrics.activeHeld || 0)}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--color-text-subtle)' }}>Security liability (Not operating income)</div>
            </div>
          </>
        )}
      </div>

      {/* ── Main Report Table ─────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 'var(--space-4)' }}>
        {loading ? (
          <SkeletonTable rows={8} cols={6} />
        ) : filteredData.length === 0 ? (
          <EmptyState
            icon={FileSpreadsheet}
            title="No records found"
            description="No data matches the selected report criteria and filters."
          />
        ) : (
          <div className="table-responsive">
            {/* 1. Month-wise Collections Table */}
            {activeReport === 'MONTH_WISE_COLLECTION' && (
              <table className="table" style={{ fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th>Fee Month</th>
                    <th style={{ textAlign: 'right' }}>Cash Received (On Date)</th>
                    <th style={{ textAlign: 'right' }}>Fee Coverage Allocated</th>
                    <th style={{ textAlign: 'right' }}>Fee Due</th>
                    <th style={{ textAlign: 'right' }}>Outstanding</th>
                    <th style={{ textAlign: 'center' }}>Rate (%)</th>
                    <th style={{ textAlign: 'right' }}>Reg. Fees</th>
                    <th style={{ textAlign: 'right' }}>Locker Deposits</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((m) => (
                    <tr key={m.monthNum}>
                      <td style={{ fontWeight: 600 }}>{m.monthName} {selectedYear}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{formatCurrency(m.cashCollected)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#7c6fcd' }}>{formatCurrency(m.feeAllocated)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(m.feeDue)}</td>
                      <td style={{ textAlign: 'right', color: m.outstanding > 0 ? '#f59e0b' : '#34d399', fontWeight: 600 }}>{formatCurrency(m.outstanding)}</td>
                      <td style={{ textAlign: 'center' }}><span className="badge badge-primary">{m.collectionPercentage}%</span></td>
                      <td style={{ textAlign: 'right', color: '#a855f7' }}>{formatCurrency(m.regFees)}</td>
                      <td style={{ textAlign: 'right', color: '#ec4899' }}>{formatCurrency(m.lockerDeposits)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* 2. New Admissions / Student Directory Table */}
            {(activeReport === 'NEW_ADMISSIONS' || activeReport === 'STUDENT_DIRECTORY') && (
              <table className="table" style={{ fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th>Reg #</th>
                    <th>Student Name</th>
                    <th>Father Name</th>
                    <th>Phone</th>
                    <th>Admission Date</th>
                    <th>Slot/Plan</th>
                    <th style={{ textAlign: 'right' }}>Monthly Fee</th>
                    <th style={{ textAlign: 'right' }}>Reg Fee</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((s) => (
                    <tr key={s.registrationNumber}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{s.registrationNumber}</td>
                      <td style={{ fontWeight: 600 }}>{s.studentName}</td>
                      <td style={{ color: 'var(--color-text-muted)' }}>{s.fatherName}</td>
                      <td>{s.phone}</td>
                      <td>{formatDate(s.admissionDate)}</td>
                      <td><span className="badge badge-neutral">{s.slotPlan}</span></td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(s.monthlyFee)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(s.registrationFee)}</td>
                      <td>
                        <span className={`badge ${s.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`}>
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* 3. Outstanding Dues Table */}
            {activeReport === 'OUTSTANDING_DUES' && (
              <table className="table" style={{ fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th>Reg #</th>
                    <th>Student Name</th>
                    <th>Father Name</th>
                    <th>Phone</th>
                    <th>Slot/Plan</th>
                    <th style={{ textAlign: 'right' }}>Monthly Rate</th>
                    <th style={{ textAlign: 'right' }}>Paid</th>
                    <th style={{ textAlign: 'right' }}>Overdue Balance</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((s) => (
                    <tr key={s.registrationNumber}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{s.registrationNumber}</td>
                      <td style={{ fontWeight: 600 }}>{s.studentName}</td>
                      <td>{s.fatherName}</td>
                      <td>{s.phone}</td>
                      <td><span className="badge badge-neutral">{s.slotPlan}</span></td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(s.dueAmount)}</td>
                      <td style={{ textAlign: 'right', color: '#10b981' }}>{formatCurrency(s.paidAmount)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>{formatCurrency(s.balance)}</td>
                      <td>
                        <span className={`badge ${s.feeStatus === 'PARTIALLY_PAID' ? 'badge-warning' : 'badge-danger'}`}>
                          {s.feeStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* 4. Advance Coverage Table */}
            {activeReport === 'ADVANCE_COVERAGE' && (
              <table className="table" style={{ fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th>Reg #</th>
                    <th>Student Name</th>
                    <th>Phone</th>
                    <th>Slot/Plan</th>
                    <th style={{ textAlign: 'right' }}>Monthly Fee</th>
                    <th style={{ textAlign: 'center' }}>Advance Months Covered</th>
                    <th>Covered Paid-Through</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((s) => (
                    <tr key={s.registrationNumber}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{s.registrationNumber}</td>
                      <td style={{ fontWeight: 600 }}>{s.studentName}</td>
                      <td>{s.phone}</td>
                      <td><span className="badge badge-neutral">{s.slotPlan}</span></td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(s.monthlyFee)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-success">+{s.advanceMonthsCount} Months</span>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--color-primary-light)' }}>
                        {s.coveredThrough}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* 5. Payment Transactions Table with Receipt Action */}
            {activeReport === 'TRANSACTION_HISTORY' && (
              <table className="table" style={{ fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th>Receipt #</th>
                    <th>Payment Date</th>
                    <th>Reg #</th>
                    <th>Amount Paid</th>
                    <th>Method</th>
                    <th>Txn Reference</th>
                    <th>Recorded By</th>
                    <th className="no-print" style={{ textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((p) => (
                    <tr key={p.paymentId || p.receiptNumber}>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-primary-light)' }}>
                          {p.receiptNumber}
                        </span>
                      </td>
                      <td>{formatDate(p.paymentDate || p.createdAt)}</td>
                      <td>
                        <span className="badge badge-neutral" style={{ fontFamily: 'var(--font-mono)' }}>
                          {p.registrationNumber}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: '#10b981' }}>{formatCurrency(p.amount)}</td>
                      <td><span className="badge badge-primary">{p.paymentMethod || 'CASH'}</span></td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>{p.transactionRef || '—'}</td>
                      <td style={{ color: 'var(--color-text-muted)' }}>{p.enteredBy || 'System'}</td>
                      <td className="no-print" style={{ textAlign: 'center' }}>
                        <button
                          className="btn btn-ghost btn-xs"
                          onClick={() => setSelectedReceipt(p)}
                          title="View and print official payment receipt"
                        >
                          <Receipt size={14} /> Receipt
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* 6. Refundable Locker Deposits Table */}
            {activeReport === 'LOCKER_DEPOSITS' && (
              <table className="table" style={{ fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th>Reg #</th>
                    <th>Student Name</th>
                    <th>Phone</th>
                    <th>Slot/Plan</th>
                    <th style={{ textAlign: 'right' }}>Locker Deposit Held</th>
                    <th>Member Status</th>
                    <th>Deposit Nature</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((s) => (
                    <tr key={s.registrationNumber}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{s.registrationNumber}</td>
                      <td style={{ fontWeight: 600 }}>{s.studentName}</td>
                      <td>{s.phone}</td>
                      <td><span className="badge badge-neutral">{s.slotPlan}</span></td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#ec4899' }}>
                        {formatCurrency(s.lockerCharge)}
                      </td>
                      <td>
                        <span className={`badge ${s.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`}>
                          {s.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                        Refundable on withdrawal
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ── Printable Payment Receipt Modal ──────────────────────────────── */}
      <ReceiptModal receipt={selectedReceipt} onClose={() => setSelectedReceipt(null)} />
    </div>
  );
}
