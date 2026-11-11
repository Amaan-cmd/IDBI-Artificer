const test = require('node:test');
const assert = require('node:assert/strict');
const { isValidGstin, isAcceptedGstin, gstinCheckChar } = require('../utils/gstin');

test('real GSTINs pass the check digit', () => {
  for (const g of ['27AAACT2727Q1ZW', '27AAACR5055K1Z7']) assert.equal(isValidGstin(g), true, g);
});

test('portal-rejected and mistyped GSTINs fail the check digit', () => {
  assert.equal(gstinCheckChar('29AABCI1681G1Z'), 'K');
  for (const g of ['29AABCI1681G1ZN', '27AAACT2727Q1ZX', '27AAACR5055K1Z5']) assert.equal(isValidGstin(g), false, g);
});

test('malformed input is rejected', () => {
  for (const g of [undefined, null, '', 123, '27aaact2727q1zw', '27AAACT2727Q1Z', '27AAACT2727Q1ZWX']) {
    assert.equal(isValidGstin(g), false, String(g));
  }
});

test('demo presets with sample check digits are accepted only in demo mode', () => {
  const prev = process.env.DEMO_MODE;
  try {
    delete process.env.DEMO_MODE;
    assert.equal(isAcceptedGstin('27AADCB2230M1Z2'), false);
    process.env.DEMO_MODE = 'true';
    assert.equal(isAcceptedGstin('27AADCB2230M1Z2'), true);
    assert.equal(isAcceptedGstin('29AABCI1681G1ZN'), false);
  } finally {
    if (prev === undefined) delete process.env.DEMO_MODE; else process.env.DEMO_MODE = prev;
  }
});
