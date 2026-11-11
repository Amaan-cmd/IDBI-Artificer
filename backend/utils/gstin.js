// 15-character GSTIN: 2-digit state code, 10-character PAN, entity number,
// literal 'Z', checksum character.
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// GSTN check digit over the first 14 characters (base-36, alternating
// weights 1 and 2, digits of each product summed in base 36).
function gstinCheckChar(first14) {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const value = CHARSET.indexOf(first14[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(value / 36) + (value % 36);
  }
  return CHARSET[(36 - (sum % 36)) % 36];
}

function isValidGstin(gstin) {
  return typeof gstin === 'string' && GSTIN_RE.test(gstin) && gstinCheckChar(gstin) === gstin[14];
}

// Request-level acceptance: a checksum-valid GSTIN, or (in demo mode only) one
// of the built-in sample entities, which never reach the live provider.
function isAcceptedGstin(gstin) {
  if (isValidGstin(gstin)) return true;
  const { isDemoMode } = require('../platform/demoMode');
  const { isDemoEntity } = require('../demo/demoEntities');
  return isDemoMode() && isDemoEntity(gstin);
}

module.exports = { GSTIN_RE, isValidGstin, isAcceptedGstin, gstinCheckChar };
