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

async function withEnv(vars, fn) {
  const prev = {};
  for (const k of Object.keys(vars)) prev[k] = process.env[k];
  for (const [k, v] of Object.entries(vars)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  try { return await fn(); } finally {
    for (const [k, v] of Object.entries(prev)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
}

async function captureLogs(fn) {
  const lines = [];
  const orig = { log: console.log, info: console.info, warn: console.warn };
  for (const k of Object.keys(orig)) console[k] = (...a) => { lines.push(a.map(String).join(' ')); };
  try { await fn(); } finally { Object.assign(console, orig); }
  return lines;
}

test('send-code never logs the OTP in production', () => withServer(async (base) => {
  await withEnv({ NODE_ENV: 'production', ENABLE_DEMO_OTP: undefined }, async () => {
    const lines = await captureLogs(async () => {
      const res = await post(base, '/api/v1/auth/send-code', { email: 'prod-user@x.com' });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.demoCode, undefined);
    });
    assert.ok(!lines.some(l => /\b\d{6}\b/.test(l)), `OTP-like code leaked to logs: ${lines.join(' | ')}`);
  });
}));

test('send-code logs the OTP outside production (local use)', () => withServer(async (base) => {
  await withEnv({ NODE_ENV: 'test', ENABLE_DEMO_OTP: 'true' }, async () => {
    let code;
    const lines = await captureLogs(async () => {
      code = (await (await post(base, '/api/v1/auth/send-code', { email: 'dev-user@x.com' })).json()).demoCode;
    });
    assert.ok(code);
    assert.ok(lines.some(l => l.includes(code)));
  });
}));

test('OTP is invalidated after 5 wrong attempts', () => withServer(async (base) => {
  await withEnv({ NODE_ENV: 'test', ENABLE_DEMO_OTP: 'true' }, async () => {
    const email = 'brute-target@x.com';
    const { demoCode } = await (await post(base, '/api/v1/auth/send-code', { email })).json();
    const wrong = String(((Number(demoCode) - 100000 + 1) % 900000) + 100000);
    for (let i = 0; i < 5; i++) {
      assert.equal((await post(base, '/api/v1/auth/verify-code', { email, code: wrong })).status, 401);
    }
    const res = await post(base, '/api/v1/auth/verify-code', { email, code: demoCode });
    assert.equal(res.status, 401, 'correct code must be rejected once the attempt cap is hit');
  });
}));

test('OTP still verifies after fewer than 5 wrong attempts', () => withServer(async (base) => {
  await withEnv({ NODE_ENV: 'test', ENABLE_DEMO_OTP: 'true' }, async () => {
    const email = 'typo-user@x.com';
    const { demoCode } = await (await post(base, '/api/v1/auth/send-code', { email })).json();
    const wrong = String(((Number(demoCode) - 100000 + 1) % 900000) + 100000);
    for (let i = 0; i < 4; i++) await post(base, '/api/v1/auth/verify-code', { email, code: wrong });
    assert.equal((await post(base, '/api/v1/auth/verify-code', { email, code: demoCode })).status, 200);
  });
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
