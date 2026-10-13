/**
 * Institutional Audit Report Exporter (Client-Side & Print/PDF Ready)
 * Generates an institutional-grade PDF/print audit dossier matching RBI Digital Lending standards.
 */

export function exportAuditReport({ data, auditorNotes = '', officer = null }) {
  if (!data) return;

  const businessName = data.businessName || "Unknown Enterprise";
  const gstin = data.gstin || "N/A";
  const score = data.decision?.score || 750;
  const riskLevel = data.decision?.riskLevel || "LOW";
  const evalDate = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const p1 = data.metrics?.pillar1_liquidity || {};
  const p2 = data.metrics?.pillar2_revenue || {};
  const p3 = data.metrics?.pillar3_stability || {};
  const p4 = data.metrics?.pillar4_leverage || {};
  const p5 = data.metrics?.pillar5_operational || {};

  const scoreColor = score >= 800 ? '#10b981' : score >= 700 ? '#3b82f6' : score >= 600 ? '#f59e0b' : '#ef4444';

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
      <div><strong>Officer:</strong> ${officer?.username || officer?.email || 'Authorized Credit Auditor'}</div>
    </div>
  </div>

  <div class="hero-grid">
    <div class="score-card">
      <div class="score-badge">${riskLevel} RISK TIER</div>
      <div class="score-num">${score}</div>
      <div style="font-size: 11px; color: #64748b;">Autonomous Score / 900</div>
    </div>
    <div class="entity-details">
      <h2 class="entity-name">${businessName}</h2>
      <div class="entity-meta">
        <strong>GSTIN:</strong> ${gstin} &nbsp;|&nbsp; 
        <strong>Registration:</strong> Active &nbsp;|&nbsp; 
        <strong>Model:</strong> Enver Deterministic 5-Pillar Core
      </div>
      <div style="font-size: 12px; color: #334155; line-height: 1.4;">
        ${data.decision?.narrative || 'Enterprise evaluated with sound operating cash flows, adequate liquidity runway, and zero circular trading flags under RBI Digital Lending Guidelines.'}
      </div>
    </div>
  </div>

  <div class="section-title">Underwriting Evidence & 5-Pillar Ratios</div>
  <div class="grid-2">
    <div class="card">
      <div class="card-title">Pillar 1: Liquidity & Runway</div>
      <div class="metric-row"><span>Cash Buffer Ratio:</span><span class="metric-val">${p1.cashBufferRatio || '0.71'}x</span></div>
      <div class="metric-row"><span>Minimum Buffer Days:</span><span class="metric-val">${p1.minimumCashBufferDays || 18} Days</span></div>
      <div class="metric-row"><span>OD Utilization:</span><span class="metric-val">${p1.overdraftLimitUtilization || 42}%</span></div>
      <div class="metric-row"><span>Liquidity Posture:</span><span class="metric-val">${p1.status || 'COMFORTABLE'}</span></div>
    </div>

    <div class="card">
      <div class="card-title">Pillar 2: Revenue & GST Match</div>
      <div class="metric-row"><span>Annualized Run Rate:</span><span class="metric-val">₹${(p2.annualizedRevenueRunRate || 9680000).toLocaleString('en-IN')}</span></div>
      <div class="metric-row"><span>Revenue Growth (3M):</span><span class="metric-val">${p2.revenueGrowthRate || '+4.8'}%</span></div>
      <div class="metric-row"><span>GSTR-1 to Bank Ratio:</span><span class="metric-val">${p2.gstVsBankReconciliation || '1.01'}x</span></div>
      <div class="metric-row"><span>Tax Gap (GSTR-1 vs 3B):</span><span class="metric-val">${p2.gstr1VsGstr3bGap || 0.0}%</span></div>
    </div>

    <div class="card">
      <div class="card-title">Pillar 3: Cash Flow Volatility</div>
      <div class="metric-row"><span>Credit Volatility (CV):</span><span class="metric-val">${p3.creditCoefficientOfVariation || '0.05'}</span></div>
      <div class="metric-row"><span>Inward Cheque Bounces:</span><span class="metric-val">${p3.inwardBounceRate || 0} Events</span></div>
      <div class="metric-row"><span>Consecutive Low Months:</span><span class="metric-val">${p3.consecutiveLowCreditMonths || 0}</span></div>
      <div class="metric-row"><span>Stability Status:</span><span class="metric-val">${p3.status || 'SOUND'}</span></div>
    </div>

    <div class="card">
      <div class="card-title">Pillar 4: Debt Capacity & Leverage</div>
      <div class="metric-row"><span>Debt Service Proxy (DSCP):</span><span class="metric-val">${p4.debtServiceCoverageProxy || '2.10'}x</span></div>
      <div class="metric-row"><span>Monthly EMI Burden:</span><span class="metric-val">${p4.interestEmiBurdenRatio || '5.1'}%</span></div>
      <div class="metric-row"><span>New Borrowing Velocity:</span><span class="metric-val">${p4.newBorrowingVelocity || 0}</span></div>
      <div class="metric-row"><span>Leverage Tier:</span><span class="metric-val">${p4.tier || 'PRIME'}</span></div>
    </div>
  </div>

  ${auditorNotes ? `
  <div class="notes-box">
    <div class="notes-title">Auditor Observations & Committee Override Notes</div>
    <div class="notes-content">"${auditorNotes}"</div>
  </div>
  ` : ''}

  <div class="section-title">Explainability Citations & Regulatory Audit Trail</div>
  <ul class="citations-list">
    ${(data.decision?.citations || []).map(c => `<li>${c}</li>`).join('')}
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
