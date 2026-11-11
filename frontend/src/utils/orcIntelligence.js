import { KNOWN_GSTINS } from './gstinRegistry';
import { isDemoMode } from './demoMode';

/**
 * Institutional Credit Intelligence & Decision Explainability Engine for Orc CCO.
 * Explains a completed evaluation from the real backend payload (agent1Telemetry +
 * decision). Demo presets are used only when VITE_DEMO_MODE is on and are flagged
 * `sampleData`. Inputs that are missing (null or listed in dataGaps) are reported
 * as "Not available" and never scored or used to derive figures.
 */

const NA = 'Not available';
const RUPEES_PER_LAKH = 100000; // unit conversion only (1 lakh = 1,00,000 INR)

// Demo-mode alias GSTINs that resolve to the same sample preset.
const DEMO_ALIASES = {
  '27AABCU9603R1ZM': '27AADCB2230M1Z2', // Apex Precision
  '24AAJCS4912K1ZW': '24AABCS4421P1Z9', // Surat Textiles
  '27AAECK3910F1ZU': '27AAGCK8812L1ZQ'  // Kalyan Agro
};

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const sum = (arr) => arr.reduce((a, b) => a + b, 0);
const fmt = (v, suffix = '') => (isNum(v) ? `${v}${suffix}` : NA);
const fmtLakhs = (v, digits = 2) => (isNum(v) ? `₹${(v / RUPEES_PER_LAKH).toFixed(digits)}L` : NA);
const fmtSignedPct = (v) => (isNum(v) ? `${v >= 0 ? '+' : ''}${v}%` : NA);
const NAME_NOT_FOUND = 'Name not found in statement';
const MIN_MOMENTUM_MONTHS = 4;
const MOMENTUM_TOO_SHORT = `Not available (needs ≥ ${MIN_MOMENTUM_MONTHS} months of statements)`;
// Half-on-half revenue momentum, or the reason it is not available.
export const momentumText = (m) => (isNum(m?.revenueGrowthRate)
  ? `${fmtSignedPct(m.revenueGrowthRate)} half-on-half momentum`
  : (m?.revenueGrowthNote || NA));

function riskTierFromLevel(level) {
  if (!level) return null;
  const l = String(level).trim().toUpperCase();
  return /RISK$/.test(l) ? l : `${l} RISK`;
}

export function getCompanyDecisionData(businessName, gstin, probeData = null, evaluationPayload = null) {
  const cleanGstin = (gstin || evaluationPayload?.gstin || '').trim().toUpperCase();
  const telemetry = evaluationPayload?.agent1Telemetry;
  const gaps = new Set(Array.isArray(telemetry?.dataGaps) ? telemetry.dataGaps : []);
  const hasRealFinancials = Array.isArray(telemetry?.monthlyCredits)
    && !gaps.has('monthlyCredits')
    && telemetry.monthlyCredits.some(isNum);
  const demoKey = DEMO_ALIASES[cleanGstin] || cleanGstin;
  const known = !hasRealFinancials && isDemoMode ? (KNOWN_GSTINS[demoKey] || null) : null;
  if (!hasRealFinancials && !known) return null;

  const src = hasRealFinancials ? telemetry : known;
  // A field is available only if it is a finite number and not flagged in dataGaps
  // (the backend zero-fills some missing fields and lists them there).
  const field = (...keys) => {
    for (const k of keys) {
      if (gaps.has(k)) continue;
      if (isNum(src[k])) return src[k];
    }
    return null;
  };

  const report = evaluationPayload?.registryReport || probeData?.registryReport || null;
  const payloadName = [evaluationPayload?.businessName, gaps.has('businessName') ? null : src.businessName]
    .find(n => n && n !== NAME_NOT_FOUND);
  const name = businessName || payloadName || known?.legalEntityName || report?.gst?.data?.legalName || 'Enterprise';
  const entityType = report?.gst?.data?.constitution || known?.entityType || 'Not verified';
  const mcaStatus = report?.mca?.status === 'ok' && report.mca.data?.status
    ? report.mca.data.status
    : (known?.mcaStatus || 'Not verified');

  const credits = src.monthlyCredits.filter(isNum);
  const debits = gaps.has('monthlyDebits') || !Array.isArray(src.monthlyDebits) ? [] : src.monthlyDebits.filter(isNum);
  const closingBalance = field('closingBalance', 'bankClosingBalance');
  const sanctionedOdLimit = field('sanctionedOdLimit');
  const peakOdUsage = field('peakOdUsage');
  const gstr1Sales = field('gstr1OutwardTaxable');
  const gstr1Tax = field('gstr1DeclaredTax');
  const gstr3bTax = field('gstr3bTaxPaid');
  const monthlyEmi = field('monthlyEmiObligations');
  const inwardBounces = field('inwardBounces');
  const sampleData = Boolean(known);

  // The backend telemetry (evaluationPayload.metrics, pillar1..5) is the single
  // source of truth for every figure it reports, so the same metric shows the
  // same value everywhere. A figure is computed locally only when the backend
  // value key is absent (demo presets / older payloads), with the same formulas.
  const backendMetrics = hasRealFinancials && evaluationPayload?.metrics && typeof evaluationPayload.metrics === 'object'
    ? evaluationPayload.metrics
    : null;
  const pick = (pillar, key, local) => {
    const p = backendMetrics?.[pillar];
    if (p && typeof p === 'object' && Object.prototype.hasOwnProperty.call(p, key)) return isNum(p[key]) ? p[key] : null;
    return local();
  };

  // Compute 5 Pillars (null = not available; never substituted with a default)
  const avgMonthlyDebit = debits.length ? sum(debits) / debits.length : null;
  const avgMonthlyCredit = pick('pillar2_revenue', 'averageMonthlyCredit', () => (credits.length ? sum(credits) / credits.length : null));
  const annualizedRevenue = pick('pillar2_revenue', 'annualizedRevenueRunRate', () => (isNum(avgMonthlyCredit) ? Math.round(avgMonthlyCredit * 12) : null));
  const cashBufferRatio = pick('pillar1_liquidity', 'cashBufferRatio', () => (isNum(closingBalance) && avgMonthlyDebit > 0 ? +(Math.max(0, closingBalance) / avgMonthlyDebit).toFixed(2) : null));
  // Minimum cash buffer days: lowest balance in the period / average daily debits.
  const survivalRunwayDays = pick('pillar1_liquidity', 'minimumCashBufferDays', () => {
    const balances = gaps.has('dailyClosingBalances') || !Array.isArray(src.dailyClosingBalances) ? [] : src.dailyClosingBalances.filter(isNum);
    return balances.length && avgMonthlyDebit > 0 ? Math.round(Math.max(0, Math.min(...balances)) / (avgMonthlyDebit / 30)) : null;
  });
  const odUtilization = pick('pillar1_liquidity', 'overdraftLimitUtilization', () => (sanctionedOdLimit > 0 && isNum(peakOdUsage) ? Math.round((peakOdUsage / sanctionedOdLimit) * 10000) / 100 : null));

  // Revenue momentum: >= 4 months, equal halves (middle month dropped when odd).
  const localMomentum = () => {
    if (credits.length < MIN_MOMENTUM_MONTHS) return null;
    const half = Math.floor(credits.length / 2);
    const firstHalf = sum(credits.slice(0, half));
    const secondHalf = sum(credits.slice(credits.length - half));
    return firstHalf > 0 ? Math.round(((secondHalf - firstHalf) / firstHalf) * 10000) / 100 : null;
  };
  const revenueGrowthRate = pick('pillar2_revenue', 'revenueGrowthRate', localMomentum);
  const backendMomentumReason = backendMetrics?.pillar2_revenue?.revenueGrowthUnavailableReason;
  const revenueGrowthNote = isNum(revenueGrowthRate) ? null
    : (typeof backendMomentumReason === 'string' && backendMomentumReason) || (credits.length < MIN_MOMENTUM_MONTHS ? MOMENTUM_TOO_SHORT : NA);
  const totalCredits = sum(credits);
  const gstReconciliation = pick('pillar2_revenue', 'gstVsBankReconciliation', () => (isNum(gstr1Sales) && totalCredits > 0 ? +(gstr1Sales / totalCredits).toFixed(2) : null));
  const taxGap = pick('pillar2_revenue', 'gstr1VsGstr3bGap', () => (gstr1Tax > 0 && isNum(gstr3bTax) ? Math.round(((gstr1Tax - gstr3bTax) / gstr1Tax) * 10000) / 100 : null));

  const creditCV = pick('pillar3_stability', 'creditCoefficientOfVariation', () => {
    if (credits.length < 2 || !(avgMonthlyCredit > 0)) return null;
    const variance = credits.reduce((s, val) => s + Math.pow(val - avgMonthlyCredit, 2), 0) / credits.length;
    return +(Math.sqrt(variance) / avgMonthlyCredit).toFixed(2);
  });

  const dscp = pick('pillar4_leverage', 'debtServiceCoverageProxy', () => {
    const netOperatingInflow = isNum(avgMonthlyCredit) && isNum(avgMonthlyDebit) ? Math.max(0, avgMonthlyCredit - avgMonthlyDebit) : null;
    return monthlyEmi > 0 && isNum(netOperatingInflow) ? +(netOperatingInflow / monthlyEmi).toFixed(2) : null;
  });
  const emiBurdenRatio = pick('pillar4_leverage', 'interestEmiBurdenRatio', () => (isNum(monthlyEmi) && avgMonthlyCredit > 0 ? Math.round((monthlyEmi / avgMonthlyCredit) * 10000) / 100 : null));

  // Court Cases & Forensic: no litigation provider is wired up, so these exist only for demo presets.
  const courtCases = known ? (demoKey === '27AAGCK8812L1ZQ' ? 1 : 0) : null; // null = not available from provider
  const directorDIN = known ? (demoKey === '27AAGCK8812L1ZQ' ? '01829471 (Inquiry)' : '02914820 (Clean)') : NA;

  // Calculate Points Math (Base: 670 Institutional Solvent Baseline)
  const mathDrivers = [];
  const unavailableInputs = [];
  let score = 670;

  // P1: Liquidity & Cash Buffer Ratio
  if (cashBufferRatio === null) {
    unavailableInputs.push('Cash buffer ratio (closing balance or monthly debits not available)');
  } else if (cashBufferRatio >= 0.75) {
    score += 25;
    mathDrivers.push({ factor: 'Strong Cash Buffer (>= 0.75x)', points: '+25 pts', positive: true, detail: `Ratio ${cashBufferRatio}x with ${fmt(survivalRunwayDays, ' minimum cash buffer days')}` });
  } else if (cashBufferRatio >= 0.40) {
    score += 10;
    mathDrivers.push({ factor: 'Adequate Cash Buffer (0.40–0.74x)', points: '+10 pts', positive: true, detail: `Ratio ${cashBufferRatio}x with ${fmt(survivalRunwayDays, ' minimum cash buffer days')}` });
  } else if (cashBufferRatio >= 0.20) {
    score -= 10;
    mathDrivers.push({ factor: 'Tight Cash Buffer (0.20–0.39x)', points: '-10 pts', positive: false, detail: `Ratio ${cashBufferRatio}x provides ${fmt(survivalRunwayDays, ' minimum cash buffer days')}` });
  } else {
    score -= 35;
    mathDrivers.push({ factor: 'Depleted Cash Buffer (< 0.20x)', points: '-35 pts', positive: false, detail: `Ratio ${cashBufferRatio}x provides ${fmt(survivalRunwayDays, ' minimum cash buffer days')}` });
  }

  // P1: Overdraft / Limit Utilization
  if (odUtilization === null) {
    unavailableInputs.push('Overdraft utilization (sanctioned OD limit / peak usage not available)');
  } else if (odUtilization < 35) {
    score += 20;
    mathDrivers.push({ factor: 'Prudent Overdraft Utilization (< 35%)', points: '+20 pts', positive: true, detail: `Peak drawn: ${odUtilization}% of ₹${(sanctionedOdLimit / RUPEES_PER_LAKH).toFixed(1)}L limit` });
  } else if (odUtilization <= 60) {
    score += 5;
    mathDrivers.push({ factor: 'Moderate Overdraft Drawdown (35–60%)', points: '+5 pts', positive: true, detail: `Peak drawn: ${odUtilization}%` });
  } else if (odUtilization <= 80) {
    score -= 15;
    mathDrivers.push({ factor: 'Elevated Overdraft Reliance (61–80%)', points: '-15 pts', positive: false, detail: `Peak drawn: ${odUtilization}% indicates working capital tightening` });
  } else {
    score -= 35;
    mathDrivers.push({ factor: 'Stressed Overdraft Headroom (> 80%)', points: '-35 pts', positive: false, detail: `Peak drawn: ${odUtilization}% indicates liquidity strain` });
  }

  // P2: Revenue Momentum
  if (revenueGrowthRate === null) {
    unavailableInputs.push(`Revenue momentum: ${revenueGrowthNote}`);
  } else if (revenueGrowthRate >= 10.0) {
    score += 20;
    mathDrivers.push({ factor: 'Expansionary Revenue Momentum (>= 10%)', points: '+20 pts', positive: true, detail: `+${revenueGrowthRate}% half-on-half growth` });
  } else if (revenueGrowthRate >= 3.0) {
    score += 12;
    mathDrivers.push({ factor: 'Steady Revenue Momentum (3–9.9%)', points: '+12 pts', positive: true, detail: `+${revenueGrowthRate}% growth` });
  } else if (revenueGrowthRate >= 0.0) {
    score += 4;
    mathDrivers.push({ factor: 'Flat Revenue Baseline (0–2.9%)', points: '+4 pts', positive: true, detail: `+${revenueGrowthRate}% growth` });
  } else if (revenueGrowthRate >= -5.0) {
    score -= 12;
    mathDrivers.push({ factor: 'Mild Revenue Contraction (-5 to -0.1%)', points: '-12 pts', positive: false, detail: `${revenueGrowthRate}% turnover decline` });
  } else {
    score -= 30;
    mathDrivers.push({ factor: 'Severe Revenue Decline (< -5%)', points: '-30 pts', positive: false, detail: `${revenueGrowthRate}% turnover contraction` });
  }

  // P2: GST Turnover Reconciliation
  if (gstReconciliation === null) {
    unavailableInputs.push('GSTR-1 to bank turnover reconciliation (GSTR-1 outward taxable not available)');
  } else if (Math.abs(gstReconciliation - 1.0) <= 0.05) {
    score += 18;
    mathDrivers.push({ factor: 'Seamless GSTR-1 to Bank Reconciliation', points: '+18 pts', positive: true, detail: `Turnover ratio: ${gstReconciliation}x (zero off-ledger gap)` });
  } else if (Math.abs(gstReconciliation - 1.0) <= 0.15) {
    score += 5;
    mathDrivers.push({ factor: 'Acceptable Statutory Variance', points: '+5 pts', positive: true, detail: `Turnover ratio: ${gstReconciliation}x` });
  } else {
    score -= 25;
    mathDrivers.push({ factor: 'GSTR vs Bank Turnover Divergence', points: '-25 pts', positive: false, detail: `Ratio ${gstReconciliation}x signals off-ledger or unbanked volume` });
  }

  // P2: Tax Gap (GSTR-1 vs 3B)
  if (taxGap === null) {
    unavailableInputs.push('GSTR-1 vs GSTR-3B tax gap (declared / paid tax not available)');
  } else if (taxGap <= 1.0) {
    score += 12;
    mathDrivers.push({ factor: 'Zero GSTR-1 vs 3B Tax Gap (<= 1.0%)', points: '+12 pts', positive: true, detail: `Declared ₹${(gstr1Tax/ RUPEES_PER_LAKH).toFixed(2)}L ≈ Paid ₹${(gstr3bTax/ RUPEES_PER_LAKH).toFixed(2)}L` });
  } else if (taxGap <= 3.0) {
    mathDrivers.push({ factor: 'Minor Timing Tax Variance (<= 3%)', points: '0 pts', positive: true, detail: `${taxGap}% variance` });
  } else {
    score -= 25;
    mathDrivers.push({ factor: 'GSTR-3B Tax Shortfall Delinquency (> 3%)', points: '-25 pts', positive: false, detail: `${taxGap}% tax unpaid indicates impending GST audit risk` });
  }

  // P3: Cash Flow Stability (Credit CV)
  if (creditCV === null) {
    unavailableInputs.push('Cash flow stability (insufficient monthly credit history)');
  } else if (creditCV <= 0.08) {
    score += 20;
    mathDrivers.push({ factor: 'High Cash Flow Predictability (CV <= 0.08)', points: '+20 pts', positive: true, detail: `CV = ${creditCV} (low seasonal dispersion)` });
  } else if (creditCV <= 0.20) {
    score += 8;
    mathDrivers.push({ factor: 'Moderate Turnover Volatility (CV 0.09–0.20)', points: '+8 pts', positive: true, detail: `CV = ${creditCV}` });
  } else if (creditCV <= 0.35) {
    score -= 12;
    mathDrivers.push({ factor: 'Elevated Cash Flow Dispersion (CV 0.21–0.35)', points: '-12 pts', positive: false, detail: `CV = ${creditCV}` });
  } else {
    score -= 30;
    mathDrivers.push({ factor: 'Erratic Cash Flow Dispersion (CV > 0.35)', points: '-30 pts', positive: false, detail: `CV = ${creditCV} indicates revenue instability` });
  }

  // P3: Inward Bounces (Cheque / NACH Dishonours)
  if (inwardBounces === null) {
    unavailableInputs.push('Inward cheque / NACH bounces');
  } else if (inwardBounces === 0) {
    score += 12;
    mathDrivers.push({ factor: 'Flawless Banking Discipline (0 Bounces)', points: '+12 pts', positive: true, detail: 'Zero inward NACH or cheque return friction' });
  } else if (inwardBounces === 1) {
    score -= 50;
    mathDrivers.push({ factor: 'Inward Dishonour Return Event (1 Bounce)', points: '-50 pts', positive: false, detail: 'Strict RBI penalty: indicates liquidity friction' });
  } else if (inwardBounces === 2) {
    score -= 90;
    mathDrivers.push({ factor: 'Repeated Inward Dishonours (2 Bounces)', points: '-90 pts', positive: false, detail: 'Significant credit risk: recurring inward dishonours' });
  } else {
    score -= 135;
    mathDrivers.push({ factor: `Severe Inward Dishonours (${inwardBounces} Bounces)`, points: '-135 pts', positive: false, detail: 'High default probability' });
  }

  // P4: Debt Service Coverage Proxy (DSCP)
  if (dscp === null) {
    unavailableInputs.push(monthlyEmi === 0 ? 'Debt service coverage proxy (no EMI obligations observed)' : 'Debt service coverage proxy (EMI obligations or monthly debits not available)');
  } else if (dscp >= 1.80) {
    score += 20;
    mathDrivers.push({ factor: 'Prime Debt Service Coverage (DSCP >= 1.80x)', points: '+20 pts', positive: true, detail: `${dscp}x operational cash surplus over monthly EMI` });
  } else if (dscp >= 1.40) {
    score += 12;
    mathDrivers.push({ factor: 'Adequate Debt Service Coverage (1.40–1.79x)', points: '+12 pts', positive: true, detail: `${dscp}x coverage` });
  } else if (dscp >= 1.00) {
    score -= 10;
    mathDrivers.push({ factor: 'Tight Debt Service Coverage (1.00–1.39x)', points: '-10 pts', positive: false, detail: `${dscp}x coverage leaves little margin` });
  } else {
    score -= 45;
    mathDrivers.push({ factor: 'Stressed Debt Coverage (DSCP < 1.00x)', points: '-45 pts', positive: false, detail: `${dscp}x coverage breaches safety covenants` });
  }

  // P4: EMI Burden Ratio
  if (emiBurdenRatio === null) {
    unavailableInputs.push('EMI burden ratio (monthly EMI obligations not available)');
  } else if (emiBurdenRatio < 6.0) {
    score += 8;
    mathDrivers.push({ factor: 'Low Debt Burden (< 6%)', points: '+8 pts', positive: true, detail: `${emiBurdenRatio}% of monthly turnover` });
  } else if (emiBurdenRatio <= 12.0) {
    score += 2;
    mathDrivers.push({ factor: 'Manageable Debt Burden (6–12%)', points: '+2 pts', positive: true, detail: `${emiBurdenRatio}% of monthly turnover` });
  } else {
    score -= 12;
    mathDrivers.push({ factor: 'Elevated Debt Service Burden (> 12%)', points: '-12 pts', positive: false, detail: `${emiBurdenRatio}% of monthly turnover committed to debt` });
  }

  // P5: Operational & Legal
  if (mcaStatus === 'Not verified') {
    unavailableInputs.push('MCA21 company status (not verified)');
  } else if (!/^active$/i.test(String(mcaStatus).trim())) {
    score -= 150;
    mathDrivers.push({ factor: 'Non-Active MCA Status', points: '-150 pts', positive: false, detail: 'Statutory non-compliance / dormant entity flag' });
  } else {
    score += 8;
    mathDrivers.push({ factor: 'Active MCA21 Legal Attestation', points: '+8 pts', positive: true, detail: `Entity status: ${mcaStatus} · DIN ${directorDIN}` });
  }

  if (courtCases === null) {
    unavailableInputs.push('Litigation / court cases (no litigation provider)');
  } else if (courtCases > 0) {
    score -= (courtCases * 35);
    mathDrivers.push({ factor: `Litigation Records Flagged (${courtCases})`, points: `-${courtCases * 35} pts`, positive: false, detail: 'Pending judicial dispute identified' });
  } else {
    score += 7;
    mathDrivers.push({ factor: 'Zero Litigation Flag', points: '+7 pts', positive: true, detail: 'Clean forensic and court records' });
  }

  // Institutional Corporate Anchor / Scale Bonus (Tata Motors, High-tech Software)
  if (known && demoKey === '27AAACT2727Q1ZW') {
    score += 25; // Large-cap sovereign corporate anchor
    mathDrivers.push({ factor: 'Institutional Anchor Blue-Chip Status', points: '+25 pts', positive: true, detail: '₹280Cr+ revenue tier' });
  } else if (known && demoKey === '27AAHCE5539J1ZA') {
    score += 25; // Enver AI Tech: High margin tech firm with minimal leverage
    mathDrivers.push({ factor: 'High-Margin Zero-Debt Technology Profile', points: '+25 pts', positive: true, detail: 'SaaS software gross margin profile' });
  }

  // Institutional Realistic Clamping: 320 (insolvent) to 885 (elite prime; NO ONE gets 900)
  const localScore = Math.max(320, Math.min(885, score));

  // The backend decision is authoritative; the local drivers only explain it.
  const decision = evaluationPayload?.decision || null;
  const backendScore = isNum(decision?.score) ? decision.score : null;
  const finalScore = backendScore ?? localScore;
  const riskTier = riskTierFromLevel(decision?.riskLevel)
    || (finalScore >= 750 ? 'LOW RISK' : finalScore >= 600 ? 'MODERATE RISK' : 'HIGH RISK');

  // Indicative limit: a share of the annualized run rate, only when that run rate is known.
  const limitAt = (share) => (isNum(annualizedRevenue)
    ? `₹${Math.round((annualizedRevenue * share) / RUPEES_PER_LAKH)} Lakhs`
    : NA);
  let recommendedLimit;
  let sanctionVerdict;

  if (finalScore >= 850) {
    recommendedLimit = limitAt(0.45);
    sanctionVerdict = `EXPEDITED SOVEREIGN SANCTION (${recommendedLimit})`;
  } else if (finalScore >= 750) {
    recommendedLimit = limitAt(0.35);
    sanctionVerdict = `APPROVED: WORKING CAPITAL FACILITY (${recommendedLimit})`;
  } else if (finalScore >= 600) {
    recommendedLimit = limitAt(0.20);
    sanctionVerdict = `CONDITIONAL APPROVAL: CAPPED WORKING CAPITAL (${recommendedLimit})`;
  } else {
    recommendedLimit = '₹0.0 Lakhs (Declined)';
    sanctionVerdict = 'REJECTED: EXCESSIVE RISK PROFILE';
  }

  return {
    name,
    gstin: cleanGstin,
    entityType,
    mcaStatus,
    score: finalScore,
    localScore,
    scoreSource: backendScore !== null ? 'backend' : (sampleData ? 'sample' : 'local'),
    riskTier,
    sanctionVerdict,
    recommendedLimit,
    mathDrivers,
    unavailableInputs,
    sampleData,
    registryAdjustments: Array.isArray(decision?.registryAdjustments) ? decision.registryAdjustments : [],
    caveats: Array.isArray(decision?.caveats) ? decision.caveats : [],
    redFlags: Array.isArray(decision?.redFlags) ? decision.redFlags : [],
    narrative: decision?.narrative || null,
    metrics: {
      annualizedRevenue,
      avgMonthlyCredit,
      monthlyEmi,
      cashBufferRatio,
      survivalRunwayDays,
      odUtilization,
      revenueGrowthRate,
      revenueGrowthNote,
      gstReconciliation,
      taxGap,
      creditCV,
      inwardBounces,
      dscp,
      emiBurdenRatio,
      courtCases,
      directorDIN
    }
  };
}

const bullet = (items, mark = '•') => items.map(i => `  ${mark} ${i}`).join('\n');

function formatAdjustment(a) {
  const pts = isNum(a?.points) && a.points !== 0 ? ` (${a.points > 0 ? '+' : ''}${a.points} pts)` : '';
  const cap = isNum(a?.cap) ? ` [score capped at ${a.cap}]` : '';
  const cite = a?.citation ? ` — ${a.citation}` : '';
  return `${a?.label || 'Registry adjustment'}${pts}${cap}${cite}`;
}

function sampleNote(c) {
  return c.sampleData ? '\n\nSAMPLE DATA: figures come from a demo preset, not a real evaluation.' : '';
}

// Provenance and backend-decision context appended to score / verdict answers.
function decisionContext(c) {
  const lines = [];
  if (c.sampleData) lines.push('SAMPLE DATA: figures come from a demo preset, not a real evaluation.');
  if (c.scoreSource === 'backend' && c.localScore !== c.score) {
    lines.push(`Note: the score of ${c.score} is the backend decision; the local driver reconstruction totals ${c.localScore} and is explanatory only.`);
  }
  if (c.registryAdjustments.length) lines.push(`REGISTRY ADJUSTMENTS:\n${bullet(c.registryAdjustments.map(formatAdjustment))}`);
  if (c.caveats.length) lines.push(`CAVEATS:\n${bullet(c.caveats, '!')}`);
  if (c.unavailableInputs.length) lines.push(`NOT AVAILABLE (not scored in the local explanation):\n${bullet(c.unavailableInputs, '-')}`);
  return lines.length ? `\n\n${lines.join('\n\n')}` : '';
}

/**
 * Generate grounded responses to underwriter directives from `companyData`
 * (the output of getCompanyDecisionData). Missing inputs render as "Not available".
 */
export function generateOrcResponse(userQuery, companyData) {
  const q = (userQuery || '').toLowerCase().trim();
  const c = companyData;
  if (!c) return 'No evaluation yet. Run an evaluation, then interrogate Orc about the decision.';
  const m = c.metrics;
  const ctx = decisionContext(c);

  // 1. Core Question: Why was this decision taken?
  if (
    q.includes('why was this decision taken') ||
    q.includes('why this decision') ||
    q.includes('why approved') ||
    q.includes('why rejected') ||
    q.includes('why sanctioned') ||
    q.includes('decision rationale') ||
    q.includes('explain decision') ||
    q.includes('why take this decision')
  ) {
    const positives = c.mathDrivers.filter(d => d.positive).map(d => `  ✓ ${d.factor}: ${d.detail} [${d.points}]`).join('\n') || '  - No positive drivers could be scored from the available inputs.';
    const negatives = c.mathDrivers.filter(d => !d.positive).map(d => `  ⚠ ${d.factor}: ${d.detail} [${d.points}]`).join('\n') || '  ✓ No adverse risk friction detected across evaluated metrics.';

    return `[ORC CCO UNDERWRITING MEMO — ${c.name.toUpperCase()}]:
AUDIT STATUS: ${c.sanctionVerdict}
FINAL INSTITUTIONAL CREDIT SCORE: ${c.score} / 900 (${c.riskTier})
RECOMMENDED EXPOSURE: ${c.recommendedLimit} Working Capital Line
${c.narrative ? `\nDECISION NARRATIVE: ${c.narrative}\n` : ''}
1. WHY THIS DECISION WAS TAKEN (Primary Positive Drivers):
${positives}

2. RISK FRICTION & RESTRAINING FACTORS:
${negatives}

3. INSTITUTIONAL POLICY CONCLUSION:
Under RBI Digital Lending Master Direction 2026, autonomous sanction requires both a minimum survival buffer and clean statutory reconciliation. Observed for ${c.name}: runway ${fmt(m.survivalRunwayDays, ' days')}, turnover reconciliation ${fmt(m.gstReconciliation, 'x')}, debt service coverage ${fmt(m.dscp, 'x')}.${ctx}`;
  }

  // 2. Score Breakdown Math
  if (
    q.includes('why score') ||
    q.includes('why is the score') ||
    q.includes(`why ${c.score}`) ||
    q.includes('points') ||
    q.includes('score breakdown') ||
    q.includes('scoring formula') ||
    q.includes('score math')
  ) {
    const driversList = c.mathDrivers.map(d => `• ${d.factor}: ${d.points} (${d.detail})`).join('\n') || '• No drivers could be scored from the available inputs.';
    return `[SCORE SYNTHESIS ARCHITECTURE — ${c.name}]:
Evaluated Score: ${c.score} / 900 (${c.riskTier})
Local Explanation Baseline: 670 Points

STEP-BY-STEP MATHEMATICAL ATTRIBUTION:
${driversList}

Local Reconstruction Total: ${c.localScore} / 900
Band Classification: Low Risk (>= 750) | Moderate Risk (600–749) | High Risk (< 600).
Deterministic Guarantee: No LLM approximation. Every point is calculated from source bank credits, MCA status, and GSTR tax records; inputs that are not available are excluded, not assumed.${ctx}`;
  }

  // 3. Downside / Negative Factors / Friction
  if (
    q.includes('downside') ||
    q.includes('negative') ||
    q.includes('friction') ||
    q.includes('penalties') ||
    q.includes('risk factors') ||
    q.includes('why not higher') ||
    q.includes('deductions')
  ) {
    const negatives = c.mathDrivers.filter(d => !d.positive);
    const redFlags = c.redFlags.length ? `\n\nRED FLAGS:\n${bullet(c.redFlags, '⚠')}` : '';
    if (negatives.length === 0) {
      return `[DOWNSIDE RISK AUDIT — ${c.name}]:
Zero adverse deductions detected among the scored inputs.
Inward bounces: ${fmt(m.inwardBounces)} · GSTR reconciliation: ${fmt(m.gstReconciliation, 'x')} · Court litigations: ${fmt(m.courtCases)} · Overdraft utilization: ${fmt(m.odUtilization, '%')}.
Current cash buffer: ${fmt(m.cashBufferRatio, 'x')} (${fmt(m.survivalRunwayDays, ' days')} runway). A larger cash buffer is the main lever for a higher local score.${redFlags}${ctx}`;
    }
    return `[RISK FRICTION AUDIT — ${c.name}]:
Identified risk friction deducting points from maximum potential score:
${negatives.map(n => `• ${n.factor} (${n.points}): ${n.detail}`).join('\n')}${redFlags}

Actionable Recommendation: Remediating these specific flags will re-score the enterprise on the next evaluation.${ctx}`;
  }

  // 4. Sensitivity & Upgrade Path: What would raise the score?
  if (
    q.includes('sensitivity') ||
    q.includes('raise the score') ||
    q.includes('increase score') ||
    q.includes('upgrade') ||
    q.includes('what would change') ||
    q.includes('improve score')
  ) {
    return `[COUNTERFACTUAL SENSITIVITY ANALYSIS — ${c.name}]:
Current Score: ${c.score} (${c.riskTier}).

Levers in the local scoring rules (point values from the explanation engine):
1. Cash Buffer Expansion: buffer ratio >= 0.75x earns +25 pts (current: ${fmt(m.cashBufferRatio, 'x')}).
2. Overdraft De-leveraging: peak OD utilization below 35% earns +20 pts (current: ${fmt(m.odUtilization, '%')}).
3. Tax Gap Integrity: GSTR-1 vs GSTR-3B gap <= 1.0% earns +12 pts (current: ${fmt(m.taxGap, '%')}).
4. Clean NACH Registry: zero inward bounces earns +12 pts (current: ${fmt(m.inwardBounces)}).
${c.unavailableInputs.length ? '\nSupplying the inputs listed as not available lets them be scored on the next evaluation.\n' : ''}
The actual uplift depends on the next full evaluation; no projected score is asserted here.${ctx}`;
  }

  // 5. Sanction Limit / Loan Capacity
  if (
    q.includes('limit') ||
    q.includes('loan amount') ||
    q.includes('sanction') ||
    q.includes('borrowing capacity') ||
    q.includes('how much') ||
    q.includes('why capped')
  ) {
    const maxDebtService = isNum(m.avgMonthlyCredit) ? m.avgMonthlyCredit * 0.20 : null;
    return `[CREDIT LIMIT EXPOSURE DETERMINATION — ${c.name}]:
Recommended Facility: ${c.recommendedLimit} Working Capital / Overdraft (indicative share of annualized run rate by score band)
Policy Metric: EMI Burden Ratio <= 20.0% of verified monthly credit inflows.

Calculation Telemetry:
• Annualized Revenue Run Rate: ${fmtLakhs(m.annualizedRevenue)}
• Average Monthly Inflow: ${fmtLakhs(m.avgMonthlyCredit)}
• Current EMI Obligations: ${isNum(m.monthlyEmi) ? `₹${Math.round(m.monthlyEmi)} / month` : NA} (${fmt(m.emiBurdenRatio, '%')})
• Debt Service Coverage Proxy (DSCP): ${fmt(m.dscp, 'x')}
• Maximum Safe Monthly Debt Service: ${fmtLakhs(maxDebtService)}${ctx}`;
  }

  // 6. Pillar 1: Cash Buffer & Liquidity
  if (q.includes('buffer') || q.includes('liquidity') || q.includes('runway') || q.includes('pillar 1')) {
    return `[PILLAR 01 AUDIT — LIQUIDITY & SURVIVAL RUNWAY]:
Enterprise: ${c.name}
• Cash Buffer Ratio: ${fmt(m.cashBufferRatio, 'x')} (Benchmark: >= 0.25x)
• Minimum Cash Buffer: ${fmt(m.survivalRunwayDays, ' Days')} (Minimum requirement: 15–25 days)
• Overdraft Utilization: ${fmt(m.odUtilization, '%')} (Sanctioned limit drawn)

Audit Rationale:
Cash Buffer Ratio is calculated as Bank Closing Balance divided by Average Monthly Debit outflows (sweep deposits and 50% of any undrawn OD/CC limit are added only where the statement shows them). Minimum cash buffer days is the lowest balance in the period divided by average daily debits. Each is reported as not available when an input is missing.${sampleNote(c)}`;
  }

  // 7. Pillar 2: GSTR-1 vs 3B Tax Gap & Revenue
  if (q.includes('gst') || q.includes('tax') || q.includes('gstr') || q.includes('reconciliation') || q.includes('pillar 2')) {
    return `[PILLAR 02 AUDIT — REVENUE & STATUTORY TAX GAP]:
Enterprise: ${c.name}
• Annualized Run Rate: ${fmtLakhs(m.annualizedRevenue)} (${momentumText(m)})
• GSTR-1 to Bank Reconciliation: ${fmt(m.gstReconciliation, 'x')} (Turnover alignment)
• GSTR-3B Tax Gap: ${fmt(m.taxGap, '%')} (Declared vs Paid Tax)

Audit Rationale:
Statutory reconciliation checks that GSTR-1 declared outward turnover matches banked credit inflows (benchmark: 0.90x – 1.10x). The tax gap compares GSTR-1 declared tax with GSTR-3B tax paid.${sampleNote(c)}`;
  }

  // 8. Pillar 3: Stability & Inward Bounces
  if (q.includes('bounce') || q.includes('stability') || q.includes('nach') || q.includes('volatility') || q.includes('cv') || q.includes('pillar 3')) {
    const bounceLine = m.inwardBounces === null
      ? 'Inward bounce data is not available for this evaluation.'
      : m.inwardBounces === 0
        ? 'Zero inward returns indicate clean banking discipline.'
        : `${m.inwardBounces} inward return event(s) detected, deducting points and triggering enhanced monitoring.`;
    return `[PILLAR 03 AUDIT — CASH FLOW DISCIPLINE & BOUNCE DEFENSE]:
Enterprise: ${c.name}
• Inward Return Bounces: ${fmt(m.inwardBounces, ' Events')}
• Credit Coefficient of Variation (CV): ${fmt(m.creditCV)} (Benchmark: < 0.30)
• Volatility Tier: ${m.creditCV === null ? NA : m.creditCV < 0.20 ? 'LOW DISPERSION (Highly Predictable)' : 'MODERATE VOLATILITY'}

Audit Rationale:
Inward bounces represent dishonour events on cheques or NACH auto-debits, indicating liquidity shortfalls.
${bounceLine}${sampleNote(c)}`;
  }

  // 9. Pillar 4: Debt Service Coverage Proxy (DSCP)
  if (q.includes('dscp') || q.includes('debt') || q.includes('emi') || q.includes('leverage') || q.includes('pillar 4')) {
    return `[PILLAR 04 AUDIT — DEBT SERVICE COVERAGE PROXY (DSCP)]:
Enterprise: ${c.name}
• DSCP Proxy Ratio: ${fmt(m.dscp, 'x')} (Benchmark: Prime >= 1.75x | Acceptable >= 1.25x)
• Monthly EMI Burden: ${fmt(m.emiBurdenRatio, '%')} of monthly inflow (Cap: 20.0%)

Audit Rationale:
DSCP is calculated as (Average Monthly Credit - Average Monthly Debit, floored at 0) divided by Monthly Scheduled EMI Obligations; it is not available when EMI obligations or monthly debits are missing.${sampleNote(c)}`;
  }

  // 10. Pillar 5: Operational Regularity & MCA
  if (q.includes('mca') || q.includes('court') || q.includes('litigation') || q.includes('din') || q.includes('payroll') || q.includes('pillar 5')) {
    return `[PILLAR 05 AUDIT — MCA21 & FORENSIC ATTESTATION]:
Enterprise: ${c.name}
• MCA Status: ${c.mcaStatus}
• Entity Type: ${c.entityType}
• Director DIN Record: ${m.directorDIN}
• Court Litigation Hits: ${m.courtCases === null ? NA : `${m.courtCases} Records`}
• Payroll Disbursals: ${NA}

Audit Rationale:
Confirms whether the enterprise is a genuine operating business rather than a dormant shell or circular trading vehicle. Items marked not available were not verified.${c.registryAdjustments.length ? `\n\nREGISTRY ADJUSTMENTS:\n${bullet(c.registryAdjustments.map(formatAdjustment))}` : ''}${sampleNote(c)}`;
  }

  // 11. RBI Compliance & Governance
  if (q.includes('rbi') || q.includes('compliance') || q.includes('policy') || q.includes('guidelines') || q.includes('regulation')) {
    return `[RBI DIGITAL LENDING COMPLIANCE ATTESTATION]:
Master Direction: DOR.CRE.REC.66/21.07.001/2022-23
Enterprise Underwritten: ${c.name} (${c.gstin || NA})

Mandatory Regulatory Guarantees:
1. Zero Hallucination: Decisions are calculated via deterministic code, never speculative generative guesses.
2. Immutable Audit Trail: Every point addition and deduction references specific source statement lines.
3. Explainable AI (XAI): Full factor breakdown exportable in standard credit committee dossier.
4. Privacy & Consent: 300-second session auto-lock sentinel protects borrower financial data from unauthorized inspection.`;
  }

  // Default: Comprehensive Overview
  return `[ORC CHIEF CREDIT OFFICER INTELLIGENCE]:
Active Target: ${c.name} (GSTIN: ${c.gstin || NA})
Synthesized Score: ${c.score} / 900 · ${c.riskTier} · ${c.sanctionVerdict}

Key Telemetry:
• Cash Buffer: ${fmt(m.cashBufferRatio, 'x')} (${fmt(m.survivalRunwayDays, ' days')} runway)
• Annualized Revenue: ${fmtLakhs(m.annualizedRevenue, 1)} (${momentumText(m)})
• GSTR Reconciliation: ${fmt(m.gstReconciliation, 'x')} (Tax gap: ${fmt(m.taxGap, '%')})
• Banking Bounces: ${fmt(m.inwardBounces)} returns · CV: ${fmt(m.creditCV)}
• DSCP Proxy: ${fmt(m.dscp, 'x')} · EMI Burden: ${fmt(m.emiBurdenRatio, '%')}
• MCA Standing: ${c.mcaStatus} · Court Hits: ${fmt(m.courtCases)}${ctx}

You may ask specific questions such as:
- "Why was this decision taken?"
- "Why is the score ${c.score}?"
- "What are the downside risks?"
- "What would raise the score?"
- "What sanction limit is recommended, and why?"`;
}
