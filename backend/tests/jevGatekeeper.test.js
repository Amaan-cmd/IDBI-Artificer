const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const Module = require('module');

function stub(filename, exports) {
  const mod = new Module(filename);
  mod.filename = filename;
  mod.loaded = true;
  mod.exports = exports;
  require.cache[filename] = mod;
}
// No LLM or network in tests: every model route fails, the TypeSafe SDK is faked.
stub(require.resolve('../utils/nemoGuardrails'), { applyGuardrails: async () => { throw new Error('offline'); } });
stub(require.resolve('../utils/googleGemini'), { callGemini: async () => { throw new Error('offline'); } });
const typesafe = { answers: {} };
stub(require.resolve('@typesafe-ai/sdk', { paths: [path.join(__dirname, '..')] }), {
  choice: () => ({}), noul: () => ({}),
  TypeSafeClient: class { async systemOne() { return { answers: typesafe.answers }; } }
});

const { runDeterministicSanityCheck, evaluateAppropriateness } = require('../agents/jevGatekeeper');

const BASE = { businessName: 'Real Co', gstin: '27AAACR5055K1Z7', totalRevenue: 1575000, totalCreditVolume: 1575000 };

test('balance continuity is NOT_ASSESSED when balances or debits are missing', () => {
  for (const data of [
    { ...BASE, totalDebitVolume: 1540000 },
    { ...BASE, totalDebitVolume: 0, bankOpeningBalance: 120000, bankClosingBalance: 155000 },
    { ...BASE, totalDebitVolume: 1540000, bankOpeningBalance: null, bankClosingBalance: null }
  ]) {
    const r = runDeterministicSanityCheck(data);
    assert.equal(r.balanceContinuity.status, 'NOT_ASSESSED');
    assert.equal(r.balanceContinuity.verified, null);
    assert.equal(r.balanceContinuity.variance, null);
    assert.doesNotMatch(r.rationale, /continuity verified|Variance: ₹/);
  }
});

test('balance continuity is verified only when the check actually ran', () => {
  const r = runDeterministicSanityCheck({ ...BASE, totalDebitVolume: 1540000, bankOpeningBalance: 120000, bankClosingBalance: 155000 });
  assert.equal(r.balanceContinuity.status, 'VERIFIED_PARITY');
  assert.equal(r.balanceContinuity.verified, true);
  assert.match(r.rationale, /continuity verified/);
});

test('solvency bounces are unknown (null), not 0, when inward bounces were not found', () => {
  const r = runDeterministicSanityCheck({ ...BASE, totalDebitVolume: 1, inwardBounces: 0, dataGaps: ['inwardBounces'] });
  assert.equal(r.solvencyBouncesVerified, null);
  const known = runDeterministicSanityCheck({ ...BASE, totalDebitVolume: 1, inwardBounces: 2, dataGaps: [] });
  assert.equal(known.solvencyBouncesVerified, 2);
});

async function viaTypeSafe(answers) {
  const env = { ...process.env };
  process.env.TYPESAFE_API_KEY = 'apikey_test';
  delete process.env.JEV_API_KEY;
  typesafe.answers = answers;
  const { log, warn } = console;
  console.log = console.warn = () => {};
  try {
    return await evaluateAppropriateness({ ...BASE, totalDebitVolume: 1540000, bankOpeningBalance: 120000, bankClosingBalance: 155000 });
  } finally {
    console.log = log; console.warn = warn;
    process.env = env;
  }
}

test('TypeSafe route does not invent a confidence or tamper rating it did not return', async () => {
  const r = await viaTypeSafe({ verdict: { choice: 'APPROPRIATE' } });
  assert.equal(r.verdict, 'APPROPRIATE');
  assert.equal(r.confidenceScore, null);
  assert.equal(r.tamperRisk, 'NOT_ASSESSED');
});

test('TypeSafe route without a verdict falls back to the deterministic check instead of passing', async () => {
  const r = await viaTypeSafe({});
  assert.equal(r.confidenceBasis, 'HEURISTIC_VERDICT_TIER');
  assert.doesNotMatch(r.rationale, /TypeSafe/);
});
