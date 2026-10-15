// src/App.jsx
// ── Application Root ─────────────────────────────────────────────────────────
// Handles top-level routing: Login ↔ Authenticated shell.
// Protected pages are rendered inside the app shell.
// Role-based access is enforced both here (UX layer) and server-side.

import React, { useState, Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import LoginPage from './pages/LoginPage';
import Sidebar, { MobileNav } from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import Spinner from './components/ui/Spinner';
import './components/layout/Sidebar.css';

// Lazy-load pages for better initial load performance
// Lazy-load pages for better initial load performance
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const AdmissionPage = lazy(() => import('./pages/AdmissionPage'));
const StudentsPage = lazy(() => import('./pages/StudentsPage'));
const FeeUpdatePage = lazy(() => import('./pages/FeeUpdatePage'));
const FeeStatusPage = lazy(() => import('./pages/FeeStatusPage'));
const PaymentsPage = lazy(() => import('./pages/PaymentsPage'));
const MonthlyFeeAnalyticsPage = lazy(() => import('./pages/MonthlyFeeAnalyticsPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

// ── Page Fallback ────────────────────────────────────────────────────────────
function PageLoading() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '60vh', flexDirection: 'column', gap: 'var(--space-4)',
    }}>
      <Spinner size="lg" />
      <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
        Loading…
      </span>
    </div>
  );
}

// ── Initial Loading Screen ───────────────────────────────────────────────────
function InitialLoading() {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'var(--color-bg-base)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 'var(--space-5)',
    }}>
      <div style={{
        width: 64, height: 64,
        background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))',
        borderRadius: 'var(--radius-xl)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 28, boxShadow: '0 8px 32px rgba(124,111,205,0.5)',
        animation: 'float 3s ease-in-out infinite',
      }}>⚡</div>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 800,
          background: 'linear-gradient(135deg, var(--color-lavender), var(--color-primary-light))',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          letterSpacing: '0.05em', marginBottom: 'var(--space-2)',
        }}>ZENITH LIBRARY</div>
        <Spinner />
      </div>
    </div>
  );
}

// ── Access Denied ─────────────────────────────────────────────────────────────
function AccessDenied({ onGoBack }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '60vh', gap: 'var(--space-4)', textAlign: 'center',
    }}>
      <div style={{
        fontSize: 48, width: 80, height: 80, background: 'var(--color-danger-dim)',
        borderRadius: 'var(--radius-xl)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>🚫</div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 700 }}>
        Access Denied
      </h2>
      <p style={{ color: 'var(--color-text-muted)', maxWidth: 320 }}>
        You don't have permission to view this page. Contact the owner if you need access.
      </p>
      <button className="btn btn-primary" onClick={onGoBack}>Go to Dashboard</button>
    </div>
  );
}

// ── Authenticated App Shell ───────────────────────────────────────────────────
function AuthenticatedApp() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [navParams, setNavParams] = useState({});
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { isOwner, hasPermission } = useAuth();

  // Page-level permission checks (server also enforces these)
  function canViewPage(page) {
    if (page === 'users') return isOwner();
    if (page === 'admission') return hasPermission('students.create') || isOwner();
    if (page === 'students') return hasPermission('students.view') || isOwner();
    if (page === 'fee-update') return hasPermission('payments.record') || isOwner();
    if (page === 'fee-status') return hasPermission('reports.view') || hasPermission('payments.view') || isOwner();
    if (page === 'payments') return hasPermission('payments.view') || isOwner();
    if (page === 'analytics') return hasPermission('reports.view') || isOwner();
    if (page === 'reports') return hasPermission('reports.view') || isOwner();
    return true; // dashboard, settings
  }

  function navigate(page, params = {}) {
    setCurrentPage(page);
    setNavParams(params);
    setMobileNavOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderPage() {
    if (!canViewPage(currentPage)) {
      return <AccessDenied onGoBack={() => navigate('dashboard')} />;
    }
    switch (currentPage) {
      case 'dashboard':  return <DashboardPage onNavigate={navigate} />;
      case 'admission':  return <AdmissionPage onNavigate={navigate} />;
      case 'students':   return <StudentsPage onNavigate={navigate} initialParams={navParams} />;
      case 'fee-update': return <FeeUpdatePage onNavigate={navigate} initialParams={navParams} />;
      case 'fee-status': return <FeeStatusPage onNavigate={navigate} initialParams={navParams} />;
      case 'payments':   return <FeeUpdatePage onNavigate={navigate} initialParams={navParams} />;
      case 'analytics':  return <MonthlyFeeAnalyticsPage onNavigate={navigate} />;
      case 'reports':    return <ReportsPage onNavigate={navigate} />;
      case 'users':      return <UsersPage />;
      case 'settings':   return <SettingsPage />;
      default:           return <DashboardPage onNavigate={navigate} />;
    }
  }

  return (
    <div className="app-shell">
      {/* Desktop sidebar */}
      <Sidebar currentPage={currentPage} onNavigate={navigate} />

      {/* Mobile nav drawer */}
      <MobileNav
        currentPage={currentPage}
        onNavigate={navigate}
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />

      {/* Main content area */}
      <div className="main-content">
        <TopBar
          currentPage={currentPage}
          onMenuToggle={() => setMobileNavOpen((v) => !v)}
        />
        <main className="content-area" id="main-content" tabIndex={-1}>
          <Suspense fallback={<PageLoading />}>
            {renderPage()}
          </Suspense>
        </main>
      </div>
    </div>
  );
}

// ── App Gate — decides login vs shell ─────────────────────────────────────────
function AppGate() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <InitialLoading />;
  if (!isAuthenticated) return <LoginPage />;
  return <AuthenticatedApp />;
}

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppGate />
      </AuthProvider>
    </ToastProvider>
  );
}
