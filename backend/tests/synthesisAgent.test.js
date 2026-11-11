const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const Module = require('module');

function stub(relPath, exports) {
  const filename = require.resolve(path.join(__dirname, '..', relPath));
  const mod = new Module(filename);
  mod.filename = filename;
  mod.loaded = true;
  mod.exports = exports;
  require.cache[filename] = mod;
}
stub('utils/googleGemini', { callGemini: async () => { throw new Error('no LLM in tests'); } });
stub('utils/nemoGuardrails', { applyGuardrails: async () => { throw new Error('no LLM in tests'); } });

const { synthesizeScore } = require('../agents/synthesisAgent');
const { computeFinancialTelemetry } = require('../utils/financialTelemetry');

const DET = { deterministicOnly: true };

const FULL = {
  businessName: 'X', monthlyCredits: [500000, 520000, 510000, 530000, 540000, 550000],
  monthlyDebits: [450000, 460000, 455000, 470000, 480000, 490000], dailyClosingBalances: [200000, 210000, 220000],
  sanctionedOdLimit: 0, peakOdUsage: 0, gstr1OutwardTaxable: 3150000, gstr3bTaxPaid: 100000, gstr1DeclaredTax: 100000,
  inwardBounces: 0, totalDebitAttempts: 100, outwardBounces: 0, totalOutwardAttempts: 80, monthlyEmiObligations: 10000,
  newBorrowingCount6M: 0, transactions: [], dataGaps: []
};

test('score does not depend on which PAN is inside the GSTIN', async () => {
  const matrix = computeFinancialTelemetry(FULL);
  const a = await synthesizeScore({ ...FULL, gstin: '27AAHCE5539J1ZA' }, matrix, null, DET);
  const b = await synthesizeScore({ ...FULL, gstin: '27AAACR5055K1Z7' }, matrix, null, DET);
  const c = await synthesizeScore({ ...FULL, gstin: '27AAACT2727Q1ZW' }, matrix, null, DET);
  assert.equal(a.score, b.score);
  assert.equal(c.score, b.score);
});

test('missing metrics produce caveats and no invented figures in the narrative', async () => {
  const d = await synthesizeScore({ businessName: 'X' }, {}, null, DET);
  const text = JSON.stringify(d);
  for (const invented of ['0.48', '99.6%', '1.67', '48.4', '5.2%', 'below 5%', 'VERIFIED_SOUND', '18 days', ' 18 minimum']) {
    assert.ok(!text.includes(invented), `must not contain ${invented}`);
  }
  assert.match(d.narrative, /not available/);
  assert.ok(d.caveats.length > 0);
  assert.equal(d.agentSafetyAudit?.confidenceRating ?? null, null);
});

test('a missing metric neither awards nor penalises', async () => {
  const matrix = computeFinancialTelemetry(FULL);
  const base = await synthesizeScore(FULL, matrix, null, DET);
  const noCv = JSON.parse(JSON.stringify(matrix));
  delete noCv.pillar3_stability.creditCoefficientOfVariation;
  const cvPoints = matrix.pillar3_stability.creditCoefficientOfVariation <= 0.08 ? 20 : 8;
  const d = await synthesizeScore(FULL, noCv, null, DET);
  assert.equal(d.score, base.score - cvPoints);
  assert.ok(d.caveats.some(c => /coefficient of variation/i.test(c)));
});

test('dataGaps from ingestion become caveats and suppress dependent metrics', async () => {
  const gaps = ['monthlyEmiObligations', 'gstr1OutwardTaxable'];
  const input = { ...FULL, dataGaps: gaps };
  const matrix = computeFinancialTelemetry(input);
  const d = await synthesizeScore(input, matrix, null, DET);
  assert.ok(d.caveats.includes('Not found in statement: monthlyEmiObligations'));
  assert.ok(d.caveats.includes('Not found in statement: gstr1OutwardTaxable'));
  // Telemetry reports 99.9x DSCP when EMI is 0; that must not be cited as fact.
  assert.ok(!d.citations.join(' ').includes('99.9'));
  assert.match(d.citations.find(c => c.startsWith('[Pillar 4')), /not available/);
});

test('computed values are cited as computed', async () => {
  const matrix = computeFinancialTelemetry(FULL);
  const d = await synthesizeScore(FULL, matrix, null, DET);
  assert.ok(d.citations.some(c => c.includes(`${matrix.pillar1_liquidity.cashBufferRatio}x`)));
  assert.ok(d.citations.some(c => c.includes(`${matrix.pillar4_leverage.debtServiceCoverageProxy}x`)));
});
