const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const Module = require('module');

// Inject stubs into the require cache before the controller loads, so no test
// here reaches an LLM, the registry network, or writes backend/data/*.json.
function stub(relPath, exports) {
  const filename = require.resolve(path.join(__dirname, '..', relPath));
  const mod = new Module(filename);
  mod.filename = filename;
  mod.loaded = true;
  mod.exports = exports;
  require.cache[filename] = mod;
  return exports;
}

// The controller destructures its imports, so stubs delegate to mutable impls.
const ingestion = { ingestAlternateData: async () => { throw new Error('not set'); } };
stub('agents/ingestionAgent', { ingestAlternateData: (...a) => ingestion.ingestAlternateData(...a) });
const history = [];
stub('controllers/historyController', { addHistoryRecord: (r) => history.push(r) });
stub('controllers/userController', { incrementUserUsage: () => {} });
stub('services/slackNotifier', { sendSlackNotification: () => {} });
stub('utils/azureStorage', { azureStorage: { saveStatementFile: () => {} } });
const jev = {
  evaluateAppropriateness: async () => ({ isAppropriate: true }),
  runDeterministicSanityCheck: () => ({ isAppropriate: true })
};
stub('agents/jevGatekeeper', {
  evaluateAppropriateness: (...a) => jev.evaluateAppropriateness(...a),
  runDeterministicSanityCheck: (...a) => jev.runDeterministicSanityCheck(...a)
});
stub('agents/analysisAgent', { analyzeFinancials: async () => ({ revenueRunRate: 1, cashBufferRatio: 1, taxCompliance: 'OK' }) });
const synthesis = {
  synthesizeScore: async () => ({ score: 700, riskLevel: 'MEDIUM', narrative: 'n', citations: [] })
};
stub('agents/synthesisAgent', { synthesizeScore: (...a) => synthesis.synthesizeScore(...a) });

const { evaluateMSMECredit } = require('../controllers/creditController');

const REPORT = {
  gstin: '27AAACR5055K1Z7',
  gst: { status: 'ok', data: { legalName: 'Real Co Pvt Ltd', status: 'Active' }, source: 'GSTN via Sandbox', fetchedAt: 't', transactionId: 'x' },
  filings: { status: 'ok', data: [], source: 'GSTN via Sandbox', fetchedAt: 't', transactionId: 'y' },
  filingMetrics: { filingDiscipline: 'REGULAR' },
  mca: { status: 'unavailable', reason: 'Not an MCA-registered entity type' }
};

function fakeRes() {
  const events = [];
  return {
    events,
    ended: false,
    headersSent: false,
    setHeader() {},
    flushHeaders() { this.headersSent = true; },
    write(chunk) {
      const m = /^data: (.*)\n\n$/s.exec(chunk);
      if (m) events.push(JSON.parse(m[1]));
    },
    end() { this.ended = true; },
    status() { return this; },
    json() { return this; }
  };
}

function fakeReq(body) {
  return { body, session: { uid: 'u1', email: 'a@x.com', name: 'A', role: 'r' }, on() {} };
}

async function quiet(fn) {
  const { log, warn, error } = console;
  console.log = console.warn = console.error = () => {};
  try { return await fn(); } finally { Object.assign(console, { log, warn, error }); }
}

test('GSTIN-only run streams a REGISTRY_SCREENING payload with no score', async () => {
  history.length = 0;
  ingestion.ingestAlternateData = async () => ({ reportType: 'REGISTRY_SCREENING', gstin: REPORT.gstin, registryReport: REPORT });
  let synthCalled = false;
  const origSynth = synthesis.synthesizeScore;
  synthesis.synthesizeScore = async (...a) => { synthCalled = true; return origSynth(...a); };
  const res = fakeRes();
  try {
    await quiet(() => evaluateMSMECredit(fakeReq({ gstin: REPORT.gstin }), res));
  } finally {
    synthesis.synthesizeScore = origSynth;
  }

  assert.equal(res.ended, true);
  assert.equal(synthCalled, false);
  const final = res.events.find(e => e.step === 4);
  assert.ok(final, 'step 4 emitted');
  assert.equal(final.payload.reportType, 'REGISTRY_SCREENING');
  assert.equal(final.payload.businessName, 'Real Co Pvt Ltd');
  assert.equal(final.payload.score, undefined);
  assert.equal(final.payload.decision, undefined);
  assert.deepEqual(final.payload.registryReport, REPORT);
  assert.ok(!res.events.some(e => e.step === 99));
  assert.equal(history.length, 1);
  assert.equal(history[0].score, null);
});

test('extraction failure streams step 99 and no score, with no fabricated fallback', async () => {
  history.length = 0;
  ingestion.ingestAlternateData = async () => { throw new Error('unreadable statement'); };
  const res = fakeRes();
  await quiet(() => evaluateMSMECredit(fakeReq({ manualData: 'garbage' }), res));

  assert.equal(res.ended, true);
  const last = res.events[res.events.length - 1];
  assert.equal(last.step, 99);
  assert.match(last.error, /Could not extract financials/);
  assert.ok(!res.events.some(e => e.step === 4));
  assert.equal(history.length, 0);
});

test('failed screening in the fallback path streams step 99', async () => {
  let calls = 0;
  ingestion.ingestAlternateData = async () => {
    calls += 1;
    if (calls === 1) throw new Error('registry outage');
    return { reportType: 'REGISTRY_SCREENING', gstin: REPORT.gstin, registryReport: REPORT };
  };
  const res = fakeRes();
  await quiet(() => evaluateMSMECredit(fakeReq({ gstin: REPORT.gstin }), res));

  assert.equal(res.ended, true);
  assert.equal(res.events[res.events.length - 1].step, 99);
  assert.ok(!res.events.some(e => e.step === 4));
});

test('statement run applies registry adjustments exactly once and includes the report', async () => {
  history.length = 0;
  ingestion.ingestAlternateData = async () => ({ businessName: 'Real Co', gstin: REPORT.gstin, registryReport: REPORT });
  const res = fakeRes();
  await quiet(() => evaluateMSMECredit(fakeReq({ manualData: 'statement text' }), res));

  const final = res.events.find(e => e.step === 4);
  assert.ok(final, 'step 4 emitted');
  // 700 from synthesis + 15 for REGULAR filing discipline, applied once.
  assert.equal(final.payload.decision.score, 715);
  assert.equal(final.payload.decision.registryAdjustments.length, 1);
  assert.deepEqual(final.payload.registryReport, REPORT);
  assert.equal(history[0].score, 715);
});

test('JEV rejection still ends the stream with step 99', async () => {
  ingestion.ingestAlternateData = async () => ({ businessName: 'X', gstin: null });
  const orig = jev.evaluateAppropriateness;
  jev.evaluateAppropriateness = async () => ({ isAppropriate: false, rationale: 'bad' });
  const res = fakeRes();
  try {
    await quiet(() => evaluateMSMECredit(fakeReq({ manualData: 'x' }), res));
  } finally {
    jev.evaluateAppropriateness = orig;
  }
  assert.equal(res.ended, true);
  assert.equal(res.events[res.events.length - 1].step, 99);
});
