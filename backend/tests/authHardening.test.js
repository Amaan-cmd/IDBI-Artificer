const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

delete process.env.SESSION_JWT_SECRET;
delete process.env.NODE_ENV;

const { isAdminEmail } = require('../platform/admin');
const { issueSessionToken, verifySessionToken } = require('../platform/session');
const { buildNewUser } = require('../controllers/userController');
const { buildCreateSession } = require('../controllers/sessionController');

test('isAdminEmail requires exactly one @ and a non-empty local part', () => {
  assert.equal(isAdminEmail('boss@enveraitech.com'), true);
  assert.equal(isAdminEmail('  Boss@EnverAITech.COM '), true);
  assert.equal(isAdminEmail('a@b@enveraitech.com'), false);
  assert.equal(isAdminEmail('@enveraitech.com'), false);
  assert.equal(isAdminEmail('enveraitech.com'), false);
  assert.equal(isAdminEmail(''), false);
  assert.equal(isAdminEmail(undefined), false);
});

test('without SESSION_JWT_SECRET, tokens signed with the old well-known dev secret are rejected', () => {
  const forged = jwt.sign({ uid: 'x' }, 'dev-only-insecure-session-secret', { algorithm: 'HS256', subject: 'boss@enveraitech.com' });
  assert.throws(() => verifySessionToken(forged));
  // the process-local fallback still round-trips
  const t = issueSessionToken({ id: 'u', email: 'a@b.com' });
  assert.equal(verifySessionToken(t).email, 'a@b.com');
});

test('buildNewUser rejects emails without exactly one @', () => {
  assert.throws(() => buildNewUser({ email: 'no-at-sign', provider: 'google.com' }), /valid email/);
  assert.throws(() => buildNewUser({ email: 'a@b@c.com', provider: 'google.com' }), /valid email/);
  assert.throws(() => buildNewUser({ email: '@c.com', provider: 'google.com' }), /valid email/);
});

test('buildNewUser ids are unique even for the same handle at the same instant', () => {
  const a = buildNewUser({ email: 'a@x.com', provider: 'google.com' });
  const b = buildNewUser({ email: 'a@y.com', provider: 'google.com' });
  assert.notEqual(a.id, b.id);
  assert.match(a.id, /^u_a_/);
});

test('buildNewUser defaults provider and derives role via exact admin domain', () => {
  const u = buildNewUser({ email: 'Boss@EnverAITech.com' });
  assert.equal(u.provider, 'firebase');
  assert.equal(u.status, 'Active (firebase verified)');
  assert.equal(u.org, 'ENVERAITECH.COM');
  assert.equal(u.role, 'Enterprise Principal Underwriter');
  assert.equal(buildNewUser({ email: 'x@mail.enveraitech.com' }).role, 'Institutional Underwriter');
});

function mockRes() {
  const res = { statusCode: 200, body: null, status(s) { this.statusCode = s; return this; }, json(b) { this.body = b; return this; } };
  return res;
}

function deps(overrides = {}) {
  return {
    verify: async () => ({ email: 'officer@bank.in', name: 'Officer', uid: 'fb1', provider: 'google.com' }),
    findOrCreateUser: (id) => ({ id: 'u_officer_1', email: id.email, username: 'Officer', role: 'Institutional Underwriter', provider: id.provider }),
    recordTelemetryLogin: async () => {},
    ...overrides
  };
}

test('createSession: missing idToken -> 400', async () => {
  const res = mockRes();
  await buildCreateSession(deps())({ body: {}, headers: {}, socket: {} }, res);
  assert.equal(res.statusCode, 400);
});

test('createSession: rejected token -> 401 without leaking the reason', async () => {
  const res = mockRes();
  const createSession = buildCreateSession(deps({ verify: async () => { throw new Error('Email not verified SECRETDETAIL'); } }));
  await createSession({ body: { idToken: 'tok' }, headers: {}, socket: {} }, res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.code, 'INVALID_ID_TOKEN');
  assert.doesNotMatch(JSON.stringify(res.body), /SECRETDETAIL|not verified/);
});

test('createSession: success issues a session token for the verified lowercased email', async () => {
  const res = mockRes();
  let telemetry = null;
  const createSession = buildCreateSession(deps({
    verify: async (tok) => { assert.equal(tok, 'tok'); return { email: 'officer@bank.in', name: 'O', uid: 'fb1', provider: 'google.com' }; },
    findOrCreateUser: (id) => ({ id: 'u_1', email: 'Officer@Bank.IN', username: 'O', role: 'r', provider: id.provider }),
    recordTelemetryLogin: async (e) => { telemetry = e; }
  }));
  await createSession({ body: { idToken: 'tok', email: 'attacker@enveraitech.com' }, headers: {}, socket: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(verifySessionToken(res.body.sessionToken).email, 'officer@bank.in');
  assert.equal(telemetry.type, 'firebase_google.com');
});
