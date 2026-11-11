/**
 * GST filing discipline over the last 12 months, from public filing history.
 * Due dates: GSTR-1 11th (monthly) / 13th (quarterly) of the following month;
 * GSTR-3B 20th / 24th; CMP-08 18th after the quarter.
 */
const DUE_DAY = {
  GSTR1: { monthly: 11, quarterly: 13 },
  GSTR3B: { monthly: 20, quarterly: 24 },
  CMP08: { quarterly: 18 }
};
const QUARTER_END_MONTHS = new Set([3, 6, 9, 12]);
const DAY_MS = 86400000;

const pad = (n) => String(n).padStart(2, '0');
const periodKey = (y, m) => `${y}-${pad(m)}`;
const parsePeriod = (p) => p.split('-').map(Number);

function dueDate(y, m, returnType, frequency) {
  const [dy, dm] = m === 12 ? [y + 1, 1] : [y, m + 1];
  return Date.UTC(dy, dm - 1, DUE_DAY[returnType][frequency]);
}

// A filing counts only when the portal marks it filed. Explicit statuses like
// 'Not Filed' must not match; a missing status on a tracked return is treated as filed.
const isFiled = (f) => f.valid !== false && (!f.status || /^\s*filed\b/i.test(f.status));

// Frequency is detected from the last 12 months only, so a switch to/from QRMP
// before the window does not distort expected periods.
function detectFrequency(returnType, filings, asOf) {
  if (returnType === 'CMP08') return 'quarterly';
  const from = periodKey(asOf.getUTCFullYear() - 1, asOf.getUTCMonth() + 1);
  const months = filings
    .filter(f => f.returnType === returnType && isFiled(f) && f.period >= from)
    .map(f => parsePeriod(f.period)[1]);
  if (months.length > 0 && months.every(m => QUARTER_END_MONTHS.has(m))) return 'quarterly';
  return 'monthly';
}

function expectedPeriods(returnType, frequency, asOf, registrationDate) {
  const asOfMs = asOf.getTime();
  const reg = registrationDate ? new Date(`${registrationDate}T00:00:00Z`) : null;
  const regKey = reg ? periodKey(reg.getUTCFullYear(), reg.getUTCMonth() + 1) : null;
  const windowStart = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() - 15, 1));
  const out = [];
  let y = windowStart.getUTCFullYear();
  let m = windowStart.getUTCMonth() + 1;
  for (let i = 0; i < 17; i++) {
    const isPeriod = frequency === 'monthly' || QUARTER_END_MONTHS.has(m);
    const key = periodKey(y, m);
    if (isPeriod && dueDate(y, m, returnType, frequency) < asOfMs && (!regKey || key >= regKey)) out.push(key);
    m += 1;
    if (m === 13) { m = 1; y += 1; }
  }
  return frequency === 'monthly' ? out.slice(-12) : out.slice(-4);
}

function computeReturnMetrics(returnType, filings, { asOf, registrationDate }) {
  const frequency = detectFrequency(returnType, filings, asOf);
  const expected = expectedPeriods(returnType, frequency, asOf, registrationDate);
  const filedByPeriod = new Map();
  for (const f of filings) {
    if (f.returnType !== returnType || !isFiled(f)) continue;
    // Duplicates for a period: the earliest filing date decides timeliness.
    const prev = filedByPeriod.get(f.period);
    if (!prev || (f.filedOn && (!prev.filedOn || f.filedOn < prev.filedOn))) filedByPeriod.set(f.period, f);
  }

  const missingPeriods = [];
  const lateDays = [];
  for (const key of expected) {
    const f = filedByPeriod.get(key);
    if (!f) { missingPeriods.push(key); continue; }
    const [y, m] = parsePeriod(key);
    const days = f.filedOn ? Math.ceil((Date.parse(`${f.filedOn}T00:00:00Z`) - dueDate(y, m, returnType, frequency)) / DAY_MS) : 0;
    if (days > 0) lateDays.push(days);
  }
  const filedPeriods = [...filedByPeriod.keys()].sort();

  return {
    returnType,
    frequency,
    expectedPeriods: expected.length,
    filedPeriods: expected.length - missingPeriods.length,
    missingPeriods,
    lateFilings: lateDays.length,
    averageDaysLate: lateDays.length ? Math.round((lateDays.reduce((a, b) => a + b, 0) / lateDays.length) * 10) / 10 : 0,
    lastFiledPeriod: filedPeriods.length ? filedPeriods[filedPeriods.length - 1] : null
  };
}

function computeFilingMetrics({ filings, registrationDate = null, taxpayerType = '', asOf = new Date() } = {}) {
  if (!Array.isArray(filings)) {
    return { frequency: null, primary: null, gstr1: null, filingDiscipline: 'UNKNOWN' };
  }
  const isComposition = /composition/i.test(taxpayerType || '');
  const primary = computeReturnMetrics(isComposition ? 'CMP08' : 'GSTR3B', filings, { asOf, registrationDate });
  const gstr1 = isComposition ? null : computeReturnMetrics('GSTR1', filings, { asOf, registrationDate });

  let filingDiscipline;
  if (primary.expectedPeriods === 0) {
    filingDiscipline = 'UNKNOWN';
  } else {
    const missing = Math.max(primary.missingPeriods.length, gstr1 ? gstr1.missingPeriods.length : 0);
    if (missing >= 3) filingDiscipline = 'DELINQUENT';
    else if (missing >= 1 || primary.averageDaysLate > 5) filingDiscipline = 'IRREGULAR';
    else filingDiscipline = 'REGULAR';
  }

  return { frequency: primary.frequency, primary, gstr1, filingDiscipline };
}

module.exports = { computeFilingMetrics };
