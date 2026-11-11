const test = require('node:test');
const assert = require('node:assert/strict');
const { computeFinancialTelemetry } = require('../utils/financialTelemetry');

const FULL = {
  monthlyCredits: [500000, 520000, 510000, 530000, 540000, 550000],
  monthlyDebits: [450000, 460000, 455000, 470000, 480000, 490000],
  dailyClosingBalances: [200000, 210000, 220000],
  sanctionedOdLimit: 0, peakOdUsage: 0, gstr1OutwardTaxable: 3150000, gstr3bTaxPaid: 100000, gstr1DeclaredTax: 100000,
  inwardBounces: 0, totalDebitAttempts: 100, outwardBounces: 0, totalOutwardAttempts: 80, monthlyEmiObligations: 10000,
  newBorrowingCount6M: 0,
  transactions: [
    { date: '2026-05-28T10:00:00Z', type: 'DEBIT', amount: 120000, narration: 'IMPS/Payroll/Salary May' },
    { date: '2026-05-15T11:00:00Z', type: 'DEBIT', amount: 15000, narration: 'NEFT/Electricity/BESCOM' },
    { date: '2026-05-16T12:00:00Z', type: 'DEBIT', amount: 35000, narration: 'ATM/Cash WDL/Self' }
  ],
  dataGaps: []
};

const PILLAR_KEYS = {
  pillar1_liquidity: ['cashBufferRatio', 'minimumCashBufferDays', 'overdraftLimitUtilization', 'status', 'benchmark'],
  pillar2_revenue: ['annualizedRevenueRunRate', 'revenueGrowthRate', 'gstVsBankReconciliation', 'gstr1VsGstr3bGap', 'trajectory', 'benchmark'],
  pillar3_stability: ['creditCoefficientOfVariation', 'consecutiveLowCreditMonths', 'inwardBounceRate', 'outwardBounceRate', 'status', 'benchmark'],
  pillar4_leverage: ['debtServiceCoverageProxy', 'interestEmiBurdenRatio', 'newBorrowingVelocity', 'tier', 'benchmark'],
  pillar5_operational: ['salaryStaffPaymentConsistency', 'utilityRentPaymentRegularity', 'highValueCashWithdrawalPct', 'circularTransactionRisk', 'suspiciousTimingFlags', 'benchmark']
};
const TOP_KEYS = ['revenueRunRate', 'cashBufferRatio', 'isCashFlowStable', 'hasBounces', 'taxCompliance', 'debtServiceCapacity', 'citations', 'reasoning'];

function assertShape(m) {
  for (const [p, keys] of Object.entries(PILLAR_KEYS)) {
    for (const k of keys) assert.ok(k in m[p], `${p}.${k} present`);
  }
  for (const k of TOP_KEYS) assert.ok(k in m, `${k} present`);
}

function assertNoNullText(m) {
  const text = [...m.citations, m.reasoning].join(' ');
  assert.ok(!/\bnull\b|NaN|undefined|Infinity/.test(text), `no null/NaN text: ${text}`);
}

const FABRICATED = ['750000', '7,50,000', '4800000', '864000', '45000', '99.9', '1000000'];

test('empty input invents nothing and keeps every key', () => {
  const m = computeFinancialTelemetry({});
  assertShape(m);
  assertNoNullText(m);
  const s = JSON.stringify(m);
  for (const f of FABRICATED) assert.ok(!s.includes(f), `must not contain ${f}`);
  assert.equal(m.revenueRunRate, null);
  assert.equal(m.cashBufferRatio, null);
  assert.equal(m.pillar1_liquidity.minimumCashBufferDays, null);
  assert.equal(m.pillar1_liquidity.status, 'NOT_ASSESSED');
  assert.equal(m.pillar2_revenue.revenueGrowthRate, null);
  assert.equal(m.pillar2_revenue.trajectory, 'NOT_ASSESSED');
  assert.equal(m.pillar3_stability.creditCoefficientOfVariation, null);
  assert.equal(m.pillar3_stability.status, 'NOT_ASSESSED');
  assert.equal(m.pillar4_leverage.debtServiceCoverageProxy, null);
  assert.equal(m.pillar4_leverage.tier, 'NOT_ASSESSED');
  assert.equal(m.taxCompliance, 'NOT_ASSESSED');
  assert.equal(m.isCashFlowStable, null);
  assert.equal(m.hasBounces, null);
});

test('no balance series: buffer metrics are null, not 25% of credits', () => {
  const m = computeFinancialTelemetry({ ...FULL, dailyClosingBalances: [], dataGaps: ['dailyClosingBalances'] });
  assert.equal(m.pillar1_liquidity.cashBufferRatio, null);
  assert.equal(m.pillar1_liquidity.minimumCashBufferDays, null);
  assert.equal(m.cashBufferRatio, null);
  assert.equal(m.pillar1_liquidity.status, 'NOT_ASSESSED');
  assertNoNullText(m);
});

test('no debits: buffer ratio and days are null, not 1.0 / 30', () => {
  const m = computeFinancialTelemetry({ ...FULL, monthlyDebits: [], dataGaps: ['monthlyDebits'] });
  assert.equal(m.pillar1_liquidity.cashBufferRatio, null);
  assert.equal(m.pillar1_liquidity.minimumCashBufferDays, null);
  assertNoNullText(m);
});

test('EMI genuinely zero: no DSCP sentinel, tier labels the observation', () => {
  const m = computeFinancialTelemetry({ ...FULL, monthlyEmiObligations: 0 });
  assert.equal(m.pillar4_leverage.debtServiceCoverageProxy, null);
  assert.equal(m.pillar4_leverage.tier, 'NO_DEBT_SERVICE_OBSERVED');
  assert.equal(m.pillar4_leverage.interestEmiBurdenRatio, 0);
  assert.equal(m.debtServiceCapacity, 'NO_DEBT_SERVICE_OBSERVED');
  assert.ok(!JSON.stringify(m).includes('99.9'));
  assertNoNullText(m);
});

test('EMI in dataGaps: DSCP and burden are null, tier NOT_ASSESSED', () => {
  const m = computeFinancialTelemetry({ ...FULL, monthlyEmiObligations: 0, dataGaps: ['monthlyEmiObligations'] });
  assert.equal(m.pillar4_leverage.debtServiceCoverageProxy, null);
  assert.equal(m.pillar4_leverage.interestEmiBurdenRatio, null);
  assert.equal(m.pillar4_leverage.tier, 'NOT_ASSESSED');
  assert.equal(m.debtServiceCapacity, 'NOT_ASSESSED');
});

test('no cash withdrawals in the transaction list: percentage is null, not 4% of debits', () => {
  const m = computeFinancialTelemetry({ ...FULL, transactions: FULL.transactions.slice(0, 2) });
  assert.equal(m.pillar5_operational.highValueCashWithdrawalPct, null);
});

test('cash withdrawals found are reported from the real amount', () => {
  const m = computeFinancialTelemetry(FULL);
  const totalDebits = FULL.monthlyDebits.reduce((a, b) => a + b, 0);
  assert.equal(m.pillar5_operational.highValueCashWithdrawalPct, Math.round((35000 / totalDebits) * 10000) / 100);
});

test('no transactions: payroll, utilities, circularity and timing are NOT_ASSESSED', () => {
  const m = computeFinancialTelemetry({ ...FULL, transactions: [], dataGaps: ['transactions'] });
  const p5 = m.pillar5_operational;
  assert.equal(p5.salaryStaffPaymentConsistency, 'NOT_ASSESSED');
  assert.equal(p5.utilityRentPaymentRegularity, 'NOT_ASSESSED');
  assert.equal(p5.circularTransactionRisk, 'NOT_ASSESSED');
  assert.equal(p5.suspiciousTimingFlags, 'NOT_ASSESSED');
  assert.equal(p5.highValueCashWithdrawalPct, null);
});

test('GSTR figures all zero or in dataGaps: tax compliance NOT_ASSESSED', () => {
  const gaps = ['gstr1OutwardTaxable', 'gstr3bTaxPaid', 'gstr1DeclaredTax'];
  const zeros = { ...FULL, gstr1OutwardTaxable: 0, gstr3bTaxPaid: 0, gstr1DeclaredTax: 0 };
  assert.equal(computeFinancialTelemetry(zeros).taxCompliance, 'NOT_ASSESSED');
  const gapped = computeFinancialTelemetry({ ...zeros, dataGaps: gaps });
  assert.equal(gapped.taxCompliance, 'NOT_ASSESSED');
  assert.equal(gapped.pillar2_revenue.gstVsBankReconciliation, null);
  assert.equal(gapped.pillar2_revenue.gstr1VsGstr3bGap, null);
  assertNoNullText(gapped);
});

test('fields listed in dataGaps are ignored even when a 0 placeholder is present', () => {
  const m = computeFinancialTelemetry({ ...FULL, totalDebitAttempts: 0, inwardBounces: 0, dataGaps: ['totalDebitAttempts', 'inwardBounces'] });
  assert.equal(m.pillar3_stability.inwardBounceRate, null);
});

test('a single month of credits yields no growth or volatility figure', () => {
  const m = computeFinancialTelemetry({ ...FULL, monthlyCredits: [500000], monthlyDebits: [400000] });
  assert.equal(m.pillar2_revenue.revenueGrowthRate, null);
  assert.equal(m.pillar3_stability.creditCoefficientOfVariation, null);
  assert.equal(m.revenueRunRate, 6000000);
});

test('complete input computes every metric as before', () => {
  const m = computeFinancialTelemetry(FULL);
  assertShape(m);
  assertNoNullText(m);
  assert.equal(m.revenueRunRate, 6300000);
  assert.equal(typeof m.cashBufferRatio, 'number');
  assert.equal(typeof m.pillar1_liquidity.minimumCashBufferDays, 'number');
  assert.equal(m.pillar4_leverage.debtServiceCoverageProxy, 5.75);
  assert.equal(m.pillar2_revenue.gstVsBankReconciliation, 1);
  assert.equal(m.pillar2_revenue.gstr1VsGstr3bGap, 0);
  assert.equal(m.taxCompliance, 'Excellent');
  assert.equal(m.pillar3_stability.inwardBounceRate, 0);
  assert.equal(m.hasBounces, false);
  assert.match(m.pillar5_operational.salaryStaffPaymentConsistency, /IRREGULAR/);
});
