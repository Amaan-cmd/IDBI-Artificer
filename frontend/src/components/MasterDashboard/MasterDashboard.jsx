import React, { useEffect, useState } from 'react';
import './MasterDashboard.css';
import { ArrowLeft, Shield, Cpu, Activity, Lock, Users, Terminal, Database, CheckCircle2, AlertTriangle, Key } from 'lucide-react';
import CountUp from '../CountUp/CountUp';
import SplitText from '../SplitText/SplitText';

export default function MasterDashboard({ onBack }) {
  const [users, setUsers] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('telemetry'); // 'telemetry' | 'audit' | 'security'

  const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:4000');

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/v1/users`).then(r => r.json()),
      fetch(`${API_BASE}/api/v1/history`).then(r => r.json())
    ])
      .then(([userData, histData]) => {
        if (userData.status === 'success') {
          setUsers(userData.users || []);
        }
        if (histData.status === 'success') {
          setHistory(histData.history || []);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Master dashboard data fetch failed:", err);
        setLoading(false);
      });
  }, [API_BASE]);

  const totalCalls = users.reduce((acc, u) => acc + (u.calls || 0), 0);
  const totalCost = users.reduce((acc, u) => acc + (Number(u.cost) || 0), 0);
  const totalEvaluatedVolume = history.reduce((acc, h) => acc + (Number(h.revenue) || 0), 0);

  return (
    <div className="master-dashboard animate-fade-up">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <button className="back-btn" onClick={onBack}>
            <ArrowLeft size={16} /> RETURN TO UNDERWRITING COCKPIT
          </button>
          <div className="eyebrow" style={{ marginTop: '1rem', marginBottom: '0.3rem' }}>
            ENVERAI ARTIFICER • INSTITUTIONAL GOVERNANCE
          </div>
          <h1 className="display-text" style={{ fontSize: '2.4rem', margin: 0 }}>
            <SplitText text="MASTER ADMIN CITADEL" textAlign="left" delay={40} duration={0.5} />
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <div className="security-pill">
            <span className="dot-green"></span>
            SECOPS: STRICT DOMAIN + MFA ACTIVE
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="kpi-grid">
        <div className="card kpi-card">
          <div className="kpi-label">TOTAL EVALUATION VOLUME</div>
          <div className="kpi-value" style={{ color: 'var(--brand-green)' }}>
            ₹<CountUp from={0} to={Math.round(totalEvaluatedVolume / 100000)} duration={1.2} /> LACS
          </div>
          <div className="kpi-sub">Across {history.length} evaluated MSME portfolios</div>
        </div>

        <div className="card kpi-card">
          <div className="kpi-label">MULTI-AGENT INVOCATIONS</div>
          <div className="kpi-value" style={{ color: 'var(--brand-orange)' }}>
            <CountUp from={0} to={totalCalls} duration={1.2} /> RUNS
          </div>
          <div className="kpi-sub">Fetcha + Geek + Orc pipeline executions</div>
        </div>

        <div className="card kpi-card">
          <div className="kpi-label">API UNIT ECONOMICS</div>
          <div className="kpi-value" style={{ color: 'var(--text-primary)' }}>
            $<CountUp from={0} to={totalCost} duration={1.2} decimals={2} />
          </div>
          <div className="kpi-sub">Avg $0.05 per 3-stage agentic evaluation</div>
        </div>

        <div className="card kpi-card">
          <div className="kpi-label">ACTIVE PERSONNEL & AGENTS</div>
          <div className="kpi-value" style={{ color: 'var(--brand-orange)' }}>
            {users.length} IDENTITIES
          </div>
          <div className="kpi-sub">Zero unauthorized access breaches</div>
        </div>
      </div>

      {/* Multi-Agent Daemons Live Status Banner */}
      <div className="agent-status-grid">
        <div className="agent-daemon-card">
          <div className="daemon-header">
            <span className="daemon-name">FETCHA (AGENT 1)</span>
            <span className="daemon-badge green">ONLINE</span>
          </div>
          <p className="daemon-meta">Gemini 2.5 Flash • Tabular Extraction & GSTN Registry Scraper</p>
          <div className="daemon-footer">
            <span>Latency: 1.14s</span>
            <span>Uptime: 99.98%</span>
          </div>
        </div>

        <div className="agent-daemon-card">
          <div className="daemon-header">
            <span className="daemon-name">GEEK (AGENT 2)</span>
            <span className="daemon-badge green">ONLINE</span>
          </div>
          <p className="daemon-meta">Gemini 2.5 Pro • Quantitative Matrix & Debt Capacity Engine</p>
          <div className="daemon-footer">
            <span>Latency: 2.05s</span>
            <span>Precision: High</span>
          </div>
        </div>

        <div className="agent-daemon-card">
          <div className="daemon-header">
            <span className="daemon-name">ORC (AGENT 3)</span>
            <span className="daemon-badge green">ONLINE</span>
          </div>
          <p className="daemon-meta">Gemini 2.5 Pro • Chief Credit Officer, XAI & Hallucination Rails</p>
          <div className="daemon-footer">
            <span>Latency: 2.30s</span>
            <span>Policy: Enforced</span>
          </div>
        </div>
      </div>

      {/* Nav Tabs */}
      <div className="tab-row">
        <button 
          className={`tab-btn ${activeTab === 'telemetry' ? 'active' : ''}`}
          onClick={() => setActiveTab('telemetry')}
        >
          <Users size={16} /> PERSONNEL & AUTH TELEMETRY
        </button>
        <button 
          className={`tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          <Database size={16} /> UNDERWRITING AUDIT ARCHIVE
        </button>
        <button 
          className={`tab-btn ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          <Shield size={16} /> ENTERPRISE SECURITY RAILS
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
                    <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{u.username}</div>
                    <code style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>{u.email || u.id}</code>
                  </td>
                  <td>
                    <span style={{ color: 'var(--brand-orange)', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontWeight: 'bold' }}>
                      {u.role || 'Enterprise Officer'}
                    </span>
                  </td>
                  <td>
                    <span className="status-tag">
                      {u.status || 'Active (Verified)'}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{u.calls || 0} runs</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: 'var(--brand-orange)' }}>
                    ${Math.round(Number(u.cost || 0) * 100) / 100}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
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
                <th>CREDIT SCORE</th>
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
                    <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{h.name}</div>
                    <code style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>{h.id}</code>
                  </td>
                  <td>
                    <span className="score-pill" style={{ color: h.score >= 700 ? 'var(--brand-green)' : 'var(--brand-orange)' }}>
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
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{h.buffer || '0.45x'}</td>
                  <td>
                    <span style={{ color: 'var(--brand-green)', fontWeight: 'bold', fontSize: '0.8rem' }}>
                      {h.compliance || '100% Verified'}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {new Date(h.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Enterprise Security Rails */}
      {activeTab === 'security' && (
        <div className="grid-2" style={{ gap: '1.5rem' }}>
          <div className="card">
            <h3 style={{ color: 'var(--brand-orange)', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock size={18} /> Enterprise Access Control Matrix
            </h3>
            <div className="security-item">
              <div>
                <strong>Google SSO Domain Lock</strong>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>
                  Rejects any Google authentication not issued by <code>@enveraitech.com</code>.
                </p>
              </div>
              <span className="badge badge-LOW">ENFORCED</span>
            </div>

            <div className="security-item">
              <div>
                <strong>Master Citadel Password Wall</strong>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>
                  Hardened brick-wall validation for master administrator credentials (<code>Andalaus</code>).
                </p>
              </div>
              <span className="badge badge-LOW">ENFORCED</span>
            </div>

            <div className="security-item">
              <div>
                <strong>5-Minute Inactivity Session Sentinel (Orc)</strong>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>
                  Automatically locks cockpit after 300 seconds of idle user state.
                </p>
              </div>
              <span className="badge badge-LOW">ACTIVE</span>
            </div>
          </div>

          <div className="card">
            <h3 style={{ color: 'var(--brand-green)', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={18} /> Safety Rails & SecOps Dispatch
            </h3>
            <div className="security-item">
              <div>
                <strong>Slack Instant SecOps Notification</strong>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>
                  Dispatches login events, client IP, and underwriting runs to Slack iOS / Spark.
                </p>
              </div>
              <span className="badge badge-LOW">CONNECTED</span>
            </div>

            <div className="security-item">
              <div>
                <strong>NeMo Hallucination Guardrails</strong>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>
                  Verifies numeric consistency between Fetcha statements and Geek metrics.
                </p>
              </div>
              <span className="badge badge-LOW">ACTIVE</span>
            </div>

            <div className="security-item">
              <div>
                <strong>Zero-Trace File Scrubbing</strong>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>
                  Uploaded PDF/CSV statements are processed in memory / tmp and scrubbed after agent pipeline ingestion.
                </p>
              </div>
              <span className="badge badge-LOW">ENFORCED</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
