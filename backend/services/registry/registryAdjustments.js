/**
 * Deterministic score adjustments from verified registry facts. Applied after
 * synthesis so they do not depend on the LLM following instructions.
 */
const { normaliseCompanyName } = require('./mcaProvider');

const FILING_POINTS = { DELINQUENT: -60, IRREGULAR: -20, REGULAR: 15 };
const MIN_SCORE = 320;
const MAX_SCORE = 885;
const NOT_MCA_ENTITY = 'Not an MCA-registered entity type';

const riskFor = (score) => (score >= 750 ? 'LOW' : score >= 620 ? 'MEDIUM' : 'HIGH');
const cite = (section) => [section.source, section.fetchedAt && `fetched ${section.fetchedAt}`, section.transactionId && `txn ${section.transactionId}`]
  .filter(Boolean)
  .join(' · ');

// Placeholders the ingestion agent uses when no account holder was found.
const NAME_PLACEHOLDERS = /^(name not found in statement|unknown|n\/?a|null|undefined)$/i;
const knownName = (n) => (typeof n === 'string' && n.trim() && !NAME_PLACEHOLDERS.test(n.trim()) ? n.trim() : null);
const sameEntity = (a, b) => {
  const x = normaliseCompanyName(a);
  const y = normaliseCompanyName(b);
  return Boolean(x && y) && (x === y || x.includes(y) || y.includes(x));
};

// Compares the statement account holder with the GST legal / trade names.
// result: 'none' (no GST name to compare) | 'unknown' | 'match' | 'mismatch'.
function entityMatch(statementName, gst) {
  const legal = gst?.status === 'ok' ? knownName(gst.data?.legalName) : null;
  const trade = gst?.status === 'ok' ? knownName(gst.data?.tradeName) : null;
  const gstName = legal || trade;
  if (!gstName) return { result: 'none' };
  const stmt = knownName(statementName);
  if (!stmt) return { result: 'unknown', gstName };
  if ([legal, trade].some(n => n && sameEntity(stmt, n))) return { result: 'match', gstName };
  return { result: 'mismatch', gstName, stmt };
}

const escapeRe = (x) => String(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Rewrites pre-adjustment score/risk mentions (e.g. "(Score: 613)",
// "HIGH risk profile") so the text states the final values.
function restate(text, base, final) {
  if (typeof text !== 'string' || !text) return text;
  let out = text;
  if (base.score !== final.score) {
    out = out.replace(new RegExp(`(score\\b[^0-9.]{0,15})${base.score}\\b`, 'gi'), `$1${final.score}`);
  }
  if (base.riskLevel && base.riskLevel !== final.riskLevel) {
    out = out.replace(new RegExp(`\\b${escapeRe(base.riskLevel)}(\\s+|-)risk\\b`, 'gi'), `${final.riskLevel}$1risk`);
  }
  return out;
}

const appendSentence = (text, sentence) => (typeof text === 'string' && text.trim() ? `${text.trim()} ${sentence}` : sentence);

function applyRegistryAdjustments(decision, report, { statementName } = {}) {
  if (!decision || typeof decision.score !== 'number') return decision;
  if (!report) {
    return { ...decision, caveats: [...(decision.caveats || []), 'Not verified: registry (GSTN / MCA21)'] };
  }

  const adjustments = [];
  const caveats = [...(decision.caveats || [])];
  const redFlags = [...(decision.redFlags || [])];

  // Registry facts describe the GST registrant. If the statement belongs to a
  // different account holder, none of those facts may move this score.
  const entity = entityMatch(statementName, report.gst);
  if (entity.result === 'unknown') caveats.push('Entity match not verified');
  if (entity.result === 'mismatch') {
    const msg = `Statement account holder '${entity.stmt}' does not match GST registered name '${entity.gstName}'`;
    redFlags.push(msg);
    caveats.push('Registry adjustments not applied: statement account holder may be a different entity from the GST registrant');
    return {
      ...decision,
      baseScore: decision.score,
      registryAdjustments: [],
      caveats,
      redFlags,
      narrative: appendSentence(decision.narrative, `Registry adjustments not applied: ${msg.charAt(0).toLowerCase()}${msg.slice(1)}.`)
    };
  }

  let score = decision.score;
  let cap = null;

  const { gst, mca, filings, filingMetrics } = report;

  if (gst?.status === 'ok') {
    const status = gst.data.status || '';
    if (/cancel|suspend/i.test(status)) {
      cap = 479;
      redFlags.push(`GST registration ${status}${gst.data.cancellationDate ? ` since ${gst.data.cancellationDate}` : ''}`);
      adjustments.push({ label: `GST registration ${status}`, points: 0, cap: 479, citation: cite(gst) });
    }
  } else {
    caveats.push('Not verified: GST registration');
  }

  if (mca?.status === 'ok' && mca.data.status) {
    if (!/^active$/i.test(mca.data.status.trim())) {
      score -= 150;
      adjustments.push({ label: `MCA21 company status: ${mca.data.status}`, points: -150, citation: cite(mca) });
    }
  } else if (mca?.reason !== NOT_MCA_ENTITY) {
    caveats.push('Not verified: MCA21 company status');
  }

  const discipline = filingMetrics?.filingDiscipline;
  if (discipline in FILING_POINTS) {
    score += FILING_POINTS[discipline];
    adjustments.push({ label: `GST filing discipline: ${discipline}`, points: FILING_POINTS[discipline], citation: cite(filings) });
  } else {
    caveats.push('Not verified: GST filing history');
  }

  score = Math.max(MIN_SCORE, Math.min(MAX_SCORE, score));
  if (cap !== null) score = Math.min(score, cap);

  const base = { score: decision.score, riskLevel: decision.riskLevel };
  const final = { score, riskLevel: riskFor(score) };
  const text = {};
  if (adjustments.length) {
    const parts = adjustments.map(a => `${a.label}${a.points ? ` (${a.points > 0 ? '+' : ''}${a.points})` : ''}${a.cap ? ` (cap ${a.cap})` : ''}`);
    text.narrative = appendSentence(
      restate(decision.narrative, base, final),
      `Registry adjustments: ${parts.join('; ')} → final score ${final.score} (${final.riskLevel}).`
    );
    if (typeof decision.reasoning === 'string') text.reasoning = restate(decision.reasoning, base, final);
  }

  return {
    ...decision,
    ...text,
    baseScore: base.score,
    score,
    riskLevel: final.riskLevel,
    registryAdjustments: adjustments,
    caveats,
    redFlags,
    citations: [
      ...(decision.citations || []),
      ...adjustments.map(a => `[Registry] ${a.label}${a.points ? ` (${a.points > 0 ? '+' : ''}${a.points} pts)` : ''} — ${a.citation}`)
    ]
  };
}

module.exports = { applyRegistryAdjustments };
