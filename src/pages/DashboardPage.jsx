// src/pages/DashboardPage.jsx
// ── ZENITH LIBRARY MANAGEMENT SYSTEM — Unified Owner & Manager Dashboard ─────────
import React, { useEffect, useState, useCallback } from 'react';
import {
  Users, CreditCard, AlertCircle, RefreshCw,
  UserPlus, BookOpen, CalendarCheck, ArrowRight, ShieldCheck,
  TrendingUp, BarChart3, Clock, DollarSign, Wallet, Shield,
  CheckCircle2, AlertTriangle, Layers, Filter, Calendar
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { reportsApi } from '../services/api';
import { SkeletonDashboard } from '../components/ui/SkeletonLoader';
import EmptyState from '../components/ui/EmptyState';
import { formatCurrency, formatDate } from '../utils/formatters';
import './DashboardPage.css';

// ── Chart Colors & Palettes ──────────────────────────────────────────────────
const COLORS = ['#7c6fcd', '#38bdf8', '#34d399', '#f59e0b', '#ec4899', '#a78bfa'];

// ── Custom Tooltip ───────────────────────────────────────────────────────────
function CustomChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip" style={{
      background: 'rgba(18, 18, 42, 0.95)',
      backdropFilter: 'blur(8px)',
      border: '1px solid rgba(124, 111, 205, 0.3)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-3)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
    }}>
      <div style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 4 }}>
        {label}
      </div>
      {payload.map((p) => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: '0.8rem', marginTop: 3 }}>
          <span style={{ color: p.color, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
            {p.name}:
          </span>
          <span style={{ fontWeight: 600, color: '#fff' }}>
            {p.name.toLowerCase().includes('collection') || p.name.toLowerCase().includes('coverage') || p.name.toLowerCase().includes('amount') || p.name.toLowerCase().includes('fee')
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

// ── Stat Card Component ─────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, subValue, color = '#7c6fcd', tag, onClick }) {
  return (
    <div
      className="stat-card"
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'hidden',
        borderLeft: `3px solid ${color}`,
      }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="stat-card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div className="stat-icon" style={{ background: `${color}18`, color }}>
          <Icon size={20} />
        </div>
        {tag && (
          <span style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            padding: '2px 8px',
            borderRadius: '999px',
            background: `${color}20`,
            color: color,
            border: `1px solid ${color}40`,
          }}>
            {tag}
          </span>
        )}
      </div>
      <div className="stat-value" style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
        {value ?? '—'}
      </div>
      <div className="stat-label" style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 2, fontWeight: 500 }}>
        {label}
      </div>
      {subValue && (
        <div className="stat-sub" style={{ fontSize: '0.72rem', color: 'var(--color-text-subtle)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
          {subValue}
        </div>
      )}
    </div>
  );
}

// ── Action Card Component ───────────────────────────────────────────────────
function ActionCard({ title, subtitle, icon: Icon, color = '#7c6fcd', onClick, badge }) {
  return (
    <button
      className="manager-action-card"
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        textAlign: 'left',
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-4) var(--space-5)',
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        width: '100%',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = color;
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = `0 8px 24px -4px ${color}33`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-border)';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 8 }}>
        <div style={{
          width: 36, height: 36,
          borderRadius: 'var(--radius-lg)',
          background: `${color}18`,
          color: color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `1px solid ${color}33`,
        }}>
          <Icon size={18} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {badge && <span className="badge badge-primary">{badge}</span>}
          <ArrowRight size={15} style={{ color: 'var(--color-text-muted)' }} />
        </div>
      </div>
      <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 2 }}>
        {title}
      </h3>
      <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', lineHeight: 1.35, margin: 0 }}>
        {subtitle}
      </p>
    </button>
  );
}

// ── Main Dashboard Page ─────────────────────────────────────────────────────
export default function DashboardPage({ onNavigate = () => {} }) {
  const { token, user, isOwner } = useAuth();
  const toast = useToast();

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [ownerData, setOwnerData] = useState(null);
  const [managerData, setManagerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch Owner or Manager Dashboard data
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isOwner()) {
        const res = await reportsApi.ownerDashboard(token, {
          year: selectedYear,
          month: selectedMonth,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          statusFilter: statusFilter !== 'ALL' ? statusFilter : undefined,
        });
        setOwnerData(res);
      } else {
        const res = await reportsApi.dashboard(token);
        setManagerData(res.data);
      }
    } catch (err) {
      setError(err.message);
      toast.error(err.message, { title: 'Failed to load dashboard' });
    } finally {
      setLoading(false);
    }
  }, [token, isOwner, selectedYear, selectedMonth, dateFrom, dateTo, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (loading && !ownerData && !managerData) return <SkeletonDashboard />;

  if (error && !ownerData && !managerData) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Could not load dashboard"
        description={error}
        action={
          <button className="btn btn-primary" onClick={fetchDashboardData}>
            <RefreshCw size={16} /> Retry
          </button>
        }
      />
    );
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const selectedMonthName = monthNames[selectedMonth - 1];

  // ───────────────────────────────────────────────────────────────────────────
  // OWNER / ADMIN DASHBOARD VIEW
  // ───────────────────────────────────────────────────────────────────────────
  if (isOwner() && ownerData) {
    const { stats = {}, monthlyTrend = [], planDistribution = [], recentTransactions = [] } = ownerData;

    return (
      <div className="dashboard">
        {/* ── Page Header & Global Filters ──────────────────────────────── */}
        <div className="page-header" style={{ marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 className="page-title">Executive Library Overview</h1>
              <span className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <ShieldCheck size={12} /> Owner Admin
              </span>
            </div>
            <p className="page-subtitle">
              Financial health, actual cash collections, monthly fee coverage & student metrics
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <button className="btn btn-ghost btn-sm" onClick={fetchDashboardData} aria-label="Refresh dashboard data">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('analytics')}>
              <TrendingUp size={14} />
              Monthly Fee Analytics
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => onNavigate('reports')}>
              <BarChart3 size={14} />
              Reports & Exports
            </button>
          </div>
        </div>

        {/* ── Filter Toolbar ────────────────────────────────────────────── */}
        <div className="card" style={{ padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-5)', background: 'var(--color-bg-surface-elevated)' }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Filter size={15} style={{ color: 'var(--color-primary-light)' }} />
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Filters:</span>
              </div>

              {/* Year Selector (2026 - 2050) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label htmlFor="owner-year-select" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Year:</label>
                <select
                  id="owner-year-select"
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
                <label htmlFor="owner-month-select" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Month:</label>
                <select
                  id="owner-month-select"
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

              {/* Status Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label htmlFor="owner-status-select" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Status:</label>
                <select
                  id="owner-status-select"
                  className="form-input"
                  style={{ padding: '4px 10px', fontSize: 'var(--text-xs)', height: 32 }}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">All Students</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="INACTIVE">Non-Active Only</option>
                </select>
              </div>
            </div>

            {/* Custom Date Range Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={13} style={{ color: 'var(--color-text-muted)' }} />
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Date Range:</span>
                <input
                  type="date"
                  className="form-input"
                  style={{ padding: '4px 8px', fontSize: 'var(--text-xs)', height: 32 }}
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  placeholder="From"
                />
                <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>to</span>
                <input
                  type="date"
                  className="form-input"
                  style={{ padding: '4px 8px', fontSize: 'var(--text-xs)', height: 32 }}
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  placeholder="To"
                />
              </div>
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

        {/* ── Financial Distinction Notice Banner ──────────────────────── */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(124, 111, 205, 0.12), rgba(56, 189, 248, 0.08))',
          border: '1px solid rgba(124, 111, 205, 0.25)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-3) var(--space-4)',
          marginBottom: 'var(--space-5)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'var(--color-primary-dim)', color: 'var(--color-primary-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <Layers size={18} />
          </div>
          <div style={{ flex: 1, fontSize: '0.8rem', lineHeight: 1.45 }}>
            <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
              Core Financial Accounting Rule:
            </span>{' '}
            <span style={{ color: 'var(--color-text-secondary)' }}>
              <strong>Cash Collection</strong> (actual receipts received on transaction dates) is accounted strictly separately from{' '}
              <strong>Monthly Fee Coverage</strong> (fee allocations mapped to each ledger month). Advance payments cover future months without inflating future cash collection records.
            </span>
          </div>
        </div>

        {/* ── The 11 Core Summary Cards ─────────────────────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-6)',
        }}>
          {/* 1. Total Active Students */}
          <StatCard
            icon={Users}
            label="Total Active Students"
            value={stats.totalActiveStudents}
            subValue="Currently enrolled library members"
            color="#34d399"
            tag="Enrolled"
            onClick={() => onNavigate('students', { status: 'ACTIVE' })}
          />

          {/* 2. Total Non-Active Students */}
          <StatCard
            icon={Users}
            label="Total Non-Active Students"
            value={stats.totalNonActiveStudents}
            subValue="Discontinued / withdrawn members"
            color="#94a3b8"
            tag="Discontinued"
            onClick={() => onNavigate('students', { status: 'INACTIVE' })}
          />

          {/* 3. New Admissions This Month */}
          <StatCard
            icon={UserPlus}
            label={`New Admissions (${selectedMonthName})`}
            value={stats.newAdmissionsMonth}
            subValue={`Enrolled in ${selectedMonthName} ${selectedYear}`}
            color="#38bdf8"
            tag="Admissions"
            onClick={() => onNavigate('reports', { report: 'NEW_ADMISSIONS', year: selectedYear, month: selectedMonth })}
          />

          {/* 4. New Admissions This Year */}
          <StatCard
            icon={UserPlus}
            label={`New Admissions (${selectedYear})`}
            value={stats.newAdmissionsYear}
            subValue={`Cumulative for calendar year ${selectedYear}`}
            color="#7c6fcd"
            tag="Annual"
            onClick={() => onNavigate('reports', { report: 'NEW_ADMISSIONS', year: selectedYear })}
          />

          {/* 5. Actual Cash Collected This Month */}
          <StatCard
            icon={DollarSign}
            label={`Cash Collected (${selectedMonthName})`}
            value={formatCurrency(stats.actualCashCollectedMonth)}
            subValue={`Real cash received in ${selectedMonthName} ${selectedYear}`}
            color="#10b981"
            tag="Cash Flow"
            onClick={() => onNavigate('analytics', { year: selectedYear, month: selectedMonth })}
          />

          {/* 6. Actual Cash Collected This Year */}
          <StatCard
            icon={Wallet}
            label={`Cash Collected (${selectedYear})`}
            value={formatCurrency(stats.actualCashCollectedYear)}
            subValue={`Total real cash received in ${selectedYear}`}
            color="#059669"
            tag="Annual Cash"
            onClick={() => onNavigate('analytics', { year: selectedYear })}
          />

          {/* 7. Monthly Fee Due For Selected Month */}
          <StatCard
            icon={Clock}
            label={`Monthly Fees Due (${selectedMonthName})`}
            value={formatCurrency(stats.monthlyFeeDue)}
            subValue={`Total monthly rate of active students`}
            color="#6366f1"
            tag="Expected"
            onClick={() => onNavigate('fee-status', { year: selectedYear, month: selectedMonth })}
          />

          {/* 8. Outstanding Fee Balances */}
          <StatCard
            icon={AlertTriangle}
            label={`Outstanding Dues (${selectedMonthName})`}
            value={formatCurrency(stats.outstandingFeeBalances)}
            subValue={`${stats.pendingInMonthCount || 0} students pending / partial`}
            color="#f59e0b"
            tag={stats.outstandingFeeBalances > 0 ? 'Pending' : 'Clear'}
            onClick={() => onNavigate('fee-status', { year: selectedYear, month: selectedMonth, status: 'PENDING' })}
          />

          {/* 9. Registration Fees Collected */}
          <StatCard
            icon={CreditCard}
            label="Registration Fees Collected"
            value={formatCurrency(stats.registrationFeesCollected)}
            subValue="Non-refundable one-time admission fees"
            color="#a855f7"
            tag="One-Time"
          />

          {/* 10. Refundable Locker Deposits Held */}
          <StatCard
            icon={Shield}
            label="Refundable Locker Deposits"
            value={formatCurrency(stats.refundableLockerDepositsHeld)}
            subValue="Security deposit liability (Not operational income)"
            color="#ec4899"
            tag="Liability"
          />

          {/* 11. Students Who Paid In Advance */}
          <StatCard
            icon={CheckCircle2}
            label="Advance Paid Students"
            value={stats.advancePaidStudentsCount}
            subValue={`Covered beyond ${selectedMonthName} ${selectedYear}`}
            color="#06b6d4"
            tag="Prepaid"
            onClick={() => onNavigate('reports', { report: 'ADVANCE_PAYMENTS' })}
          />

          {/* Custom Date Range Result if active */}
          {stats.customRangeCollected !== null && (
            <StatCard
              icon={Calendar}
              label="Custom Date Range Cash"
              value={formatCurrency(stats.customRangeCollected)}
              subValue={`${dateFrom} to ${dateTo}`}
              color="#d946ef"
              tag="Custom Range"
            />
          )}
        </div>

        {/* ── Visual Analytics Section: Trends & Distribution ─────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}>
          {/* Chart 1: Cash Collection vs Fee Coverage vs Admissions */}
          <div className="card" style={{ padding: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
              <div>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
                  Cash Collections vs Monthly Fee Coverage ({selectedYear})
                </h3>
                <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                  Comparing money received on date vs monthly fee allocation across all 12 months
                </p>
              </div>
              <span className="badge badge-primary">{selectedYear}</span>
            </div>

            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyTrend} margin={{ top: 10, right: 15, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="coverageGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7c6fcd" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#7c6fcd" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="month" stroke="var(--color-text-subtle)" fontSize={11} tickLine={false} />
                  <YAxis width={55} stroke="var(--color-text-subtle)" fontSize={11} tickLine={false} tickFormatter={formatAxisRupees} />
                  <Tooltip content={<CustomChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: 8 }} />
                  <Area
                    type="monotone"
                    dataKey="cashCollection"
                    name="Cash Collection (Receipt Date)"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#cashGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="feeCoverage"
                    name="Fee Coverage (Ledger Allocated)"
                    stroke="#7c6fcd"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#coverageGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Slot/Plan Distribution */}
          <div className="card" style={{ padding: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
              <div>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
                  Active Student Plan Distribution
                </h3>
                <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                  Distribution of currently enrolled active students across shifts and slots
                </p>
              </div>
              <span className="badge badge-success">{stats.totalActiveStudents} Active</span>
            </div>

            {planDistribution.length === 0 ? (
              <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
                No active students found
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', height: 280, gap: 'var(--space-3)' }}>
                <div style={{ width: '55%', height: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={planDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={4}
                        dataKey="count"
                        nameKey="name"
                      >
                        {planDistribution.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ width: '45%', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 10 }}>
                  {planDistribution.map((p, idx) => (
                    <div key={p.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[idx % COLORS.length], flexShrink: 0 }} />
                        <span style={{ color: 'var(--color-text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={p.name}>
                          {p.name}
                        </span>
                      </div>
                      <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
                        {p.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Management Quick Actions ─────────────────────────────────── */}
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <h2 style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-primary-light)', fontWeight: 700, marginBottom: 'var(--space-3)' }}>
            Administrative Workflows
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--space-3)',
          }}>
            <ActionCard
              title="Add New Admission"
              subtitle="Register new student & generate ID"
              icon={UserPlus}
              color="#38bdf8"
              onClick={() => onNavigate('admission')}
            />
            <ActionCard
              title="Monthly Fee Updation"
              subtitle="Collect fee payment & issue receipt"
              icon={CreditCard}
              color="#34d399"
              onClick={() => onNavigate('fee-update')}
            />
            <ActionCard
              title="Student Admission Records"
              subtitle="Search, edit, filter & student profile"
              icon={BookOpen}
              color="#7c6fcd"
              onClick={() => onNavigate('students')}
            />
            <ActionCard
              title="Fee Status Matrix"
              subtitle="Month-wise paid & defaulter tracking"
              icon={CalendarCheck}
              color="#f59e0b"
              onClick={() => onNavigate('fee-status')}
            />
            <ActionCard
              title="Monthly Fee Analytics"
              subtitle="12-Month cash vs coverage graphs"
              icon={TrendingUp}
              color="#ec4899"
              onClick={() => onNavigate('analytics')}
            />
            <ActionCard
              title="Reports & Exports"
              subtitle="CSV exports & professional printouts"
              icon={BarChart3}
              color="#a78bfa"
              onClick={() => onNavigate('reports')}
            />
            <ActionCard
              title="Manage User Accounts"
              subtitle="Manager & Owner access controls"
              icon={Shield}
              color="#ef4444"
              onClick={() => onNavigate('users')}
            />
          </div>
        </div>

        {/* ── Recent Transactions Table ────────────────────────────────── */}
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
                Recent Cash Collections
              </h3>
              <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                Latest verified payment transactions recorded in the library ledger
              </p>
            </div>
            <button className="btn btn-ghost btn-xs" onClick={() => onNavigate('reports', { report: 'PAYMENT_TRANSACTIONS' })}>
              View All Payments <ArrowRight size={12} />
            </button>
          </div>

          {recentTransactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-5)', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
              No payments recorded yet.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table" style={{ fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th>Receipt #</th>
                    <th>Date</th>
                    <th>Student Name</th>
                    <th>Registration #</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Recorded By</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map((p) => (
                    <tr key={p.paymentId || p.receiptNumber}>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-primary-light)' }}>
                          {p.receiptNumber}
                        </span>
                      </td>
                      <td>{formatDate(p.paymentDate || p.createdAt)}</td>
                      <td style={{ fontWeight: 600 }}>{p.studentName}</td>
                      <td>
                        <span className="badge badge-neutral" style={{ fontFamily: 'var(--font-mono)' }}>
                          {p.registrationNumber}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: '#34d399' }}>
                        {formatCurrency(p.amount)}
                      </td>
                      <td>
                        <span className="badge badge-primary">{p.paymentMethod || 'CASH'}</span>
                      </td>
                      <td style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                        {p.enteredBy || 'System'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MANAGER DASHBOARD VIEW (Streamlined for Branch Operation)
  // ───────────────────────────────────────────────────────────────────────────
  const { stats = {}, monthly = [], recentPayments = [] } = managerData || {};
  const currentMonthLabel = new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <div className="dashboard">
      <div className="page-header" style={{ marginBottom: 'var(--space-4)' }}>
        <div>
          <h1 className="page-title">
            Welcome back, {user?.name || 'Manager'}
          </h1>
          <p className="page-subtitle">
            Zenith Library Branch Dashboard • {currentMonthLabel}
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={fetchDashboardData} aria-label="Refresh dashboard data">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh Data
        </button>
      </div>

      {/* Manager Main Action Cards */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-primary-light)', fontWeight: 700, marginBottom: 'var(--space-3)' }}>
          Manager Operations
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--space-3)',
        }}>
          <ActionCard
            title="1. Add New Admission"
            subtitle="Admit student, assign slot & generate registration ID"
            icon={UserPlus}
            color="#38bdf8"
            onClick={() => onNavigate('admission')}
          />
          <ActionCard
            title="2. Monthly Fee Updation"
            subtitle="Record student monthly fee, issue receipts & handle advances"
            icon={CreditCard}
            color="#34d399"
            onClick={() => onNavigate('fee-update')}
          />
          <ActionCard
            title="3. Student Admission Records"
            subtitle="Search, filter, edit & view student admission profile"
            icon={BookOpen}
            color="#7c6fcd"
            onClick={() => onNavigate('students')}
          />
          <ActionCard
            title="4. Fee Status"
            subtitle="Month-wise fee matrix: Paid, Partially Paid & Defaulters"
            icon={CalendarCheck}
            color="#f59e0b"
            onClick={() => onNavigate('fee-status')}
          />
          <ActionCard
            title="5. Student Active / Non-active"
            subtitle="Manage discontinues, reactivations & attendance status"
            icon={Users}
            color="#ec4899"
            onClick={() => onNavigate('students')}
          />
        </div>
      </div>

      {/* Manager Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 'var(--space-3)',
        marginBottom: 'var(--space-6)',
      }}>
        <StatCard
          icon={Users}
          label="Active Students"
          value={stats.activeStudents ?? '—'}
          subValue="Currently enrolled library members"
          color="#34d399"
          onClick={() => onNavigate('students', { status: 'ACTIVE' })}
        />
        <StatCard
          icon={UserPlus}
          label="New Admissions This Month"
          value={stats.newAdmissions ?? '—'}
          subValue="Students admitted this month"
          color="#38bdf8"
          onClick={() => onNavigate('students')}
        />
        <StatCard
          icon={CreditCard}
          label="Fees Collected This Month"
          value={formatCurrency(stats.monthlyCollection ?? 0)}
          subValue={`${stats.paymentsThisMonth ?? 0} payments recorded`}
          color="#7c6fcd"
          onClick={() => onNavigate('fee-status')}
        />
        <StatCard
          icon={AlertCircle}
          label="Pending Student Fees"
          value={formatCurrency(stats.pendingStudentFees ?? 0)}
          subValue={`${stats.defaulters ?? 0} students with pending dues`}
          color="#f59e0b"
          onClick={() => onNavigate('fee-status')}
        />
      </div>

      {/* 6-Month Collection Trend */}
      <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 var(--space-3)', color: 'var(--color-text-primary)' }}>
          Monthly Collections Overview
        </h3>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ top: 10, right: 15, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="month" stroke="var(--color-text-subtle)" fontSize={11} tickLine={false} />
              <YAxis width={55} stroke="var(--color-text-subtle)" fontSize={11} tickLine={false} tickFormatter={formatAxisRupees} />
              <Tooltip content={<CustomChartTooltip />} />
              <Bar dataKey="amount" name="Collection Amount" fill="#7c6fcd" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
