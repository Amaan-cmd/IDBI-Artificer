const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const Module = require('module');

// Stub every network-facing dependency before the agent loads: no LLM, no
// registry provider, no Azure Table store.
function stub(relPath, exports) {
  const filename = require.resolve(path.join(__dirname, '..', relPath));
  const mod = new Module(filename);
  mod.filename = filename;
  mod.loaded = true;
  mod.exports = exports;
  require.cache[filename] = mod;
  return exports;
}

const registryCalls = [];
stub('services/registry/registryService', {
  getRegistryReport: async (gstin) => { registryCalls.push(gstin); return { gstin, gst: { status: 'unavailable' } }; }
});
const llmCalls = [];
stub('utils/grokClient', { callGrok: async () => { llmCalls.push('grok'); throw new Error('offline'); } });
stub('utils/googleGemini', { callGemini: async () => { llmCalls.push('gemini'); throw new Error('offline'); } });
stub('utils/nemoGuardrails', { applyGuardrails: async (s, u, fn) => fn() });

delete process.env.DEMO_MODE;
const { ingestAlternateData, extractHeuristicFinancials } = require('../agents/ingestionAgent');

async function quiet(fn) {
  const { log, warn } = console;
  console.log = console.warn = () => {};
  try { return await fn(); } finally { Object.assign(console, { log, warn }); }
}

const GSTIN = '27AAACR5055K1Z7';

const STATEMENT = `HDFC BANK - Account Statement
Account Name: Real Widgets Private Limited
GSTIN: ${GSTIN}
Opening Balance: Rs. 1,20,000.00
Month        Total Credits   Total Debits   Closing Balance
Apr-2025     5,10,000.00     4,90,000.00    1,40,000.00
May-2025     5,40,000.00     5,20,000.00    1,60,000.00
Jun-2025     5,25,000.00     5,30,000.00    1,55,000.00
Closing Balance: Rs. 1,55,000.00
`;

test('heuristic throws when the statement has no labelled figures', () => {
  const text = 'Some letter 12,34,567 and 2,50,000 and 3,10,000 and 4,00,000 and 5,00,000 and 6,00,000 and 7,00,000';
  assert.throws(() => extractHeuristicFinancials(text, 'letter.pdf'), /Could not extract financials from the uploaded statement/);
});

test('heuristic extracts labelled balances and the monthly table', () => {
  const r = extractHeuristicFinancials(STATEMENT, 'stmt.pdf');
  assert.equal(r.bankOpeningBalance, 120000);
  assert.equal(r.bankClosingBalance, 155000);
  assert.deepEqual(r.monthlyCredits, [510000, 540000, 525000]);
  assert.deepEqual(r.monthlyDebits, [490000, 520000, 530000]);
  assert.deepEqual(r.dailyClosingBalances, [140000, 160000, 155000]);
  assert.equal(r.totalCreditVolume, 1575000);
  assert.equal(r.monthsAnalyzed, 3);
  assert.equal(r.gstin, GSTIN);
  assert.equal(r.businessName, 'Real Widgets Private Limited');
  // Nothing in the statement supports these, so they are gaps, not guesses.
  for (const f of ['gstr1OutwardTaxable', 'gstr3bTaxPaid', 'totalDebitAttempts', 'monthlyEmiObligations', 'sanctionedOdLimit']) {
    assert.ok(r.dataGaps.includes(f), `gap ${f}`);
  }
  assert.equal(r.totalDebitAttempts, 0);
  assert.equal(r.gstComplianceScore, null);
  assert.equal(r.totalTaxPaid, null);
});

test('heuristic omits unlabelled balances instead of inventing them', () => {
  const text = `Month Credits Debits
Jan 2025 1,00,000 90,000
Feb 2025 1,10,000 95,000
Mar 2025 1,20,000 99,000`;
  const r = extractHeuristicFinancials(text, 'x.csv');
  assert.equal(r.bankClosingBalance, undefined);
  assert.equal(r.bankOpeningBalance, undefined);
  assert.ok(r.dataGaps.includes('bankClosingBalance'));
  assert.ok(r.dataGaps.includes('dailyClosingBalances'));
  assert.deepEqual(r.dailyClosingBalances, []);
});

test('no hardcoded director names or DINs in ingestion output', () => {
  const r = extractHeuristicFinancials(`AMAAN SHAIKH and NEEDA SHAIKH\n${STATEMENT}`, 'stmt.pdf');
  const s = JSON.stringify(r);
  assert.ok(!s.includes('10154246'));
  assert.ok(!s.includes('10154247'));
  assert.ok(!/Amaan Shaikh \(Director/.test(s));
});

test('raw text with no monthly table and LLMs offline throws instead of fabricating', async () => {
  await assert.rejects(
    quiet(() => ingestAlternateData({ manualData: 'random note with 1,00,000 and 2,00,000 and 3,00,000 and 4,00,000 and 5,00,000 and 6,00,000', enableScraper: false })),
    /Could not extract financials/
  );
});

for (const [label, manualData] of [
  ['bare GSTIN string', GSTIN],
  ['JSON string with only gstin', JSON.stringify({ gstin: GSTIN })],
  ['object with only gstin', { gstin: GSTIN }]
]) {
  test(`Route B: ${label} routes to registry screening`, async () => {
    llmCalls.length = 0;
    registryCalls.length = 0;
    const r = await quiet(() => ingestAlternateData({ manualData, enableScraper: true }));
    assert.equal(r.reportType, 'REGISTRY_SCREENING');
    assert.equal(r.gstin, GSTIN);
    assert.deepEqual(registryCalls, [GSTIN]);
    assert.deepEqual(llmCalls, []);
  });
}

test('Route B: structured payload records gaps instead of inventing values', async () => {
  llmCalls.length = 0;
  const r = await quiet(() => ingestAlternateData({ manualData: JSON.stringify({ businessName: 'Acme', monthlyCredits: [100000, 120000, 110000], inwardBounces: 0 }) }));
  assert.deepEqual(llmCalls, []);
  assert.equal(r.businessName, 'Acme');
  assert.deepEqual(r.monthlyCredits, [100000, 120000, 110000]);
  assert.equal(r.inwardBounces, 0);
  assert.ok(!r.dataGaps.includes('inwardBounces'));
  assert.equal(r.bankClosingBalance, undefined);
  assert.equal(r.totalDebitAttempts, 0);
  assert.equal(r.gstComplianceScore, null);
  assert.equal(r.totalTaxPaid, null);
  assert.deepEqual(r.monthlyDebits, []);
  for (const f of ['monthlyDebits', 'bankClosingBalance', 'dailyClosingBalances', 'totalDebitAttempts', 'gstr1OutwardTaxable', 'gstComplianceScore', 'monthlyEmiObligations']) {
    assert.ok(r.dataGaps.includes(f), `gap ${f}`);
  }
});

test('Route B: provided values pass through unchanged, including zeros', async () => {
  const r = await quiet(() => ingestAlternateData({ manualData: {
    businessName: 'B', monthlyCredits: [1, 2], monthlyDebits: [1, 1], bankOpeningBalance: 0, bankClosingBalance: 5,
    dailyClosingBalances: [3, 5], sanctionedOdLimit: 0, peakOdUsage: 0, gstr1OutwardTaxable: 3, gstr3bTaxPaid: 1, gstr1DeclaredTax: 1,
    totalTaxPaid: 1, gstComplianceScore: 90, inwardBounces: 0, totalDebitAttempts: 10, outwardBounces: 0, totalOutwardAttempts: 8,
    monthlyEmiObligations: 0, newBorrowingCount6M: 0, transactions: [{ narration: 'x', amount: 1 }]
  } }));
  assert.deepEqual(r.dataGaps, []);
  assert.equal(r.bankOpeningBalance, 0);
  assert.equal(r.totalDebitAttempts, 10);
  assert.equal(r.gstComplianceScore, 90);
});
