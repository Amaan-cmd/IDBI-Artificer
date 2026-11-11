const test = require('node:test');
const assert = require('node:assert/strict');
const gst = require('../../services/registry/gstProvider');
const SEARCH = require('../fixtures/sandbox/gstin-search.json');
const TRACK = require('../fixtures/sandbox/gstrs-track.json');

const fixedNow = () => new Date('2026-11-11T08:00:00Z');
const clientReturning = (result) => {
  const calls = [];
  return { calls, post: async (p, b) => { calls.push({ p, b }); return result; }, get: async () => result };
};

test('searchGstin maps the GST record', async () => {
  const c = clientReturning({ ok: true, body: SEARCH, transactionId: 'tx1' });
  const r = await gst.searchGstin('24AAACQ1234A1Z5', { client: c, now: fixedNow });
  assert.equal(c.calls[0].p, '/gst/compliance/public/gstin/search');
  assert.equal(r.status, 'ok');
  assert.equal(r.source, 'GSTN via Sandbox');
  assert.equal(r.transactionId, 'tx1');
  assert.equal(r.fetchedAt, '2026-11-11T08:00:00.000Z');
  assert.deepEqual(r.data, {
    gstin: '24AAACQ1234A1Z5', legalName: 'QUICKO INFOSOFT PRIVATE LIMITED', tradeName: 'Quicko', status: 'Active',
    registrationDate: '2017-07-01', cancellationDate: null, constitution: 'Private Limited Company', taxpayerType: 'Regular',
    natureOfBusiness: ['Supplier of Services'],
    principalAddress: 'B/701, Amrapali Lakeview Tower, Vastrapur, Ahmedabad, Ahmedabad, Gujarat, 380015',
    einvoiceStatus: 'No', lastUpdated: '2024-10-18'
  });
});

test('searchGstin not found → unavailable with reason', async () => {
  const r = await gst.searchGstin('24AAACQ1234A1Z5', { client: clientReturning({ ok: false, kind: 'not_found', code: 'FO8000', transactionId: 'tx' }) });
  assert.equal(r.status, 'unavailable');
  assert.equal(r.reason, 'GSTIN not found on GST portal');
});

test('trackReturns maps filings and passes financial year', async () => {
  const c = clientReturning({ ok: true, body: TRACK, transactionId: 'tx2' });
  const r = await gst.trackReturns('24AAACQ1234A1Z5', 'FY 2025-26', { client: c, now: fixedNow });
  assert.equal(c.calls[0].p, '/gst/compliance/public/gstrs/track?financial_year=FY%202025-26');
  assert.deepEqual(r.data[1], { returnType: 'GSTR3B', period: '2025-09', filedOn: '2025-10-25', arn: 'AA240925000002B', mode: 'ONLINE', status: 'Filed', valid: true });
});

test('trackReturns RET13510 → ok with empty list', async () => {
  const r = await gst.trackReturns('24AAACQ1234A1Z5', 'FY 2025-26', { client: clientReturning({ ok: false, kind: 'not_found', code: 'RET13510', transactionId: 'tx' }), now: fixedNow });
  assert.equal(r.status, 'ok');
  assert.deepEqual(r.data, []);
});

test('financialYearOf', () => {
  assert.equal(gst.financialYearOf(new Date('2026-11-11T00:00:00Z')), 'FY 2026-27');
  assert.equal(gst.financialYearOf(new Date('2026-02-01T00:00:00Z')), 'FY 2025-26');
});

test('financialYearOf rolls over at midnight IST on 1 April', () => {
  assert.equal(gst.financialYearOf(new Date('2026-03-31T18:29:59Z')), 'FY 2025-26');
  assert.equal(gst.financialYearOf(new Date('2026-03-31T18:30:00Z')), 'FY 2026-27');
  assert.equal(gst.financialYearOf(new Date('2099-06-01T00:00:00Z')), 'FY 2099-00');
});

test('trackReturns normalises return types and drops unparseable periods', async () => {
  const body = { data: { data: { EFiledlist: [
    { rtntype: 'GSTR-3B', ret_prd: '042026', dof: '20-05-2026', valid: 'Y' },
    { rtntype: 'cmp-08', ret_prd: '062026', dof: '18/07/2026', valid: 'N' },
    { rtntype: 'GSTR9', ret_prd: '2025-26', dof: '31-12-2026' }
  ] } } };
  const r = await gst.trackReturns('24AAACQ1234A1Z5', 'FY 2026-27', { client: clientReturning({ ok: true, body, transactionId: 't' }), now: fixedNow });
  assert.deepEqual(r.data.map(f => [f.returnType, f.period, f.filedOn, f.valid]), [
    ['GSTR3B', '2026-04', '2026-05-20', true],
    ['CMP08', '2026-06', '2026-07-18', false]
  ]);
});
