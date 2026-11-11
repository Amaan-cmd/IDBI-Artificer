const test = require('node:test');
const assert = require('node:assert/strict');
const { demoRegistryReport, demoFinancials, isDemoEntity } = require('../demo/demoEntities');

test('preset is a demo entity with sample provenance', () => {
  assert.equal(isDemoEntity('27AAHCE5539J1ZA'), true);
  const r = demoRegistryReport('27AAHCE5539J1ZA');
  assert.equal(r.sampleData, true);
  assert.equal(r.gst.source, 'Sample data (demo mode)');
  assert.equal(demoFinancials('27AAHCE5539J1ZA').sampleData, true);
});

test('unknown GSTIN is not a demo entity', () => {
  assert.equal(isDemoEntity('29ABCDE1234F1Z5'), false);
  assert.equal(demoRegistryReport('29ABCDE1234F1Z5'), null);
});

test('demo constitution is derived from the CIN / LLPIN, not just its first letter', () => {
  const { constitutionFromCin } = require('../demo/demoEntities');
  assert.equal(constitutionFromCin('U47190MH2023PTC402519'), 'Private Limited Company');
  assert.equal(constitutionFromCin('U34100MH2021PLC367069'), 'Public Limited Company');
  assert.equal(constitutionFromCin('L28920MH1945PLC004520'), 'Public Limited Company');
  assert.equal(constitutionFromCin('U72900KA2020OPC123456'), 'One Person Company');
  assert.equal(constitutionFromCin('AAB-4421'), 'Limited Liability Partnership');
  assert.equal(constitutionFromCin('Sole Proprietorship'), 'Proprietorship');
  assert.equal(constitutionFromCin(undefined), 'Proprietorship');

  assert.equal(demoRegistryReport('27AAACT2727Q1ZW').gst.data.constitution, 'Public Limited Company');
  assert.equal(demoRegistryReport('24AABCS4421P1Z9').gst.data.constitution, 'Limited Liability Partnership');
});

test('demo MCA section never contradicts the demo constitution', () => {
  const llp = demoRegistryReport('24AABCS4421P1Z9');
  assert.equal(llp.mca.status, 'unavailable');
  assert.notEqual(llp.mca.reason, 'Not an MCA-registered entity type');
  assert.equal(demoRegistryReport('27AAGCK8812L1ZQ').mca.reason, 'Not an MCA-registered entity type');
  assert.equal(demoRegistryReport('27AAACT2727Q1ZW').mca.source, 'Sample data (demo mode)');
});

test('every populated demo section is labelled as sample data', () => {
  const { KNOWN_GSTINS } = require('../demo/demoEntities');
  for (const g of Object.keys(KNOWN_GSTINS)) {
    const r = demoRegistryReport(g);
    for (const key of ['gst', 'filings', 'mca', 'directors', 'charges', 'litigation']) {
      const s = r[key];
      assert.ok(s.source === 'Sample data (demo mode)' || (s.status !== 'ok' && s.source === null), `${g}.${key}`);
    }
  }
});
