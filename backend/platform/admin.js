const { normaliseEmail } = require('./session');

// Admin = a server-verified session for an @enveraitech.com address.
// Exact domain match only (no subdomains, no lookalike suffixes).
const ADMIN_DOMAIN = 'enveraitech.com';

function isAdminEmail(email) {
  const clean = normaliseEmail(email);
  const at = clean.lastIndexOf('@');
  return at > 0 && clean.slice(at + 1) === ADMIN_DOMAIN;
}

module.exports = { isAdminEmail };
