const { callGemini } = require('../utils/googleGemini');
const { applyGuardrails } = require('../utils/nemoGuardrails');

/**
 * Agent 2: Calculation Matrix Agent (Gemini 2.5 Pro)
 * Strictly ingests output from Agent 1 and executes the core quantitative underwriting matrix.
 */
async function analyzeFinancials(agent1Output) {
  console.log('[Agent 2: Calculation Matrix] Processing Agent 1 profile via hyperparameter-tuned Gemini 2.5 Pro...');

  const systemPrompt = `You are Agent 2 (Calculation Matrix & Telemetry Agent) powered by Gemini 2.5 Pro.
You ONLY receive data from Agent 1. You calculate precise quantitative underwriting ratios and formulate evidence citations.
CRITICAL RULE:
- All mathematical ratios must be derived directly from the numbers provided by Agent 1.
- Provide explicit, forensic citations referencing exact numbers and dates.
- Return ONLY valid JSON with no conversational text.`;

  const userPrompt = `Agent 1 Financial Profile:
${JSON.stringify(agent1Output, null, 2)}

Calculate the complete financial telemetry matrix:
1. revenueRunRate: Annualized revenue based on monthsAnalyzed.
2. cashBufferRatio: bankClosingBalance / (totalDebitVolume / monthsAnalyzed). Healthy threshold is > 0.15.
3. isCashFlowStable: Boolean (true if cashBufferRatio > 0.15 and totalCreditVolume > totalDebitVolume).
4. hasBounces: Boolean (true if inwardBounces > 0).
5. taxCompliance: "Excellent" (score >= 85), "Average" (60-84), or "Poor" (< 60).
6. debtServiceCapacity: "High" | "Moderate" | "Constrained" based on cash buffer & turnover.
7. reasoning: Concise forensic calculation breakdown.
8. citations: Array of explicit line-item statements detailing exact numerical justifications.

Output Schema:
{
  "revenueRunRate": (number),
  "cashBufferRatio": (number),
  "isCashFlowStable": (boolean),
  "hasBounces": (boolean),
  "taxCompliance": ("Excellent" | "Average" | "Poor"),
  "debtServiceCapacity": ("High" | "Moderate" | "Constrained"),
  "reasoning": "Mathematical justification of ratios.",
  "citations": ["Citation 1...", "Citation 2..."]
}`;

  const model = process.env.GEMINI_PRO_MODEL || 'gemini-2.5-pro';
  const secretKeyName = 'GEMINI_API_KEY';
  const rawText = await applyGuardrails(
    systemPrompt,
    userPrompt,
    async () => await callGemini(model, systemPrompt, userPrompt, secretKeyName),
    "Agent 2: Calculation Matrix"
  );
  
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to extract JSON calculation matrix from Gemini response");
  }

  const analysisResult = JSON.parse(jsonMatch[0]);
  console.log('[Agent 2] Financial Calculation Matrix computed successfully.');
  return analysisResult;
}

module.exports = { analyzeFinancials };
