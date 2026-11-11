/**
 * Verifies Firebase Auth ID tokens without firebase-admin, per
 * https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
 */
const jwt = require('jsonwebtoken');

const CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let certCache = { certs: null, expiresAt: 0 };

let inflight = null;

// Cached per Google's Cache-Control max-age. Concurrent callers share one
// in-flight request; failures are not cached so the next call retries.
async function fetchGoogleCerts({ fetchImpl = fetch } = {}) {
  if (certCache.certs && Date.now() < certCache.expiresAt) return certCache.certs;
  if (!inflight) {
    inflight = (async () => {
      const res = await fetchImpl(CERTS_URL, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`Failed to fetch Firebase signing certs (HTTP ${res.status})`);
      const certs = await res.json();
      const maxAge = /max-age=(\d+)/.exec(res.headers.get('cache-control') || '');
      certCache = { certs, expiresAt: Date.now() + (maxAge ? Number(maxAge[1]) * 1000 : 3600 * 1000) };
      return certs;
    })().finally(() => { inflight = null; });
  }
  return inflight;
}

function resetCertCache() {
  certCache = { certs: null, expiresAt: 0 };
  inflight = null;
}

async function verifyFirebaseIdToken(idToken, {
  projectId = process.env.FIREBASE_PROJECT_ID || 'idbi-innovate',
  getCerts = fetchGoogleCerts
} = {}) {
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || decoded.header.alg !== 'RS256' || !decoded.header.kid) {
    throw new Error('Malformed ID token');
  }
  const certs = await getCerts();
  const cert = certs[decoded.header.kid];
  if (!cert) throw new Error('Unknown signing key');

  const payload = jwt.verify(idToken, cert, {
    algorithms: ['RS256'],
    audience: projectId,
    issuer: `https://securetoken.google.com/${projectId}`
  });
  if (!payload.sub) throw new Error('ID token has no subject');
  if (!payload.email || payload.email_verified !== true) throw new Error('Email not verified');

  return {
    email: String(payload.email).toLowerCase(),
    name: payload.name || '',
    uid: payload.sub,
    provider: payload.firebase?.sign_in_provider || 'firebase'
  };
}

module.exports = { verifyFirebaseIdToken, fetchGoogleCerts, resetCertCache };
