import React, { useState, useMemo } from 'react';
import {
  ArrowLeft, Download, ShieldCheck, FileText, Activity, Clock
} from 'lucide-react';
import './SplitWorkspaceView.css';
import { exportAuditReport } from '../../utils/pdfExport';
import { ProvenanceList, formatAdjustment } from '../Registry/RegistryProbeCard';
import RegistryScreeningReport from '../Registry/RegistryScreeningReport';
import SampleDataBadge from '../SampleDataBadge/SampleDataBadge';
import RedFlagBanner from '../RedFlagBanner/RedFlagBanner';

const NA = 'Not available';
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const fx = (v, suffix = '') => (isNum(v) ? `${v}${suffix}` : NA);
const fxText = (v) => {
  if (v === null || v === undefined || v === '') return NA;
  if (Array.isArray(v)) return v.length ? v.join(', ') : 'None';
  return String(v);
};
// Badge for a value: tier(v) returns [className, label]; unavailable values get a neutral badge.
const badgeFor = (v, tier) => (isNum(v) ? tier(v) : ['na', 'NOT AVAILABLE']);

export default function SplitWorkspaceView({
  data,
  onBack,
  currentUser
}) {
  const [activeTab, setActiveTab] = useState('ratios'); // 'ratios' | 'compliance' | 'documents'
  const [auditorNotes, setAuditorNotes] = useState('');
  const [noteSavedFeedback, setNoteSavedFeedback] = useState(false);
  // Serialise the (potentially large) payload only when the Raw JSON tab is open, not on every notes keystroke.
  const rawJson = useMemo(() => (data && activeTab === 'documents' ? JSON.stringify(data, null, 2) : ''), [data, activeTab]);

  if (!data) return null;

  const businessName = data.businessName || data.registryReport?.gst?.data?.legalName || 'Enterprise';
  const gstin = data.gstin || '—';
  const report = data.registryReport || null;
  const sampleData = Boolean(data.sampleData || data.decision?.sampleData || report?.sampleData);
  const openedAt = new Date().toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  // Registry screenings carry no financials or score: show the screening report only.
  if (data.reportType === 'REGISTRY_SCREENING') {
    return (
      <div className="split-workspace-view animate-fade-up">
        <header className="workspace-sticky-header">
          <div className="header-left-zone">
            <button className="header-back-btn" onClick={onBack}>
              <ArrowLeft size={16} />
              <span>Back to Intake</span>
            </button>
            <div className="header-entity-info">
              <div className="entity-name-row">
                <h1 className="header-entity-title">{businessName}</h1>
                {sampleData && <SampleDataBadge />}
              </div>
              <div className="header-meta-row">
                <span className="mono-text">GSTIN: {gstin}</span>
                <span className="meta-sep">·</span>
                <span>Registry Screening</span>
              </div>
            </div>
          </div>
        </header>
        <div style={{ padding: '1.25rem' }}>
          <RegistryScreeningReport payload={data} />
        </div>
      </div>
    );
  }

  const decision = data.decision || {};
  const score = isNum(decision.score) ? decision.score : null;
  const riskLevel = decision.riskLevel ? String(decision.riskLevel).toUpperCase().replace(/\s*RISK$/, '') : null;
  const m = data.metrics || {};
  const p1 = m.pillar1_liquidity || {};
  const p2 = m.pillar2_revenue || {};
  const p3 = m.pillar3_stability || {};
  const p4 = m.pillar4_leverage || {};
  const p5 = m.pillar5_operational || {};
  const gst = report?.gst?.status === 'ok' ? report.gst.data : null;
  const mca = report?.mca?.status === 'ok' ? report.mca.data : null;
  const fm = report?.filingMetrics || null;
  const citations = Array.isArray(decision.citations) ? decision.citations : [];
  const caveats = Array.isArray(decision.caveats) ? decision.caveats : [];
  const redFlags = Array.isArray(decision.redFlags) ? decision.redFlags : [];
  const adjustments = Array.isArray(decision.registryAdjustments) ? decision.registryAdjustments : [];

  // Monthly series straight from the statement extraction (skipped when flagged as a data gap).
  const telemetry = data.agent1Telemetry || {};
  const gaps = new Set(Array.isArray(telemetry.dataGaps) ? telemetry.dataGaps : []);
  const credits = !gaps.has('monthlyCredits') && Array.isArray(telemetry.monthlyCredits) ? telemetry.monthlyCredits : [];
  const debits = !gaps.has('monthlyDebits') && Array.isArray(telemetry.monthlyDebits) ? telemetry.monthlyDebits : [];
  const series = credits.map((c, i) => ({ label: `M${i + 1}`, credit: isNum(c) ? c : null, debit: isNum(debits[i]) ? debits[i] : null }));
  const seriesMax = Math.max(0, ...series.flatMap(r => [r.credit || 0, r.debit || 0]));

  // Circular gauge (score 300–900); empty when no score is available.
  const scorePct = score === null ? 0 : Math.min(100, Math.max(0, ((score - 300) / 600) * 100));
  const strokeDashoffset = 283 - (283 * (scorePct / 100));
  const scoreColor = score === null ? 'var(--text-subtle)' :
    score >= 800 ? '#10b981' :
    score >= 700 ? '#3b82f6' :
    score >= 600 ? '#f59e0b' : '#ef4444';
  const riskBadgeClass = !riskLevel ? 'risk-badge-na' :
    riskLevel.includes('LOW') ? 'risk-badge-low' :
    riskLevel.includes('MOD') || riskLevel.includes('MED') ? 'risk-badge-mod' : 'risk-badge-high';

  const dscpBadge = badgeFor(p4.debtServiceCoverageProxy, v => (v >= 1.5 ? ['pass', 'PASSED'] : v >= 1.0 ? ['warn', 'TIGHT'] : ['fail', 'BELOW 1.0x']));
  const bufferBadge = badgeFor(p1.cashBufferRatio, v => (v >= 0.25 ? ['pass', 'COMFORTABLE'] : v >= 0.15 ? ['warn', 'ADEQUATE'] : ['fail', 'THIN']));
  const odBadge = badgeFor(p1.overdraftLimitUtilization, v => (v <= 60 ? ['normal', 'STABLE'] : v <= 80 ? ['warn', 'ELEVATED'] : ['fail', 'STRESSED']));
  const emiBadge = badgeFor(p4.interestEmiBurdenRatio, v => (v < 20 ? ['pass', 'LOW BURDEN'] : v < 35 ? ['warn', 'MODERATE'] : ['fail', 'HIGH BURDEN']));

  const handleDownloadReport = () => {
    exportAuditReport({ data, auditorNotes, officer: currentUser });
  };

  const handleAddQuickTag = (tag) => {
    setAuditorNotes(prev => {
      const clean = prev.trim();
      return clean ? `${clean} · ${tag}` : tag;
    });
    setNoteSavedFeedback(true);
    setTimeout(() => setNoteSavedFeedback(false), 1500);
  };

  return (
    <div className="split-workspace-view animate-fade-up">
      {/* =========================================================================
          STICKY TOP HEADER
          ========================================================================= */}
      <header className="workspace-sticky-header">
        <div className="header-left-zone">
          <button className="header-back-btn" onClick={onBack}>
            <ArrowLeft size={16} />
            <span>Back to Intake</span>
          </button>

          <div className="header-entity-info">
            <div className="entity-name-row">
              <h1 className="header-entity-title">{businessName}</h1>
              <span className="header-mca-pill">
                {mca ? <><span className="pulse-green-dot" />{mca.status || '—'} · MCA21</> : 'MCA21 not verified'}
              </span>
              {sampleData && <SampleDataBadge />}
            </div>
            <div className="header-meta-row">
              <span className="mono-text">GSTIN: {gstin}</span>
              <span className="meta-sep">·</span>
              <span>CIN: {mca?.cin || NA}</span>
              <span className="meta-sep">·</span>
              <span className="meta-date">
                <Clock size={12} />
                Opened {openedAt}
              </span>
            </div>
          </div>
        </div>

        <div className="header-right-zone">
          <button
            className="primary-download-btn"
            onClick={handleDownloadReport}
          >
            <Download size={15} />
            <span>Download Audit Report (PDF/CSV)</span>
          </button>
        </div>
      </header>

      {/* =========================================================================
          TWO-COLUMN SPLIT WORKSPACE
          ========================================================================= */}
      <div className="workspace-split-container">
        {/* LEFT COLUMN: THE VERDICT */}
        <aside className="verdict-column">
          {/* 1. The Score Gauge */}
          <div className="verdict-score-card">
            <div className="verdict-card-label">
              <ShieldCheck size={14} className="text-gold" />
              <span>THE UNDERWRITING VERDICT</span>
            </div>

            <div className="score-radial-wrap">
              <svg className="radial-svg" viewBox="0 0 100 100">
                <circle className="radial-bg-circle" cx="50" cy="50" r="45" />
                <circle
                  className="radial-progress-circle"
                  cx="50"
                  cy="50"
                  r="45"
                  style={{ stroke: scoreColor, strokeDasharray: '283', strokeDashoffset }}
                />
              </svg>
              <div className="radial-inner-content">
                <span className="large-score-num" style={{ color: scoreColor }}>{score ?? '—'}</span>
                <span className="score-denom">/ 900</span>
              </div>
            </div>

            <div className="verdict-badge-row">
              <span className={`verdict-risk-badge ${riskBadgeClass}`}>
                {riskLevel ? `${riskLevel} RISK TIER` : 'RISK TIER NOT AVAILABLE'}
              </span>
            </div>

            <div className="verdict-stats-grid">
              <div className="stat-chip">
                <span className="chip-lbl">JEV VERDICT</span>
                <span className="chip-val">{data.jevAudit?.verdict || NA}</span>
              </div>
              <div className="stat-chip">
                <span className="chip-lbl">DATA INTEGRITY</span>
                <span className="chip-val">{decision.agentSafetyAudit?.dataIntegrityStatus || NA}</span>
              </div>
            </div>
          </div>

          {redFlags.length > 0 && <RedFlagBanner flags={redFlags} />}

          {/* 2. Key Drivers (backend decision citations) */}
          <div className="verdict-shap-card">
            <div className="shap-header">
              <span className="shap-title">Key Drivers (Decision Citations)</span>
              <span className="shap-subtitle">From the backend decision</span>
            </div>
            <div className="shap-drivers-list">
              {citations.length ? citations.map((text, idx) => (
                <div key={idx} className="shap-driver-item info">
                  <span className="driver-sign">•</span>
                  <span className="driver-text">{String(text)}</span>
                </div>
              )) : (
                <div className="shap-driver-item info">
                  <span className="driver-text">{NA}</span>
                </div>
              )}
            </div>
          </div>

          {/* 3. Registry verification: adjustments, caveats, provenance */}
          <div className="verdict-shap-card">
            <div className="shap-header">
              <span className="shap-title">Registry Verification</span>
              <span className="shap-subtitle">GSTN / MCA21 adjustments and caveats</span>
            </div>
            <div className="shap-drivers-list">
              {adjustments.map((a, idx) => (
                <div key={`adj-${idx}`} className={`shap-driver-item ${isNum(a?.points) && a.points < 0 || isNum(a?.cap) ? 'neg' : isNum(a?.points) && a.points > 0 ? 'pos' : 'info'}`}>
                  <span className="driver-sign">{isNum(a?.points) && a.points < 0 || isNum(a?.cap) ? '−' : isNum(a?.points) && a.points > 0 ? '+' : '•'}</span>
                  <span className="driver-text">{formatAdjustment(a)}</span>
                </div>
              ))}
              {caveats.map((c, idx) => (
                <div key={`cav-${idx}`} className="shap-driver-item info">
                  <span className="driver-sign">!</span>
                  <span className="driver-text">{typeof c === 'string' ? c : (c?.message || c?.label || JSON.stringify(c))}</span>
                </div>
              ))}
              {!adjustments.length && !caveats.length && (
                <div className="shap-driver-item info">
                  <span className="driver-text">No registry adjustments or caveats recorded.</span>
                </div>
              )}
            </div>
            {report ? <ProvenanceList report={report} /> : <div className="registry-provenance">No registry report attached to this evaluation.</div>}
          </div>

          {/* 4. Auditor Confidence & Override Notes */}
          <div className="verdict-notes-card">
            <div className="notes-header">
              <span className="notes-title">Auditor Confidence & Override Notes</span>
              {noteSavedFeedback && <span className="notes-feedback-tag">Saved</span>}
            </div>
            <p className="notes-desc">
              Attach observations, committee covenants or risk adjustments directly to the exported PDF dossier.
            </p>

            <textarea
              className="auditor-notes-textarea"
              placeholder="e.g. Verified with plant manager; GST Q2 reconciled cleanly; recommended for ₹50L facility..."
              value={auditorNotes}
              onChange={(e) => setAuditorNotes(e.target.value)}
              rows={3}
            />

            <div className="quick-tags-row">
              <button type="button" className="quick-tag-btn" onClick={() => handleAddQuickTag('Approved by Committee')}>
                + Approved by Committee
              </button>
              <button type="button" className="quick-tag-btn" onClick={() => handleAddQuickTag('Collateral Waived')}>
                + Collateral Waived
              </button>
              <button type="button" className="quick-tag-btn" onClick={() => handleAddQuickTag('Subject to Q3 GST')}>
                + Subject to Q3 GST
              </button>
            </div>
          </div>
        </aside>

        {/* RIGHT COLUMN: THE EVIDENCE */}
        <main className="evidence-column">
          <div className="evidence-tabs-bar">
            <button
              className={`evidence-tab-btn ${activeTab === 'ratios' ? 'active' : ''}`}
              onClick={() => setActiveTab('ratios')}
            >
              <Activity size={15} />
              <span>Tab 1: Financial Ratios</span>
            </button>
            <button
              className={`evidence-tab-btn ${activeTab === 'compliance' ? 'active' : ''}`}
              onClick={() => setActiveTab('compliance')}
            >
              <ShieldCheck size={15} />
              <span>Tab 2: Cash Flow & Compliance</span>
            </button>
            <button
              className={`evidence-tab-btn ${activeTab === 'documents' ? 'active' : ''}`}
              onClick={() => setActiveTab('documents')}
            >
              <FileText size={15} />
              <span>Tab 3: Sources & Raw JSON</span>
            </button>
          </div>

          {/* TAB 1: FINANCIAL RATIOS */}
          {activeTab === 'ratios' && (
            <div className="tab-pane animate-fade-in">
              <div className="ratio-cards-grid">
                <div className="ratio-card">
                  <div className="ratio-header">
                    <span className="ratio-title">Debt Service Coverage (DSCP)</span>
                    <span className={`ratio-badge ${dscpBadge[0]}`}>{dscpBadge[1]}</span>
                  </div>
                  <div className="ratio-metric-val">{fx(p4.debtServiceCoverageProxy, 'x')}</div>
                  <div className="ratio-benchmark">Benchmark: &gt; 1.50x</div>
                  <p className="ratio-desc">Net monthly operating inflow divided by scheduled EMI obligations observed in the statement.</p>
                </div>

                <div className="ratio-card">
                  <div className="ratio-header">
                    <span className="ratio-title">Cash Buffer Ratio & Runway</span>
                    <span className={`ratio-badge ${bufferBadge[0]}`}>{bufferBadge[1]}</span>
                  </div>
                  <div className="ratio-metric-val">{fx(p1.cashBufferRatio, 'x')}</div>
                  <div className="ratio-benchmark">
                    {isNum(p1.minimumCashBufferDays) ? `${p1.minimumCashBufferDays} Days Minimum Cash Buffer` : `Minimum cash buffer days: ${NA}`}
                  </div>
                  <p className="ratio-desc">Closing bank balance relative to average monthly operating debits.</p>
                </div>

                <div className="ratio-card">
                  <div className="ratio-header">
                    <span className="ratio-title">Peak OD Limit Utilization</span>
                    <span className={`ratio-badge ${odBadge[0]}`}>{odBadge[1]}</span>
                  </div>
                  <div className="ratio-metric-val">{fx(p1.overdraftLimitUtilization, '%')}</div>
                  <div className="ratio-benchmark">Peak drawn ÷ sanctioned OD limit</div>
                  <p className="ratio-desc">Share of the sanctioned overdraft limit drawn at peak during the statement period.</p>
                </div>

                <div className="ratio-card">
                  <div className="ratio-header">
                    <span className="ratio-title">Monthly EMI Burden Ratio</span>
                    <span className={`ratio-badge ${emiBadge[0]}`}>{emiBadge[1]}</span>
                  </div>
                  <div className="ratio-metric-val">{fx(p4.interestEmiBurdenRatio, '%')}</div>
                  <div className="ratio-benchmark">Benchmark: &lt; 20%</div>
                  <p className="ratio-desc">Monthly EMI obligations as a share of monthly credits.</p>
                </div>
              </div>

              <div className="evidence-panel">
                <div className="panel-header">
                  <h3 className="panel-title">Working Capital & Monthly Turnover Trend</h3>
                  <span className="panel-tag">{series.length ? `${series.length} months from statement` : NA}</span>
                </div>

                {series.length && seriesMax > 0 ? (
                  <div className="monthly-chart-bars">
                    {series.map((row, i) => (
                      <div key={i} className="bar-group">
                        <div className="bars-track">
                          <div
                            className="bar-credit"
                            style={{ height: `${((row.credit || 0) / seriesMax) * 100}%` }}
                            title={`Credit: ${isNum(row.credit) ? `₹${(row.credit / 100000).toFixed(2)}L` : NA}`}
                          />
                          <div
                            className="bar-debit"
                            style={{ height: `${((row.debit || 0) / seriesMax) * 100}%` }}
                            title={`Debit: ${isNum(row.debit) ? `₹${(row.debit / 100000).toFixed(2)}L` : NA}`}
                          />
                        </div>
                        <span className="bar-month-lbl">{row.label}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="ratio-desc">Monthly credit / debit series not available for this evaluation.</p>
                )}

                <div className="chart-legend-row">
                  <div className="legend-item">
                    <span className="legend-color credit" />
                    <span>Bank Monthly Inflows (Credits)</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-color debit" />
                    <span>Operating Outflows (Debits){debits.length ? '' : ` · ${NA}`}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CASH FLOW & COMPLIANCE */}
          {activeTab === 'compliance' && (
            <div className="tab-pane animate-fade-in">
              <div className="compliance-grid">
                <div className="compliance-card">
                  <h4 className="comp-card-title">1. Bank Statement Anomalies & Volatility</h4>
                  <div className="comp-item-row">
                    <span>Credit Coefficient of Variation (CV):</span>
                    <span className="comp-val">{fx(p3.creditCoefficientOfVariation)}</span>
                  </div>
                  <div className="comp-item-row">
                    <span>Inward Bounce Rate:</span>
                    <span className="comp-val">{fx(p3.inwardBounceRate, '%')}</span>
                  </div>
                  <div className="comp-item-row">
                    <span>Outward Bounce Rate:</span>
                    <span className="comp-val">{fx(p3.outwardBounceRate, '%')}</span>
                  </div>
                  <div className="comp-item-row">
                    <span>Consecutive Low Inflow Months:</span>
                    <span className="comp-val">{fx(p3.consecutiveLowCreditMonths)}</span>
                  </div>
                </div>

                <div className="compliance-card">
                  <h4 className="comp-card-title">2. Statutory GST Return Matching</h4>
                  <div className="comp-item-row">
                    <span>GSTR-1 to Bank Credits Ratio:</span>
                    <span className="comp-val">{fx(p2.gstVsBankReconciliation, 'x')}</span>
                  </div>
                  <div className="comp-item-row">
                    <span>GSTR-1 vs GSTR-3B Tax Paid Gap:</span>
                    <span className="comp-val">{fx(p2.gstr1VsGstr3bGap, '%')}</span>
                  </div>
                  <div className="comp-item-row">
                    <span>GST Filing Discipline (GSTN):</span>
                    <span className="comp-val">
                      {fm?.filingDiscipline || NA}
                      {fm?.primary ? ` · ${fm.primary.returnType} ${fm.primary.filedPeriods}/${fm.primary.expectedPeriods} filed` : ''}
                    </span>
                  </div>
                  <div className="comp-item-row">
                    <span>GST Registration Status:</span>
                    <span className="comp-val">{gst?.status || report?.gst?.reason || NA}</span>
                  </div>
                </div>

                <div className="compliance-card">
                  <h4 className="comp-card-title">3. MCA & Director DIN Status</h4>
                  <div className="comp-item-row">
                    <span>MCA21 Company Status:</span>
                    <span className="comp-val">{mca ? `${mca.status || '—'}${mca.rocCode ? ` (${mca.rocCode})` : ''}` : (report?.mca?.reason || NA)}</span>
                  </div>
                  <div className="comp-item-row">
                    <span>Director DIN Verification:</span>
                    <span className="comp-val">Not covered by current data provider</span>
                  </div>
                  <div className="comp-item-row">
                    <span>e-Courts Litigation Record:</span>
                    <span className="comp-val">Not covered by current data provider</span>
                  </div>
                  <div className="comp-item-row">
                    <span>Circular Transaction Risk:</span>
                    <span className="comp-val">{fxText(p5.circularTransactionRisk)}</span>
                  </div>
                </div>

                <div className="compliance-card">
                  <h4 className="comp-card-title">4. Operational Payroll & Utility Flags</h4>
                  <div className="comp-item-row">
                    <span>Staff Payroll Regularity:</span>
                    <span className="comp-val">{fxText(p5.salaryStaffPaymentConsistency)}</span>
                  </div>
                  <div className="comp-item-row">
                    <span>Utility / Rent Regularity:</span>
                    <span className="comp-val">{fxText(p5.utilityRentPaymentRegularity)}</span>
                  </div>
                  <div className="comp-item-row">
                    <span>High-Value Cash Withdrawals:</span>
                    <span className="comp-val">{fx(p5.highValueCashWithdrawalPct, '% of Total Debits')}</span>
                  </div>
                  <div className="comp-item-row">
                    <span>Suspicious Timing Flags:</span>
                    <span className="comp-val">{fxText(p5.suspiciousTimingFlags)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SOURCES & RAW JSON */}
          {activeTab === 'documents' && (
            <div className="tab-pane animate-fade-in">
              <div className="documents-evidence-panel">
                <div className="doc-preview-header">
                  <div className="doc-preview-title-row">
                    <FileText size={18} className="text-gold" />
                    <div>
                      <h4 className="doc-preview-name">Evaluation Payload & Registry Sources</h4>
                      <span className="doc-preview-hash">
                        {telemetry.monthsAnalyzed ? `${telemetry.monthsAnalyzed} months analysed` : 'Statement months: Not available'}
                        {gaps.size ? ` · ${gaps.size} data gap(s): ${[...gaps].join(', ')}` : ''}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ padding: '0 0 0.75rem' }}>
                  {report ? <ProvenanceList report={report} /> : <div className="registry-provenance">No registry report attached to this evaluation.</div>}
                </div>

                <div className="doc-verification-strip">
                  <div className="strip-item">
                    <span className="strip-lbl">JEV VERDICT</span>
                    <span className="strip-val">{data.jevAudit?.verdict || NA}</span>
                  </div>
                  <div className="strip-item">
                    <span className="strip-lbl">BALANCE CONTINUITY</span>
                    <span className="strip-val">{telemetry.balanceContinuity?.status || decision.agentSafetyAudit?.dataIntegrityStatus || NA}</span>
                  </div>
                  <div className="strip-item">
                    <span className="strip-lbl">REGISTRY REPORT</span>
                    <span className="strip-val">{report ? `Generated ${report.generatedAt || '—'}` : NA}</span>
                  </div>
                </div>

                <pre className="raw-json-pre">{rawJson}</pre>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
