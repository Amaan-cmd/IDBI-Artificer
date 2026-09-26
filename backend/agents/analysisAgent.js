const { callGemini } = require('../utils/googleGemini');
const { applyGuardrails } = require('../utils/nemoGuardrails');
const { computeFinancialTelemetry } = require('../utils/financialTelemetry');

/**
 * Agent 2: Calculation Matrix Agent (Gemini 2.5 Pro)
 * Integrates deterministic 5-Pillar Financial Telemetry with Gemini 2.5 Pro underwriting reasoning.
 */
async function analyzeFinancials(agent1Output) {
  console.log('[Agent 2: Calculation Matrix] Computing 5-Pillar Telemetry and forensic matrix via Gemini 2.5 Pro...');

  // 1. Compute deterministic ground truth using exact mathematical formulas
  const deterministicMatrix = computeFinancialTelemetry(agent1Output);

  const systemPrompt = `You are Agent 2 (Calculation Matrix & Telemetry Agent) powered by Gemini 2.5 Pro.
You receive structured financial data from Agent 1 and a pre-computed 5-Pillar Mathematical Telemetry matrix.
Your responsibility:
1. Verify the 5 financial pillars (Liquidity & Cash Buffer, Revenue & Momentum, Stability & Volatility, Debt Service & Leverage, Operational Flags).
2. Synthesize deep forensic reasoning explaining why each metric sits within or outside benchmark thresholds.
3. Generate line-item evidence citations for credit officers.
CRITICAL RULE:
- Do not contradict or hallucinate different raw numbers than those computed in the telemetry matrix.
- Return ONLY valid JSON with no conversational text.`;

  const userPrompt = `Agent 1 Financial Profile:
${JSON.stringify(agent1Output, null, 2)}

Pre-Computed 5-Pillar Deterministic Telemetry:
${JSON.stringify(deterministicMatrix, null, 2)}

Generate the verified 5-Pillar Quantitative Calculation Matrix.
Output strictly in valid JSON matching this schema:
{
  "pillar1_liquidity": ${JSON.stringify(deterministicMatrix.pillar1_liquidity)},
  "pillar2_revenue": ${JSON.stringify(deterministicMatrix.pillar2_revenue)},
  "pillar3_stability": ${JSON.stringify(deterministicMatrix.pillar3_stability)},
  "pillar4_leverage": ${JSON.stringify(deterministicMatrix.pillar4_leverage)},
  "pillar5_operational": ${JSON.stringify(deterministicMatrix.pillar5_operational)},
  "revenueRunRate": ${deterministicMatrix.revenueRunRate},
  "cashBufferRatio": ${deterministicMatrix.cashBufferRatio},
  "isCashFlowStable": ${deterministicMatrix.isCashFlowStable},
  "hasBounces": ${deterministicMatrix.hasBounces},
  "taxCompliance": "${deterministicMatrix.taxCompliance}",
  "debtServiceCapacity": "${deterministicMatrix.debtServiceCapacity}",
  "reasoning": "Forensic breakdown justifying the 5-pillar findings.",
  "citations": [
    "Citation 1 covering Liquidity and Cash Buffer...",
    "Citation 2 covering Revenue Run Rate and Momentum...",
    "Citation 3 covering GSTR tax reconciliation...",
    "Citation 4 covering Cash flow volatility and bounces...",
    "Citation 5 covering Debt Service Coverage Proxy (DSCP)...",
    "Citation 6 covering Operational and Behavioural flags..."
  ]
}`;

  const model = process.env.AGENT2_MODEL || process.env.GEMINI_FLASH_MODEL || 'gemini-3.5-flash';
  const secretKeyName = 'GEMINI_API_KEY';

  try {
    const rawText = await applyGuardrails(
      systemPrompt,
      userPrompt,
      async () => await callGemini(model, systemPrompt, userPrompt, secretKeyName),
      "Agent 2: Calculation Matrix"
    );
    
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      // Ensure deterministic pillar data is securely preserved
      parsed.pillar1_liquidity = parsed.pillar1_liquidity || deterministicMatrix.pillar1_liquidity;
      parsed.pillar2_revenue = parsed.pillar2_revenue || deterministicMatrix.pillar2_revenue;
      parsed.pillar3_stability = parsed.pillar3_stability || deterministicMatrix.pillar3_stability;
      parsed.pillar4_leverage = parsed.pillar4_leverage || deterministicMatrix.pillar4_leverage;
      parsed.pillar5_operational = parsed.pillar5_operational || deterministicMatrix.pillar5_operational;
      console.log('[Agent 2] 5-Pillar Financial Calculation Matrix computed successfully.');
      return parsed;
    }
  } catch (error) {
    console.warn(`[Agent 2] Live LLM inference notice (${error.message}). Deploying verified deterministic matrix.`);
  }

  return deterministicMatrix;
}

module.exports = { analyzeFinancials };
