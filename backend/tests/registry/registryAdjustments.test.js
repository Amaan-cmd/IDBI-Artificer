const test = require('node:test');
const assert = require('node:assert/strict');
const { applyRegistryAdjustments } = require('../../services/registry/registryAdjustments');

const sec = (data) => ({ status: 'ok', data, source: 'GSTN via Sandbox', fetchedAt: '2026-11-11T08:00:00.000Z', transactionId: 'tx1' });
const report = ({ gstStatus = 'Active', mcaStatus = 'Active', discipline = 'REGULAR', mca } = {}) => ({
  gst: sec({ status: gstStatus, cancellationDate: '2026-06-26' }),
  filings: sec([]),
  filingMetrics: { filingDiscipline: discipline },
  mca: mca || sec({ status: mcaStatus })
});
const decision = (score) => ({ score, riskLevel: 'X', citations: ['existing'] });

test('regular filer, active company → +15', () => {
  const d = applyRegistryAdjustments(decision(700), report());
  assert.equal(d.score, 715);
  assert.equal(d.riskLevel, 'MEDIUM');
  assert.equal(d.registryAdjustments.length, 1);
  assert.ok(d.citations.some(c => c.includes('txn tx1')));
});

test('struck-off company and delinquent filer', () => {
  const d = applyRegistryAdjustments(decision(800), report({ mcaStatus: 'Strike Off', discipline: 'DELINQUENT' }));
  assert.equal(d.score, 590);
  assert.equal(d.riskLevel, 'HIGH');
});

test('cancelled GST caps at 479 with red flag', () => {
  const d = applyRegistryAdjustments(decision(850), report({ gstStatus: 'Cancelled' }));
  assert.equal(d.score, 479);
  assert.equal(d.riskLevel, 'HIGH');
  assert.ok(d.redFlags.includes('GST registration Cancelled since 2026-06-26'));
});

test('clamps to 320..885', () => {
  assert.equal(applyRegistryAdjustments(decision(880), report()).score, 885);
  assert.equal(applyRegistryAdjustments(decision(330), report({ mcaStatus: 'Dormant', discipline: 'DELINQUENT' })).score, 320);
});

test('unavailable sections add caveats and no points', () => {
  const r = { gst: { status: 'unavailable' }, filings: { status: 'unavailable' }, filingMetrics: { filingDiscipline: 'UNKNOWN' }, mca: { status: 'unavailable', reason: 'down' } };
  const d = applyRegistryAdjustments(decision(700), r);
  assert.equal(d.score, 700);
  assert.deepEqual(d.caveats, ['Not verified: GST registration', 'Not verified: MCA21 company status', 'Not verified: GST filing history']);
});

test('non-MCA entity type is not a caveat', () => {
  const d = applyRegistryAdjustments(decision(700), report({ mca: { status: 'unavailable', reason: 'Not an MCA-registered entity type' } }));
  assert.deepEqual(d.caveats, []);
});

test('missing report or score returns decision unchanged', () => {
  const dec = decision(700);
  assert.equal(applyRegistryAdjustments(dec, null), dec);
  assert.deepEqual(applyRegistryAdjustments({ score: null }, report()), { score: null });
});
