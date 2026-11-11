/**
 * GSTN public data (registration + return filing history) via Sandbox.
 */
const { getSandboxClient } = require('./sandboxClient');

const SOURCE = 'GSTN via Sandbox';

function ddmmyyyyToIso(value) {
  const m = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(String(value || '').trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function formatAddress(addr = {}) {
  return [addr.bno, addr.flno, addr.bnm, addr.st, addr.loc || addr.locality, addr.dst, addr.stcd, addr.pncd]
    .map(s => String(s || '').trim())
    .filter(Boolean)
    .join(', ');
}

function unavailable(result, notFoundReason, failureLabel) {
  return {
    status: 'unavailable',
    reason: result.kind === 'not_found'
      ? notFoundReason
      : result.kind === 'invalid_input'
        ? 'GSTIN rejected by the GST portal as invalid'
        : `${failureLabel} (${result.code})`,
    source: SOURCE,
    transactionId: result.transactionId || null
  };
}

function mapGstinRecord(d) {
  return {
    gstin: d.gstin,
    legalName: d.lgnm || '',
    tradeName: d.tradeNam || '',
    status: d.sts || '',
    registrationDate: ddmmyyyyToIso(d.rgdt),
    cancellationDate: ddmmyyyyToIso(d.cxdt),
    constitution: d.ctb || '',
    taxpayerType: d.dty || '',
    natureOfBusiness: Array.isArray(d.nba) ? d.nba : [],
    principalAddress: formatAddress(d.pradr?.addr),
    einvoiceStatus: d.einvoiceStatus || '',
    lastUpdated: ddmmyyyyToIso(d.lstupdt)
  };
}

function mapFiling(f) {
  const p = String(f.ret_prd || '');
  return {
    returnType: String(f.rtntype || '').toUpperCase().replace(/[^A-Z0-9]/g, ''),
    period: /^\d{6}$/.test(p) ? `${p.slice(2)}-${p.slice(0, 2)}` : null,
    filedOn: ddmmyyyyToIso(f.dof),
    arn: f.arn || '',
    mode: f.mof || '',
    status: f.status || '',
    valid: f.valid === 'Y'
  };
}

const IST_OFFSET_MS = 330 * 60 * 1000;

// Indian financial year (April–March), evaluated in IST so the 1 April
// rollover happens at local midnight rather than 05:30 IST.
function financialYearOf(date) {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const year = ist.getUTCFullYear();
  const start = ist.getUTCMonth() + 1 >= 4 ? year : year - 1;
  return `FY ${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

async function searchGstin(gstin, { client = getSandboxClient(), now = () => new Date() } = {}) {
  const r = await client.post('/gst/compliance/public/gstin/search', { gstin });
  if (!r.ok) return unavailable(r, 'GSTIN not found on GST portal', 'GST portal lookup failed');
  const d = r.body?.data?.data;
  if (!d) return { status: 'unavailable', reason: 'Empty GST portal response', source: SOURCE, transactionId: r.transactionId };
  return { status: 'ok', data: mapGstinRecord(d), source: SOURCE, fetchedAt: now().toISOString(), transactionId: r.transactionId };
}

async function trackReturns(gstin, financialYear, { client = getSandboxClient(), now = () => new Date() } = {}) {
  const r = await client.post(`/gst/compliance/public/gstrs/track?financial_year=${encodeURIComponent(financialYear)}`, { gstin });
  if (!r.ok) {
    if (r.code === 'RET13510') {
      return { status: 'ok', data: [], source: SOURCE, fetchedAt: now().toISOString(), transactionId: r.transactionId };
    }
    return unavailable(r, 'No filing records found', 'GST filing history lookup failed');
  }
  const list = r.body?.data?.data?.EFiledlist || [];
  return { status: 'ok', data: list.map(mapFiling).filter(f => f.period), source: SOURCE, fetchedAt: now().toISOString(), transactionId: r.transactionId };
}

module.exports = { searchGstin, trackReturns, financialYearOf, SOURCE };
