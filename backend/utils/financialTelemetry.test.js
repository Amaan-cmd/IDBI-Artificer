const { computeFinancialTelemetry } = require('./financialTelemetry');

console.log('[Test] Running deterministic 5-Pillar Financial Telemetry checks...');

const result = computeFinancialTelemetry({
  monthlyCredits: [750000, 780000, 820000, 760000, 840000, 890000],
  monthlyDebits: [680000, 710000, 740000, 690000, 760000, 810000],
  dailyClosingBalances: [450000, 480000, 510000, 490000, 530000, 560000, 520000, 610000],
  sanctionedOdLimit: 1000000,
  peakOdUsage: 320000,
  gstr1OutwardTaxable: 4800000,
  gstr3bTaxPaid: 864000,
  gstr1DeclaredTax: 864000,
  inwardBounces: 0,
  totalDebitAttempts: 240,
  outwardBounces: 0,
  totalOutwardAttempts: 180,
  monthlyEmiObligations: 45000,
  newBorrowingCount6M: 0,
  transactions: [
    { date: '2026-05-28T10:00:00Z', type: 'DEBIT', amount: 120000, narration: 'IMPS/Payroll/Salary May' },
    { date: '2026-05-15T11:00:00Z', type: 'DEBIT', amount: 15000, narration: 'NEFT/Electricity/BESCOM' },
    { date: '2026-05-16T12:00:00Z', type: 'DEBIT', amount: 35000, narration: 'ATM/Cash WDL/Self' }
  ]
});

console.log('--- PILLAR 1: LIQUIDITY & CASH BUFFER ---');
console.log(result.pillar1_liquidity);

console.log('--- PILLAR 2: REVENUE & MOMENTUM ---');
console.log(result.pillar2_revenue);

console.log('--- PILLAR 3: STABILITY & VOLATILITY ---');
console.log(result.pillar3_stability);

console.log('--- PILLAR 4: DEBT SERVICE & LEVERAGE ---');
console.log(result.pillar4_leverage);

console.log('--- PILLAR 5: OPERATIONAL & BEHAVIOURAL FLAGS ---');
console.log(result.pillar5_operational);

console.log('\n--- CITATIONS ---');
result.citations.forEach(c => console.log(c));

console.log('\n[Test] ALL 5 PILLARS COMPUTED SUCCESSFULLY.');
