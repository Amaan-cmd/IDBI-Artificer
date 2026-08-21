const fs = require('fs');
const { callGemini } = require('../utils/googleGemini');
const { applyGuardrails } = require('../utils/nemoGuardrails');
const { scrapeBusinessIntelligence } = require('../services/scraperService');

async function ingestAlternateData(inputData) {
  const { file, manualData, enableScraper = true } = inputData;
  console.log('[Agent 1: Ingestion & Live Scraper] Parsing raw inputs using Google Gemini 2.5 Flash...');
  
  let rawContentToParse = "";

  if (file) {
    rawContentToParse = fs.readFileSync(file.path, 'utf8');
  } else if (manualData) {
    rawContentToParse = typeof manualData === 'string' ? manualData : JSON.stringify(manualData);
  } else {
    throw new Error("No file or manual data provided to Ingestion Agent");
  }

  // 1. Live Web Scraper Execution if requested
  let liveScraperData = null;
  if (enableScraper) {
    console.log('[Agent 1] Live Web Scraper triggered: Extracting GSTIN / MCA public registry trails...');
    
    // Extract GSTIN or company name if present in raw content
    const gstinMatch = rawContentToParse.match(/[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}/i);
    const identifier = gstinMatch ? gstinMatch[0] : "27AABCU9603R1ZM";
    liveScraperData = await scrapeBusinessIntelligence(identifier);
  }

  const systemPrompt = `You are Agent 1 (Ingestion & Web Intelligence Agent) powered by Gemini 2.5 Flash.
Your task is to ingest unstructured MSME data (Bank statements, GST returns, ledger streams) and combine it with Live Web Scraper intelligence.
Normalize all fields into a strict, validated financial JSON schema.
CRITICAL RULE: Do not hallucinate numbers. If a specific metric is absent, infer reasonable default from cash flows or mark 0.`;

  const userPrompt = `Raw Input Data:
${rawContentToParse}

${liveScraperData ? `Live Scraped Web Intelligence (GSTN, MCA21, Litigation Trails):\n${JSON.stringify(liveScraperData, null, 2)}` : ''}

Output strictly in valid JSON format matching this schema:
{
  "businessName": "Extracted legal entity name",
  "gstin": "Extracted GSTIN or NA",
  "monthsAnalyzed": 3,
  "totalRevenue": (number, total incoming credits/turnover),
  "totalTaxPaid": (number, GST tax paid),
  "gstComplianceScore": (number 0-100 based on GSTR regularities),
  "bankOpeningBalance": (number),
  "bankClosingBalance": (number),
  "totalCreditVolume": (number),
  "totalDebitVolume": (number),
  "inwardBounces": (number, count of returned cheques/failed auto-debits),
  "scrapedRegistryData": ${liveScraperData ? JSON.stringify(liveScraperData) : 'null'}
}`;

  const model = process.env.GEMINI_FLASH_MODEL || 'gemini-2.5-flash';
  const secretKeyName = 'GEMINI_API_KEY'; 

  const rawText = await applyGuardrails(
    systemPrompt,
    userPrompt,
    async () => await callGemini(model, systemPrompt, userPrompt, secretKeyName),
    "Agent 1: Ingestion & Scraper"
  );
  
  console.log('[Agent 1] Raw output extracted.');
  
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to extract structured JSON from Gemini response");
  }

  const structuredFinancials = JSON.parse(jsonMatch[0]);
  console.log('[Agent 1] Ingestion & Live Scraping successfully completed.');
  return structuredFinancials;
}

module.exports = { ingestAlternateData };
