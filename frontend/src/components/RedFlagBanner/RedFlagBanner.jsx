import React from 'react';
import { AlertTriangle } from 'lucide-react';

// Red flags from the backend decision (e.g. the statement account holder is not
// the GST registrant). Shown prominently next to the score.
export default function RedFlagBanner({ flags, compact = false }) {
  return (
    <div
      role="alert"
      style={{
        margin: compact ? '0 0 0.75rem' : '0 0 1rem',
        padding: compact ? '0.6rem 0.85rem' : '0.85rem 1rem',
        borderRadius: 10,
        border: '1px solid var(--status-red-text)',
        borderLeftWidth: 4,
        background: 'var(--status-red-bg)',
        color: 'var(--status-red-text)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.02em' }}>
        <AlertTriangle size={16} />
        <span>{flags.length > 1 ? `RED FLAGS (${flags.length})` : 'RED FLAG'}</span>
      </div>
      <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.4rem', fontSize: '0.85rem', lineHeight: 1.45 }}>
        {flags.map((f, i) => <li key={i}>{typeof f === 'string' ? f : (f?.message || f?.label || JSON.stringify(f))}</li>)}
      </ul>
    </div>
  );
}
