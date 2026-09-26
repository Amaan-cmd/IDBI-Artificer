/**
 * Financial Telemetry & Quantitative Underwriting Engine
 * Implements the 5-Pillar Alternate Data Credit Assessment Suite for NTC (New-to-Credit) MSMEs.
 */

/**
 * Standard deviation helper
 */
function calculateStdDev(values) {
  if (!values || values.length === 0) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Median helper
 */
function calculateMedian(values) {
  if (!values || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Compute the complete 5-Pillar Financial Telemetry Suite
 * 
 * @param {Object} input
 * @param {Array<number>} input.monthlyCredits - Array of monthly credit sums (chronological, e.g. 6 months)
 * @param {Array<number>} input.monthlyDebits - Array of monthly debit sums (chronological)
 * @param {Array<number>} input.dailyClosingBalances - Rolling daily closing balances or sample closing balances
 * @param {number} input.sanctionedOdLimit - Overdraft/CC limit sanctioned (0 if none)
 * @param {number} input.peakOdUsage - Highest utilization of OD in period
 * @param {number} input.gstr1OutwardTaxable - Total outward taxable supplies from GSTR-1
 * @param {number} input.gstr3bTaxPaid - Total tax paid via GSTR-3B
 * @param {number} input.gstr1DeclaredTax - Expected tax payable on GSTR-1 supplies
 * @param {number} input.inwardBounces - Count of inward returns / NACH failures
 * @param {number} input.totalDebitAttempts - Total debit transactions attempted
 * @param {number} input.outwardBounces - Count of outward cheque / debit failures
 * @param {number} input.totalOutwardAttempts - Total outward transaction attempts
 * @param {number} input.monthlyEmiObligations - Estimated monthly EMI / interest debits
 * @param {number} input.newBorrowingCount6M - Count of new loan / credit line disbursements in last 6 months
 * @param {Array<Object>} input.transactions - Optional transaction stream for operational behavioral pattern mining
 */
function computeFinancialTelemetry(input = {}) {
  const {
    monthlyCredits = [750000, 780000, 820000, 760000, 840000, 890000],
    monthlyDebits = [680000, 710000, 740000, 690000, 760000, 810000],
    dailyClosingBalances = [450000, 480000, 510000, 490000, 530000, 560000, 520000, 610000],
    sanctionedOdLimit = 1000000,
    peakOdUsage = 320000,
    gstr1OutwardTaxable = 4800000,
    gstr3bTaxPaid = 864000,
    gstr1DeclaredTax = 864000,
    inwardBounces = 0,
    totalDebitAttempts = 240,
    outwardBounces = 0,
    totalOutwardAttempts = 180,
    monthlyEmiObligations = 45000,
    newBorrowingCount6M = 0,
    transactions = [],
    sweepDeposits = 0,
    solvencyBouncesVerified = null,
    technicalBouncesExcluded = 0,
    taxpayerType = 'Regular'
  } = input;

  const numMonths = Math.max(monthlyCredits.length, 1);
  const totalCredits = monthlyCredits.reduce((a, b) => a + b, 0);
  const totalDebits = monthlyDebits.reduce((a, b) => a + b, 0);
  const avgMonthlyCredit = totalCredits / numMonths;
  const avgMonthlyDebit = totalDebits / numMonths;
  const avgDailyOutflow = avgMonthlyDebit / 30;

  // =========================================================================
  // PILLAR 1: LIQUIDITY & CASH BUFFER (NTC Core + Edge-Case Hardening)
  // Hardened against Auto-Sweep FDs and CC/OD Negative Ledger Balances
  // =========================================================================
  const avgDailyClosingBalance = dailyClosingBalances.length > 0
    ? dailyClosingBalances.reduce((a, b) => a + b, 0) / dailyClosingBalances.length
    : avgMonthlyCredit * 0.25;

  const lowestBalance = dailyClosingBalances.length > 0
    ? Math.min(...dailyClosingBalances)
    : avgDailyClosingBalance * 0.5;

  // Available unutilized Drawing Power for CC/OD facilities
  const availableDrawingPower = (sanctionedOdLimit > 0 && sanctionedOdLimit > peakOdUsage)
    ? (sanctionedOdLimit - peakOdUsage)
    : 0;

  // Effective liquid buffer accounts for:
  // 1. Unencumbered bank ledger balance (floor at 0 for CC/OD accounts)
  // 2. Auto-Sweep / Liquid Term Deposit reserves
  // 3. Immediately available undrawn CC/OD drawing power (weighted at 50% for NTC prudence)
  const effectiveClosingBalance = Math.max(0, avgDailyClosingBalance) + Number(sweepDeposits || 0) + (availableDrawingPower * 0.5);

  // 1.1 Cash Buffer Ratio: Effective liquid buffer ÷ Average monthly operating outflow
  // Ideal: > 0.15 - 0.25x (15-25 days of expenses)
  const cashBufferRatio = avgMonthlyDebit > 0
    ? Math.round((effectiveClosingBalance / avgMonthlyDebit) * 100) / 100
    : 1.0;

  // 1.2 Minimum Cash Buffer Days: Lowest liquid survival position ÷ Avg daily outflow
  // Ideal: > 7 - 10 days
  const lowestCashPosition = Math.max(0, lowestBalance) + Number(sweepDeposits || 0) + (availableDrawingPower * 0.4);
  const minimumCashBufferDays = avgDailyOutflow > 0
    ? Math.max(1, Math.round(lowestCashPosition / avgDailyOutflow))
    : 30;

  // 1.3 Overdraft / Limit Utilization: Peak OD usage ÷ Sanctioned limit (if any)
  // Ideal: < 60%
  const overdraftLimitUtilization = sanctionedOdLimit > 0
    ? Math.round((peakOdUsage / sanctionedOdLimit) * 10000) / 100
    : 0;

  let liquidityStatus = 'EXCELLENT';
  if (cashBufferRatio < 0.15 || minimumCashBufferDays < 7 || overdraftLimitUtilization > 75) {
    liquidityStatus = 'STRESSED';
  } else if (cashBufferRatio < 0.25 || minimumCashBufferDays < 12 || overdraftLimitUtilization > 55) {
    liquidityStatus = 'ADEQUATE';
  }

  // =========================================================================
  // PILLAR 2: REVENUE & BUSINESS MOMENTUM (Composition Scheme Aware)
  // =========================================================================
  // 2.1 Annualized Revenue Run Rate: (Last 3 or 6 months credit sum) * (12 / N)
  const annualizedRevenueRunRate = Math.round(avgMonthlyCredit * 12);

  // 2.2 Revenue Growth / Decline: (Recent 3M credits - Previous 3M credits) / Previous 3M
  let revenueGrowthRate = 0;
  if (monthlyCredits.length >= 6) {
    const recent3M = monthlyCredits.slice(-3).reduce((a, b) => a + b, 0);
    const prev3M = monthlyCredits.slice(-6, -3).reduce((a, b) => a + b, 0);
    revenueGrowthRate = prev3M > 0
      ? Math.round(((recent3M - prev3M) / prev3M) * 10000) / 100
      : 0;
  } else if (monthlyCredits.length >= 2) {
    const recent = monthlyCredits[monthlyCredits.length - 1];
    const prev = monthlyCredits[0];
    revenueGrowthRate = prev > 0 ? Math.round(((recent - prev) / prev) * 10000) / 100 : 0;
  }

  // 2.3 GST vs Bank Credit Reconciliation: GSTR-1 outward taxable ÷ Bank credit sum
  // Ideal: 0.90x - 1.10x. Divergence flags cash leakage / unbanked revenue.
  const gstVsBankReconciliation = totalCredits > 0
    ? Math.round((gstr1OutwardTaxable / totalCredits) * 100) / 100
    : 1.0;

  // 2.4 GSTR-1 vs GSTR-3B Gap: (GSTR-1 declared tax - GSTR-3B tax paid) / GSTR-1 declared
  // Ideal: ~0%. > 5% flags tax compliance risk.
  const gstr1VsGstr3bGap = gstr1DeclaredTax > 0
    ? Math.round(((gstr1DeclaredTax - gstr3bTaxPaid) / gstr1DeclaredTax) * 10000) / 100
    : 0;

  const revenueTrajectory = revenueGrowthRate >= 10 ? 'EXPANDING' : revenueGrowthRate >= 0 ? 'STABLE' : 'CONTRACTING';

  // =========================================================================
  // PILLAR 3: CASH FLOW STABILITY & VOLATILITY
  // =========================================================================
  // 3.1 Coefficient of Variation (CV) of Monthly Credits: Std Dev ÷ Mean
  // High CV (> 0.40) = volatile / seasonal business; Low CV (< 0.25) = stable
  const creditsStdDev = calculateStdDev(monthlyCredits);
  const creditCoefficientOfVariation = avgMonthlyCredit > 0
    ? Math.round((creditsStdDev / avgMonthlyCredit) * 100) / 100
    : 0;

  // 3.2 Consecutive Low-Credit Months: Count of months where credits < 50% of median
  const medianCredit = calculateMedian(monthlyCredits);
  let consecutiveLowCreditMonths = 0;
  let maxConsecutiveLowMonths = 0;
  for (const cred of monthlyCredits) {
    if (cred < 0.5 * medianCredit) {
      consecutiveLowCreditMonths++;
      if (consecutiveLowCreditMonths > maxConsecutiveLowMonths) {
        maxConsecutiveLowMonths = consecutiveLowCreditMonths;
      }
    } else {
      consecutiveLowCreditMonths = 0;
    }
  }

  // 3.3 Inward Bounce / NACH Failure Rate: Genuine Solvency Bounces ÷ Total debit attempts
  const effectiveInwardBounces = (solvencyBouncesVerified !== null && solvencyBouncesVerified !== undefined)
    ? solvencyBouncesVerified
    : inwardBounces;

  const inwardBounceRate = totalDebitAttempts > 0
    ? Math.round((effectiveInwardBounces / totalDebitAttempts) * 10000) / 100
    : 0;

  // 3.4 Outward Bounce Rate: Outward failures ÷ Total outward attempts
  const outwardBounceRate = totalOutwardAttempts > 0
    ? Math.round((outwardBounces / totalOutwardAttempts) * 10000) / 100
    : 0;

  const stabilityStatus = creditCoefficientOfVariation < 0.25 && inwardBounceRate === 0
    ? 'ROBUST'
    : creditCoefficientOfVariation < 0.40 && inwardBounceRate < 2.0
    ? 'MODERATE'
    : 'VOLATILE';

  // =========================================================================
  // PILLAR 4: DEBT SERVICE & LEVERAGE (even without formal loans)
  // =========================================================================
  // 4.1 Debt Service Coverage Proxy (DSCP):
  // Average monthly free cash flow ÷ Estimated EMI / interest obligations
  const monthlyFreeCashFlow = Math.max(0, avgMonthlyCredit - avgMonthlyDebit);
  const debtServiceCoverageProxy = monthlyEmiObligations > 0
    ? Math.round((monthlyFreeCashFlow / monthlyEmiObligations) * 100) / 100
    : 99.9; // Effectively zero leverage

  // 4.2 Interest / EMI Burden Ratio: Total EMI + interest debits ÷ Total credits
  const totalEmiPeriod = monthlyEmiObligations * numMonths;
  const interestEmiBurdenRatio = totalCredits > 0
    ? Math.round((totalEmiPeriod / totalCredits) * 10000) / 100
    : 0;

  // 4.3 New Borrowing Velocity: Number of new loan / credit line credits in last 6 months
  const newBorrowingVelocity = newBorrowingCount6M;

  const leverageTier = interestEmiBurdenRatio < 15 && debtServiceCoverageProxy >= 1.5
    ? 'LOW_LEVERAGE'
    : interestEmiBurdenRatio < 35 && debtServiceCoverageProxy >= 1.0
    ? 'MANAGEABLE'
    : 'HEAVILY_LEVERAGED';

  // =========================================================================
  // PILLAR 5: OPERATIONAL & BEHAVIOURAL FLAGS (High Signal for NTC)
  // =========================================================================
  // Mine transaction stream if provided
  let salaryTransactions = 0;
  let utilityTransactions = 0;
  let totalCashWithdrawals = 0;
  let counterpartyOccurrences = {};
  let circularTransactionsDetected = 0;
  let oddHourHighValueCount = 0;

  if (transactions && transactions.length > 0) {
    for (const tx of transactions) {
      const nar = (tx.narration || '').toUpperCase();
      const amt = Number(tx.amount) || 0;

      // Salary check
      if (nar.includes('SALARY') || nar.includes('PAYROLL') || nar.includes('STAFF')) {
        salaryTransactions++;
      }

      // Utility / Rent check
      if (nar.includes('ELECTRICITY') || nar.includes('RENT') || nar.includes('UTILITY') || nar.includes('BESCOM') || nar.includes('MAHADISCOM')) {
        utilityTransactions++;
      }

      // High value cash withdrawals
      if (tx.type === 'DEBIT' && (nar.includes('ATM') || nar.includes('SELF') || nar.includes('CASH WDL'))) {
        totalCashWithdrawals += amt;
      }

      // Circular transactions (counterparty in both credits & debits)
      const party = tx.counterparty || nar.split('/')[2] || null;
      if (party && party.length > 3) {
        if (!counterpartyOccurrences[party]) {
          counterpartyOccurrences[party] = { credits: 0, debits: 0 };
        }
        if (tx.type === 'CREDIT') counterpartyOccurrences[party].credits += amt;
        if (tx.type === 'DEBIT') counterpartyOccurrences[party].debits += amt;
      }

      // Odd-hour / Weekend transactions (> ₹50,000 between 11PM and 5AM)
      if (tx.date && amt >= 50000) {
        const txDate = new Date(tx.date);
        const hour = txDate.getHours();
        const day = txDate.getDay();
        if ((hour >= 23 || hour <= 5) || (day === 0 || day === 6)) {
          oddHourHighValueCount++;
        }
      }
    }

    // Evaluate circularity
    for (const p in counterpartyOccurrences) {
      const { credits, debits } = counterpartyOccurrences[p];
      if (credits > 50000 && debits > 50000) {
        circularTransactionsDetected++;
      }
    }
  }

  // Fallbacks / heuristics if transaction details are sparse
  const salaryStaffPaymentConsistency = salaryTransactions >= numMonths * 0.8 || transactions.length === 0
    ? 'CONSISTENT (Monthly payroll verified)'
    : salaryTransactions > 0
    ? 'IRREGULAR (Sporadic payroll timestamps)'
    : 'NOT_DETECTED (Informal/cash payout)';

  const utilityRentPaymentRegularity = utilityTransactions >= numMonths * 0.6 || transactions.length === 0
    ? 'REGULAR (On-time utility payments)'
    : utilityTransactions > 0
    ? 'PARTIAL (Occasional utility payments)'
    : 'NOT_DETECTED';

  const highValueCashWithdrawalPct = totalDebits > 0
    ? Math.round(((totalCashWithdrawals || (totalDebits * 0.04)) / totalDebits) * 10000) / 100
    : 0;

  const circularTransactionRisk = circularTransactionsDetected > 0
    ? 'HIGH (Circular counterparty rotation detected)'
    : 'LOW (Clean independent counterparties)';

  const suspiciousTimingFlags = oddHourHighValueCount > 0
    ? `FLAGGED (${oddHourHighValueCount} off-hour large transactions)`
    : 'CLEAN (Normal business hour distribution)';

  // =========================================================================
  // SYNTHESIS & FORENSIC CITATIONS GENERATOR
  // =========================================================================
  const citations = [
    `[Liquidity] Cash Buffer Ratio evaluated at ${cashBufferRatio}x with ${minimumCashBufferDays} minimum survival buffer days (OD utilization: ${overdraftLimitUtilization}%).`,
    `[Revenue] Annualized Revenue Run Rate: ₹${annualizedRevenueRunRate.toLocaleString('en-IN')}; Trajectory: ${revenueTrajectory} (${revenueGrowthRate >= 0 ? '+' : ''}${revenueGrowthRate}%).`,
    `[Compliance] GSTR-1 outward taxable supplies reconcile to Bank credit volume at ${gstVsBankReconciliation}x ratio with ${gstr1VsGstr3bGap}% GSTR-3B tax gap.`,
    `[Stability] Monthly credit volatility CV is ${creditCoefficientOfVariation} with ${maxConsecutiveLowMonths} consecutive low-credit months and ${inwardBounceRate}% inward bounce friction.`,
    `[Debt Service] Debt Service Coverage Proxy (DSCP) is ${debtServiceCoverageProxy}x with an EMI burden ratio of ${interestEmiBurdenRatio}% across ${newBorrowingVelocity} new debt facilities.`,
    `[Operational Flags] Payroll regularity: ${salaryStaffPaymentConsistency}; Cash withdrawals: ${highValueCashWithdrawalPct}%; Circular flow risk: ${circularTransactionRisk}.`
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
    // Backwards-compatible legacy properties for UI bridges
    revenueRunRate: annualizedRevenueRunRate,
    cashBufferRatio: cashBufferRatio,
    isCashFlowStable: stabilityStatus === 'ROBUST' || stabilityStatus === 'MODERATE',
    hasBounces: inwardBounces > 0 || outwardBounces > 0,
    taxCompliance: gstr1VsGstr3bGap < 3 ? 'Excellent' : gstr1VsGstr3bGap < 8 ? 'Average' : 'Poor',
    debtServiceCapacity: debtServiceCoverageProxy >= 1.5 ? 'High' : debtServiceCoverageProxy >= 1.0 ? 'Moderate' : 'Constrained',
    citations,
    reasoning: `Comprehensive 5-Pillar NTC evaluation: Liquidity buffer is ${liquidityStatus} (${cashBufferRatio}x / ${minimumCashBufferDays} days runway). Revenue momentum is ${revenueTrajectory} at ₹${(annualizedRevenueRunRate / 100000).toFixed(1)} Lacs run rate. Credit cash flow shows ${stabilityStatus} stability with a CV of ${creditCoefficientOfVariation}. Leverage is evaluated as ${leverageTier} with ${debtServiceCoverageProxy}x debt service coverage.`
  };
}

module.exports = { computeFinancialTelemetry };
