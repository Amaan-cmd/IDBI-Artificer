import React from 'react';
import { 
  PlusCircle, Bookmark, Layers, CreditCard, ChevronLeft, ChevronRight, 
  LogOut, Shield, ShieldCheck, Activity, Terminal
} from 'lucide-react';
import { formatCents } from '../../utils/money';
import './AuditorSidebar.css';

export const NAV_ITEMS = [
  { id: 'new-eval', label: 'New Evaluation', icon: PlusCircle, hint: 'Search, Upload & History' },
  { id: 'watchlist', label: 'Saved Businesses', icon: Bookmark, hint: 'Watchlist & Risk Archive' },
  { id: 'batch', label: 'Batch Upload', icon: Layers, hint: 'Score 10–50 Overnight' },
  { id: 'billing', label: 'Account & API / Billing', icon: CreditCard, hint: 'Quotas, Seats & Audit Log' }
];

export default function AuditorSidebar({ 
  activeNav, 
  onNavChange, 
  isCollapsed, 
  onToggleCollapse, 
  currentUser, 
  onLogout,
  onOpenMasterDashboard,
  balanceCents,
  creditPercent = 0
}) {
  return (
    <aside className={`auditor-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Brand Header */}
      <div className="sidebar-brand-zone">
        <div className="brand-logo-wrap">
          {isCollapsed ? (
            <div className="brand-gold-crest" title="Enver AI Tech · Artificer Citadel">
              <img src="/enver_logo.png" alt="Enver AI" className="sidebar-brand-crest-img" />
            </div>
          ) : (
            <div className="brand-titles">
              <img src="/enver_logo.png" alt="Enver AI" className="sidebar-brand-full-logo" />
              <span className="brand-product">Artificer Citadel</span>
            </div>
          )}
        </div>
        <button 
          className="sidebar-collapse-btn" 
          onClick={onToggleCollapse}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* 4 Ultra-Minimal Nav Items */}
      <div className="sidebar-nav-section">
        <div className="nav-group-title">{!isCollapsed && 'WORKSPACE'}</div>
        <nav className="sidebar-nav-menu">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => onNavChange(item.id)}
                title={isCollapsed ? `${item.label} (${item.hint})` : undefined}
              >
                <div className="nav-item-icon">
                  <Icon size={18} />
                </div>
                {!isCollapsed && (
                  <div className="nav-item-text">
                    <span className="nav-item-label">{item.label}</span>
                    <span className="nav-item-sub">{item.hint}</span>
                  </div>
                )}
                {isActive && <div className="nav-active-pip" />}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Auxiliary Link for Master Telemetry */}
      {onOpenMasterDashboard && (
        <div className="sidebar-telemetry-zone">
          <button 
            className="sidebar-telemetry-btn"
            onClick={onOpenMasterDashboard}
            title={isCollapsed ? "Citadel Master Telemetry" : undefined}
          >
            <Activity size={16} />
            {!isCollapsed && <span>Master Telemetry</span>}
          </button>
        </div>
      )}

      {/* Quota & User Profile Footer */}
      <div className="sidebar-footer">
        {!isCollapsed && (
          <div className="sidebar-quota-card">
            <div className="quota-header">
              <span className="quota-label">CREDIT BALANCE</span>
              <span className="quota-val">{formatCents(balanceCents)}</span>
            </div>
            <div className="quota-bar-track">
              <div className="quota-bar-fill" style={{ width: `${creditPercent}%` }} />
            </div>
            <span className="quota-meta">Prepaid usage credit</span>
          </div>
        )}

        <div className="sidebar-user-pill">
          <div className="user-avatar-crest">
            {(currentUser?.username || currentUser?.email || 'A')[0].toUpperCase()}
          </div>
          {!isCollapsed && (
            <div className="user-details">
              <span className="user-name">
                {currentUser?.username || (currentUser?.email ? currentUser.email.split('@')[0] : 'Auditor')}
              </span>
              <span className="user-domain">
                {currentUser?.email ? currentUser.email : 'enveraitech.in'}
              </span>
            </div>
          )}
          <button 
            className="user-logout-btn" 
            onClick={onLogout}
            title="Log Out of Citadel"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
