// src/pages/MonthlyFeeAnalyticsPage.jsx
// ── Dedicated Monthly Fee Analytics Page ─────────────────────────────────────
import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, Calendar, Filter, Download, Printer, RefreshCw,
  DollarSign, CheckCircle2, Clock, AlertTriangle, Users, Shield,
  ArrowUpRight, ArrowDownRight, Layers, FileSpreadsheet
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { reportsApi } from '../services/api';
import { SkeletonTable } from '../components/ui/SkeletonLoader';
import EmptyState from '../components/ui/EmptyState';
import { formatCurrency, formatDate } from '../utils/formatters';

// ── Custom Tooltip ───────────────────────────────────────────────────────────
function CustomAnalyticsTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(18, 18, 42, 0.95)',
      backdropFilter: 'blur(8px)',
      border: '1px solid rgba(124, 111, 205, 0.3)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-3)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
    }}>
      <div style={{ fontWeight: 700, color: '#f8fafc', marginBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 4 }}>
        {label}
      </div>
      {payload.map((p) => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, fontSize: '0.78rem', marginTop: 3 }}>
          <span style={{ color: p.color, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
            {p.name}:
          </span>
          <span style={{ fontWeight: 700, color: '#fff' }}>
            {p.name.toLowerCase().includes('cash') || p.name.toLowerCase().includes('coverage') || p.name.toLowerCase().includes('fee') || p.name.toLowerCase().includes('due') || p.name.toLowerCase().includes('deposit') || p.name.toLowerCase().includes('outstanding')
              ? formatCurrency(p.value)
              : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

const formatAxisRupees = (v) => {
  if (!v || v === 0) return '₹0';
  if (v >= 100000) return `₹${(v / 100000).toFixed(1).replace(/\.0$/, '')}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `₹${v}`;
};

export default function MonthlyFeeAnalyticsPage({ onNavigate = () => {} }) {
  const { token } = useAuth();
  const toast = useToast();

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [chartType, setChartType] = useState('bar'); // 'bar' | 'line'
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await reportsApi.collectionAnalytics(token, {
        year: selectedYear,
        month: selectedMonth,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setData(res);
    } catch (err) {
      setError(err.message);
      toast.error(err.message, { title: 'Failed to load analytics' });
    } finally {
      setLoading(false);
    }
  }, [token, selectedYear, selectedMonth, dateFrom, dateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const selectedMonthName = monthNames[selectedMonth - 1];

  // Export Month-by-Month data to CSV
  function handleExportCSV() {
    if (!data?.monthByMonth?.length) return;
    const headers = [
      'Month', 'Cash Collected (INR)', 'Fee Allocated / Coverage (INR)',
      'Fees Due (INR)', 'Outstanding Dues (INR)', 'Collection Rate (%)',
      'Registration Fees (INR)', 'Refundable Locker Deposits (INR)',
      'New Admissions', 'Discontinued', 'Reactivated'
    ];

    const rows = data.monthByMonth.map((m) => [
      `"${m.monthName} ${selectedYear}"`,
      m.cashCollected,
      m.feeAllocated,
      m.feeDue,
      m.outstanding,
      `${m.collectionPercentage}%`,
      m.regFees,
      m.lockerDeposits,
      m.newAdmissions,
      m.discontinued,
      m.reactivated,
    ]);

    const csvContent = [
      `# Zenith Library Management System — Monthly Fee Analytics (${selectedYear})`,
      `# Generated on: ${new Date().toLocaleString('en-IN')}`,
      `# Note: Cash Collection represents actual money received on transaction dates. Fee Coverage represents allocations to fee months.`,
      headers.join(','),
      ...rows.map((r) => r.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Zenith_Monthly_Analytics_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Analytics for ${selectedYear} exported to CSV.`);
  }

  // Print Report
  function handlePrint() {
    window.print();
  }

  if (loading && !data) return <SkeletonTable rows={10} cols={7} />;

  if (error && !data) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Could not load monthly collection analytics"
        description={error}
        action={<button className="btn btn-primary" onClick={fetchAnalytics}><RefreshCw size={16}/> Retry</button>}
      />
    );
  }

  const { monthByMonth = [], yearlyTotals = {}, selectedMonthDetails = {}, customRange } = data || {};

  return (
    <div className="analytics-page">
      {/* ── Page Header & Controls ────────────────────────────────────────── */}
      <div className="page-header" style={{ marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 className="page-title">Monthly Fee Analytics</h1>
            <span className="badge badge-primary">2026 – 2050</span>
          </div>
          <p className="page-subtitle">
            Cash receipts vs fee coverage, revenue streams separation & collection rate audits
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }} className="no-print">
          <button className="btn btn-ghost btn-sm" onClick={fetchAnalytics} aria-label="Refresh data">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleExportCSV}>
            <Download size={14} />
            Export CSV
          </button>
          <button className="btn btn-primary btn-sm" onClick={handlePrint}>
            <Printer size={14} />
            Print Report
          </button>
        </div>
      </div>

      {/* ── Global Filter Bar ─────────────────────────────────────────────── */}
      <div className="card no-print" style={{ padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-5)', background: 'var(--color-bg-surface-elevated)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Filter size={15} style={{ color: 'var(--color-primary-light)' }} />
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Filters:</span>
            </div>

            {/* Year Selector: 2026 to 2050 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label htmlFor="analytics-year-select" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Year:</label>
              <select
                id="analytics-year-select"
                className="form-input"
                style={{ padding: '4px 10px', fontSize: 'var(--text-xs)', height: 32, minWidth: 90 }}
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              >
                {Array.from({ length: 25 }, (_, i) => 2026 + i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Month Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label htmlFor="analytics-month-select" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Detail Month:</label>
              <select
                id="analytics-month-select"
                className="form-input"
                style={{ padding: '4px 10px', fontSize: 'var(--text-xs)', height: 32, minWidth: 120 }}
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              >
                {monthNames.map((name, i) => (
                  <option key={i + 1} value={i + 1}>{name}</option>
                ))}
              </select>
            </div>

            {/* Chart Type Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--color-bg-surface)', padding: 2, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
              <button
                className={`btn btn-xs ${chartType === 'bar' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setChartType('bar')}
                style={{ height: 26, fontSize: '0.72rem', padding: '0 8px' }}
              >
                Bar Chart
              </button>
              <button
                className={`btn btn-xs ${chartType === 'line' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setChartType('line')}
                style={{ height: 26, fontSize: '0.72rem', padding: '0 8px' }}
              >
                Line Chart
              </button>
            </div>
          </div>

          {/* Custom Date Range Filter for actual collection transactions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Calendar size={13} style={{ color: 'var(--color-text-muted)' }} />
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Transaction Date:</span>
            <input
              type="date"
              className="form-input"
              style={{ padding: '4px 8px', fontSize: 'var(--text-xs)', height: 32 }}
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>to</span>
            <input
              type="date"
              className="form-input"
              style={{ padding: '4px 8px', fontSize: 'var(--text-xs)', height: 32 }}
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
            {(dateFrom || dateTo) && (
              <button
                className="btn btn-ghost btn-xs"
                onClick={() => { setDateFrom(''); setDateTo(''); }}
                style={{ fontSize: '0.7rem' }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Key Distinction Alert ─────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.1), rgba(124, 111, 205, 0.08))',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-3) var(--space-4)',
        marginBottom: 'var(--space-5)',
        display: 'flex', alignItems: 'center', gap: 'var(--space-3)'
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
        }}>
          <Layers size={17} />
        </div>
        <div style={{ fontSize: '0.8rem', lineHeight: 1.45, color: 'var(--color-text-secondary)' }}>
          <strong style={{ color: '#fff' }}>Revenue Categorization Integrity:</strong>{' '}
          <strong>Monthly Fee Collection</strong> is recognized revenue. <strong>Registration Fees</strong> are one-time admission dues. <strong>Refundable Locker Deposits</strong> are security deposits held as balance sheet liabilities and are never counted as library earnings.
        </div>
      </div>

      {/* ── Selected Month Focus Metrics ──────────────────────────────────── */}
      <div className="dashboard-stats-grid">
        <div className="stat-card" style={{ borderLeft: '3px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
              Cash Received ({selectedMonthName})
            </span>
            <DollarSign size={16} style={{ color: '#10b981' }} />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#10b981' }}>
            {formatCurrency(selectedMonthDetails.cashCollected || 0)}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-subtle)', marginTop: 4 }}>
            Transaction date in {selectedMonthName}
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '3px solid #7c6fcd' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
              Fee Coverage Allocated
            </span>
            <CheckCircle2 size={16} style={{ color: '#7c6fcd' }} />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            {formatCurrency(selectedMonthDetails.feeAllocated || 0)}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-subtle)', marginTop: 4 }}>
            Applied to {selectedMonthName} fee dues
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '3px solid #6366f1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
              Total Fees Due
            </span>
            <Clock size={16} style={{ color: '#6366f1' }} />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            {formatCurrency(selectedMonthDetails.feeDue || 0)}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-subtle)', marginTop: 4 }}>
            Owed by active students in this month
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '3px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
              Outstanding Balance
            </span>
            <AlertTriangle size={16} style={{ color: '#f59e0b' }} />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: (selectedMonthDetails.outstanding || 0) > 0 ? '#f59e0b' : '#34d399' }}>
            {formatCurrency(selectedMonthDetails.outstanding || 0)}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-subtle)', marginTop: 4 }}>
            {selectedMonthDetails.pendingCount || 0} students pending
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '3px solid #38bdf8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
              Collection Rate
            </span>
            <TrendingUp size={16} style={{ color: '#38bdf8' }} />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#38bdf8' }}>
            {selectedMonthDetails.collectionPercentage || 0}%
          </div>
          <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(100, selectedMonthDetails.collectionPercentage || 0)}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #38bdf8, #34d399)',
              borderRadius: 3
            }} />
          </div>
        </div>

        {customRange && (
          <div className="stat-card" style={{ borderLeft: '3px solid #ec4899' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                Custom Date Range Cash
              </span>
              <DollarSign size={16} style={{ color: '#ec4899' }} />
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ec4899' }}>
              {formatCurrency(customRange.totalCash || 0)}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-subtle)', marginTop: 4 }}>
              {customRange.count} transactions in range
            </div>
          </div>
        )}
      </div>

      {/* ── Main Interactive Recharts Chart ───────────────────────────────── */}
      <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
              Monthly Financial Trajectory ({selectedYear})
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
              Month-by-month cash receipts, allocated fee coverage, registration fees & refundable locker security deposits
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: '0.75rem' }}>
            <span style={{ color: '#10b981', fontWeight: 600 }}>● Cash Collection</span>
            <span style={{ color: '#7c6fcd', fontWeight: 600 }}>● Fee Coverage</span>
            <span style={{ color: '#a855f7', fontWeight: 600 }}>● Registration Fees</span>
            <span style={{ color: '#ec4899', fontWeight: 600 }}>● Locker Deposits</span>
          </div>
        </div>

        <div style={{ width: '100%', height: 340 }}>
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'bar' ? (
              <BarChart data={monthByMonth} margin={{ top: 10, right: 15, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="monthName" stroke="var(--color-text-subtle)" fontSize={11} tickLine={false} />
                <YAxis width={55} stroke="var(--color-text-subtle)" fontSize={11} tickLine={false} tickFormatter={formatAxisRupees} />
                <Tooltip content={<CustomAnalyticsTooltip />} />
                <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: 10 }} />
                <Bar dataKey="cashCollected" name="Cash Collection (Receipts)" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="feeAllocated" name="Monthly Fee Coverage" fill="#7c6fcd" radius={[3, 3, 0, 0]} />
                <Bar dataKey="regFees" name="Registration Fees" fill="#a855f7" radius={[3, 3, 0, 0]} />
                <Bar dataKey="lockerDeposits" name="Refundable Locker Deposits" fill="#ec4899" radius={[3, 3, 0, 0]} />
              </BarChart>
            ) : (
              <LineChart data={monthByMonth} margin={{ top: 10, right: 15, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="monthName" stroke="var(--color-text-subtle)" fontSize={11} tickLine={false} />
                <YAxis width={55} stroke="var(--color-text-subtle)" fontSize={11} tickLine={false} tickFormatter={formatAxisRupees} />
                <Tooltip content={<CustomAnalyticsTooltip />} />
                <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: 10 }} />
                <Line type="monotone" dataKey="cashCollected" name="Cash Collection (Receipts)" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="feeAllocated" name="Monthly Fee Coverage" stroke="#7c6fcd" strokeWidth={2.5} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="feeDue" name="Fee Dues" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Month-by-Month Detailed Accounting Table ──────────────────────── */}
      <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
              12-Month Accounting Breakdown ({selectedYear})
            </h3>
            <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
              Full financial reconciliation of cash collections, fee allocations, new admissions & student status trends
            </p>
          </div>
          <span className="badge badge-primary">{yearlyTotals.totalAdmissions || 0} New Admissions in {selectedYear}</span>
        </div>

        <div className="table-responsive">
          <table className="table" style={{ fontSize: '0.78rem' }}>
            <thead>
              <tr>
                <th>Month</th>
                <th style={{ textAlign: 'right' }}>Cash Collection</th>
                <th style={{ textAlign: 'right' }}>Fee Coverage</th>
                <th style={{ textAlign: 'right' }}>Fee Due</th>
                <th style={{ textAlign: 'right' }}>Outstanding</th>
                <th style={{ textAlign: 'center' }}>Rate (%)</th>
                <th style={{ textAlign: 'right' }}>Reg Fees</th>
                <th style={{ textAlign: 'right' }}>Locker Deposits</th>
                <th style={{ textAlign: 'center' }}>Admissions</th>
                <th style={{ textAlign: 'center' }}>Discont.</th>
              </tr>
            </thead>
            <tbody>
              {monthByMonth.map((m) => {
                const isSelected = m.monthNum === selectedMonth;
                return (
                  <tr
                    key={m.monthNum}
                    style={{
                      background: isSelected ? 'rgba(124, 111, 205, 0.12)' : undefined,
                      cursor: 'pointer',
                    }}
                    onClick={() => setSelectedMonth(m.monthNum)}
                    title="Click to view details for this month"
                  >
                    <td style={{ fontWeight: 600 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {isSelected && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary-light)' }} />}
                        {m.monthName} {selectedYear}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                      {formatCurrency(m.cashCollected)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#7c6fcd' }}>
                      {formatCurrency(m.feeAllocated)}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>
                      {formatCurrency(m.feeDue)}
                    </td>
                    <td style={{ textAlign: 'right', color: m.outstanding > 0 ? '#f59e0b' : '#34d399', fontWeight: 600 }}>
                      {formatCurrency(m.outstanding)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${m.collectionPercentage >= 80 ? 'badge-success' : m.collectionPercentage > 0 ? 'badge-primary' : 'badge-neutral'}`}>
                        {m.collectionPercentage}%
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', color: '#a855f7' }}>
                      {formatCurrency(m.regFees)}
                    </td>
                    <td style={{ textAlign: 'right', color: '#ec4899' }}>
                      {formatCurrency(m.lockerDeposits)}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 600, color: '#38bdf8' }}>
                      {m.newAdmissions > 0 ? `+${m.newAdmissions}` : '0'}
                    </td>
                    <td style={{ textAlign: 'center', color: m.discontinued > 0 ? '#ef4444' : 'var(--color-text-muted)' }}>
                      {m.discontinued > 0 ? `-${m.discontinued}` : '0'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--color-bg-surface-elevated)', fontWeight: 800, borderTop: '2px solid var(--color-border)' }}>
                <td>Yearly Total ({selectedYear})</td>
                <td style={{ textAlign: 'right', color: '#10b981' }}>{formatCurrency(yearlyTotals.totalCashCollected || 0)}</td>
                <td style={{ textAlign: 'right', color: '#7c6fcd' }}>{formatCurrency(yearlyTotals.totalFeeAllocated || 0)}</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(yearlyTotals.totalFeeDue || 0)}</td>
                <td style={{ textAlign: 'right', color: '#f59e0b' }}>{formatCurrency(yearlyTotals.totalOutstanding || 0)}</td>
                <td style={{ textAlign: 'center' }}>
                  <span className="badge badge-primary">{yearlyTotals.overallCollectionPercentage || 0}%</span>
                </td>
                <td style={{ textAlign: 'right', color: '#a855f7' }}>{formatCurrency(yearlyTotals.totalRegFees || 0)}</td>
                <td style={{ textAlign: 'right', color: '#ec4899' }}>{formatCurrency(yearlyTotals.totalLockerDeposits || 0)}</td>
                <td style={{ textAlign: 'center', color: '#38bdf8' }}>+{yearlyTotals.totalAdmissions || 0}</td>
                <td style={{ textAlign: 'center' }}>—</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
