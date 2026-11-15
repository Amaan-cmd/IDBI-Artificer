/**
 * Verifies Microsoft Entra External ID (CIAM) ID tokens.
 * Config: ENTRA_TENANT_ID (directory GUID), ENTRA_CLIENT_ID (app registration),
 * ENTRA_TENANT_SUBDOMAIN (e.g. "artificerid" for artificerid.ciamlogin.com).
 * The app registration must emit the optional "email" ID-token claim.
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const KEY_TTL_MS = 6 * 3600 * 1000;
let keyCache = { keys: null, expiresAt: 0, url: null };
let inflight = null;

const config = () => ({
  tenantId: (process.env.ENTRA_TENANT_ID || '').trim(),
  clientId: (process.env.ENTRA_CLIENT_ID || '').trim(),
  subdomain: (process.env.ENTRA_TENANT_SUBDOMAIN || '').trim()
});

const isEntraConfigured = () => {
  const c = config();
  return Boolean(c.tenantId && c.clientId && c.subdomain);
};

// RSA signing keys only; anything that fails to import is skipped.
function jwksToKeys(jwks) {
  const keys = {};
  for (const jwk of (jwks && Array.isArray(jwks.keys) ? jwks.keys : [])) {
    if (jwk.kty !== 'RSA' || !jwk.kid || (jwk.use && jwk.use !== 'sig')) continue;
    try {
      keys[jwk.kid] = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    } catch {
      // Malformed key: ignore it rather than failing every sign-in.
    }
  }
  return keys;
}

// Signing keys are cached; an unknown kid forces one refresh (key rollover).
async function fetchEntraKeys({ forceRefresh = false, fetchImpl = fetch } = {}) {
  const { tenantId, subdomain } = config();
  const url = `https://${subdomain}.ciamlogin.com/${tenantId}/discovery/v2.0/keys`;
  if (!forceRefresh && keyCache.keys && keyCache.url === url && Date.now() < keyCache.expiresAt) return keyCache.keys;
  if (!inflight) {
    inflight = (async () => {
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`Failed to fetch Entra signing keys (HTTP ${res.status})`);
      const keys = jwksToKeys(await res.json());
      keyCache = { keys, expiresAt: Date.now() + KEY_TTL_MS, url };
      return keys;
    })().finally(() => { inflight = null; });
  }
  return inflight;
}

function providerFrom(idp) {
  const v = String(idp || '').toLowerCase();
  // Email-code accounts carry no idp, or idp "mail" in External ID tokens.
  if (!v || v === 'mail') return 'email';
  if (v.includes('google')) return 'google';
  if (v.includes('apple')) return 'apple';
  return v.replace(/^https?:\/\//, '').split('/')[0] || 'entra';
}

async function verifyEntraIdToken(idToken, {
  tenantId = config().tenantId,
  clientId = config().clientId,
  getKeys = fetchEntraKeys
} = {}) {
  if (!tenantId || !clientId) throw new Error('Entra sign-in is not configured');
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || decoded.header.alg !== 'RS256' || !decoded.header.kid) throw new Error('Malformed ID token');

  let key = (await getKeys())[decoded.header.kid];
  if (!key) key = (await getKeys({ forceRefresh: true }))[decoded.header.kid];
  if (!key) throw new Error('Unknown signing key');

  const payload = jwt.verify(idToken, key, {
    algorithms: ['RS256'],
    audience: clientId,
    issuer: `https://${tenantId}.ciamlogin.com/${tenantId}/v2.0`
  });
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  // Entra verifies the address (email code, Google or Apple) before issuing it.
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('ID token has no email');

  return {
    email,
    name: payload.name || '',
    uid: payload.oid || payload.sub,
    provider: providerFrom(payload.idp)
  };
}

function resetKeyCache() {
  keyCache = { keys: null, expiresAt: 0, url: null };
  inflight = null;
}

module.exports = { verifyEntraIdToken, fetchEntraKeys, jwksToKeys, isEntraConfigured, resetKeyCache };
