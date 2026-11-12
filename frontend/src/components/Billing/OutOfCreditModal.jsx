import React from 'react';
import { X, Wallet } from 'lucide-react';
import { formatCents } from '../../utils/money';
import './OutOfCreditModal.css';

const ACTION_LABELS = { evaluate: 'An evaluation', chat: 'An Orc message', registryLookup: 'A registry lookup' };

export default function OutOfCreditModal({ info, account, onClose, onOpenBilling }) {
  if (!info) return null;
  const packs = account?.packs || [];
  return (
    <div className="ooc-backdrop" role="dialog" aria-modal="true" aria-labelledby="ooc-title" onClick={onClose}>
      <div className="ooc-card" onClick={(e) => e.stopPropagation()}>
        <button className="ooc-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
        <div className="ooc-icon"><Wallet size={22} /></div>
        <h3 id="ooc-title">Not enough credit</h3>
        <p>
          {ACTION_LABELS[info.action] || 'This action'} costs {formatCents(info.priceCents)}. Your balance is {formatCents(info.balanceCents)}.
        </p>
        <div className="ooc-packs">
          {packs.map((p) => (
            <button
              key={p.id}
              className="ooc-pack"
              disabled={!p.url}
              title={p.url ? undefined : 'Coming soon'}
              onClick={() => p.url && window.open(p.url, '_blank', 'noopener,noreferrer')}
            >
              {p.url ? `Add ${formatCents(p.cents)}` : `${formatCents(p.cents)} · Coming soon`}
            </button>
          ))}
        </div>
        <button className="ooc-link" onClick={() => { onClose(); onOpenBilling(); }}>Open Account &amp; Billing</button>
      </div>
    </div>
  );
}
