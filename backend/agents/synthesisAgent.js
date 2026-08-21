const { callGemini } = require('../utils/googleGemini');
const { applyGuardrails } = require('../utils/nemoGuardrails');

/**
 * Agent 3: XAI & Chief Credit Officer (Gemini 2.5 Pro)
 * Synthesizes final underwriting decision, assesses Agent 1 safety & Agent 2 metrics.
 */
async function synthesizeScore(agent1Data, agent2Matrix, externalOverrides = null) {
  console.log('[Agent 3: Chief Credit Officer & XAI] Synthesizing credit decision via Gemini 2.5 Pro...');

  const systemPrompt = `You are Agent 3 (Chief Credit Officer & Explainable AI Agent) powered by Gemini 2.5 Pro.
Your responsibility:
1. Cross-verify the safety, integrity, and realism of data extracted by Agent 1.
2. Evaluate the quantitative calculation matrix from Agent 2.
3. Synthesize a definitive Holistic Credit Score (300 to 900) and Risk Tier (LOW | MEDIUM | HIGH).
4. Construct an immutable Forensic Audit Trail with exact line-item citations.
CRITICAL RULE:
- Zero hallucinations.
- All risk deductions or approvals must be forensically justified.
- Return ONLY a raw JSON object with no conversational fluff.`;

  const userPrompt = `Agent 1 Extracted Profile:
${JSON.stringify(agent1Data, null, 2)}

Agent 2 Quantitative Calculation Matrix:
${JSON.stringify(agent2Matrix, null, 2)}

${externalOverrides ? `External Overrides / Manual Scraper Signals:\n${JSON.stringify(externalOverrides, null, 2)}` : ''}

Generate the final underwriting synthesis.
Output strictly in JSON schema:
{
  "score": (number between 300 and 900),
  "riskLevel": ("LOW" | "MEDIUM" | "HIGH"),
  "narrative": "A concise executive underwriting decision summary (2-3 sentences).",
  "reasoning": "Detailed forensic explanation of why this specific score and risk tier were assigned.",
  "citations": [
    "Line-item citation 1 referencing exact figures...",
    "Line-item citation 2 referencing GSTR/cash buffer...",
    "Line-item citation 3 referencing litigation/bounce flags..."
  ],
  "agentSafetyAudit": {
    "dataIntegrityStatus": "VERIFIED_SOUND",
    "fraudSignalsDetected": 0,
    "confidenceRating": "99.4%"
  }
}`;

  const model = process.env.GEMINI_PRO_MODEL || 'gemini-2.5-pro';
  const secretKeyName = 'GEMINI_API_KEY';
  const rawText = await applyGuardrails(
    systemPrompt,
    userPrompt,
    async () => await callGemini(model, systemPrompt, userPrompt, secretKeyName),
    "Agent 3: Synthesis & XAI"
  );
  
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to extract JSON decision from Gemini response");
  }

  const finalDecision = JSON.parse(jsonMatch[0]);
  console.log('[Agent 3] Final Underwriting Synthesis & XAI Audit Trail generated.');
  return finalDecision;
}

module.exports = { synthesizeScore };
