import React, { useState, useRef } from 'react';
import { 
  Search, UploadCloud, FileText, CheckCircle2, AlertTriangle, ArrowRight, 
  Building2, Sparkles, X, ShieldCheck, RefreshCw, Copy, Check, Terminal,
  Layers, ChevronDown, ExternalLink, Shield, TrendingUp, DollarSign, Activity
} from 'lucide-react';
import './NewEvaluationView.css';
import { KNOWN_GSTINS, getGSTINProbeData } from '../../utils/gstinRegistry';
import { sanitizeText } from '../../utils/sanitize';
import OrcTerminal from '../OrcTerminal/OrcTerminal';
import ScrollStack, { ScrollStackItem } from '../ScrollStack/ScrollStack';

const SUGGESTIONS = [
  { gstin: '27AADCB2230M1Z2', label: 'Apex Precision Engineering (Pune)', turnover: '₹96.4L', score: 824 },
  { gstin: '24AABCS4421P1Z9', label: 'Surat Textile Weaving LLP (Surat)', turnover: '₹1.42Cr', score: 765 },
  { gstin: '27AAGCK8812L1ZQ', label: 'Kalyan Agro Supply & Logistics', turnover: '₹68.0L', score: 610 },
  { gstin: '27AAHCE5539J1ZA', label: 'Enver AI Tech Pvt Ltd (Mumbai)', turnover: '₹96.8L', score: 870 },
  { gstin: '27AAACT2727Q1ZW', label: 'Tata Motors Passenger Vehicles', turnover: '₹280Cr', score: 895 },
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
  loading
}) {
  const [dragActive, setDragActive] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [activeBottomTab, setActiveBottomTab] = useState('terminal'); // 'terminal' | 'findings'
  const fileInputRef = useRef(null);

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

  const resolved = gstinProbeData?.registry;
  const isResolved = Boolean(resolved?.legalEntityName);
  const businessName = resolved?.legalEntityName || 'Apex Precision Engineering Pvt Ltd';
  const gstinToDisplay = gstinProbeData?.gstin || gstinInput || '27AADCB2230M1Z2';

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
                placeholder="Enter Business Name, GSTIN (e.g. 27AADCB2230M1Z2), CIN, or PAN..."
                value={gstinInput}
                onChange={(e) => {
                  const val = sanitizeText(e.target.value.toUpperCase(), 35);
                  setGstinInput(val);
                  if (val.length === 15) {
                    onProbeGSTIN(val);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && gstinInput.trim().length >= 10) {
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

            {/* Quick Suggestions Chips */}
            <div className="search-suggestions-wrap">
              <span className="suggestions-label">Presets:</span>
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

        {/* HITL Operator Authorization Confirmation Card */}
        {isResolved && (
          <div className="hitl-authorization-card animate-fade-up">
            <div className="hitl-card-header">
              <div className="hitl-entity-meta">
                <div className="entity-badge-row">
                  <span className="entity-type-badge">{resolved.entityType || 'Enterprise'}</span>
                  <span className="status-live-badge">MCA Status: {resolved.mcaStatus || 'Active'}</span>
                  <span className="compliance-badge">Tax Reliability: {resolved.filingCompliance?.taxPaymentReliability || '98.5%'}</span>
                </div>
                <h2 className="entity-legal-name">{resolved.legalEntityName}</h2>
                <div className="entity-id-row">
                  <span><strong>GSTIN:</strong> {gstinProbeData.gstin}</span>
                  <span className="id-sep">·</span>
                  <span><strong>PAN:</strong> {resolved.pan}</span>
                  <span className="id-sep">·</span>
                  <span><strong>State:</strong> {resolved.state} ({resolved.stateCode})</span>
                </div>
              </div>

              <div className="hitl-action-buttons">
                <button
                  className="authorize-generate-btn"
                  onClick={() => onTriggerEvaluation()}
                  disabled={loading}
                >
                  <Sparkles size={16} />
                  <span>⚡ AUTHORIZE & GENERATE CREDIT SCORE</span>
                </button>
                <button
                  className="hitl-change-btn"
                  onClick={() => {
                    setGstinInput('');
                    onProbeGSTIN('');
                  }}
                >
                  Clear / Change
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
            className={`intake-nav-btn ${activeBottomTab === 'terminal' ? 'active' : ''}`}
            onClick={() => setActiveBottomTab('terminal')}
          >
            <Terminal size={16} />
            <span>Orc CCO Intelligence Terminal</span>
            <span className="nav-badge-live">DAEMON ACTIVE</span>
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
        </div>

        {/* Tab 1: Orc Terminal (Basic Chatbot trained on Enver Intelligence) */}
        {activeBottomTab === 'terminal' && (
          <div className="terminal-view-wrap animate-fade-in">
            <OrcTerminal 
              currentBusiness={{
                name: businessName,
                gstin: gstinToDisplay,
                probeData: gstinProbeData
              }}
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
                <h3 className="findings-target-name">{businessName}</h3>
                <span className="findings-target-sub font-mono">GSTIN: {gstinToDisplay} · Scroll down to inspect stacking pillar cards</span>
              </div>
              <button
                type="button"
                className="launch-full-split-btn"
                onClick={() => onTriggerEvaluation()}
              >
                <span>Open Full Split Workspace</span>
                <ExternalLink size={14} />
              </button>
            </div>

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
                  <span className="finding-card-badge badge-comfortable">COMFORTABLE (0.71x)</span>
                </div>
                <h4 className="finding-card-title">Cash Buffer Ratio & Autonomous Survival Runway</h4>
                <div className="finding-metrics-row">
                  <div className="finding-metric-box">
                    <div className="finding-metric-label">CASH BUFFER RATIO</div>
                    <div className="finding-metric-value" style={{ color: '#ACE1AF' }}>0.71x</div>
                    <div className="finding-metric-sub">Benchmark: &gt; 0.25x</div>
                  </div>
                  <div className="finding-metric-box">
                    <div className="finding-metric-label">SURVIVAL RUNWAY</div>
                    <div className="finding-metric-value">18 Days</div>
                    <div className="finding-metric-sub">Minimum autonomous runway</div>
                  </div>
                  <div className="finding-metric-box">
                    <div className="finding-metric-label">OVERDRAFT UTILIZATION</div>
                    <div className="finding-metric-value">32%</div>
                    <div className="finding-metric-sub">Sanctioned: ₹10L | Drawn: ₹3.2L</div>
                  </div>
                </div>
                <div className="finding-citation-box">
                  <strong>Orc Grounded Citation:</strong> Cash Buffer Ratio is calculated as Bank Closing Balance divided by Average Monthly Debit outflows. Candidate maintains 18 survival buffer days with subdued overdraft drawdowns (32%), meeting RBI resilience guidelines.
                </div>
              </ScrollStackItem>

              {/* Card 2: Pillar 2 Revenue Run-Rate & GST Reconciliation */}
              <ScrollStackItem itemClassName="finding-stack-card">
                <div className="finding-card-header">
                  <div className="finding-card-pillar-tag">
                    <TrendingUp size={15} />
                    <span>PILLAR 02 · REVENUE MOMENTUM & TAX ATTESTATION</span>
                  </div>
                  <span className="finding-card-badge badge-prime">EXPANSIONARY (+9.4%)</span>
                </div>
                <h4 className="finding-card-title">Annualized Revenue & Statutory Turnover Reconciliation</h4>
                <div className="finding-metrics-row">
                  <div className="finding-metric-box">
                    <div className="finding-metric-label">ANNUALIZED RUN RATE</div>
                    <div className="finding-metric-value" style={{ color: '#ACE1AF' }}>₹96.80 LACS</div>
                    <div className="finding-metric-sub">+9.4% 3M/3M momentum</div>
                  </div>
                  <div className="finding-metric-box">
                    <div className="finding-metric-label">GSTR-1 RECONCILIATION</div>
                    <div className="finding-metric-value">1.01x</div>
                    <div className="finding-metric-sub">Reconciled to bank credits</div>
                  </div>
                  <div className="finding-metric-box">
                    <div className="finding-metric-label">GSTR-3B TAX GAP</div>
                    <div className="finding-metric-value">0.0%</div>
                    <div className="finding-metric-sub">Declared ₹8.71L = Paid ₹8.71L</div>
                  </div>
                </div>
                <div className="finding-citation-box">
                  <strong>Orc Grounded Citation:</strong> GSTR-1 declared outward supplies reconcile to banking credit inflow turnover at 1.01x ratio. Zero variance between GSTR-1 declared tax and GSTR-3B paid tax rules out fictitious invoicing or pending tax demands.
                </div>
              </ScrollStackItem>

              {/* Card 3: Pillar 3 Stability & Inward Bounce Defense */}
              <ScrollStackItem itemClassName="finding-stack-card">
                <div className="finding-card-header">
                  <div className="finding-card-pillar-tag">
                    <Shield size={15} />
                    <span>PILLAR 03 · CASH FLOW DISCIPLINE & VOLATILITY</span>
                  </div>
                  <span className="finding-card-badge badge-consistent">DISCIPLINED (0 BOUNCES)</span>
                </div>
                <h4 className="finding-card-title">Cash Flow Volatility & Inward NACH Return Defense</h4>
                <div className="finding-metrics-row">
                  <div className="finding-metric-box">
                    <div className="finding-metric-label">COEFFICIENT OF VARIATION (CV)</div>
                    <div className="finding-metric-value" style={{ color: '#ACE1AF' }}>0.06</div>
                    <div className="finding-metric-sub">Benchmark: &lt; 0.30</div>
                  </div>
                  <div className="finding-metric-box">
                    <div className="finding-metric-label">INWARD BOUNCE RATE</div>
                    <div className="finding-metric-value">0 Returns</div>
                    <div className="finding-metric-sub">Zero dishonour events</div>
                  </div>
                  <div className="finding-metric-box">
                    <div className="finding-metric-label">LOW-CREDIT MONTHS</div>
                    <div className="finding-metric-value">0 Months</div>
                    <div className="finding-metric-sub">No seasonal contraction</div>
                  </div>
                </div>
                <div className="finding-citation-box">
                  <strong>Orc Grounded Citation:</strong> Monthly credit velocity exhibits low variance (CV = 0.06). Zero inward return friction confirms disciplined operating treasury and high trade counterparty credit reliability.
                </div>
              </ScrollStackItem>

              {/* Card 4: Pillar 4 Leverage & Debt Service Coverage Proxy */}
              <ScrollStackItem itemClassName="finding-stack-card">
                <div className="finding-card-header">
                  <div className="finding-card-pillar-tag">
                    <DollarSign size={15} />
                    <span>PILLAR 04 · LEVERAGE & DEBT SERVICE PROXY</span>
                  </div>
                  <span className="finding-card-badge badge-prime">PRIME DSCP (2.12x)</span>
                </div>
                <h4 className="finding-card-title">Debt Service Coverage Proxy (DSCP) & Debt Headroom</h4>
                <div className="finding-metrics-row">
                  <div className="finding-metric-box">
                    <div className="finding-metric-label">DSCP PROXY RATIO</div>
                    <div className="finding-metric-value" style={{ color: '#ACE1AF' }}>2.12x</div>
                    <div className="finding-metric-sub">Benchmark: &gt; 1.50x</div>
                  </div>
                  <div className="finding-metric-box">
                    <div className="finding-metric-label">MONTHLY EMI BURDEN</div>
                    <div className="finding-metric-value">5.5%</div>
                    <div className="finding-metric-sub">Max cap: 20.0% of inflow</div>
                  </div>
                  <div className="finding-metric-box">
                    <div className="finding-metric-label">BORROWING CAPACITY</div>
                    <div className="finding-metric-value">₹35.0 LACS</div>
                    <div className="finding-metric-sub">Estimated incremental line</div>
                  </div>
                </div>
                <div className="finding-citation-box">
                  <strong>Orc Grounded Citation:</strong> Net operating inflows generate 2.12x coverage over aggregate scheduled EMI obligations. Low current leverage enables immediate sanction of recommended working capital limit.
                </div>
              </ScrollStackItem>

              {/* Card 5: Pillar 5 Operational Regularity & MCA Status */}
              <ScrollStackItem itemClassName="finding-stack-card">
                <div className="finding-card-header">
                  <div className="finding-card-pillar-tag">
                    <ShieldCheck size={15} />
                    <span>PILLAR 05 · OPERATIONAL INTEGRITY & MCA AUDIT</span>
                  </div>
                  <span className="finding-card-badge badge-clean">MCA ACTIVE · CLEAN DIN</span>
                </div>
                <h4 className="finding-card-title">MCA Legal Attestation, Litigation & Payroll Consistency</h4>
                <div className="finding-metrics-row">
                  <div className="finding-metric-box">
                    <div className="finding-metric-label">MCA STATUS</div>
                    <div className="finding-metric-value" style={{ color: '#ACE1AF' }}>ACTIVE</div>
                    <div className="finding-metric-sub">DIN 02914820 (Clean)</div>
                  </div>
                  <div className="finding-metric-box">
                    <div className="finding-metric-label">COURT LITIGATION HITS</div>
                    <div className="finding-metric-value">0 Records</div>
                    <div className="finding-metric-sub">No pending judicial claims</div>
                  </div>
                  <div className="finding-metric-box">
                    <div className="finding-metric-label">PAYROLL DISBURSALS</div>
                    <div className="finding-metric-value">CONSISTENT</div>
                    <div className="finding-metric-sub">Verified staff payrolls</div>
                  </div>
                </div>
                <div className="finding-citation-box">
                  <strong>Orc Grounded Citation:</strong> Entity is legally attested Active under MCA21. Payroll transactions occur on recurring monthly schedules with low cash leakage (4.2%), ruling out shell entity or circular invoice diversion.
                </div>
              </ScrollStackItem>

              {/* Card 6: Final Underwriting Synthesis & Decision */}
              <ScrollStackItem itemClassName="finding-stack-card final-decision-card">
                <div className="finding-card-header">
                  <div className="finding-card-pillar-tag">
                    <Sparkles size={15} />
                    <span>ORC CCO SYNTHESIS · FINAL UNDERWRITING VERDICT</span>
                  </div>
                  <span className="finding-card-badge badge-comfortable">SANCTION RECOMMENDATION</span>
                </div>
                <h4 className="finding-card-title">Institutional Credit Score: 824 / 900 (LOW RISK)</h4>
                <div className="finding-metrics-row">
                  <div className="finding-metric-box">
                    <div className="finding-metric-label">SYNTHESIZED SCORE</div>
                    <div className="finding-metric-value" style={{ color: '#ACE1AF', fontSize: '1.6rem' }}>824</div>
                    <div className="finding-metric-sub">Scale: 300 to 900</div>
                  </div>
                  <div className="finding-metric-box">
                    <div className="finding-metric-label">RISK TIER</div>
                    <div className="finding-metric-value" style={{ color: '#ACE1AF' }}>LOW RISK</div>
                    <div className="finding-metric-sub">Prime NTC Category</div>
                  </div>
                  <div className="finding-metric-box">
                    <div className="finding-metric-label">SANCTION RECOMMENDED</div>
                    <div className="finding-metric-value">₹35.0 LACS</div>
                    <div className="finding-metric-sub">Working Capital / OD</div>
                  </div>
                </div>
                <div className="finding-citation-box" style={{ background: 'rgba(172, 225, 175, 0.08)', borderColor: '#ACE1AF' }}>
                  <strong>Formal Policy Attestation:</strong> Under RBI Digital Lending Guidelines, this enterprise qualifies for expedited approval. Zero-hallucination deterministic score reflects healthy cash buffers (0.71x), clean tax reconciliation, and zero bounce events.
                </div>
              </ScrollStackItem>
            </ScrollStack>
          </div>
        )}
      </section>
    </div>
  );
}
