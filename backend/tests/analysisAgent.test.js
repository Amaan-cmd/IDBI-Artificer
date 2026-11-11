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
const llm = { reply: null };
stub('utils/googleGemini', { callGemini: async () => { throw new Error('no LLM in tests'); } });
stub('utils/nemoGuardrails', { applyGuardrails: async () => { if (!llm.reply) throw new Error('offline'); return llm.reply; } });

const { analyzeFinancials } = require('../agents/analysisAgent');
const { computeFinancialTelemetry } = require('../utils/financialTelemetry');

const INPUT = { monthlyCredits: [100000, 110000, 120000], dataGaps: ['monthlyDebits', 'dailyClosingBalances', 'monthlyEmiObligations'] };

async function quiet(fn) {
  const { log, warn } = console;
  console.log = console.warn = () => {};
  try { return await fn(); } finally { Object.assign(console, { log, warn }); }
}

test('LLM output cannot replace deterministic metrics (e.g. fill a null buffer)', async () => {
  llm.reply = JSON.stringify({
    pillar1_liquidity: { cashBufferRatio: 0.71, minimumCashBufferDays: 18, status: 'EXCELLENT' },
    pillar4_leverage: { debtServiceCoverageProxy: 2.1, tier: 'LOW_LEVERAGE' },
    revenueRunRate: 99999999, cashBufferRatio: 0.71, taxCompliance: 'Excellent',
    reasoning: 'LLM reasoning', citations: ['c1']
  });
  const det = computeFinancialTelemetry(INPUT);
  const m = await quiet(() => analyzeFinancials(INPUT));
  llm.reply = null;
  assert.deepEqual(m.pillar1_liquidity, det.pillar1_liquidity);
  assert.deepEqual(m.pillar4_leverage, det.pillar4_leverage);
  assert.equal(m.cashBufferRatio, null);
  assert.equal(m.revenueRunRate, det.revenueRunRate);
  assert.equal(m.taxCompliance, 'NOT_ASSESSED');
  assert.equal(m.reasoning, 'LLM reasoning');
  assert.deepEqual(m.citations, ['c1']);
});

test('LLM offline returns the deterministic matrix', async () => {
  const m = await quiet(() => analyzeFinancials(INPUT));
  assert.deepEqual(m, computeFinancialTelemetry(INPUT));
});
