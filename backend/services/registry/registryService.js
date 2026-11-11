/**
 * Assembles a registry report for a GSTIN from real providers, with caching
 * and provenance. Sections fail independently and are never fabricated.
 */
const { getTableStore } = require('../../platform/tableStore');
const gstProvider = require('./gstProvider');
const mcaProvider = require('./mcaProvider');
const { computeFilingMetrics } = require('./filingMetrics');

const HOUR = 3600 * 1000;
const TTL = { gst: 7 * 24 * HOUR, filings: 24 * HOUR, mca: 7 * 24 * HOUR };
const COMPANY_CONSTITUTION = /(private limited|public limited|limited liability partnership|\bllp\b|one person company|unlimited company|public sector undertaking)/i;
const NOT_COVERED = mcaProvider.NOT_COVERED;

async function cached(store, gstin, section, ttlMs, fetcher, now) {
  try {
    const hit = await store.getEntity('registrycache', gstin, section);
    if (hit && now() - Date.parse(hit.storedAt) < ttlMs) {
      return { ...JSON.parse(hit.payload), cached: true };
    }
  } catch (err) {
    console.warn(`[Registry] Cache read failed for ${gstin}/${section}: ${err.message}`);
  }
  const fresh = await fetcher();
  if (fresh.status === 'ok') {
    await store.upsertEntity('registrycache', {
      partitionKey: gstin,
      rowKey: section,
      payload: JSON.stringify(fresh),
      storedAt: new Date(now()).toISOString()
    }).catch(err => console.warn(`[Registry] Cache write failed for ${gstin}/${section}: ${err.message}`));
  }
  return { ...fresh, cached: false };
}

async function fetchFilings(gstin, gst, now) {
  const current = gst.financialYearOf(new Date(now()));
  const startYear = Number(current.slice(3, 7));
  const previous = `FY ${startYear - 1}-${String(startYear % 100).padStart(2, '0')}`;
  const results = await Promise.all([gst.trackReturns(gstin, previous), gst.trackReturns(gstin, current)]);
  const okResults = results.filter(r => r.status === 'ok');
  if (okResults.length === 0) return results[1];

  const seen = new Set();
  const data = [];
  for (const f of okResults.flatMap(r => r.data)) {
    const key = `${f.returnType}|${f.period}|${f.arn}`;
    if (!seen.has(key)) { seen.add(key); data.push(f); }
  }
  return {
    status: 'ok',
    data,
    partial: okResults.length < results.length,
    source: okResults[0].source,
    fetchedAt: new Date(now()).toISOString(),
    transactionId: okResults.map(r => r.transactionId).filter(Boolean).join(',')
  };
}

async function resolveMca(store, gstin, gst, cin, mca, now) {
  if (gst.status !== 'ok') {
    return { status: 'unavailable', reason: 'GST registration unavailable, so the MCA entity could not be resolved', source: null };
  }
  if (cin) {
    const clean = String(cin).trim().toUpperCase();
    return cached(store, gstin, `mca:${clean}`, TTL.mca, () => mca.getCompany(clean), now);
  }
  if (!COMPANY_CONSTITUTION.test(gst.data.constitution || '')) {
    return { status: 'unavailable', reason: 'Not an MCA-registered entity type', source: null };
  }
  return cached(store, gstin, 'mca:auto', TTL.mca, async () => {
    const found = await mca.findCompanyByName(gst.data.legalName);
    if (found.status !== 'ok') return found;
    return mca.getCompany(found.data.cin);
  }, now);
}

async function getRegistryReport(gstin, {
  cin = null,
  store = getTableStore(),
  providers = { gst: gstProvider, mca: mcaProvider },
  now = () => Date.now()
} = {}) {
  const g = String(gstin).trim().toUpperCase();
  const gst = await cached(store, g, 'gst', TTL.gst, () => providers.gst.searchGstin(g), now);
  const filings = await cached(store, g, 'filings', TTL.filings, () => fetchFilings(g, providers.gst, now), now);
  const mca = await resolveMca(store, g, gst, cin, providers.mca, now);

  const filingMetrics = computeFilingMetrics({
    filings: filings.status === 'ok' ? filings.data : null,
    registrationDate: gst.status === 'ok' ? gst.data.registrationDate : null,
    taxpayerType: gst.status === 'ok' ? gst.data.taxpayerType : '',
    asOf: new Date(now())
  });

  return {
    gstin: g,
    pan: g.slice(2, 12),
    gst,
    filings,
    filingMetrics,
    mca,
    directors: NOT_COVERED,
    charges: NOT_COVERED,
    litigation: NOT_COVERED,
    generatedAt: new Date(now()).toISOString()
  };
}

module.exports = { getRegistryReport };
