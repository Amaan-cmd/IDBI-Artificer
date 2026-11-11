const test = require('node:test');
const assert = require('node:assert/strict');
process.env.SESSION_JWT_SECRET = 'test-secret';
const app = require('../server');
const { issueSessionToken } = require('../platform/session');

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
