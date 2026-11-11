/**
 * Institutional Audit Report Exporter (Client-Side & Print/PDF Ready)
 * Generates an institutional-grade PDF/print audit dossier matching RBI Digital Lending standards.
 */

const NA = 'Not available';
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
// Metric display: unavailable values print "Not available" instead of a default.
const fx = (v, suffix = '') => (isNum(v) ? `${v}${suffix}` : NA);

export function exportAuditReport({ data, auditorNotes = '', officer = null }) {
  if (!data) return;

  const businessName = esc(data.businessName || "Unknown Enterprise");
  const gstin = esc(data.gstin || "N/A");
  const isScreening = data.reportType === 'REGISTRY_SCREENING';
  const score = isNum(data.decision?.score) ? data.decision.score : null;
  const riskLevel = data.decision?.riskLevel ? esc(data.decision.riskLevel) : null;
  const gstSection = data.registryReport?.gst;
  const registration = gstSection?.status === 'ok' ? esc(gstSection.data?.status || NA) : 'Not verified';
  const evalDate = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const redFlags = Array.isArray(data.decision?.redFlags) ? data.decision.redFlags : [];
  const p1 = data.metrics?.pillar1_liquidity || {};
  const p2 = data.metrics?.pillar2_revenue || {};
  const p3 = data.metrics?.pillar3_stability || {};
  const p4 = data.metrics?.pillar4_leverage || {};
  const p5 = data.metrics?.pillar5_operational || {};

  const scoreColor = score === null ? '#64748b' : score >= 800 ? '#10b981' : score >= 700 ? '#3b82f6' : score >= 600 ? '#f59e0b' : '#ef4444';

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert("Please allow popups to export the audit report.");
    return;
  }

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Underwriting Audit Dossier - ${businessName}</title>
  <style>
    @page { size: A4; margin: 16mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #111827;
      background: #ffffff;
      line-height: 1.5;
      padding: 0;
      margin: 0;
      font-size: 13px;
    }
    .header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 14px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #0f172a;
      margin: 0;
    }
    .brand-sub {
      font-size: 11px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 2px;
    }
    .meta-box {
      text-align: right;
      font-size: 11px;
      color: #475569;
    }
    .dossier-tag {
      display: inline-block;
      background: #0f172a;
      color: #ffffff;
      padding: 3px 8px;
      font-size: 10px;
      font-weight: 700;
      border-radius: 4px;
      margin-bottom: 4px;
    }
    .hero-grid {
      display: grid;
      grid-template-columns: 200px 1fr;
      gap: 20px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
    }
    .score-card {
      text-align: center;
      border-right: 1px solid #e2e8f0;
      padding-right: 16px;
    }
    .score-num {
      font-size: 48px;
      font-weight: 900;
      line-height: 1;
      color: ${scoreColor};
      margin: 8px 0;
    }
    .score-badge {
      display: inline-block;
      background: #0f172a;
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 9999px;
    }
    .entity-details {
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .entity-name {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 4px 0;
    }
    .entity-meta {
      font-size: 12px;
      color: #64748b;
      margin-bottom: 8px;
    }
    .section-title {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #0f172a;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 4px;
      margin: 20px 0 10px 0;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .card {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px;
      background: #ffffff;
    }
    .card-title {
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .metric-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      border-bottom: 1px dashed #f1f5f9;
      font-size: 12px;
    }
    .metric-row:last-child { border-bottom: none; }
    .metric-val { font-weight: 600; color: #0f172a; }
    .notes-box {
      background: #fffbeb;
      border: 1px solid #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 12px;
      border-radius: 4px;
      margin-top: 16px;
    }
    .notes-title {
      font-weight: 700;
      color: #92400e;
      font-size: 11px;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .notes-content {
      font-size: 12px;
      color: #78350f;
      font-style: italic;
    }
    .citations-list {
      margin: 8px 0;
      padding-left: 18px;
      font-size: 11px;
      color: #334155;
    }
    .citations-list li { margin-bottom: 4px; }
    .footer {
      margin-top: 30px;
      border-top: 1px solid #e2e8f0;
      padding-top: 10px;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #94a3b8;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="dossier-tag">RESTRICTED AUDIT DOSSIER · CONFIDENTIAL</div>
      <h1 class="brand-title">ENVER AI ARTIFICER</h1>
      <div class="brand-sub">Autonomous MSME Underwriting Citadel · RBI Master Direction Compliant</div>
    </div>
    <div class="meta-box">
      <div><strong>Audit Ref:</strong> AUD-${Date.now().toString(36).toUpperCase()}</div>
      <div><strong>Date:</strong> ${evalDate}</div>
      <div><strong>Officer:</strong> ${esc(officer?.username || officer?.email || '—')}</div>
    </div>
  </div>

  <div class="hero-grid">
    <div class="score-card">
      <div class="score-badge">${riskLevel ? `${riskLevel} RISK TIER` : (isScreening ? 'REGISTRY SCREENING' : 'RISK TIER NOT AVAILABLE')}</div>
      <div class="score-num">${score ?? '—'}</div>
      <div style="font-size: 11px; color: #64748b;">Autonomous Score / 900</div>
    </div>
    <div class="entity-details">
      <h2 class="entity-name">${businessName}</h2>
      <div class="entity-meta">
        <strong>GSTIN:</strong> ${gstin} &nbsp;|&nbsp; 
        <strong>GST Registration:</strong> ${registration} &nbsp;|&nbsp; 
        <strong>Model:</strong> Enver Deterministic 5-Pillar Core
      </div>
      <div style="font-size: 12px; color: #334155; line-height: 1.4;">
        ${esc(data.decision?.narrative || (isScreening ? 'Registry screening only: no bank statement was analysed, so no credit score was produced.' : NA))}
      </div>
    </div>
  </div>

  ${redFlags.length ? `<div style="border: 1px solid #b91c1c; border-left-width: 4px; background: #fef2f2; color: #991b1b; padding: 10px 12px; margin: 0 0 16px; border-radius: 6px;"><strong>${redFlags.length > 1 ? `RED FLAGS (${redFlags.length})` : 'RED FLAG'}</strong><ul style="margin: 6px 0 0; padding-left: 18px;">${redFlags.map(f => `<li>${esc(typeof f === 'string' ? f : (f?.message || f?.label || JSON.stringify(f)))}</li>`).join('')}</ul></div>` : ''}
  <div class="section-title">Underwriting Evidence & 5-Pillar Ratios</div>
  <div class="grid-2">
    <div class="card">
      <div class="card-title">Pillar 1: Liquidity & Runway</div>
      <div class="metric-row"><span>Cash Buffer Ratio:</span><span class="metric-val">${fx(p1.cashBufferRatio, 'x')}</span></div>
      <div class="metric-row"><span>Minimum Buffer Days:</span><span class="metric-val">${fx(p1.minimumCashBufferDays, ' Days')}</span></div>
      <div class="metric-row"><span>OD Utilization:</span><span class="metric-val">${fx(p1.overdraftLimitUtilization, '%')}</span></div>
      <div class="metric-row"><span>Liquidity Posture:</span><span class="metric-val">${esc(p1.status || NA)}</span></div>
    </div>

    <div class="card">
      <div class="card-title">Pillar 2: Revenue & GST Match</div>
      <div class="metric-row"><span>Annualized Run Rate:</span><span class="metric-val">${isNum(p2.annualizedRevenueRunRate) ? `₹${p2.annualizedRevenueRunRate.toLocaleString('en-IN')}` : NA}</span></div>
      <div class="metric-row"><span>Revenue Momentum (half-on-half):</span><span class="metric-val">${isNum(p2.revenueGrowthRate) ? `${p2.revenueGrowthRate >= 0 ? '+' : ''}${p2.revenueGrowthRate}%` : esc(p2.revenueGrowthUnavailableReason || NA)}</span></div>
      <div class="metric-row"><span>GSTR-1 to Bank Ratio:</span><span class="metric-val">${fx(p2.gstVsBankReconciliation, 'x')}</span></div>
      <div class="metric-row"><span>Tax Gap (GSTR-1 vs 3B):</span><span class="metric-val">${fx(p2.gstr1VsGstr3bGap, '%')}</span></div>
    </div>

    <div class="card">
      <div class="card-title">Pillar 3: Cash Flow Volatility</div>
      <div class="metric-row"><span>Credit Volatility (CV):</span><span class="metric-val">${fx(p3.creditCoefficientOfVariation)}</span></div>
      <div class="metric-row"><span>Inward Bounce Rate:</span><span class="metric-val">${fx(p3.inwardBounceRate, '%')}</span></div>
      <div class="metric-row"><span>Consecutive Low Months:</span><span class="metric-val">${fx(p3.consecutiveLowCreditMonths)}</span></div>
      <div class="metric-row"><span>Stability Status:</span><span class="metric-val">${esc(p3.status || NA)}</span></div>
    </div>

    <div class="card">
      <div class="card-title">Pillar 4: Debt Capacity & Leverage</div>
      <div class="metric-row"><span>Debt Service Proxy (DSCP):</span><span class="metric-val">${fx(p4.debtServiceCoverageProxy, 'x')}</span></div>
      <div class="metric-row"><span>Monthly EMI Burden:</span><span class="metric-val">${fx(p4.interestEmiBurdenRatio, '%')}</span></div>
      <div class="metric-row"><span>New Borrowing Velocity:</span><span class="metric-val">${fx(p4.newBorrowingVelocity)}</span></div>
      <div class="metric-row"><span>Leverage Tier:</span><span class="metric-val">${esc(p4.tier || NA)}</span></div>
    </div>
  </div>

  ${auditorNotes ? `
  <div class="notes-box">
    <div class="notes-title">Auditor Observations & Committee Override Notes</div>
    <div class="notes-content">"${esc(auditorNotes)}"</div>
  </div>
  ` : ''}

  <div class="section-title">Explainability Citations & Regulatory Audit Trail</div>
  <ul class="citations-list">
    ${(data.decision?.citations || []).map(c => `<li>${esc(c)}</li>`).join('') || `<li>${NA}</li>`}
  </ul>

  <div class="footer">
    <div>Enver AI Tech Pvt. Ltd. · Artificer Autonomous Underwriting Engine</div>
    <div>Strictly Confidential · For Credit Committee Use Only</div>
    <div>Page 1 of 1</div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 400);
    };
  </script>
</body>
</html>
  `;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
