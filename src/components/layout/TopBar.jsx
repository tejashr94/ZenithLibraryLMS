// src/components/layout/TopBar.jsx
import React from 'react';
import { Menu, Bell, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './TopBar.css';

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  students: 'Students',
  payments: 'Payments',
  reports: 'Reports & Analytics',
  users: 'User Accounts',
  settings: 'Settings',
};

export default function TopBar({ currentPage, onMenuToggle }) {
  const { user } = useAuth();
  const title = PAGE_TITLES[currentPage] || 'Zenith Library';

  return (
    <header className="topbar" role="banner">
      {/* Mobile menu toggle */}
      <button
        className="topbar-menu-btn btn btn-ghost btn-sm"
        onClick={onMenuToggle}
        aria-label="Toggle navigation menu"
        id="menu-toggle-btn"
      >
        <Menu size={20} />
      </button>

      {/* Page title */}
      <div className="topbar-title">
        <h1>{title}</h1>
      </div>

      <div className="topbar-actions">
        {/* Notification bell — future feature slot */}
        <button className="topbar-icon-btn" aria-label="Notifications" title="Notifications (coming soon)">
          <Bell size={18} />
        </button>

        {/* User badge */}
        <div className="topbar-user" aria-label={`Logged in as ${user?.name}`}>
          <div className="topbar-avatar">{user?.name?.[0]?.toUpperCase() || 'U'}</div>
          <div className="topbar-user-info">
            <span className="topbar-user-name">{user?.name}</span>
            <span className="topbar-user-role">{user?.role}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
