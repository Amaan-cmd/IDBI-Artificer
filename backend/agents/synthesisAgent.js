const { callGemini } = require('../utils/googleGemini');
const { proModel } = require('../utils/geminiModels');
const { applyGuardrails } = require('../utils/nemoGuardrails');
const { gapCaveat } = require('../utils/fieldLabels');

/**
 * Agent 3: XAI & Chief Credit Officer (Gemini 2.5 Pro)
 * Synthesizes final underwriting decision, heavily weighting Liquidity & Cash Buffer for NTC entities.
 */
async function synthesizeScore(agent1Data, agent2Matrix, externalOverrides = null, options = {}) {
  const isTestMode = options.deterministicOnly || process.env.NODE_ENV === 'test';

  if (!isTestMode) {
    console.log('[Agent 3: Chief Credit Officer & XAI] Synthesizing 5-Pillar credit decision via Gemini 2.5 Pro...');
  }

  const systemPrompt = `You are Agent 3 (Chief Credit Officer & Explainable AI Agent) powered by Gemini 2.5 Pro.
Your responsibility:
1. Cross-verify the safety, integrity, and realism of data extracted by Agent 1 and the 5-Pillar Telemetry from Agent 2.
2. Underwrite the business with special focus on NTC (New-to-Credit) dynamics:
   - PILLAR 1: LIQUIDITY & CASH BUFFER is the primary survival metric (Cash Buffer Ratio > 0.15x and Min Buffer Days > 7-10 days are mandatory for prime lending).
   - PILLAR 2: REVENUE & MOMENTUM verifies entity scale and GSTR tax reconciliation.
   - PILLAR 3: CASH FLOW STABILITY & VOLATILITY penalizes inward bounces and high CV (> 0.40).
   - PILLAR 4: DEBT SERVICE & LEVERAGE checks debt service proxy (DSCP > 1.5x) and borrowing velocity.
   - PILLAR 5: OPERATIONAL FLAGS flags circular counterparty rotations, odd-hour activity, and high cash withdrawals (> 15%).
3. Synthesize a definitive Holistic Credit Score (300 to 900) and Risk Tier (LOW | MEDIUM | HIGH).
SCORING CALIBRATION RUBRIC (Do NOT assign 900 to ordinary solvent borrowers):
   - 830 to 875: Institutional Elite (High margin, zero debt, >30 days cash cushion, rapid growth, zero bounces). Rare.
   - 750 to 825: Prime / Low Risk (Healthy liquidity >15 days, DSCP >1.5x, steady expansion, zero bounces).
   - 620 to 749: Moderate / Near-Prime (Standard MSME operating profile, modest buffer 10-18 days, tight working capital, or mild seasonality).
   - 480 to 619: Elevated Risk / Stressed (Inward bounce friction, negative growth, low buffer <8 days, high OD usage >80%, or litigation).
   - 300 to 479: Severe Distress / Non-Compliant (Multiple bounces, MCA strike-off/inactive, or debt insolvency).
   MAX CEILING: 885. Absolutely NO borrower receives a 900 score.
4. Construct an immutable Forensic Audit Trail with exact line-item citations.
CRITICAL RULE:
- Zero hallucinations.
- Fields listed in Agent 1 "dataGaps" were not found in the source data; treat them as unavailable (not zero) and do not score them.
- All risk deductions or approvals must be forensically justified across the 5 pillars.
- Return ONLY a raw JSON object with no conversational fluff.`;

  const userPrompt = `Agent 1 Extracted Profile:
${JSON.stringify(agent1Data, null, 2)}

Agent 2 5-Pillar Telemetry Matrix:
${JSON.stringify(agent2Matrix, null, 2)}

${externalOverrides ? `External Overrides / Manual Scraper Signals:\n${JSON.stringify(externalOverrides, null, 2)}` : ''}

Generate the final underwriting synthesis.
Output strictly in JSON schema:
{
  "score": (number between 320 and 885, following the Calibration Rubric),
  "riskLevel": ("LOW" | "MEDIUM" | "HIGH"),
  "narrative": "A concise executive underwriting decision summary (2-3 sentences referencing primary pillars).",
  "reasoning": "Detailed forensic explanation of why this specific score and risk tier were assigned across the 5 pillars.",
  "citations": [
    "Line-item citation referencing Liquidity & Cash Buffer Days...",
    "Line-item citation referencing Revenue Run Rate and GSTR reconciliation...",
    "Line-item citation referencing Cash Flow CV and Bounces...",
    "Line-item citation referencing Debt Service Coverage (DSCP)...",
    "Line-item citation referencing Operational / Circularity signals..."
  ],
  "caveats": ["Any input you could not verify, e.g. fields listed in Agent 1 dataGaps"],
  "agentSafetyAudit": {
    "dataIntegrityStatus": "(string; only a status you can cite from the data, otherwise NOT_ASSESSED)",
    "confidenceRating": null
  }
}`;

  const model = process.env.AGENT3_MODEL || proModel();
  const secretKeyName = 'GEMINI_API_KEY';

  if (!isTestMode) {
    try {
      const rawText = await applyGuardrails(
        systemPrompt,
        userPrompt,
        async () => await callGemini(model, systemPrompt, userPrompt, secretKeyName),
        "Agent 3: Synthesis & XAI"
      );
      
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const finalDecision = JSON.parse(jsonMatch[0]);
        if (typeof finalDecision.score === 'number') {
          finalDecision.score = Math.max(320, Math.min(885, finalDecision.score));
        }
        const gapCaveats = (Array.isArray(agent1Data?.dataGaps) ? agent1Data.dataGaps : []).map(gapCaveat);
        const llmCaveats = Array.isArray(finalDecision.caveats) ? finalDecision.caveats : [];
        finalDecision.caveats = [...new Set([...llmCaveats, ...gapCaveats])];
        console.log('[Agent 3] Final 5-Pillar Underwriting Synthesis & XAI Audit Trail generated.');
        return finalDecision;
      }
    } catch (error) {
      console.warn(`[Agent 3] Live LLM inference notice (${error.message}). Synthesizing deterministic underwriting rule.`);
    }
  }

  return deterministicDecision(agent1Data || {}, agent2Matrix || {}, externalOverrides);
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * Deterministic 5-pillar matrix (base 670). A metric that is missing, or that
 * telemetry derived from an input listed in agent1Data.dataGaps, neither
 * awards nor deducts points; it is reported as a caveat instead.
 */
function deterministicDecision(agent1Data, agent2Matrix, externalOverrides) {
  const p1 = agent2Matrix.pillar1_liquidity || {};
  const p2 = agent2Matrix.pillar2_revenue || {};
  const p3 = agent2Matrix.pillar3_stability || {};
  const p4 = agent2Matrix.pillar4_leverage || {};
  const p5 = agent2Matrix.pillar5_operational || {};

  const gaps = Array.isArray(agent1Data.dataGaps) ? agent1Data.dataGaps : [];
  const caveats = gaps.map(gapCaveat);
  const anyGap = (...fields) => fields.some(f => gaps.includes(f));
  const metric = (v, ...inputs) => (isNum(v) && !anyGap(...inputs) ? v : null);
  const notScored = (label) => caveats.push(`Not scored: ${label} (not available)`);

  // Growth and volatility need at least two months of credits.
  const credits = agent1Data.monthlyCredits;
  const series = !Array.isArray(credits) || credits.length >= 2;

  const cashBuffer = metric(p1.cashBufferRatio, 'dailyClosingBalances', 'monthlyDebits');
  const bufferDays = metric(p1.minimumCashBufferDays, 'dailyClosingBalances', 'monthlyDebits');
  const odUtil = metric(isNum(p1.overdraftLimitUtilization) ? p1.overdraftLimitUtilization : p4.overdraftLimitUtilization, 'sanctionedOdLimit', 'peakOdUsage');
  const growthRate = series ? metric(p2.revenueGrowthRate) : null;
  const runRate = metric(p2.annualizedRevenueRunRate);
  const gstRecon = metric(p2.gstVsBankReconciliation, 'gstr1OutwardTaxable');
  const taxGap = metric(p2.gstr1VsGstr3bGap, 'gstr1DeclaredTax', 'gstr3bTaxPaid');
  const cv = series ? metric(p3.creditCoefficientOfVariation) : null;
  const dscp = metric(p4.debtServiceCoverageProxy, 'monthlyEmiObligations', 'monthlyDebits');
  // EMI genuinely 0 in the statement: DSCP is undefined, so it is labelled, not scored.
  const noDebtService = p4.tier === 'NO_DEBT_SERVICE_OBSERVED' && !anyGap('monthlyEmiObligations');
  const emiBurden = metric(p4.interestEmiBurdenRatio, 'monthlyEmiObligations');

  let baseScore = 670;

  // 1. Pillar 1: Liquidity & Runway
  if (cashBuffer === null) notScored('cash buffer ratio');
  else if (cashBuffer >= 0.75) baseScore += 25;
  else if (cashBuffer >= 0.40) baseScore += 10;
  else if (cashBuffer >= 0.20) baseScore -= 10;
  else baseScore -= 35;

  if (odUtil === null) notScored('overdraft utilisation');
  else if (odUtil < 35) baseScore += 20;
  else if (odUtil <= 60) baseScore += 5;
  else if (odUtil <= 80) baseScore -= 15;
  else baseScore -= 35;

  // 2. Pillar 2: Revenue Growth & Scale
  if (growthRate === null) notScored('revenue growth');
  else if (growthRate >= 10.0) baseScore += 20;
  else if (growthRate >= 3.0) baseScore += 12;
  else if (growthRate >= 0.0) baseScore += 4;
  else if (growthRate >= -5.0) baseScore -= 12;
  else baseScore -= 30;

  if (gstRecon === null) notScored('GST vs bank reconciliation');
  else if (Math.abs(gstRecon - 1.0) <= 0.05) baseScore += 18;
  else if (Math.abs(gstRecon - 1.0) <= 0.15) baseScore += 5;
  else baseScore -= 25;

  if (taxGap === null) notScored('GSTR-1 vs GSTR-3B tax gap');
  else if (taxGap <= 1.0) baseScore += 12;
  else if (taxGap > 3.0) baseScore -= 25;

  // 3. Pillar 3: Cash Flow Stability & Friction
  const bounceRate = isNum(p3.inwardBounceRate) && !anyGap('totalDebitAttempts') ? p3.inwardBounceRate : null;
  const rawBounces = isNum(agent1Data.inwardBounces) && !anyGap('inwardBounces') ? agent1Data.inwardBounces : null;
  if (rawBounces === null && bounceRate === null) {
    notScored('inward bounces');
  } else {
    const rate = bounceRate ?? 0;
    const count = rawBounces ?? (rate > 0 ? 1 : 0);
    if (count === 0 && rate === 0) baseScore += 12;
    else if (count === 1 || rate <= 1.0) baseScore -= 35;
    else if (count === 2 || rate <= 2.5) baseScore -= 70;
    else baseScore -= 120;
  }

  if (cv === null) notScored('credit coefficient of variation');
  else if (cv <= 0.08) baseScore += 20;
  else if (cv <= 0.20) baseScore += 8;
  else if (cv <= 0.35) baseScore -= 12;
  else baseScore -= 30;

  // 4. Pillar 4: Leverage & Debt Service Coverage Proxy
  if (noDebtService) caveats.push('Not scored: debt service coverage proxy (no EMI / debt service observed in the statement)');
  else if (dscp === null) notScored('debt service coverage proxy');
  else if (dscp >= 1.80) baseScore += 20;
  else if (dscp >= 1.40) baseScore += 12;
  else if (dscp >= 1.00) baseScore -= 10;
  else baseScore -= 45;

  if (emiBurden === null) notScored('EMI burden ratio');
  else if (emiBurden < 6.0) baseScore += 8;
  else if (emiBurden <= 12.0) baseScore += 2;
  else baseScore -= 12;

  // 5. Pillar 5: Circularity & Operational Discipline. Circularity is only
  // meaningful when a transaction list was analysed.
  const hasTransactions = Array.isArray(agent1Data.transactions) && agent1Data.transactions.length > 0 && !anyGap('transactions');
  const circularRisk = hasTransactions && typeof p5.circularTransactionRisk === 'string' ? p5.circularTransactionRisk : null;
  if (circularRisk === null) notScored('counterparty circularity (no transaction list)');
  else if (circularRisk.includes('HIGH')) baseScore -= 90;
  else if (circularRisk.includes('MEDIUM')) baseScore -= 40;
  else baseScore += 5;

  const courtCases = isNum(externalOverrides?.courtCases) ? externalOverrides.courtCases : (isNum(p5.courtCases) ? p5.courtCases : null);
  if (courtCases === null) caveats.push('Not verified: litigation / court cases');
  else if (courtCases > 0) baseScore -= (courtCases * 35);
  else baseScore += 7;

  if (isNum(p5.cashWithdrawalRatio) && p5.cashWithdrawalRatio > 0.08) {
    baseScore -= Math.round((p5.cashWithdrawalRatio - 0.08) * 120);
  }

  const finalScore = Math.max(320, Math.min(885, baseScore));
  const riskLevel = finalScore >= 750 ? "LOW" : finalScore >= 620 ? "MEDIUM" : "HIGH";

  const NA = 'not available';
  const fmt = (v, suffix = '') => (v === null ? NA : `${v}${suffix}`);
  const daysText = bufferDays === null ? `${NA} minimum survival buffer days` : `${bufferDays} minimum survival buffer days`;
  const bounceText = bounceRate === null && rawBounces === null
    ? `inward bounce data ${NA}`
    : (bounceRate ?? 0) > 0 || (rawBounces ?? 0) > 0
      ? `${bounceRate ?? NA}% inward bounce friction${rawBounces !== null ? ` (${rawBounces} inward bounce(s))` : ''}`
      : 'zero inward cheque/NACH dishonors';
  const reconText = agent1Data.taxpayerType?.includes('Composition')
    ? 'under Composition Scheme (CMP-08 quarterly filing)'
    : `with GSTR-1 reconciliation at ${fmt(gstRecon, 'x')}`;
  const balancesKnown = isNum(agent1Data.bankOpeningBalance) && isNum(agent1Data.bankClosingBalance);

  return {
    score: finalScore,
    riskLevel,
    narrative: `Entity assessed with a ${riskLevel} risk profile (Score: ${finalScore}). Cash Buffer Ratio: ${fmt(cashBuffer, 'x')}; minimum cash buffer: ${bufferDays === null ? NA : `${bufferDays} days`}.${caveats.length ? ` ${caveats.length} input(s) could not be verified or scored; see caveats.` : ''}`,
    reasoning: `Deterministic 5-pillar synthesis: liquidity status ${cashBuffer === null ? NA : (p1.status || NA)}; credit CV ${fmt(cv)}; ${bounceText}; DSCP ${noDebtService ? 'not applicable (no debt service observed)' : fmt(dscp, 'x')}; counterparty circularity ${circularRisk || 'not assessed'}.`,
    citations: [
      `[Pillar 1: Liquidity] Cash Buffer Ratio is ${fmt(cashBuffer, 'x')} with ${daysText}${isNum(agent1Data.sweepDeposits) && agent1Data.sweepDeposits > 0 ? ` (inclusive of ₹${(agent1Data.sweepDeposits / 100000).toFixed(1)}L auto-sweep liquid reserves)` : ''}.`,
      `[Pillar 2: Revenue] Annualized run rate ${runRate === null ? NA : `₹${(runRate / 100000).toFixed(1)} Lacs`} ${reconText}.`,
      `[Pillar 3: Stability] Credit CV is ${fmt(cv)} with ${bounceText}${agent1Data.technicalBouncesExcluded ? ` (${agent1Data.technicalBouncesExcluded} technical bounce(s) excluded)` : ''}.`,
      `[Pillar 4: Leverage] Debt Service Coverage Proxy (DSCP) is ${noDebtService ? 'not applicable (no EMI / debt service observed in the statement)' : fmt(dscp, 'x')} with an interest burden ratio of ${fmt(emiBurden, '%')}.`,
      `[Pillar 5: Operational Flags] ${circularRisk ? `Counterparty circularity: ${circularRisk}.` : 'Counterparty circularity not assessed (no transaction list).'}`
    ],
    caveats,
    agentSafetyAudit: {
      dataIntegrityStatus: balancesKnown && agent1Data.balanceContinuity?.status ? agent1Data.balanceContinuity.status : 'NOT_ASSESSED',
      confidenceRating: null
    }
  };
}

module.exports = { synthesizeScore };
