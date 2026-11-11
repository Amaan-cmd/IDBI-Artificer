const { verifySessionToken } = require('../platform/session');
const { isAdminEmail } = require('../platform/admin');

function requireSession(req, res, next) {
  const match = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!match) {
    return res.status(401).json({ code: 'SESSION_REQUIRED', error: 'Sign in required.' });
  }
  try {
    req.session = verifySessionToken(match[1]);
    return next();
  } catch {
    return res.status(401).json({ code: 'SESSION_REQUIRED', error: 'Session expired. Please sign in again.' });
  }
}

function requireAdmin(req, res, next) {
  if (req.session && isAdminEmail(req.session.email)) return next();
  return res.status(403).json({ code: 'ADMIN_REQUIRED', error: 'Administrator access required.' });
}

module.exports = { requireSession, requireAdmin };
