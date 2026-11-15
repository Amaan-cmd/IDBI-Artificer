import React from 'react';
import './Registry.css';

const VERDICT_LABEL = {
  PROCEED: 'Proceed',
  REQUEST_DOCUMENTS: 'Request documents',
  DECLINE: 'Decline',
  INSUFFICIENT_DATA: 'Insufficient data'
};

// Compact grade badge for screening rows. Never shown on the 300–900 score scale.
export function PreScreenBadge({ grade, verdict, compact = false }) {
  if (!grade && !verdict) return null;
  const title = `Registry pre-screen${grade ? ` grade ${grade}` : ''} · ${VERDICT_LABEL[verdict] || verdict || ''}`;
  return (
    <span className={`prescreen-badge grade-${grade || 'none'}`} title={title}>
      {compact ? (grade ? `Pre-screen ${grade}` : 'Pre-screen —') : `Pre-screen ${grade || '—'} · ${VERDICT_LABEL[verdict] || verdict}`}
    </span>
  );
}

const marker = (f) => (f.points === f.max ? '+' : f.points === 0 ? '−' : '±');

export default function PreScreenCard({ preScreen, onAttachStatement }) {
  if (!preScreen) return null;
  const { grade, verdict, percent, points, maxPoints, factors = [], knockouts = [], notAssessed = [], caveats = [] } = preScreen;

  return (
    <div className="registry-card prescreen-card">
      <div className="prescreen-header">
        <span className="registry-section-title" style={{ margin: 0 }}>Registry pre-screen</span>
        <span className={`prescreen-grade grade-${grade || 'none'}`}>{grade ? `Grade ${grade}` : 'No grade'}</span>
        <span className={`prescreen-verdict verdict-${verdict}`}>{VERDICT_LABEL[verdict] || verdict}</span>
        {typeof percent === 'number' && (
          <span className="registry-provenance" style={{ margin: 0 }}>{points}/{maxPoints} registry points ({percent}%)</span>
        )}
      </div>

      {knockouts.length > 0 && (
        <ul className="registry-list prescreen-knockouts">
          {knockouts.map(k => <li key={k.label} title={k.citation}>Knockout: {k.label}</li>)}
        </ul>
      )}

      {factors.length > 0 && (
        <ul className="prescreen-factors">
          {factors.map(f => (
            <li key={f.key} title={f.citation || undefined}>
              <span className={`prescreen-marker m-${marker(f) === '+' ? 'up' : marker(f) === '−' ? 'down' : 'mid'}`}>{marker(f)}</span>
              <span className="prescreen-factor-label">{f.label}</span>
              <span className="prescreen-factor-detail">{f.detail}</span>
              <span className="prescreen-factor-points">{f.points}/{f.max}</span>
            </li>
          ))}
        </ul>
      )}

      {(notAssessed.length > 0 || caveats.length > 0) && (
        <div className="registry-unavailable" style={{ marginTop: 6 }}>
          {notAssessed.map(n => <div key={n.label}>Not assessed · {n.label}: {n.reason}</div>)}
          {caveats.map(c => <div key={c}>Caveat · {c}</div>)}
        </div>
      )}
      <div className="registry-unavailable" style={{ marginTop: 4 }}>
        Not assessed: revenue, cash buffer, debt. This grade is not a credit score.
      </div>

      <div className="registry-section-title">Unlock</div>
      <div className="prescreen-unlocks">
        <button type="button" className="prescreen-unlock-btn" onClick={onAttachStatement} disabled={!onAttachStatement}>
          Attach bank statement → full credit score
        </button>
        <button type="button" className="prescreen-unlock-btn" disabled>
          GST consent → verified turnover · Coming soon
        </button>
      </div>
    </div>
  );
}
