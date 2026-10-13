import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Terminal, Send, Trash2, Sparkles, ChevronRight, Cpu, Building2, HelpCircle } from 'lucide-react';
import './OrcTerminal.css';
import { getCompanyDecisionData, generateOrcResponse } from '../../utils/orcIntelligence';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:4000');

export default function OrcTerminal({ currentBusiness, onQuickInspect }) {
  // Compute enriched decision data for the currently selected business
  const companyData = useMemo(() => {
    return getCompanyDecisionData(
      currentBusiness?.name,
      currentBusiness?.gstin,
      currentBusiness?.probeData
    );
  }, [currentBusiness?.name, currentBusiness?.gstin, currentBusiness?.probeData]);

  const [messages, setMessages] = useState([
    {
      id: 'init-1',
      sender: 'system',
      text: `ORC CCO CITADEL TERMINAL v2.9.6 [ACTIVE]
Grounded Underwriting Intelligence Kernel · RBI Digital Lending Policy
Deterministic 5-Pillar Financial Analysis Engine Online.`
    },
    {
      id: 'init-2',
      sender: 'orc',
      text: `Greetings Officer. I am Orc, Chief Credit Officer agent. I have synthesized bank statements, GSTR filings, and MCA records for ${companyData.name} (GSTIN: ${companyData.gstin} · Score: ${companyData.score}/900 · ${companyData.riskTier}).

You may interrogate why this specific decision was taken, the 300–900 points breakdown, downside friction factors, or any credit ratio.`
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const prevGstinRef = useRef(companyData.gstin);

  // Announce context switch when user picks a different enterprise
  useEffect(() => {
    if (prevGstinRef.current !== companyData.gstin) {
      prevGstinRef.current = companyData.gstin;
      setMessages(prev => [
        ...prev,
        {
          id: `ctx_${Date.now()}`,
          sender: 'system',
          text: `[CONTEXT SWITCHED]: Target Entity recalibrated to: ${companyData.name} (${companyData.gstin}) · Score: ${companyData.score} (${companyData.riskTier}) · Verdict: ${companyData.sanctionVerdict}`
        },
        {
          id: `orc_ctx_${Date.now()}`,
          sender: 'orc',
          text: `Ready to audit ${companyData.name}. Ask me: "Why was this decision taken?", "Why is the score ${companyData.score}?", or select a quick directive below.`
        }
      ]);
    }
  }, [companyData.gstin, companyData.name, companyData.score, companyData.riskTier, companyData.sanctionVerdict]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async (queryText = null) => {
    const textToSend = (queryText || input).trim();
    if (!textToSend || loading) return;

    const userMsg = {
      id: `u_${Date.now()}`,
      sender: 'user',
      text: textToSend
    };

    setMessages(prev => [...prev, userMsg]);
    if (!queryText) setInput('');
    setLoading(true);

    const qLower = textToSend.toLowerCase();

    // Check for clear command
    if (qLower === 'clear') {
      setMessages([
        {
          id: `sys_${Date.now()}`,
          sender: 'system',
          text: `Terminal cleared. Orc CCO daemon active for ${companyData.name} (${companyData.gstin}).`
        }
      ]);
      setLoading(false);
      return;
    }

    try {
      if (API_BASE) {
        const res = await fetch(`${API_BASE}/api/v1/chat/xai`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: textToSend,
            evaluationPayload: {
              businessName: companyData.name,
              gstin: companyData.gstin,
              score: companyData.score,
              riskTier: companyData.riskTier,
              sanctionVerdict: companyData.sanctionVerdict,
              recommendedLimit: companyData.recommendedLimit,
              metrics: companyData.metrics,
              mathDrivers: companyData.mathDrivers
            }
          })
        });
        const data = await res.json();
        if (data.response) {
          setMessages(prev => [
            ...prev,
            { id: `orc_${Date.now()}`, sender: 'orc', text: data.response }
          ]);
          setLoading(false);
          return;
        }
      }
      throw new Error();
    } catch {
      // High-precision grounded intelligence engine
      const response = generateOrcResponse(textToSend, companyData);

      setTimeout(() => {
        setMessages(prev => [
          ...prev,
          { id: `orc_${Date.now()}`, sender: 'orc', text: response }
        ]);
        setLoading(false);
      }, 350);
    }
  };

  // Quick Directive chips tailored specifically for decision interrogation
  const QUICK_PROMPTS = [
    { label: "🎯 Why was this decision taken?", query: `Why was this decision taken for ${companyData.name}? Explain the complete credit verdict and rationale.` },
    { label: `📊 Score Drivers (${companyData.score} pts)`, query: `Why is the score ${companyData.score} for ${companyData.name}? Show the step-by-step mathematical points calculation.` },
    { label: "🔍 Pillar 1–5 Decision Rationale", query: "Provide a detailed Pillar 1 to Pillar 5 audit breakdown of this underwriting decision." },
    { label: "⚠️ Downside Risks & Friction", query: `What risk friction or negative factors prevented a higher score for ${companyData.name}?` },
    { label: "📈 Sensitivity: What raises the score?", query: `What counterfactual changes would upgrade ${companyData.name} to Prime (850+)?` },
    { label: `💰 Sanction Limit Rationale (${companyData.recommendedLimit})`, query: `Why was ${companyData.recommendedLimit} limit recommended for ${companyData.name}?` },
    { label: "🏛️ RBI Policy Attestation", query: "What RBI Digital Lending policies and zero-hallucination rules govern this credit decision?" }
  ];

  return (
    <div className="orc-terminal-container">
      {/* Terminal Titlebar - THREE WINDOW SIGNAL DOTS PRESERVED PROMINENTLY */}
      <div className="orc-terminal-titlebar">
        <div className="terminal-window-buttons" title="Citadel Terminal Controls">
          <span 
            className="window-dot dot-red" 
            title="Clear Terminal Console" 
            onClick={() => handleSend('clear')}
          />
          <span 
            className="window-dot dot-yellow" 
            title="Reset Terminal View" 
            onClick={() => handleSend('clear')}
          />
          <span 
            className="window-dot dot-green" 
            title="Executive Underwriting Memo" 
            onClick={() => handleSend('Why was this decision taken?')}
          />
        </div>
        
        <div className="terminal-title">
          <Terminal size={14} className="text-celadon" />
          <span>orc@enver-citadel:~$ /bin/orc-intelligence --mode=institutional</span>
        </div>

        <div className="terminal-target-badge" title={`Active Target: ${companyData.name}`}>
          <Building2 size={12} className="text-celadon" />
          <span className="target-name-truncated">{companyData.name.split(' ')[0]}</span>
          <span className="target-score-pill">{companyData.score}</span>
        </div>

        <div className="terminal-status-pill">
          <span className="status-indicator-live"></span>
          <span>GEMINI & ENVER SEC-OP ONLINE</span>
        </div>
      </div>

      {/* Preset Query Chips - Decision Interrogation Focused */}
      <div className="terminal-presets-bar">
        <span className="presets-label">
          <Sparkles size={12} className="text-celadon" /> Interrogate Decision:
        </span>
        {QUICK_PROMPTS.map((p, idx) => (
          <button
            key={idx}
            className="terminal-preset-chip"
            onClick={() => handleSend(p.query)}
            disabled={loading}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Terminal Output Area */}
      <div className="orc-terminal-stream" ref={scrollRef}>
        {messages.map(m => (
          <div key={m.id} className={`terminal-message message-${m.sender}`}>
            {m.sender === 'system' ? (
              <pre className="system-log-line">{m.text}</pre>
            ) : m.sender === 'user' ? (
              <div className="user-command-line">
                <span className="terminal-prompt-symbol">&gt; </span>
                <span className="user-query-text">{m.text}</span>
              </div>
            ) : (
              <div className="orc-response-block">
                <div className="orc-agent-badge">
                  <Cpu size={13} className="text-celadon" />
                  <span>ORC CHIEF CREDIT OFFICER (DECISION EXPLAINABILITY):</span>
                </div>
                <div className="orc-response-text">{m.text}</div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="terminal-loading-indicator">
            <span className="terminal-prompt-symbol">&gt; </span>
            <span className="loading-dots">Orc evaluating financial telemetry & decision audit trail...</span>
          </div>
        )}
      </div>

      {/* Terminal Input Bar */}
      <form className="orc-terminal-input-bar" onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
        <div className="input-prompt-label">
          <span className="text-celadon font-mono">&gt;</span>
        </div>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask Orc why this decision was taken for ${companyData.name.split(' ')[0]}, why score is ${companyData.score}, or type 'clear'...`}
          className="orc-cli-input"
          disabled={loading}
        />
        <button
          type="submit"
          className="terminal-send-btn"
          disabled={loading || !input.trim()}
          title="Send Directive"
        >
          <Send size={14} />
          <span>EXEC</span>
        </button>
        <button
          type="button"
          className="terminal-clear-btn"
          onClick={() => handleSend('clear')}
          title="Clear Terminal"
        >
          <Trash2 size={13} />
        </button>
      </form>
    </div>
  );
}
