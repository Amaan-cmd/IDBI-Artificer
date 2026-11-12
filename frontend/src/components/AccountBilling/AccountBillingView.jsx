import React, { useState } from 'react';
import { 
  CreditCard, Users, Key, ShieldCheck, Copy, Check, RefreshCw, 
  Clock, Download, ExternalLink, Terminal, ChevronRight, Eye, EyeOff, 
  Building2, UserCheck, Shield, Sparkles, CheckCircle2, Code2, Wallet
} from 'lucide-react';
import { formatCents, creditBarPercent } from '../../utils/money';
import './AccountBillingView.css';
import './BillingCredit.css';

const PRICE_ROWS = [
  { key: 'evaluate', label: 'Credit evaluation' },
  { key: 'chat', label: 'Orc message' },
  { key: 'registryLookup', label: 'Registry lookup' }
];
const LEDGER_LABELS = { free_grant: 'Welcome credit', evaluate: 'Evaluation', chat: 'Orc message', registryLookup: 'Registry lookup', top_up: 'Top-up' };

function formatLedgerDate(createdAt) {
  const d = createdAt ? new Date(createdAt) : null;
  return d && !Number.isNaN(d.getTime())
    ? d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—';
}

function formatLedgerAmount(cents) {
  if (cents === 0) return 'No charge';
  if (typeof cents !== 'number') return '—';
  return `${cents > 0 ? '+' : '−'}${formatCents(Math.abs(cents))}`;
}

const SEATS = [
  { name: 'Amaan Khan', email: 'amaan@enveraitech.com', role: 'Chief Underwriting Officer', status: 'Active (MFA)' },
  { name: 'SecOps Sentinel', email: 'sentinel@enveraitech.com', role: 'Risk & Compliance Lead', status: 'Active (MFA)' },
  { name: 'Rohan Deshmukh', email: 'rohan.d@enveraitech.com', role: 'Senior Credit Analyst', status: 'Active (SSO)' },
  { name: 'Pooja Iyer', email: 'pooja.i@enveraitech.com', role: 'Credit Committee Reviewer', status: 'Active (SSO)' }
];

const AUDIT_LOGS = [
  { id: 'LOG-9401', officer: 'amaan@enveraitech.com', action: 'GENERATED_CREDIT_SCORE', target: 'Apex Precision Engineering (27AADCB2230M1Z2)', time: '14 mins ago' },
  { id: 'LOG-9400', officer: 'rohan.d@enveraitech.com', action: 'EXPORTED_PDF_DOSSIER', target: 'Surat Textile Weaving Cluster (24AABCS4421P1Z9)', time: '1 hr ago' },
  { id: 'LOG-9399', officer: 'sentinel@enveraitech.com', action: 'MCA_STATUTORY_PROBE', target: 'ENVER-AITECH INDIA PRIVATE LIMITED', time: '3 hrs ago' },
  { id: 'LOG-9398', officer: 'pooja.i@enveraitech.com', action: 'AUDITOR_NOTE_ATTACHED', target: 'Kalyan Agro Supply & Logistics', time: 'Yesterday' }
];

export default function AccountBillingView({ currentUser, billing }) {
  const [copiedKey, setCopiedKey] = useState(null);
  const [showLiveKey, setShowLiveKey] = useState(false);
  const [showTestKey, setShowTestKey] = useState(false);
  const [showQuickstart, setShowQuickstart] = useState(false);

  const LIVE_KEY = 'env_live_sec_9941a87b32f9104c8e71b2';
  const TEST_KEY = 'env_test_sec_41029ba871e402c98110b9';

  const handleCopy = (keyText, id) => {
    navigator.clipboard?.writeText(keyText);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const userDisplayName = currentUser?.username || 'Institutional Underwriting Officer';
  const userDisplayEmail = currentUser?.email || 'officer@enveraitech.com';
  const userRole = currentUser?.role || 'Enterprise Principal Underwriter';
  const userOrg = currentUser?.org || 'Enver AI Tech · Citadel Underwriting';
  const userToken = currentUser?.token || 'ENV-CITADEL-296';

  return (
    <div className="account-billing-view animate-fade-up">
      {/* Header */}
      <div className="billing-header">
        <div>
          <div className="eyebrow" style={{ marginBottom: '0.35rem' }}>
            ORGANIZATION & SECURE CLEARANCE
          </div>
          <h1 className="billing-title">
            Institutional Account & Infrastructure Governance
          </h1>
          <p className="billing-subtitle">
            Officer identity credentials, allocated evaluation quotas, and high-security API integration keys.
          </p>
        </div>
        <div className="tier-badge">
          <ShieldCheck size={14} className="text-emerald" />
          <span>INSTITUTIONAL CITADEL PLAN · ACTIVE</span>
        </div>
      </div>

      {/* Active Officer Identity Card */}
      <div className="officer-profile-card">
        <div className="officer-avatar-zone">
          <div className="officer-avatar-crest">
            {userDisplayName.charAt(0)}
          </div>
          <div className="officer-main-info">
            <div className="officer-name-row">
              <h2 className="officer-name">{userDisplayName}</h2>
              <span className="officer-verified-pill">
                <CheckCircle2 size={12} />
                <span>SECOPS LEVEL 4 · VERIFIED</span>
              </span>
            </div>
            <div className="officer-sub-row">
              <span className="officer-role-tag">{userRole}</span>
              <span className="officer-sep">·</span>
              <span className="officer-org-tag">{userOrg}</span>
              <span className="officer-sep">·</span>
              <span className="officer-email-tag">{userDisplayEmail}</span>
            </div>
          </div>
        </div>

        <div className="officer-meta-pills">
          <div className="meta-pill-item">
            <span className="meta-pill-lbl">CLEARANCE TOKEN</span>
            <code className="meta-pill-val font-mono">{userToken}</code>
          </div>
          <div className="meta-pill-item">
            <span className="meta-pill-lbl">SESSION ENCRYPTION</span>
            <span className="meta-pill-val text-emerald">TLS 1.3 / AES-256</span>
          </div>
        </div>
      </div>

      {/* Grid: Quotas & Team Seats */}
      <div className="billing-top-grid">
        {/* Credit Balance Card */}
        <div className="billing-card quota-card">
          <div className="card-top-row">
            <span className="card-tag">PREPAID USAGE CREDIT</span>
            <span className="quota-cycle">Credit never expires</span>
          </div>

          {billing?.error && !billing?.account ? (
            <div className="quota-big-num"><span className="num-denom">{billing.error}</span></div>
          ) : (
            <>
              <div className="quota-big-num">
                <span className="num-val">{formatCents(billing?.account?.balanceCents)}</span>
                <span className="num-denom">credit remaining</span>
              </div>
              <div className="quota-bar-track">
                <div
                  className="quota-bar-fill"
                  style={{ width: `${creditBarPercent(billing?.account)}%` }}
                />
              </div>
              {billing?.account && billing.account.lifetimeSpentCents < billing.account.freeGrantCents && (
                <span className="quota-cycle">Includes {formatCents(billing.account.freeGrantCents)} free credit</span>
              )}

              <div className="quota-footer-details">
                {PRICE_ROWS.map(({ key, label }) => (
                  <div className="detail-col" key={key}>
                    <span className="dt-lbl">{label.toUpperCase()}</span>
                    <span className="dt-val">{formatCents(billing?.account?.prices?.[key])}</span>
                  </div>
                ))}
              </div>

              <div className="billing-pack-row">
                {(billing?.account?.packs || []).map((p) => (
                  <button
                    key={p.id}
                    className="billing-pack-btn"
                    disabled={!p.url}
                    title={p.url ? undefined : 'Coming soon'}
                    onClick={() => p.url && window.open(p.url, '_blank', 'noopener,noreferrer')}
                  >
                    <Wallet size={14} /> {p.url ? `Add ${formatCents(p.cents)}` : `${formatCents(p.cents)} · Coming soon`}
                  </button>
                ))}
              </div>

              {billing?.account?.ledger?.length > 0 && (
                <table className="billing-ledger">
                  <thead>
                    <tr><th>Date</th><th>Action</th><th>Reference</th><th>Amount</th><th>Balance</th></tr>
                  </thead>
                  <tbody>
                    {billing.account.ledger.map((row, i) => (
                      <tr key={`${row.createdAt}_${i}`}>
                        <td>{formatLedgerDate(row.createdAt)}</td>
                        <td>{row.type === 'refund' ? `Refund · ${LEDGER_LABELS[row.action] || row.action}` : (LEDGER_LABELS[row.action] || row.action)}</td>
                        <td className="mono">{row.reference || '—'}</td>
                        <td className={row.amountCents > 0 ? 'text-emerald' : ''}>{formatLedgerAmount(row.amountCents)}</td>
                        <td>{formatCents(row.balanceAfterCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>

        {/* Team Seats Allocation */}
        <div className="billing-card seats-card">
          <div className="card-top-row">
            <span className="card-tag">UNDERWRITING COMMITTEE SEATS</span>
            <span className="seats-count text-gold">4 of 10 Seats Active</span>
          </div>

          <div className="seats-list">
            {SEATS.map((seat, i) => (
              <div key={i} className="seat-row">
                <div className="seat-avatar">
                  {seat.name.charAt(0)}
                </div>
                <div className="seat-info">
                  <div className="seat-name-role">
                    <span className="seat-name">{seat.name}</span>
                    <span className="seat-role">{seat.role}</span>
                  </div>
                  <span className="seat-email">{seat.email}</span>
                </div>
                <span className="seat-status-pill">{seat.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* API Credentials & Integration Section (Polished Developer Integration Panel) */}
      <div className="billing-card api-keys-card">
        <div className="card-top-row">
          <div className="card-title-group">
            <Key size={16} className="text-emerald" />
            <h3 className="card-title">Institutional Integration & API Gateway</h3>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className="api-sub-label">REST & WEBHOOK ENDPOINTS</span>
            <button 
              type="button"
              className="quickstart-toggle-btn"
              onClick={() => setShowQuickstart(!showQuickstart)}
            >
              <Code2 size={13} />
              <span>{showQuickstart ? 'Hide cURL' : 'View cURL Snippet'}</span>
            </button>
          </div>
        </div>

        <div className="api-keys-grid">
          {/* Production Key */}
          <div className="key-item-box">
            <div className="key-label-row">
              <span className="key-env production">LIVE PRODUCTION GATEWAY</span>
              <span className="key-scope">Scope: Full Underwriting Read / Write</span>
            </div>
            <div className="key-display-row">
              <code className="key-code">
                {showLiveKey ? LIVE_KEY : `${LIVE_KEY.slice(0, 12)}••••••••••••••••${LIVE_KEY.slice(-4)}`}
              </code>
              <div className="key-actions-group">
                <button 
                  type="button"
                  className="key-action-icon-btn"
                  onClick={() => setShowLiveKey(!showLiveKey)}
                  title={showLiveKey ? "Mask Key" : "Reveal Key"}
                >
                  {showLiveKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button 
                  type="button"
                  className="key-copy-btn"
                  onClick={() => handleCopy(LIVE_KEY, 'live')}
                  title="Copy Production API Key"
                >
                  {copiedKey === 'live' ? <Check size={14} className="text-emerald" /> : <Copy size={14} />}
                  <span>{copiedKey === 'live' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Sandbox Key */}
          <div className="key-item-box">
            <div className="key-label-row">
              <span className="key-env sandbox">SANDBOX ENVIRONMENT</span>
              <span className="key-scope">Scope: Synthetic Probing & Test Ledgers</span>
            </div>
            <div className="key-display-row">
              <code className="key-code">
                {showTestKey ? TEST_KEY : `${TEST_KEY.slice(0, 12)}••••••••••••••••${TEST_KEY.slice(-4)}`}
              </code>
              <div className="key-actions-group">
                <button 
                  type="button"
                  className="key-action-icon-btn"
                  onClick={() => setShowTestKey(!showTestKey)}
                  title={showTestKey ? "Mask Key" : "Reveal Key"}
                >
                  {showTestKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button 
                  type="button"
                  className="key-copy-btn"
                  onClick={() => handleCopy(TEST_KEY, 'test')}
                  title="Copy Sandbox API Key"
                >
                  {copiedKey === 'test' ? <Check size={14} className="text-emerald" /> : <Copy size={14} />}
                  <span>{copiedKey === 'test' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Collapsible cURL Quickstart Snippet */}
        {showQuickstart && (
          <div className="api-quickstart-snippet animate-fade-up">
            <div className="snippet-header">
              <span className="snippet-title">cURL Instant Evaluation Request</span>
              <button 
                type="button"
                className="snippet-copy-btn"
                onClick={() => handleCopy(`curl -X POST https://api.enveraitech.com/v1/evaluate \\\n  -H "Authorization: Bearer ${LIVE_KEY}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"gstin": "27AADCB2230M1Z2"}'`, 'curl')}
              >
                {copiedKey === 'curl' ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedKey === 'curl' ? 'Copied Snippet' : 'Copy cURL'}</span>
              </button>
            </div>
            <pre className="snippet-code">
              <code>{`curl -X POST https://api.enveraitech.com/v1/evaluate \\
  -H "Authorization: Bearer ${LIVE_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{"gstin": "27AADCB2230M1Z2"}'`}</code>
            </pre>
          </div>
        )}
      </div>

      {/* Audit Log of Who Ran Which Report */}
      <div className="billing-card audit-log-card">
        <div className="card-top-row">
          <div className="card-title-group">
            <Clock size={16} className="text-emerald" />
            <h3 className="card-title">Institutional Underwriting Audit Trail</h3>
          </div>
          <span className="log-security-tag">SOC2 / ISO 27001 IMMUTABLE LEDGER</span>
        </div>

        <div className="audit-table-wrap">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Audit Ref</th>
                <th>Credit Officer</th>
                <th>Operation</th>
                <th>Target Enterprise</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {AUDIT_LOGS.map(log => (
                <tr key={log.id}>
                  <td className="font-mono text-gold">{log.id}</td>
                  <td className="text-white font-medium">{log.officer}</td>
                  <td>
                    <span className="action-pill">{log.action}</span>
                  </td>
                  <td className="text-muted">{log.target}</td>
                  <td className="font-mono text-xs">{log.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
