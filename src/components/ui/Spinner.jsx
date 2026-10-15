// src/components/ui/Spinner.jsx
import React from 'react';

export default function Spinner({ size = 'md', className = '' }) {
  const cls = size === 'lg' ? 'spinner spinner-lg' : 'spinner';
  return <div className={`${cls} ${className}`} role="status" aria-label="Loading" />;
}
