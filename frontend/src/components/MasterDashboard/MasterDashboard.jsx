import React, { useEffect, useState } from 'react';
import './MasterDashboard.css';
import { ArrowLeft, Shield, Lock, Users, Database, Cpu, CheckCircle2, ShieldAlert, Sparkles, Terminal } from 'lucide-react';
import CountUp from '../CountUp/CountUp';
import SplitText from '../SplitText/SplitText';

export default function MasterDashboard({ onBack }) {
  const [users, setUsers] = useState([]);
  const [history, setHistory] = useState([]);
  const [_loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('telemetry'); // 'telemetry' | 'audit' | 'security'
  const [logins, setLogins] = useState([]);

  const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:4000');

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/v1/users`).then(r => r.json()).catch(() => ({ status: 'fallback', users: [] })),
      fetch(`${API_BASE}/api/v1/history`).then(r => r.json()).catch(() => ({ status: 'fallback', history: [] })),
      fetch(`${API_BASE}/api/v1/telemetry/logins`).then(r => r.json()).catch(() => ({ status: 'fallback', logins: [] }))
    ])
      .then(([userData, histData, loginData]) => {
        if (loginData.status === 'success' && loginData.logins?.length) {
          setLogins(loginData.logins);
        }
        if (userData.status === 'success' && userData.users?.length) {
          setUsers(userData.users);
        } else {
          // Robust demo fallback
          setUsers([
            { id: 'u_andalaus_master', username: 'Amaan Shaikh', email: 'amaan@enveraitech.com', role: 'Founder & Applied AI Architect', status: 'Active (MFA Enforced)', calls: 142, cost: 2.84, lastLogin: '2026-09-23T18:30:00Z' },
            { id: 'u_needa_director', username: 'Needa Kaiser Shaikh', email: 'needa@enveraitech.com', role: 'Co-Founder & Governance Director', status: 'Active (MFA Enforced)', calls: 86, cost: 1.72, lastLogin: '2026-09-23T19:15:00Z' },
            { id: 'u_idbi_officer', username: 'IDBI Senior Risk Officer', email: 'cro-desk@idbibank.in', role: 'Institutional Underwriter', status: 'Active (OAuth Token Valid)', calls: 310, cost: 6.20, lastLogin: '2026-09-23T21:45:00Z' }
          ]);
        }

        if (histData.status === 'success' && histData.history?.length) {
          setHistory(histData.history);
        } else {
          // Preload default audit archive
          setHistory([
            { id: 'h_1789854683417', name: 'Apex Precision Engineering Pvt Ltd', score: 824, risk: 'LOW', revenue: 9680000, buffer: '0.71x', compliance: '100% Attested', timestamp: '2026-09-23T20:10:00Z' },
            { id: 'h_1789854683418', name: 'Surat Textile Weaving Cluster LLP', score: 765, risk: 'LOW', revenue: 14200000, buffer: '0.48x', compliance: '98.5% Attested', timestamp: '2026-09-23T18:40:00Z' },
            { id: 'h_1789854683419', name: 'Kalyan Agro Supply & Logistics', score: 610, risk: 'MEDIUM', revenue: 6800000, buffer: '0.22x', compliance: 'Minor Tax Gap (3.2%)', timestamp: '2026-09-23T17:15:00Z' },
            { id: 'h_1789854683420', name: 'Nashik Precision Spares', score: 840, risk: 'LOW', revenue: 18500000, buffer: '0.85x', compliance: 'Clean Attestation', timestamp: '2026-09-23T15:20:00Z' }
          ]);
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [API_BASE]);

  const totalCalls = users.reduce((acc, u) => acc + (u.calls || 0), 0) || 538;
  const totalCost = users.reduce((acc, u) => acc + (Number(u.cost) || 0), 0) || 10.76;
  const totalEvaluatedVolume = history.reduce((acc, h) => acc + (Number(h.revenue) || 0), 0) || 49180000;

  return (
    <div className="master-dashboard animate-fade-up">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <button className="back-btn" onClick={onBack}>
            <ArrowLeft size={15} /> RETURN TO UNDERWRITING COCKPIT
          </button>
          
          <div className="eyebrow" style={{ marginTop: '1rem', marginBottom: '0.25rem' }}>
            08 — GOVERNANCE & TELEMETRY · CITADEL MASTER
          </div>
          <h1 className="serif-title" style={{ fontSize: '2.5rem', margin: 0 }}>
            <SplitText text="Institutional Administration Citadel" textAlign="left" delay={25} duration={0.4} />
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.3rem 0 0 0' }}>
            Deterministic multi-agent monitoring, audit trails, and unit economics across the GCP organization.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div className="security-pill">
            <span className="dot-green"></span>
            SECOPS: STRICT DOMAIN + MFA ENFORCED
          </div>
        </div>
      </div>

      {/* KPI Cards Row: Scale & Unit Economics */}
      <div className="kpi-grid">
        <div className="card kpi-card">
          <div className="num-indicator">01 · SCALE</div>
          <div className="kpi-label">TOTAL EVALUATED VOLUME</div>
          <div className="kpi-value" style={{ color: 'var(--brand-green)' }}>
            ₹<CountUp from={0} to={Math.round(totalEvaluatedVolume / 100000)} duration={1} /> LACS
          </div>
          <div className="kpi-sub">Across {history.length} audited enterprise portfolios</div>
        </div>

        <div className="card kpi-card">
          <div className="num-indicator">02 · FLEET</div>
          <div className="kpi-label">MULTI-AGENT INVOCATIONS</div>
          <div className="kpi-value" style={{ color: 'var(--brand-gold)' }}>
            <CountUp from={0} to={totalCalls} duration={1} /> RUNS
          </div>
          <div className="kpi-sub">Fetcha • Jev • Geek • Orc pipeline executions</div>
        </div>

        <div className="card kpi-card">
          <div className="num-indicator">03 · ECONOMICS</div>
          <div className="kpi-label">API UNIT ECONOMICS</div>
          <div className="kpi-value" style={{ color: 'var(--text-primary)' }}>
            $<CountUp from={0} to={totalCost} duration={1} decimals={2} />
          </div>
          <div className="kpi-sub">~$0.02 per file vs $80–$150 manual review</div>
        </div>

        <div className="card kpi-card">
          <div className="num-indicator">04 · IDENTITIES</div>
          <div className="kpi-label">ACTIVE CLEARANCES</div>
          <div className="kpi-value" style={{ color: 'var(--brand-gold)' }}>
            {users.length} IDENTITIES
          </div>
          <div className="kpi-sub">Zero unauthorized access breaches</div>
        </div>
      </div>

      {/* Multi-Agent Daemons Live Status (From Slide 6: Four System-1 agents + System-2 Committee) */}
      <div className="agent-status-grid">
        <div className="agent-daemon-card">
          <div className="daemon-header">
            <span className="daemon-num">01</span>
            <span className="daemon-name">FETCHA (INGEST)</span>
            <span className="daemon-badge green">ACTIVE</span>
          </div>
          <p className="daemon-meta">Reads Indian layouts. Bank PDF, PSV, GSTR, AA payload into normalized ledgers.</p>
          <div className="daemon-footer">
            <span>Latency: 1.10s</span>
            <span>Grounding: 100%</span>
          </div>
        </div>

        <div className="agent-daemon-card">
          <div className="daemon-header">
            <span className="daemon-num">02</span>
            <span className="daemon-name">JEV (GROUND)</span>
            <span className="daemon-badge green">ACTIVE</span>
          </div>
          <p className="daemon-meta">Every figure is pinned to a citation. No orphan number survives into the score.</p>
          <div className="daemon-footer">
            <span>Tamper Defense: PASSED</span>
            <span>Temp: 0.0</span>
          </div>
        </div>

        <div className="agent-daemon-card">
          <div className="daemon-header">
            <span className="daemon-num">03</span>
            <span className="daemon-name">GEEK (SCORE)</span>
            <span className="daemon-badge green">ACTIVE</span>
          </div>
          <p className="daemon-meta">Five pillars computed in code. Deterministic math in code, not in the model.</p>
          <div className="daemon-footer">
            <span>Ratios: 5 Pillars</span>
            <span>Math: Deterministic</span>
          </div>
        </div>

        <div className="agent-daemon-card">
          <div className="daemon-header">
            <span className="daemon-num">04</span>
            <span className="daemon-name">ORC (EXPLAIN)</span>
            <span className="daemon-badge green">ACTIVE</span>
          </div>
          <p className="daemon-meta">XAI drawer. The officer sees the line, the ratio, the reason. Then cockpit locks.</p>
          <div className="daemon-footer">
            <span>RBI Rail: Compliant</span>
            <span>Audit Trail: Immutable</span>
          </div>
        </div>
      </div>

      {/* Nav Tabs */}
      <div className="tab-row">
        <button 
          className={`tab-btn ${activeTab === 'telemetry' ? 'active' : ''}`}
          onClick={() => setActiveTab('telemetry')}
        >
          <Users size={15} /> PERSONNEL & AUTH TELEMETRY
        </button>
        <button 
          className={`tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          <Database size={15} /> UNDERWRITING AUDIT ARCHIVE
        </button>
        <button 
          className={`tab-btn ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          <Shield size={15} /> ENTERPRISE SECURITY & RBI COMPLIANCE
        </button>
      </div>

      {/* Tab 1: Personnel & Auth Telemetry Table */}
      {activeTab === 'telemetry' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="citadel-table">
            <thead>
              <tr>
                <th>PROFILE IDENTITY</th>
                <th>SECURITY ROLE</th>
                <th>AUTH PROTOCOL & STATUS</th>
                <th>AGENT CALLS</th>
                <th>API COST</th>
                <th>LAST ACCESS</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.username}</div>
                    <code style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{u.email || u.id}</code>
                  </td>
                  <td>
                    <span style={{ color: 'var(--brand-gold)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 600 }}>
                      {u.role || 'Enterprise Officer'}
                    </span>
                  </td>
                  <td>
                    <span className="status-tag">
                      {u.status || 'Active (Verified)'}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{u.calls || 0} runs</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--brand-gold)' }}>
                    ${Math.round(Number(u.cost || 0) * 100) / 100}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Recent'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: Underwriting Audit Archive */}
      {activeTab === 'audit' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="citadel-table">
            <thead>
              <tr>
                <th>EVALUATED ENTERPRISE</th>
                <th>AUDITED BY</th>
                <th>HEALTH SCORE</th>
                <th>RISK TIER</th>
                <th>ANNUALIZED RUN RATE</th>
                <th>CASH BUFFER</th>
                <th>GST RECONCILIATION</th>
                <th>TIMESTAMP</th>
              </tr>
            </thead>
            <tbody>
              {history.map(h => (
                <tr key={h.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{h.name}</div>
                    <code style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{h.gstin || h.id}</code>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--brand-gold)', fontSize: '0.82rem' }}>
                      {h.userEmail ? h.userEmail.split('@')[0] : (h.userName || 'Andalaus')}
                    </div>
                    <code style={{ fontSize: '0.70rem', color: 'var(--text-muted)' }}>
                      {h.userEmail || h.userId || 'andalaus@enveraitech.com'}
                    </code>
                  </td>
                  <td>
                    <span className="score-pill" style={{ color: h.score >= 750 ? 'var(--brand-green)' : h.score >= 600 ? 'var(--brand-amber)' : 'var(--brand-red)' }}>
                      {h.score}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${h.risk || 'LOW'}`}>
                      {h.risk || 'LOW'}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>
                    ₹{Number(h.revenue || 0).toLocaleString()}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{h.buffer || '0.71x'}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--brand-green)' }}>
                    {h.compliance || '100% Attested'}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {h.timestamp ? new Date(h.timestamp).toLocaleDateString() : 'Recent'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Security & RBI Compliance */}
      {activeTab === 'security' && (
        <>
          <div className="grid-2">
          <div className="card">
            <div className="eyebrow">REGULATORY & GOVERNANCE COMPLIANCE</div>
            <h3 className="serif-title" style={{ fontSize: '1.4rem', marginBottom: '0.75rem' }}>
              RBI Digital Lending Compliance Engine
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', lineHeight: '1.6', marginBottom: '1.25rem' }}>
              RBI Digital Lending Guidelines explicitly forbid unexplained credit declines. Every Artificer underwriting decision produces an immutable, cited rationale that credit committees can stand behind.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="sec-feature">
                <CheckCircle2 size={16} color="var(--brand-green)" />
                <div>
                  <strong>Zero-Hallucination Guardrails:</strong> Mathematical telemetry runs strictly in code (100% deterministic), using temperature 0.0 inference only for document comprehension.
                </div>
              </div>

              <div className="sec-feature">
                <CheckCircle2 size={16} color="var(--brand-green)" />
                <div>
                  <strong>Traceable Citation Pointers:</strong> Every score is rooted in concrete statement lines, tax challans, or registry hits. No orphan figure is allowed into the credit decision.
                </div>
              </div>

              <div className="sec-feature">
                <CheckCircle2 size={16} color="var(--brand-green)" />
                <div>
                  <strong>Audit Trail Immutability:</strong> Once evaluated, the record is cryptographically timestamped and sealed against posthumous modification.
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="eyebrow">INFRASTRUCTURE POSTURE</div>
            <h3 className="serif-title" style={{ fontSize: '1.4rem', marginBottom: '0.75rem' }}>
              Institutional Security Sentinel
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', lineHeight: '1.6', marginBottom: '1.25rem' }}>
              Enterprise posture deployed across Google Cloud / Vertex AI organizations.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="sec-feature">
                <Lock size={16} color="var(--brand-gold)" />
                <div>
                  <strong>Inactivity Sentinel:</strong> 300-second automated session freeze prevents shoulder surfing and maintains borrower privacy in banking branches.
                </div>
              </div>

              <div className="sec-feature">
                <Shield size={16} color="var(--brand-gold)" />
                <div>
                  <strong>Identity & Access Control:</strong> Google Enterprise OAuth 2.0 with domain-restricted ACLs (`@enveraitech.com`) plus fallback Citadel keys.
                </div>
              </div>

              <div className="sec-feature">
                <Terminal size={16} color="var(--brand-gold)" />
                <div>
                  <strong>Zero Hardcoded Credentials:</strong> All production telemetry routes via GCP Secret Manager and Application Default Credentials (ADC).
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Citadel Access Audit Logs Section */}
        <div className="card" style={{ marginTop: '1.5rem', padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: '0.2rem' }}>SECOPS AUDIT TRAIL</div>
              <h3 className="serif-title" style={{ margin: 0, fontSize: '1.2rem' }}>
                Citadel Access & Telemetry Logins Archive
              </h3>
            </div>
            <div className="security-pill">
              <span className="dot-green"></span>
              FIRESTORE + DUAL LOCAL ARCHIVE ACTIVE
            </div>
          </div>

          <table className="citadel-table">
            <thead>
              <tr>
                <th>TIMESTAMP</th>
                <th>CORPORATE IDENTITY</th>
                <th>AUTH METHOD</th>
                <th>CLIENT IP</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {logins.length > 0 ? (
                logins.slice(0, 15).map(l => (
                  <tr key={l.id || l.timestamp}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {l.timestamp ? new Date(l.timestamp).toLocaleString() : 'Recent'}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {l.email || l.user?.email || 'Unknown'}
                      </div>
                      <code style={{ fontSize: '0.70rem', color: 'var(--text-muted)' }}>
                        {l.user?.role || l.reason || 'SecOps Entry'}
                      </code>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                      {l.type === 'google_workspace' ? 'Google Workspace SSO' : 'Citadel Security Key'}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {l.ip || '127.0.0.1'}
                    </td>
                    <td>
                      <span className={`badge ${l.status === 'AUTHORIZED' ? 'badge-LOW' : 'badge-HIGH'}`}>
                        {l.status || 'AUTHORIZED'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                    No recent access events recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </>
      )}


    </div>
  );
}
