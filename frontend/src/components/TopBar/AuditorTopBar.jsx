import React from 'react';
import { Search, ShieldCheck, Clock, Terminal, MessageSquare, ExternalLink } from 'lucide-react';
import './AuditorTopBar.css';

export const formatSeconds = (sec) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

export default function AuditorTopBar({ 
  currentBreadcrumb = 'New Evaluation',
  onOpenCmdPalette,
  inactivitySeconds = 300,
  onOpenChat,
  isChatOpen
}) {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

  return (
    <header className="auditor-top-bar">
      {/* Breadcrumb Area */}
      <div className="top-bar-breadcrumb-area">
        <span className="crumb-root">Citadel Citadel</span>
        <span className="crumb-sep">/</span>
        <span className="crumb-current">{currentBreadcrumb}</span>
      </div>

      {/* Universal Cmd/Ctrl + K Trigger Bar */}
      <div className="top-bar-center-search" onClick={onOpenCmdPalette}>
        <Search size={14} className="search-bar-icon" />
        <span className="search-bar-placeholder">
          Instant Lookup by GSTIN, PAN, CIN, or Name...
        </span>
        <div className="search-shortcut-badge">
          <kbd>{isMac ? '⌘' : 'Ctrl'}</kbd>
          <kbd>K</kbd>
        </div>
      </div>

      {/* Right Utility Badges */}
      <div className="top-bar-right-controls">
        {/* Ledger Badge */}
        <div className="top-bar-ledger-badge">
          <ShieldCheck size={13} className="ledger-icon" />
          <span className="ledger-text">AZURE CITADEL LEDGER</span>
          <span className="ledger-dot" />
        </div>

        {/* Sentinel Timer */}
        <div className="top-bar-sentinel-chip" title="Inactivity auto-lock sentinel">
          <Clock size={13} />
          <span className="sentinel-time">{formatSeconds(inactivitySeconds)}</span>
        </div>

        {/* Chat / Assistant Trigger */}
        {onOpenChat && (
          <button 
            className={`top-bar-chat-btn ${isChatOpen ? 'active' : ''}`}
            onClick={onOpenChat}
            title="Toggle Orc CCO Underwriter Interrogation"
          >
            <MessageSquare size={14} />
            <span>Orc CCO</span>
          </button>
        )}
      </div>
    </header>
  );
}
