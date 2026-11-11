const test = require('node:test');
const assert = require('node:assert/strict');
const mca = require('../../services/registry/mcaProvider');
const MASTER = require('../fixtures/sandbox/mca-master.json');
const SEARCH = require('../fixtures/sandbox/mca-search.json');

const fixedNow = () => new Date('2026-11-11T08:00:00Z');
const client = (result) => { const calls = []; const f = async (p, b) => { calls.push({ p, b }); return result; }; return { calls, post: f, get: f }; };

test('getCompany maps array-shaped data', async () => {
  const c = client({ ok: true, body: MASTER, transactionId: 'tx' });
  const r = await mca.getCompany('U72900GJ2015PTC082637', { client: c, now: fixedNow });
  assert.equal(c.calls[0].p, '/kyc/mca/company/master-data');
  assert.equal(r.status, 'ok');
  assert.equal(r.source, 'MCA21 via Sandbox');
  assert.deepEqual(r.data, {
    cin: 'U72900GJ2015PTC082637', companyName: 'QUICKO INFOSOFT PRIVATE LIMITED', status: 'Active',
    incorporationDate: '2015-03-19', authorizedCapital: 15200000, paidUpCapital: 14566670, companyClass: 'Private',
    companyCategory: 'Company limited by shares', rocCode: 'ROC Ahmedabad', nicCode: '72900', industry: 'Business Services',
    registeredAddress: 'B/701, Amrapali Lakeview Tower, Vastrapur, Ahmedabad, Gujarat, 380015-India', listingStatus: 'Unlisted'
  });
});

test('getCompany accepts object-shaped data', async () => {
  const body = { ...MASTER, data: MASTER.data[0] };
  const r = await mca.getCompany('U72900GJ2015PTC082637', { client: client({ ok: true, body, transactionId: 'tx' }), now: fixedNow });
  assert.equal(r.data.status, 'Active');
});

test('getCompany rejects non-CIN without calling provider', async () => {
  const c = client({ ok: true });
  const r = await mca.getCompany('ACG-1117', { client: c });
  assert.equal(r.status, 'unavailable');
  assert.equal(c.calls.length, 0);
});

test('getCompany not found', async () => {
  const r = await mca.getCompany('U72900GJ2015PTC082637', { client: client({ ok: false, kind: 'not_found', code: '521', transactionId: 'tx' }) });
  assert.equal(r.reason, 'Company not found on MCA21');
});

test('findCompanyByName returns the unique exact normalised match', async () => {
  const c = client({ ok: true, body: SEARCH, transactionId: 'tx' });
  const r = await mca.findCompanyByName('Quicko Infosoft Pvt. Ltd.', { client: c, now: fixedNow });
  assert.equal(c.calls[0].p, '/kyc/mca/company/master-data/search?company_name=Quicko%20Infosoft%20Pvt.%20Ltd.');
  assert.equal(r.status, 'ok');
  assert.equal(r.data.cin, 'U72900GJ2015PTC082637');
});

test('findCompanyByName with no exact match → ambiguous candidates', async () => {
  const r = await mca.findCompanyByName('Quicko', { client: client({ ok: true, body: SEARCH, transactionId: 'tx' }) });
  assert.equal(r.status, 'ambiguous');
  assert.equal(r.candidates.length, 2);
  assert.deepEqual(r.candidates[0], { cin: 'U72900GJ2015PTC082637', name: 'QUICKO INFOSOFT PRIVATE LIMITED' });
});

test('normaliseCompanyName', () => {
  assert.equal(mca.normaliseCompanyName('M/s. Apex & Co. Pvt. Ltd.'), 'APEX AND CO PRIVATE LIMITED');
});

test('normaliseCompanyName edge cases', () => {
  const n = mca.normaliseCompanyName;
  assert.equal(n('Apex Infra PVT.LTD.'), 'APEX INFRA PRIVATE LIMITED');
  assert.equal(n('Apex Infra Private Ltd'), 'APEX INFRA PRIVATE LIMITED');
  assert.equal(n('Apex (OPC) Private Limited.'), 'APEX OPC PRIVATE LIMITED');
  assert.equal(n('A&B Traders Pvt Ltd,'), 'A AND B TRADERS PRIVATE LIMITED');
  assert.equal(n(null), '');
});

test('findCompanyByName with two identical normalised names → ambiguous', async () => {
  const body = { data: { records: [
    { cin: 'U72900GJ2015PTC082637', company_name: 'APEX PRIVATE LIMITED' },
    { cin: 'U72900MH2016PTC082638', company_name: 'Apex Pvt. Ltd.' }
  ] } };
  const r = await mca.findCompanyByName('Apex Pvt Ltd', { client: client({ ok: true, body, transactionId: 't' }) });
  assert.equal(r.status, 'ambiguous');
  assert.equal(r.candidates.length, 2);
});

test('findCompanyByName with empty records → unavailable', async () => {
  const r = await mca.findCompanyByName('Nobody Ltd', { client: client({ ok: true, body: { data: { records: [] } }, transactionId: 't' }) });
  assert.equal(r.status, 'unavailable');
});
