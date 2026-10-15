// src/utils/formatters.js
// ── Formatting Utilities ─────────────────────────────────────────────────────

import { format, parseISO, isValid } from 'date-fns';

/**
 * Format a number as Indian Rupee currency.
 */
export function formatCurrency(amount) {
  if (amount == null || isNaN(amount)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format a date string or Date object in a human-readable format.
 */
export function formatDate(date, fmt = 'dd MMM yyyy') {
  if (!date) return '—';
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(d)) return '—';
    return format(d, fmt);
  } catch {
    return '—';
  }
}

/**
 * Format a date-time string.
 */
export function formatDateTime(date) {
  return formatDate(date, 'dd MMM yyyy, hh:mm a');
}

/**
 * Format a month string like "2024-01" to "Jan 2024".
 */
export function formatMonth(monthStr) {
  if (!monthStr) return '—';
  try {
    const [year, month] = monthStr.split('-').map(Number);
    return format(new Date(year, month - 1, 1), 'MMM yyyy');
  } catch {
    return monthStr;
  }
}

/**
 * Truncate a string to a maximum length.
 */
export function truncate(str, maxLen = 40) {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
}

/**
 * Mask an Aadhaar number for display (show last 4 digits only).
 */
export function maskAadhaar(aadhaar) {
  if (!aadhaar) return '—';
  const str = String(aadhaar).replace(/\s/g, '');
  if (str.length < 4) return '****';
  return '●●●● ●●●● ' + str.slice(-4);
}

/**
 * Mask a phone number — show last 4 digits only.
 */
export function maskPhone(phone) {
  if (!phone) return '—';
  const str = String(phone).replace(/\D/g, '');
  if (str.length < 4) return '****';
  return '●●●●●● ' + str.slice(-4);
}

/**
 * Generate an ISO date string for today.
 */
export function todayISO() {
  return format(new Date(), 'yyyy-MM-dd');
}

/**
 * Get the current month in "YYYY-MM" format.
 */
export function currentMonth() {
  return format(new Date(), 'yyyy-MM');
}
