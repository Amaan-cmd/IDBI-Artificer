const { callGemini } = require('../utils/googleGemini');
const { flashModel } = require('../utils/geminiModels');
const { callAzureFoundryClaude } = require('../utils/azureFoundryClaude');

/**
 * Agent 3 Interactive Underwriter Chat Endpoint
 * Powers the Orc Chief Credit Officer CLI Terminal.
 * Powered by Anthropic Claude via Azure AI Foundry with Gemini/Deterministic fallback.
 */
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function decisionFrom(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.decision && isNum(payload.decision.score)) return payload.decision;
  if (isNum(payload.score)) return { score: payload.score, riskLevel: payload.riskTier || payload.riskLevel };
  return null;
}

async function handleXAIChat(req, res) {
  try {
    const { query, evaluationPayload, history } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query directive is required.' });
    }

    // Only a scored evaluation can be explained. Accept the credit payload's
    // decision, or the terminal's flattened { score, riskTier } shape.
    const decision = decisionFrom(evaluationPayload);
    if (!decision) {
      await req.billing?.refund('no completed evaluation to explain');
      return res.json({
        status: 'success',
        engine: 'Grounded Forensic Underwriting Matrix',
        response: 'There is no completed evaluation to explain yet. Run a credit evaluation on an uploaded statement first.'
      });
    }

    const systemPrompt = `You are Agent 3 (Chief Credit Officer & Explainable AI Engine) in forensic interrogation mode.
A loan officer or credit underwriter is challenging or querying your credit score decision.
You have access to the complete 5-Pillar Underwriting Matrix:
- Pillar 1: Liquidity & Cash Buffer (Cash Buffer Ratio, Minimum Cash Buffer Days, Overdraft Utilization)
- Pillar 2: Revenue & Momentum (Annualized Run Rate, 3M Growth %, GSTR-1 Outward vs Bank Reconciliation, GSTR-3B Tax Gap)
- Pillar 3: Stability & Volatility (Coefficient of Variation of monthly credits, consecutive low-credit months, inward/outward bounces)
- Pillar 4: Debt Service & Leverage (Debt Service Coverage Proxy DSCP, Interest/EMI Burden %, New Borrowing Velocity)
- Pillar 5: Operational & Behavioural Flags (Salary Consistency, Utility Regularity, High-Value Cash Withdrawals %, Circular Counterparty Rotations, Suspicious Off-Hour Timestamps)

RULES:
1. NO GREETINGS, pleasantries, filler phrases, or conversational token waste (do NOT say "Hello", "Sure", "As the AI", etc.).
2. Immediately and directly assess the user's query against the 5-pillar financial metrics and forensic citations.
3. Defend, justify, or clarify the decision strictly using the extracted facts, ratios, and citations.
4. Keep answers crisp, sharp, and evidence-grounded.`;

    const userPrompt = `Current Active Evaluation Payload:
${JSON.stringify(evaluationPayload, null, 2)}

Underwriter Directive / Query:
"${query}"

Provide your direct forensic response:`;

    let rawAnswer = null;
    let engine = 'Azure AI Foundry (Claude)';

    // 1. Primary Engine: Anthropic Claude via Azure AI Foundry
    try {
      rawAnswer = await callAzureFoundryClaude(systemPrompt, userPrompt, history || []);
    } catch (foundryErr) {
      console.warn('[Chat] Azure Foundry Claude check:', foundryErr.message);
    }

    // 2. Fallback Engine: Google Gemini (bounded by GEMINI_TIMEOUT_MS)
    if (!rawAnswer) {
      try {
        const model = process.env.AGENT3_MODEL || process.env.GEMINI_PRO_MODEL || flashModel();
        rawAnswer = await callGemini(model, systemPrompt, userPrompt);
        engine = `Google Gemini (${model})`;
      } catch (geminiErr) {
        console.warn('[Chat] Gemini fallback check:', geminiErr.message);
      }
    }

    if (rawAnswer) {
      return res.json({
        status: 'success',
        engine,
        response: rawAnswer.trim()
      });
    }

    // 3. Grounded fallback: restate only what the payload contains. No model
    // answered, so the message is not charged.
    await req.billing?.refund('AI engines unavailable');
    const m = evaluationPayload.metrics || {};
    const p1 = m.pillar1_liquidity || {};
    const p2 = m.pillar2_revenue || {};
    const p3 = m.pillar3_stability || {};
    const p4 = m.pillar4_leverage || {};
    const p5 = m.pillar5_operational || {};
    const NA = 'not available';
    const val = (v, suffix = '') => (isNum(v) ? `${v}${suffix}` : NA);
    const runRate = isNum(p2.annualizedRevenueRunRate) ? `₹${(p2.annualizedRevenueRunRate / 100000).toFixed(1)}L` : NA;
    const caveats = Array.isArray(decision.caveats) && decision.caveats.length ? ` Caveats: ${decision.caveats.join('; ')}.` : '';

    return res.json({
      status: 'success',
      engine: 'Grounded Forensic Underwriting Matrix',
      response: `[Orc Forensic Decision Audit]: Loan decision scored ${decision.score}/900 (${decision.riskLevel || NA} risk). Pillar 1 Liquidity: status ${p1.status || NA}, Cash Buffer Ratio ${val(p1.cashBufferRatio, 'x')}, minimum cash buffer ${val(p1.minimumCashBufferDays, ' days')}. Pillar 2 Revenue: annualized run rate ${runRate}, GST reconciliation ${val(p2.gstVsBankReconciliation, 'x')}. Pillar 3 Volatility: credit CV ${val(p3.creditCoefficientOfVariation)}, inward bounce rate ${val(p3.inwardBounceRate, '%')}. Pillar 4 DSCP: ${val(p4.debtServiceCoverageProxy, 'x')}. Pillar 5 Flags: counterparty circularity ${p5.circularTransactionRisk || NA}.${caveats}`
    });

  } catch (error) {
    console.error('[Agent 3 Chat Error]:', error.message);
    return res.status(500).json({ error: 'Failed to process interrogation query' });
  }
}

module.exports = { handleXAIChat };
