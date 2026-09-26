const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const os = require('os');
const multer = require('multer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { evaluateMSMECredit } = require('./controllers/creditController');
const { loginUser, getAllUsers, getLoginTelemetry } = require('./controllers/userController');
const { getHistory } = require('./controllers/historyController');
const { trainAgamiPipeline } = require('./controllers/agamiController');
const { handleXAIChat } = require('./controllers/chatController');

const upload = multer({ dest: path.join(os.tmpdir(), 'uploads') });

const app = express();

// Cybersecurity Hardening
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(express.json());

// API Throttling / DDoS mitigation
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  message: { error: 'Too many requests from this IP, please try again later.' }
});
app.use('/api/', limiter);

const PORT = process.env.PORT || 4000;
1
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', service: 'EnverAI Artificer Backend', time: new Date().toISOString() });
});

// Serve compiled frontend in production / container deployment
const distPath = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Load Mock Data
const aaDataPath = path.join(__dirname, 'mockData', 'aa_bank_statement.json');
const gstDataPath = path.join(__dirname, 'mockData', 'gst_returns.json');

// --- Mock Integration Endpoints ---

// Simulate Sahamati/Account Aggregator FIU Fetch
app.get('/api/v1/alternate-data/account-aggregator/:businessId', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(aaDataPath, 'utf8'));
    res.json({
      status: 'success',
      source: 'Account Aggregator Framework',
      data: data
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch AA data' });
  }
});

const { scrapeBusinessIntelligence, generateGSTTimeline } = require('./services/scraperService');

// Live GSTN Sandbox / Timeline Fetch
app.get('/api/v1/alternate-data/gst/:gstin', (req, res) => {
  try {
    const data = generateGSTTimeline(req.params.gstin);
    res.json({
      status: 'success',
      source: 'Fetcha GSTN Portal Gateway (Grok 4.6 Tools)',
      data: data
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch GST data' });
  }
});

// Live GSTIN Radar Probe (Instant Registry & Statutory Check)
app.get('/api/v1/alternate-data/gstin-probe/:gstin', async (req, res) => {
  try {
    const gstin = req.params.gstin.trim().toUpperCase();
    const registry = await scrapeBusinessIntelligence(gstin);
    const timeline = generateGSTTimeline(gstin);
    res.json({
      status: 'success',
      gstin,
      registry,
      timeline
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to probe GSTIN registry' });
  }
});

// Evaluate MSME Credit Score (Live Agentic Pipeline with Multi-Modal Input)
app.post('/api/v1/evaluate', upload.single('statement'), evaluateMSMECredit);

// Agent 3 Conversational Forensic Interrogation
app.post('/api/v1/chat/xai', handleXAIChat);

// --- User & Profile Endpoints ---
app.post('/api/v1/users/login', loginUser);
app.get('/api/v1/users', getAllUsers);
app.get('/api/v1/telemetry/logins', getLoginTelemetry);

// --- History Endpoints ---
app.get('/api/v1/history', getHistory);

// --- Agami Pipeline Simulation ---
app.post('/api/v1/agami/train', trainAgamiPipeline);

// SPA fallback for client routing (Express 5 compatible)
if (fs.existsSync(distPath)) {
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// --- Server Startup ---
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[Backend] EnverAI Artificer Backend running on http://localhost:${PORT}`);
  });
}

const functions = require('firebase-functions');
exports.api = functions.https.onRequest(app);
