// 15-character GSTIN: 2-digit state code, 10-character PAN, entity number,
// literal 'Z', checksum character.
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

module.exports = { GSTIN_RE };
