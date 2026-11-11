const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

// Stub the registry service before the controller captures it.
const servicePath = require.resolve(path.join(__dirname, '../services/registry/registryService'));
const calls = [];
let impl = async () => ({ gstin: 'stub' });
require.cache[servicePath] = {
  id: servicePath, filename: servicePath, loaded: true,
  exports: { getRegistryReport: (...args) => { calls.push(args); return impl(...args); } }
};
const { getRegistry } = require('../controllers/registryController');

function run(params, query = {}) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(body) { resolve({ status: this.statusCode, body }); return this; }
    };
    getRegistry({ params, query }, res);
  });
}

test.beforeEach(() => { calls.length = 0; impl = async () => ({ gstin: 'stub' }); delete process.env.DEMO_MODE; });

test('invalid GSTIN is rejected before any provider call', async () => {
  const r = await run({ gstin: '24AAACQ1234A1Z' });
  assert.equal(r.status, 400);
  assert.equal(r.body.code, 'INVALID_GSTIN');
  assert.equal(calls.length, 0);
});

test('provider failure returns 503 without leaking the error', async () => {
  impl = async () => { throw new Error('SANDBOX_API_KEY=sk_live_secret rejected'); };
  const orig = console.error; console.error = () => {};
  try {
    const r = await run({ gstin: '24aaacq1234a1z5' });
    assert.equal(r.status, 503);
    assert.equal(r.body.code, 'REGISTRY_UNAVAILABLE');
    assert.doesNotMatch(JSON.stringify(r.body), /secret|SANDBOX/);
  } finally { console.error = orig; }
});

test('GSTIN is normalised and cin query is passed through upper-cased', async () => {
  const r = await run({ gstin: ' 24aaacq1234a1z5 ' }, { cin: ' u12345mh2020ptc123456 ' });
  assert.equal(r.status, 200);
  assert.deepEqual(calls[0], ['24AAACQ1234A1Z5', { cin: 'U12345MH2020PTC123456' }]);
  await run({ gstin: '24AAACQ1234A1Z5' }, { cin: ['a', 'b'] });
  assert.deepEqual(calls[1][1], { cin: null });
});

test('preset GSTIN returns sample data only in demo mode', async () => {
  const preset = '27AAHCE5539J1ZA';
  let r = await run({ gstin: preset });
  assert.equal(calls.length, 1, 'outside demo mode presets go to the real service');
  assert.equal(r.body.registryReport.sampleData, undefined);

  process.env.DEMO_MODE = 'true';
  r = await run({ gstin: preset });
  assert.equal(calls.length, 1, 'demo preset must not call providers');
  assert.equal(r.body.registryReport.sampleData, true);
  assert.equal(r.body.registryReport.gst.source, 'Sample data (demo mode)');

  r = await run({ gstin: '24AAACQ1234A1Z5' });
  assert.equal(calls.length, 2, 'non-preset GSTIN in demo mode still uses the real service');
});
