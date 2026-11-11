/**
 * Financial Telemetry & Quantitative Underwriting Engine
 * Implements the 5-Pillar Alternate Data Credit Assessment Suite for NTC (New-to-Credit) MSMEs.
 *
 * Every metric is computed only from inputs that were actually supplied. An
 * input that is missing, non-numeric, or listed in input.dataGaps (the
 * ingestion agent's record of fields not found in the statement) makes the
 * metrics that depend on it null and the derived status 'NOT_ASSESSED'.
 * Nothing is defaulted or estimated.
 */

const NA = 'not available';
const NOT_ASSESSED = 'NOT_ASSESSED';
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const round2 = (v) => Math.round(v * 100) / 100;
const pct2 = (num, den) => Math.round((num / den) * 10000) / 100;
const fmt = (v, suffix = '') => (isNum(v) ? `${v}${suffix}` : NA);

function calculateStdDev(values) {
  if (!values || values.length === 0) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function calculateMedian(values) {
  if (!values || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Compute the complete 5-Pillar Financial Telemetry Suite.
 *
 * @param {Object} input
 * @param {Array<number>} input.monthlyCredits - Monthly credit sums (chronological)
 * @param {Array<number>} input.monthlyDebits - Monthly debit sums (chronological)
 * @param {Array<number>} input.dailyClosingBalances - Closing balance checkpoints
 * @param {number} input.sanctionedOdLimit - Overdraft/CC limit sanctioned (0 if none)
 * @param {number} input.peakOdUsage - Highest utilization of OD in period
 * @param {number} input.gstr1OutwardTaxable - Total outward taxable supplies from GSTR-1
 * @param {number} input.gstr3bTaxPaid - Total tax paid via GSTR-3B
 * @param {number} input.gstr1DeclaredTax - Tax declared on GSTR-1 supplies
 * @param {number} input.inwardBounces - Count of inward returns / NACH failures
 * @param {number} input.totalDebitAttempts - Total debit transactions attempted
 * @param {number} input.outwardBounces - Count of outward cheque / debit failures
 * @param {number} input.totalOutwardAttempts - Total outward transaction attempts
 * @param {number} input.monthlyEmiObligations - Monthly EMI / interest debits (0 = none observed)
 * @param {number} input.newBorrowingCount6M - New loan / credit line disbursements in last 6 months
 * @param {Array<Object>} input.transactions - Transaction stream for behavioural pattern mining
 * @param {Array<string>} input.dataGaps - Fields not found in the source; treated as missing
 */
function computeFinancialTelemetry(input = {}) {
  input = input || {};
  const gaps = new Set(Array.isArray(input.dataGaps) ? input.dataGaps : []);
  const num = (k) => (isNum(input[k]) && !gaps.has(k) ? input[k] : null);
  const series = (k) => (Array.isArray(input[k]) && input[k].length > 0 && input[k].every(isNum) && !gaps.has(k) ? input[k] : null);

  const monthlyCredits = series('monthlyCredits');
  const monthlyDebits = series('monthlyDebits');
  const dailyClosingBalances = series('dailyClosingBalances');
  const sanctionedOdLimit = num('sanctionedOdLimit');
  const peakOdUsage = num('peakOdUsage');
  const gstr1OutwardTaxable = num('gstr1OutwardTaxable');
  const gstr3bTaxPaid = num('gstr3bTaxPaid');
  const gstr1DeclaredTax = num('gstr1DeclaredTax');
  const inwardBounces = num('inwardBounces');
  const totalDebitAttempts = num('totalDebitAttempts');
  const outwardBounces = num('outwardBounces');
  const totalOutwardAttempts = num('totalOutwardAttempts');
  const monthlyEmiObligations = num('monthlyEmiObligations');
  const newBorrowingCount6M = num('newBorrowingCount6M');
  const sweepDeposits = num('sweepDeposits') ?? 0;
  const solvencyBouncesVerified = isNum(input.solvencyBouncesVerified) ? input.solvencyBouncesVerified : null;
  const transactions = Array.isArray(input.transactions) && !gaps.has('transactions') ? input.transactions : [];

  const numMonths = monthlyCredits ? monthlyCredits.length : null;
  const totalCredits = monthlyCredits ? monthlyCredits.reduce((a, b) => a + b, 0) : null;
  const totalDebits = monthlyDebits ? monthlyDebits.reduce((a, b) => a + b, 0) : null;
  const avgMonthlyCredit = monthlyCredits ? totalCredits / numMonths : null;
  const avgMonthlyDebit = monthlyDebits ? totalDebits / monthlyDebits.length : null;
  const avgDailyOutflow = isNum(avgMonthlyDebit) ? avgMonthlyDebit / 30 : null;

  // =========================================================================
  // PILLAR 1: LIQUIDITY & CASH BUFFER
  // Needs a real balance series and real debits. An unknown OD facility
  // contributes no drawing power.
  // =========================================================================
  const avgDailyClosingBalance = dailyClosingBalances
    ? dailyClosingBalances.reduce((a, b) => a + b, 0) / dailyClosingBalances.length
    : null;
  const lowestBalance = dailyClosingBalances ? Math.min(...dailyClosingBalances) : null;

  const availableDrawingPower = (isNum(sanctionedOdLimit) && isNum(peakOdUsage) && sanctionedOdLimit > peakOdUsage)
    ? (sanctionedOdLimit - peakOdUsage)
    : 0;

  // 1.1 Cash Buffer Ratio: effective liquid buffer / average monthly outflow.
  // Ledger balance floored at 0 (CC/OD), plus sweep deposits, plus 50% of undrawn DP.
  const cashBufferRatio = isNum(avgDailyClosingBalance) && avgMonthlyDebit > 0
    ? round2((Math.max(0, avgDailyClosingBalance) + sweepDeposits + availableDrawingPower * 0.5) / avgMonthlyDebit)
    : null;

  // 1.2 Minimum Cash Buffer Days: lowest liquid position / average daily outflow
  const minimumCashBufferDays = isNum(lowestBalance) && avgDailyOutflow > 0
    ? Math.round((Math.max(0, lowestBalance) + sweepDeposits + availableDrawingPower * 0.4) / avgDailyOutflow)
    : null;

  // 1.3 Overdraft / Limit Utilization (0 when the statement shows no facility)
  const overdraftLimitUtilization = !isNum(sanctionedOdLimit)
    ? null
    : sanctionedOdLimit > 0
      ? (isNum(peakOdUsage) ? pct2(peakOdUsage, sanctionedOdLimit) : null)
      : 0;

  let liquidityStatus = NOT_ASSESSED;
  if (isNum(cashBufferRatio)) {
    const days = isNum(minimumCashBufferDays) ? minimumCashBufferDays : Infinity;
    const od = isNum(overdraftLimitUtilization) ? overdraftLimitUtilization : 0;
    liquidityStatus = (cashBufferRatio < 0.15 || days < 7 || od > 75) ? 'STRESSED'
      : (cashBufferRatio < 0.25 || days < 12 || od > 55) ? 'ADEQUATE'
      : 'EXCELLENT';
  }

  // =========================================================================
  // PILLAR 2: REVENUE & BUSINESS MOMENTUM
  // =========================================================================
  const annualizedRevenueRunRate = isNum(avgMonthlyCredit) ? Math.round(avgMonthlyCredit * 12) : null;

  let revenueGrowthRate = null;
  if (monthlyCredits && monthlyCredits.length >= 6) {
    const recent3M = monthlyCredits.slice(-3).reduce((a, b) => a + b, 0);
    const prev3M = monthlyCredits.slice(-6, -3).reduce((a, b) => a + b, 0);
    revenueGrowthRate = prev3M > 0 ? pct2(recent3M - prev3M, prev3M) : null;
  } else if (monthlyCredits && monthlyCredits.length >= 2) {
    const recent = monthlyCredits[monthlyCredits.length - 1];
    const prev = monthlyCredits[0];
    revenueGrowthRate = prev > 0 ? pct2(recent - prev, prev) : null;
  }

  // 2.3 GST vs Bank Credit Reconciliation: GSTR-1 outward taxable / bank credits
  const gstVsBankReconciliation = isNum(gstr1OutwardTaxable) && totalCredits > 0
    ? round2(gstr1OutwardTaxable / totalCredits)
    : null;

  // 2.4 GSTR-1 vs GSTR-3B Gap: (declared - paid) / declared
  const gstr1VsGstr3bGap = gstr1DeclaredTax > 0 && isNum(gstr3bTaxPaid)
    ? pct2(gstr1DeclaredTax - gstr3bTaxPaid, gstr1DeclaredTax)
    : null;

  const revenueTrajectory = !isNum(revenueGrowthRate) ? NOT_ASSESSED
    : revenueGrowthRate >= 10 ? 'EXPANDING' : revenueGrowthRate >= 0 ? 'STABLE' : 'CONTRACTING';

  // =========================================================================
  // PILLAR 3: CASH FLOW STABILITY & VOLATILITY (needs >= 2 months)
  // =========================================================================
  const twoMonths = Boolean(monthlyCredits && monthlyCredits.length >= 2);
  const creditCoefficientOfVariation = twoMonths && avgMonthlyCredit > 0
    ? round2(calculateStdDev(monthlyCredits) / avgMonthlyCredit)
    : null;

  let maxConsecutiveLowMonths = null;
  if (twoMonths) {
    const medianCredit = calculateMedian(monthlyCredits);
    let run = 0;
    maxConsecutiveLowMonths = 0;
    for (const cred of monthlyCredits) {
      run = cred < 0.5 * medianCredit ? run + 1 : 0;
      if (run > maxConsecutiveLowMonths) maxConsecutiveLowMonths = run;
    }
  }

  const effectiveInwardBounces = isNum(solvencyBouncesVerified) ? solvencyBouncesVerified : inwardBounces;
  const inwardBounceRate = isNum(effectiveInwardBounces) && totalDebitAttempts > 0
    ? pct2(effectiveInwardBounces, totalDebitAttempts)
    : null;
  const outwardBounceRate = isNum(outwardBounces) && totalOutwardAttempts > 0
    ? pct2(outwardBounces, totalOutwardAttempts)
    : null;

  // Status from CV; the inward bounce rate tightens it only when it is known.
  let stabilityStatus = NOT_ASSESSED;
  if (isNum(creditCoefficientOfVariation)) {
    const cv = creditCoefficientOfVariation;
    if (isNum(inwardBounceRate)) {
      stabilityStatus = cv < 0.25 && inwardBounceRate === 0 ? 'ROBUST'
        : cv < 0.40 && inwardBounceRate < 2.0 ? 'MODERATE' : 'VOLATILE';
    } else {
      stabilityStatus = cv < 0.25 ? 'ROBUST' : cv < 0.40 ? 'MODERATE' : 'VOLATILE';
    }
  }

  // =========================================================================
  // PILLAR 4: DEBT SERVICE & LEVERAGE
  // An EMI of 0 that is not a data gap means no debt service was observed in
  // the statement; DSCP is then undefined (null), not a large sentinel.
  // =========================================================================
  const noDebtServiceObserved = monthlyEmiObligations === 0;
  const monthlyFreeCashFlow = isNum(avgMonthlyCredit) && isNum(avgMonthlyDebit)
    ? Math.max(0, avgMonthlyCredit - avgMonthlyDebit)
    : null;
  const debtServiceCoverageProxy = monthlyEmiObligations > 0 && isNum(monthlyFreeCashFlow)
    ? round2(monthlyFreeCashFlow / monthlyEmiObligations)
    : null;
  const interestEmiBurdenRatio = isNum(monthlyEmiObligations) && totalCredits > 0
    ? pct2(monthlyEmiObligations * numMonths, totalCredits)
    : null;
  const newBorrowingVelocity = newBorrowingCount6M;

  let leverageTier = NOT_ASSESSED;
  if (noDebtServiceObserved) {
    leverageTier = 'NO_DEBT_SERVICE_OBSERVED';
  } else if (isNum(debtServiceCoverageProxy) && isNum(interestEmiBurdenRatio)) {
    leverageTier = interestEmiBurdenRatio < 15 && debtServiceCoverageProxy >= 1.5 ? 'LOW_LEVERAGE'
      : interestEmiBurdenRatio < 35 && debtServiceCoverageProxy >= 1.0 ? 'MANAGEABLE'
      : 'HEAVILY_LEVERAGED';
  }

  // =========================================================================
  // PILLAR 5: OPERATIONAL & BEHAVIOURAL FLAGS (only from a transaction list)
  // =========================================================================
  const hasTransactions = transactions.length > 0;
  let salaryTransactions = 0;
  let utilityTransactions = 0;
  let totalCashWithdrawals = 0;
  const counterpartyOccurrences = {};
  let circularTransactionsDetected = 0;
  let oddHourHighValueCount = 0;

  for (const tx of transactions) {
    if (!tx || typeof tx !== 'object') continue;
    const nar = String(tx.narration || '').toUpperCase();
    const amt = Number(tx.amount) || 0;

    if (nar.includes('SALARY') || nar.includes('PAYROLL') || nar.includes('STAFF')) salaryTransactions++;
    if (nar.includes('ELECTRICITY') || nar.includes('RENT') || nar.includes('UTILITY') || nar.includes('BESCOM') || nar.includes('MAHADISCOM')) {
      utilityTransactions++;
    }
    if (tx.type === 'DEBIT' && (nar.includes('ATM') || nar.includes('SELF') || nar.includes('CASH WDL'))) {
      totalCashWithdrawals += amt;
    }

    // Circular transactions (counterparty in both credits & debits)
    const party = tx.counterparty || nar.split('/')[2] || null;
    if (party && party.length > 3) {
      if (!counterpartyOccurrences[party]) counterpartyOccurrences[party] = { credits: 0, debits: 0 };
      if (tx.type === 'CREDIT') counterpartyOccurrences[party].credits += amt;
      if (tx.type === 'DEBIT') counterpartyOccurrences[party].debits += amt;
    }

    // Odd-hour / weekend transactions (>= ₹50,000 between 11PM and 5AM, or weekend)
    if (tx.date && amt >= 50000) {
      const txDate = new Date(tx.date);
      if (!Number.isNaN(txDate.getTime())) {
        const hour = txDate.getHours();
        const day = txDate.getDay();
        if (hour >= 23 || hour <= 5 || day === 0 || day === 6) oddHourHighValueCount++;
      }
    }
  }
  for (const p in counterpartyOccurrences) {
    const { credits, debits } = counterpartyOccurrences[p];
    if (credits > 50000 && debits > 50000) circularTransactionsDetected++;
  }

  const months = numMonths || 1;
  const salaryStaffPaymentConsistency = !hasTransactions ? NOT_ASSESSED
    : salaryTransactions >= months * 0.8 ? 'CONSISTENT (Monthly payroll verified)'
    : salaryTransactions > 0 ? 'IRREGULAR (Sporadic payroll timestamps)'
    : 'NOT_DETECTED (Informal/cash payout)';

  const utilityRentPaymentRegularity = !hasTransactions ? NOT_ASSESSED
    : utilityTransactions >= months * 0.6 ? 'REGULAR (On-time utility payments)'
    : utilityTransactions > 0 ? 'PARTIAL (Occasional utility payments)'
    : 'NOT_DETECTED';

  // Reported only when withdrawals were actually found in the transaction list.
  const highValueCashWithdrawalPct = hasTransactions && totalCashWithdrawals > 0 && totalDebits > 0
    ? pct2(totalCashWithdrawals, totalDebits)
    : null;

  const circularTransactionRisk = !hasTransactions ? NOT_ASSESSED
    : circularTransactionsDetected > 0 ? 'HIGH (Circular counterparty rotation detected)'
    : 'LOW (Clean independent counterparties)';

  const suspiciousTimingFlags = !hasTransactions ? NOT_ASSESSED
    : oddHourHighValueCount > 0 ? `FLAGGED (${oddHourHighValueCount} off-hour large transactions)`
    : 'CLEAN (Normal business hour distribution)';

  // =========================================================================
  // LEGACY SUMMARY FIELDS
  // =========================================================================
  const gstrAllZeroOrMissing = [gstr1OutwardTaxable, gstr3bTaxPaid, gstr1DeclaredTax].every(v => !isNum(v) || v === 0);
  const taxCompliance = gstrAllZeroOrMissing || !isNum(gstr1VsGstr3bGap) ? NOT_ASSESSED
    : gstr1VsGstr3bGap < 3 ? 'Excellent' : gstr1VsGstr3bGap < 8 ? 'Average' : 'Poor';

  const debtServiceCapacity = noDebtServiceObserved ? 'NO_DEBT_SERVICE_OBSERVED'
    : !isNum(debtServiceCoverageProxy) ? NOT_ASSESSED
    : debtServiceCoverageProxy >= 1.5 ? 'High' : debtServiceCoverageProxy >= 1.0 ? 'Moderate' : 'Constrained';

  const hasBounces = !isNum(effectiveInwardBounces) && !isNum(outwardBounces)
    ? null
    : (effectiveInwardBounces || 0) > 0 || (outwardBounces || 0) > 0;

  const isCashFlowStable = stabilityStatus === NOT_ASSESSED ? null : (stabilityStatus === 'ROBUST' || stabilityStatus === 'MODERATE');

  // =========================================================================
  // CITATIONS (missing values are rendered as "not available")
  // =========================================================================
  const runRateText = isNum(annualizedRevenueRunRate) ? `₹${annualizedRevenueRunRate.toLocaleString('en-IN')}` : NA;
  const growthText = isNum(revenueGrowthRate) ? `${revenueGrowthRate >= 0 ? '+' : ''}${revenueGrowthRate}%` : `growth ${NA}`;
  const dscpText = noDebtServiceObserved ? 'not applicable (no EMI / debt service observed in the statement)' : fmt(debtServiceCoverageProxy, 'x');
  const citations = [
    `[Liquidity] Cash Buffer Ratio: ${fmt(cashBufferRatio, 'x')}; minimum survival buffer days: ${fmt(minimumCashBufferDays)} (OD utilization: ${fmt(overdraftLimitUtilization, '%')}).`,
    `[Revenue] Annualized Revenue Run Rate: ${runRateText}; Trajectory: ${revenueTrajectory} (${growthText}).`,
    `[Compliance] GSTR-1 outward taxable supplies to bank credit ratio: ${fmt(gstVsBankReconciliation, 'x')}; GSTR-1 vs GSTR-3B tax gap: ${fmt(gstr1VsGstr3bGap, '%')}.`,
    `[Stability] Monthly credit volatility CV: ${fmt(creditCoefficientOfVariation)}; consecutive low-credit months: ${fmt(maxConsecutiveLowMonths)}; inward bounce rate: ${fmt(inwardBounceRate, '%')}.`,
    `[Debt Service] Debt Service Coverage Proxy (DSCP): ${dscpText}; EMI burden ratio: ${fmt(interestEmiBurdenRatio, '%')}; new debt facilities: ${fmt(newBorrowingVelocity)}.`,
    `[Operational Flags] Payroll regularity: ${salaryStaffPaymentConsistency}; Cash withdrawals: ${fmt(highValueCashWithdrawalPct, '%')}; Circular flow risk: ${circularTransactionRisk}.`
  ];

  return {
    pillar1_liquidity: {
      cashBufferRatio,
      minimumCashBufferDays,
      overdraftLimitUtilization,
      status: liquidityStatus,
      benchmark: '> 0.15–0.25x (15–25 Days)'
    },
    pillar2_revenue: {
      annualizedRevenueRunRate,
      revenueGrowthRate,
      gstVsBankReconciliation,
      gstr1VsGstr3bGap,
      trajectory: revenueTrajectory,
      benchmark: 'Reconciliation ~ 1.0x, Gap < 5%'
    },
    pillar3_stability: {
      creditCoefficientOfVariation,
      consecutiveLowCreditMonths: maxConsecutiveLowMonths,
      inwardBounceRate,
      outwardBounceRate,
      status: stabilityStatus,
      benchmark: 'CV < 0.30, Bounces = 0.0%'
    },
    pillar4_leverage: {
      debtServiceCoverageProxy,
      interestEmiBurdenRatio,
      newBorrowingVelocity,
      tier: leverageTier,
      benchmark: 'DSCP > 1.50x, Burden < 20%'
    },
    pillar5_operational: {
      salaryStaffPaymentConsistency,
      utilityRentPaymentRegularity,
      highValueCashWithdrawalPct,
      circularTransactionRisk,
      suspiciousTimingFlags,
      benchmark: 'Clean Counterparties, Cash WDL < 15%'
    },
    // Backwards-compatible legacy properties for UI bridges (values may be null)
    revenueRunRate: annualizedRevenueRunRate,
    cashBufferRatio,
    isCashFlowStable,
    hasBounces,
    taxCompliance,
    debtServiceCapacity,
    citations,
    reasoning: `5-Pillar NTC evaluation: liquidity ${liquidityStatus} (cash buffer ${fmt(cashBufferRatio, 'x')}, minimum buffer days ${fmt(minimumCashBufferDays)}). Revenue trajectory ${revenueTrajectory} at ${isNum(annualizedRevenueRunRate) ? `₹${(annualizedRevenueRunRate / 100000).toFixed(1)} Lacs` : NA} run rate. Cash flow stability ${stabilityStatus} (CV ${fmt(creditCoefficientOfVariation)}). Leverage ${leverageTier} (DSCP ${dscpText}).`
  };
}

module.exports = { computeFinancialTelemetry };
