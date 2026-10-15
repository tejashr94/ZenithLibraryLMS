// src/pages/AdmissionPage.jsx
import React, { useState } from 'react';
import {
  UserPlus, CheckCircle, AlertCircle, Printer, ArrowRight,
  ShieldAlert, RefreshCw, User, Phone, Home, CreditCard, Calendar, FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { studentsApi } from '../services/api';
import { formatCurrency, formatDate } from '../utils/formatters';

const SLOT_PLANS = [
  { id: 'Full Day (6 AM - 10 PM)', label: 'Full Day (6 AM - 10 PM)', defaultFee: 1200 },
  { id: 'Morning (6 AM - 2 PM)', label: 'Morning (6 AM - 2 PM)', defaultFee: 800 },
  { id: 'Evening (2 PM - 10 PM)', label: 'Evening (2 PM - 10 PM)', defaultFee: 1000 },
  { id: 'Afternoon (11 AM - 6 PM)', label: 'Afternoon (11 AM - 6 PM)', defaultFee: 700 },
  { id: 'Night Owl (10 PM - 6 AM)', label: 'Night Owl (10 PM - 6 AM)', defaultFee: 900 },
  { id: 'Custom Slot', label: 'Custom Slot', defaultFee: 1000 },
];

export default function AdmissionPage({ onNavigate }) {
  const { token } = useAuth();
  const toast = useToast();

  const todayStr = new Date().toISOString().slice(0, 10);

  const [formData, setFormData] = useState({
    studentName: '',
    fatherName: '',
    phone: '',
    aadhaar: '',
    address: '',
    slotPlan: 'Full Day (6 AM - 10 PM)',
    monthlyFee: 1200,
    registrationFee: 200,
    lockerCharge: 500,
    admissionDate: todayStr,
    notes: '',
  });

  const [errors, setErrors] = useState({});
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => `std_adm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);

  // Handle input change
  function handleChange(field, value) {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      // Auto-update monthly fee default when slot plan changes if not custom modified
      if (field === 'slotPlan') {
        const plan = SLOT_PLANS.find((p) => p.id === value);
        if (plan) next.monthlyFee = plan.defaultFee;
      }
      return next;
    });

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
    if (duplicateWarning) {
      setDuplicateWarning(null);
    }
  }

  // Check duplicate on phone or Aadhaar blur
  async function checkDuplicates() {
    if (!formData.phone && !formData.aadhaar) return;
    try {
      const res = await studentsApi.checkDuplicate(token, {
        phone: formData.phone.trim(),
        aadhaar: formData.aadhaar.trim(),
      });
      if (res.isDuplicate) {
        setDuplicateWarning(res.message);
      } else {
        setDuplicateWarning(null);
      }
    } catch {
      // Ignore background duplicate check errors
    }
  }

  // Client-side Validation
  function validate() {
    const errs = {};
    if (!formData.studentName.trim()) {
      errs.studentName = "Student name is required";
    }
    if (!formData.fatherName.trim()) {
      errs.fatherName = "Father's name is required";
    }

    const cleanPhone = formData.phone.replace(/\D/g, '');
    if (!cleanPhone) {
      errs.phone = "Phone number is required";
    } else if (cleanPhone.length !== 10) {
      errs.phone = "Enter a valid 10-digit mobile number";
    }

    if (formData.aadhaar) {
      const cleanAadhaar = formData.aadhaar.replace(/\D/g, '');
      if (cleanAadhaar.length !== 12) {
        errs.aadhaar = "Aadhaar must be exactly 12 digits";
      }
    }

    if (parseFloat(formData.monthlyFee) <= 0 || isNaN(formData.monthlyFee)) {
      errs.monthlyFee = "Monthly fee must be greater than ₹0";
    }

    if (parseFloat(formData.registrationFee) < 0 || isNaN(formData.registrationFee)) {
      errs.registrationFee = "Registration fee cannot be negative";
    }

    if (parseFloat(formData.lockerCharge) < 0 || isNaN(formData.lockerCharge)) {
      errs.lockerCharge = "Locker charge cannot be negative";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // Handle Form Submit
  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;

    if (!validate()) {
      toast.error('Please fix the highlighted errors before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const studentPayload = {
        studentName: formData.studentName.trim(),
        fatherName: formData.fatherName.trim(),
        phone: formData.phone.replace(/\D/g, ''),
        aadhaar: formData.aadhaar.replace(/\D/g, ''),
        address: formData.address.trim(),
        slotPlan: formData.slotPlan,
        monthlyFee: parseFloat(formData.monthlyFee),
        registrationFee: parseFloat(formData.registrationFee),
        lockerCharge: parseFloat(formData.lockerCharge),
        admissionDate: formData.admissionDate,
        notes: formData.notes.trim(),
      };

      const result = await studentsApi.create(token, studentPayload, idempotencyKey);

      setSuccessResult({
        registrationNumber: result.registrationNumber,
        ...studentPayload,
      });

      toast.success(`Student admitted! Reg No: ${result.registrationNumber}`);
    } catch (err) {
      if (err.code === 'DUPLICATE') {
        setDuplicateWarning(err.message);
        toast.error(err.message, { title: 'Duplicate Admission Detected' });
      } else {
        toast.error(err.message || 'Failed to admit student.', { title: 'Admission Error' });
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setFormData({
      studentName: '',
      fatherName: '',
      phone: '',
      aadhaar: '',
      address: '',
      slotPlan: 'Full Day (6 AM - 10 PM)',
      monthlyFee: 1200,
      registrationFee: 200,
      lockerCharge: 500,
      admissionDate: todayStr,
      notes: '',
    });
    setErrors({});
    setDuplicateWarning(null);
    setSuccessResult(null);
    setIdempotencyKey(`std_adm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
  }

  function handlePrintSlip() {
    window.print();
  }

  // ── Success Confirmation Screen ───────────────────────────────────────────
  if (successResult) {
    const totalOneTime = (successResult.registrationFee || 0) + (successResult.lockerCharge || 0);

    return (
      <div className="admission-success-container" style={{ maxWidth: 720, margin: '0 auto', animation: 'fadeIn 0.3s ease' }}>
        {/* Printable Slip Card */}
        <div className="card admission-slip" style={{ border: '2px solid var(--color-primary-light)', padding: 'var(--space-6)' }}>
          <div style={{ textAlign: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: '50%', background: 'var(--color-primary-dim)', color: 'var(--color-primary-light)', marginBottom: 'var(--space-2)' }}>
              <CheckCircle size={32} />
            </div>
            <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              ZENITH LIBRARY & STUDY HALL
            </h2>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
              Student Admission Acknowledgment Slip
            </p>
          </div>

          <div style={{ background: 'var(--color-bg-base)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', textAlign: 'center', marginBottom: 'var(--space-5)', border: '1px dashed var(--color-primary-light)' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>
              Assigned Registration Number
            </span>
            <span style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: 'var(--color-primary-light)', letterSpacing: '0.05em', fontFamily: 'monospace' }}>
              {successResult.registrationNumber}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-5)' }}>
            <div>
              <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: 'var(--text-xs)' }}>Student Name</span>
              <strong style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-primary)' }}>{successResult.studentName}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: 'var(--text-xs)' }}>Father's Name</span>
              <strong style={{ color: 'var(--color-text-primary)' }}>{successResult.fatherName}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: 'var(--text-xs)' }}>Phone Number</span>
              <strong style={{ color: 'var(--color-text-primary)' }}>{successResult.phone}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: 'var(--text-xs)' }}>Admission Date</span>
              <strong style={{ color: 'var(--color-text-primary)' }}>{formatDate(successResult.admissionDate)}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: 'var(--text-xs)' }}>Slot / Study Plan</span>
              <strong style={{ color: 'var(--color-accent-teal)' }}>{successResult.slotPlan}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: 'var(--text-xs)' }}>Monthly Fee Rate</span>
              <strong style={{ color: 'var(--color-lime)' }}>{formatCurrency(successResult.monthlyFee)} / month</strong>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
            <h4 style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
              One-Time Charges Breakup
            </h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 'var(--text-sm)' }}>
              <span>Registration Fee (Non-refundable)</span>
              <strong>{formatCurrency(successResult.registrationFee)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 'var(--text-sm)' }}>
              <span>Locker Security Deposit (Refundable Liability)</span>
              <strong>{formatCurrency(successResult.lockerCharge)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px dashed var(--color-border)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              <span>Total Initial Due</span>
              <span style={{ color: 'var(--color-lime)' }}>{formatCurrency(totalOneTime)}</span>
            </div>
          </div>

          {/* Action buttons (hidden in print) */}
          <div className="no-print" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', justifyContent: 'flex-end', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-4)' }}>
            <button className="btn btn-secondary" onClick={handlePrintSlip}>
              <Printer size={16} /> Print Admission Slip
            </button>
            <button
              className="btn btn-primary"
              onClick={() => onNavigate('fee-update', { studentReg: successResult.registrationNumber })}
            >
              <CreditCard size={16} /> Record First Fee Now <ArrowRight size={14} />
            </button>
            <button className="btn btn-ghost" onClick={handleReset}>
              <UserPlus size={16} /> Admit Another Student
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Admission Form ───────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Add New Student Admission</h1>
          <p className="page-subtitle">
            Enroll a new student, assign slot plan, and establish monthly fee records
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={handleReset}>
          <RefreshCw size={14} /> Reset Form
        </button>
      </div>

      {duplicateWarning && (
        <div className="login-alert login-alert-warning" style={{ marginBottom: 'var(--space-4)' }} role="alert">
          <ShieldAlert size={18} />
          <div>
            <strong>Potential Duplicate Detected</strong>
            <p style={{ margin: '4px 0 0' }}>{duplicateWarning}</p>
          </div>
        </div>
      )}

      <div className="card">
        <form onSubmit={handleSubmit} noValidate>
          {/* Section 1: Personal Details */}
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <h2 style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-primary-light)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
              1. Student Personal Information
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-4)' }}>
              {/* Student Name */}
              <div className="form-group">
                <label className="form-label" htmlFor="studentName">
                  Student Full Name <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  id="studentName"
                  type="text"
                  className={`form-input ${errors.studentName ? 'error' : ''}`}
                  placeholder="e.g. Rahul Sharma"
                  value={formData.studentName}
                  onChange={(e) => handleChange('studentName', e.target.value)}
                  disabled={submitting}
                />
                {errors.studentName && <span className="form-error"><AlertCircle size={12} /> {errors.studentName}</span>}
              </div>

              {/* Father's Name */}
              <div className="form-group">
                <label className="form-label" htmlFor="fatherName">
                  Father's Name <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  id="fatherName"
                  type="text"
                  className={`form-input ${errors.fatherName ? 'error' : ''}`}
                  placeholder="e.g. Rajesh Sharma"
                  value={formData.fatherName}
                  onChange={(e) => handleChange('fatherName', e.target.value)}
                  disabled={submitting}
                />
                {errors.fatherName && <span className="form-error"><AlertCircle size={12} /> {errors.fatherName}</span>}
              </div>

              {/* Phone Number */}
              <div className="form-group">
                <label className="form-label" htmlFor="phone">
                  Phone / Mobile Number <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  id="phone"
                  type="tel"
                  className={`form-input ${errors.phone ? 'error' : ''}`}
                  placeholder="10-digit mobile number"
                  maxLength={10}
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value.replace(/\D/g, ''))}
                  onBlur={checkDuplicates}
                  disabled={submitting}
                />
                {errors.phone && <span className="form-error"><AlertCircle size={12} /> {errors.phone}</span>}
              </div>

              {/* Aadhaar Number */}
              <div className="form-group">
                <label className="form-label" htmlFor="aadhaar">
                  Aadhaar Card Number (12 digits)
                </label>
                <input
                  id="aadhaar"
                  type="text"
                  className={`form-input ${errors.aadhaar ? 'error' : ''}`}
                  placeholder="12-digit Aadhaar number"
                  maxLength={12}
                  value={formData.aadhaar}
                  onChange={(e) => handleChange('aadhaar', e.target.value.replace(/\D/g, ''))}
                  onBlur={checkDuplicates}
                  disabled={submitting}
                />
                {errors.aadhaar && <span className="form-error"><AlertCircle size={12} /> {errors.aadhaar}</span>}
              </div>
            </div>

            {/* Address */}
            <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
              <label className="form-label" htmlFor="address">
                Home Address
              </label>
              <textarea
                id="address"
                className="form-input"
                rows={2}
                placeholder="Residential address, area, city"
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          {/* Section 2: Slot & Fee Configuration */}
          <div style={{ marginBottom: 'var(--space-6)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-5)' }}>
            <h2 style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-primary-light)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
              2. Slot Plan & Fee Structure
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
              {/* Slot Plan */}
              <div className="form-group">
                <label className="form-label" htmlFor="slotPlan">
                  Slot / Study Plan <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <select
                  id="slotPlan"
                  className="form-input"
                  value={formData.slotPlan}
                  onChange={(e) => handleChange('slotPlan', e.target.value)}
                  disabled={submitting}
                >
                  {SLOT_PLANS.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.label} (₹{plan.defaultFee}/mo)
                    </option>
                  ))}
                </select>
              </div>

              {/* Monthly Fee */}
              <div className="form-group">
                <label className="form-label" htmlFor="monthlyFee">
                  Monthly Recurring Fee (₹) <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  id="monthlyFee"
                  type="number"
                  min="1"
                  step="any"
                  className={`form-input ${errors.monthlyFee ? 'error' : ''}`}
                  value={formData.monthlyFee}
                  onChange={(e) => handleChange('monthlyFee', e.target.value)}
                  disabled={submitting}
                />
                {errors.monthlyFee && <span className="form-error"><AlertCircle size={12} /> {errors.monthlyFee}</span>}
              </div>

              {/* Admission Date */}
              <div className="form-group">
                <label className="form-label" htmlFor="admissionDate">
                  Admission Date <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  id="admissionDate"
                  type="date"
                  className="form-input"
                  value={formData.admissionDate}
                  onChange={(e) => handleChange('admissionDate', e.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>

            {/* One-time fees */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
              {/* Registration Fee */}
              <div className="form-group">
                <label className="form-label" htmlFor="registrationFee">
                  One-time Registration Fee (₹)
                </label>
                <input
                  id="registrationFee"
                  type="number"
                  min="0"
                  step="any"
                  className={`form-input ${errors.registrationFee ? 'error' : ''}`}
                  value={formData.registrationFee}
                  onChange={(e) => handleChange('registrationFee', e.target.value)}
                  disabled={submitting}
                />
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                  Non-refundable library entry charge
                </span>
              </div>

              {/* Locker Charge */}
              <div className="form-group">
                <label className="form-label" htmlFor="lockerCharge">
                  Refundable Locker Deposit (₹)
                </label>
                <input
                  id="lockerCharge"
                  type="number"
                  min="0"
                  step="any"
                  className={`form-input ${errors.lockerCharge ? 'error' : ''}`}
                  value={formData.lockerCharge}
                  onChange={(e) => handleChange('lockerCharge', e.target.value)}
                  disabled={submitting}
                />
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-accent-amber)' }}>
                  Refundable liability (stored separately from income)
                </span>
              </div>
            </div>

            {/* Notes */}
            <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
              <label className="form-label" htmlFor="notes">
                Admission Notes / Target Exam / Locker Number
              </label>
              <textarea
                id="notes"
                className="form-input"
                rows={2}
                placeholder="Optional notes, locker # assigned, ID proof details"
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          {/* Form Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-5)' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleReset}
              disabled={submitting}
            >
              Cancel / Reset
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={submitting}
              id="submit-admission-btn"
            >
              {submitting ? (
                <>
                  <RefreshCw size={16} className="spin-icon" /> Saving Student Record…
                </>
              ) : (
                <>
                  <UserPlus size={18} /> Confirm & Admit Student
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
