const test = require('node:test');
const assert = require('node:assert/strict');
const { computePreScreen, PRE_SCREEN_RULES } = require('../../services/registry/preScreen');

const AS_OF = new Date('2026-11-15T00:00:00Z');
const sec = (data, extra = {}) => ({ status: 'ok', data, source: 'GSTN via Sandbox', fetchedAt: '2026-11-15T08:00:00.000Z', transactionId: 'tx1', ...extra });
const metric = (overrides = {}) => ({ expectedPeriods: 12, filedPeriods: 12, missingPeriods: [], lateFilings: 0, averageDaysLate: 0, ...overrides });
const unavailable = (reason) => ({ status: 'unavailable', reason, source: null });

// A company with perfect registry facts unless overridden.
function report({
  gstStatus = 'Active', registrationDate = '2019-04-01', constitution = 'Private Limited Company',
  discipline = 'REGULAR', primary = metric({ returnType: 'GSTR3B' }), gstr1 = metric({ returnType: 'GSTR1' }),
  mca = sec({ status: 'Active', incorporationDate: '2018-01-10' }, { source: 'MCA21 via Sandbox', transactionId: 'tx2' }),
  gst, filings = sec([])
} = {}) {
  return {
    gst: gst || sec({ status: gstStatus, registrationDate, constitution, legalName: 'ACME PRIVATE LIMITED' }),
    filings,
    filingMetrics: { primary, gstr1, filingDiscipline: discipline },
    mca
  };
}
const run = (r) => computePreScreen(r, { asOf: AS_OF });
const factor = (res, key) => res.factors.find(f => f.key === key);

test('perfect registry facts → A / PROCEED with all factors cited', () => {
  const res = run(report());
  assert.equal(res.grade, 'A');
  assert.equal(res.verdict, 'PROCEED');
  assert.equal(res.points, 100);
  assert.equal(res.maxPoints, 100);
  assert.equal(res.percent, 100);
  assert.equal(res.coverage, 1);
  assert.equal(res.factors.length, 5);
  assert.deepEqual(res.knockouts, []);
  assert.ok(factor(res, 'gstr3b').citation.includes('txn tx1'));
  assert.ok(factor(res, 'mca').citation.includes('txn tx2'));
  assert.deepEqual(res.financialsNotAssessed, ['Revenue', 'Cash buffer', 'Debt service']);
  assert.equal(res.version, 1);
  assert.equal(res.asOf, AS_OF.toISOString());
});

test('rules table holds the weights', () => {
  const total = Object.values(PRE_SCREEN_RULES.factors).reduce((s, f) => s + f.max, 0);
  assert.equal(total, 100);
});

for (const [label, overrides] of [
  ['GST cancelled', { gstStatus: 'Cancelled' }],
  ['GST suspended', { gstStatus: 'Suspended' }],
  ['MCA Strike Off', { mca: sec({ status: 'Strike Off', incorporationDate: '2018-01-10' }) }]
]) {
  test(`knockout: ${label} → E / DECLINE`, () => {
    const res = run(report(overrides));
    assert.equal(res.grade, 'E');
    assert.equal(res.verdict, 'DECLINE');
    assert.equal(res.knockouts.length, 1);
    assert.ok(res.knockouts[0].citation);
  });
}

test('vintage boundaries at exactly 1, 3 and 5 years', () => {
  const v = (date) => factor(run(report({ registrationDate: date, mca: unavailable('Company not found on MCA21') })), 'vintage').points;
  assert.equal(v('2026-01-01'), 0);
  assert.equal(v('2025-11-16'), 0);
  assert.equal(v('2025-11-15'), 15);
  assert.equal(v('2023-11-16'), 15);
  assert.equal(v('2023-11-15'), 25);
  assert.equal(v('2021-11-16'), 25);
  assert.equal(v('2021-11-15'), 35);
});

test('vintage uses the earlier of GST registration and incorporation', () => {
  const res = run(report({ registrationDate: '2025-06-01', mca: sec({ status: 'Active', incorporationDate: '2015-02-01' }) }));
  assert.equal(factor(res, 'vintage').points, 35);
  assert.match(factor(res, 'vintage').detail, /Incorporated 2015-02-01/);
});

test('GSTR-3B discipline points', () => {
  assert.equal(factor(run(report({ discipline: 'IRREGULAR' })), 'gstr3b').points, 15);
  assert.equal(factor(run(report({ discipline: 'DELINQUENT' })), 'gstr3b').points, 0);
});

test('GSTR-1 missing-period boundaries', () => {
  const g = (n) => factor(run(report({ gstr1: metric({ missingPeriods: Array.from({ length: n }, (_, i) => `2026-0${i + 1}`) }) })), 'gstr1').points;
  assert.equal(g(0), 15);
  assert.equal(g(1), 8);
  assert.equal(g(2), 8);
  assert.equal(g(3), 0);
});

test('timeliness boundaries at 5 and 15 days late', () => {
  const t = (days) => factor(run(report({ primary: metric({ averageDaysLate: days, lateFilings: days ? 2 : 0 }) })), 'timeliness').points;
  assert.equal(t(5), 10);
  assert.equal(t(5.1), 5);
  assert.equal(t(15), 5);
  assert.equal(t(15.1), 0);
});

test('missing GST filings exclude the filing factors', () => {
  const res = run(report({
    filings: unavailable('Registry lookup failed'),
    discipline: 'UNKNOWN', primary: null, gstr1: null
  }));
  assert.deepEqual(res.factors.map(f => f.key).sort(), ['mca', 'vintage']);
  assert.equal(res.maxPoints, 45);
  assert.equal(res.percent, 100);
  assert.equal(res.notAssessed.length, 3);
  // 45% coverage caps the grade at C.
  assert.equal(res.grade, 'C');
  assert.equal(res.verdict, 'REQUEST_DOCUMENTS');
  assert.ok(res.caveats.includes('Limited registry coverage'));
});

test('proprietorship: MCA factor not applicable, coverage over 90', () => {
  const res = run(report({ constitution: 'Proprietorship', mca: unavailable('Not an MCA-registered entity type') }));
  assert.equal(factor(res, 'mca'), undefined);
  assert.equal(res.maxPoints, 90);
  assert.equal(res.coverage, 1);
  assert.equal(res.grade, 'A');
});

test('composition taxpayer: GSTR-1 not applicable', () => {
  const res = run(report({ primary: metric({ returnType: 'CMP08', expectedPeriods: 4, filedPeriods: 4 }), gstr1: null }));
  assert.equal(factor(res, 'gstr1'), undefined);
  assert.equal(res.maxPoints, 85);
  assert.equal(res.coverage, 1);
  assert.match(factor(res, 'gstr3b').label, /CMP-08/);
});

test('MCA lookup failure is not assessed, not a knockout', () => {
  const res = run(report({ mca: unavailable('MCA21 lookup failed (500)') }));
  assert.equal(res.maxPoints, 90);
  assert.equal(res.coverage, 0.9);
  assert.ok(res.notAssessed.some(n => n.reason.includes('MCA21 lookup failed')));
  assert.equal(res.grade, 'A');
});

test('grade bands and verdicts', () => {
  // vintage 15 + gstr3b 15 + gstr1 8 + timeliness 5 + mca 10 = 53 → D
  const d = run(report({ registrationDate: '2025-01-01', mca: sec({ status: 'Active', incorporationDate: '2025-01-01' }), discipline: 'IRREGULAR', gstr1: metric({ missingPeriods: ['2026-01'] }), primary: metric({ averageDaysLate: 10 }) }));
  assert.equal(d.points, 53);
  assert.equal(d.grade, 'D');
  assert.equal(d.verdict, 'REQUEST_DOCUMENTS');
  // 25 + 30 + 15 + 10 + 10 = 90 → A ; 25 + 15 + 15 + 10 + 10 = 75 → B
  const b = run(report({ registrationDate: '2022-06-01', mca: sec({ status: 'Active', incorporationDate: '2022-06-01' }), discipline: 'IRREGULAR' }));
  assert.equal(b.points, 75);
  assert.equal(b.grade, 'B');
  assert.equal(b.verdict, 'PROCEED');
  // 0 + 0 + 0 + 0 + 10 = 10 → E
  const e = run(report({ registrationDate: '2026-06-01', mca: sec({ status: 'Active', incorporationDate: '2026-06-01' }), discipline: 'DELINQUENT', gstr1: metric({ missingPeriods: ['a', 'b', 'c'] }), primary: metric({ averageDaysLate: 30 }) }));
  assert.equal(e.grade, 'E');
  assert.equal(e.verdict, 'DECLINE');
});

test('no assessable data → null grade, INSUFFICIENT_DATA', () => {
  const res = run({ gst: unavailable('x'), filings: unavailable('x'), filingMetrics: { filingDiscipline: 'UNKNOWN', primary: null, gstr1: null }, mca: unavailable('x') });
  assert.equal(res.grade, null);
  assert.equal(res.verdict, 'INSUFFICIENT_DATA');
  assert.equal(res.percent, null);
});

test('malformed reports never throw', () => {
  for (const bad of [null, undefined, 'x', 42, {}, { gst: 'ok', mca: [], filingMetrics: 7 }, { gst: { status: 'ok', data: null } }]) {
    const res = run(bad);
    assert.equal(res.grade, null);
    assert.equal(res.verdict, 'INSUFFICIENT_DATA');
  }
});

test('known discipline without period counts still scores GSTR-3B only', () => {
  const res = run(report({ primary: null, gstr1: null }));
  assert.equal(factor(res, 'gstr3b').points, 30);
  assert.equal(factor(res, 'gstr3b').detail, 'Filing discipline: regular');
  assert.equal(factor(res, 'gstr1'), undefined);
  assert.equal(factor(res, 'timeliness'), undefined);
});
