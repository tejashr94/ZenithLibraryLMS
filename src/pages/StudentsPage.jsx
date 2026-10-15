// src/pages/StudentsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, Search, Filter, Plus, Edit2, Eye, EyeOff,
  UserX, UserCheck, RefreshCw, CreditCard, AlertCircle,
  Calendar, Phone, Home, CheckCircle, FileText, ChevronRight, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { studentsApi } from '../services/api';
import EmptyState from '../components/ui/EmptyState';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { formatCurrency, formatDate } from '../utils/formatters';

const SLOT_PLANS = [
  'All Plans',
  'Full Day (6 AM - 10 PM)',
  'Morning (6 AM - 2 PM)',
  'Evening (2 PM - 10 PM)',
  'Afternoon (11 AM - 6 PM)',
  'Night Owl (10 PM - 6 AM)',
];

export default function StudentsPage({ onNavigate = () => {}, initialParams = {} }) {
  const { token, hasPermission, isOwner } = useAuth();
  const toast = useToast();

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('all'); // all | name | reg | phone | aadhaar
  const [statusFilter, setStatusFilter] = useState(initialParams?.filter === 'inactive' ? 'INACTIVE' : 'ALL');
  const [slotFilter, setSlotFilter] = useState('All Plans');

  // Selected student for Profile View / Edit / Status
  const [selectedStudentReg, setSelectedStudentReg] = useState(initialParams?.studentReg || null);
  const [profileData, setProfileData] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(initialParams?.tab || 'profile'); // profile | fee-history | ledger | status

  // Aadhaar unmask state
  const [unmaskAadhaar, setUnmaskAadhaar] = useState(false);

  // Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Status Action State (Discontinue / Reactivate)
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [discontinueReason, setDiscontinueReason] = useState('');
  const [actionDate, setActionDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Fetch student list
  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const filters = {};
      if (statusFilter !== 'ALL') filters.status = statusFilter;
      if (slotFilter !== 'All Plans') filters.slotPlan = slotFilter;

      let res;
      if (searchQuery.trim()) {
        res = await studentsApi.search(token, searchQuery.trim(), searchType);
        if (statusFilter !== 'ALL') {
          res.students = res.students.filter((s) => s.status === statusFilter);
        }
        if (slotFilter !== 'All Plans') {
          res.students = res.students.filter((s) => s.slotPlan === slotFilter);
        }
      } else {
        res = await studentsApi.list(token, filters);
      }
      setStudents(res.students || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load students.');
    } finally {
      setLoading(false);
    }
  }, [token, searchQuery, searchType, statusFilter, slotFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // Fetch detailed profile when a student is selected
  const fetchProfile = useCallback(async (regNum) => {
    if (!regNum) {
      setProfileData(null);
      return;
    }
    setProfileLoading(true);
    try {
      const res = await studentsApi.getProfile(token, regNum);
      setProfileData(res);
    } catch (err) {
      toast.error(err.message || 'Failed to load student profile.');
      setSelectedStudentReg(null);
    } finally {
      setProfileLoading(false);
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedStudentReg) {
      fetchProfile(selectedStudentReg);
    }
  }, [selectedStudentReg, fetchProfile]);

  // Handle Edit Save
  async function handleEditSave(e) {
    e.preventDefault();
    if (!editFormData.studentName?.trim()) {
      toast.error("Student name cannot be empty");
      return;
    }
    setEditSubmitting(true);
    try {
      await studentsApi.update(token, selectedStudentReg, {
        studentName: editFormData.studentName.trim(),
        fatherName: editFormData.fatherName?.trim() || '',
        phone: editFormData.phone?.replace(/\D/g, '') || '',
        address: editFormData.address?.trim() || '',
        slotPlan: editFormData.slotPlan,
        monthlyFee: parseFloat(editFormData.monthlyFee) || 0,
        notes: editFormData.notes?.trim() || '',
      });
      toast.success('Student details updated successfully.');
      setEditModalOpen(false);
      fetchProfile(selectedStudentReg);
      fetchStudents();
    } catch (err) {
      toast.error(err.message || 'Failed to update student.');
    } finally {
      setEditSubmitting(false);
    }
  }

  // Handle Discontinue
  async function handleDiscontinue() {
    if (!discontinueReason.trim()) {
      toast.error('Please specify a reason for discontinuation.');
      return;
    }
    setStatusSubmitting(true);
    try {
      await studentsApi.discontinue(token, selectedStudentReg, discontinueReason, actionDate);
      toast.success(`Student ${selectedStudentReg} marked as inactive.`);
      fetchProfile(selectedStudentReg);
      fetchStudents();
    } catch (err) {
      toast.error(err.message || 'Failed to discontinue student.');
    } finally {
      setStatusSubmitting(false);
    }
  }

  // Handle Reactivate
  async function handleReactivate() {
    setStatusSubmitting(true);
    try {
      await studentsApi.reactivate(token, selectedStudentReg, actionDate);
      toast.success(`Student ${selectedStudentReg} reactivated successfully.`);
      fetchProfile(selectedStudentReg);
      fetchStudents();
    } catch (err) {
      toast.error(err.message || 'Failed to reactivate student.');
    } finally {
      setStatusSubmitting(false);
    }
  }

  return (
    <div className="students-page">
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Student Admission Records</h1>
          <p className="page-subtitle">
            Searchable student directory, monthly ledger history, and status management
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="btn btn-ghost btn-sm" onClick={fetchStudents} aria-label="Refresh student list">
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            className="btn btn-primary"
            onClick={() => onNavigate('admission')}
            id="admit-new-student-btn"
          >
            <Plus size={16} /> New Admission
          </button>
        </div>
      </div>

      {/* ── Search & Filter Controls ────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 'var(--space-5)', padding: 'var(--space-4)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center' }}>
          {/* Search Input */}
          <div style={{ position: 'relative', flex: '1 1 260px' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: 36 }}
              placeholder="Search by Name, Reg #, Phone, or Aadhaar…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Search Method Type */}
          <div style={{ width: 140 }}>
            <select
              className="form-input"
              value={searchType}
              onChange={(e) => setSearchType(e.target.value)}
              aria-label="Search filter field"
            >
              <option value="all">All Fields</option>
              <option value="name">Name</option>
              <option value="reg">Reg Number</option>
              <option value="phone">Phone</option>
              <option value="aadhaar">Aadhaar</option>
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ width: 140 }}>
            <select
              className="form-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by student status"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </select>
          </div>

          {/* Slot Filter */}
          <div style={{ width: 170 }}>
            <select
              className="form-input"
              value={slotFilter}
              onChange={(e) => setSlotFilter(e.target.value)}
              aria-label="Filter by slot plan"
            >
              {SLOT_PLANS.map((plan) => (
                <option key={plan} value={plan}>{plan}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Student List Table / Cards ───────────────────────────────── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
            Enrolled Students ({students.length})
          </h2>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            Click any student row to view full profile & monthly ledger
          </span>
        </div>

        {loading ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <RefreshCw size={24} className="spin-icon" style={{ marginBottom: 'var(--space-2)' }} />
            <p>Loading student directory…</p>
          </div>
        ) : students.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No students found"
            description="No student matches your current search criteria or filter."
            action={
              <button className="btn btn-secondary btn-sm" onClick={() => { setSearchQuery(''); setStatusFilter('ALL'); setSlotFilter('All Plans'); }}>
                Clear Filters
              </button>
            }
          />
        ) : (
          <div className="table-wrapper">
            <table className="table" aria-label="Student directory">
              <thead>
                <tr>
                  <th>Reg #</th>
                  <th>Student Name</th>
                  <th>Father's Name</th>
                  <th>Phone Number</th>
                  <th>Slot / Plan</th>
                  <th>Monthly Fee</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => {
                  const isActive = s.status === 'ACTIVE';
                  const isSelected = selectedStudentReg === s.registrationNumber;

                  return (
                    <tr
                      key={s.registrationNumber}
                      onClick={() => setSelectedStudentReg(s.registrationNumber)}
                      style={{
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(124, 111, 205, 0.12)' : undefined,
                      }}
                    >
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-primary-light)' }}>
                          {s.registrationNumber}
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: 'var(--color-text-primary)' }}>{s.studentName}</strong>
                      </td>
                      <td style={{ color: 'var(--color-text-secondary)' }}>{s.fatherName || '—'}</td>
                      <td>
                        <span style={{ color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Phone size={12} style={{ color: 'var(--color-text-muted)' }} />
                          {s.phone}
                        </span>
                      </td>
                      <td>
                        <span className="badge" style={{ background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', fontSize: 'var(--text-xs)' }}>
                          {s.slotPlan}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: 'var(--color-lime)', fontWeight: 600 }}>
                          {formatCurrency(s.monthlyFee)}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${isActive ? 'badge-success' : 'badge-danger'}`}>
                          {s.status}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedStudentReg(s.registrationNumber);
                          }}
                          style={{ padding: '4px 8px' }}
                        >
                          View <ChevronRight size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Student Profile Modal / Drawer ───────────────────────────── */}
      {selectedStudentReg && (
        <div
          className="dialog-overlay"
          onClick={() => setSelectedStudentReg(null)}
          style={{ zIndex: 120 }}
        >
          <div
            className="dialog-content card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 840, width: '95vw', maxHeight: '90vh', overflowY: 'auto', padding: 0 }}
          >
            {/* Modal Header */}
            <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', color: 'var(--color-primary-light)', fontWeight: 700 }}>
                  {profileData?.student?.registrationNumber || selectedStudentReg}
                </span>
                <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, margin: '2px 0 0', color: 'var(--color-text-primary)' }}>
                  {profileData?.student?.studentName || 'Student Profile'}
                </h2>
              </div>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setSelectedStudentReg(null)}
                aria-label="Close profile"
              >
                <X size={20} />
              </button>
            </div>

            {profileLoading ? (
              <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
                <RefreshCw size={24} className="spin-icon" style={{ marginBottom: 'var(--space-2)' }} />
                <p>Loading full profile & monthly ledger…</p>
              </div>
            ) : profileData ? (
              <div>
                {/* Profile Subheader & Summary Pills */}
                <div style={{ padding: 'var(--space-4) var(--space-5)', background: 'var(--color-bg-base)', borderBottom: '1px solid var(--color-border)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                    <div style={{ background: 'var(--color-bg-surface)', padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', display: 'block' }}>Fee Rate</span>
                      <strong style={{ color: 'var(--color-lime)' }}>{formatCurrency(profileData.student.monthlyFee)}/mo</strong>
                    </div>
                    <div style={{ background: 'var(--color-bg-surface)', padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', display: 'block' }}>Paid Through</span>
                      <strong style={{ color: 'var(--color-primary-light)' }}>{profileData.summary?.paidThrough || 'No advance'}</strong>
                    </div>
                    <div style={{ background: 'var(--color-bg-surface)', padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', display: 'block' }}>Pending Dues</span>
                      <strong style={{ color: profileData.summary?.outstandingDues > 0 ? 'var(--color-danger)' : 'var(--color-lime)' }}>
                        {formatCurrency(profileData.summary?.outstandingDues || 0)}
                      </strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setEditFormData({ ...profileData.student });
                        setEditModalOpen(true);
                      }}
                    >
                      <Edit2 size={14} /> Edit Info
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => onNavigate('fee-update', { studentReg: profileData.student.registrationNumber })}
                    >
                      <CreditCard size={14} /> Record Payment
                    </button>
                  </div>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', padding: '0 var(--space-5)', background: 'var(--color-bg-surface)' }}>
                  <button
                    className={`btn btn-ghost ${activeTab === 'profile' ? 'active' : ''}`}
                    onClick={() => setActiveTab('profile')}
                    style={{
                      borderRadius: 0,
                      borderBottom: activeTab === 'profile' ? '2px solid var(--color-primary-light)' : '2px solid transparent',
                      color: activeTab === 'profile' ? 'var(--color-primary-light)' : 'var(--color-text-muted)',
                      padding: 'var(--space-3) var(--space-4)',
                    }}
                  >
                    1. Profile Details
                  </button>
                  <button
                    className={`btn btn-ghost ${activeTab === 'fee-history' ? 'active' : ''}`}
                    onClick={() => setActiveTab('fee-history')}
                    style={{
                      borderRadius: 0,
                      borderBottom: activeTab === 'fee-history' ? '2px solid var(--color-primary-light)' : '2px solid transparent',
                      color: activeTab === 'fee-history' ? 'var(--color-primary-light)' : 'var(--color-text-muted)',
                      padding: 'var(--space-3) var(--space-4)',
                    }}
                  >
                    2. Payment History ({profileData.payments?.length || 0})
                  </button>
                  <button
                    className={`btn btn-ghost ${activeTab === 'ledger' ? 'active' : ''}`}
                    onClick={() => setActiveTab('ledger')}
                    style={{
                      borderRadius: 0,
                      borderBottom: activeTab === 'ledger' ? '2px solid var(--color-primary-light)' : '2px solid transparent',
                      color: activeTab === 'ledger' ? 'var(--color-primary-light)' : 'var(--color-text-muted)',
                      padding: 'var(--space-3) var(--space-4)',
                    }}
                  >
                    3. Monthly Ledger ({profileData.ledger?.length || 0})
                  </button>
                  <button
                    className={`btn btn-ghost ${activeTab === 'status' ? 'active' : ''}`}
                    onClick={() => setActiveTab('status')}
                    style={{
                      borderRadius: 0,
                      borderBottom: activeTab === 'status' ? '2px solid var(--color-primary-light)' : '2px solid transparent',
                      color: activeTab === 'status' ? 'var(--color-primary-light)' : 'var(--color-text-muted)',
                      padding: 'var(--space-3) var(--space-4)',
                    }}
                  >
                    4. Status & Continuation
                  </button>
                </div>

                {/* Tab Content */}
                <div style={{ padding: 'var(--space-5)' }}>
                  {/* TAB 1: Profile Details */}
                  {activeTab === 'profile' && (
                    <div className="form-grid-responsive">
                      <div>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Father's Name</span>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{profileData.student.fatherName || '—'}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Mobile Phone</span>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{profileData.student.phone}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Aadhaar Number</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          <span>{unmaskAadhaar ? (profileData.student.aadhaar || profileData.student.aadhaarMasked) : profileData.student.aadhaarMasked}</span>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '2px 6px' }}
                            onClick={() => setUnmaskAadhaar(!unmaskAadhaar)}
                            title={unmaskAadhaar ? 'Hide Aadhaar' : 'Reveal Aadhaar'}
                          >
                            {unmaskAadhaar ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Admission Date</span>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{formatDate(profileData.student.admissionDate)}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Slot / Study Plan</span>
                        <div style={{ fontWeight: 600, color: 'var(--color-accent-teal)' }}>{profileData.student.slotPlan}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Registration Fee (One-Time)</span>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{formatCurrency(profileData.student.registrationFee)}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Locker Deposit (Refundable Liability)</span>
                        <div style={{ fontWeight: 600, color: 'var(--color-accent-amber)' }}>{formatCurrency(profileData.student.lockerCharge)}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Current Status</span>
                        <div>
                          <span className={`badge ${profileData.student.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`}>
                            {profileData.student.status}
                          </span>
                        </div>
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Home Address</span>
                        <div style={{ color: 'var(--color-text-secondary)', marginTop: 2 }}>{profileData.student.address || '—'}</div>
                      </div>
                      {profileData.student.notes && (
                        <div style={{ gridColumn: '1 / -1', background: 'var(--color-bg-base)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', display: 'block', marginBottom: 2 }}>Notes / Audit History</span>
                          <div style={{ whiteSpace: 'pre-wrap', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
                            {profileData.student.notes}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: Fee History */}
                  {activeTab === 'fee-history' && (
                    <div>
                      {profileData.payments.length === 0 ? (
                        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--space-6)' }}>
                          No fee payments recorded yet for this student.
                        </p>
                      ) : (
                        <div className="table-wrapper">
                          <table className="table">
                            <thead>
                              <tr>
                                <th>Receipt #</th>
                                <th>Payment Date</th>
                                <th>Amount Received</th>
                                <th>Method</th>
                                <th>Txn Ref</th>
                                <th>Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {profileData.payments.map((p) => (
                                <tr key={p.paymentId}>
                                  <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-primary-light)' }}>{p.receiptNumber}</span></td>
                                  <td>{formatDate(p.paymentDate)}</td>
                                  <td><strong style={{ color: 'var(--color-lime)' }}>{formatCurrency(p.amount)}</strong></td>
                                  <td><span className="badge badge-primary">{p.paymentMethod}</span></td>
                                  <td style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{p.transactionRef || '—'}</td>
                                  <td style={{ fontSize: 'var(--text-xs)' }}>{p.notes || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 3: Monthly Ledger */}
                  {activeTab === 'ledger' && (
                    <div>
                      {profileData.ledger.length === 0 ? (
                        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--space-6)' }}>
                          No ledger records created yet.
                        </p>
                      ) : (
                        <div className="table-wrapper">
                          <table className="table">
                            <thead>
                              <tr>
                                <th>Month</th>
                                <th>Fee Due</th>
                                <th>Paid</th>
                                <th>Balance</th>
                                <th>Status</th>
                                <th>Payment Reference</th>
                              </tr>
                            </thead>
                            <tbody>
                              {profileData.ledger.map((l) => (
                                <tr key={l.ledgerId}>
                                  <td><strong>{l.monthLabel}</strong></td>
                                  <td>{formatCurrency(l.dueAmount)}</td>
                                  <td><span style={{ color: 'var(--color-lime)', fontWeight: 600 }}>{formatCurrency(l.paidAmount)}</span></td>
                                  <td>
                                    <span style={{ color: l.balance > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                                      {formatCurrency(l.balance)}
                                    </span>
                                  </td>
                                  <td>
                                    <span className={`badge ${l.status === 'PAID' ? 'badge-success' : l.status === 'PARTIALLY_PAID' ? 'badge-warning' : 'badge-danger'}`}>
                                      {l.status}
                                    </span>
                                  </td>
                                  <td style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                                    {l.coveredBy || '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 4: Status & Continuation */}
                  {activeTab === 'status' && (
                    <div style={{ maxWidth: 560 }}>
                      <div style={{ marginBottom: 'var(--space-5)' }}>
                        <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4 }}>
                          Current Status: <span className={`badge ${profileData.student.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`}>{profileData.student.status}</span>
                        </h3>
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                          Marking a student as inactive preserves all past payment records and monthly ledger allocations.
                        </p>
                      </div>

                      {profileData.student.status === 'ACTIVE' ? (
                        <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid var(--color-danger)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)' }}>
                          <h4 style={{ color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 var(--space-3)' }}>
                            <UserX size={18} /> Mark as Non-Active / Discontinued
                          </h4>
                          <div className="form-group">
                            <label className="form-label">Effective Discontinuation Date</label>
                            <input
                              type="date"
                              className="form-input"
                              value={actionDate}
                              onChange={(e) => setActionDate(e.target.value)}
                              disabled={statusSubmitting}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Reason for Discontinuation</label>
                            <textarea
                              className="form-input"
                              rows={2}
                              placeholder="e.g. Exam completed, shifting city, medical leave"
                              value={discontinueReason}
                              onChange={(e) => setDiscontinueReason(e.target.value)}
                              disabled={statusSubmitting}
                            />
                          </div>
                          <button
                            className="btn btn-danger"
                            onClick={handleDiscontinue}
                            disabled={statusSubmitting}
                          >
                            <UserX size={16} /> Confirm Discontinue Student
                          </button>
                        </div>
                      ) : (
                        <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid var(--color-lime)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)' }}>
                          <h4 style={{ color: 'var(--color-lime)', display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 var(--space-3)' }}>
                            <UserCheck size={18} /> Reactivate / Continue Student
                          </h4>
                          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
                            Reactivation resumes monthly fee tracking starting from the effective continuation date without duplicating historical dues.
                          </p>
                          <div className="form-group">
                            <label className="form-label">Reactivation Effective Date</label>
                            <input
                              type="date"
                              className="form-input"
                              value={actionDate}
                              onChange={(e) => setActionDate(e.target.value)}
                              disabled={statusSubmitting}
                            />
                          </div>
                          <button
                            className="btn btn-primary"
                            onClick={handleReactivate}
                            disabled={statusSubmitting}
                          >
                            <UserCheck size={16} /> Reactivate Student Record
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ── Edit Student Modal ────────────────────────────────────────── */}
      {editModalOpen && (
        <div className="dialog-overlay" onClick={() => setEditModalOpen(false)} style={{ zIndex: 130 }}>
          <div className="dialog-content card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, margin: 0 }}>
                Edit Student Details
              </h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setEditModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSave}>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Student Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editFormData.studentName || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, studentName: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Father's Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editFormData.fatherName || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, fatherName: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="tel"
                    className="form-input"
                    maxLength={10}
                    value={editFormData.phone || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Monthly Fee Rate (₹)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={editFormData.monthlyFee || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, monthlyFee: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Slot / Study Plan</label>
                  <select
                    className="form-input"
                    value={editFormData.slotPlan || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, slotPlan: e.target.value })}
                  >
                    {SLOT_PLANS.slice(1).map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Address</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={editFormData.address || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={editSubmitting}>
                  {editSubmitting ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
