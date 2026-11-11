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
stub('services/slackNotifier', { sendSlackNotification: (...a) => slackNotifier.sendSlackNotification(...a) });
stub('utils/azureStorage', { azureStorage: { saveStatementFile: () => {} } });
const jev = {
  evaluateAppropriateness: async () => ({ isAppropriate: true }),
  runDeterministicSanityCheck: () => ({ isAppropriate: true })
};
stub('agents/jevGatekeeper', {
  evaluateAppropriateness: (...a) => jev.evaluateAppropriateness(...a),
  runDeterministicSanityCheck: (...a) => jev.runDeterministicSanityCheck(...a)
});
const analysis = { analyzeFinancials: async () => ({ revenueRunRate: 1, cashBufferRatio: 1, taxCompliance: 'OK' }) };
stub('agents/analysisAgent', { analyzeFinancials: (...a) => analysis.analyzeFinancials(...a) });
const slack = [];
const slackNotifier = { sendSlackNotification: (n) => slack.push(n) };
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

test('fallback path keeps the registry enabled so adjustments still apply', async () => {
  history.length = 0;
  const calls = [];
  ingestion.ingestAlternateData = async (args) => {
    calls.push(args);
    if (calls.length === 1) throw new Error('LLM outage');
    return { businessName: 'Real Co', gstin: REPORT.gstin, monthlyCredits: [1, 2, 3], registryReport: args.enableScraper ? REPORT : null };
  };
  const res = fakeRes();
  await quiet(() => evaluateMSMECredit(fakeReq({ manualData: 'statement text', enableScraper: 'true' }), res));

  assert.equal(calls.length, 2);
  assert.equal(calls[1].enableScraper, true);
  const final = res.events.find(e => e.step === 4);
  assert.ok(final, 'step 4 emitted');
  assert.deepEqual(final.payload.registryReport, REPORT);
  assert.equal(final.payload.decision.registryAdjustments.length, 1);
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

const NULL_METRICS = {
  revenueRunRate: null, cashBufferRatio: null, taxCompliance: 'NOT_ASSESSED',
  pillar1_liquidity: { cashBufferRatio: null, minimumCashBufferDays: null, status: 'NOT_ASSESSED' }
};

test('unavailable metrics are saved and notified as "not available", never null/NaN/0x', async () => {
  history.length = 0;
  slack.length = 0;
  ingestion.ingestAlternateData = async () => ({ businessName: 'Real Co', gstin: REPORT.gstin, registryReport: null });
  const orig = analysis.analyzeFinancials;
  analysis.analyzeFinancials = async () => NULL_METRICS;
  const res = fakeRes();
  try {
    await quiet(() => evaluateMSMECredit(fakeReq({ manualData: 'statement text' }), res));
  } finally {
    analysis.analyzeFinancials = orig;
  }
  assert.ok(res.events.find(e => e.step === 4), 'step 4 emitted');
  const rec = history[0];
  assert.equal(rec.buffer, 'not available');
  assert.equal(rec.revenue, null);
  assert.equal(rec.compliance, 'NOT_ASSESSED');
  const slackText = JSON.stringify(slack[0].fields);
  assert.ok(!/null|NaN|undefined/.test(slackText), slackText);
  assert.match(slackText, /not available/);
});

test('fallback path saves real telemetry for a gapped statement without null text', async () => {
  history.length = 0;
  let calls = 0;
  ingestion.ingestAlternateData = async () => {
    calls += 1;
    if (calls === 1) throw new Error('LLM outage');
    return {
      businessName: 'Real Co', gstin: REPORT.gstin, monthlyCredits: [100000, 110000, 120000], monthlyDebits: [],
      dailyClosingBalances: [], gstr1OutwardTaxable: 0, gstr3bTaxPaid: 0, gstr1DeclaredTax: 0, monthlyEmiObligations: 0,
      transactions: [], dataGaps: ['monthlyDebits', 'dailyClosingBalances', 'gstr1OutwardTaxable', 'gstr3bTaxPaid', 'gstr1DeclaredTax', 'monthlyEmiObligations', 'transactions'],
      registryReport: null
    };
  };
  const res = fakeRes();
  await quiet(() => evaluateMSMECredit(fakeReq({ manualData: 'statement text' }), res));
  assert.ok(res.events.find(e => e.step === 4), 'step 4 emitted');
  const rec = history[0];
  assert.equal(rec.buffer, 'not available');
  assert.equal(rec.compliance, 'NOT_ASSESSED');
  assert.equal(rec.revenue, 1320000);
});

test('fallback path honours a deterministic JEV rejection', async () => {
  history.length = 0;
  let calls = 0;
  ingestion.ingestAlternateData = async () => {
    calls += 1;
    if (calls === 1) throw new Error('LLM outage');
    return { businessName: 'X', monthlyCredits: [1, 2, 3] };
  };
  const orig = jev.runDeterministicSanityCheck;
  jev.runDeterministicSanityCheck = () => ({ isAppropriate: false, verdict: 'REJECTED_UNFIT', rationale: 'injection' });
  const res = fakeRes();
  try {
    await quiet(() => evaluateMSMECredit(fakeReq({ manualData: 'x' }), res));
  } finally {
    jev.runDeterministicSanityCheck = orig;
  }
  assert.equal(res.ended, true);
  assert.equal(res.events[res.events.length - 1].step, 99);
  assert.ok(!res.events.some(e => e.step === 4));
  assert.equal(history.length, 0);
});

test('an unexpected failure inside the fallback path still ends with step 99', async () => {
  let calls = 0;
  ingestion.ingestAlternateData = async () => {
    calls += 1;
    if (calls === 1) throw new Error('LLM outage');
    return { businessName: 'X', monthlyCredits: [1, 2, 3] };
  };
  const orig = synthesis.synthesizeScore;
  synthesis.synthesizeScore = async () => { throw new Error('boom'); };
  const res = fakeRes();
  try {
    await quiet(() => evaluateMSMECredit(fakeReq({ manualData: 'x' }), res));
  } finally {
    synthesis.synthesizeScore = orig;
  }
  assert.equal(res.ended, true);
  const last = res.events[res.events.length - 1];
  assert.equal(last.step, 99);
  assert.ok(last.error);
});

test('GSTIN-only request with a malformed GSTIN is rejected with 400 before streaming', async () => {
  let called = false;
  ingestion.ingestAlternateData = async () => { called = true; return {}; };
  let statusCode = null;
  let body = null;
  const res = fakeRes();
  res.status = (c) => { statusCode = c; return res; };
  res.json = (b) => { body = b; return res; };
  await quiet(() => evaluateMSMECredit(fakeReq({ gstin: 'abc123' }), res));
  assert.equal(statusCode, 400);
  assert.match(body.error, /GSTIN/);
  assert.equal(called, false);
});

test('GSTIN-only request with a wrong check digit is rejected before ingestion', async () => {
  let called = false;
  ingestion.ingestAlternateData = async () => { called = true; return {}; };
  let statusCode = null;
  let body = null;
  const res = fakeRes();
  res.status = (c) => { statusCode = c; return res; };
  res.json = (b) => { body = b; return res; };
  await quiet(() => evaluateMSMECredit(fakeReq({ gstin: '29AABCI1681G1ZN' }), res));
  assert.equal(statusCode, 400);
  assert.equal(body.code, 'INVALID_GSTIN');
  assert.equal(called, false);
});
