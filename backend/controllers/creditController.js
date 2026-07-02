const { ingestAlternateData } = require('../agents/ingestionAgent');
const { analyzeFinancials } = require('../agents/analysisAgent');
const { synthesizeScore } = require('../agents/synthesisAgent');
const fs = require('fs');

async function evaluateMSMECredit(req, res) {
  try {
    const file = req.file;
    const manualData = req.body.manualData; // Can be a stringified JSON if sent via form-data or raw json
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

    res.json(responsePayload);

  } catch (error) {
    console.error('[Credit Engine] Error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to evaluate credit profile' });
  }
}

module.exports = { evaluateMSMECredit };
