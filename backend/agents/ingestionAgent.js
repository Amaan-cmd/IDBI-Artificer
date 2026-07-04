const fs = require('fs');
const { callNim } = require('../utils/nvidiaNim');
const { applyGuardrails } = require('../utils/nemoGuardrails');

async function ingestAlternateData(inputData) {
  const { file, manualData } = inputData;
  console.log('[Ingestion Agent] Passing input data to NVIDIA Nemotron 3 Nano for parsing/validation...');
  
  let rawContentToParse = "";

  if (file) {
    rawContentToParse = fs.readFileSync(file.path, 'utf8');
  } else if (manualData) {
    rawContentToParse = `Manual Data Entry:\n${manualData}`;
  } else {
    throw new Error("No file or manual data provided to Ingestion Agent");
  }

  const systemPrompt = `You are a strict financial data extraction agent. Analyze the following raw MSME financial data. Extract the data and output ONLY a valid JSON object with the requested schema. Do not output any markdown, conversational text, or explanation.
CRITICAL GUARDRAIL: Do not hallucinate data. Only use the provided input. If a metric is absent, infer a reasonable default or state 'Unavailable' rather than fabricating.`;

  const userPrompt = `${rawContentToParse}
  
Output Schema:
{
  "businessName": "Extracted or inferred business name",
  "monthsAnalyzed": 3,
  "totalRevenue": (total incoming credits or sales),
  "totalTaxPaid": (if applicable, else 0),
  "gstComplianceScore": (infer a score 0-100 based on consistency, or 90 default),
  "bankOpeningBalance": (number),
  "bankClosingBalance": (number),
  "totalCreditVolume": (number),
  "inwardBounces": (count of bounced transactions, 0 if none found)
}`;

  const model = process.env.NEMOTRON_NANO_MODEL || 'nvidia/nemotron-3-nano';
  // Secret Name in GCP Secret Manager
  const secretKeyName = 'NVIDIA_KIMI_KEY'; 
  const rawText = await applyGuardrails(
    systemPrompt,
    userPrompt,
    async () => await callNim(model, systemPrompt, userPrompt, secretKeyName),
    "Ingestion Agent"
  );
  
  console.log('[Ingestion Agent] Nemotron output:', rawText);
  
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to extract structured JSON from Nemotron response");
  }

  const structuredFinancials = JSON.parse(jsonMatch[0]);
  console.log('[Ingestion Agent] Data successfully parsed and structured by NVIDIA Nemotron.');
  return structuredFinancials;
}

module.exports = { ingestAlternateData };
