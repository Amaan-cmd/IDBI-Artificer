const test = require('node:test');
const assert = require('node:assert/strict');
const { createSandboxClient } = require('../../services/registry/sandboxClient');

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function fakeFetch(handlers) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    const h = handlers.shift();
    if (!h) throw new Error(`unexpected call ${url}`);
    return typeof h === 'function' ? h(url, init) : h;
  };
  fn.calls = calls;
  return fn;
}

const AUTH_OK = jsonResponse(200, { code: 200, data: { access_token: 'tok1' } });
const opts = (fetchImpl, extra = {}) => ({ apiKey: 'k', apiSecret: 's', baseUrl: 'https://sb.test', fetchImpl, ...extra });

test('authenticates once and reuses the token', async () => {
  const f = fakeFetch([AUTH_OK, jsonResponse(200, { code: 200, data: { x: 1 }, transaction_id: 't1' }), jsonResponse(200, { code: 200, data: { x: 2 }, transaction_id: 't2' })]);
  const c = createSandboxClient(opts(f));
  const a = await c.post('/a', { q: 1 });
  const b = await c.post('/b', { q: 2 });
  assert.equal(a.ok, true); assert.equal(a.transactionId, 't1');
  assert.equal(b.body.data.x, 2);
  assert.equal(f.calls.filter(c => c.url.endsWith('/authenticate')).length, 1);
  assert.equal(f.calls[1].init.headers.authorization, 'tok1');
  assert.equal(f.calls[1].init.headers['x-api-key'], 'k');
  assert.equal(f.calls[1].init.headers['x-accept-cache'], 'true');
});

test('re-authenticates after token TTL', async () => {
  let now = 0;
  const f = fakeFetch([AUTH_OK, jsonResponse(200, { code: 200, data: {} }), jsonResponse(200, { code: 200, data: { access_token: 'tok2' } }), jsonResponse(200, { code: 200, data: {} })]);
  const c = createSandboxClient(opts(f, { now: () => now }));
  await c.post('/a', {});
  now = 24 * 3600 * 1000;
  await c.post('/a', {});
  assert.equal(f.calls[3].init.headers.authorization, 'tok2');
});

test('maps status_cd "0" FO8000 to not_found', async () => {
  const f = fakeFetch([AUTH_OK, jsonResponse(200, { code: 200, data: { status_cd: '0', error: { error_cd: 'FO8000', message: 'No records found' } }, transaction_id: 'tx' })]);
  const r = await createSandboxClient(opts(f)).post('/gst', {});
  assert.deepEqual(r, { ok: false, kind: 'not_found', code: 'FO8000', message: 'No records found', transactionId: 'tx' });
});

test('maps 521 to not_found and 422 to invalid_input', async () => {
  const f = fakeFetch([AUTH_OK, jsonResponse(521, { code: 521, message: 'not found' }), jsonResponse(422, { code: 422, message: 'Invalid GSTIN pattern' })]);
  const c = createSandboxClient(opts(f));
  assert.equal((await c.post('/x', {})).kind, 'not_found');
  assert.equal((await c.post('/x', {})).kind, 'invalid_input');
});

test('retries once on network error then reports unavailable', async () => {
  const boom = () => { throw new Error('ECONNRESET'); };
  const f = fakeFetch([AUTH_OK, boom, boom]);
  const r = await createSandboxClient(opts(f)).post('/x', {});
  assert.equal(r.ok, false); assert.equal(r.kind, 'unavailable');
});

test('re-authenticates once on 401', async () => {
  const f = fakeFetch([AUTH_OK, jsonResponse(401, { code: 401, message: 'expired' }), jsonResponse(200, { code: 200, data: { access_token: 'tok2' } }), jsonResponse(200, { code: 200, data: { ok: 1 } })]);
  const r = await createSandboxClient(opts(f)).post('/x', {});
  assert.equal(r.ok, true);
});

test('missing credentials → unavailable without network', async () => {
  const f = fakeFetch([]);
  const r = await createSandboxClient({ apiKey: '', apiSecret: '', fetchImpl: f }).post('/x', {});
  assert.equal(r.kind, 'unavailable'); assert.equal(r.code, 'NO_CREDENTIALS');
});

test('GET sends no body', async () => {
  const f = fakeFetch([AUTH_OK, jsonResponse(200, { code: 200, data: {} })]);
  await createSandboxClient(opts(f)).get('/search?company_name=abc');
  assert.equal(f.calls[1].init.method, 'GET');
  assert.equal(f.calls[1].init.body, undefined);
});
