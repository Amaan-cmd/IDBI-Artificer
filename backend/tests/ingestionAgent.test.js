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
const grok = { reply: null };
stub('utils/grokClient', { callGrok: async () => { llmCalls.push('grok'); if (grok.reply) return grok.reply; throw new Error('offline'); } });
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

test('LLM extraction is normalised: missing or null fields become dataGaps, not facts', async () => {
  grok.reply = JSON.stringify({
    businessName: 'Real Widgets Private Limited', gstin: 'NA', monthlyCredits: ['5,10,000', 540000, 525000],
    monthlyDebits: [490000, 520000, 530000], bankOpeningBalance: 120000, bankClosingBalance: 155000,
    sanctionedOdLimit: null, monthlyEmiObligations: null, inwardBounces: 0, dataGaps: []
  });
  try {
    const r = await quiet(() => ingestAlternateData({ manualData: STATEMENT, enableScraper: false }));
    assert.deepEqual(r.monthlyCredits, [510000, 540000, 525000]);
    assert.equal(r.gstin, GSTIN); // 'NA' from the LLM; the GSTIN printed in the statement is used
    assert.equal(r.inwardBounces, 0);
    assert.ok(!r.dataGaps.includes('inwardBounces'));
    for (const f of ['sanctionedOdLimit', 'monthlyEmiObligations', 'gstr1OutwardTaxable', 'totalDebitAttempts', 'transactions']) {
      assert.ok(r.dataGaps.includes(f), `gap ${f}`);
    }
  } finally {
    grok.reply = null;
  }
});

test('LLM extraction without a monthly credit series falls back to the labelled table', async () => {
  grok.reply = JSON.stringify({ businessName: 'Invented Co', totalRevenue: 9999999 });
  try {
    const r = await quiet(() => ingestAlternateData({ manualData: STATEMENT, enableScraper: false }));
    assert.deepEqual(r.monthlyCredits, [510000, 540000, 525000]);
    assert.equal(r.businessName, 'Real Widgets Private Limited');
  } finally {
    grok.reply = null;
  }
});

test('heuristic reads Dr / negative / bracketed balances as negative, Cr as positive', () => {
  const text = `Month Credits Debits Balance
Jan 2025 1,00,000 1,20,000 20,000.00 Dr
Feb 2025 1,10,000 95,000 (5,000.00)
Mar 2025 1,20,000 99,000 -1,000
Apr 2025 1,30,000 90,000 39,000 Cr
Closing Balance: Rs. 39,000.00 Cr`;
  const r = extractHeuristicFinancials(text, 'x.csv');
  assert.deepEqual(r.monthlyCredits, [100000, 110000, 120000, 130000]);
  assert.deepEqual(r.monthlyDebits, [120000, 95000, 99000, 90000]);
  assert.deepEqual(r.dailyClosingBalances, [-20000, -5000, -1000, 39000]);
  assert.equal(r.bankClosingBalance, 39000);
});

test('heuristic reads a labelled overdrawn closing balance as negative', () => {
  const text = `Month Credits Debits
Jan 2025 1,00,000 90,000
Feb 2025 1,10,000 95,000
Mar 2025 1,20,000 99,000
Closing Balance: Rs. 12,500.00 Dr`;
  assert.equal(extractHeuristicFinancials(text, 'x.csv').bankClosingBalance, -12500);
});

test('heuristic rejects rows whose figures do not match the header columns', () => {
  const text = `Month Txn Count Credits Debits Balance
Jan 2025 42 1,00,000 90,000 10,000
Feb 2025 40 1,10,000 95,000 25,000
Mar 2025 45 1,20,000 99,000 46,000`;
  assert.throws(() => extractHeuristicFinancials(text, 'x.csv'), /Could not extract financials/);
});

test('Route B: raw statement text with a GSTIN gets the registry report', async () => {
  registryCalls.length = 0;
  const r = await quiet(() => ingestAlternateData({ manualData: STATEMENT, enableScraper: true }));
  assert.deepEqual(registryCalls, [GSTIN]);
  assert.equal(r.registryReport.gstin, GSTIN);
});

test('Route B: scraper disabled means no registry lookup', async () => {
  registryCalls.length = 0;
  const r = await quiet(() => ingestAlternateData({ manualData: STATEMENT, enableScraper: false }));
  assert.deepEqual(registryCalls, []);
  assert.equal(r.registryReport, null);
});

test('Route C: an invalid GSTIN is rejected without a registry call', async () => {
  registryCalls.length = 0;
  await assert.rejects(quiet(() => ingestAlternateData({ gstin: 'not-a-gstin' })), /Invalid GSTIN/);
  await assert.rejects(quiet(() => ingestAlternateData({ gstin: '29AABCI1681G1ZN' })), /Invalid GSTIN/);
  assert.deepEqual(registryCalls, []);
});

const SAMPLE_BANK_CSV = require('fs').readFileSync(
  path.join(__dirname, '..', '..', 'dataset', 'Sample_Bank_Statement.csv'), 'utf8');

test('heuristic reads a bank transaction table (sample statement) with no gaps in bank fields', async () => {
  const r = await quiet(() => extractHeuristicFinancials(SAMPLE_BANK_CSV, 'Sample_Bank_Statement.csv'));
  assert.equal(r.businessName, 'EnverAI Tech Retail Supplies Pvt Ltd');
  assert.equal(r.monthsAnalyzed, 3);
  assert.deepEqual(r.monthlyCredits, [470000, 390000, 146200]);
  assert.deepEqual(r.monthlyDebits, [370000, 150500, 175000]);
  assert.equal(r.totalCreditVolume, 1006200);
  assert.equal(r.totalDebitVolume, 695500);
  assert.equal(r.bankOpeningBalance, 450000.5);
  assert.equal(r.bankClosingBalance, 760700.5);
  assert.equal(r.inwardBounces, 1);
  assert.equal(r.monthlyEmiObligations, 0);
  assert.equal(r.transactions.length, 13);
  for (const f of ['monthlyCredits', 'monthlyDebits', 'totalDebitVolume', 'bankOpeningBalance', 'bankClosingBalance',
    'dailyClosingBalances', 'inwardBounces', 'totalDebitAttempts', 'monthlyEmiObligations', 'transactions']) {
    assert.ok(!r.dataGaps.includes(f), `${f} should not be a gap`);
  }
  // A bank statement cannot supply GST returns or an unlabelled OD limit.
  for (const f of ['gstr1OutwardTaxable', 'gstr3bTaxPaid', 'totalTaxPaid', 'sanctionedOdLimit']) {
    assert.ok(r.dataGaps.includes(f), `${f} should be a gap`);
  }
});

test('heuristic rejects a transaction table that fails validation instead of falling back', async () => {
  const tampered = SAMPLE_BANK_CSV.replace(',0,320000.00,720000.50', ',0,920000.00,720000.50');
  await assert.rejects(quiet(async () => extractHeuristicFinancials(tampered, 'x.csv')),
    /Could not extract financials from the uploaded statement/);
  const wrongTotal = SAMPLE_BANK_CSV.replace('Total Credits: 1006200.00', 'Total Credits: 2006200.00');
  await assert.rejects(quiet(async () => extractHeuristicFinancials(wrongTotal, 'x.csv')),
    /Could not extract financials from the uploaded statement/);
});

test('businessNameSource: name printed in the statement is "statement"', async () => {
  const r = await quiet(() => extractHeuristicFinancials(SAMPLE_BANK_CSV, 'Acme_Traders.csv'));
  assert.equal(r.businessName, 'EnverAI Tech Retail Supplies Pvt Ltd');
  assert.equal(r.businessNameSource, 'statement');
});

test('businessNameSource: a name taken from the file name is "filename"', async () => {
  const noName = SAMPLE_BANK_CSV.replace(/^Account Holder:.*\r?\n/m, '');
  assert.ok(!/Pvt Ltd/.test(noName));
  const r = await quiet(() => extractHeuristicFinancials(noName, 'Acme_Traders_Mar.csv'));
  assert.equal(r.businessName, 'Acme Traders Mar');
  assert.equal(r.businessNameSource, 'filename');
  const none = await quiet(() => extractHeuristicFinancials(noName, 'Sample_Bank_Statement.csv'));
  assert.equal(none.businessNameSource, null);
  assert.ok(none.dataGaps.includes('businessName'));
});

test('businessNameSource: structured payload name is "manual"', async () => {
  const r = await quiet(() => ingestAlternateData({ manualData: JSON.stringify({ businessName: 'Acme', monthlyCredits: [1, 2, 3] }) }));
  assert.equal(r.businessNameSource, 'manual');
});

test('businessNameSource: LLM name is "statement" only when the statement text contains it', async () => {
  const reply = (businessName) => JSON.stringify({ businessName, monthlyCredits: [510000, 540000, 525000] });
  try {
    grok.reply = reply('REAL WIDGETS PRIVATE LIMITED');
    const inText = await quiet(() => ingestAlternateData({ manualData: STATEMENT, enableScraper: false }));
    assert.equal(inText.businessNameSource, 'statement');
    grok.reply = reply('Widgets From Filename Ltd');
    const notInText = await quiet(() => ingestAlternateData({ manualData: STATEMENT, enableScraper: false }));
    assert.equal(notInText.businessName, 'Widgets From Filename Ltd');
    assert.equal(notInText.businessNameSource, 'llm');
  } finally {
    grok.reply = null;
  }
});

test('every field ingestion can list in dataGaps has a human label for caveats', async () => {
  const { FIELD_LABELS, gapCaveat } = require('../utils/fieldLabels');
  const r = await quiet(() => ingestAlternateData({ manualData: JSON.stringify({ monthlyCredits: [1, 2, 3] }) }));
  assert.ok(r.dataGaps.length >= 19);
  for (const f of r.dataGaps) {
    assert.ok(FIELD_LABELS[f], `label for ${f}`);
    assert.ok(!gapCaveat(f).includes(f), `caveat for ${f} is not the raw key`);
  }
});
