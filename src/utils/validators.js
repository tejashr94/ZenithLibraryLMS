// src/utils/validators.js
// ── Input Validation Utilities ───────────────────────────────────────────────

/**
 * Validate a required string field.
 */
export function required(value, label = 'This field') {
  if (!value || !String(value).trim()) return `${label} is required`;
  return null;
}

/**
 * Validate minimum string length.
 */
export function minLength(value, min, label = 'This field') {
  if (value && String(value).trim().length < min) {
    return `${label} must be at least ${min} characters`;
  }
  return null;
}

/**
 * Validate a 10-digit Indian mobile number.
 */
export function phoneNumber(value) {
  if (!value) return 'Phone number is required';
  const clean = String(value).replace(/\D/g, '');
  if (clean.length !== 10) return 'Enter a valid 10-digit mobile number';
  if (!/^[6-9]/.test(clean)) return 'Mobile number must start with 6–9';
  return null;
}

/**
 * Validate a 12-digit Aadhaar number.
 */
export function aadhaarNumber(value) {
  if (!value) return null; // Optional
  const clean = String(value).replace(/\s/g, '');
  if (!/^\d{12}$/.test(clean)) return 'Aadhaar must be exactly 12 digits';
  return null;
}

/**
 * Validate a positive number.
 */
export function positiveNumber(value, label = 'Amount') {
  if (value === '' || value == null) return `${label} is required`;
  const num = Number(value);
  if (isNaN(num)) return `${label} must be a number`;
  if (num < 0) return `${label} cannot be negative`;
  return null;
}

/**
 * Validate a date string (YYYY-MM-DD format).
 */
export function dateString(value, label = 'Date') {
  if (!value) return `${label} is required`;
  const d = new Date(value);
  if (isNaN(d.getTime())) return `${label} is invalid`;
  return null;
}

/**
 * Run multiple validators and return first error found.
 */
export function compose(...validators) {
  return (value) => {
    for (const v of validators) {
      const err = v(value);
      if (err) return err;
    }
    return null;
  };
}

/**
 * Validate an entire form object with a schema of validators.
 * Returns an errors object with field keys.
 */
export function validateForm(values, schema) {
  const errors = {};
  for (const [field, validators] of Object.entries(schema)) {
    const fns = Array.isArray(validators) ? validators : [validators];
    for (const fn of fns) {
      const err = fn(values[field]);
      if (err) { errors[field] = err; break; }
    }
  }
  return errors;
}

/**
 * Check if a form errors object has any errors.
 */
export function hasErrors(errors) {
  return Object.values(errors).some(Boolean);
}
