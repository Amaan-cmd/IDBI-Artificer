import React, { useState } from 'react';
import { ShieldAlert, CheckCircle2, AlertTriangle, UploadCloud, Lock, Edit3, Globe, LogOut } from 'lucide-react';
import { auth, googleProvider } from './firebase';
import { signInWithPopup, signOut } from 'firebase/auth';
import './index.css';

// Managed ACL for EnverAI domain
const ALLOWED_DOMAIN = 'enveraitech.com';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  
  const [inputMode, setInputMode] = useState('file'); // 'file' or 'manual'
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  
  const [file, setFile] = useState(null);
  const [manualData, setManualData] = useState('{\n  "businessName": "Demo Corp",\n  "totalRevenue": 2500000,\n  "bankClosingBalance": 450000,\n  "inwardBounces": 0\n}');
  
  const [scraperData, setScraperData] = useState('{\n  "mcaStatus": "Active",\n  "courtCases": 0,\n  "socialSentiment": "Positive"\n}');

  const handleHardcodedLogin = (e) => {
    e.preventDefault();
    if (loginForm.username === 'IDBI Innovate' && loginForm.password === 'Nemotron') {
      setIsLoggedIn(true);
      setError(null);
    } else {
      setError("Invalid credentials. Access Denied.");
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const email = result.user.email;
      if (email.endsWith(`@${ALLOWED_DOMAIN}`)) {
        setIsLoggedIn(true);
        setError(null);
      } else {
        await signOut(auth);
        setError(`Access restricted to @${ALLOWED_DOMAIN} managed accounts.`);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setIsLoggedIn(false);
    setData(null);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const triggerEvaluation = async () => {
    if (inputMode === 'file' && !file) {
      setError("Please upload a Bank Statement or GST file first.");
      return;
    }

    setLoading(true);
    setError(null);
    setData(null);

    try {
      let res;
      if (inputMode === 'file') {
        const formData = new FormData();
        formData.append('statement', file);
        formData.append('scraperData', scraperData);
        res = await fetch('http://localhost:4000/api/v1/evaluate', {
          method: 'POST',
          body: formData
        });
      } else {
        res = await fetch('http://localhost:4000/api/v1/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ manualData, scraperData })
        });
      }
      
      const json = await res.json();
      if (res.ok) {
        setData(json);
      } else {
        setError(json.error || 'Evaluation failed');
      }
    } catch (err) {
      setError('Network error connecting to AI Engine.');
    }
    setLoading(false);
  };

  if (!isLoggedIn) {
    return (
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div className="card animate-fade-up" style={{ width: '100%', maxWidth: '420px' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <Lock size={40} color="var(--brand-orange)" style={{ marginBottom: '1.5rem' }} />
            <h2 className="display-text" style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>IDBI PORTAL</h2>
            <p style={{ color: 'var(--text-muted)' }}>Sign in to EnverAI Underwriting Engine</p>
          </div>
          
          {error && <div style={{ color: '#ff5252', marginBottom: '1.5rem', fontSize: '0.9rem', textAlign: 'center', background: 'rgba(211,47,47,0.1)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,82,82,0.3)' }}>{error}</div>}
          
          <button onClick={handleGoogleLogin} className="btn-secondary" style={{ width: '100%', marginBottom: '2rem', display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <Globe size={18} /> SIGN IN WITH ENVERAI
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2rem', color: 'var(--text-subtle)', fontSize: '0.8rem' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }}></div>
            OR SECURE LOGIN
            <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }}></div>
          </div>

          <form onSubmit={handleHardcodedLogin}>
            <label className="input-label">CLIENT ID</label>
            <input 
              type="text" 
              className="input-field" 
              value={loginForm.username}
              onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
              placeholder="IDBI Innovate"
            />
            
            <label className="input-label">PASSWORD</label>
            <input 
              type="password" 
              className="input-field" 
              value={loginForm.password}
              onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
              placeholder="••••••••"
            />
            
            <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
              AUTHENTICATE
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container section animate-fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div className="eyebrow">IDBI INNOVATION HACKATHON</div>
        <button onClick={handleLogout} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.8rem' }}>
          <LogOut size={14} /> LOGOUT
        </button>
      </div>
      <h1 className="display-text">MSME HEALTH CARD</h1>

      <div className="card" style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '2rem' }}>
          <button 
            className={inputMode === 'file' ? 'btn-primary' : 'btn-secondary'} 
            onClick={() => setInputMode('file')}
          >
            <UploadCloud size={16} /> AGAMI DATASET UPLOAD
          </button>
          <button 
            className={inputMode === 'manual' ? 'btn-primary' : 'btn-secondary'} 
            onClick={() => setInputMode('manual')}
          >
            <Edit3 size={16} /> DATA OVERRIDE
          </button>
        </div>

        <div className="grid-2" style={{ marginTop: 0, gap: '3rem' }}>
          <div>
            {inputMode === 'file' ? (
              <div className="animate-fade-up">
                <h3 style={{ marginBottom: '1rem', color: 'var(--brand-orange)' }}>Data Ingestion Module</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                  Upload raw Agami AI Account Aggregator JSON, GST return, or Bank Statement. The Nemotron AI Agent will parse the unstructured data securely.
                </p>
                <input 
                  type="file" 
                  onChange={handleFileChange} 
                  id="file-upload"
                  style={{ display: 'none' }}
                />
                <label htmlFor="file-upload" className="btn-secondary" style={{ display: 'block', textAlign: 'center' }}>
                  {file ? file.name : "BROWSE DATA FILE"}
                </label>
              </div>
            ) : (
              <div className="animate-fade-up">
                <h3 style={{ marginBottom: '1rem', color: 'var(--brand-orange)' }}>Structured Fallback</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                  Manually inject financial structures directly into the multi-agent pipeline.
                </p>
                <textarea 
                  className="input-field" 
                  style={{ minHeight: '150px', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
                  value={manualData}
                  onChange={(e) => setManualData(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="animate-fade-up" style={{ animationDelay: '0.1s' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--brand-green)' }}>External API Scraper Simulation</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Simulate fetching external risk data (e.g., MCA Status, Legal/Court history) to factor into the final Nemotron synthesis.
            </p>
            <textarea 
              className="input-field" 
              style={{ minHeight: '150px', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', borderColor: 'rgba(58,154,60,0.3)' }}
              value={scraperData}
              onChange={(e) => setScraperData(e.target.value)}
            />
          </div>
        </div>

        <div className="divider"></div>

        <button 
          className="btn-primary" 
          onClick={triggerEvaluation}
          disabled={loading}
          style={{ width: '100%', padding: '18px', fontSize: '1.1rem', letterSpacing: '2px' }}
        >
          {loading ? 'NEMOTRON PIPELINE EXECUTING...' : 'INITIALIZE AI UNDERWRITING'}
        </button>
      </div>

      {error && (
        <div className="card animate-fade-up" style={{ borderColor: 'rgba(211,47,47,0.4)', background: 'rgba(211,47,47,0.05)', marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#ff5252', fontWeight: 'bold' }}>
            <AlertTriangle size={24} />
            SECURITY EXCEPTION OR SYSTEM ERROR
          </div>
          <p style={{ marginTop: '0.8rem', color: '#ffcdd2' }}>{error}</p>
        </div>
      )}

      {data && (
        <div className="grid-2 animate-fade-up">
          {/* Score Card */}
          <div className="card">
            <div className="eyebrow">NEMOTRON DECISION ENGINE</div>
            <h2 style={{ fontSize: '1.8rem', marginBottom: '1rem' }}>HOLISTIC CREDIT SCORE</h2>
            
            <div className={`score-display score-${data.decision.riskLevel}`}>
              {data.decision.score}
            </div>
            
            <div style={{ marginBottom: '2rem' }}>
              <span className={`badge badge-${data.decision.riskLevel}`}>
                RISK LEVEL: {data.decision.riskLevel}
              </span>
            </div>
            
            <div className="narrative-box">
              <ShieldAlert size={22} style={{ marginBottom: '12px', color: 'var(--brand-orange)' }} />
              <div style={{ lineHeight: '1.7' }}>{data.decision.narrative}</div>
            </div>
          </div>

          {/* Metrics Card */}
          <div className="card">
            <div className="eyebrow">EXTRACTED TELEMETRY</div>
            <h2 style={{ fontSize: '1.8rem', marginBottom: '2rem' }}>FINANCIAL METRICS</h2>
            
            <div>
              <div className="metric-item">
                <span className="metric-label">BUSINESS ENTITY</span>
                <span className="metric-value">{data.businessName}</span>
              </div>
              <div className="metric-item">
                <span className="metric-label">ANNUAL RUN RATE</span>
                <span className="metric-value">₹{data.metrics.revenueRunRate.toLocaleString()}</span>
              </div>
              <div className="metric-item">
                <span className="metric-label">CASH BUFFER</span>
                <span className="metric-value">{data.metrics.cashBufferRatio.toFixed(2)}x</span>
              </div>
              <div className="metric-item">
                <span className="metric-label">TAX COMPLIANCE</span>
                <span className="metric-value">{data.metrics.taxCompliance}</span>
              </div>
              <div className="metric-item">
                <span className="metric-label">BOUNCE HISTORY</span>
                <span className="metric-value">{data.metrics.hasBounces ? 'FLAGGED' : 'CLEAN'}</span>
              </div>
            </div>

            <div style={{ marginTop: '2.5rem', display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--brand-green)', fontSize: '0.9rem', fontWeight: 'bold' }}>
              <CheckCircle2 size={20} />
              VERIFIED BY MULTI-AGENT PIPELINE
            </div>
          </div>
        </div>
      )}

      {data && (data.decision.citations || data.metrics.citations) && (
        <div className="card animate-fade-up" style={{ marginTop: '2.5rem' }}>
          <div className="eyebrow">EXPLAINABLE AI (XAI)</div>
          <h2 style={{ fontSize: '1.8rem', marginBottom: '2rem' }}>FORENSIC AUDIT TRAIL</h2>
          
          <div style={{ display: 'grid', gap: '2rem' }}>
            {data.decision.reasoning && (
              <div>
                <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.9rem' }}>Decision Reasoning</h4>
                <p style={{ color: 'var(--text-muted)', lineHeight: '1.7' }}>{data.decision.reasoning}</p>
              </div>
            )}
            
            {data.metrics.reasoning && (
              <div>
                <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.9rem' }}>Metrics Reasoning</h4>
                <p style={{ color: 'var(--text-muted)', lineHeight: '1.7' }}>{data.metrics.reasoning}</p>
              </div>
            )}

            <div>
              <h4 style={{ color: 'var(--text-primary)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.9rem' }}>Immutable Data Citations</h4>
              <ul style={{ listStyleType: 'none', padding: 0 }}>
                {data.decision.citations?.map((cite, i) => (
                  <li key={`dec-cite-${i}`} style={{ padding: '1rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '15px', color: 'var(--text-muted)' }}>
                    <span style={{ color: 'var(--brand-orange)', fontWeight: 'bold' }}>[+]</span> {cite}
                  </li>
                ))}
                {data.metrics.citations?.map((cite, i) => (
                  <li key={`met-cite-${i}`} style={{ padding: '1rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '15px', color: 'var(--text-muted)' }}>
                    <span style={{ color: 'var(--brand-orange)', fontWeight: 'bold' }}>[+]</span> {cite}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
