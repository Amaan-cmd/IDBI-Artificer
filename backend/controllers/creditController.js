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

async function evaluateMSMECredit(req, res) {
  // Declared here so the outer catch can always stop the SSE heartbeat.
  let cleanup = () => {};
  try {
    const file = req.file;
    const manualData = req.body.manualData;
    const gstin = req.body.gstin;
    const { uid: userId, email: userEmail, name: userName, role: userRole } = req.session;
    const enableScraper = req.body.enableScraper === 'true' || req.body.enableScraper === true;

    if (!file && !manualData && !gstin) {
      return res.status(400).json({ error: 'No input provided. Please enter a GSTIN, upload a file, or enter manual data.' });
    }
    if (!file && !manualData && !isAcceptedGstin(String(gstin).trim().toUpperCase())) {
      return res.status(400).json({ code: 'INVALID_GSTIN', error: 'Enter a valid 15-character GSTIN.' });
    }

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
        res.write(`data: ${JSON.stringify({
          step: 99,
          error: `JEV System 1 Gatekeeper: Document rejected as inappropriate/fraudulent. ${jevReport.rationale}`,
          jevReport
        })}\n\n`);
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
        structuredData.registryReport
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
      incrementUserUsage(userId);

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
        res.write(`data: ${JSON.stringify({ step: 99, error: 'Could not extract financials from the uploaded statement. Please upload a clearer statement (PDF or CSV).' })}\n\n`);
        cleanup();
        return res.end();
      }
      if (fallbackStructured.reportType === 'REGISTRY_SCREENING') {
        res.write(`data: ${JSON.stringify({ step: 99, error: 'Registry screening could not be completed. Please retry.' })}\n\n`);
        cleanup();
        return res.end();
      }

      res.write(`data: ${JSON.stringify({ step: 1, agent: 'JEV' })}\n\n`);
      const jevReport = runDeterministicSanityCheck(fallbackStructured);
      if (!jevReport.isAppropriate) {
        console.warn('[Credit Engine] JEV deterministic check rejected fallback extraction:', jevReport.rationale);
        if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
        res.write(`data: ${JSON.stringify({
          step: 99,
          error: `JEV System 1 Gatekeeper: Document rejected as inappropriate/fraudulent. ${jevReport.rationale}`,
          jevReport
        })}\n\n`);
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
        fallbackStructured.registryReport
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
      incrementUserUsage(userId);

      res.write(`data: ${JSON.stringify({ step: 4, payload: responsePayload })}\n\n`);
      cleanup();
      return res.end();
    }

  } catch (error) {
    console.error('[Credit Engine] Error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Failed to evaluate credit profile' });
    } else {
      // step 99 is the client's terminal-error signal.
      try {
        res.write(`data: ${JSON.stringify({ step: 99, error: error.message || 'Failed to evaluate credit profile' })}\n\n`);
      } catch { /* stream already closed */ }
      cleanup();
      res.end();
    }
  }
}

module.exports = { evaluateMSMECredit };
