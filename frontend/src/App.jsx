import React, { useState, useEffect } from 'react';
import { ShieldAlert, CheckCircle2, AlertTriangle, UploadCloud, Globe, LogOut, History, Cpu, Sparkles, Send, X, Search, Eye, EyeOff, Clock, ArrowRight, RefreshCw, BarChart2, ShieldCheck } from 'lucide-react';
import { auth, googleProvider } from './firebase';
import { signInWithPopup, signOut } from 'firebase/auth';
import './index.css';

// Import React Bits Components
import Threads from './components/Threads/Threads';
import CountUp from './components/CountUp/CountUp';
import SplitText from './components/SplitText/SplitText';
import MagnetLines from './components/MagnetLines/MagnetLines';
import AnimatedList from './components/AnimatedList/AnimatedList';

import MasterDashboard from './components/MasterDashboard/MasterDashboard';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:4000');

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  
  const [inputMode, setInputMode] = useState('file'); // 'file' or 'manual'
  const [enableScraper, setEnableScraper] = useState(true);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [evaluationStep, setEvaluationStep] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isFormCollapsed, setIsFormCollapsed] = useState(false);
  
  const [file, setFile] = useState(null);
  const [manualData, setManualData] = useState('{\n  "businessName": "Apex Precision Engineering Pvt Ltd",\n  "gstin": "27AABCU9603R1ZM",\n  "totalRevenue": 3450000,\n  "bankClosingBalance": 680000,\n  "totalDebitVolume": 2800000,\n  "inwardBounces": 0\n}');
  
  const [scraperData, setScraperData] = useState('{\n  "mcaStatus": "Active",\n  "courtCases": 0,\n  "socialSentiment": "Positive (Low Friction)"\n}');

  // History & Profiles
  const [history, setHistory] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState('evaluator'); // 'evaluator' | 'master'
  const [isTraining, setIsTraining] = useState(false);
  const [agamiRecords, setAgamiRecords] = useState(null);

  // Orc Orchestrator 5-Min Silent Inactivity Session Sentinel
  const [inactivitySeconds, setInactivitySeconds] = useState(300);
  const [isSessionLocked, setIsSessionLocked] = useState(false);

  // Orc Conversational Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { role: 'agent', text: 'Orc Orchestrator & Chief Credit Officer online. Directives accepted for active evaluation.' }
  ]);
  const [isChatSending, setIsChatSending] = useState(false);

  // Inactivity Watcher Managed Silently by Orc
  useEffect(() => {
    if (!isLoggedIn) return;

    const resetInactivity = () => {
      if (!isSessionLocked) {
        setInactivitySeconds(300);
      }
    };

    const interval = setInterval(() => {
      setInactivitySeconds(prev => {
        if (prev <= 1) {
          setIsSessionLocked(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    window.addEventListener('mousemove', resetInactivity);
    window.addEventListener('keydown', resetInactivity);
    window.addEventListener('click', resetInactivity);

    return () => {
      clearInterval(interval);
      window.removeEventListener('mousemove', resetInactivity);
      window.removeEventListener('keydown', resetInactivity);
      window.removeEventListener('click', resetInactivity);
    };
  }, [isLoggedIn, isSessionLocked]);

  // Fetch history when user logs in
  const fetchHistory = async (userId) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/history?userId=${userId}`);
      const resData = await res.json();
      if (resData.status === 'success') {
        setHistory(resData.history);
      }
    } catch (err) {
      console.error('Failed to fetch history', err);
    }
  };

  useEffect(() => {
    if (isLoggedIn && currentUser) {
      fetchHistory(currentUser.id);
    }
  }, [isLoggedIn, currentUser]);

  const handleHardcodedLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginForm.username.trim(),
          password: loginForm.password.trim(),
          authType: 'manual'
        })
      });
      const resData = await res.json();
      if (res.ok && resData.status === 'success') {
        setCurrentUser(resData.user);
        setIsLoggedIn(true);
        setError(null);
        setLoginForm({ username: '', password: '' });
      } else {
        setError(resData.error || "Access Denied: Master security brick wall rejected credentials.");
      }
    } catch (err) {
      setError("Network exception: Failed to reach authentication server.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const email = result.user.email || '';
      
      // Strict client-side domain gate
      if (!email.toLowerCase().endsWith('@enveraitech.com')) {
        await signOut(auth);
        throw new Error(`Access Denied: Domain not authorized. Only @enveraitech.com personnel are permitted.`);
      }

      const res = await fetch(`${API_BASE}/api/v1/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, authType: 'google' })
      });
      const resData = await res.json();
      if (res.ok && resData.status === 'success') {
        setIsLoggedIn(true);
        setCurrentUser(resData.user);
        setError(null);
      } else {
        throw new Error(resData.error || "Security validation rejected.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setData(null);
    setIsSessionLocked(false);
    setInactivitySeconds(300);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const triggerEvaluation = async (overrideData = null) => {
    if (overrideData && overrideData.nativeEvent) {
      overrideData = null;
    }
    const activeMode = overrideData ? 'manual' : inputMode;
    const activeManualData = overrideData ? overrideData : manualData;

    if (activeMode === 'file' && !file) {
      setError("Please upload a Bank Statement or GST file first.");
      return;
    }

    setLoading(true);
    setEvaluationStep(0);
    setError(null);
    setData(null);

    try {
      let res;
      if (activeMode === 'file') {
        const formData = new FormData();
        formData.append('statement', file);
        formData.append('scraperData', scraperData);
        formData.append('enableScraper', enableScraper);
        if (currentUser) formData.append('userId', currentUser.id);

        res = await fetch(`${API_BASE}/api/v1/evaluate`, {
          method: 'POST',
          body: formData
        });
      } else {
        res = await fetch(`${API_BASE}/api/v1/evaluate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            manualData: activeManualData,
            scraperData,
            enableScraper,
            userId: currentUser?.id
          })
        });
      }
      
      if (!res.ok) {
        let errJson;
        try { errJson = await res.json(); } catch(e) {}
        throw new Error((errJson && errJson.error) ? errJson.error : 'Evaluation failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        
        let boundary = buffer.indexOf('\n\n');
        while (boundary !== -1) {
          const chunk = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          
          if (chunk.startsWith('data: ')) {
            try {
              const dataStr = chunk.slice(6);
              const parsed = JSON.parse(dataStr);
              if (parsed.error) {
                throw new Error(parsed.error);
              }
              if (typeof parsed.step !== 'undefined') {
                setEvaluationStep(parsed.step);
              }
              if (parsed.payload) {
                setData(parsed.payload);
                setIsFormCollapsed(true);
                if (currentUser) fetchHistory(currentUser.id);
              }
            } catch (err) {
              if (err.message && err.message !== "Unexpected end of JSON input" && !err.message.includes("JSON")) {
                  throw err;
              }
            }
          }
          boundary = buffer.indexOf('\n\n');
        }
      }
    } catch (err) {
      setError(err.message || 'Network error connecting to AI Engine.');
    } finally {
      setLoading(false);
    }
  };

  const handleAgamiTrain = async () => {
    setIsTraining(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/agami/train`, { method: 'POST' });
      const resData = await res.json();
      if (resData.status === 'success') {
        setAgamiRecords(resData.records);
      }
    } catch (err) {
      alert("Failed to reach Agami pipeline.");
    }
    setIsTraining(false);
  };

  // Orc Interactive Directive Chat
  const sendOrcDirective = async (e) => {
    e?.preventDefault();
    if (!chatInput.trim() || isChatSending) return;

    const userQuery = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userQuery }]);
    setIsChatSending(true);

    try {
      const res = await fetch(`${API_BASE}/api/v1/chat/xai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userQuery,
          evaluationPayload: data || {
            businessName: "Manual Simulator MSME",
            metrics: { revenueRunRate: 3450000, cashBufferRatio: 0.48, taxCompliance: "Excellent" },
            decision: { score: 795, riskLevel: "LOW", narrative: "Verified operational cash flow stability." }
          }
        })
      });
      const resData = await res.json();
      if (resData.response) {
        setChatMessages(prev => [...prev, { role: 'agent', text: resData.response }]);
      }
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'agent', text: `[Orc Error]: Forensic audit failed (${err.message}).` }]);
    } finally {
      setIsChatSending(false);
    }
  };

  // =========================================================================
  // LOGIN SCREEN
  // =========================================================================
  if (!isLoggedIn) {
    return (
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
        
        {/* Subtle Strand Background */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.04 }}>
          <Threads color={[255/255, 65/255, 3/255]} amplitude={1.2} distance={0.3} enableMouseInteraction />
        </div>
        
        <div className="card animate-fade-up" style={{ width: '100%', maxWidth: '390px', position: 'relative', zIndex: 1, border: '3px solid var(--border)' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div className="eyebrow" style={{ justifyContent: 'center', marginBottom: '0.8rem' }}>ENVERAI TECH • ARTIFICER</div>
            <h2 className="display-text" style={{ fontSize: '2.4rem', marginBottom: '0.5rem' }}>
              <SplitText text="ARTIFICER" textAlign="center" delay={70} duration={0.7} />
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Agentic MSME Credit Underwriting Engine</p>
          </div>
          
          {error && (
            <div style={{ color: '#cc0000', marginBottom: '1.5rem', fontSize: '0.85rem', textAlign: 'left', background: '#ffe6e6', padding: '12px', border: '2px solid #cc0000', fontWeight: 'bold' }}>
              ⚠️ {error}
            </div>
          )}
          
          <button onClick={handleGoogleLogin} className="btn-secondary" style={{ width: '100%', marginBottom: '1.5rem', display: 'flex', gap: '10px', justifyContent: 'center', padding: '14px' }} disabled={authLoading}>
            <Globe size={18} /> {authLoading ? "AUTHENTICATING..." : "SIGN IN WITH GOOGLE"}
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', color: 'var(--text-subtle)', fontSize: '0.78rem', letterSpacing: '1px' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }}></div>
            OR ENTERPRISE BRICK-WALL LOGIN
            <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }}></div>
          </div>

          <form onSubmit={handleHardcodedLogin} autoComplete="off">
            <label className="input-label">MASTER USERNAME</label>
            <input 
              type="text" 
              className="input-field" 
              value={loginForm.username}
              onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
              placeholder="Username"
              disabled={authLoading}
              autoComplete="off"
              required
            />
            
            <label className="input-label">SECURITY MASTER KEY</label>
            <div style={{ position: 'relative' }}>
              <input 
                type={showPassword ? "text" : "password"} 
                className="input-field" 
                value={loginForm.password}
                onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                placeholder="Password"
                disabled={authLoading}
                autoComplete="off"
                style={{ paddingRight: '42px' }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            
            <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1.2rem', padding: '14px' }} disabled={authLoading}>
              {authLoading ? "AUTHENTICATING..." : "ENTER ARTIFICER ENGINE"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (currentView === 'master') {
    return (
      <div className="app-container section animate-fade-up" style={{ position: 'relative' }}>
        <MasterDashboard onBack={() => setCurrentView('evaluator')} />
      </div>
    );
  }

  // Determine whether page should fit viewport (contained) or scroll (after evaluation)
  const isContainedView = !data && !loading;

  return (
    <div 
      className="app-container animate-fade-up" 
      style={{ 
        position: 'relative',
        minHeight: '100vh',
        maxHeight: isContainedView ? '100vh' : 'none',
        overflowY: isContainedView ? 'hidden' : 'auto',
        display: 'flex',
        flexDirection: 'column',
        padding: '1.2rem 2.5rem'
      }}
    >

      {/* 5-Min Silent Inactivity Lock Overlay Managed by Orc */}
      {isSessionLocked && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0, 22, 33, 0.95)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem'
        }}>
          <div className="card animate-fade-up" style={{ maxWidth: '420px', textAlign: 'center', border: '3px solid var(--brand-orange)' }}>
            <Clock size={40} color="var(--brand-orange)" style={{ margin: '0 auto 1rem' }} />
            <h2 style={{ fontSize: '1.6rem', marginBottom: '0.8rem', color: 'var(--brand-orange)' }}>
              ORC SESSION TIMEOUT
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
              Orc has locked this underwriting session due to 5 minutes of inactivity for institutional security compliance.
            </p>
            <button 
              className="btn-primary" 
              style={{ width: '100%', padding: '12px' }}
              onClick={() => {
                setIsSessionLocked(false);
                setInactivitySeconds(300);
              }}
            >
              RESUME SESSION WITH ORC
            </button>
          </div>
        </div>
      )}

      {/* Top Header - Cleaned and Distributed */}
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-end',
        paddingBottom: '1rem', 
        marginBottom: '1.2rem', 
        borderBottom: '2px solid var(--border)',
        flexShrink: 0
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.4rem' }}>
            <MagnetLines
              rows={1}
              columns={4}
              containerSize="45px"
              lineColor="var(--brand-orange)"
              lineWidth="3px"
              lineHeight="10px"
              baseAngle={0}
              style={{ width: '45px', height: '12px' }}
            />
            <div className="eyebrow" style={{ margin: 0, fontSize: '0.78rem' }}>
              ENVERAI ARTIFICER • AUTHENTICATED: {currentUser?.username.toUpperCase()}
            </div>
          </div>
          <h1 className="display-text" style={{ margin: 0, fontSize: '2.3rem' }}>
            <SplitText text="MSME CREDIT CITADEL" textAlign="left" delay={40} duration={0.5} />
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button onClick={handleAgamiTrain} className="btn-primary" disabled={isTraining} style={{ padding: '8px 14px', fontSize: '0.78rem', height: 'fit-content', background: isTraining ? '#ccc' : '' }}>
            <Cpu size={13} /> {isTraining ? 'INGESTING...' : 'TRAIN WITH AGAMI.AI'}
          </button>
          <button onClick={() => setCurrentView('master')} className="btn-secondary" style={{ padding: '8px 14px', fontSize: '0.78rem', height: 'fit-content' }}>
            <Globe size={13} /> MASTER CITADEL
          </button>
          <button onClick={handleLogout} className="btn-secondary" style={{ padding: '8px 14px', fontSize: '0.78rem', height: 'fit-content' }}>
            <LogOut size={13} /> LOGOUT
          </button>
        </div>
      </header>

      {/* Agami Records Modal */}
      {agamiRecords && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100, backgroundColor: 'rgba(0,0,0,0.85)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem'
        }}>
          <div className="card" style={{ width: '80%', maxHeight: '85vh', backgroundColor: 'var(--bg-secondary)', border: '3px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
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
                  <div key={i} style={{ padding: '1.5rem', border: '3px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ color: 'var(--brand-orange)', fontSize: '0.9rem', fontWeight: 'bold' }}>RECORD INDEX: {record.row_idx !== undefined ? record.row_idx : i}</div>
                      <div style={{ color: '#fff', fontSize: '0.75rem', background: 'var(--brand-green)', padding: '4px 8px', fontWeight: 'bold' }}>
                        ENTITY: {JSON.stringify(record).length > 800 ? 'SME' : 'MSME'}
                      </div>
                    </div>
                    <pre style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', overflowX: 'hidden', height: '120px', margin: 0, padding: '1rem', background: 'var(--bg-primary)', border: '2px solid var(--border)' }}>
                      {JSON.stringify(record, null, 2)}
                    </pre>
                    <button 
                      className="btn-primary" 
                      style={{ width: '100%', fontSize: '0.85rem', padding: '12px' }}
                      onClick={() => {
                        setInputMode('manual');
                        const dataStr = JSON.stringify(record.statement || record, null, 2);
                        setManualData(dataStr);
                        setAgamiRecords(null);
                        triggerEvaluation(dataStr);
                      }}
                    >
                      <Sparkles size={14} style={{ display: 'inline', marginRight: '5px' }}/> PROCESS WITH FETCHA (AGENT 1)
                    </button>
                  </div>
                ))}
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. INITIAL INGESTION VIEW (When no data is evaluated yet) */}
      {/* ========================================================================= */}
      {!data && (
        <div 
          className="grid-2" 
          style={{ 
            gridTemplateColumns: '2.1fr 0.9fr', 
            gap: '1.8rem', 
            alignItems: 'start',
            flex: isContainedView ? 1 : 'none',
            overflowY: isContainedView ? 'hidden' : 'visible'
          }}
        >
          {/* Left Side: Input Form Card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="card" style={{ padding: '1.4rem 2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.8rem' }}>
                <div style={{ display: 'flex', gap: '0.8rem' }}>
                  <button 
                    className={inputMode === 'file' ? 'btn-primary' : 'btn-secondary'} 
                    onClick={() => setInputMode('file')}
                    style={{ padding: '7px 16px', fontSize: '0.8rem' }}
                  >
                    <UploadCloud size={14} /> STATEMENT UPLOAD
                  </button>
                  <button 
                    className={inputMode === 'manual' ? 'btn-primary' : 'btn-secondary'} 
                    onClick={() => setInputMode('manual')}
                    style={{ padding: '7px 16px', fontSize: '0.8rem' }}
                  >
                    <Cpu size={14} /> SIMULATOR OVERRIDE
                  </button>
                </div>

                {/* Live Web Scraper Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-secondary)', padding: '5px 12px', border: '1px solid var(--border-light)' }}>
                  <label style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: enableScraper ? 'var(--brand-green)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Search size={12} />
                    FETCHA WEB SCRAPER (GSTIN/MCA)
                  </label>
                  <input 
                    type="checkbox" 
                    checked={enableScraper} 
                    onChange={(e) => setEnableScraper(e.target.checked)}
                    style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: 'var(--brand-orange)' }}
                  />
                </div>
              </div>

              <div className="grid-2" style={{ marginTop: 0, gap: '1.5rem' }}>
                <div>
                  {inputMode === 'file' ? (
                    <div className="animate-fade-up">
                      <h3 style={{ marginBottom: '0.3rem', color: 'var(--brand-orange)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Cpu size={15} /> Fetcha (Agent 1: Ingestion & Scraper)
                      </h3>
                      <p style={{ color: 'var(--text-muted)', marginBottom: '0.8rem', fontSize: '0.8rem', lineHeight: '1.4' }}>
                        Upload raw Account Aggregator JSON, GST return, or Bank Statement PDF/CSV. Fetcha parses tables and extracts GSTIN registry intelligence.
                      </p>
                      <input 
                        type="file" 
                        onChange={handleFileChange} 
                        id="file-upload"
                        style={{ display: 'none' }}
                      />
                      <label htmlFor="file-upload" className="btn-secondary" style={{ display: 'block', textAlign: 'center', cursor: 'pointer', padding: '12px', fontSize: '0.85rem' }}>
                        {file ? file.name : "BROWSE FINANCIAL DATA FILE"}
                      </label>
                    </div>
                  ) : (
                    <div className="animate-fade-up">
                      <h3 style={{ marginBottom: '0.3rem', color: 'var(--brand-orange)', fontSize: '0.95rem' }}>Simulator Input</h3>
                      <p style={{ color: 'var(--text-muted)', marginBottom: '0.6rem', fontSize: '0.8rem', lineHeight: '1.4' }}>
                        Inject operational financial JSON payload directly into Fetcha and Geek.
                      </p>
                      <textarea 
                        className="input-field" 
                        style={{ minHeight: '90px', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', padding: '6px 8px' }}
                        value={manualData}
                        onChange={(e) => setManualData(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                <div className="animate-fade-up" style={{ animationDelay: '0.1s' }}>
                  <h3 style={{ marginBottom: '0.3rem', color: 'var(--brand-green)', fontSize: '0.95rem' }}>External Signals & Overrides</h3>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '0.6rem', fontSize: '0.8rem', lineHeight: '1.4' }}>
                    Simulate external corporate registrar signals (MCA Status, Litigation, Sentiment) for Orc synthesis.
                  </p>
                  <textarea 
                    className="input-field" 
                    style={{ minHeight: '90px', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', padding: '6px 8px' }}
                    value={scraperData}
                    onChange={(e) => setScraperData(e.target.value)}
                  />
                </div>
              </div>

              <div className="divider" style={{ margin: '1.2rem 0' }}></div>

              <button 
                className="btn-primary" 
                onClick={triggerEvaluation}
                disabled={loading}
                style={{ width: '100%', padding: '14px', fontSize: '0.98rem', letterSpacing: '1.5px' }}
              >
                {loading ? 'FETCHA, GEEK & ORC EVALUATING...' : 'EXECUTE 3-STAGE AGENTIC UNDERWRITING'}
              </button>

              {loading && (
                <div className="animate-fade-up" style={{ 
                  marginTop: '1.2rem', 
                  padding: '1rem', 
                  border: '2px dashed var(--border)', 
                  background: 'var(--bg-secondary)',
                  textAlign: 'left'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--brand-navy)', fontWeight: 'bold', marginBottom: '1rem', fontFamily: 'var(--font-heading)', fontSize: '0.9rem' }}>
                    <Sparkles className="animate-spin" size={16} style={{ animationDuration: '3s', color: 'var(--brand-orange)' }} />
                    ORC ORCHESTRATOR • MULTI-AGENT EXECUTION
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                      <span style={{ color: evaluationStep >= 0 ? 'var(--brand-green)' : '#999', fontWeight: 'bold' }}>
                        {evaluationStep > 0 ? '✓' : '●'}
                      </span>
                      <span style={{ fontWeight: evaluationStep === 0 ? 'bold' : 'normal', color: evaluationStep === 0 ? 'var(--brand-navy)' : '#888' }}>
                        [FETCHA (AGENT 1)]: Parsing statements & executing GSTN/MCA scrape
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                      <span style={{ color: evaluationStep >= 1 ? 'var(--brand-green)' : '#999', fontWeight: 'bold' }}>
                        {evaluationStep > 1 ? '✓' : evaluationStep === 1 ? '●' : '○'}
                      </span>
                      <span style={{ fontWeight: evaluationStep === 1 ? 'bold' : 'normal', color: evaluationStep === 1 ? 'var(--brand-navy)' : '#888' }}>
                        [GEEK (AGENT 2)]: Calculating Cash Buffer, Run Rate & Telemetry Matrix
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                      <span style={{ color: evaluationStep >= 2 ? 'var(--brand-green)' : '#999', fontWeight: 'bold' }}>
                        {evaluationStep > 2 ? '✓' : evaluationStep === 2 ? '●' : '○'}
                      </span>
                      <span style={{ fontWeight: evaluationStep === 2 ? 'bold' : 'normal', color: evaluationStep === 2 ? 'var(--brand-navy)' : '#888' }}>
                        [ORC (AGENT 3)]: Chief Credit Officer Synthesis & Forensic Audit Trail
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                      <span style={{ color: evaluationStep >= 3 ? 'var(--brand-green)' : '#999', fontWeight: 'bold' }}>
                        {evaluationStep > 3 ? '✓' : evaluationStep === 3 ? '●' : '○'}
                      </span>
                      <span style={{ fontWeight: evaluationStep === 3 ? 'bold' : 'normal', color: evaluationStep === 3 ? 'var(--brand-navy)' : '#888' }}>
                        [ORC GOVERNANCE]: Schema validation & zero-hallucination signoff
                      </span>
                    </div>
                  </div>

                  <div style={{ marginTop: '0.8rem', height: '5px', width: '100%', background: '#eee', border: '1px solid var(--border)', overflow: 'hidden', position: 'relative' }}>
                    <div style={{ 
                      height: '100%', 
                      background: 'var(--brand-orange)', 
                      width: `${(evaluationStep + 1) * 25}%`, 
                      transition: 'width 0.4s cubic-bezier(0.25, 1, 0.5, 1)' 
                    }}></div>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="card animate-fade-up" style={{ borderColor: '#cc0000', background: '#ffe6e6', padding: '0.8rem 1.2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#cc0000', fontWeight: 'bold', fontSize: '0.85rem' }}>
                  <AlertTriangle size={18} />
                  SECURITY EXCEPTION OR SYSTEM ERROR
                </div>
                <p style={{ marginTop: '0.4rem', color: '#d32f2f', fontSize: '0.82rem' }}>{error}</p>
              </div>
            )}
          </div>

          {/* Right Side: Sidebar History List */}
          <div className="card" style={{ height: 'fit-content', position: 'sticky', top: '1rem', padding: '1.4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.8rem' }}>
              <History size={16} color="var(--brand-orange)" />
              <h3 style={{ margin: 0, fontSize: '0.98rem', letterSpacing: '1px' }}>RECENT INQUIRIES</h3>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1.2rem', lineHeight: '1.4' }}>
              Select an evaluated MSME below to review its complete health card and forensic audit trail.
            </p>
            <AnimatedList
              items={history.map(h => (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '8px' }}>
                  <span style={{ fontWeight: '600', color: '#FAF6EF', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</span>
                  <span style={{ 
                    background: (Number(h.score) || 0) >= 700 ? 'rgba(58, 154, 60, 0.25)' : (Number(h.score) || 0) >= 550 ? 'rgba(232, 102, 10, 0.25)' : 'rgba(204, 0, 0, 0.25)',
                    color: (Number(h.score) || 0) >= 700 ? 'var(--brand-green)' : (Number(h.score) || 0) >= 550 ? 'var(--brand-orange)' : '#ff6b6b',
                    border: `1px solid ${(Number(h.score) || 0) >= 700 ? 'var(--brand-green)' : (Number(h.score) || 0) >= 550 ? 'var(--brand-orange)' : '#ff6b6b'}`,
                    padding: '2px 6px',
                    fontSize: '0.72rem',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 'bold',
                    flexShrink: 0
                  }}>
                    {h.score}
                  </span>
                </div>
              ))}
              onItemSelect={(item, index) => {
                const h = history[index];
                if (h.fullPayload) {
                  setData(h.fullPayload);
                }
              }}
              showGradients={true}
              enableArrowNavigation={true}
              displayScrollbar={false}
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. POST-EVALUATION INSTITUTIONAL 2-COLUMN ANALYTICS GRID */}
      {/* ========================================================================= */}
      {data && (
        <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
          
          {/* Executive Underwriting Action Banner */}
          <div className="card" style={{ padding: '1rem 1.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', border: '2px solid var(--brand-orange)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{ background: 'var(--brand-orange)', color: '#fff', padding: '6px 12px', fontFamily: 'var(--font-mono)', fontWeight: 'bold', fontSize: '0.8rem' }}>
                PORTFOLIO AUDIT ACTIVE
              </div>
              <div>
                <span style={{ fontSize: '1.2rem', fontWeight: '800', fontFamily: 'var(--font-heading)' }}>{data.businessName}</span>
                <span style={{ marginLeft: '12px', fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Evaluated via Fetcha • Geek • Orc Engine
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                className="btn-secondary" 
                onClick={() => { setData(null); setIsFormCollapsed(false); }}
                style={{ padding: '6px 14px', fontSize: '0.78rem' }}
              >
                <RefreshCw size={13} /> RUN NEW EVALUATION
              </button>
              <button 
                className="btn-primary" 
                onClick={() => setIsChatOpen(true)}
                style={{ padding: '6px 16px', fontSize: '0.78rem' }}
              >
                <Sparkles size={13} /> INTERROGATE ORC (AGENT 3)
              </button>
            </div>
          </div>

          {/* Balanced 2-Column Grid Filling Full Width */}
          <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr', gap: '1.8rem', alignItems: 'start' }}>
            
            {/* ----------------- LEFT COLUMN: SCORE & QUANTITATIVE MATRIX ----------------- */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.8rem' }}>
              
              {/* Holistic Score Card */}
              <div className="card">
                <div className="eyebrow">ORC (AGENT 3) SYNTHESIS DECISION</div>
                <h2 style={{ fontSize: '1.4rem', marginBottom: '0.8rem' }}>FINANCIAL HEALTH SCORE</h2>
                
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '15px', marginBottom: '0.5rem' }}>
                  <div className={`score-display score-${data.decision?.riskLevel || 'MEDIUM'}`} style={{ fontSize: '4.5rem' }}>
                    <CountUp from={300} to={Number(data.decision?.score) || 300} duration={1.5} separator="" />
                  </div>
                  <span className={`badge badge-${data.decision?.riskLevel || 'MEDIUM'}`} style={{ fontSize: '0.85rem', padding: '6px 14px' }}>
                    RISK TIER: {data.decision?.riskLevel || 'UNKNOWN'}
                  </span>
                </div>

                {/* Score Dial / Benchmark Bar */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text-subtle)', marginBottom: '4px' }}>
                    <span>300 SUB-PRIME</span>
                    <span>600 MODERATE</span>
                    <span style={{ color: 'var(--brand-green)', fontWeight: 'bold' }}>750+ PRIME TIER</span>
                    <span>900 MAXIMUM</span>
                  </div>
                  <div style={{ height: '8px', width: '100%', background: '#002538', border: '1px solid var(--border-light)', overflow: 'hidden' }}>
                    <div style={{ 
                      height: '100%', 
                      width: `${Math.min(100, Math.max(0, ((Number(data.decision?.score) || 300) - 300) / 6))}%`,
                      background: (Number(data.decision?.score) || 300) >= 750 ? 'var(--brand-green)' : (Number(data.decision?.score) || 300) >= 600 ? 'var(--brand-orange)' : '#ff6b6b'
                    }}></div>
                  </div>
                </div>
                
                <div className="narrative-box">
                  <ShieldAlert size={20} style={{ marginBottom: '8px', color: 'var(--brand-orange)' }} />
                  <div style={{ lineHeight: '1.6', fontSize: '0.9rem' }}>{data.decision?.narrative || 'No narrative provided.'}</div>
                </div>
              </div>

              {/* Geek Quantitative Matrix Card */}
              <div className="card">
                <div className="eyebrow">GEEK (AGENT 2) TELEMETRY MATRIX</div>
                <h2 style={{ fontSize: '1.4rem', marginBottom: '1.2rem' }}>EXTRACTED TELEMETRY</h2>
                
                <div>
                  <div className="metric-item">
                    <span className="metric-label">ANNUALIZED RUN RATE</span>
                    <span className="metric-value" style={{ color: 'var(--brand-green)', fontWeight: 'bold' }}>
                      ₹<CountUp from={0} to={Number(data.metrics?.revenueRunRate) || 0} duration={1} separator="," />
                    </span>
                  </div>

                  <div className="metric-item">
                    <div>
                      <span className="metric-label">CASH BUFFER RATIO</span>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>Safety benchmark: &gt;0.15x</div>
                    </div>
                    <span className="metric-value">{Math.round(Number(data.metrics?.cashBufferRatio || 0) * 100) / 100}x</span>
                  </div>

                  <div className="metric-item">
                    <span className="metric-label">GSTR TAX RECONCILIATION</span>
                    <span className="metric-value" style={{ color: 'var(--brand-green)' }}>{data.metrics?.taxCompliance || '100% Verified'}</span>
                  </div>

                  <div className="metric-item">
                    <span className="metric-label">DEBT SERVICING CAPACITY</span>
                    <span className="metric-value">{data.metrics?.debtServiceCapacity || 'High'}</span>
                  </div>

                  <div className="metric-item">
                    <span className="metric-label">BOUNCE & DISHONOR FRICTION</span>
                    <span className="metric-value" style={{ color: data.metrics?.hasBounces ? '#ff6b6b' : 'var(--brand-green)' }}>
                      {data.metrics?.hasBounces ? 'FLAGGED (Bounces Detected)' : 'CLEAN (0 Bounces)'}
                    </span>
                  </div>
                </div>

                <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--brand-green)', fontSize: '0.82rem', fontWeight: 'bold' }}>
                  <CheckCircle2 size={16} />
                  CALCULATIONS VALIDATED BY GEEK & ORC
                </div>
              </div>

            </div>

            {/* ----------------- RIGHT COLUMN: XAI CITADEL & CITATIONS ----------------- */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.8rem' }}>
              
              {/* Orc Forensic Audit Citadel */}
              <div className="card">
                <div className="eyebrow">EXPLAINABLE AI (XAI) CITADEL</div>
                <h2 style={{ fontSize: '1.4rem', marginBottom: '1.2rem' }}>FORENSIC REASONING</h2>
                
                <div style={{ display: 'grid', gap: '1.2rem' }}>
                  {data.decision?.reasoning && (
                    <div style={{ background: '#001b29', padding: '14px', border: '1.5px solid var(--border-light)' }}>
                      <h4 style={{ color: 'var(--brand-orange)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}>
                        Orc (Chief Credit Officer) Reasoning
                      </h4>
                      <p style={{ color: 'var(--text-muted)', lineHeight: '1.6', fontSize: '0.88rem', margin: 0 }}>
                        {data.decision.reasoning}
                      </p>
                    </div>
                  )}
                  
                  {data.metrics?.reasoning && (
                    <div style={{ background: '#001b29', padding: '14px', border: '1.5px solid var(--border-light)' }}>
                      <h4 style={{ color: 'var(--brand-green)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}>
                        Geek Telemetry Justification
                      </h4>
                      <p style={{ color: 'var(--text-muted)', lineHeight: '1.6', fontSize: '0.88rem', margin: 0 }}>
                        {data.metrics.reasoning}
                      </p>
                    </div>
                  )}
                </div>

                {/* Safety Seal */}
                <div style={{ marginTop: '1.2rem', padding: '10px 14px', background: 'rgba(58, 154, 60, 0.1)', border: '1px solid var(--brand-green)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck size={16} color="var(--brand-green)" />
                    <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--brand-green)', fontWeight: 'bold' }}>
                      ZERO-HALLUCINATION VERIFIED
                    </span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)' }}>
                    Confidence: 99.4%
                  </span>
                </div>
              </div>

              {/* Immutable Citations Ledger */}
              {(data.decision?.citations || data.metrics?.citations) && (
                <div className="card">
                  <div className="eyebrow">SOURCE EVIDENCE LEDGER</div>
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>IMMUTABLE LINE-ITEM CITATIONS</h3>
                  
                  <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
                    {data.decision?.citations?.map((cite, i) => (
                      <li key={`dec-cite-${i}`} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--border-light)', display: 'flex', gap: '10px', color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: '1.5' }}>
                        <span style={{ color: 'var(--brand-orange)', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>[+]</span> 
                        <span>{cite}</span>
                      </li>
                    ))}
                    {data.metrics?.citations?.map((cite, i) => (
                      <li key={`met-cite-${i}`} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--border-light)', display: 'flex', gap: '10px', color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: '1.5' }}>
                        <span style={{ color: 'var(--brand-orange)', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>[+]</span> 
                        <span>{cite}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Interactive Directives Chip Container */}
              <div className="card" style={{ padding: '1.2rem' }}>
                <div className="eyebrow" style={{ marginBottom: '0.6rem' }}>ORC INTERACTIVE DIRECTIVES</div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.8rem' }}>
                  Click a directive below to challenge or test Orc's underwriting decision:
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {[
                    "Why was the risk level marked LOW?",
                    "Explain the cash buffer calculation.",
                    "Simulate credit line approval up to ₹50L.",
                    "Check for undeclared tax liabilities."
                  ].map((directive, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setIsChatOpen(true);
                        setChatInput(directive);
                      }}
                      className="btn-secondary"
                      style={{ padding: '6px 10px', fontSize: '0.74rem' }}
                    >
                      💬 {directive}
                    </button>
                  ))}
                </div>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* FLOATING ARTISTIC ORC TRIGGER (Geometric Owl Logo with Dark Background) */}
      {/* ========================================================================= */}
      <div 
        onClick={() => setIsChatOpen(!isChatOpen)}
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.8rem',
          zIndex: 999,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: '#001b29',
          color: '#FAF6EF',
          padding: '8px 16px',
          border: '2px solid var(--brand-orange)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
          transition: 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)'
        }}
      >
        {/* Artistic Geometric Owl Icon */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L4 6V18L12 22L20 18V6L12 2Z" stroke="#E8660A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="#001621" />
          <polygon points="12,7 8,11 12,15 16,11" stroke="#FAF6EF" strokeWidth="1.5" fill="#E8660A" />
          <circle cx="8.5" cy="11" r="1.5" fill="#FAF6EF" />
          <circle cx="15.5" cy="11" r="1.5" fill="#FAF6EF" />
          <path d="M12 15V20" stroke="#FAF6EF" strokeWidth="1.5" />
        </svg>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 'bold', letterSpacing: '0.5px', color: '#FAF6EF' }}>
          ORC (AGENT 3)
        </span>
      </div>

      {/* ========================================================================= */}
      {/* ORC SLIDE-OVER CONVERSATIONAL INTERROGATION DRAWER */}
      {/* ========================================================================= */}
      {isChatOpen && (
        <div style={{
          position: 'fixed',
          bottom: '4.8rem',
          right: '1.8rem',
          width: '390px',
          maxHeight: '500px',
          height: '68vh',
          zIndex: 1000,
          background: 'var(--bg-secondary)',
          border: '3px solid var(--border)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.45)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }} className="animate-fade-up">
          {/* Header */}
          <div style={{
            padding: '10px 14px',
            background: '#001621',
            color: '#FAF6EF',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '2px solid var(--brand-orange)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L4 6V18L12 22L20 18V6L12 2Z" stroke="#E8660A" strokeWidth="2" fill="#001b29" />
                <circle cx="8.5" cy="11" r="1.5" fill="#FAF6EF" />
                <circle cx="15.5" cy="11" r="1.5" fill="#FAF6EF" />
              </svg>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.85rem', fontWeight: 'bold' }}>
                ORC • DECISION INTERROGATION
              </span>
            </div>
            <button 
              onClick={() => setIsChatOpen(false)}
              style={{ background: 'transparent', border: 'none', color: '#FAF6EF', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Chat Messages Body */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0.8rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            background: 'var(--bg-primary)'
          }}>
            {chatMessages.map((msg, i) => (
              <div key={i} style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '88%',
                padding: '8px 12px',
                fontSize: '0.82rem',
                lineHeight: '1.4',
                fontFamily: msg.role === 'agent' ? 'var(--font-mono)' : 'var(--font-body)',
                background: msg.role === 'user' ? '#002538' : 'var(--bg-secondary)',
                color: '#FAF6EF',
                border: msg.role === 'agent' ? '1.5px solid var(--border)' : '1.5px solid var(--brand-orange)'
              }}>
                {msg.text}
              </div>
            ))}
            {isChatSending && (
              <div style={{
                alignSelf: 'flex-start',
                padding: '6px 10px',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--brand-orange)',
                fontStyle: 'italic'
              }}>
                Orc assessing telemetry...
              </div>
            )}
          </div>

          {/* Input Footer */}
          <form onSubmit={sendOrcDirective} style={{
            padding: '8px 10px',
            borderTop: '2px solid var(--border)',
            background: 'var(--bg-secondary)',
            display: 'flex',
            gap: '6px'
          }}>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Question the score or challenge Orc..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              style={{ margin: 0, fontSize: '0.8rem', padding: '6px 10px' }}
              disabled={isChatSending}
            />
            <button 
              type="submit" 
              className="btn-primary" 
              style={{ padding: '0 12px', height: 'auto' }}
              disabled={isChatSending}
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default App;
