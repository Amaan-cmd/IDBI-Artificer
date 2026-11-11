const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { verifyFirebaseIdToken } = require('../platform/firebaseVerify');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const pubPem = publicKey.export({ type: 'spki', format: 'pem' });
const getCerts = async () => ({ kid1: pubPem });
const PROJECT = 'test-project';

function token(claims = {}, opts = {}) {
  return jwt.sign(
    { email: 'User@Gmail.com', email_verified: true, name: 'User', firebase: { sign_in_provider: 'google.com' }, ...claims },
    privateKey,
    { algorithm: 'RS256', keyid: 'kid1', audience: PROJECT, issuer: `https://securetoken.google.com/${PROJECT}`, subject: 'firebase-uid', expiresIn: 300, ...opts }
  );
}

test('accepts a valid token and lowercases the email', async () => {
  const r = await verifyFirebaseIdToken(token(), { projectId: PROJECT, getCerts });
  assert.deepEqual(r, { email: 'user@gmail.com', name: 'User', uid: 'firebase-uid', provider: 'google.com' });
});

test('rejects unverified email', async () => {
  await assert.rejects(verifyFirebaseIdToken(token({ email_verified: false }), { projectId: PROJECT, getCerts }), /not verified/);
});

test('rejects wrong audience', async () => {
  await assert.rejects(verifyFirebaseIdToken(token({}, { audience: 'other' }), { projectId: PROJECT, getCerts }));
});

test('rejects unknown key id', async () => {
  await assert.rejects(verifyFirebaseIdToken(token({}, { keyid: 'nope' }), { projectId: PROJECT, getCerts }), /Unknown signing key/);
});

test('rejects expired token', async () => {
  await assert.rejects(verifyFirebaseIdToken(token({}, { expiresIn: -10 }), { projectId: PROJECT, getCerts }));
});

test('fetchGoogleCerts shares one in-flight request, caches, and does not cache failures', async () => {
  const { fetchGoogleCerts, resetCertCache } = require('../platform/firebaseVerify');
  resetCertCache();
  let calls = 0;
  const ok = async () => { calls++; return { ok: true, status: 200, json: async () => ({ k: 'pem' }), headers: { get: () => 'public, max-age=600' } }; };
  const [a, b] = await Promise.all([fetchGoogleCerts({ fetchImpl: ok }), fetchGoogleCerts({ fetchImpl: ok })]);
  assert.equal(calls, 1);
  assert.deepEqual(a, { k: 'pem' });
  assert.equal(a, b);
  await fetchGoogleCerts({ fetchImpl: ok });
  assert.equal(calls, 1);

  resetCertCache();
  const bad = async () => ({ ok: false, status: 503 });
  await assert.rejects(fetchGoogleCerts({ fetchImpl: bad }), /HTTP 503/);
  assert.deepEqual(await fetchGoogleCerts({ fetchImpl: ok }), { k: 'pem' });
  resetCertCache();
});
