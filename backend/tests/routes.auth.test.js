const test = require('node:test');
const assert = require('node:assert/strict');
process.env.SESSION_JWT_SECRET = 'test-secret';
const app = require('../server');
const { issueSessionToken } = require('../platform/session');

async function withServer(fn) {
  const server = app.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(base); } finally { server.close(); }
}

for (const [method, path] of [['POST', '/api/v1/evaluate'], ['POST', '/api/v1/chat/xai'], ['GET', '/api/v1/history'], ['GET', '/api/v1/users'], ['GET', '/api/v1/telemetry/logins']]) {
  test(`${method} ${path} requires a session`, () => withServer(async (base) => {
    const res = await fetch(base + path, { method });
    assert.equal(res.status, 401);
  }));
}

test('/api/v1/users requires admin', () => withServer(async (base) => {
  const user = issueSessionToken({ id: 'u', email: 'someone@x.com' });
  const admin = issueSessionToken({ id: 'a', email: 'boss@enveraitech.com' });
  assert.equal((await fetch(`${base}/api/v1/users`, { headers: { authorization: `Bearer ${user}` } })).status, 403);
  assert.equal((await fetch(`${base}/api/v1/users`, { headers: { authorization: `Bearer ${admin}` } })).status, 200);
}));

test('history returns only the caller\'s records', () => withServer(async (base) => {
  const t = issueSessionToken({ id: 'u', email: 'nobody-with-history@x.com' });
  const body = await (await fetch(`${base}/api/v1/history`, { headers: { authorization: `Bearer ${t}` } })).json();
  assert.deepEqual(body.history, []);
}));
