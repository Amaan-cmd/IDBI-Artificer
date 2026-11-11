import React from 'react';
import SampleDataBadge from '../SampleDataBadge/SampleDataBadge';
import './Registry.css';

const toNumber = (n) => {
  if (typeof n === 'number') return Number.isFinite(n) ? n : null;
  if (typeof n === 'string' && n.trim() !== '' && Number.isFinite(Number(n))) return Number(n);
  return null;
};
const formatInr = (n) => {
  const v = toNumber(n);
  return v === null ? '—' : `₹${v.toLocaleString('en-IN')}`;
};
const formatTime = (iso) => {
  const t = iso ? new Date(iso) : null;
  return t && !Number.isNaN(t.getTime()) ? t.toLocaleString('en-IN') : 'unknown time';
};

export function Provenance({ section, label }) {
  if (!section || section.status !== 'ok') return null;
  return (
    <div className="registry-provenance">
      {label ? `${label}: ` : ''}{section.source || 'Unknown source'} · fetched {formatTime(section.fetchedAt)}
      {section.transactionId ? ` · txn ${String(section.transactionId).slice(0, 8)}` : ''}
      {section.cached ? ' · cached' : ''}
      {section.partial ? ' · partial' : ''}
    </div>
  );
}

// Provenance lines for every registry section that returned data.
export function ProvenanceList({ report }) {
  if (!report) return null;
  const sections = [['GST registration', report.gst], ['GST returns', report.filings], ['MCA21', report.mca]]
    .filter(([, s]) => s?.status === 'ok');
  if (!sections.length) return <div className="registry-provenance">No registry source returned data.</div>;
  return <>{sections.map(([label, s]) => <Provenance key={label} label={label} section={s} />)}</>;
}

function Unavailable({ section }) {
  return <span className="registry-unavailable">{section?.reason || 'Not available'}</span>;
}

function returnSummary(m) {
  if (!m) return '';
  return ` ${m.returnType}: ${m.filedPeriods}/${m.expectedPeriods} filed, ${m.missingPeriods?.length ?? 0} missing, ${m.lateFilings} late (avg ${m.averageDaysLate} days)`;
}

export default function RegistryProbeCard({ report, onSelectCin }) {
  if (!report) return null;
  const { gst, mca, filingMetrics } = report;
  const gstOk = gst?.status === 'ok' && gst.data;
  const p = filingMetrics?.primary;
  const discipline = filingMetrics?.filingDiscipline || 'UNKNOWN';

  return (
    <div className="registry-card">
      {report.sampleData && <div style={{ marginBottom: 8 }}><SampleDataBadge /></div>}
      <div className="registry-row">
        <span className="registry-label">Legal name</span>
        <span>{gstOk ? (gst.data.legalName || '—') : <Unavailable section={gst} />}</span>
        {gstOk && (<>
          <span className="registry-label">Trade name</span><span>{gst.data.tradeName || '—'}</span>
          <span className="registry-label">GST status</span>
          <span>
            {gst.data.status || '—'}
            {gst.data.registrationDate ? ` · registered ${gst.data.registrationDate}` : ''}
            {gst.data.cancellationDate ? ` · cancelled ${gst.data.cancellationDate}` : ''}
          </span>
          <span className="registry-label">Constitution</span><span>{gst.data.constitution || '—'}</span>
          <span className="registry-label">Taxpayer type</span><span>{gst.data.taxpayerType || '—'}</span>
          <span className="registry-label">Address</span><span>{gst.data.principalAddress || '—'}</span>
        </>)}
        <span className="registry-label">Filing discipline</span>
        <span>
          <span className={`registry-badge ${discipline}`}>{discipline}</span>
          {p ? returnSummary(p) : (report.filings?.status === 'unavailable' ? <> <Unavailable section={report.filings} /></> : '')}
          {filingMetrics?.gstr1 ? <div>{returnSummary(filingMetrics.gstr1)}</div> : null}
        </span>
        <span className="registry-label">MCA21</span>
        <span>
          {mca?.status === 'ok' && mca.data && (<>
            {mca.data.status || '—'} · CIN {mca.data.cin || '—'}
            {mca.data.incorporationDate ? ` · incorporated ${mca.data.incorporationDate}` : ''}
            {toNumber(mca.data.paidUpCapital) !== null ? ` · paid-up ${formatInr(mca.data.paidUpCapital)}` : ''}
          </>)}
          {mca?.status === 'ambiguous' && (
            <div className="registry-candidates">
              <span className="registry-unavailable">Several companies match the GST legal name. Select the correct one:</span>
              {(mca.candidates || []).map(c => (
                <button key={c.cin} type="button" onClick={() => onSelectCin?.(c.cin)}>{c.name || 'Unnamed'} · {c.cin}</button>
              ))}
            </div>
          )}
          {(!mca || (mca.status !== 'ok' && mca.status !== 'ambiguous')) && <Unavailable section={mca} />}
        </span>
        <span className="registry-label">Directors / charges / litigation</span>
        <span className="registry-unavailable">Not covered by current data provider</span>
      </div>
      <ProvenanceList report={report} />
    </div>
  );
}

// One-line text for a decision.registryAdjustments entry ({label, points, cap, citation}).
export function formatAdjustment(a) {
  const pts = typeof a?.points === 'number' && a.points !== 0 ? ` (${a.points > 0 ? '+' : ''}${a.points} pts)` : '';
  const cap = typeof a?.cap === 'number' ? ` [score capped at ${a.cap}]` : '';
  const cite = a?.citation ? ` — ${a.citation}` : '';
  return `${a?.label || 'Registry adjustment'}${pts}${cap}${cite}`;
}
