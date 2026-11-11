import React, { useState, useEffect } from 'react';
import { Sparkles, Brain, ShieldCheck, Activity, Terminal, ArrowRight, CheckCircle2 } from 'lucide-react';
import './ThinkingOrb.css';

const AGENT_STAGES = [
  {
    agent: 'AGENT 01 · FETCHA',
    role: 'Multi-Modal Ingestion & Verification',
    thought: 'Extracting bank ledger statements, GSTR-1 outward supplies & MCA21 records...',
    color: 'var(--accent-strong)'
  },
  {
    agent: 'AGENT 02 · JEV GATEKEEPER',
    role: 'Solvency & Integrity Audit',
    thought: 'Cross-verifying balance continuity, NACH dishonours & excluding technical bounces...',
    color: 'var(--status-amber-text)'
  },
  {
    agent: 'AGENT 03 · GEEK SYSTEM 2',
    role: 'Quantitative 5-Pillar Telemetry',
    thought: 'Computing Cash Buffer Ratio, DSCP proxy, Debt Burden & Revenue Volatility CV...',
    color: 'var(--status-blue-text)'
  },
  {
    agent: 'AGENT 04 · ORC CHIEF CREDIT OFFICER',
    role: 'Calibrated Underwriting Synthesis',
    thought: 'Synthesizing institutional 300–885 score with forensic line-item citations...',
    color: 'var(--status-green-text)'
  }
];

export default function ThinkingOrb({ 
  isEvaluating = true, 
  activeStep = 0, 
  businessName = 'Enterprise', 
  onComplete,
  onSwitchToFindings
}) {
  const [internalStep, setInternalStep] = useState(activeStep || 0);
  const [thoughtTicker, setThoughtTicker] = useState(0);

  useEffect(() => {
    if (!isEvaluating) return;
    const interval = setInterval(() => {
      setInternalStep(prev => (prev < 3 ? prev + 1 : prev));
    }, 1800);
    return () => clearInterval(interval);
  }, [isEvaluating]);

  useEffect(() => {
    if (!isEvaluating) return;
    const thoughtInterval = setInterval(() => {
      setThoughtTicker(prev => (prev + 1) % 4);
    }, 900);
    return () => clearInterval(thoughtInterval);
  }, [isEvaluating]);

  const currentStage = AGENT_STAGES[internalStep] || AGENT_STAGES[0];

  return (
    <div className={`thinking-orb-container animate-fade-in ${isEvaluating ? 'evaluating' : 'complete'}`}>
      {/* Orb Visual Center */}
      <div className="orb-visual-stage">
        <div className="orb-outer-glow" />
        <div className="orb-ring orb-ring-1" />
        <div className="orb-ring orb-ring-2" />
        <div className="orb-ring orb-ring-3" />
        
        {/* Core Sphere */}
        <div className="orb-sphere">
          <div className="orb-inner-plasma" />
          <div className="orb-highlight" />
          <div className="orb-icon-wrap">
            {isEvaluating ? (
              <Brain size={32} className="orb-center-icon pulsing" />
            ) : (
              <CheckCircle2 size={36} className="orb-center-icon complete" />
            )}
          </div>
        </div>

        {/* Ambient Particle Waves */}
        <div className="orb-pulse-wave wave-1" />
        <div className="orb-pulse-wave wave-2" />
      </div>

      {/* Narrative & Agent Stage Card */}
      <div className="orb-details-stage">
        <div className="orb-header-row">
          <div className="orb-status-pill">
            <span className="orb-dot-live" />
            <span className="orb-status-text">
              {isEvaluating ? 'AUTONOMOUS REASONING ACTIVE' : 'SYNTHESIS COMPLETE'}
            </span>
          </div>
          <span className="orb-enterprise-tag font-mono">{businessName}</span>
        </div>

        {/* Agent Stage Indicator */}
        <div className="orb-agent-identity">
          <span className="agent-badge" style={{ borderColor: currentStage.color, color: currentStage.color }}>
            {currentStage.agent}
          </span>
          <h3 className="agent-role-title">{currentStage.role}</h3>
          <p className="agent-thought-stream">
            "{currentStage.thought}"
          </p>
        </div>

        {/* Progress Timeline Tracker */}
        <div className="orb-timeline-bar">
          {AGENT_STAGES.map((s, idx) => (
            <div 
              key={s.agent} 
              className={`timeline-segment ${idx <= internalStep ? 'active' : ''} ${idx === internalStep && isEvaluating ? 'current' : ''}`}
            >
              <div className="timeline-segment-fill" />
            </div>
          ))}
        </div>

        {/* Action bar when complete */}
        {!isEvaluating && onSwitchToFindings && (
          <div className="orb-actions-row animate-fade-up">
            <button 
              type="button" 
              className="orb-findings-btn"
              onClick={onSwitchToFindings}
            >
              <span>INSPECT AUDIT FINDINGS DECK</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
