const { ingestAlternateData } = require('../agents/ingestionAgent');
const { evaluateAppropriateness, runDeterministicSanityCheck } = require('../agents/jevGatekeeper');
const { analyzeFinancials } = require('../agents/analysisAgent');
const { synthesizeScore } = require('../agents/synthesisAgent');
const { computeFinancialTelemetry } = require('../utils/financialTelemetry');
const fs = require('fs');
const { azureStorage } = require('../utils/azureStorage');
const { incrementUserUsage } = require('./userController');
const { addHistoryRecord } = require('./historyController');
const { sendSlackNotification } = require('../services/slackNotifier');
const { applyRegistryAdjustments } = require('../services/registry/registryAdjustments');
const { isAcceptedGstin } = require('../utils/gstin');
const { hasRegistryData } = require('./registryController');
const { isDemoMode } = require('../platform/demoMode');
const { demoFinancials } = require('../demo/demoEntities');

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// History / notification summary of the metrics. Values telemetry could not
// compute are null in the payload and rendered as "not available" here.
function metricSummary(metrics) {
  const m = metrics || {};
  return {
    revenue: isNum(m.revenueRunRate) ? m.revenueRunRate : null,
    buffer: isNum(m.cashBufferRatio) ? `${Math.round(m.cashBufferRatio * 100) / 100}x` : 'not available',
    compliance: typeof m.taxCompliance === 'string' && m.taxCompliance ? m.taxCompliance : 'NOT_ASSESSED'
  };
}

// The account-holder name used for the registry entity match. Only a name
// printed in the statement or supplied in a structured payload is compared; a
// name derived from the file name or not found in the statement text is
// treated as unknown ("Entity match not verified").
const RELIABLE_NAME_SOURCES = new Set(['statement', 'manual']);
function verifiedStatementName(structured) {
  return structured && RELIABLE_NAME_SOURCES.has(structured.businessNameSource) ? structured.businessName : null;
}

// Input check shared by the pre-billing middleware and the handler.
function evaluateInputError(req) {
  const { manualData, gstin } = req.body || {};
  if (!req.file && !manualData && !gstin) {
    return { error: 'No input provided. Please enter a GSTIN, upload a file, or enter manual data.' };
  }
  if (!req.file && !manualData && !isAcceptedGstin(String(gstin).trim().toUpperCase())) {
    return { code: 'INVALID_GSTIN', error: 'Enter a valid 15-character GSTIN.' };
  }
  return null;
}

// Runs before billing so empty or malformed requests are never charged.
function validateEvaluateInput(req, res, next) {
  const problem = evaluateInputError(req);
  if (problem) return res.status(400).json(problem);
  return next();
}

// GSTIN-only demo presets are free.
function isDemoEvaluation(req) {
  const gstin = String(req.body?.gstin || '').trim().toUpperCase();
  return isDemoMode() && !req.file && !req.body?.manualData && Boolean(demoFinancials(gstin));
}

// step 99 is the client's terminal-error signal; a failed run is refunded.
// The refund completes before the write, so the client's follow-up balance
// read sees it; a refund rejection cannot skip the write.
async function streamFailure(req, res, payload) {
  try {
    await req.billing?.refund(payload.error);
  } catch { /* refund logs its own errors */ }
  res.write(`data: ${JSON.stringify({ step: 99, ...payload })}\n\n`);
}

async function evaluateMSMECredit(req, res) {
  // Declared here so the outer catch can always stop the SSE heartbeat.
  let cleanup = () => {};
  try {
    const file = req.file;
    const manualData = req.body.manualData;
    const gstin = req.body.gstin;
    const { uid: userId, email: userEmail, name: userName, role: userRole } = req.session;
    const enableScraper = req.body.enableScraper === 'true' || req.body.enableScraper === true;

    const problem = evaluateInputError(req);
    if (problem) return res.status(400).json(problem);

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (res.flushHeaders) {
        res.flushHeaders();
    }

    // Keep-alive heartbeat interval (prevents cloud proxy / client 30s timeout)
    const heartbeat = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch {}
    }, 4000);

    cleanup = () => {
      clearInterval(heartbeat);
    };
    req.on('close', cleanup);

    console.log(`\n[Credit Engine] Starting Live 4-Agent Cognitive Evaluation (Scraper: ${enableScraper ? 'ENABLED' : 'DISABLED'})`);

    try {
      // Archive statutory statement to Azure Blob Storage if configured
      if (file && fs.existsSync(file.path)) {
        try {
          const fileBuf = fs.readFileSync(file.path);
          azureStorage.saveStatementFile(file.originalname || file.filename, fileBuf, file.mimetype);
        } catch (storageErr) {
          console.warn('[Azure Storage] Statement archiving note:', storageErr.message);
        }
      }

      // 1. Live Google Gemini / Grok 4.6 Ingestion & Live Web Scraper (Agent 1 - Fetcha)
      res.write(`data: ${JSON.stringify({ step: 0, agent: 'FETCHA' })}\n\n`);
      const structuredData = await ingestAlternateData({ file, manualData, gstin, enableScraper });

      // GSTIN-only run: registry screening, no financials and therefore no score.
      if (structuredData.reportType === 'REGISTRY_SCREENING') {
        const report = structuredData.registryReport;
        const screeningPayload = {
          status: 'success',
          reportType: 'REGISTRY_SCREENING',
          gstin: structuredData.gstin,
          businessName: report?.gst?.status === 'ok' ? report.gst.data.legalName : structuredData.gstin,
          registryReport: report
        };
        addHistoryRecord({
          userId, userEmail, userName: userName || userEmail, userRole: userRole || 'Institutional Credit Officer',
          name: screeningPayload.businessName, gstin: screeningPayload.gstin, score: null, risk: null,
          reason: 'Registry screening (no statement uploaded)', fullPayload: screeningPayload
        });
        // A screening with no registry data is still delivered, but not charged.
        let screeningCost = (req.billing?.priceCents || 0) / 100;
        if (!hasRegistryData(report)) {
          req.billing?.refund('registry unavailable');
          screeningCost = 0;
        }
        incrementUserUsage(userId, screeningCost);
        res.write(`data: ${JSON.stringify({ step: 4, payload: screeningPayload })}\n\n`);
        cleanup();
        return res.end();
      }
      
      // 2. JEV System 1 Cognitive Gatekeeper (Appropriateness & Injection Filter)
      res.write(`data: ${JSON.stringify({ step: 1, agent: 'JEV' })}\n\n`);
      const jevReport = await evaluateAppropriateness(structuredData);

      if (!jevReport.isAppropriate) {
        console.warn('[Credit Engine] JEV System 1 rejected extraction:', jevReport.rationale);
        if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
        await streamFailure(req, res, {
          error: `JEV System 1 Gatekeeper: Document rejected as inappropriate/fraudulent. ${jevReport.rationale}`,
          jevReport
        });
        cleanup();
        return res.end();
      }

      // Enrich structuredData with JEV System 1 verified balance continuity & bounce exclusions
      if (jevReport.solvencyBouncesVerified !== undefined) {
        structuredData.solvencyBouncesVerified = jevReport.solvencyBouncesVerified;
      }
      if (jevReport.technicalBouncesExcluded !== undefined) {
        structuredData.technicalBouncesExcluded = jevReport.technicalBouncesExcluded;
      }
      if (jevReport.balanceContinuity !== undefined) {
        structuredData.balanceContinuity = jevReport.balanceContinuity;
      }

      // 3. Quantitative Calculation Matrix (Agent 2 - Geek System 2)
      res.write(`data: ${JSON.stringify({ step: 2, agent: 'GEEK', jevReport })}\n\n`);
      const calculationMatrix = await analyzeFinancials(structuredData);
      
      // 4. Chief Credit Officer Synthesis & XAI Audit (Agent 3 - Orc)
      res.write(`data: ${JSON.stringify({ step: 3, agent: 'ORC' })}\n\n`);
      // The registry report reaches the LLM via structuredData; it is not an override.
      // Registry facts move the score only through the deterministic adjustments.
      const finalDecision = applyRegistryAdjustments(
        await synthesizeScore(structuredData, calculationMatrix, null),
        structuredData.registryReport,
        { statementName: verifiedStatementName(structuredData) }
      );

      // Clean up uploaded file if it exists
      if (file && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      // 5. Construct Final Payload with JEV Audit Seal
      const responsePayload = {
        status: 'success',
        businessName: structuredData.businessName,
        gstin: structuredData.gstin || gstin,
        metrics: calculationMatrix,
        decision: finalDecision,
        jevAudit: jevReport,
        registryReport: structuredData.registryReport || null,
        agent1Telemetry: structuredData
      };

      const summary = metricSummary(responsePayload.metrics);
      const recordToSave = {
        userId,
        userEmail,
        userName: userName || userEmail,
        userRole: userRole || 'Institutional Credit Officer',
        name: responsePayload.businessName,
        gstin: structuredData.gstin || gstin || null,
        score: responsePayload.decision.score,
        risk: responsePayload.decision.riskLevel,
        ...summary,
        reason: responsePayload.decision?.narrative || 'No narrative provided.',
        fullPayload: responsePayload
      };

      addHistoryRecord(recordToSave);
      incrementUserUsage(userId, (req.billing?.priceCents || 0) / 100);

      // Dispatch Slack notification for evaluation completed
      sendSlackNotification({
        title: `MSME Underwriting Complete: ${responsePayload.businessName}`,
        message: `Evaluation completed with Health Score: *${responsePayload.decision.score}* (Risk: *${responsePayload.decision.riskLevel}*)`,
        fields: [
          { title: "Entity Name", value: responsePayload.businessName, short: true },
          { title: "Credit Score", value: `${responsePayload.decision.score} / 900`, short: true },
          { title: "Cash Buffer", value: summary.buffer, short: true },
          { title: "Tax Compliance", value: summary.compliance, short: true }
        ],
        color: responsePayload.decision.riskLevel === 'LOW' ? '#3A9A3C' : (responsePayload.decision.riskLevel === 'MEDIUM' ? '#E8660A' : '#CC0000')
      });

      res.write(`data: ${JSON.stringify({ step: 4, payload: responsePayload })}\n\n`);
      cleanup();
      return res.end();

    } catch (liveAiError) {
      console.warn(`[Credit Engine] Live Agent pipeline notice (${liveAiError.message}). Operating deterministic grounding fallback.`);

      res.write(`data: ${JSON.stringify({ step: 0, agent: 'FETCHA' })}\n\n`);
      let fallbackStructured;
      try {
        // Keep the registry lookup on: results are cached, and without the report
        // the fallback decision would silently skip the registry adjustments.
        fallbackStructured = await ingestAlternateData({ file, manualData, gstin, enableScraper });
      } catch (ingErr) {
        console.warn('[Credit Engine] Fallback extraction failed:', ingErr.message);
        if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
        await streamFailure(req, res, { error: 'Could not extract financials from the uploaded statement. Please upload a clearer statement (PDF or CSV).' });
        cleanup();
        return res.end();
      }
      if (fallbackStructured.reportType === 'REGISTRY_SCREENING') {
        await streamFailure(req, res, { error: 'Registry screening could not be completed. Please retry.' });
        cleanup();
        return res.end();
      }

      res.write(`data: ${JSON.stringify({ step: 1, agent: 'JEV' })}\n\n`);
      const jevReport = runDeterministicSanityCheck(fallbackStructured);
      if (!jevReport.isAppropriate) {
        console.warn('[Credit Engine] JEV deterministic check rejected fallback extraction:', jevReport.rationale);
        if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
        await streamFailure(req, res, {
          error: `JEV System 1 Gatekeeper: Document rejected as inappropriate/fraudulent. ${jevReport.rationale}`,
          jevReport
        });
        cleanup();
        return res.end();
      }
      for (const k of ['solvencyBouncesVerified', 'technicalBouncesExcluded', 'balanceContinuity']) {
        if (jevReport[k] !== undefined) fallbackStructured[k] = jevReport[k];
      }

      res.write(`data: ${JSON.stringify({ step: 2, agent: 'GEEK', jevReport })}\n\n`);
      const deterministic = computeFinancialTelemetry(fallbackStructured);

      res.write(`data: ${JSON.stringify({ step: 3, agent: 'ORC' })}\n\n`);
      const finalDecision = applyRegistryAdjustments(
        await synthesizeScore(fallbackStructured, deterministic, null, { deterministicOnly: true }),
        fallbackStructured.registryReport,
        { statementName: verifiedStatementName(fallbackStructured) }
      );

      if (file && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      const responsePayload = {
        status: 'success',
        businessName: fallbackStructured.businessName,
        gstin: fallbackStructured.gstin || gstin || null,
        metrics: deterministic,
        decision: finalDecision,
        jevAudit: jevReport,
        registryReport: fallbackStructured.registryReport || null,
        agent1Telemetry: fallbackStructured
      };

      const recordToSave = {
        userId,
        userEmail,
        userName: userName || userEmail,
        userRole: userRole || 'Institutional Credit Officer',
        name: responsePayload.businessName,
        gstin: responsePayload.gstin,
        score: responsePayload.decision.score,
        risk: responsePayload.decision.riskLevel,
        ...metricSummary(responsePayload.metrics),
        reason: responsePayload.decision.narrative,
        fullPayload: responsePayload
      };

      addHistoryRecord(recordToSave);
      incrementUserUsage(userId, (req.billing?.priceCents || 0) / 100);

      res.write(`data: ${JSON.stringify({ step: 4, payload: responsePayload })}\n\n`);
      cleanup();
      return res.end();
    }

  } catch (error) {
    console.error('[Credit Engine] Error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Failed to evaluate credit profile' });
    } else {
      try {
        await streamFailure(req, res, { error: error.message || 'Failed to evaluate credit profile' });
      } catch { /* stream already closed */ }
      cleanup();
      res.end();
    }
  }
}

module.exports = { evaluateMSMECredit, verifiedStatementName, validateEvaluateInput, isDemoEvaluation };
