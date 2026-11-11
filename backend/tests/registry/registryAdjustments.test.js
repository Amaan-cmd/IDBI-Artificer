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

test('missing report keeps the score but adds a not-verified caveat', () => {
  const dec = { ...decision(700), caveats: ['earlier'] };
  const d = applyRegistryAdjustments(dec, null);
  assert.equal(d.score, 700);
  assert.equal(d.riskLevel, 'X');
  assert.deepEqual(d.citations, ['existing']);
  assert.deepEqual(d.caveats, ['earlier', 'Not verified: registry (GSTN / MCA21)']);
  assert.deepEqual(dec.caveats, ['earlier'], 'input not mutated');
});

test('missing score returns decision unchanged', () => {
  assert.deepEqual(applyRegistryAdjustments({ score: null }, report()), { score: null });
  assert.deepEqual(applyRegistryAdjustments({ score: null }, null), { score: null });
  assert.equal(applyRegistryAdjustments(null, null), null);
});

test('citation omits txn when the section has no transaction id', () => {
  const r = report();
  r.filings = { ...r.filings, transactionId: null };
  const d = applyRegistryAdjustments(decision(700), r);
  assert.ok(d.citations.some(c => c.includes('GST filing discipline')));
  assert.ok(!d.citations.some(c => /txn (null|undefined)/.test(c)));
});

const deterministicDecision = (score, risk) => ({
  score,
  riskLevel: risk,
  narrative: `Entity assessed with a ${risk} risk profile (Score: ${score}). Cash Buffer Ratio: 1.2x.`,
  reasoning: `Score 613 driven by liquidity; ${risk} risk tier.`,
  citations: []
});

test('narrative and reasoning state the final score and risk, not the base ones', () => {
  const d = applyRegistryAdjustments(deterministicDecision(613, 'HIGH'), report());
  assert.equal(d.score, 628);
  assert.equal(d.riskLevel, 'MEDIUM');
  assert.equal(d.baseScore, 613);
  assert.match(d.narrative, /MEDIUM risk profile \(Score: 628\)/);
  assert.match(d.narrative, /Registry adjustments: GST filing discipline: REGULAR \(\+15\) → final score 628 \(MEDIUM\)\./);
  assert.ok(!/613/.test(d.narrative), d.narrative);
  assert.ok(!/HIGH/.test(d.narrative), d.narrative);
  assert.equal(d.reasoning, 'Score 628 driven by liquidity; MEDIUM risk tier.');
});

test('narrative is restated even when the risk tier is unchanged', () => {
  const d = applyRegistryAdjustments(deterministicDecision(700, 'MEDIUM'), report());
  assert.equal(d.baseScore, 700);
  assert.match(d.narrative, /\(Score: 715\)/);
  assert.ok(!/\b700\b/.test(d.narrative));
});

const gstNamed = (legalName, tradeName) => ({ ...report(), gst: sec({ status: 'Active', legalName, tradeName }) });

test('entity match: statement name equals GST legal name after normalisation → adjustments apply', () => {
  const d = applyRegistryAdjustments(decision(700), gstNamed('ENVERAI TECH RETAIL SUPPLIES PRIVATE LIMITED'), { statementName: 'M/s. EnverAI Tech Retail Supplies Pvt Ltd' });
  assert.equal(d.score, 715);
  assert.ok(!d.redFlags.some(f => /does not match/.test(f)));
  assert.ok(!d.caveats.includes('Entity match not verified'));
});

test('entity match: containment or trade name match counts as the same entity', () => {
  const a = applyRegistryAdjustments(decision(700), gstNamed('ENVERAI TECH RETAIL SUPPLIES PRIVATE LIMITED'), { statementName: 'EnverAI Tech Retail Supplies' });
  assert.equal(a.score, 715);
  const b = applyRegistryAdjustments(decision(700), gstNamed('RAJESH KUMAR', 'Kumar Traders'), { statementName: 'KUMAR TRADERS' });
  assert.equal(b.score, 715);
});

test('entity mismatch: red flag, caveat, and no registry adjustments at all', () => {
  const r = { ...gstNamed('RELIANCE INDUSTRIES LIMITED'), gst: sec({ status: 'Cancelled', legalName: 'RELIANCE INDUSTRIES LIMITED' }) };
  const dec = deterministicDecision(613, 'HIGH');
  const d = applyRegistryAdjustments(dec, { ...r, filingMetrics: { filingDiscipline: 'DELINQUENT' } }, { statementName: 'EnverAI Tech Retail Supplies Pvt Ltd' });
  assert.equal(d.score, 613);
  assert.equal(d.riskLevel, 'HIGH');
  assert.equal(d.baseScore, 613);
  assert.deepEqual(d.registryAdjustments, []);
  assert.ok(d.redFlags.includes("Statement account holder 'EnverAI Tech Retail Supplies Pvt Ltd' does not match GST registered name 'RELIANCE INDUSTRIES LIMITED'"));
  assert.ok(d.caveats.some(c => /different entity/.test(c)));
  assert.match(d.narrative, /Registry adjustments not applied/);
  assert.deepEqual(d.citations, []);
});

test('missing statement name: no mismatch flag, "Entity match not verified" caveat, adjustments apply', () => {
  for (const statementName of ['Name not found in statement', undefined, '  ']) {
    const d = applyRegistryAdjustments(decision(700), gstNamed('RELIANCE INDUSTRIES LIMITED'), { statementName });
    assert.equal(d.score, 715);
    assert.ok(!d.redFlags.some(f => /does not match/.test(f)));
    assert.ok(d.caveats.includes('Entity match not verified'));
  }
});
