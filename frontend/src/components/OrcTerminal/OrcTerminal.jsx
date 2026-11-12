import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Terminal, Send, Trash2, Sparkles, ChevronRight, Cpu, Building2, HelpCircle } from 'lucide-react';
import './OrcTerminal.css';
import { getCompanyDecisionData, generateOrcResponse } from '../../utils/orcIntelligence';

import { apiFetch } from '../../utils/apiClient';
import { formatCents } from '../../utils/money';

const NO_EVALUATION = 'No evaluation yet. Run an evaluation, then interrogate Orc about the decision.';

const describeTarget = (c) => `${c.name} (GSTIN: ${c.gstin || 'Not available'} · Score: ${c.score}/900 · ${c.riskTier}${c.sampleData ? ' · SAMPLE DATA' : ''})`;

export default function OrcTerminal({ currentBusiness, evaluationPayload = null, onQuickInspect, prices }) {
  const chatPrice = prices?.chat != null ? formatCents(prices.chat) : null;
  // Decision data derived from the real evaluation payload (or demo presets in demo mode); null otherwise.
  const companyData = useMemo(() => getCompanyDecisionData(
    currentBusiness?.name, currentBusiness?.gstin, currentBusiness?.probeData, evaluationPayload
  ), [currentBusiness?.name, currentBusiness?.gstin, currentBusiness?.probeData, evaluationPayload]);

  const targetName = companyData?.name || currentBusiness?.name || 'No target';
  const targetGstin = companyData?.gstin || (currentBusiness?.gstin || '').trim().toUpperCase();
  const scoreLabel = companyData ? String(companyData.score) : '—';

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
      text: companyData
        ? `Greetings Officer. I am Orc, Chief Credit Officer agent. Loaded the evaluation for ${describeTarget(companyData)}.

You may interrogate why this specific decision was taken, the 300–900 points breakdown, downside friction factors, or any credit ratio.`
        : NO_EVALUATION
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const contextKey = companyData ? `${companyData.gstin}|${companyData.score}` : null;
  const prevContextRef = useRef(contextKey);

  // Announce context switch when user picks a different enterprise
  // Announce context switch when the evaluated target (or its decision) changes
  useEffect(() => {
    if (prevContextRef.current === contextKey) return;
    prevContextRef.current = contextKey;
    if (!companyData) {
      setMessages(prev => [...prev, { id: `ctx_${Date.now()}`, sender: 'orc', text: NO_EVALUATION }]);
      return;
    }
    setMessages(prev => [
      ...prev,
      {
        id: `ctx_${Date.now()}`,
        sender: 'system',
        text: `[CONTEXT SWITCHED]: Target Entity recalibrated to: ${describeTarget(companyData)} · Verdict: ${companyData.sanctionVerdict}`
      },
      {
        id: `orc_ctx_${Date.now()}`,
        sender: 'orc',
        text: `Ready to audit ${companyData.name}. Ask me: "Why was this decision taken?", "Why is the score ${companyData.score}?", or select a quick directive below.`
      }
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextKey]);

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
          text: companyData
            ? `Terminal cleared. Orc CCO daemon active for ${companyData.name} (${companyData.gstin || 'GSTIN not available'}).`
            : `Terminal cleared. ${NO_EVALUATION}`
        }
      ]);
      setLoading(false);
      return;
    }

    const appendOrc = (text) => setMessages(prev => [
      ...prev,
      { id: `orc_${Date.now()}`, sender: 'orc', text }
    ]);

    let res;
    try {
      res = await apiFetch('/api/v1/chat/xai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: textToSend,
          // Real evaluation payload when present; demo presets send the flattened sample;
          // otherwise null so the backend reports that there is nothing to explain yet.
          evaluationPayload: evaluationPayload?.decision
            ? evaluationPayload
            : companyData
              ? {
                  businessName: companyData.name,
                  gstin: companyData.gstin,
                  score: companyData.score,
                  riskTier: companyData.riskTier,
                  sanctionVerdict: companyData.sanctionVerdict,
                  recommendedLimit: companyData.recommendedLimit,
                  metrics: companyData.metrics,
                  mathDrivers: companyData.mathDrivers,
                  sampleData: companyData.sampleData
                }
              : null
        })
      });
    } catch {
      // Network failure only: answer from the grounded local engine.
      const response = companyData ? generateOrcResponse(textToSend, companyData) : NO_EVALUATION;
      setTimeout(() => {
        appendOrc(response);
        setLoading(false);
      }, 350);
      return;
    }

    try {
      if (res.status === 402) {
        appendOrc('Out of credit. Top up on the Account & Billing page to keep asking Orc.');
        return;
      }
      // Session expired: onUnauthorized is logging the user out.
      if (res.status === 401) return;
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.response) {
        appendOrc(data.response);
        return;
      }
      appendOrc(data.error || `Orc is unavailable (HTTP ${res.status}).`);
    } finally {
      setLoading(false);
    }
  };

  // Quick Directive chips tailored specifically for decision interrogation
  const QUICK_PROMPTS = [
    { label: "🎯 Why was this decision taken?", query: `Why was this decision taken for ${targetName}? Explain the complete credit verdict and rationale.` },
    { label: `📊 Score Drivers (${scoreLabel} pts)`, query: `Why is the score ${scoreLabel} for ${targetName}? Show the step-by-step mathematical points calculation.` },
    { label: "🔍 Pillar 1–5 Decision Rationale", query: "Provide a detailed Pillar 1 to Pillar 5 audit breakdown of this underwriting decision." },
    { label: "⚠️ Downside Risks & Friction", query: `What risk friction or negative factors prevented a higher score for ${targetName}?` },
    { label: "📈 Sensitivity: What raises the score?", query: `What counterfactual changes would upgrade ${targetName} to Prime (850+)?` },
    { label: `💰 Sanction Limit Rationale${companyData ? ` (${companyData.referredForRedFlags ? 'Referred: red flags' : companyData.limitLabel})` : ''}`, query: `Why was the sanction limit recommended for ${targetName}?` },
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

        <div className="terminal-target-badge" title={`Active Target: ${targetName}${targetGstin ? ` (${targetGstin})` : ''}${companyData?.sampleData ? ' · SAMPLE DATA' : ''}`}>
          <Building2 size={12} className="text-celadon" />
          <span className="target-name-truncated">{targetName.split(' ')[0]}</span>
          <span className="target-score-pill">{scoreLabel}</span>
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
            title={chatPrice ? `Costs ${chatPrice}` : undefined}
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
          placeholder={companyData
            ? `Ask Orc why this decision was taken for ${targetName.split(' ')[0]}, why score is ${companyData.score}, or type 'clear'...`
            : 'No evaluation yet. Run an evaluation, then ask Orc about the decision...'}
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
          <span>EXEC{chatPrice ? ` · ${chatPrice}` : ''}</span>
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
