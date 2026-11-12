const test = require('node:test');
const assert = require('node:assert/strict');
process.env.SESSION_JWT_SECRET = 'test-secret';
process.env.DEMO_MODE = 'false'; // dotenv does not override, so .env cannot enable demo routes here
const app = require('../server');
const { issueSessionToken } = require('../platform/session');
const { useTempStore } = require('./billing/helpers');
test.beforeEach(() => useTempStore());

test('registry route validates GSTIN and requires a session', async () => {
  const server = app.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(`${base}/api/v1/registry/gstin/24AAACQ1234A1Z5`)).status, 401);
    const auth = { authorization: `Bearer ${issueSessionToken({ id: 'u', email: 'a@b.com' })}` };
    assert.equal((await fetch(`${base}/api/v1/registry/gstin/NOTAGSTIN`, { headers: auth })).status, 400);
  } finally {
    server.close();
  }
});

test('fabricated GST timeline route is gone and the probe alias requires a session', async () => {
  const server = app.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(`${base}/api/v1/alternate-data/gstin-probe/24AAACQ1234A1Z5`)).status, 401);
    const auth = { authorization: `Bearer ${issueSessionToken({ id: 'u', email: 'a@b.com' })}` };
    assert.equal((await fetch(`${base}/api/v1/alternate-data/gstin-probe/NOTAGSTIN`, { headers: auth })).status, 400);
    assert.equal((await fetch(`${base}/api/v1/alternate-data/gst/24AAACQ1234A1Z5`, { headers: auth })).status, 404);
    assert.equal((await fetch(`${base}/api/v1/alternate-data/account-aggregator/x`, { headers: auth })).status, 404);
  } finally {
    server.close();
  }
});
