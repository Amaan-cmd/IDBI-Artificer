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
