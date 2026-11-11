import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Building2, ShieldCheck, ArrowRight, CornerDownLeft, Sparkles } from 'lucide-react';
import './CommandPalette.css';
import { KNOWN_GSTINS } from '../../utils/gstinRegistry';
import { isDemoMode } from '../../utils/demoMode';
import { sanitizeText } from '../../utils/sanitize';
import SampleDataBadge from '../SampleDataBadge/SampleDataBadge';

// Demo-mode presets only (labelled SAMPLE DATA); empty outside demo mode.
const QUICK_ENTITIES = isDemoMode
  ? Object.entries(KNOWN_GSTINS).map(([gstin, e]) => ({ name: e.legalEntityName, id: gstin, cin: e.cin || '' }))
  : [];

export default function CommandPalette({ isOpen, onClose, onSelectCompany }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Filter entities based on query
  const filtered = QUICK_ENTITIES.filter(item => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return item.name.toLowerCase().includes(q) ||
           item.id.toLowerCase().includes(q) ||
           item.cin.toLowerCase().includes(q);
  });

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % (filtered.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + (filtered.length || 1)) % (filtered.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered.length > 0 && filtered[selectedIndex]) {
        handlePick(filtered[selectedIndex]);
      } else if (query.trim().length >= 10) {
        // Dynamic search for arbitrary GSTIN / PAN
        handleCustomProbe(query.trim());
      }
    }
  };

  const handlePick = (entity) => {
    onSelectCompany(entity.id);
    onClose();
  };

  const handleCustomProbe = (customId) => {
    onSelectCompany(customId);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="cmd-palette-backdrop" onClick={onClose}>
      <div className="cmd-palette-modal" onClick={e => e.stopPropagation()}>
        <div className="cmd-palette-input-wrap">
          <Search className="cmd-palette-search-icon" size={18} />
          <input
            ref={inputRef}
            type="text"
            className="cmd-palette-input"
            placeholder={isDemoMode ? 'Type a sample company name or a 15-character GSTIN...' : 'Enter a 15-character GSTIN...'}
            value={query}
            onChange={e => {
              setQuery(sanitizeText(e.target.value, 60));
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
          <span className="cmd-palette-kbd">ESC</span>
          <button className="cmd-palette-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="cmd-palette-results">
          <div className="cmd-palette-group-label">
            {isDemoMode ? (query.trim() ? `Matching Sample Enterprises (${filtered.length})` : 'Sample Enterprises') : 'Registry Lookup'}
          </div>

          {filtered.map((item, idx) => (
            <div
              key={item.id}
              className={`cmd-palette-item ${idx === selectedIndex ? 'active' : ''}`}
              onClick={() => handlePick(item)}
              onMouseEnter={() => setSelectedIndex(idx)}
            >
              <div className="cmd-item-icon">
                <Building2 size={16} />
              </div>
              <div className="cmd-item-info">
                <div className="cmd-item-name">{item.name}</div>
                <div className="cmd-item-meta">
                  <span className="cmd-meta-gstin">{item.id}</span>
                  <span className="cmd-meta-sep">·</span>
                  <span className="cmd-meta-cin">{item.cin}</span>
                </div>
              </div>
              <SampleDataBadge />
              <CornerDownLeft size={14} className="cmd-enter-hint" />
            </div>
          ))}

          {filtered.length === 0 && query.trim().length >= 10 && (
            <div 
              className="cmd-palette-item active dynamic-probe"
              onClick={() => handleCustomProbe(query.trim())}
            >
              <div className="cmd-item-icon">
                <Sparkles size={16} />
              </div>
              <div className="cmd-item-info">
                <div className="cmd-item-name">Look up "{query.trim().toUpperCase()}"</div>
                <div className="cmd-item-meta">GSTN & MCA21 registry lookup</div>
              </div>
              <div className="cmd-item-action-tag">
                <span>PRESS ENTER ↵</span>
              </div>
            </div>
          )}

          {filtered.length === 0 && query.trim().length < 10 && (
            <div className="cmd-palette-empty">
              Enter a 15-character GSTIN to look it up in GSTN and MCA21.
            </div>
          )}
        </div>

        <div className="cmd-palette-footer">
          <div className="cmd-footer-shortcuts">
            <span><kbd>↑</kbd><kbd>↓</kbd> to navigate</span>
            <span><kbd>↵</kbd> to look up</span>
            <span><kbd>esc</kbd> to close</span>
          </div>
          <div className="cmd-footer-brand">
            <ShieldCheck size={12} />
            <span>Enver Autonomous Citadel</span>
          </div>
        </div>
      </div>
    </div>
  );
}
