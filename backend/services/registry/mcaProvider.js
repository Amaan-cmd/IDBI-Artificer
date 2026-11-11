/**
 * MCA21 company master data via Sandbox. Directors, charges and litigation are
 * not offered by this provider.
 */
const { getSandboxClient } = require('./sandboxClient');

const SOURCE = 'MCA21 via Sandbox';
const CIN_RE = /^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/;
const NOT_COVERED = Object.freeze({ status: 'unavailable', reason: 'Not covered by current data provider', source: null });

function normaliseCompanyName(name) {
  return String(name || '')
    .toUpperCase()
    .replace(/^M\/S\.?\s*/, '')
    .replace(/&/g, ' AND ')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(t => (t === 'PVT' ? 'PRIVATE' : t === 'LTD' ? 'LIMITED' : t))
    .join(' ');
}

function mapCompany(d) {
  return {
    cin: d.cin,
    companyName: d.company_name || '',
    status: d.company_status || '',
    incorporationDate: d.company_registration_date || null,
    authorizedCapital: d.authorized_capital ?? null,
    paidUpCapital: d.paidup_capital ?? null,
    companyClass: d.company_class || '',
    companyCategory: d.company_category || '',
    rocCode: d.company_roc_code || '',
    nicCode: d.nic_code || '',
    industry: d.company_industrial_classification || '',
    registeredAddress: d.registered_office_address || '',
    listingStatus: d.listing_status || ''
  };
}

async function getCompany(cin, { client = getSandboxClient(), now = () => new Date() } = {}) {
  const clean = String(cin || '').trim().toUpperCase();
  if (!CIN_RE.test(clean)) {
    return { status: 'unavailable', reason: `MCA21 master data supports company CINs only (got ${clean || 'none'})`, source: SOURCE };
  }
  const r = await client.post('/kyc/mca/company/master-data', { cin: clean });
  if (!r.ok) {
    return {
      status: 'unavailable',
      reason: r.kind === 'not_found' ? 'Company not found on MCA21' : `MCA21 lookup failed (${r.code})`,
      source: SOURCE,
      transactionId: r.transactionId || null
    };
  }
  const d = Array.isArray(r.body?.data) ? r.body.data[0] : r.body?.data;
  if (!d) return { status: 'unavailable', reason: 'Empty MCA21 response', source: SOURCE, transactionId: r.transactionId };
  return { status: 'ok', data: mapCompany(d), source: SOURCE, fetchedAt: now().toISOString(), transactionId: r.transactionId };
}

async function findCompanyByName(legalName, { client = getSandboxClient(), now = () => new Date() } = {}) {
  const name = String(legalName || '').trim();
  if (name.length < 3) return { status: 'unavailable', reason: 'Legal name too short to search MCA21', source: SOURCE };

  const r = await client.get(`/kyc/mca/company/master-data/search?company_name=${encodeURIComponent(name)}`);
  if (!r.ok) {
    return {
      status: 'unavailable',
      reason: r.kind === 'not_found' ? 'No MCA21 company matches the GST legal name' : `MCA21 search failed (${r.code})`,
      source: SOURCE,
      transactionId: r.transactionId || null
    };
  }
  const records = r.body?.data?.records || [];
  const target = normaliseCompanyName(name);
  const exact = records.filter(rec => normaliseCompanyName(rec.company_name) === target);
  if (exact.length === 1) {
    return { status: 'ok', data: { cin: exact[0].cin, companyName: exact[0].company_name }, source: SOURCE, fetchedAt: now().toISOString(), transactionId: r.transactionId };
  }
  if (records.length === 0) {
    return { status: 'unavailable', reason: 'No MCA21 company matches the GST legal name', source: SOURCE, transactionId: r.transactionId };
  }
  return {
    status: 'ambiguous',
    candidates: records.slice(0, 10).map(rec => ({ cin: rec.cin, name: rec.company_name || '' })),
    source: SOURCE,
    transactionId: r.transactionId
  };
}

module.exports = { getCompany, findCompanyByName, normaliseCompanyName, NOT_COVERED, SOURCE };
