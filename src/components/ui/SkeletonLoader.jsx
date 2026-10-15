// src/components/ui/SkeletonLoader.jsx
import React from 'react';

function SkeletonLine({ width = '100%', height = 16, style = {} }) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius: 'var(--radius-sm)', ...style }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <SkeletonLine width="60%" height={20} />
      <SkeletonLine width="40%" height={14} />
      <SkeletonLine height={36} style={{ marginTop: 8 }} />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 'var(--space-4)',
        padding: 'var(--space-3) var(--space-4)',
        background: 'var(--color-bg-elevated)',
        borderBottom: '1px solid var(--color-border)',
      }}>
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonLine key={i} width="70%" height={12} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: 'var(--space-4)',
          padding: 'var(--space-3) var(--space-4)',
          borderBottom: '1px solid var(--color-border-subtle)',
        }}>
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonLine key={c} width={`${50 + Math.random() * 40}%`} height={14} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
        {[1,2,3,4].map(i => <SkeletonCard key={i} />)}
      </div>
      {/* Chart area */}
      <div className="card">
        <SkeletonLine width="40%" height={24} style={{ marginBottom: 'var(--space-5)' }} />
        <div className="skeleton" style={{ height: 240, borderRadius: 'var(--radius-md)' }} />
      </div>
    </div>
  );
}

export default SkeletonLine;
