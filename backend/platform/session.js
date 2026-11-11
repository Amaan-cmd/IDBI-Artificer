/**
 * Server-issued session tokens (HS256 JWT). Issued only after the server has
 * verified the identity itself (email OTP, Firebase ID token).
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const SESSION_TTL = '12h';

function normaliseEmail(email) {
  return String(email || '').trim().toLowerCase();
}

let devFallbackSecret = null;

function sessionSecret() {
  const secret = process.env.SESSION_JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_JWT_SECRET is required in production');
  }
  // Non-production without a configured secret: use a random per-process
  // secret so tokens can never be forged with a well-known value. Sessions
  // simply become invalid when the process restarts.
  if (!devFallbackSecret) {
    devFallbackSecret = crypto.randomBytes(32).toString('hex');
    console.warn('[Session] SESSION_JWT_SECRET not set; using a random per-process secret.');
  }
  return devFallbackSecret;
}

function issueSessionToken(user) {
  return jwt.sign(
    { uid: user.id || '', name: user.username || '', role: user.role || '', provider: user.provider || '' },
    sessionSecret(),
    { algorithm: 'HS256', expiresIn: SESSION_TTL, subject: normaliseEmail(user.email) }
  );
}

function verifySessionToken(token) {
  const p = jwt.verify(token, sessionSecret(), { algorithms: ['HS256'] });
  return { email: p.sub, uid: p.uid, name: p.name, role: p.role, provider: p.provider };
}

module.exports = { issueSessionToken, verifySessionToken, normaliseEmail };
