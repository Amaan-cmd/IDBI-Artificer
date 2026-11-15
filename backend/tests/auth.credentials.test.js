const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
process.env.SESSION_JWT_SECRET = 'test-secret';
const app = require('../server');
const { useTempStore } = require('./billing/helpers');

// Sign-in creates a billing account; keep it off the real local store.
test.beforeEach(async () => { await useTempStore(); });

async function withServer(fn) {
  const server = app.listen(0);
  await new Promise(r => server.once('listening', r));
  try { await fn(`http://127.0.0.1:${server.address().port}`); } finally { server.close(); }
}
const post = (base, p, body) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('password login endpoint no longer exists', () => withServer(async (base) => {
  const res = await post(base, '/api/v1/users/login', { username: 'andalaus', password: 'Citadel@296', authType: 'client_credential' });
  assert.equal(res.status, 404);
}));

test('custom email-code endpoints are gone (Entra sends sign-in codes)', () => withServer(async (base) => {
  assert.equal((await post(base, '/api/v1/auth/send-code', { email: 'someone@x.com' })).status, 404);
  assert.equal((await post(base, '/api/v1/auth/verify-code', { email: 'someone@x.com', code: '742918' })).status, 404);
}));

test('session endpoint refuses sign-in when Entra is not configured, without leaking why', () => withServer(async (base) => {
  const saved = {};
  for (const k of ['ENTRA_TENANT_ID', 'ENTRA_CLIENT_ID']) { saved[k] = process.env[k]; delete process.env[k]; }
  const { warn } = console; console.warn = () => {};
  try {
    const res = await post(base, '/api/v1/auth/session', { idToken: 'a.b.c' });
    assert.equal(res.status, 401);
    assert.doesNotMatch(JSON.stringify(await res.json()), /configured|Entra/);
  } finally {
    console.warn = warn;
    for (const [k, v] of Object.entries(saved)) if (v !== undefined) process.env[k] = v;
  }
}));

test('auth config exposes only the public Entra client settings', () => withServer(async (base) => {
  const keys = ['ENTRA_TENANT_ID', 'ENTRA_CLIENT_ID', 'ENTRA_TENANT_SUBDOMAIN'];
  const saved = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  try {
    for (const k of keys) delete process.env[k];
    assert.equal((await fetch(base + '/api/v1/auth/config')).status, 503);
    Object.assign(process.env, { ENTRA_TENANT_ID: 'tid', ENTRA_CLIENT_ID: ' cid ', ENTRA_TENANT_SUBDOMAIN: 'artificerid' });
    const res = await fetch(base + '/api/v1/auth/config');
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { clientId: 'cid', tenantSubdomain: 'artificerid' });
  } finally {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
}));

test('no hardcoded master passwords remain in source', () => {
  const roots = [path.join(__dirname, '..', 'controllers'), path.join(__dirname, '..', '..', 'frontend', 'src')];
  const offenders = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.(js|jsx)$/.test(e.name) && /Citadel@296|Saddiesink@296|742918|296296|ENV-ADM-/.test(fs.readFileSync(full, 'utf8'))) offenders.push(full);
    }
  };
  roots.forEach(walk);
  assert.deepEqual(offenders, []);
});
