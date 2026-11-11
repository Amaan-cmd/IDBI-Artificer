const fs = require('fs');
const { callGemini } = require('../utils/googleGemini');
const { callGrok } = require('../utils/grokClient');
const { applyGuardrails } = require('../utils/nemoGuardrails');
const { getRegistryReport } = require('../services/registry/registryService');
const { isDemoMode } = require('../platform/demoMode');
const { demoFinancials, demoRegistryReport } = require('../demo/demoEntities');

const GSTIN_PATTERN = /[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}/i;
const GSTIN_EXACT = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i;
const MIN_MONTHS = 3;
const NAME_NOT_FOUND = 'Name not found in statement';
const EXTRACTION_ERROR = 'Could not extract financials from the uploaded statement';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isNumArray = (v) => Array.isArray(v) && v.length > 0 && v.every(isNum);
const sum = (arr) => arr.reduce((a, b) => a + b, 0);
const toNumber = (s) => Number(String(s).replace(/,/g, ''));

/**
 * Builds the pipeline's financial record from whatever was actually found.
 * Fields the pipeline needs but the input does not support get a neutral
 * value that downstream code reads as "none" (0 / [] / null), or are omitted
 * where a 0 would itself be read as a fact (opening/closing balance), and
 * each such field is listed in dataGaps.
 */
function finalizeFinancials(found) {
  const dataGaps = [];
  const credits = found.monthlyCredits;
  const out = {
    businessName: found.businessName || NAME_NOT_FOUND,
    gstin: found.gstin || null,
    monthsAnalyzed: credits.length,
    monthlyCredits: credits
  };
  if (!found.businessName) dataGaps.push('businessName');
  if (found.cin) out.cin = found.cin;
  if (found.taxpayerType) out.taxpayerType = found.taxpayerType;

  out.totalCreditVolume = isNum(found.totalCreditVolume) ? found.totalCreditVolume : sum(credits);
  out.totalRevenue = isNum(found.totalRevenue) ? found.totalRevenue : out.totalCreditVolume;

  if (isNumArray(found.monthlyDebits)) {
    out.monthlyDebits = found.monthlyDebits;
  } else {
    out.monthlyDebits = [];
    dataGaps.push('monthlyDebits');
  }
  if (isNum(found.totalDebitVolume)) out.totalDebitVolume = found.totalDebitVolume;
  else if (out.monthlyDebits.length) out.totalDebitVolume = sum(out.monthlyDebits);
  else { out.totalDebitVolume = 0; dataGaps.push('totalDebitVolume'); }

  for (const f of ['bankOpeningBalance', 'bankClosingBalance']) {
    if (isNum(found[f])) out[f] = found[f];
    else dataGaps.push(f);
  }

  if (isNumArray(found.dailyClosingBalances)) {
    out.dailyClosingBalances = found.dailyClosingBalances;
  } else {
    const known = [found.bankOpeningBalance, found.bankClosingBalance].filter(isNum);
    out.dailyClosingBalances = known;
    if (!known.length) dataGaps.push('dailyClosingBalances');
  }

  const zeroIfMissing = [
    'sanctionedOdLimit', 'peakOdUsage', 'gstr1OutwardTaxable', 'gstr3bTaxPaid', 'gstr1DeclaredTax',
    'inwardBounces', 'totalDebitAttempts', 'outwardBounces', 'totalOutwardAttempts',
    'monthlyEmiObligations', 'newBorrowingCount6M'
  ];
  for (const f of zeroIfMissing) {
    if (isNum(found[f])) out[f] = found[f];
    else { out[f] = 0; dataGaps.push(f); }
  }

  for (const f of ['totalTaxPaid', 'gstComplianceScore']) {
    if (isNum(found[f])) out[f] = found[f];
    else { out[f] = null; dataGaps.push(f); }
  }

  if (Array.isArray(found.transactions) && found.transactions.length) out.transactions = found.transactions;
  else { out.transactions = []; dataGaps.push('transactions'); }

  out.scrapedRegistryData = found.scrapedRegistryData || null;
  out.dataGaps = dataGaps;
  return out;
}

// Last labelled amount for any of the labels, e.g. "Closing Balance: Rs. 1,55,000.00".
function labelledAmount(text, labels, which = 'last') {
  const re = new RegExp(`(?:${labels})[ \\t]*[:\\-]?[ \\t]*(?:Rs\\.?|INR|₹)?[ \\t]*(\\d[\\d,]*(?:\\.\\d+)?)`, 'gi');
  const hits = [...text.matchAll(re)].map(m => toNumber(m[1])).filter(Number.isFinite);
  if (!hits.length) return undefined;
  return which === 'first' ? hits[0] : hits[hits.length - 1];
}

// A monthly summary table: a header naming the credit (and optionally debit /
// balance) columns, followed by one row per month. Column order comes from the
// header; rows without enough figures are ignored.
function extractMonthlyTable(text) {
  const lines = text.split(/\r?\n/);
  const MONTH_ROW = /^\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?(?:[\s\-/,']*(?:\d{4}|\d{2}))?\s+(.+)$/i;
  for (let i = 0; i < lines.length; i++) {
    const header = lines[i];
    if (/\d{3,}/.test(header)) continue;
    const creditAt = header.search(/credit|deposit/i);
    if (creditAt < 0) continue;
    const cols = [{ key: 'credit', at: creditAt }];
    const debitAt = header.search(/debit|withdrawal/i);
    if (debitAt >= 0) cols.push({ key: 'debit', at: debitAt });
    const balanceAt = header.search(/balance/i);
    if (balanceAt >= 0) cols.push({ key: 'balance', at: balanceAt });
    cols.sort((a, b) => a.at - b.at);

    const rows = [];
    for (let j = i + 1; j < lines.length; j++) {
      const m = MONTH_ROW.exec(lines[j]);
      if (!m) {
        if (rows.length) break;
        if (lines[j].trim() === '') continue;
        break;
      }
      const nums = (m[1].match(/\d[\d,]*(?:\.\d+)?/g) || []).map(toNumber);
      if (nums.length < cols.length) break;
      const row = {};
      cols.forEach((c, k) => { row[c.key] = nums[k]; });
      rows.push(row);
    }
    if (rows.length >= MIN_MONTHS) {
      return {
        monthlyCredits: rows.map(r => r.credit),
        monthlyDebits: debitAt >= 0 ? rows.map(r => r.debit) : undefined,
        monthEndBalances: balanceAt >= 0 ? rows.map(r => r.balance) : undefined
      };
    }
  }
  return null;
}

// Deterministic extraction from statement text, used when the LLM engines are
// unavailable. Only explicitly labelled figures are taken; if the monthly
// credit series cannot be found the statement is rejected rather than guessed.
function extractHeuristicFinancials(rawText, originalFileName = '') {
  console.log('[Agent 1 Heuristic] Parsing document text directly from source...');
  const text = String(rawText || '');

  const table = extractMonthlyTable(text);
  if (!table) throw new Error(EXTRACTION_ERROR);

  let businessName = null;
  const namePatterns = [
    /(?:M\/s\.?|Company Name|Account Name|Customer Name|Entity Name|Name of the Borrower)[:\s]+([A-Za-z0-9\s&.,'-]+?)(?=\n|\r|,|GSTIN|CIN|PAN|$)/i,
    /([A-Z][A-Za-z0-9 &.,'-]{2,50}?(?:Private Limited|Pvt\.?\s*Ltd\.?|Limited|LLP))/
  ];
  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[1].trim().length > 3) {
      businessName = match[1].trim().replace(/\s+/g, ' ');
      break;
    }
  }
  if (!businessName && originalFileName) {
    const cleanName = originalFileName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ').trim();
    if (cleanName.length > 3 && !/statement/i.test(cleanName)) businessName = cleanName;
  }

  const gstinMatch = text.match(GSTIN_PATTERN);
  const cinMatch = text.match(/[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}/i);

  // Directors only where a DIN is printed next to the name.
  const directors = [];
  const dinPattern = /([A-Z][A-Za-z .]{2,40}?)[ \t]*(?:\(?(?:Managing Director|Director|Partner)\)?)?[ \t,:-]*DIN[ \t:.-]*([0-9]{8})/g;
  for (const d of text.matchAll(dinPattern)) {
    const name = d[1].trim();
    if (name.length > 3 && !/Membership|UDIN|Place|Date/i.test(name) && !directors.some(x => x.includes(d[2]))) {
      directors.push(`${name} (DIN: ${d[2]})`);
    }
  }

  return finalizeFinancials({
    businessName,
    gstin: gstinMatch ? gstinMatch[0].toUpperCase() : null,
    cin: cinMatch ? cinMatch[0].toUpperCase() : undefined,
    monthlyCredits: table.monthlyCredits,
    monthlyDebits: table.monthlyDebits,
    dailyClosingBalances: table.monthEndBalances,
    bankOpeningBalance: labelledAmount(text, 'Opening Balance', 'first'),
    bankClosingBalance: labelledAmount(text, 'Closing Balance', 'last'),
    totalCreditVolume: labelledAmount(text, 'Total Credits?|Total Deposits?'),
    totalDebitVolume: labelledAmount(text, 'Total Debits?|Total Withdrawals?'),
    scrapedRegistryData: directors.length ? { directors } : null
  });
}

// Pre-structured scenario payload: values are taken as given; nothing is
// derived beyond sums of supplied series.
function financialsFromManualPayload(manual, gstin) {
  const pick = (...keys) => keys.map(k => manual[k]).find(isNum);
  return finalizeFinancials({
    ...manual,
    businessName: manual.businessName,
    gstin: (manual.gstin || gstin || '').toUpperCase() || null,
    totalTaxPaid: pick('totalTaxPaid', 'gstr3bTaxPaid'),
    gstr3bTaxPaid: pick('gstr3bTaxPaid', 'totalTaxPaid')
  });
}

function parseManualData(manualData) {
  if (typeof manualData !== 'string') return manualData;
  const trimmed = manualData.trim();
  if (trimmed.startsWith('{')) {
    try { return JSON.parse(trimmed); } catch { /* treat as raw text */ }
  }
  return trimmed;
}

// A manualData that only names a GSTIN (bare string or { gstin }) is a
// registry screening request, not financial data.
function screeningGstinFrom(manual) {
  if (typeof manual === 'string') return GSTIN_EXACT.test(manual) ? manual : null;
  if (manual && typeof manual === 'object' && !Array.isArray(manual) && typeof manual.gstin === 'string') {
    const populated = Object.keys(manual).filter(k => manual[k] !== undefined && manual[k] !== null && manual[k] !== '');
    if (populated.every(k => k === 'gstin') && GSTIN_EXACT.test(manual.gstin.trim())) return manual.gstin.trim();
  }
  return null;
}

async function ingestAlternateData(inputData) {
  const { file, gstin, enableScraper = true } = inputData;
  let manualData = parseManualData(inputData.manualData);
  console.log('[Agent 1: Fetcha Engine - Grok 4.6 Brain] Ingesting multi-modal alternate data...');

  let rawContentToParse = "";
  let originalFileName = "";
  let registryReport = null;

  const hasFile = Boolean(file && file.path && fs.existsSync(file.path));
  const screeningGstin = hasFile ? null : screeningGstinFrom(manualData);
  if (screeningGstin) manualData = null;

  // Route A: Uploaded Statement File (PDF / CSV / JSON)
  if (hasFile) {
    originalFileName = file.originalname || file.name || "statement.pdf";
    console.log(`[Fetcha: Ingestion Agent] Reading uploaded file: ${originalFileName}...`);

    const isPdf = (file.mimetype && file.mimetype.includes('pdf')) || originalFileName.toLowerCase().endsWith('.pdf');
    if (isPdf) {
      try {
        const fileBuffer = fs.readFileSync(file.path);
        const { PDFParse } = require('pdf-parse');
        const parser = new PDFParse({ data: fileBuffer });
        await parser.load();
        const parsedDoc = await parser.getText();
        rawContentToParse = (parsedDoc?.text || parsedDoc || '').toString();
        console.log(`[Fetcha: PDF Ingestion] Extracted ${rawContentToParse.length} characters from ${originalFileName}`);
      } catch (pdfErr) {
        console.warn(`[Fetcha: PDF Parser Notice]: ${pdfErr.message}. Falling back to text decode.`);
        rawContentToParse = fs.readFileSync(file.path, 'utf8');
      }
    } else {
      rawContentToParse = fs.readFileSync(file.path, 'utf8');
    }

    // Attempt to discover GSTIN from file text if not provided
    let resolvedGstin = gstin;
    if (!resolvedGstin && rawContentToParse) {
      const gstinMatch = rawContentToParse.match(GSTIN_PATTERN);
      if (gstinMatch) resolvedGstin = gstinMatch[0].toUpperCase();
    }

    // Scrape live statutory registry if enabled and GSTIN is known
    if (enableScraper && resolvedGstin) {
      try {
        registryReport = isDemoMode() && demoRegistryReport(resolvedGstin)
          ? demoRegistryReport(resolvedGstin)
          : await getRegistryReport(resolvedGstin);
      } catch (regErr) {
        console.warn(`[Fetcha: Registry Notice]: ${regErr.message}`);
      }
    }
  }
  // Route B: Manual scenario payload (Pre-parsed object or raw text)
  else if (manualData) {
    if (typeof manualData === 'object') {
      if (isNumArray(manualData.monthlyCredits)) {
        console.log(`[Fetcha: Scenario Intake] Using pre-structured scenario payload for: ${manualData.businessName || 'MSME'}`);
        return financialsFromManualPayload(manualData, gstin);
      }
      rawContentToParse = JSON.stringify(manualData);
    } else {
      rawContentToParse = String(manualData);
    }
  }
  // Route C: GSTIN only (no file, no financial data) -> registry screening, no financials
  else if (gstin || screeningGstin) {
    const targetGstin = (gstin || screeningGstin).trim().toUpperCase();
    if (isDemoMode() && demoFinancials(targetGstin)) {
      const sample = demoFinancials(targetGstin);
      const report = demoRegistryReport(targetGstin);
      return { ...sample, totalCreditVolume: sample.totalRevenue, monthsAnalyzed: sample.monthlyCredits.length, transactions: [], registryReport: report, scrapedRegistryData: report };
    }
    console.log(`[Fetcha] Registry screening for ${targetGstin} (no statement uploaded)`);
    return { reportType: 'REGISTRY_SCREENING', gstin: targetGstin, registryReport: await getRegistryReport(targetGstin) };
  } else {
    throw new Error("No file, manual data, or GSTIN provided to Ingestion Agent");
  }

  const systemPrompt = `You are Agent 1 (Fetcha: Multi-Modal Alternate Data Ingestion & Registry Intelligence Agent) powered by Grok 4.6.
Your task is to ingest unstructured MSME data (Bank statements, GST returns, ledger streams) and combine it with Live Web Scraper intelligence.
Normalize all fields into a strict, validated financial JSON schema.
CRITICAL RULE: Do not hallucinate numbers. Extract the exact legal entity name and figures from the raw data.`;

  const userPrompt = `Raw Input Data (${originalFileName}):
${rawContentToParse.slice(0, 15000)}

${registryReport ? `Verified registry facts (GSTN / MCA21, with provenance). Use for entity identity only; do not derive financial figures from them:\n${JSON.stringify({ gst: registryReport.gst, mca: registryReport.mca, filingMetrics: registryReport.filingMetrics }, null, 2)}` : ''}

Output strictly in valid JSON format matching this schema:
{
  "businessName": "Extracted legal entity name",
  "gstin": "Extracted GSTIN or NA",
  "monthsAnalyzed": 6,
  "totalRevenue": (number, total incoming credits/turnover),
  "totalTaxPaid": (number, GST tax paid),
  "gstComplianceScore": (number 0-100 based on GSTR regularities),
  "bankOpeningBalance": (number),
  "bankClosingBalance": (number),
  "totalCreditVolume": (number),
  "totalDebitVolume": (number),
  "monthlyCredits": [(number, monthly credits array chronological)],
  "monthlyDebits": [(number, monthly debits array chronological)],
  "dailyClosingBalances": [(number, rolling daily balance checkpoints)],
  "sanctionedOdLimit": (number, sanctioned OD/CC limit or 0),
  "peakOdUsage": (number, peak OD utilization or 0),
  "gstr1OutwardTaxable": (number, total outward taxable supplies from GSTR-1),
  "gstr3bTaxPaid": (number, total tax paid in GSTR-3B),
  "gstr1DeclaredTax": (number, total tax declared in GSTR-1),
  "inwardBounces": (number, count of returned cheques/failed auto-debits),
  "totalDebitAttempts": (number, count of total debit attempts),
  "outwardBounces": (number, count of outward failures),
  "totalOutwardAttempts": (number, count of total outward attempts),
  "monthlyEmiObligations": (number, estimated monthly loan/EMI debits),
  "newBorrowingCount6M": (number, count of new loan disbursements in last 6M),
  "transactions": [],
  "registryReport": null
}`;

  // 2. Primary Cognitive Engine: Grok 4.6 with Autonomous Tools
  try {
    const grokResponse = await callGrok(systemPrompt, userPrompt);
    if (grokResponse) {
      const jsonMatch = grokResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const structuredFinancials = JSON.parse(jsonMatch[0]);
        console.log('[Agent 1: Fetcha] Successfully synthesized financial payload via Grok 4.6 Engine.');
        return { ...structuredFinancials, registryReport, scrapedRegistryData: registryReport };
      }
    }
  } catch (grokErr) {
    console.warn(`[Fetcha: Grok 4.6 Notice]: ${grokErr.message}`);
  }

  // 3. Secondary Engine: Google Gemini Enterprise via Vertex AI
  const model = process.env.GEMINI_FLASH_MODEL || 'gemini-2.5-flash';
  const secretKeyName = 'GEMINI_API_KEY'; 

  try {
    const rawText = await applyGuardrails(
      systemPrompt,
      userPrompt,
      async () => await callGemini(model, systemPrompt, userPrompt, secretKeyName),
      "Agent 1: Ingestion & Scraper"
    );
    
    const jsonMatch = rawText && rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const structuredFinancials = JSON.parse(jsonMatch[0]);
      console.log('[Agent 1] Ingestion & Live Scraping successfully completed via Gemini.');
      return { ...structuredFinancials, registryReport, scrapedRegistryData: registryReport };
    }
  } catch (geminiErr) {
    console.warn(`[Agent 1 Gemini Notice]: ${geminiErr.message}. Executing deterministic heuristic grounding...`);
  }

  // Deterministic extraction from the document text; throws if the monthly
  // credit series cannot be read, so the controller reports an extraction failure.
  const heuristic = extractHeuristicFinancials(rawContentToParse, originalFileName);
  return { ...heuristic, registryReport, scrapedRegistryData: registryReport || heuristic.scrapedRegistryData };
}

module.exports = { ingestAlternateData, extractHeuristicFinancials };
