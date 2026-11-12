const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');
process.env.SESSION_JWT_SECRET = 'test-secret';
process.env.DEMO_MODE = 'false';

// Stubs go into the require cache before the server loads, so no test here
// reaches an LLM, the registry network, or writes backend/data/*.json.
function stub(relPath, exports) {
  const filename = require.resolve(path.join(__dirname, '..', '..', relPath));
  const mod = new Module(filename);
  mod.filename = filename;
  mod.loaded = true;
  mod.exports = exports;
  require.cache[filename] = mod;
}

// Controllers destructure their imports, so stubs delegate to mutable impls.
const impl = {};
function resetImpl() {
  Object.assign(impl, {
    ingest: async () => { throw new Error('ingestion not set'); },
    jevLive: async () => ({ isAppropriate: true }),
    jevFallback: () => ({ isAppropriate: true }),
    analyze: async () => ({ revenueRunRate: 1, cashBufferRatio: 1, taxCompliance: 'OK' }),
    synthesize: async () => ({ score: 700, riskLevel: 'MEDIUM', narrative: 'n', citations: [] }),
    registry: async () => { throw new Error('registry not set'); }
  });
}
resetImpl();
stub('agents/ingestionAgent', { ingestAlternateData: (...a) => impl.ingest(...a) });
stub('agents/jevGatekeeper', {
  evaluateAppropriateness: (...a) => impl.jevLive(...a),
  runDeterministicSanityCheck: (...a) => impl.jevFallback(...a)
});
stub('agents/analysisAgent', { analyzeFinancials: (...a) => impl.analyze(...a) });
stub('agents/synthesisAgent', { synthesizeScore: (...a) => impl.synthesize(...a) });
stub('services/registry/registryService', { getRegistryReport: (...a) => impl.registry(...a) });
stub('services/slackNotifier', { sendSlackNotification: () => {} });
stub('utils/azureStorage', { azureStorage: { saveStatementFile: () => {} } });
stub('controllers/historyController', { addHistoryRecord: () => {}, getHistory: (_req, res) => res.json([]) });
stub('utils/azureFoundryClaude', { callAzureFoundryClaude: async () => { throw new Error('offline'); } });
stub('utils/googleGemini', { callGemini: async () => { throw new Error('offline'); } });

// Patch before creditController destructures it.
const usage = [];
require('../../controllers/userController').incrementUserUsage = async (...a) => { usage.push(a); };

const app = require('../../server');
const { issueSessionToken } = require('../../platform/session');
const ledger = require('../../billing/ledgerService');
const { useTempStore, waitFor } = require('./helpers');

const VALID_GSTIN = '27AAACR5055K1Z7';
const DEMO_GSTIN = '27AAHCE5539J1ZA';
const UPLOAD_DIR = path.join(os.tmpdir(), 'uploads');

let store;
test.beforeEach(async () => {
  store = await useTempStore();
  resetImpl();
  usage.length = 0;
});

async function withServer(fn) {
  const server = app.listen(0);
  await new Promise(r => server.once('listening', r));
  try { return await fn(`http://127.0.0.1:${server.address().port}`); } finally { server.close(); }
}
const auth = (email) => ({ authorization: `Bearer ${issueSessionToken({ id: 'u1', email })}` });

async function quiet(fn) {
  const { warn, error } = console;
  console.warn = () => {};
  console.error = () => {};
  try { return await fn(); } finally { console.warn = warn; console.error = error; }
}

async function evaluate(email, fields, file) {
  return withServer(async (base) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    if (file) fd.append('statement', new Blob([file.content]), file.name);
    const res = await fetch(`${base}/api/v1/evaluate`, { method: 'POST', headers: auth(email), body: fd });
    const text = await res.text();
    const events = [...text.matchAll(/^data: (.*)$/gm)].map((m) => JSON.parse(m[1]));
    return { status: res.status, events, text };
  });
}

const accountRow = (email) => store.getEntity('accounts', ledger.ACCOUNT_PK, ledger.accountIdFor(email));
const ledgerRows = (email) => store.listEntities('ledger', ledger.accountIdFor(email));
const balance = async (email) => (await accountRow(email))?.balanceCents;
const chargeRow = async (email) => (await ledgerRows(email)).find((r) => r.type === 'charge');

const section = (status, cached) => (status === 'ok' ? { status, data: {}, cached } : { status, reason: 'x' });
const report = (gst, filings, mca) => ({ gstin: VALID_GSTIN, gst, filings, mca });

// --- evaluate: failed runs are refunded ---

test('evaluate: ingestion fails in the live and fallback paths -> step 99, refunded', async () => {
  const r = await quiet(() => evaluate('fail@x.com', { manualData: '{"businessName":"X"}' }));
  assert.equal(r.status, 200);
  assert.equal(r.events.at(-1).step, 99);
  await waitFor(async () => (await balance('fail@x.com')) === 500);
  assert.ok((await ledgerRows('fail@x.com')).some((row) => row.type === 'refund'));
});

test('evaluate: JEV rejection -> step 99, refunded', async () => {
  impl.ingest = async () => ({ businessName: 'X', businessNameSource: 'manual' });
  impl.jevLive = async () => ({ isAppropriate: false, rationale: 'fake' });
  const r = await quiet(() => evaluate('jev@x.com', { manualData: '{"businessName":"X"}' }));
  assert.equal(r.events.at(-1).step, 99);
  await waitFor(async () => (await balance('jev@x.com')) === 500);
});

test('evaluate: a scored run keeps the charge and records the real cost', async () => {
  impl.ingest = async () => ({ businessName: 'X', businessNameSource: 'manual' });
  const r = await quiet(() => evaluate('ok@x.com', { manualData: '{"businessName":"X"}' }));
  assert.equal(r.events.at(-1).step, 4);
  assert.equal(await balance('ok@x.com'), 450);
  assert.deepEqual(usage, [['u1', 0.5]]);
  assert.equal((await chargeRow('ok@x.com')).reference, 'manual data');
});

// --- evaluate: GSTIN-only registry screening ---

test('evaluate: screening with freshly fetched registry data is billed as a registry lookup', async () => {
  impl.ingest = async () => ({
    reportType: 'REGISTRY_SCREENING', gstin: VALID_GSTIN,
    registryReport: report(section('ok', false), section('unavailable'), section('unavailable'))
  });
  const r = await quiet(() => evaluate('scr@x.com', { gstin: VALID_GSTIN }));
  assert.equal(r.events.at(-1).step, 4);
  assert.equal(await balance('scr@x.com'), 498);
  assert.deepEqual(usage, [['u1', 0.02]]);
  const row = await chargeRow('scr@x.com');
  assert.equal(row.action, 'registryLookup');
  assert.equal(row.reference, VALID_GSTIN);
});

test('evaluate: screening served entirely from the registry cache is refunded', async () => {
  impl.ingest = async () => ({
    reportType: 'REGISTRY_SCREENING', gstin: VALID_GSTIN,
    registryReport: report(section('ok', true), section('ok', true), section('unavailable'))
  });
  const r = await quiet(() => evaluate('scrc@x.com', { gstin: VALID_GSTIN }));
  assert.equal(r.events.at(-1).step, 4);
  assert.equal(await balance('scrc@x.com'), 500);
  assert.ok((await ledgerRows('scrc@x.com')).some((row) => row.type === 'refund'));
  assert.deepEqual(usage, [['u1', 0]]);
});

test('evaluate: a GSTIN with manual data is still billed as an evaluation', async () => {
  impl.ingest = async () => ({ businessName: 'X', businessNameSource: 'manual' });
  await quiet(() => evaluate('gm@x.com', { gstin: VALID_GSTIN, manualData: '{"businessName":"X"}' }));
  assert.equal((await chargeRow('gm@x.com')).action, 'evaluate');
  assert.equal(await balance('gm@x.com'), 450);
});

test('evaluate: screening with no registry data is delivered but refunded', async () => {
  impl.ingest = async () => ({
    reportType: 'REGISTRY_SCREENING', gstin: VALID_GSTIN,
    registryReport: report(section('unavailable'), section('unavailable'), section('unavailable'))
  });
  const r = await quiet(() => evaluate('scr0@x.com', { gstin: VALID_GSTIN }));
  assert.equal(r.events.at(-1).step, 4);
  await waitFor(async () => (await balance('scr0@x.com')) === 500);
  assert.ok((await ledgerRows('scr0@x.com')).some((row) => row.type === 'refund'));
  assert.deepEqual(usage, [['u1', 0]]);
});

// --- evaluate: references and uploads ---

test('evaluate: an upload is referenced as "statement upload", not its file name', async () => {
  impl.ingest = async () => ({ businessName: 'X', businessNameSource: 'statement' });
  await quiet(() => evaluate('up@x.com', { gstin: 'not-a-gstin-' + 'x'.repeat(200) }, { name: 'n'.repeat(300) + '.csv', content: 'a,b\n1,2' }));
  assert.equal((await chargeRow('up@x.com')).reference, 'statement upload');
});

test('evaluate: an upload rejected with 402 leaves no file in the upload directory', async () => {
  for (let i = 0; i < 10; i++) await ledger.charge('broke@x.com', 'evaluate');
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const before = new Set(fs.readdirSync(UPLOAD_DIR));
  const r = await evaluate('broke@x.com', {}, { name: 's.csv', content: 'a,b\n1,2' });
  assert.equal(r.status, 402);
  await waitFor(() => fs.readdirSync(UPLOAD_DIR).every((f) => before.has(f)));
});

test('evaluate: an upload over 20 MB is a 413 JSON error and is not charged', async () => {
  const r = await evaluate('big@x.com', {}, { name: 'big.csv', content: Buffer.alloc(20 * 1024 * 1024 + 1, 97) });
  assert.equal(r.status, 413);
  assert.equal(JSON.parse(r.text).code, 'FILE_TOO_LARGE');
  assert.equal(await accountRow('big@x.com'), null);
});

// --- demo presets are free ---

test('DEMO_MODE: demo GSTIN on /evaluate and /registry creates no charge at all', async () => {
  const prev = process.env.DEMO_MODE;
  process.env.DEMO_MODE = 'true';
  try {
    impl.ingest = async () => ({ reportType: 'REGISTRY_SCREENING', gstin: DEMO_GSTIN, registryReport: report(section('ok', false)) });
    const r = await quiet(() => evaluate('demo@x.com', { gstin: DEMO_GSTIN }));
    assert.equal(r.status, 200);
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/v1/registry/gstin/${DEMO_GSTIN}`, { headers: auth('demo@x.com') });
      assert.equal(res.status, 200);
    });
    assert.equal(await accountRow('demo@x.com'), null);
  } finally {
    process.env.DEMO_MODE = prev;
  }
});

// --- registry lookups ---

async function lookup(email) {
  return withServer(async (base) => (await fetch(`${base}/api/v1/registry/gstin/${VALID_GSTIN}`, { headers: auth(email) })).status);
}

test('/registry: a fully cached result is refunded', async () => {
  impl.registry = async () => report(section('ok', true), section('ok', true), section('unavailable'));
  assert.equal(await quiet(() => lookup('c@x.com')), 200);
  assert.equal(await balance('c@x.com'), 500);
});

test('/registry: fresh registry data is charged 2c', async () => {
  impl.registry = async () => report(section('ok', false), section('ok', true), section('unavailable'));
  assert.equal(await quiet(() => lookup('f@x.com')), 200);
  assert.equal(await balance('f@x.com'), 498);
});

test('/registry: all sections unavailable is refunded', async () => {
  impl.registry = async () => report(section('unavailable'), section('unavailable'), section('unavailable'));
  assert.equal(await quiet(() => lookup('n@x.com')), 200);
  assert.equal(await balance('n@x.com'), 500);
  const refundRow = (await ledgerRows('n@x.com')).find((row) => row.type === 'refund');
  assert.ok(refundRow);
});

// --- chat ---

async function chat(email, evaluationPayload) {
  return withServer(async (base) => {
    const res = await fetch(`${base}/api/v1/chat/xai`, {
      method: 'POST', headers: { ...auth(email), 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'why?', evaluationPayload })
    });
    return { status: res.status, body: await res.json() };
  });
}

test('chat: grounded fallback when both AI engines fail is refunded', async () => {
  const r = await quiet(() => chat('ch@x.com', { gstin: VALID_GSTIN, decision: { score: 700, riskLevel: 'LOW' } }));
  assert.equal(r.status, 200);
  assert.equal(r.body.engine, 'Grounded Forensic Underwriting Matrix');
  await waitFor(async () => (await balance('ch@x.com')) === 500);
  assert.equal((await chargeRow('ch@x.com')).reference, VALID_GSTIN);
});

test('chat: a non-GSTIN payload gstin is not used as the ledger reference', async () => {
  await quiet(() => chat('ch2@x.com', { gstin: 'x'.repeat(500), decision: { score: 700 } }));
  assert.equal((await chargeRow('ch2@x.com')).reference, '');
});
