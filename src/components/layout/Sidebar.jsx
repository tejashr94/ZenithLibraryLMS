// src/components/layout/Sidebar.jsx
import React, { useState } from 'react';
import {
  LayoutDashboard, Users, CreditCard, BookOpen,
  BarChart3, Settings, LogOut, ChevronLeft, ChevronRight,
  Shield, Menu, X, UserPlus, CalendarCheck, TrendingUp
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const NAV_ITEMS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    permission: null,
  },
  {
    id: 'admission',
    label: 'New Admission',
    icon: UserPlus,
    permission: 'students.create',
  },
  {
    id: 'students',
    label: 'Student Records',
    icon: BookOpen,
    permission: 'students.view',
  },
  {
    id: 'fee-update',
    label: 'Fee Updation',
    icon: CreditCard,
    permission: 'payments.record',
  },
  {
    id: 'fee-status',
    label: 'Fee Status',
    icon: CalendarCheck,
    permission: 'reports.view',
  },
  {
    id: 'analytics',
    label: 'Monthly Fee Analytics',
    icon: TrendingUp,
    permission: 'reports.view',
  },
  {
    id: 'reports',
    label: 'Reports & Exports',
    icon: BarChart3,
    permission: 'reports.view',
  },
  {
    id: 'users',
    label: 'Manage Users',
    icon: Shield,
    ownerOnly: true,
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    permission: null,
  },
];

function NavItem({ item, currentPage, collapsed, onClick, hasPermission, isOwner }) {
  const Icon = item.icon;
  const active = currentPage === item.id;

  // Permission check
  if (item.ownerOnly && !isOwner()) return null;
  if (item.permission && !hasPermission(item.permission) && !isOwner()) return null;

  return (
    <li>
      <button
        className={`sidebar-nav-item ${active ? 'active' : ''}`}
        onClick={() => onClick(item.id)}
        title={collapsed ? item.label : undefined}
        aria-current={active ? 'page' : undefined}
        aria-label={item.label}
      >
        <Icon size={20} className="nav-icon" />
        {!collapsed && <span className="nav-label">{item.label}</span>}
        {active && !collapsed && (
          <span style={{
            marginLeft: 'auto',
            width: 6, height: 6,
            borderRadius: '50%',
            background: 'var(--color-primary-light)',
            flexShrink: 0,
          }} />
        )}
      </button>
    </li>
  );
}

// ── Mobile Drawer Overlay ────────────────────────────────────────────────────

export function MobileNav({ currentPage, onNavigate, isOpen, onClose }) {
  const { user, logout, hasPermission, isOwner } = useAuth();

  return (
    <>
      {isOpen && (
        <div
          className="dialog-overlay"
          onClick={onClose}
          style={{ zIndex: 200, alignItems: 'flex-start', justifyContent: 'flex-start' }}
        >
          <div
            className="sidebar sidebar-mobile"
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'relative', height: '100%', maxWidth: '80vw', width: 260 }}
          >
            <SidebarContent
              currentPage={currentPage}
              onNavigate={(page) => { onNavigate(page); onClose(); }}
              collapsed={false}
              user={user}
              logout={logout}
              hasPermission={hasPermission}
              isOwner={isOwner}
            />
          </div>
        </div>
      )}
    </>
  );
}

function SidebarContent({ currentPage, onNavigate, collapsed, user, logout, hasPermission, isOwner }) {
  return (
    <>
      {/* Brand */}
      <div className={`sidebar-brand ${collapsed ? 'collapsed' : ''}`}>
        <div className="brand-logo" aria-hidden="true">
          <span style={{ fontSize: collapsed ? 16 : 18 }}>⚡</span>
        </div>
        {!collapsed && (
          <div className="brand-text">
            <div className="brand-name">ZENITH</div>
            <div className="brand-sub">Library Management</div>
          </div>
        )}
      </div>

      <div className="sidebar-divider" />

      {/* Navigation */}
      <nav className="sidebar-nav" aria-label="Main navigation">
        <ul>
          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.id}
              item={item}
              currentPage={currentPage}
              collapsed={collapsed}
              onClick={onNavigate}
              hasPermission={hasPermission}
              isOwner={isOwner}
            />
          ))}
        </ul>
      </nav>

      <div style={{ flex: 1 }} />
      <div className="sidebar-divider" />

      {/* User info + Logout */}
      <div className={`sidebar-user ${collapsed ? 'collapsed' : ''}`}>
        <div className="user-avatar" aria-hidden="true">
          {user?.name?.[0]?.toUpperCase() || 'U'}
        </div>
        {!collapsed && (
          <div className="user-info">
            <div className="user-name">{user?.name || 'Unknown'}</div>
            <div className="user-role">{user?.role || 'User'}</div>
          </div>
        )}
        <button
          className="btn btn-ghost btn-sm logout-btn"
          onClick={logout}
          title="Logout"
          aria-label="Logout"
          style={{ marginLeft: collapsed ? 0 : 'auto', padding: 'var(--space-2)' }}
        >
          <LogOut size={16} />
        </button>
      </div>
    </>
  );
}

// ── Desktop Sidebar ──────────────────────────────────────────────────────────

export default function Sidebar({ currentPage, onNavigate }) {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout, hasPermission, isOwner } = useAuth();

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`} aria-label="Application sidebar">
      <SidebarContent
        currentPage={currentPage}
        onNavigate={onNavigate}
        collapsed={collapsed}
        user={user}
        logout={logout}
        hasPermission={hasPermission}
        isOwner={isOwner}
      />
      <button
        className="sidebar-collapse-btn"
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </aside>
  );
}
