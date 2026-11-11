const test = require('node:test');
const assert = require('node:assert/strict');
const { computeFilingMetrics } = require('../../services/registry/filingMetrics');

const asOf = new Date('2026-11-11T00:00:00Z'); // Oct GSTR-1 due Nov 11 (not passed), Oct GSTR-3B due Nov 20
const monthsBack = (n) => { const out = []; let y = 2026, m = 9; for (let i = 0; i < n; i++) { out.push([y, m]); m -= 1; if (m === 0) { m = 12; y -= 1; } } return out; };
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const next = (y, m) => (m === 12 ? [y + 1, 1] : [y, m + 1]);

function monthlyFilings({ skip3b = [], late3bDays = 0 } = {}) {
  const out = [];
  for (const [y, m] of monthsBack(12)) {
    const [ny, nm] = next(y, m);
    const period = `${y}-${String(m).padStart(2, '0')}`;
    out.push({ returnType: 'GSTR1', period, filedOn: iso(ny, nm, 10), status: 'Filed', valid: true });
    if (!skip3b.includes(period)) out.push({ returnType: 'GSTR3B', period, filedOn: iso(ny, nm, 20 + late3bDays), status: 'Filed', valid: true });
  }
  return out;
}

test('regular monthly filer', () => {
  const r = computeFilingMetrics({ filings: monthlyFilings(), registrationDate: '2017-07-01', taxpayerType: 'Regular', asOf });
  assert.equal(r.frequency, 'monthly');
  assert.equal(r.primary.returnType, 'GSTR3B');
  assert.equal(r.primary.expectedPeriods, 12);
  assert.deepEqual(r.primary.missingPeriods, []);
  assert.equal(r.filingDiscipline, 'REGULAR');
});

test('late GSTR-3B by 8 days → IRREGULAR', () => {
  const r = computeFilingMetrics({ filings: monthlyFilings({ late3bDays: 8 }), registrationDate: '2017-07-01', taxpayerType: 'Regular', asOf });
  assert.equal(r.primary.lateFilings, 12);
  assert.equal(r.primary.averageDaysLate, 8);
  assert.equal(r.filingDiscipline, 'IRREGULAR');
});

test('three missing GSTR-3B → DELINQUENT', () => {
  const r = computeFilingMetrics({ filings: monthlyFilings({ skip3b: ['2026-09', '2026-05', '2026-01'] }), registrationDate: '2017-07-01', taxpayerType: 'Regular', asOf });
  assert.deepEqual(r.primary.missingPeriods, ['2026-01', '2026-05', '2026-09']);
  assert.equal(r.filingDiscipline, 'DELINQUENT');
});

test('quarterly (QRMP) filer detected from quarter-end periods', () => {
  const filings = ['2025-12', '2026-03', '2026-06', '2026-09'].flatMap(p => {
    const [y, m] = p.split('-').map(Number); const [ny, nm] = next(y, m);
    return [{ returnType: 'GSTR1', period: p, filedOn: iso(ny, nm, 13), status: 'Filed', valid: true },
            { returnType: 'GSTR3B', period: p, filedOn: iso(ny, nm, 22), status: 'Filed', valid: true }];
  });
  const r = computeFilingMetrics({ filings, registrationDate: '2017-07-01', taxpayerType: 'Regular', asOf });
  assert.equal(r.frequency, 'quarterly');
  assert.equal(r.primary.expectedPeriods, 4);
  assert.equal(r.filingDiscipline, 'REGULAR');
});

test('composition dealer uses CMP08 quarterly', () => {
  const filings = ['2025-12', '2026-03', '2026-06', '2026-09'].map(p => {
    const [y, m] = p.split('-').map(Number); const [ny, nm] = next(y, m);
    return { returnType: 'CMP08', period: p, filedOn: iso(ny, nm, 15), status: 'Filed', valid: true };
  });
  const r = computeFilingMetrics({ filings, registrationDate: '2017-07-01', taxpayerType: 'Composition', asOf });
  assert.equal(r.primary.returnType, 'CMP08');
  assert.equal(r.gstr1, null);
  assert.equal(r.filingDiscipline, 'REGULAR');
});

test('window starts at registration month', () => {
  const r = computeFilingMetrics({ filings: monthlyFilings(), registrationDate: '2026-07-15', taxpayerType: 'Regular', asOf });
  assert.equal(r.primary.expectedPeriods, 3); // Jul, Aug, Sep 2026
});

test('no filing data → UNKNOWN', () => {
  assert.equal(computeFilingMetrics({ filings: null }).filingDiscipline, 'UNKNOWN');
});

test('registered after window → UNKNOWN (insufficient history)', () => {
  const r = computeFilingMetrics({ filings: [], registrationDate: '2026-10-20', taxpayerType: 'Regular', asOf });
  assert.equal(r.filingDiscipline, 'UNKNOWN');
});

test("'Not Filed' status is not counted as filed", () => {
  const filings = monthlyFilings().map(f => (f.returnType === 'GSTR3B' && ['2026-09', '2026-05', '2026-01'].includes(f.period) ? { ...f, status: 'Not Filed' } : f));
  const r = computeFilingMetrics({ filings, registrationDate: '2017-07-01', taxpayerType: 'Regular', asOf });
  assert.deepEqual(r.primary.missingPeriods, ['2026-01', '2026-05', '2026-09']);
  assert.equal(r.filingDiscipline, 'DELINQUENT');
});

test("status case-insensitive ('FILED') and valid:false ignored", () => {
  const filings = monthlyFilings().map(f => ({ ...f, status: 'FILED' }));
  filings.push({ returnType: 'GSTR3B', period: '2026-09', filedOn: '2026-10-01', status: 'Filed', valid: false });
  const r = computeFilingMetrics({ filings, registrationDate: '2017-07-01', taxpayerType: 'Regular', asOf });
  assert.equal(r.filingDiscipline, 'REGULAR');
  assert.equal(r.primary.lateFilings, 0);
});

test('duplicate filings for a period: earliest filedOn decides lateness (order-independent)', () => {
  const base = monthlyFilings();
  const dup = { returnType: 'GSTR3B', period: '2026-09', filedOn: '2026-11-05', status: 'Filed', valid: true };
  for (const filings of [[...base, dup], [dup, ...base]]) {
    const r = computeFilingMetrics({ filings, registrationDate: '2017-07-01', taxpayerType: 'Regular', asOf });
    assert.equal(r.primary.lateFilings, 0);
  }
});

test('switch from monthly to QRMP before the window: old monthly filings outside the window do not force monthly', () => {
  // Monthly Apr–Sep 2025 (outside window), quarterly from Q3 2025 onward.
  const filings = [];
  for (let m = 4; m <= 9; m++) {
    const p = `2025-${String(m).padStart(2, '0')}`;
    filings.push({ returnType: 'GSTR3B', period: p, filedOn: iso(2025, m + 1, 20), status: 'Filed', valid: true });
    filings.push({ returnType: 'GSTR1', period: p, filedOn: iso(2025, m + 1, 11), status: 'Filed', valid: true });
  }
  for (const p of ['2025-12', '2026-03', '2026-06', '2026-09']) {
    const [y, m] = p.split('-').map(Number); const [ny, nm] = next(y, m);
    filings.push({ returnType: 'GSTR1', period: p, filedOn: iso(ny, nm, 13), status: 'Filed', valid: true });
    filings.push({ returnType: 'GSTR3B', period: p, filedOn: iso(ny, nm, 22), status: 'Filed', valid: true });
  }
  const r = computeFilingMetrics({ filings, registrationDate: '2017-07-01', taxpayerType: 'Regular', asOf });
  assert.equal(r.frequency, 'quarterly');
  assert.equal(r.filingDiscipline, 'REGULAR');
});
