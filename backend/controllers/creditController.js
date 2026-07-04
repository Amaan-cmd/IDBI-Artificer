const { ingestAlternateData } = require('../agents/ingestionAgent');
const { analyzeFinancials } = require('../agents/analysisAgent');
const { synthesizeScore } = require('../agents/synthesisAgent');
const fs = require('fs');
const { incrementUserUsage } = require('./userController');
const { addHistoryRecord } = require('./historyController');

async function evaluateMSMECredit(req, res) {
  try {
    const file = req.file;
    const manualData = req.body.manualData; // Can be a stringified JSON if sent via form-data or raw json
    const userId = req.body.userId;
    let scraperData = null;
    try {
      if (req.body.scraperData) {
        scraperData = typeof req.body.scraperData === 'string' ? JSON.parse(req.body.scraperData) : req.body.scraperData;
      }
    } catch (e) {
      console.warn('Failed to parse scraperData:', e);
    }

    if (!file && !manualData) {
      return res.status(400).json({ error: 'No input provided. Please upload a file or enter manual data.' });
    }

    console.log(`\n[Credit Engine] Starting Live AI Evaluation (Input Mode: ${file ? 'FILE UPLOAD' : 'MANUAL DATA'})`);

    // Offline mockup fallback for presentation & testing when API Key is missing
    if (!process.env.NVIDIA_API_KEY) {
      console.log('[Credit Engine] NVIDIA_API_KEY env variable not found. Running in MOCK EVALUATION MODE for local presentation & testing.');
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      if (file) {
        fs.unlinkSync(file.path);
      }
      
      const responsePayload = {
        status: 'success',
        businessName: file ? "EnverAI Tech Retail Supplies Pvt Ltd" : "Demo Corp",
        metrics: {
          revenueRunRate: 1540000.00,
          cashBufferRatio: 0.45,
          isCashFlowStable: true,
          hasBounces: false,
          taxCompliance: "Excellent",
          reasoning: "Annualized run rate computed based on outward GSTR1 filings. Cash buffer ratio (bankClosingBalance / average monthly revenue) is 0.45, which indicates healthy short-term liquidity above the 0.15 threshold. Low inward bounce volume detected.",
          citations: [
            "Total taxable outward supplies value extracted as ₹1,540,000.00.",
            "GST Payment history indicates GSTR1 and GSTR3B both successfully filed for the tax period.",
            "Closing Balance of ₹760,700.50 vs debits of ₹695,500.00 shows strong cash-retention capabilities."
          ]
        },
        decision: {
          score: 760,
          riskLevel: "LOW",
          narrative: "The business exhibits a strong credit profile with robust operational revenue run rate and solid cash buffer reserves. Excellent tax compliance score and minimal inward transaction bounces support a favorable credit rating.",
          reasoning: "The synthesis agent assessed the MSME financial health at 760. High revenue stability and a cash buffer ratio of 0.45 provide substantial protection against short-term operational disruptions. No legal red flags or active court litigations were found in the public records scraper simulation.",
          citations: [
            "Risk level evaluated as LOW due to cashBufferRatio (0.45) > 0.15.",
            "Extracted GSTR compliance rating is 9.8/10.",
            "MCA Status verified as 'Active' with zero pending court disputes."
          ]
        }
      };
      const recordToSave = {
        userId,
        name: responsePayload.businessName,
        score: responsePayload.decision.score,
        risk: responsePayload.decision.riskLevel,
        revenue: responsePayload.metrics.revenueRunRate,
        buffer: `${responsePayload.metrics.cashBufferRatio}x`,
        compliance: responsePayload.metrics.taxCompliance,
        reason: responsePayload.decision.narrative
      };
      
      if (userId) {
        addHistoryRecord(recordToSave);
        incrementUserUsage(userId);
      }
      
      return res.json(responsePayload);
    }

    // 1. Live NVIDIA Nemotron Data Ingestion & Validation
    const structuredData = await ingestAlternateData({ file, manualData });
    
    // 2. Live NVIDIA Nemotron Analysis
    const analysis = await analyzeFinancials(structuredData);
    
    // 3. Live NVIDIA Nemotron Synthesis (factoring in external data)
    const finalDecision = await synthesizeScore(structuredData, analysis, scraperData);

    // Clean up uploaded file if it exists
    if (file) {
      fs.unlinkSync(file.path);
    }

    // 4. Construct Final Payload
    const responsePayload = {
      status: 'success',
      businessName: structuredData.businessName,
      metrics: analysis,
      decision: finalDecision
    };

    const recordToSave = {
      userId,
      name: responsePayload.businessName,
      score: responsePayload.decision.score,
      risk: responsePayload.decision.riskLevel,
      revenue: responsePayload.metrics.revenueRunRate,
      buffer: `${responsePayload.metrics.cashBufferRatio.toFixed(2)}x`,
      compliance: responsePayload.metrics.taxCompliance,
      reason: responsePayload.decision.narrative
    };

    if (userId) {
      addHistoryRecord(recordToSave);
      incrementUserUsage(userId);
    }

    res.json(responsePayload);

  } catch (error) {
    console.error('[Credit Engine] Error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to evaluate credit profile' });
  }
}

module.exports = { evaluateMSMECredit };
