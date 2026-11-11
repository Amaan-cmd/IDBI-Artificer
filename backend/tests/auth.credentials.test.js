const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
process.env.SESSION_JWT_SECRET = 'test-secret';
const app = require('../server');

// The OTP flow writes users.json and telemetry_logins.json; restore them afterwards.
const dataFiles = ['users.json', 'telemetry_logins.json'].map(f => path.join(__dirname, '..', 'data', f));
const snapshots = new Map();
test.before(() => {
  for (const f of dataFiles) snapshots.set(f, fs.existsSync(f) ? fs.readFileSync(f) : null);
});
test.after(() => {
  for (const [f, content] of snapshots) {
    if (content === null) { if (fs.existsSync(f)) fs.unlinkSync(f); } else fs.writeFileSync(f, content);
  }
});

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

test('former demo OTP codes are rejected', () => withServer(async (base) => {
  for (const code of ['742918', '296296']) {
    const res = await post(base, '/api/v1/auth/verify-code', { email: 'someone@x.com', code });
    assert.equal(res.status, 401);
  }
}));

test('valid OTP returns a session token', () => withServer(async (base) => {
  const prev = process.env.ENABLE_DEMO_OTP;
  const prevEnv = process.env.NODE_ENV;
  process.env.ENABLE_DEMO_OTP = 'true';
  process.env.NODE_ENV = 'test'; // a local .env may set production, which hides demoCode
  try {
    const sent = await (await post(base, '/api/v1/auth/send-code', { email: 'otp-user@x.com' })).json();
    const res = await post(base, '/api/v1/auth/verify-code', { email: 'otp-user@x.com', code: sent.demoCode });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.ok(body.sessionToken);
  } finally {
    if (prev === undefined) delete process.env.ENABLE_DEMO_OTP; else process.env.ENABLE_DEMO_OTP = prev;
    if (prevEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = prevEnv;
  }
}));

test('no hardcoded master passwords remain in source', { todo: 'frontend cleanup in Task 8b' }, () => {
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
