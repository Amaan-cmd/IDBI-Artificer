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
const llmCalls = [];
stub('utils/azureFoundryClaude', { callAzureFoundryClaude: async () => { llmCalls.push('claude'); throw new Error('offline'); } });
stub('utils/googleGemini', { callGemini: async () => { llmCalls.push('gemini'); throw new Error('offline'); } });

const { handleXAIChat } = require('../controllers/chatController');

async function call(body) {
  const out = { status: 200, body: null };
  const res = {
    status(c) { out.status = c; return this; },
    json(b) { out.body = b; return this; }
  };
  const { warn } = console;
  console.warn = () => {};
  try { await handleXAIChat({ body }, res); } finally { console.warn = warn; }
  return out;
}

test('no evaluation payload: says there is nothing to explain, no invented score, no LLM call', async () => {
  llmCalls.length = 0;
  const r = await call({ query: 'why this score?' });
  assert.match(r.body.response, /no completed evaluation/i);
  assert.ok(!r.body.response.includes('824'));
  assert.deepEqual(llmCalls, []);
});

test('payload without a decision is treated the same', async () => {
  llmCalls.length = 0;
  const r = await call({ query: 'why?', evaluationPayload: { businessName: 'Simulator MSME' } });
  assert.match(r.body.response, /no completed evaluation/i);
  assert.deepEqual(llmCalls, []);
});

test('fallback uses payload values and says "not available" for missing ones', async () => {
  const r = await call({ query: 'why?', evaluationPayload: { decision: { score: 612, riskLevel: 'HIGH' }, metrics: { pillar1_liquidity: { cashBufferRatio: 0.3 } } } });
  const text = r.body.response;
  assert.match(text, /612/);
  assert.match(text, /HIGH/);
  assert.match(text, /0\.3x/);
  assert.match(text, /not available/);
  for (const invented of ['824', '0.71', '96.8', '0.99', '0.06', '1.67', '18 days']) {
    assert.ok(!text.includes(invented), `must not contain ${invented}`);
  }
});

test('missing query is still a 400', async () => {
  const r = await call({ evaluationPayload: { decision: { score: 700 } } });
  assert.equal(r.status, 400);
});
