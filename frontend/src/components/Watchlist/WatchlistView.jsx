import React, { useState } from 'react';
import { 
  Bookmark, Search, Filter, Calendar, Eye, Download, ShieldCheck, 
  Clock, TrendingUp, AlertTriangle, CheckCircle2, ChevronRight, 
  Copy, Check, Trash2, LayoutGrid, List, PlusCircle, Building2, Sparkles
} from 'lucide-react';
import './WatchlistView.css';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isScreeningRow = (row) => row?.fullPayload?.reportType === 'REGISTRY_SCREENING' || row?.status === 'Registry Screening';
// Normalises 'LOW' / 'LOW RISK' / null to a display label; null when no risk was assessed.
const riskLabel = (risk) => (risk ? String(risk).trim().toUpperCase().replace(/\s*RISK$/, '') : null);

export default function WatchlistView({
  history = [],
  currentUser,
  onSelectCompany,
  onExportPDF,
  onRemoveCompany,
  onNavigateToNewEval
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState('ALL'); // 'ALL' | 'LOW' | 'MODERATE' | 'HIGH'
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'
  const [copiedId, setCopiedId] = useState(null);

  const handleCopy = (text, id) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filter items for active user
  const filtered = history.filter(item => {
    const name = (item.name || item.businessName || '').toLowerCase();
    const gstin = (item.gstin || item.id || '').toLowerCase();
    const q = searchTerm.toLowerCase().trim();

    if (q && !name.includes(q) && !gstin.includes(q)) return false;

    if (riskFilter !== 'ALL') {
      const r = (riskLabel(item.risk) || '');
      if (riskFilter === 'LOW' && !r.includes('LOW')) return false;
      if (riskFilter === 'MODERATE' && !r.includes('MED') && !r.includes('MOD')) return false;
      if (riskFilter === 'HIGH' && !r.includes('HIGH')) return false;
    }

    return true;
  });

  const officerName = currentUser?.username || 'Institutional Officer';

  return (
    <div className="watchlist-view animate-fade-up">
      {/* Header */}
      <div className="watchlist-header">
        <div>
          <div className="eyebrow" style={{ marginBottom: '0.35rem' }}>
            PORTFOLIO INTELLIGENCE & SAVED RUNS
          </div>
          <h1 className="watchlist-title">
            Saved Businesses & Underwriting History
          </h1>
          <p className="watchlist-subtitle">
            Immutable audit record of all evaluations executed by <strong style={{ color: 'var(--text-primary)' }}>{officerName}</strong> with grounded RBI Digital Lending citations.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* View Mode Toggle */}
          <div className="view-toggle-wrap">
            <button 
              type="button"
              className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Table View"
            >
              <List size={15} />
              <span>Table</span>
            </button>
            <button 
              type="button"
              className={`view-toggle-btn ${viewMode === 'cards' ? 'active' : ''}`}
              onClick={() => setViewMode('cards')}
              title="Grid View"
            >
              <LayoutGrid size={15} />
              <span>Cards</span>
            </button>
          </div>

          <div className="watchlist-count-badge">
            <Bookmark size={14} />
            <span>{filtered.length} Saved Businesses</span>
          </div>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="watchlist-filter-bar">
        {/* Search */}
        <div className="filter-search-box">
          <Search size={15} className="filter-search-icon" />
          <input
            type="text"
            placeholder="Search saved businesses by name, GSTIN, or CIN..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Risk Filter Buttons */}
        <div className="filter-button-group">
          <span className="filter-label">Risk Tier:</span>
          {['ALL', 'LOW', 'MODERATE', 'HIGH'].map(tier => (
            <button
              key={tier}
              className={`filter-btn ${riskFilter === tier ? 'active' : ''}`}
              onClick={() => setRiskFilter(tier)}
            >
              {tier === 'ALL' ? 'ALL RISKS' : tier}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === 'table' ? (
        /* TABLE VIEW (Stripe / Bloomberg Terminal Table) */
        <div className="watchlist-table-card">
          <table className="watchlist-table">
            <thead>
              <tr>
                <th>Business Name</th>
                <th>Entity ID (CIN / GSTIN)</th>
                <th>Credit Score</th>
                <th>Risk Tier</th>
                <th>Evaluated Date</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const name = row.name || row.businessName || 'Evaluated Enterprise';
                const id = row.gstin || row.id || '—';
                const screening = isScreeningRow(row);
                const score = isNum(row.score) ? row.score : null;
                const risk = riskLabel(row.risk);
                const date = row.evaluatedDate || row.date || '—';
                const status = row.status || '—';

                const scoreColorClass = score === null ? '' :
                  score >= 800 ? 'score-emerald' : 
                  score >= 700 ? 'score-blue' : 
                  score >= 600 ? 'score-amber' : 'score-red';

                return (
                  <tr key={row.id || id} className="table-row-hover">
                    {/* Business Name */}
                    <td>
                      <div className="table-entity-cell">
                        <span className="entity-cell-name">{name}</span>
                        <span className="entity-cell-sector">
                          {screening ? 'Registry Screening' : (row.compliance || '—')}
                        </span>
                      </div>
                    </td>

                    {/* Entity ID */}
                    <td>
                      <div className="table-id-cell">
                        <span className="id-code">{id}</span>
                        <button 
                          type="button"
                          className="id-copy-btn" 
                          onClick={() => handleCopy(id, row.id || id)}
                          title="Copy ID"
                        >
                          {copiedId === (row.id || id) ? <Check size={12} className="text-emerald" /> : <Copy size={12} />}
                        </button>
                      </div>
                    </td>

                    {/* Credit Score Pill */}
                    <td>
                      {score === null ? (
                        <span className="score-pill"><span className="score-val" style={{ color: 'var(--text-subtle)' }}>{screening ? 'Screening' : '—'}</span></span>
                      ) : (
                        <div className={`score-pill ${scoreColorClass}`}>
                          <span className="score-val">{score}</span>
                          <span className="score-max">/ 900</span>
                        </div>
                      )}
                    </td>

                    {/* Risk Tier */}
                    <td>
                      <span className={`risk-tier-tag ${risk ? risk.toLowerCase() : 'neutral'}`}>
                        {risk ? `${risk} RISK` : 'NOT SCORED'}
                      </span>
                    </td>

                    {/* Evaluated Date */}
                    <td>
                      <div className="date-cell">
                        <Clock size={12} className="date-icon" />
                        <span>{date}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td>
                      <div className="status-cell">
                        <span className="status-dot completed" />
                        <span>{status}</span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="text-right">
                      <div className="table-actions-cell">
                        <button 
                          type="button"
                          className="table-action-btn view-btn"
                          onClick={() => onSelectCompany(row)}
                          title="Open Two-Column Split Workspace"
                        >
                          <Eye size={13} />
                          <span>View</span>
                        </button>
                        <button 
                          type="button"
                          className="table-action-btn export-btn"
                          onClick={() => onExportPDF(row)}
                          title="Export Printable PDF Dossier"
                        >
                          <Download size={13} />
                          <span>PDF</span>
                        </button>
                        {onRemoveCompany && (
                          <button 
                            type="button"
                            className="table-action-btn delete-btn"
                            onClick={() => onRemoveCompany(row.id || id)}
                            title="Remove from Saved Businesses"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="table-empty-cell">
                    <div className="watchlist-empty-state">
                      <Bookmark size={36} className="empty-icon" />
                      <h3>No Saved Businesses Found</h3>
                      <p>No evaluations match your search or selected risk filter.</p>
                      {onNavigateToNewEval && (
                        <button 
                          type="button" 
                          className="start-eval-btn"
                          onClick={onNavigateToNewEval}
                        >
                          <PlusCircle size={15} />
                          <span>Launch New Evaluation</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* CARD GRID VIEW */
        <div className="watchlist-grid">
          {filtered.map(row => {
            const name = row.name || row.businessName || 'Evaluated Enterprise';
            const gstin = row.gstin || row.id || '—';
            const screening = isScreeningRow(row);
            const score = isNum(row.score) ? row.score : null;
            const risk = riskLabel(row.risk);
            const date = row.evaluatedDate || row.date || '—';

            const scoreColor = score === null ? 'var(--border)' : score >= 800 ? 'var(--status-green-text)' : score >= 700 ? 'var(--status-blue-text)' : score >= 600 ? 'var(--status-amber-text)' : 'var(--status-red-text)';

            return (
              <div key={row.id || gstin} className="watchlist-card">
                <div className="watchlist-card-top">
                  <div>
                    <h3 className="card-company-name">{name}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                      <span className="card-gstin-code">{gstin}</span>
                      <button 
                        type="button"
                        onClick={() => handleCopy(gstin, row.id || gstin)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer', padding: 0 }}
                      >
                        {copiedId === (row.id || gstin) ? <Check size={11} className="text-emerald" /> : <Copy size={11} />}
                      </button>
                    </div>
                  </div>
                  <div className="card-score-badge" style={{ borderColor: scoreColor }}>
                    {score === null ? (
                      <span className="card-score-num" style={{ color: 'var(--text-subtle)', fontSize: '0.8rem' }}>{screening ? 'Screening' : '—'}</span>
                    ) : (
                      <>
                        <span className="card-score-num" style={{ color: scoreColor }}>{score}</span>
                        <span className="card-score-denom">/ 900</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="card-reason-snippet">
                  {row.reason || row.decision?.narrative || row.fullPayload?.decision?.narrative || (screening ? 'Registry Screening' : '—')}
                </div>

                <div className="card-meta-line">
                  <span className={`card-risk-pill ${risk ? risk.toLowerCase() : 'neutral'}`}>
                    {risk ? `${risk} RISK` : (screening ? 'REGISTRY SCREENING' : 'NOT SCORED')}
                  </span>
                  <span className="card-date">
                    <Clock size={12} />
                    {date}
                  </span>
                </div>

                <div className="card-actions-row">
                  <button 
                    type="button"
                    className="card-view-btn"
                    onClick={() => onSelectCompany(row)}
                  >
                    <Eye size={14} />
                    <span>Open Split View</span>
                    <ChevronRight size={14} />
                  </button>
                  <button 
                    type="button"
                    className="card-pdf-btn"
                    onClick={() => onExportPDF(row)}
                    title="Download Audit Report PDF"
                  >
                    <Download size={14} />
                  </button>
                  {onRemoveCompany && (
                    <button 
                      type="button"
                      className="card-delete-btn"
                      onClick={() => onRemoveCompany(row.id || gstin)}
                      title="Remove from Saved Businesses"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="watchlist-empty-state" style={{ gridColumn: '1 / -1' }}>
              <Bookmark size={36} className="empty-icon" />
              <h3>No Saved Businesses Found</h3>
              <p>No evaluations match your search or selected risk filter.</p>
              {onNavigateToNewEval && (
                <button 
                  type="button" 
                  className="start-eval-btn"
                  onClick={onNavigateToNewEval}
                >
                  <PlusCircle size={15} />
                  <span>Launch New Evaluation</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
