const { normaliseEmail } = require('./session');

// Admin = a server-verified session for an @enveraitech.com address.
// Exact domain match only (no subdomains, no lookalike suffixes), exactly one
// '@' and a non-empty local part.
const ADMIN_DOMAIN = 'enveraitech.com';

function isAdminEmail(email) {
  const parts = normaliseEmail(email).split('@');
  return parts.length === 2 && parts[0].length > 0 && parts[1] === ADMIN_DOMAIN;
}

module.exports = { isAdminEmail };
