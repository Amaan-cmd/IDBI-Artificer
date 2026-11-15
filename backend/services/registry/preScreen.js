/**
 * Registry pre-screen: a deterministic A–E grade from registry facts alone,
 * for GSTIN-only runs. It is never a 300–900 credit score: registries hold no
 * revenue, cash or debt data. Factors without real data are excluded, never
 * imputed. Spec: docs/superpowers/specs/2026-11-12-registry-prescreen-design.md
 */
const PRE_SCREEN_RULES = Object.freeze({
  factors: {
    vintage: { label: 'Business age', max: 35, bands: [[5, 35], [3, 25], [1, 15], [0, 0]] },
    gstr3b: { label: 'GSTR-3B filing discipline', max: 30, points: { REGULAR: 30, IRREGULAR: 15, DELINQUENT: 0 } },
    gstr1: { label: 'GSTR-1 completeness', max: 15, bands: [[0, 15], [2, 8], [Infinity, 0]] },
    timeliness: { label: 'Filing timeliness', max: 10, bands: [[5, 10], [15, 5], [Infinity, 0]] },
    mca: { label: 'Company standing', max: 10 }
  },
  grades: [[85, 'A'], [70, 'B'], [55, 'C'], [40, 'D'], [0, 'E']],
  verdicts: { A: 'PROCEED', B: 'PROCEED', C: 'REQUEST_DOCUMENTS', D: 'REQUEST_DOCUMENTS', E: 'DECLINE' },
  minCoverage: 0.6,
  coverageCapGrade: 'C'
});

const NOT_MCA_ENTITY = 'Not an MCA-registered entity type';
const RETURN_NAMES = { GSTR3B: 'GSTR-3B', CMP08: 'CMP-08', GSTR1: 'GSTR-1' };
const YEAR_MS = 365.25 * 86400000;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const okSection = (s) => (isObj(s) && s.status === 'ok' && isObj(s.data) ? s : null);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const cite = (section) => [section.source, section.fetchedAt && `fetched ${section.fetchedAt}`, section.transactionId && `txn ${section.transactionId}`]
  .filter(Boolean)
  .join(' · ');
const reasonOf = (section) => (isObj(section) && typeof section.reason === 'string' && section.reason) || 'Not available';

function isoDate(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return Number.isNaN(Date.parse(`${v}T00:00:00Z`)) ? null : v;
}

// Whole years elapsed by calendar anniversary, so "exactly 3 years" is 3.
function fullYears(iso, asOf) {
  const [y, m, d] = iso.split('-').map(Number);
  let years = asOf.getUTCFullYear() - y;
  const beforeAnniversary = asOf.getUTCMonth() + 1 < m || (asOf.getUTCMonth() + 1 === m && asOf.getUTCDate() < d);
  if (beforeAnniversary) years -= 1;
  return years;
}

const bandPoints = (bands, value, atLeast) => {
  for (const [threshold, points] of bands) {
    if (atLeast ? value >= threshold : value <= threshold) return points;
  }
  return 0;
};

function vintageFactor(gst, mca, asOf) {
  const candidates = [];
  const reg = gst && isoDate(gst.data.registrationDate);
  if (reg) candidates.push({ date: reg, section: gst, text: `GST registered ${reg}` });
  const inc = mca && isoDate(mca.data.incorporationDate);
  if (inc) candidates.push({ date: inc, section: mca, text: `Incorporated ${inc}` });
  const valid = candidates.filter(c => Date.parse(`${c.date}T00:00:00Z`) <= asOf.getTime());
  if (!valid.length) return null;
  const earliest = valid.sort((a, b) => a.date.localeCompare(b.date))[0];
  const rule = PRE_SCREEN_RULES.factors.vintage;
  const years = fullYears(earliest.date, asOf);
  const exact = (asOf.getTime() - Date.parse(`${earliest.date}T00:00:00Z`)) / YEAR_MS;
  return {
    key: 'vintage', label: rule.label, max: rule.max,
    points: bandPoints(rule.bands, years, true),
    detail: `${earliest.text} (${exact.toFixed(1)} yrs)`,
    citation: cite(earliest.section)
  };
}

function computeFactors(report, asOf) {
  const gst = okSection(report.gst);
  const mca = okSection(report.mca);
  const filings = isObj(report.filings) ? report.filings : null;
  const metrics = isObj(report.filingMetrics) ? report.filingMetrics : {};
  const primary = isObj(metrics.primary) ? metrics.primary : null;
  const gstr1 = isObj(metrics.gstr1) ? metrics.gstr1 : null;
  const filingCite = filings && filings.status === 'ok' ? cite(filings) : '';
  const filingReason = filings && filings.status !== 'ok' ? reasonOf(filings) : 'Not available';
  const rules = PRE_SCREEN_RULES.factors;

  const factors = [];
  const notAssessed = [];
  const notApplicable = [];

  const vintage = vintageFactor(gst, mca, asOf);
  if (vintage) factors.push(vintage);
  else notAssessed.push({ label: rules.vintage.label, reason: 'No registration or incorporation date available' });

  const primaryName = RETURN_NAMES[primary?.returnType] || 'GSTR-3B';
  const disciplineLabel = `${primaryName} filing discipline`;
  const discipline = metrics.filingDiscipline;
  if (Object.hasOwn(rules.gstr3b.points, discipline)) {
    const lateText = primary?.lateFilings ? `, avg ${primary.averageDaysLate} days late` : ', none late';
    factors.push({
      key: 'gstr3b', label: disciplineLabel, max: rules.gstr3b.max,
      points: rules.gstr3b.points[discipline],
      detail: primary && isNum(primary.expectedPeriods)
        ? `${primaryName}: ${primary.filedPeriods}/${primary.expectedPeriods} filed${lateText} (${discipline.toLowerCase()})`
        : `Filing discipline: ${discipline.toLowerCase()}`,
      citation: filingCite
    });
  } else {
    notAssessed.push({ label: disciplineLabel, reason: filingReason });
  }

  const isComposition = primary?.returnType === 'CMP08' || /composition/i.test(gst?.data.taxpayerType || '');
  if (isComposition) {
    notApplicable.push(rules.gstr1);
  } else if (gstr1 && isNum(gstr1.expectedPeriods) && gstr1.expectedPeriods > 0 && Array.isArray(gstr1.missingPeriods)) {
    const missing = gstr1.missingPeriods.length;
    factors.push({
      key: 'gstr1', label: rules.gstr1.label, max: rules.gstr1.max,
      points: bandPoints(rules.gstr1.bands, missing, false),
      detail: missing
        ? `GSTR-1: ${missing} of ${gstr1.expectedPeriods} periods missing (${gstr1.missingPeriods.join(', ')})`
        : `GSTR-1: ${gstr1.expectedPeriods}/${gstr1.expectedPeriods} filed`,
      citation: filingCite
    });
  } else {
    notAssessed.push({ label: rules.gstr1.label, reason: filingReason });
  }

  if (primary && isNum(primary.expectedPeriods) && primary.expectedPeriods > 0 && isNum(primary.averageDaysLate)) {
    factors.push({
      key: 'timeliness', label: rules.timeliness.label, max: rules.timeliness.max,
      points: bandPoints(rules.timeliness.bands, primary.averageDaysLate, false),
      detail: primary.lateFilings
        ? `${primary.lateFilings} late ${primaryName} filing(s), avg ${primary.averageDaysLate} days late`
        : `All ${primaryName} filings on time`,
      citation: filingCite
    });
  } else {
    notAssessed.push({ label: rules.timeliness.label, reason: filingReason });
  }

  if (mca) {
    const status = String(mca.data.status || '').trim();
    factors.push({
      key: 'mca', label: rules.mca.label, max: rules.mca.max,
      points: /^active$/i.test(status) ? rules.mca.max : 0,
      detail: `MCA21 status: ${status || 'Not stated'}`,
      citation: cite(mca)
    });
  } else if (isObj(report.mca) && report.mca.reason === NOT_MCA_ENTITY) {
    notApplicable.push(rules.mca);
  } else {
    notAssessed.push({ label: rules.mca.label, reason: reasonOf(report.mca) });
  }

  return { factors, notAssessed, notApplicable, gst, mca };
}

function computeKnockouts(gst, mca) {
  const knockouts = [];
  if (gst && /cancel|suspend/i.test(String(gst.data.status || ''))) {
    knockouts.push({ label: `GST registration ${String(gst.data.status).trim()}`, citation: cite(gst) });
  }
  if (mca && String(mca.data.status || '').trim().toLowerCase() !== 'active') {
    knockouts.push({ label: `Company status ${String(mca.data.status || '').trim() || 'not Active'} on MCA21`, citation: cite(mca) });
  }
  return knockouts;
}

const gradeFor = (percent) => PRE_SCREEN_RULES.grades.find(([min]) => percent >= min)[1];
const GRADE_ORDER = 'ABCDE';

function computePreScreen(report, { asOf = new Date() } = {}) {
  const base = {
    financialsNotAssessed: ['Revenue', 'Cash buffer', 'Debt service'],
    unlocks: ['GST consent → verified turnover', 'Bank statement → full credit score'],
    asOf: asOf.toISOString(),
    version: 1
  };
  const r = isObj(report) ? report : {};
  const { factors, notAssessed, notApplicable, gst, mca } = computeFactors(r, asOf);
  const knockouts = computeKnockouts(gst, mca);

  const points = factors.reduce((s, f) => s + f.points, 0);
  const maxPoints = factors.reduce((s, f) => s + f.max, 0);
  const applicableMax = 100 - notApplicable.reduce((s, f) => s + f.max, 0);
  const coverage = Math.round((maxPoints / applicableMax) * 100) / 100;
  const caveats = [];

  let grade = null;
  let verdict = 'INSUFFICIENT_DATA';
  let percent = null;
  if (maxPoints > 0) {
    percent = Math.round((100 * points) / maxPoints);
    grade = gradeFor(percent);
    if (coverage < PRE_SCREEN_RULES.minCoverage) {
      caveats.push('Limited registry coverage');
      const cap = PRE_SCREEN_RULES.coverageCapGrade;
      if (GRADE_ORDER.indexOf(grade) < GRADE_ORDER.indexOf(cap)) grade = cap;
    }
  }
  if (knockouts.length) grade = 'E';
  if (grade) verdict = PRE_SCREEN_RULES.verdicts[grade];

  return { grade, verdict, percent, points, maxPoints, coverage, factors, knockouts, notAssessed, caveats, ...base };
}

module.exports = { computePreScreen, PRE_SCREEN_RULES };
