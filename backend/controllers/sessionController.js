const { verifyFirebaseIdToken } = require('../platform/firebaseVerify');
const { issueSessionToken } = require('../platform/session');
const { findOrCreateUser, recordTelemetryLogin } = require('./userController');

async function createSession(req, res) {
  const idToken = typeof req.body?.idToken === 'string' ? req.body.idToken : '';
  if (!idToken) return res.status(400).json({ error: 'idToken is required.' });

  let identity;
  try {
    identity = await verifyFirebaseIdToken(idToken);
  } catch (err) {
    console.warn('[Auth] Firebase ID token rejected:', err.message);
    return res.status(401).json({ code: 'INVALID_ID_TOKEN', error: 'Sign-in could not be verified.' });
  }

  const user = findOrCreateUser(identity);
  await recordTelemetryLogin({
    user,
    email: identity.email,
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '',
    userAgent: req.headers['user-agent'] || '',
    type: `firebase_${identity.provider}`,
    status: 'AUTHORIZED'
  });

  return res.json({ status: 'success', user, sessionToken: issueSessionToken(user) });
}

module.exports = { createSession };
