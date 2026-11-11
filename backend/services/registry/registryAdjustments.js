/**
 * Deterministic score adjustments from verified registry facts. Applied after
 * synthesis so they do not depend on the LLM following instructions.
 */
const FILING_POINTS = { DELINQUENT: -60, IRREGULAR: -20, REGULAR: 15 };
const MIN_SCORE = 320;
const MAX_SCORE = 885;
const NOT_MCA_ENTITY = 'Not an MCA-registered entity type';

const riskFor = (score) => (score >= 750 ? 'LOW' : score >= 620 ? 'MEDIUM' : 'HIGH');
const cite = (section) => [section.source, section.fetchedAt && `fetched ${section.fetchedAt}`, section.transactionId && `txn ${section.transactionId}`]
  .filter(Boolean)
  .join(' · ');

function applyRegistryAdjustments(decision, report) {
  if (!decision || typeof decision.score !== 'number' || !report) return decision;

  const adjustments = [];
  const caveats = [...(decision.caveats || [])];
  const redFlags = [...(decision.redFlags || [])];
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

  return {
    ...decision,
    score,
    riskLevel: riskFor(score),
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
