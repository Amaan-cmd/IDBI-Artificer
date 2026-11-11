const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createFileTableStore } = require('../../platform/tableStore');
const { getRegistryReport } = require('../../services/registry/registryService');

const GSTIN = '24AAACQ1234A1Z5';
const now = () => Date.parse('2026-11-11T08:00:00Z');
const store = () => createFileTableStore(fs.mkdtempSync(path.join(os.tmpdir(), 'reg-')));
const ok = (data) => ({ status: 'ok', data, source: 'test', fetchedAt: '2026-11-11T08:00:00.000Z', transactionId: 'tx' });

function providers({ constitution = 'Private Limited Company', gstStatus = 'ok', mcaSearch } = {}) {
  const calls = { search: 0, track: 0, company: 0, find: 0 };
  return {
    calls,
    gst: {
      searchGstin: async () => { calls.search++; return gstStatus === 'ok' ? ok({ legalName: 'QUICKO INFOSOFT PRIVATE LIMITED', constitution, status: 'Active', registrationDate: '2017-07-01', taxpayerType: 'Regular' }) : { status: 'unavailable', reason: 'down', source: 'test' }; },
      trackReturns: async () => { calls.track++; return ok([]); },
      financialYearOf: () => 'FY 2026-27'
    },
    mca: {
      findCompanyByName: async () => { calls.find++; return mcaSearch || ok({ cin: 'U72900GJ2015PTC082637', companyName: 'X' }); },
      getCompany: async (cin) => { calls.company++; return ok({ cin, status: 'Active' }); }
    }
  };
}

test('builds a full report for a company', async () => {
  const p = providers();
  const r = await getRegistryReport(GSTIN, { store: store(), providers: p, now });
  assert.equal(r.gstin, GSTIN);
  assert.equal(r.pan, 'AAACQ1234A');
  assert.equal(r.gst.status, 'ok');
  assert.equal(r.filings.status, 'ok');
  assert.equal(p.calls.track, 2); // current + previous FY
  assert.equal(r.mca.data.cin, 'U72900GJ2015PTC082637');
  assert.equal(r.directors.status, 'unavailable');
  assert.ok(r.filingMetrics);
});

test('proprietorship skips MCA', async () => {
  const p = providers({ constitution: 'Proprietorship' });
  const r = await getRegistryReport(GSTIN, { store: store(), providers: p, now });
  assert.equal(r.mca.reason, 'Not an MCA-registered entity type');
  assert.equal(p.calls.find, 0);
});

test('explicit cin bypasses name search', async () => {
  const p = providers();
  const r = await getRegistryReport(GSTIN, { cin: 'U72900GJ2019PTC111111', store: store(), providers: p, now });
  assert.equal(p.calls.find, 0);
  assert.equal(r.mca.data.cin, 'U72900GJ2019PTC111111');
});

test('ambiguous MCA match is returned and not cached', async () => {
  const s = store();
  const amb = { status: 'ambiguous', candidates: [{ cin: 'A', name: 'a' }], source: 'test' };
  const p = providers({ mcaSearch: amb });
  await getRegistryReport(GSTIN, { store: s, providers: p, now });
  const r = await getRegistryReport(GSTIN, { store: s, providers: p, now });
  assert.equal(r.mca.status, 'ambiguous');
  assert.equal(p.calls.find, 2);
});

test('second call is served from cache', async () => {
  const s = store();
  const p = providers();
  await getRegistryReport(GSTIN, { store: s, providers: p, now });
  const r = await getRegistryReport(GSTIN, { store: s, providers: p, now });
  assert.equal(p.calls.search, 1);
  assert.equal(p.calls.track, 2);
  assert.equal(r.gst.cached, true);
  assert.equal(r.mca.cached, true);
});

test('filings cache expires after 24h but GST does not', async () => {
  const s = store();
  const p = providers();
  await getRegistryReport(GSTIN, { store: s, providers: p, now });
  await getRegistryReport(GSTIN, { store: s, providers: p, now: () => now() + 25 * 3600 * 1000 });
  assert.equal(p.calls.search, 1);
  assert.equal(p.calls.track, 4);
});

test('GST outage → sections unavailable, never fabricated', async () => {
  const r = await getRegistryReport(GSTIN, { store: store(), providers: providers({ gstStatus: 'down' }), now });
  assert.equal(r.gst.status, 'unavailable');
  assert.equal(r.mca.status, 'unavailable');
});
