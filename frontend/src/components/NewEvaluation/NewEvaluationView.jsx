import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, UploadCloud, FileText, CheckCircle2, AlertTriangle, ArrowRight, 
  Building2, Sparkles, X, ShieldCheck, RefreshCw, Copy, Check, Terminal,
  Layers, ChevronDown, ExternalLink, Shield, TrendingUp, DollarSign, Activity, Brain
} from 'lucide-react';
import './NewEvaluationView.css';
import { getCompanyDecisionData } from '../../utils/orcIntelligence';
import { isDemoMode } from '../../utils/demoMode';
import RegistryProbeCard, { ProvenanceList, formatAdjustment } from '../Registry/RegistryProbeCard';
import RegistryScreeningReport from '../Registry/RegistryScreeningReport';
import SampleDataBadge from '../SampleDataBadge/SampleDataBadge';
import { sanitizeText } from '../../utils/sanitize';
import OrcTerminal from '../OrcTerminal/OrcTerminal';
import ScrollStack, { ScrollStackItem } from '../ScrollStack/ScrollStack';
import ThinkingOrb from '../ThinkingOrb/ThinkingOrb';

const NA = 'Not available';
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const fmt = (v, suffix = '') => (isNum(v) ? `${v}${suffix}` : NA);
const fmtLakhs = (v) => (isNum(v) ? `₹${(v / 100000).toFixed(2)} LACS` : NA);
// Value colour: green when good(v), red when bad(v), default otherwise or when unavailable.
const tone = (v, good, bad) => (!isNum(v) ? undefined : good(v) ? 'var(--status-green-text)' : bad(v) ? 'var(--status-red-text)' : undefined);
const NA_BADGE = { badge: 'badge-neutral', label: 'NOT AVAILABLE' };

function pillarBadges(m, mcaStatus) {
  const p1 = !isNum(m.cashBufferRatio) ? NA_BADGE
    : m.cashBufferRatio >= 0.40 ? { badge: 'badge-comfortable', label: `COMFORTABLE (${m.cashBufferRatio}x)` }
    : m.cashBufferRatio >= 0.20 ? { badge: 'badge-moderate', label: `TIGHT (${m.cashBufferRatio}x)` }
    : { badge: 'badge-stressed', label: `DEPLETED (${m.cashBufferRatio}x)` };
  const p2 = !isNum(m.revenueGrowthRate) ? NA_BADGE
    : m.revenueGrowthRate >= 3 ? { badge: 'badge-prime', label: `EXPANSIONARY (+${m.revenueGrowthRate}%)` }
    : m.revenueGrowthRate >= 0 ? { badge: 'badge-stable', label: `FLAT (+${m.revenueGrowthRate}%)` }
    : { badge: 'badge-contracting', label: `CONTRACTING (${m.revenueGrowthRate}%)` };
  const p3 = isNum(m.inwardBounces) && m.inwardBounces > 0 ? { badge: 'badge-friction', label: `${m.inwardBounces} BOUNCE${m.inwardBounces > 1 ? 'S' : ''}` }
    : !isNum(m.creditCV) ? (isNum(m.inwardBounces) ? { badge: 'badge-consistent', label: '0 BOUNCES' } : NA_BADGE)
    : m.creditCV <= 0.20 ? { badge: 'badge-consistent', label: `DISCIPLINED (CV ${m.creditCV})` }
    : { badge: 'badge-stressed', label: `VOLATILE (CV ${m.creditCV})` };
  const p4 = !isNum(m.dscp) ? NA_BADGE
    : m.dscp >= 1.80 ? { badge: 'badge-prime', label: `PRIME DSCP (${m.dscp}x)` }
    : m.dscp >= 1.40 ? { badge: 'badge-adequate', label: `ADEQUATE DSCP (${m.dscp}x)` }
    : m.dscp >= 1.00 ? { badge: 'badge-moderate', label: `TIGHT DSCP (${m.dscp}x)` }
    : { badge: 'badge-leveraged', label: `STRESSED DSCP (${m.dscp}x)` };
  const status = String(mcaStatus || '').trim();
  const p5 = !status || /^not verified$/i.test(status) ? { badge: 'badge-neutral', label: 'MCA NOT VERIFIED' }
    : /^active$/i.test(status) ? { badge: 'badge-clean', label: 'MCA ACTIVE' }
    : { badge: 'badge-stressed', label: `MCA ${status.toUpperCase()}` };
  return [p1, p2, p3, p4, p5];
}

// Demo-mode presets only (labelled SAMPLE DATA).
const SUGGESTIONS = [
  { gstin: '27AADCB2230M1Z2', label: 'Apex Precision Engineering (Pune)', turnover: '₹96.4L', score: 824 },
  { gstin: '24AABCS4421P1Z9', label: 'Surat Textile Weaving LLP (Surat)', turnover: '₹1.42Cr', score: 765 },
  { gstin: '27AAGCK8812L1ZQ', label: 'Kalyan Agro Supply & Logistics', turnover: '₹68.0L', score: 610 },
  { gstin: '27AAHCE5539J1ZA', label: 'Enver AI Tech Pvt Ltd (Mumbai)', turnover: '₹96.8L', score: 865 },
  { gstin: '27AAACT2727Q1ZW', label: 'Tata Motors Passenger Vehicles', turnover: '₹280Cr', score: 885 },
  { gstin: '27AABPQ1063C1Z5', label: 'Kariman Enterprises (Mumbai)', turnover: '₹90.6L', score: 790 }
];

export default function NewEvaluationView({
  gstinInput,
  setGstinInput,
  gstinProbeData,
  onProbeGSTIN,
  file,
  onFileChange,
  onClearFile,
  onTriggerEvaluation,
  loading = false,
  evaluationStep = 0,
  error = null,
  onClearError,
  onOpenSplitWorkspace,
  evaluationData = null,
  probeState = { loading: false, error: null }
}) {
  const [dragActive, setDragActive] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [activeBottomTab, setActiveBottomTab] = useState(loading ? 'orb' : 'terminal'); // 'orb' | 'findings' | 'terminal'
  const fileInputRef = useRef(null);
  const prevLoadingRef = useRef(loading);

  // When evaluation starts, switch to Thinking Orb. When it finishes, shift to Findings!
  useEffect(() => {
    if (loading) {
      setActiveBottomTab('orb');
    } else if (prevLoadingRef.current && !loading) {
      // Switched from loading to done! Smoothly shift to findings deck
      setActiveBottomTab('findings');
    }
    prevLoadingRef.current = loading;
  }, [loading]);

  // Handle Drag & Drop
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileChange({ target: { files: e.dataTransfer.files } });
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleQuickPick = (item) => {
    setGstinInput(item.gstin);
    onProbeGSTIN(item.gstin);
  };

  const report = gstinProbeData?.registryReport || evaluationData?.registryReport || null;
  const legalName = report?.gst?.status === 'ok' ? report.gst.data?.legalName || null : null;
  const isResolved = Boolean(legalName);
  const businessName = evaluationData?.businessName || legalName || (file?.name ? file.name.replace(/\.[^/.]+$/, '').toUpperCase() : 'Enterprise');
  const gstinToDisplay = evaluationData?.gstin || gstinProbeData?.gstin || gstinInput || '';
  const isScreening = evaluationData?.reportType === 'REGISTRY_SCREENING';
  const previewDecision = isScreening ? null : getCompanyDecisionData(businessName, gstinToDisplay, gstinProbeData, evaluationData);
  const previewColor = previewDecision ? (previewDecision.score >= 750 ? 'var(--status-green-text)' : previewDecision.score >= 620 ? 'var(--status-amber-text)' : 'var(--status-red-text)') : undefined;
  const previewBadge = previewDecision ? (previewDecision.score >= 750 ? 'badge-comfortable' : previewDecision.score >= 620 ? 'badge-moderate' : 'badge-stressed') : '';
  const m = previewDecision?.metrics || {};
  const [pillar1, pillar2, pillar3, pillar4, pillar5] = pillarBadges(m, previewDecision?.mcaStatus);
  const selectCin = (cin) => onProbeGSTIN(gstinProbeData?.gstin || gstinInput, { cin });

  return (
    <div className="new-evaluation-view animate-fade-up">
      {/* =========================================================================
          TOP ACTION BAR (HERO AREA)
          ========================================================================= */}
      <section className="hero-action-bar">
        <div className="hero-header-line">
          <div>
            <h1 className="hero-title">Intake & Instant Underwriting Verification</h1>
            <p className="hero-subtitle">
              Enter any enterprise identity or drop statutory statements to initiate autonomous 5-pillar underwriting.
            </p>
          </div>
          <div className="hero-badge">
            <ShieldCheck size={14} className="text-emerald" />
            <span>HITL OPERATOR GATEWAY ACTIVE</span>
          </div>
        </div>

        {/* Input Zone: Grid of Instant Search + Document Dropzone */}
        <div className="hero-inputs-grid">
          {/* Instant Search Bar */}
          <div className="hero-search-card">
            <div className="card-input-label">
              <Building2 size={15} />
              <span>1. INSTANT REGISTRY LOOKUP</span>
            </div>
            
            <div className="search-bar-wrap">
              <Search className="search-icon" size={18} />
              <input
                type="text"
                className="search-input"
                placeholder="Enter a 15-character GSTIN"
                value={gstinInput}
                onChange={(e) => {
                  const val = sanitizeText(e.target.value.toUpperCase(), 35);
                  setGstinInput(val);
                  // App validates and debounces; a non-GSTIN value clears the probe card.
                  onProbeGSTIN(val);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onProbeGSTIN(gstinInput.trim());
                  }
                }}
              />
              {gstinInput && (
                <button 
                  className="clear-search-btn"
                  onClick={() => {
                    setGstinInput('');
                    onProbeGSTIN('');
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {probeState.loading && (
              <div style={{ marginTop: 8, fontSize: '0.8rem' }}><span className="registry-unavailable">Looking up GSTN and MCA21…</span></div>
            )}
            {probeState.error && (
              <div style={{ marginTop: 8, fontSize: '0.8rem' }}><span style={{ color: 'var(--status-red-text)' }}>{probeState.error}</span></div>
            )}

            {/* Quick Suggestions Chips (demo mode only) */}
            {isDemoMode && (
              <div className="search-suggestions-wrap">
                <span className="suggestions-label">Presets: <SampleDataBadge /></span>
                <div className="suggestions-list">
                  {SUGGESTIONS.map((item) => (
                    <button
                      key={item.gstin}
                      className={`suggestion-chip ${gstinInput === item.gstin ? 'active' : ''}`}
                      onClick={() => handleQuickPick(item)}
                    >
                      <span>{item.label}</span>
                      <span className="chip-score-tag">{item.score}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Document Dropzone */}
          <div 
            className={`hero-dropzone-card ${dragActive ? 'drag-active' : ''} ${file ? 'has-file' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".pdf,.csv,.xlsx,.json" 
              className="hidden-file-input" 
              onChange={onFileChange}
            />

            {!file ? (
              <div className="dropzone-empty-state">
                <div className="dropzone-icon-circle">
                  <UploadCloud size={24} />
                </div>
                <div className="dropzone-text">
                  <span className="dropzone-main-text">
                    <strong>Drop Bank Statement or GST Returns here</strong> or click to browse
                  </span>
                  <span className="dropzone-sub-text">
                    Supports PDF statements, GSTR-1/3B CSV, or Excel financials (Up to 25MB)
                  </span>
                </div>
              </div>
            ) : (
              <div className="dropzone-selected-state" onClick={e => e.stopPropagation()}>
                <div className="dropzone-file-icon">
                  <FileText size={24} />
                </div>
                <div className="dropzone-file-info">
                  <div className="file-name">{file.name}</div>
                  <div className="file-meta">
                    {(file.size / 1024).toFixed(1)} KB · Ready for OCR & Table Extraction
                  </div>
                </div>
                <button 
                  className="file-remove-btn" 
                  onClick={(e) => {
                    e.stopPropagation();
                    onClearFile();
                  }}
                  title="Remove Document"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* JEV System 1 Gatekeeper Rejection / Security Banner */}
        {error && (
          <div className="jev-rejection-banner animate-fade-in" style={{
            marginTop: '1.25rem',
            padding: '1rem 1.25rem',
            background: 'var(--status-red-bg)',
            border: '1px solid var(--status-red-border)',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            color: 'var(--status-red-text)'
          }}>
            <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                🛡️ JEV System 1 Security Sentinel Notice
              </div>
              <div style={{ fontSize: '0.85rem', marginTop: '4px', color: 'var(--text-primary)', lineHeight: 1.45 }}>
                {error}
              </div>
            </div>
            {onClearError && (
              <button 
                onClick={onClearError} 
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--status-red-text)', padding: '4px' }}
                title="Dismiss Alert"
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}

        {/* HITL Operator Authorization Confirmation Card */}
        {(isResolved || gstinProbeData?.registryReport || file) && (
          <div className="hitl-authorization-card animate-fade-up">
            <div className="hitl-card-header">
              <div className="hitl-entity-meta">
                <h2 className="entity-legal-name">{businessName}</h2>
                <div className="entity-id-row">
                  <span><strong>GSTIN:</strong> {gstinProbeData?.gstin || gstinInput || 'Auto-Detect from Statement'}</span>
                  <span className="id-sep">·</span>
                  <span><strong>Document:</strong> {file ? file.name : 'GSTN Registry Feed'}</span>
                </div>
                {gstinProbeData?.registryReport && (
                  <RegistryProbeCard report={gstinProbeData.registryReport} onSelectCin={selectCin} />
                )}
              </div>

              <div className="hitl-action-buttons">
                <button
                  className="authorize-generate-btn"
                  onClick={() => onTriggerEvaluation()}
                  disabled={loading}
                  style={loading ? { opacity: 0.85, cursor: 'wait' } : {}}
                >
                  <Sparkles size={16} className={loading ? "animate-spin" : ""} />
                  <span>
                    {loading 
                      ? '⚡ EVALUATING 5-PILLAR FINANCIAL AUDIT...' 
                      : (file ? '⚡ INGEST & GENERATE CREDIT SCORE' : '⚡ RUN REGISTRY SCREENING')}
                  </span>
                </button>
                <button
                  className="hitl-change-btn"
                  onClick={() => {
                    setGstinInput('');
                    onProbeGSTIN('');
                    if (onClearFile) onClearFile();
                    if (onClearError) onClearError();
                  }}
                  disabled={loading}
                >
                  Clear / Reset
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* =========================================================================
          LOWER SECTION: ORC TERMINAL & SCROLLSTACK FINDINGS DECK
          ========================================================================= */}
      <section className="intake-workspace-section">
        {/* Navigation Selector Bar */}
        <div className="intake-section-nav">
          <button 
            type="button"
            className={`intake-nav-btn ${activeBottomTab === 'orb' ? 'active' : ''}`}
            onClick={() => setActiveBottomTab('orb')}
          >
            <Brain size={16} />
            <span>Autonomous Thinking Orb</span>
            {loading ? (
              <span className="nav-badge-live pulsing">REASONING</span>
            ) : (
              <span className="nav-badge-count">AGENT AI</span>
            )}
          </button>

          <button 
            type="button"
            className={`intake-nav-btn ${activeBottomTab === 'findings' ? 'active' : ''}`}
            onClick={() => setActiveBottomTab('findings')}
          >
            <Layers size={16} />
            <span>Audit Findings Deck (ScrollStack)</span>
            <span className="nav-badge-count">6 Pillar Cards</span>
          </button>

          <button 
            type="button"
            className={`intake-nav-btn ${activeBottomTab === 'terminal' ? 'active' : ''}`}
            onClick={() => setActiveBottomTab('terminal')}
          >
            <Terminal size={16} />
            <span>Orc CCO Intelligence Terminal</span>
            <span className="nav-badge-live">DAEMON ACTIVE</span>
          </button>
        </div>

        {/* Tab 1: Autonomous Thinking Orb */}
        {activeBottomTab === 'orb' && (
          <div className="orb-view-wrap animate-fade-in">
            <ThinkingOrb 
              isEvaluating={loading}
              activeStep={evaluationStep}
              businessName={businessName}
              onSwitchToFindings={() => setActiveBottomTab('findings')}
            />
          </div>
        )}

        {/* Tab 2: Orc Terminal (Interactive Underwriter Chat) */}
        {activeBottomTab === 'terminal' && (
          <div className="terminal-view-wrap animate-fade-in">
            <OrcTerminal 
              currentBusiness={{
                name: businessName,
                gstin: gstinToDisplay,
                probeData: gstinProbeData
              }}
              evaluationPayload={evaluationData}
              onQuickInspect={() => setActiveBottomTab('findings')}
            />
          </div>
        )}

        {/* Tab 2: Findings Deck presented in ScrollStack */}
        {activeBottomTab === 'findings' && (
          <div className="findings-scrollstack-container animate-fade-in">
            <div className="findings-meta-bar">
              <div>
                <span className="findings-target-tag">Grounded Findings for:</span>
                <h3 className="findings-target-name">
                  {businessName} {previewDecision?.sampleData && <SampleDataBadge />}
                </h3>
                <span className="findings-target-sub font-mono">GSTIN: {gstinToDisplay || '—'}{previewDecision ? ' · Scroll down to inspect stacking pillar cards' : ''}</span>
              </div>
              <button
                type="button"
                className="launch-full-split-btn"
                disabled={!evaluationData || isScreening}
                style={!evaluationData || isScreening ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                title={isScreening ? 'Registry screenings have no credit workspace. Upload a bank statement for a full evaluation.' : (!evaluationData ? 'Run an evaluation first' : undefined)}
                onClick={() => { if (evaluationData && !isScreening && onOpenSplitWorkspace) onOpenSplitWorkspace(); }}
              >
                <span>Open Full Split Workspace</span>
                <ExternalLink size={14} />
              </button>
            </div>

            {isScreening ? (
              <RegistryScreeningReport payload={evaluationData} onSelectCin={selectCin} />
            ) : !previewDecision ? (
              <div className="registry-card registry-unavailable">Run an evaluation to see findings.</div>
            ) : (
            <ScrollStack
              itemDistance={100}
              itemStackDistance={26}
              stackPosition="8%"
              baseScale={0.88}
              itemScale={0.04}
              dimAmount={0.25}
              className="audit-findings-deck"
            >
              {/* Card 1: Pillar 1 Liquidity & Cash Buffer Ratio */}
              <ScrollStackItem itemClassName="finding-stack-card">
                <div className="finding-card-header">
                  <div className="finding-card-pillar-tag">
                    <Activity size={15} />
                    <span>PILLAR 01 · LIQUIDITY & SURVIVAL RUNWAY</span>
                  </div>
                  <span className={`finding-card-badge ${pillar1.badge}`}>{pillar1.label}</span>
                </div>
                <h4 className="finding-card-title">Cash Buffer Ratio & Autonomous Survival Runway</h4>
                <div className="finding-metrics-row">
                  <div className="finding-metric-box">
                    <div className="finding-metric-label">CASH BUFFER RATIO</div>
                    <div className="finding-metric-value" style={{ color: tone(m.cashBufferRatio, v => v >= 0.40, v => v < 0.20) }}>{fmt(m.cashBufferRatio, 'x')}</div>
                    <div className="finding-metric-sub">Benchmark: &gt; 0.25x</div>
                  </div>
                  <div className="finding-metric-box">
                    <div className="finding-metric-label">SURVIVAL RUNWAY</div>
                    <div className="finding-metric-value">{fmt(m.survivalRunwayDays, ' Days')}</div>
                    <div className="finding-metric-sub">Derived from cash buffer ratio</div>
                  </div>
                  <div className="finding-metric-box">
                    <div className="finding-metric-label">OVERDRAFT UTILIZATION</div>
                    <div className="finding-metric-value">{fmt(m.odUtilization, '%')}</div>
                    <div className="finding-metric-sub">Peak drawn ÷ sanctioned OD limit</div>
                  </div>
                </div>
                <div className="finding-citation-box">
                  <strong>Method:</strong> Cash Buffer Ratio is Bank Closing Balance divided by Average Monthly Debit outflows; survival runway is the ratio expressed in operating days. Inputs not present in the statement are shown as "Not available" and are not scored.
                </div>
              </ScrollStackItem>

              {/* Card 2: Pillar 2 Revenue Run-Rate & GST Reconciliation */}
              <ScrollStackItem itemClassName="finding-stack-card">
                <div className="finding-card-header">
                  <div className="finding-card-pillar-tag">
                    <TrendingUp size={15} />
                    <span>PILLAR 02 · REVENUE MOMENTUM & TAX ATTESTATION</span>
                  </div>
                  <span className={`finding-card-badge ${pillar2.badge}`}>{pillar2.label}</span>
                </div>
                <h4 className="finding-card-title">Annualized Revenue & Statutory Turnover Reconciliation</h4>
                <div className="finding-metrics-row">
                  <div className="finding-metric-box">
                    <div className="finding-metric-label">ANNUALIZED RUN RATE</div>
                    <div className="finding-metric-value">{fmtLakhs(m.annualizedRevenue)}</div>
                    <div className="finding-metric-sub">{isNum(m.revenueGrowthRate) ? `${m.revenueGrowthRate >= 0 ? '+' : ''}${m.revenueGrowthRate}% half-on-half momentum` : 'Momentum: Not available'}</div>
                  </div>
                  <div className="finding-metric-box">
                    <div className="finding-metric-label">GSTR-1 RECONCILIATION</div>
                    <div className="finding-metric-value">{fmt(m.gstReconciliation, 'x')}</div>
                    <div className="finding-metric-sub">GSTR-1 outward taxable ÷ bank credits</div>
                  </div>
                  <div className="finding-metric-box">
                    <div className="finding-metric-label">GSTR-3B TAX GAP</div>
                    <div className="finding-metric-value">{fmt(m.taxGap, '%')}</div>
                    <div className="finding-metric-sub">GSTR-1 declared vs GSTR-3B paid</div>
                  </div>
                </div>
                <div className="finding-citation-box">
                  <strong>Method:</strong> Run rate annualizes average monthly bank credits. Reconciliation compares GSTR-1 declared outward supplies to banked turnover; the tax gap compares GSTR-1 declared tax with GSTR-3B tax paid.
                </div>
              </ScrollStackItem>

              {/* Card 3: Pillar 3 Stability & Inward Bounce Defense */}
              <ScrollStackItem itemClassName="finding-stack-card">
                <div className="finding-card-header">
                  <div className="finding-card-pillar-tag">
                    <Shield size={15} />
                    <span>PILLAR 03 · CASH FLOW DISCIPLINE & VOLATILITY</span>
                  </div>
                  <span className={`finding-card-badge ${pillar3.badge}`}>{pillar3.label}</span>
                </div>
                <h4 className="finding-card-title">Cash Flow Volatility & Inward NACH Return Defense</h4>
                <div className="finding-metrics-row">
                  <div className="finding-metric-box">
                    <div className="finding-metric-label">COEFFICIENT OF VARIATION (CV)</div>
                    <div className="finding-metric-value" style={{ color: tone(m.creditCV, v => v <= 0.20, v => v > 0.35) }}>{fmt(m.creditCV)}</div>
                    <div className="finding-metric-sub">Benchmark: &lt; 0.30</div>
                  </div>
                  <div className="finding-metric-box">
                    <div className="finding-metric-label">INWARD BOUNCES</div>
                    <div className="finding-metric-value">{fmt(m.inwardBounces, ' Returns')}</div>
                    <div className="finding-metric-sub">Cheque / NACH dishonours</div>
                  </div>
                  <div className="finding-metric-box">
                    <div className="finding-metric-label">AVG MONTHLY CREDIT</div>
                    <div className="finding-metric-value">{fmtLakhs(m.avgMonthlyCredit)}</div>
                    <div className="finding-metric-sub">From statement credits</div>
                  </div>
                </div>
                <div className="finding-citation-box">
                  <strong>Method:</strong> CV is the standard deviation of monthly credits divided by their mean; lower values indicate steadier inflows.
                </div>
              </ScrollStackItem>

              {/* Card 4: Pillar 4 Leverage & Debt Service Coverage Proxy */}
              <ScrollStackItem itemClassName="finding-stack-card">
                <div className="finding-card-header">
                  <div className="finding-card-pillar-tag">
                    <DollarSign size={15} />
                    <span>PILLAR 04 · LEVERAGE & DEBT SERVICE PROXY</span>
                  </div>
                  <span className={`finding-card-badge ${pillar4.badge}`}>{pillar4.label}</span>
                </div>
                <h4 className="finding-card-title">Debt Service Coverage Proxy (DSCP) & Debt Headroom</h4>
                <div className="finding-metrics-row">
                  <div className="finding-metric-box">
                    <div className="finding-metric-label">DSCP PROXY RATIO</div>
                    <div className="finding-metric-value" style={{ color: tone(m.dscp, v => v >= 1.40, v => v < 1.0) }}>{fmt(m.dscp, 'x')}</div>
                    <div className="finding-metric-sub">{m.monthlyEmi === 0 ? 'No EMI obligations observed' : 'Benchmark: > 1.50x'}</div>
                  </div>
                  <div className="finding-metric-box">
                    <div className="finding-metric-label">MONTHLY EMI BURDEN</div>
                    <div className="finding-metric-value">{fmt(m.emiBurdenRatio, '%')}</div>
                    <div className="finding-metric-sub">Max cap: 20.0% of inflow</div>
                  </div>
                  <div className="finding-metric-box">
                    <div className="finding-metric-label">INDICATIVE LIMIT</div>
                    <div className="finding-metric-value">{previewDecision.recommendedLimit}</div>
                    <div className="finding-metric-sub">Share of annualized run rate</div>
                  </div>
                </div>
                <div className="finding-citation-box">
                  <strong>Method:</strong> DSCP is net monthly operating inflow (credits minus debits) divided by monthly EMI obligations observed in the statement.
                </div>
              </ScrollStackItem>

              {/* Card 5: Pillar 5 Operational Regularity & MCA Status */}
              <ScrollStackItem itemClassName="finding-stack-card">
                <div className="finding-card-header">
                  <div className="finding-card-pillar-tag">
                    <ShieldCheck size={15} />
                    <span>PILLAR 05 · OPERATIONAL INTEGRITY & MCA AUDIT</span>
                  </div>
                  <span className={`finding-card-badge ${pillar5.badge}`}>{pillar5.label}</span>
                </div>
                <h4 className="finding-card-title">MCA Legal Status, GST Filing Discipline & Litigation</h4>
                <div className="finding-metrics-row">
                  <div className="finding-metric-box">
                    <div className="finding-metric-label">MCA STATUS</div>
                    <div className="finding-metric-value">{previewDecision.mcaStatus || 'Not verified'}</div>
                    <div className="finding-metric-sub">{report?.mca?.status === 'ok' && report.mca.data?.cin ? `CIN ${report.mca.data.cin}` : (report?.mca?.reason || 'MCA21 record not available')}</div>
                  </div>
                  <div className="finding-metric-box">
                    <div className="finding-metric-label">GST FILING DISCIPLINE</div>
                    <div className="finding-metric-value">{report?.filingMetrics?.filingDiscipline || 'Not available'}</div>
                    <div className="finding-metric-sub">{report?.filingMetrics?.primary ? `${report.filingMetrics.primary.returnType}: ${report.filingMetrics.primary.filedPeriods}/${report.filingMetrics.primary.expectedPeriods} periods filed` : 'GST return history not available'}</div>
                  </div>
                  <div className="finding-metric-box">
                    <div className="finding-metric-label">COURT LITIGATION HITS</div>
                    <div className="finding-metric-value">{fmt(m.courtCases, ' Records')}</div>
                    <div className="finding-metric-sub">{isNum(m.courtCases) ? 'Sample litigation data' : 'Not covered by current data provider'}</div>
                  </div>
                </div>
                <div className="finding-citation-box">
                  <strong>Registry sources:</strong>
                  {report ? <ProvenanceList report={report} /> : ' No registry report attached to this evaluation.'}
                </div>
              </ScrollStackItem>

              {/* Card 6: Final Underwriting Synthesis & Decision */}
              <ScrollStackItem itemClassName="finding-stack-card final-decision-card">
                <div className="finding-card-header">
                  <div className="finding-card-pillar-tag">
                    <Sparkles size={15} />
                    <span>ORC CCO SYNTHESIS · FINAL UNDERWRITING VERDICT</span>
                  </div>
                  <span className={`finding-card-badge ${previewBadge}`}>{previewDecision.sanctionVerdict}</span>
                </div>
                <h4 className="finding-card-title">Institutional Credit Score: {previewDecision.score} / 900 ({previewDecision.riskTier})</h4>
                <div className="finding-metrics-row">
                  <div className="finding-metric-box">
                    <div className="finding-metric-label">SYNTHESIZED SCORE</div>
                    <div className="finding-metric-value" style={{ color: previewColor, fontSize: '1.6rem' }}>{previewDecision.score}</div>
                    <div className="finding-metric-sub">Scale: 300 to 900</div>
                  </div>
                  <div className="finding-metric-box">
                    <div className="finding-metric-label">RISK TIER</div>
                    <div className="finding-metric-value" style={{ color: previewColor }}>{previewDecision.riskTier}</div>
                    <div className="finding-metric-sub">{previewDecision.score >= 750 ? 'Prime NTC Category' : previewDecision.score >= 620 ? 'Moderate Risk Category' : 'High Friction Stressed Tier'}</div>
                  </div>
                  <div className="finding-metric-box">
                    <div className="finding-metric-label">SANCTION RECOMMENDED</div>
                    <div className="finding-metric-value">{previewDecision.recommendedLimit}</div>
                    <div className="finding-metric-sub">Working Capital / OD</div>
                  </div>
                </div>
                <div className="finding-citation-box" style={{ background: previewDecision.score >= 750 ? 'var(--status-green-bg)' : 'var(--status-red-bg)', borderColor: previewColor }}>
                  <strong>Decision summary:</strong> Score of {previewDecision.score} across 5 financial pillars. Cash Buffer Ratio {fmt(m.cashBufferRatio, 'x')}; inward return events {fmt(m.inwardBounces)}; peak OD utilization {fmt(m.odUtilization, '%')}.
                  {previewDecision.registryAdjustments.length > 0 && (
                    <>
                      <div className="registry-section-title">Registry adjustments</div>
                      <ul className="registry-list">
                        {previewDecision.registryAdjustments.map((a, i) => <li key={i}>{formatAdjustment(a)}</li>)}
                      </ul>
                    </>
                  )}
                  {previewDecision.caveats.length > 0 && (
                    <>
                      <div className="registry-section-title">Caveats</div>
                      <ul className="registry-list">
                        {previewDecision.caveats.map((c, i) => <li key={i}>{typeof c === 'string' ? c : (c?.message || c?.label || JSON.stringify(c))}</li>)}
                      </ul>
                    </>
                  )}
                </div>
              </ScrollStackItem>
            </ScrollStack>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
