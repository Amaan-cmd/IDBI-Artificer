const { callNim } = require('../utils/nvidiaNim');

async function synthesizeScore(structuredData, analysis, scraperData = null) {
  console.log('[Synthesis Agent] Passing data and analysis to NVIDIA Nemotron 3 Ultra for final decision and XAI...');

  const systemPrompt = `You are the Chief Credit Officer AI. You make the final underwriting decision. You must be structurally justifiable and properly cite your reasoning based on the extracted metrics and analysis.
CRITICAL GUARDRAIL: Do not hallucinate data. Base all citations strictly on the provided input. If data is missing, output null or 'Unavailable'. DO NOT fabricate external data.`;
  const userPrompt = `Input Financials:
${JSON.stringify(structuredData, null, 2)}

Calculated Ratios & Analytics:
${JSON.stringify(analysis, null, 2)}

External Scraper Data (e.g. MCA, Court Records, Social Sentiment - if any):
${scraperData ? JSON.stringify(scraperData, null, 2) : 'None Provided'}

Based on these inputs, generate a final MSME Health Card decision. Factor in the External Scraper Data if it is present and relevant.
Crucially, provide EXPLAINABLE AI reasoning and citations for your decision.
Return ONLY a raw JSON object with no markdown:
{
  "score": (a number from 300 to 900 representing financial health),
  "riskLevel": ("LOW", "MEDIUM", or "HIGH"),
  "narrative": (A 2-3 sentence executive summary of why this score was given, incorporating insights from all data sources.),
  "reasoning": (Detailed forensic justification of the score.),
  "citations": ["Citation 1 e.g., 'Risk level HIGH due to inward bounces = X'", "Citation 2..."]
}`;

  const model = process.env.NEMOTRON_ULTRA_MODEL || 'nvidia/nemotron-3-ultra';
  // Secret Name in GCP Secret Manager
  const secretKeyName = 'NVIDIA_NEMOTRON_ULTRA_KEY';
  const rawText = await callNim(model, systemPrompt, userPrompt, secretKeyName);
  
  console.log('[Synthesis Agent] Nemotron output:', rawText);
  
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to extract JSON from Nemotron response");
  }

  const finalDecision = JSON.parse(jsonMatch[0]);
  console.log('[Synthesis Agent] Final decision synthesized with Explainability.');
  return finalDecision;
}

module.exports = { synthesizeScore };
