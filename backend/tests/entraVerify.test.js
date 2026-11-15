const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { verifyEntraIdToken, jwksToKeys } = require('../platform/entraVerify');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const TENANT = '11111111-2222-3333-4444-555555555555';
const CLIENT = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const cfg = { tenantId: TENANT, clientId: CLIENT, getKeys: async () => ({ kid1: publicKey }) };

function token(claims = {}, opts = {}) {
  return jwt.sign(
    { email: 'User@Gmail.com', name: 'User', oid: 'object-id', ...claims },
    privateKey,
    { algorithm: 'RS256', keyid: 'kid1', audience: CLIENT, issuer: `https://${TENANT}.ciamlogin.com/${TENANT}/v2.0`, subject: 'entra-sub', expiresIn: 300, ...opts }
  );
}

test('accepts a valid token, lowercases the email, maps the provider', async () => {
  assert.deepEqual(await verifyEntraIdToken(token({ idp: 'google.com' }), cfg),
    { email: 'user@gmail.com', name: 'User', uid: 'object-id', provider: 'google' });
  assert.equal((await verifyEntraIdToken(token({ idp: 'https://appleid.apple.com' }), cfg)).provider, 'apple');
  assert.equal((await verifyEntraIdToken(token(), cfg)).provider, 'email');
});

test('rejects a token without an email claim', async () => {
  await assert.rejects(verifyEntraIdToken(token({ email: undefined }), cfg), /email/i);
  await assert.rejects(verifyEntraIdToken(token({ email: 'not-an-email' }), cfg), /email/i);
});

test('rejects wrong audience, wrong issuer, unknown key, expired', async () => {
  await assert.rejects(verifyEntraIdToken(token({}, { audience: 'other' }), cfg));
  await assert.rejects(verifyEntraIdToken(token({}, { issuer: 'https://login.microsoftonline.com/x/v2.0' }), cfg));
  await assert.rejects(verifyEntraIdToken(token({}, { keyid: 'nope' }), cfg), /Unknown signing key/);
  await assert.rejects(verifyEntraIdToken(token({}, { expiresIn: -10 }), cfg));
});

test('rejects non-RS256 and malformed tokens', async () => {
  const hs = jwt.sign({ email: 'a@b.com' }, 'secret', { algorithm: 'HS256', keyid: 'kid1', audience: CLIENT });
  await assert.rejects(verifyEntraIdToken(hs, cfg), /Malformed/);
  await assert.rejects(verifyEntraIdToken('garbage', cfg), /Malformed/);
});

test('refuses to verify when Entra is not configured', async () => {
  await assert.rejects(verifyEntraIdToken(token(), { ...cfg, tenantId: '', clientId: '' }), /not configured/);
});

test('jwksToKeys converts RSA JWKs and skips other keys', () => {
  const jwk = publicKey.export({ format: 'jwk' });
  const keys = jwksToKeys({ keys: [{ ...jwk, kid: 'k1', use: 'sig' }, { kty: 'EC', kid: 'ec' }, { kid: 'bad', kty: 'RSA' }] });
  assert.deepEqual(Object.keys(keys), ['k1']);
  const t = token({}, { keyid: 'k1' });
  assert.doesNotThrow(() => jwt.verify(t, keys.k1, { algorithms: ['RS256'] }));
});
