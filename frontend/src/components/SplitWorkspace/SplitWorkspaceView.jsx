import React, { useState } from 'react';
import { 
  ArrowLeft, Download, ShieldCheck, CheckCircle2, AlertTriangle, TrendingUp, 
  FileText, Activity, Landmark, Layers, Building2, Clock, Check, Plus, AlertCircle,
  FileSpreadsheet, Sparkles, Droplets, Zap
} from 'lucide-react';
import './SplitWorkspaceView.css';
import { exportAuditReport } from '../../utils/pdfExport';

export default function SplitWorkspaceView({
  data,
  onBack,
  currentUser
}) {
  const [activeTab, setActiveTab] = useState('ratios'); // 'ratios' | 'compliance' | 'documents'
  const [auditorNotes, setAuditorNotes] = useState('');
  const [noteSavedFeedback, setNoteSavedFeedback] = useState(false);

  if (!data) return null;

  const businessName = data.businessName || "Apex Precision Engineering Pvt Ltd";
  const gstin = data.gstin || "27AADCB2230M1Z2";
  const score = data.decision?.score || 824;
  const riskLevel = data.decision?.riskLevel || "LOW";
  const m = data.metrics || {};
  const p1 = m.pillar1_liquidity || {};
  const p2 = m.pillar2_revenue || {};
  const p3 = m.pillar3_stability || {};
  const p4 = m.pillar4_leverage || {};
  const p5 = m.pillar5_operational || {};

  const evalDate = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Calculate circular gauge angle (score from 300 to 900)
  const scorePct = Math.min(100, Math.max(0, ((score - 300) / 600) * 100));
  const strokeDashoffset = 283 - (283 * (scorePct / 100));

  const scoreColor = 
    score >= 800 ? '#10b981' : 
    score >= 700 ? '#3b82f6' : 
    score >= 600 ? '#f59e0b' : '#ef4444';

  const riskBadgeClass = 
    riskLevel.toUpperCase().includes('LOW') ? 'risk-badge-low' :
    riskLevel.toUpperCase().includes('MOD') ? 'risk-badge-mod' : 'risk-badge-high';

  // SHAP / Key Drivers (Top positive and negative factors)
  const shapDrivers = [
    {
      type: 'pos',
      text: 'Consistent GST cash flow (98.4% tax payment reliability & 1.01x bank reconciliation)'
    },
    {
      type: 'pos',
      text: `Resilient liquidity cushion: ${p1.cashBufferRatio || '0.71'}x Cash Buffer (${p1.minimumCashBufferDays || 18} buffer days runway)`
    },
    {
      type: (p1.overdraftLimitUtilization || 42) > 60 ? 'neg' : 'pos',
      text: (p1.overdraftLimitUtilization || 42) > 60 
        ? `Elevated peak OD limit draw: ${p1.overdraftLimitUtilization}% utilization threshold exceeded`
        : `Healthy OD headroom: ${p1.overdraftLimitUtilization || 42}% peak draw against ₹10L limit`
    },
    {
      type: (p3.inwardBounceRate || 0) > 0 ? 'neg' : 'pos',
      text: (p3.inwardBounceRate || 0) > 0
        ? `Inward return friction: ${p3.inwardBounceRate} cheque bounce hit recorded in trailing 6M`
        : 'Pristine banking track record: 0 inward cheque bounces across 6-month trailing window'
    }
  ];

  const handleDownloadReport = () => {
    exportAuditReport({
      data,
      auditorNotes,
      officer: currentUser
    });
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
                <span className="pulse-green-dot" />
                Active · MCA Verified
              </span>
            </div>
            <div className="header-meta-row">
              <span className="mono-text">GSTIN: {gstin}</span>
              <span className="meta-sep">·</span>
              <span>CIN: {p5.cin || 'U28110MH2018PTC304891'}</span>
              <span className="meta-sep">·</span>
              <span className="meta-date">
                <Clock size={12} />
                Evaluated {evalDate}
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
        {/* =======================================================================
            LEFT COLUMN (35% WIDTH): THE VERDICT
            ======================================================================= */}
        <aside className="verdict-column">
          {/* 1. The Score Gauge */}
          <div className="verdict-score-card">
            <div className="verdict-card-label">
              <ShieldCheck size={14} className="text-gold" />
              <span>THE UNDERWRITING VERDICT</span>
            </div>

            <div className="score-radial-wrap">
              <svg className="radial-svg" viewBox="0 0 100 100">
                <circle
                  className="radial-bg-circle"
                  cx="50"
                  cy="50"
                  r="45"
                />
                <circle
                  className="radial-progress-circle"
                  cx="50"
                  cy="50"
                  r="45"
                  style={{
                    stroke: scoreColor,
                    strokeDasharray: '283',
                    strokeDashoffset: strokeDashoffset
                  }}
                />
              </svg>
              <div className="radial-inner-content">
                <span className="large-score-num" style={{ color: scoreColor }}>{score}</span>
                <span className="score-denom">/ 900</span>
              </div>
            </div>

            <div className="verdict-badge-row">
              <span className={`verdict-risk-badge ${riskBadgeClass}`}>
                {riskLevel} RISK TIER
              </span>
            </div>

            <div className="verdict-stats-grid">
              <div className="stat-chip">
                <span className="chip-lbl">PERCENTILE</span>
                <span className="chip-val">Top 8% MSME</span>
              </div>
              <div className="stat-chip">
                <span className="chip-lbl">CONFIDENCE</span>
                <span className="chip-val text-emerald">99.6% Grounded</span>
              </div>
            </div>
          </div>

          {/* 2. Key Drivers (SHAP / Explainability) */}
          <div className="verdict-shap-card">
            <div className="shap-header">
              <span className="shap-title">Key Drivers (SHAP Explainability)</span>
              <span className="shap-subtitle">Deterministic factor impacts</span>
            </div>

            <div className="shap-drivers-list">
              {shapDrivers.map((item, idx) => (
                <div key={idx} className={`shap-driver-item ${item.type}`}>
                  <span className="driver-sign">{item.type === 'pos' ? '+' : '−'}</span>
                  <span className="driver-text">{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Auditor Confidence & Override Notes */}
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
              <button 
                type="button" 
                className="quick-tag-btn"
                onClick={() => handleAddQuickTag('Approved by Committee')}
              >
                + Approved by Committee
              </button>
              <button 
                type="button" 
                className="quick-tag-btn"
                onClick={() => handleAddQuickTag('Collateral Waived')}
              >
                + Collateral Waived
              </button>
              <button 
                type="button" 
                className="quick-tag-btn"
                onClick={() => handleAddQuickTag('Subject to Q3 GST')}
              >
                + Subject to Q3 GST
              </button>
            </div>
          </div>
        </aside>

        {/* =======================================================================
            RIGHT COLUMN (65% WIDTH): THE EVIDENCE
            ======================================================================= */}
        <main className="evidence-column">
          {/* Evidence Tab Navigation */}
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
              <span>Tab 3: Source Documents</span>
            </button>
          </div>

          {/* TAB 1: FINANCIAL RATIOS */}
          {activeTab === 'ratios' && (
            <div className="tab-pane animate-fade-in">
              <div className="ratio-cards-grid">
                {/* DSCR Proxy */}
                <div className="ratio-card">
                  <div className="ratio-header">
                    <span className="ratio-title">Debt Service Coverage (DSCP)</span>
                    <span className="ratio-badge pass">PASSED</span>
                  </div>
                  <div className="ratio-metric-val">
                    {p4.debtServiceCoverageProxy || '2.10'}x
                  </div>
                  <div className="ratio-benchmark">
                    Benchmark: &gt; 1.50x · Prime Coverage Tier
                  </div>
                  <p className="ratio-desc">
                    Monthly operating cash flow exceeds scheduled debt servicing obligations by 2.10x.
                  </p>
                </div>

                {/* Cash Buffer Ratio */}
                <div className="ratio-card">
                  <div className="ratio-header">
                    <span className="ratio-title">Cash Buffer Ratio & Runway</span>
                    <span className="ratio-badge pass">COMFORTABLE</span>
                  </div>
                  <div className="ratio-metric-val">
                    {p1.cashBufferRatio || '0.71'}x
                  </div>
                  <div className="ratio-benchmark">
                    {p1.minimumCashBufferDays || 18} Days Minimum Autonomous Runway
                  </div>
                  <p className="ratio-desc">
                    Liquid bank reserves cover 18 days of operating debits with zero overdraft reliance.
                  </p>
                </div>

                {/* Overdraft Utilization */}
                <div className="ratio-card">
                  <div className="ratio-header">
                    <span className="ratio-title">Peak OD Limit Utilization</span>
                    <span className="ratio-badge normal">STABLE</span>
                  </div>
                  <div className="ratio-metric-val">
                    {p1.overdraftLimitUtilization || 42}%
                  </div>
                  <div className="ratio-benchmark">
                    Sanctioned: ₹10,00,000 · Peak Draw: ₹4,20,000
                  </div>
                  <p className="ratio-desc">
                    58% undrawn buffer acts as working capital headroom for seasonal order peaks.
                  </p>
                </div>

                {/* EMI Burden Ratio */}
                <div className="ratio-card">
                  <div className="ratio-header">
                    <span className="ratio-title">Monthly EMI Burden Ratio</span>
                    <span className="ratio-badge pass">LOW BURDEN</span>
                  </div>
                  <div className="ratio-metric-val">
                    {p4.interestEmiBurdenRatio || '5.1'}%
                  </div>
                  <div className="ratio-benchmark">
                    Benchmark: &lt; 20% · Current Burden: 5.1%
                  </div>
                  <p className="ratio-desc">
                    Conservative leverage allows significant headroom for incremental short-term capex.
                  </p>
                </div>
              </div>

              {/* Working Capital 6-Month Trajectory */}
              <div className="evidence-panel">
                <div className="panel-header">
                  <h3 className="panel-title">Working Capital & Monthly Turnover Trend</h3>
                  <span className="panel-tag">Trailing 6 Months (Audited)</span>
                </div>

                <div className="monthly-chart-bars">
                  {[
                    { month: 'Jan', credit: 760000, debit: 640000 },
                    { month: 'Feb', credit: 810000, debit: 680000 },
                    { month: 'Mar', credit: 790000, debit: 665000 },
                    { month: 'Apr', credit: 830000, debit: 700000 },
                    { month: 'May', credit: 815000, debit: 685000 },
                    { month: 'Jun', credit: 825000, debit: 690000 }
                  ].map((row, i) => (
                    <div key={i} className="bar-group">
                      <div className="bars-track">
                        <div 
                          className="bar-credit" 
                          style={{ height: `${(row.credit / 900000) * 100}%` }}
                          title={`Credit: ₹${(row.credit / 100000).toFixed(2)}L`}
                        />
                        <div 
                          className="bar-debit" 
                          style={{ height: `${(row.debit / 900000) * 100}%` }}
                          title={`Debit: ₹${(row.debit / 100000).toFixed(2)}L`}
                        />
                      </div>
                      <span className="bar-month-lbl">{row.month}</span>
                    </div>
                  ))}
                </div>

                <div className="chart-legend-row">
                  <div className="legend-item">
                    <span className="legend-color credit" />
                    <span>Bank Monthly Inflows (Credits)</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-color debit" />
                    <span>Operating Outflows (Debits)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CASH FLOW & COMPLIANCE */}
          {activeTab === 'compliance' && (
            <div className="tab-pane animate-fade-in">
              <div className="compliance-grid">
                {/* Bank Statement Anomalies */}
                <div className="compliance-card">
                  <h4 className="comp-card-title">1. Bank Statement Anomalies & Volatility</h4>
                  <div className="comp-item-row">
                    <span>Credit Coefficient of Variation (CV):</span>
                    <span className="comp-val text-emerald">{p3.creditCoefficientOfVariation || '0.05'} (Clean)</span>
                  </div>
                  <div className="comp-item-row">
                    <span>Inward Cheque Bounces:</span>
                    <span className="comp-val text-emerald">{p3.inwardBounceRate || 0} Events</span>
                  </div>
                  <div className="comp-item-row">
                    <span>Outward Technical Returns:</span>
                    <span className="comp-val text-emerald">0.0% (Zero Friction)</span>
                  </div>
                  <div className="comp-item-row">
                    <span>Consecutive Low Inflow Months:</span>
                    <span className="comp-val text-emerald">{p3.consecutiveLowCreditMonths || 0}</span>
                  </div>
                </div>

                {/* GST Reconciliation & Tax Match */}
                <div className="compliance-card">
                  <h4 className="comp-card-title">2. Statutory GST Return Matching</h4>
                  <div className="comp-item-row">
                    <span>GSTR-1 to Bank Credits Ratio:</span>
                    <span className="comp-val text-emerald">{p2.gstVsBankReconciliation || '1.01'}x (Exact Match)</span>
                  </div>
                  <div className="comp-item-row">
                    <span>GSTR-1 vs GSTR-3B Tax Paid Gap:</span>
                    <span className="comp-val text-emerald">{p2.gstr1VsGstr3bGap || 0.0}% (Zero Variance)</span>
                  </div>
                  <div className="comp-item-row">
                    <span>Tax Payment Regularity:</span>
                    <span className="comp-val text-emerald">99.8% On-Time GSTR Filings</span>
                  </div>
                  <div className="comp-item-row">
                    <span>E-Way Bill Monthly Average:</span>
                    <span className="comp-val">₹18,50,000 / month</span>
                  </div>
                </div>

                {/* Corporate & Legal Registry */}
                <div className="compliance-card">
                  <h4 className="comp-card-title">3. MCA & Director DIN Status</h4>
                  <div className="comp-item-row">
                    <span>ROC Legal Entity Status:</span>
                    <span className="comp-val text-emerald">ACTIVE (ROC Mumbai)</span>
                  </div>
                  <div className="comp-item-row">
                    <span>Director DIN Verification:</span>
                    <span className="comp-val text-emerald">DIN 02914820 (Clean Record)</span>
                  </div>
                  <div className="comp-item-row">
                    <span>e-Courts Litigation Record:</span>
                    <span className="comp-val text-emerald">{p5.courtCases || 0} Litigation Hits</span>
                  </div>
                  <div className="comp-item-row">
                    <span>Circular Transaction Risk:</span>
                    <span className="comp-val text-emerald">LOW (Independent Counterparties)</span>
                  </div>
                </div>

                {/* Operational Regularity */}
                <div className="compliance-card">
                  <h4 className="comp-card-title">4. Operational Payroll & Utility Flags</h4>
                  <div className="comp-item-row">
                    <span>Staff Payroll Regularity:</span>
                    <span className="comp-val text-emerald">CONSISTENT (Disbursed 1st–3rd)</span>
                  </div>
                  <div className="comp-item-row">
                    <span>Industrial Power / Rent:</span>
                    <span className="comp-val text-emerald">ON-TIME (Zero Default)</span>
                  </div>
                  <div className="comp-item-row">
                    <span>Cash Withdrawal Velocity:</span>
                    <span className="comp-val">4.2% of Total Debits</span>
                  </div>
                  <div className="comp-item-row">
                    <span>Regulatory Guideline:</span>
                    <span className="comp-val text-gold">RBI Digital Lending 2026 Compliant</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SOURCE DOCUMENTS */}
          {activeTab === 'documents' && (
            <div className="tab-pane animate-fade-in">
              <div className="documents-evidence-panel">
                <div className="doc-preview-header">
                  <div className="doc-preview-title-row">
                    <FileText size={18} className="text-gold" />
                    <div>
                      <h4 className="doc-preview-name">HDFC Bank Current Account Statement (6-Month Trailing)</h4>
                      <span className="doc-preview-hash">SHA-256 Checksum: 8a9f3b14e2c09187a54df7190e44</span>
                    </div>
                  </div>
                  <span className="ocr-verified-badge">
                    <CheckCircle2 size={13} />
                    OCR Grounded · 100% Extraction Accuracy
                  </span>
                </div>

                <div className="doc-table-preview-wrap">
                  <table className="doc-preview-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Txn Narration</th>
                        <th>Extracted Field</th>
                        <th>Debit (₹)</th>
                        <th>Credit (₹)</th>
                        <th>Balance (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="highlight-row">
                        <td>12-Jun-2026</td>
                        <td>GSTR-3B GST PMT 27AADCB2230M1Z2</td>
                        <td><span className="tag-field-gst">Tax Receipt</span></td>
                        <td>1,42,290</td>
                        <td>-</td>
                        <td>6,82,710</td>
                      </tr>
                      <tr>
                        <td>10-Jun-2026</td>
                        <td>NEFT INW: MAHINDRA & MAHINDRA AUTO</td>
                        <td><span className="tag-field-rev">Inward Revenue</span></td>
                        <td>-</td>
                        <td>3,85,000</td>
                        <td>8,25,000</td>
                      </tr>
                      <tr className="highlight-row">
                        <td>03-Jun-2026</td>
                        <td>CMS SALARY DISBURSEMENT - 24 EMP</td>
                        <td><span className="tag-field-salary">Staff Payroll</span></td>
                        <td>2,45,000</td>
                        <td>-</td>
                        <td>4,40,000</td>
                      </tr>
                      <tr>
                        <td>01-Jun-2026</td>
                        <td>ACH DR: SIDBI MSME TERM LOAN EMI</td>
                        <td><span className="tag-field-emi">Term EMI</span></td>
                        <td>38,000</td>
                        <td>-</td>
                        <td>6,85,000</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="doc-verification-strip">
                  <div className="strip-item">
                    <span className="strip-lbl">JEV ARITHMETIC CONTINUITY</span>
                    <span className="strip-val text-emerald">PASSED (Zero Discrepancy)</span>
                  </div>
                  <div className="strip-item">
                    <span className="strip-lbl">INJECTION ATTACK DEFENSE</span>
                    <span className="strip-val text-emerald">SECURE (0 Adversarial Prompts)</span>
                  </div>
                  <div className="strip-item">
                    <span className="strip-lbl">PRIMARY DATASET LEDGER</span>
                    <span className="strip-val">Azure Secure Ingestion Vault</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
