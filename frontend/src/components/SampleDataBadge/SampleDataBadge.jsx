import React from 'react';

export default function SampleDataBadge() {
  return (
    <span
      className="sample-data-badge"
      title="Sample data for demonstration. Not a real registry record."
      style={{
        display: 'inline-block', padding: '2px 8px', borderRadius: '999px', fontSize: '0.7rem',
        fontWeight: 700, letterSpacing: '0.05em', background: 'var(--status-amber-bg)',
        color: 'var(--status-amber-text)', border: '1px solid var(--status-amber-border)'
      }}
    >
      SAMPLE DATA
    </span>
  );
}
