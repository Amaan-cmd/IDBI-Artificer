const { callNim } = require('../utils/nvidiaNim');
const { applyGuardrails } = require('../utils/nemoGuardrails');

async function analyzeFinancials(structuredData) {
  console.log('[Analysis Agent] Passing structured data to NVIDIA Nemotron 3 Super for ratio calculation and XAI...');

  const systemPrompt = `You are a forensic financial analysis AI. You must be structurally justifiable and properly cite your reasoning.
CRITICAL GUARDRAIL: Do not hallucinate data. Base all citations strictly on the provided input. If data is missing, output null or 'Unavailable'.`;
  const userPrompt = `Given the following extracted MSME financials:
${JSON.stringify(structuredData, null, 2)}

Calculate the following metrics. 
Crucially, provide EXPLAINABLE AI reasoning and citations for your calculations.
Return ONLY a raw JSON object with no markdown:
{
  "revenueRunRate": (annualized revenue based on monthsAnalyzed),
  "cashBufferRatio": (bankClosingBalance / average monthly revenue),
  "isCashFlowStable": (boolean, true if cashBufferRatio > 0.15),
  "hasBounces": (boolean, true if inwardBounces > 0),
  "taxCompliance": ("Excellent", "Average", or "Poor" based on gstComplianceScore),
  "reasoning": "A brief explanation of how you arrived at these ratios.",
  "citations": ["Citation 1 e.g., 'Total Revenue extracted was X, yielding a run rate of Y'", "Citation 2..."]
}`;

  const model = process.env.NEMOTRON_ULTRA_MODEL || 'meta/llama-3.1-70b-instruct';
  // Secret Name in GCP Secret Manager
  const secretKeyName = 'NVIDIA_NEMOTRON_ULTRA_KEY';
  const rawText = await applyGuardrails(
    systemPrompt,
    userPrompt,
    async () => await callNim(model, systemPrompt, userPrompt, secretKeyName),
    "Analysis Agent"
  );
  
  console.log('[Analysis Agent] Nemotron output:', rawText);
  
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to extract JSON from Nemotron response");
  }

  const analysisResult = JSON.parse(jsonMatch[0]);
  console.log('[Analysis Agent] Financial ratios computed with Explainability.');
  return analysisResult;
}

module.exports = { analyzeFinancials };
