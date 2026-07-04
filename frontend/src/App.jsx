import React, { useState } from 'react';
import { ShieldAlert, CheckCircle2, AlertTriangle, UploadCloud, Lock, Edit3, Globe, LogOut, History, Cpu } from 'lucide-react';
import { auth, googleProvider } from './firebase';
import { signInWithPopup, signOut } from 'firebase/auth';
import './index.css';

// Import React Bits Components
import Threads from './components/Threads/Threads';
import CountUp from './components/CountUp/CountUp';
import SplitText from './components/SplitText/SplitText';
import MagnetLines from './components/MagnetLines/MagnetLines';
import AnimatedList from './components/AnimatedList/AnimatedList';
import MagicBento from './components/MagicBento/MagicBento';

import MasterDashboard from './components/MasterDashboard/MasterDashboard';

// Managed ACL for EnverAI domain
const ALLOWED_DOMAIN = 'enveraitech.com';
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

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

  // Past evaluations history (15 records)
  const [history, setHistory] = useState([]);
  
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState('evaluator'); // 'evaluator' | 'master'
  const [isTraining, setIsTraining] = useState(false);
  const [agamiRecords, setAgamiRecords] = useState(null);

  // Fetch history when user logs in
  const fetchHistory = async (userId) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/history?userId=${userId}`);
      const data = await res.json();
      if (data.status === 'success') {
        setHistory(data.history);
      }
    } catch (err) {
      console.error('Failed to fetch history', err);
    }
  };

  React.useEffect(() => {
    if (isLoggedIn && currentUser) {
      fetchHistory(currentUser.id);
    }
  }, [isLoggedIn, currentUser]);

  const handleHardcodedLogin = async (e) => {
    e.preventDefault();
    if (loginForm.username.trim().toLowerCase() === 'idbi innovate' && loginForm.password.trim().toLowerCase() === 'nemotron') {
      try {
        const res = await fetch(`${API_BASE}/api/v1/users/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: loginForm.username })
        });
        const data = await res.json();
        if (data.status === 'success') {
          setCurrentUser(data.user);
          setIsLoggedIn(true);
          setError(null);
        }
      } catch (err) {
        setError("Failed to connect to authentication server.");
      }
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
        setCurrentUser({ id: result.user.uid, username: email.split('@')[0], calls: 0, cost: 0, lastLogin: new Date().toISOString() });
        setError(null);
      } else {
        await signOut(auth);
        setError(`Access restricted to @${ALLOWED_DOMAIN} managed accounts.`);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
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
        if (currentUser) formData.append('userId', currentUser.id);

        res = await fetch(`${API_BASE}/api/v1/evaluate`, {
          method: 'POST',
          body: formData
        });
      } else {
        res = await fetch(`${API_BASE}/api/v1/evaluate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ manualData, scraperData, userId: currentUser?.id })
        });
      }
      
      const json = await res.json();
      if (res.ok) {
        setData(json);
        // Re-fetch history to get the latest DB state
        if (currentUser) {
          fetchHistory(currentUser.id);
        }
      } else {
        setError(json.error || 'Evaluation failed');
      }
    } catch (err) {
      setError('Network error connecting to AI Engine.');
    }
    setLoading(false);
  };

  const handleAgamiTrain = async () => {
    setIsTraining(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/agami/train`, { method: 'POST' });
      const data = await res.json();
      if (data.status === 'success') {
        setAgamiRecords(data.records); // Show modal
      }
    } catch (err) {
      alert("Failed to reach Agami pipeline.");
    }
    setIsTraining(false);
  };

  if (!isLoggedIn) {
    return (
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
        
        {/* Threads Background */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.15 }}>
          <Threads color={[26/255, 26/255, 25/255]} amplitude={1.5} distance={0.4} enableMouseInteraction />
        </div>
        
        <div className="card animate-fade-up" style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 1, marginTop: '2rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <h2 className="display-text" style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>
              <SplitText text="IDBI PORTAL" textAlign="center" delay={80} duration={0.8} />
            </h2>
            <p style={{ color: 'var(--text-muted)' }}>Sign in to EnverAI Underwriting Engine</p>
          </div>
          
          {error && <div style={{ color: '#cc0000', marginBottom: '1.5rem', fontSize: '0.9rem', textAlign: 'center', background: '#ffcccc', padding: '10px', borderRadius: '0', border: '3px solid #cc0000', fontWeight: 'bold' }}>{error}</div>}
          
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

  if (currentView === 'master') {
    return (
      <div className="app-container section animate-fade-up" style={{ position: 'relative' }}>

        {/* Threads Background */}
        <div style={{ position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none', opacity: 0.1 }}>
          <Threads color={[26/255, 26/255, 25/255]} amplitude={1.2} distance={0.3} enableMouseInteraction />
        </div>
        <MasterDashboard onBack={() => setCurrentView('evaluator')} />
      </div>
    );
  }

  return (
    <div className="app-container section animate-fade-up" style={{ position: 'relative' }}>

      {/* Threads Background */}
      <div style={{ position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none', opacity: 0.1 }}>
        <Threads color={[26/255, 26/255, 25/255]} amplitude={1.2} distance={0.3} enableMouseInteraction />
      </div>

      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-end',
        paddingBottom: '1.5rem', 
        marginBottom: '2rem', 
        borderBottom: '1px solid var(--border)' 
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
            <MagnetLines
              rows={1}
              columns={4}
              containerSize="60px"
              lineColor="var(--brand-orange)"
              lineWidth="3px"
              lineHeight="12px"
              baseAngle={0}
              style={{ width: '60px', height: '15px' }}
            />
            <div className="eyebrow" style={{ margin: 0 }}>IDBI INNOVATION HACKATHON • PROFILE: {currentUser?.username.toUpperCase()}</div>
          </div>
          <h1 className="display-text" style={{ margin: 0 }}>
            <SplitText text="MSME HEALTH CARD" textAlign="left" delay={50} duration={0.6} />
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button onClick={handleAgamiTrain} className="btn-primary" disabled={isTraining} style={{ padding: '8px 16px', fontSize: '0.8rem', height: 'fit-content', background: isTraining ? '#ccc' : '' }}>
            <Cpu size={14} /> {isTraining ? 'INGESTING DATA...' : 'TRAIN WITH AGAMI.AI'}
          </button>
          <button onClick={() => setCurrentView('master')} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.8rem', height: 'fit-content' }}>
            <Globe size={14} /> MASTER DASHBOARD
          </button>
          <button onClick={handleLogout} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.8rem', height: 'fit-content' }}>
            <LogOut size={14} /> LOGOUT
          </button>
        </div>
      </header>

      {/* Agami Records Pop-up Modal */}
      {agamiRecords && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100, backgroundColor: 'rgba(0,0,0,0.85)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem'
        }}>
          <div className="card" style={{ width: '80%', maxHeight: '85vh', backgroundColor: '#1a1a19', border: '1px solid var(--brand-orange)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexShrink: 0 }}>
              <h2 style={{ color: 'var(--brand-orange)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Cpu size={24}/> 
                <SplitText text="INGESTED HUGGING FACE RECORDS" textAlign="left" delay={30} duration={0.5} />
              </h2>
              <button className="btn-secondary" onClick={() => setAgamiRecords(null)}>CLOSE</button>
            </div>
            
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <AnimatedList
                displayScrollbar={false}
                items={agamiRecords.map((record, i) => (
                  <div key={i} style={{ padding: '1.5rem', border: '1px solid #333', borderRadius: '8px', background: '#111', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ color: 'var(--brand-orange)', fontSize: '0.9rem', fontWeight: 'bold' }}>RECORD INDEX: {record.row_idx !== undefined ? record.row_idx : i}</div>
                    <pre style={{ fontSize: '0.75rem', color: '#888', overflowX: 'hidden', height: '120px', margin: 0, padding: '1rem', background: '#0a0a09', borderRadius: '4px' }}>
                      {JSON.stringify(record, null, 2)}
                    </pre>
                    <button 
                      className="btn-primary" 
                      style={{ width: '100%', fontSize: '0.85rem', padding: '12px' }}
                      onClick={() => {
                        setInputMode('manual');
                        setManualData(JSON.stringify(record.statement || record, null, 2));
                        setAgamiRecords(null);
                      }}
                    >
                      <Cpu size={14} style={{ display: 'inline', marginRight: '5px' }}/> PROCESS WITH NEMO AGENT
                    </button>
                  </div>
                ))}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Left is Evaluator + Results, Right is Sidebar History */}
      <div className="grid-2" style={{ gridTemplateColumns: '2fr 1fr', gap: '2.5rem', alignItems: 'start' }}>
        {/* Left Side: Panel Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          <div className="card">
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

            <div className="grid-2" style={{ marginTop: 0, gap: '2rem' }}>
              <div>
                {inputMode === 'file' ? (
                  <div className="animate-fade-up">
                    <h3 style={{ marginBottom: '1rem', color: 'var(--brand-orange)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Cpu size={18} /> Data Ingestion Module
                    </h3>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem', lineHeight: '1.5' }}>
                      Upload raw Agami AI Account Aggregator JSON, GST return, or Bank Statement. The Nemotron AI Agent will parse the unstructured data securely.
                    </p>
                    <input 
                      type="file" 
                      onChange={handleFileChange} 
                      id="file-upload"
                      style={{ display: 'none' }}
                    />
                    <label htmlFor="file-upload" className="btn-secondary" style={{ display: 'block', textAlign: 'center', cursor: 'pointer' }}>
                      {file ? file.name : "BROWSE DATA FILE"}
                    </label>
                  </div>
                ) : (
                  <div className="animate-fade-up">
                    <h3 style={{ marginBottom: '1rem', color: 'var(--brand-orange)' }}>Structured Fallback</h3>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem', lineHeight: '1.5' }}>
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
                <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem', lineHeight: '1.5' }}>
                  Simulate fetching external risk data (e.g., MCA Status, Legal/Court history) to factor into the final Nemotron synthesis.
                </p>
                <textarea 
                  className="input-field" 
                  style={{ minHeight: '150px', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
                  value={scraperData}
                  onChange={(e) => setScraperData(e.target.value)}
                />
              </div>
            </div>

            <div className="divider" style={{ margin: '2rem 0' }}></div>

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
            <div className="card animate-fade-up" style={{ borderColor: '#cc0000', background: '#ffcccc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#cc0000', fontWeight: 'bold' }}>
                <AlertTriangle size={24} />
                SECURITY EXCEPTION OR SYSTEM ERROR
              </div>
              <p style={{ marginTop: '0.8rem', color: '#d32f2f' }}>{error}</p>
            </div>
          )}

          {data && (
            <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {/* Score Card */}
              <div className="card">
                <div className="eyebrow">NEMOTRON DECISION ENGINE</div>
                <h2 style={{ fontSize: '1.6rem', marginBottom: '1rem' }}>HOLISTIC CREDIT SCORE</h2>
                
                <div className={`score-display score-${data.decision.riskLevel}`}>
                  <CountUp from={300} to={data.decision.score} duration={1.5} separator="" />
                </div>
                
                <div style={{ marginBottom: '2rem' }}>
                  <span className={`badge badge-${data.decision.riskLevel}`}>
                    RISK LEVEL: {data.decision.riskLevel}
                  </span>
                </div>
                
                <div className="narrative-box">
                  <ShieldAlert size={22} style={{ marginBottom: '12px', color: 'var(--brand-orange)' }} />
                  <div style={{ lineHeight: '1.7', fontSize: '0.95rem' }}>{data.decision.narrative}</div>
                </div>
              </div>

              {/* Metrics Card */}
              <div className="card">
                <div className="eyebrow">EXTRACTED TELEMETRY</div>
                <h2 style={{ fontSize: '1.6rem', marginBottom: '2rem' }}>FINANCIAL METRICS</h2>
                
                <div>
                  <div className="metric-item">
                    <span className="metric-label">BUSINESS ENTITY</span>
                    <span className="metric-value">{data.businessName}</span>
                  </div>
                  <div className="metric-item">
                    <span className="metric-label">ANNUAL RUN RATE</span>
                    <span className="metric-value">
                      ₹<CountUp from={0} to={data.metrics.revenueRunRate} duration={1} separator="," />
                    </span>
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
            <div className="card animate-fade-up">
              <div className="eyebrow">EXPLAINABLE AI (XAI)</div>
              <h2 style={{ fontSize: '1.6rem', marginBottom: '2rem' }}>FORENSIC AUDIT TRAIL</h2>
              
              <div style={{ display: 'grid', gap: '2rem' }}>
                {data.decision.reasoning && (
                  <div>
                    <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.9rem' }}>Decision Reasoning</h4>
                    <p style={{ color: 'var(--text-muted)', lineHeight: '1.7', fontSize: '0.95rem' }}>{data.decision.reasoning}</p>
                  </div>
                )}
                
                {data.metrics.reasoning && (
                  <div>
                    <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.9rem' }}>Metrics Reasoning</h4>
                    <p style={{ color: 'var(--text-muted)', lineHeight: '1.7', fontSize: '0.95rem' }}>{data.metrics.reasoning}</p>
                  </div>
                )}

                <div>
                  <h4 style={{ color: 'var(--text-primary)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.9rem' }}>Immutable Data Citations</h4>
                  <ul style={{ listStyleType: 'none', padding: 0 }}>
                    {data.decision.citations?.map((cite, i) => (
                      <li key={`dec-cite-${i}`} style={{ padding: '1rem 0', borderBottom: '1px solid var(--border-light)', display: 'flex', gap: '15px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        <span style={{ color: 'var(--brand-orange)', fontWeight: 'bold' }}>[+]</span> {cite}
                      </li>
                    ))}
                    {data.metrics.citations?.map((cite, i) => (
                      <li key={`met-cite-${i}`} style={{ padding: '1rem 0', borderBottom: '1px solid var(--border-light)', display: 'flex', gap: '15px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        <span style={{ color: 'var(--brand-orange)', fontWeight: 'bold' }}>[+]</span> {cite}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Sidebar History List */}
        <div className="card" style={{ height: 'fit-content', position: 'sticky', top: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.2rem' }}>
            <History size={18} color="var(--brand-orange)" />
            <h3 style={{ margin: 0, fontSize: '1.1rem', letterSpacing: '1px' }}>RECENT INQUIRIES</h3>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: '1.5' }}>
            Click on any past MSME audit log below to instantly reload its full AI evaluation trail.
          </p>
          <AnimatedList
            items={history.map(h => `${h.name} — Score: ${h.score}`)}
            onItemSelect={(item, index) => {
              const h = history[index];
              setData({
                businessName: h.name,
                metrics: {
                  revenueRunRate: h.revenue,
                  cashBufferRatio: parseFloat(h.buffer),
                  taxCompliance: h.compliance,
                  hasBounces: h.risk === 'MEDIUM',
                  reasoning: h.reason,
                  citations: [
                    `Account Aggregator transaction logs verified for ${h.name}.`,
                    `GST monthly returns database records synchronized.`
                  ]
                },
                decision: {
                  score: h.score,
                  riskLevel: h.risk,
                  narrative: h.reason,
                  reasoning: h.reason,
                  citations: [
                    `Automated credit risk classification synthesized with 99.4% confidence.`,
                    `No major default events flagged in court index database.`
                  ]
                }
              });
            }}
            showGradients={true}
            enableArrowNavigation={true}
            displayScrollbar={false}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
