import React from 'react';
import RegistryProbeCard from './RegistryProbeCard';
import './Registry.css';

export default function RegistryScreeningReport({ payload, onSelectCin }) {
  const report = payload?.registryReport;
  if (!report) return null;
  const filings = report.filings?.status === 'ok' && Array.isArray(report.filings.data)
    ? [...report.filings.data].sort((a, b) => String(b.period || '').localeCompare(String(a.period || '')))
    : [];
  const fm = report.filingMetrics;
  const missing = [fm?.primary, fm?.gstr1]
    .filter(m => m && Array.isArray(m.missingPeriods) && m.missingPeriods.length)
    .map(m => `${m.returnType}: ${m.missingPeriods.join(', ')}`);

  return (
    <div className="registry-card">
      <h3 style={{ margin: 0 }}>Registry Screening · {payload.businessName || report.gstin || payload.gstin || 'Enterprise'}</h3>
      <p className="registry-unavailable" style={{ marginTop: 4 }}>
        No credit score: registries do not contain revenue. Upload a bank statement for a full 5-pillar credit score.
      </p>
      <RegistryProbeCard report={report} onSelectCin={onSelectCin} />
      {missing.length > 0 && (
        <>
          <div className="registry-section-title">Missing return periods</div>
          <ul className="registry-list">{missing.map(m => <li key={m}>{m}</li>)}</ul>
        </>
      )}
      {filings.length > 0 ? (
        <table className="registry-filings">
          <thead><tr><th>Period</th><th>Return</th><th>Filed on</th><th>Mode</th><th>ARN</th><th>Status</th></tr></thead>
          <tbody>
            {filings.map((f, i) => (
              <tr key={`${f.returnType}-${f.period}-${f.arn || i}`}>
                <td>{f.period || '—'}</td><td>{f.returnType || '—'}</td><td>{f.filedOn || '—'}</td>
                <td>{f.mode || '—'}</td><td className="font-mono">{f.arn || '—'}</td><td>{f.status || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="registry-section-title" style={{ textTransform: 'none', fontWeight: 400, fontStyle: 'italic' }}>
          Filing history: {report.filings?.reason || 'Not available'}
        </div>
      )}
    </div>
  );
}
