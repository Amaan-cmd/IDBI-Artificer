const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { issueSessionToken, verifySessionToken } = require('../platform/session');
const { requireSession, requireAdmin } = require('../middleware/requireSession');

process.env.SESSION_JWT_SECRET = 'test-secret';

function run(mw, headers = {}) {
  const req = { headers };
  let status = null; let body = null; let nextCalled = false;
  const res = { status(s) { status = s; return this; }, json(b) { body = b; return this; } };
  mw(req, res, () => { nextCalled = true; });
  return { req, status, body, nextCalled };
}

test('issue/verify round-trips with lowercase email subject', () => {
  const t = issueSessionToken({ id: 'u_1', email: 'Officer@Bank.IN', username: 'Officer', role: 'Analyst', provider: 'google' });
  assert.deepEqual(verifySessionToken(t), { email: 'officer@bank.in', uid: 'u_1', name: 'Officer', role: 'Analyst', provider: 'google' });
});

test('requireSession rejects missing header', () => {
  const r = run(requireSession);
  assert.equal(r.status, 401);
  assert.equal(r.body.code, 'SESSION_REQUIRED');
  assert.equal(r.nextCalled, false);
});

test('requireSession rejects expired token', () => {
  const t = jwt.sign({ uid: 'u_1' }, 'test-secret', { algorithm: 'HS256', subject: 'a@b.c', expiresIn: -10 });
  assert.equal(run(requireSession, { authorization: `Bearer ${t}` }).status, 401);
});

test('requireSession rejects token signed with another secret', () => {
  const t = jwt.sign({ uid: 'u_1' }, 'other', { algorithm: 'HS256', subject: 'a@b.c' });
  assert.equal(run(requireSession, { authorization: `Bearer ${t}` }).status, 401);
});

test('requireSession accepts valid token and sets req.session', () => {
  const t = issueSessionToken({ id: 'u_2', email: 'x@y.com' });
  const r = run(requireSession, { authorization: `Bearer ${t}` });
  assert.equal(r.nextCalled, true);
  assert.equal(r.req.session.email, 'x@y.com');
});

test('requireAdmin allows @enveraitech.com sessions only', () => {
  const ok = { headers: {}, session: { email: 'boss@enveraitech.com' } };
  const lookalike = { headers: {}, session: { email: 'boss@enveraitech.com.evil.io' } };
  const sub = { headers: {}, session: { email: 'x@mail.enveraitech.com' } };
  const no = { headers: {}, session: { email: 'someone@x.com' } };
  let status = null; let passed = false;
  const res = { status(s) { status = s; return this; }, json() { return this; } };
  requireAdmin(ok, res, () => { passed = true; });
  assert.equal(passed, true);
  for (const req of [lookalike, sub, no]) {
    status = null;
    requireAdmin(req, res, () => { throw new Error(`should not pass: ${req.session.email}`); });
    assert.equal(status, 403);
  }
});
