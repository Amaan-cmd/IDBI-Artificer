import React, { useState, useEffect } from 'react';
import { CheckCircle2, Loader2, Sparkles, Cpu, ShieldCheck, Database, Layers } from 'lucide-react';
import './ProcessingSkeleton.css';

const STEPS = [
  {
    id: 1,
    title: 'Extracting Financial Tables',
    desc: 'Parsing 6-month bank statement credits/debits, closing reserves & sanctioned overdraft limits.',
    agent: 'Fetcha (Ingestion Agent)',
    timeEstimate: '0.8s'
  },
  {
    id: 2,
    title: 'Verifying Compliance Data',
    desc: 'Cross-referencing GSTR-1 outward sales against GSTR-3B tax receipts, MCA status & e-Courts.',
    agent: 'Geek (Compliance Auditor)',
    timeEstimate: '1.2s'
  },
  {
    id: 3,
    title: 'Calculating Risk Weights',
    desc: 'Computing deterministic 5-Pillars: DSCR proxy, Cash Buffer runway, credit volatility CV & bounce ratios.',
    agent: 'Jev (Deterministic Validator)',
    timeEstimate: '0.9s'
  },
  {
    id: 4,
    title: 'Generating Score & Rationale',
    desc: 'Synthesizing final credit score (300-900), SHAP factor weights & committee explainability dossier.',
    agent: 'Orc (Chief Credit Officer Agent)',
    timeEstimate: '1.1s'
  }
];

export default function ProcessingSkeleton({ activeStep = 0, businessName = 'Enterprise' }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(prev => +(prev + 0.1).toFixed(1));
    }, 100);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="processing-skeleton-container animate-fade-up">
      <div className="skeleton-card">
        {/* Header */}
        <div className="skeleton-header">
          <div className="skeleton-header-left">
            <div className="skeleton-pulse-ring">
              <Sparkles size={20} className="skeleton-pulse-icon" />
            </div>
            <div>
              <h3 className="skeleton-title">Autonomous Credit Engine Processing</h3>
              <p className="skeleton-subtitle">
                Evaluating statutory & banking evidence for <strong className="text-gold">{businessName}</strong>
              </p>
            </div>
          </div>
          <div className="skeleton-timer-chip">
            <span className="timer-label">ELAPSED:</span>
            <span className="timer-val">{elapsed}s</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="skeleton-progress-track">
          <div 
            className="skeleton-progress-fill" 
            style={{ width: `${Math.min(100, Math.max(15, ((activeStep + 1) / STEPS.length) * 100))}%` }} 
          />
        </div>

        {/* Step-by-Step Live Status Checklist */}
        <div className="skeleton-checklist">
          {STEPS.map((step, idx) => {
            const isCompleted = idx < activeStep;
            const isCurrent = idx === activeStep;
            const isPending = idx > activeStep;

            return (
              <div 
                key={step.id} 
                className={`skeleton-step-item ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''} ${isPending ? 'pending' : ''}`}
              >
                <div className="step-indicator-zone">
                  {isCompleted ? (
                    <div className="step-badge completed">
                      <CheckCircle2 size={16} />
                    </div>
                  ) : isCurrent ? (
                    <div className="step-badge current">
                      <Loader2 size={16} className="spin-anim" />
                    </div>
                  ) : (
                    <div className="step-badge pending">
                      <span>{step.id}</span>
                    </div>
                  )}
                  {idx < STEPS.length - 1 && (
                    <div className={`step-connector-line ${isCompleted ? 'active' : ''}`} />
                  )}
                </div>

                <div className="step-content-zone">
                  <div className="step-title-row">
                    <span className="step-name">{step.title}</span>
                    <span className="step-agent-tag">
                      <Cpu size={12} />
                      {step.agent}
                    </span>
                  </div>
                  <p className="step-desc">{step.desc}</p>
                </div>

                <div className="step-status-zone">
                  {isCompleted && <span className="status-pill done">VERIFIED</span>}
                  {isCurrent && <span className="status-pill running">COMPUTING</span>}
                  {isPending && <span className="status-pill waiting">QUEUED</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Guarantee */}
        <div className="skeleton-footer">
          <ShieldCheck size={14} className="footer-shield-icon" />
          <span>Zero Hallucination Guaranteed · 100% Deterministic Code Calculation Under RBI Mandate</span>
        </div>
      </div>
    </div>
  );
}
