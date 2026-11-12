const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const os = require('os');
const multer = require('multer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { evaluateMSMECredit, validateEvaluateInput, isDemoEvaluation } = require('./controllers/creditController');
const { getAllUsers, getLoginTelemetry, sendOtp, verifyOtp } = require('./controllers/userController');
const { getHistory } = require('./controllers/historyController');
const { trainAgamiPipeline } = require('./controllers/agamiController');
const { handleXAIChat } = require('./controllers/chatController');
const { requireSession, requireAdmin } = require('./middleware/requireSession');
const { createSession } = require('./controllers/sessionController');
const { getBillingAccount } = require('./controllers/billingController');
const { stripeWebhook } = require('./billing/stripeWebhook');
const { withCharge } = require('./billing/meter');
const { isAcceptedGstin } = require('./utils/gstin');

const upload = multer({ dest: path.join(os.tmpdir(), 'uploads'), limits: { fileSize: 20 * 1024 * 1024 } });

// Parses the statement upload; upload errors become JSON instead of an HTML stack.
function uploadStatement(req, res, next) {
  upload.single('statement')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ code: 'FILE_TOO_LARGE', error: 'Statement files must be 20 MB or smaller.' });
    }
    if (err instanceof multer.MulterError) return res.status(400).json({ code: 'INVALID_UPLOAD', error: err.message });
    return next(err);
  });
}

// Removes the uploaded temp file however the request ends (400, 402, 503, success).
function cleanupUpload(req, res, next) {
  if (req.file) res.on('close', () => fs.rm(req.file.path, { force: true }, () => {}));
  next();
}

// Ledger references: a checksum-valid GSTIN only, never free text from the request.
const acceptedGstin = (value) => {
  const g = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return g && isAcceptedGstin(g) ? g : '';
};
const evaluateReference = (req) => acceptedGstin(req.body?.gstin) || (req.file ? 'statement upload' : 'manual data');
const chatReference = (req) => acceptedGstin(req.body?.evaluationPayload?.gstin);

const app = express();

// Cybersecurity Hardening
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4000',
  'https://artificer.enveraitech.in',
  'https://enveraitech.com',
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()) : [])
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    return callback(new Error('Blocked by Citadel CORS Security Policy'));
  },
  credentials: true
}));
// Stripe needs the raw body for signature verification, so this route is
// registered before express.json(). It ends the response itself, so the /api/
// rate limiter and session middleware registered later never run for it.
app.post('/api/v1/billing/stripe-webhook', express.raw({ type: 'application/json' }), stripeWebhook);
app.use(express.json());

// API Throttling / DDoS mitigation
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  message: { error: 'Too many requests from this IP, please try again later.' }
});
app.use('/api/', limiter);

const PORT = process.env.PORT || 4000;

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

// --- Mock Integration Endpoints ---

const { getRegistry, requireValidGstin, isDemoRegistryRequest, paramGstin } = require('./controllers/registryController');
const { isDemoMode } = require('./platform/demoMode');

// Simulate Sahamati/Account Aggregator FIU Fetch (demo mode only)
if (isDemoMode()) {
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
}

// Registry report (real GSTN / MCA21 data via Sandbox)
const meterRegistry = withCharge('registryLookup', { skip: isDemoRegistryRequest, reference: paramGstin });
app.get('/api/v1/registry/gstin/:gstin', requireSession, requireValidGstin, meterRegistry, getRegistry);
app.get('/api/v1/alternate-data/gstin-probe/:gstin', requireSession, requireValidGstin, meterRegistry, getRegistry);

// Evaluate MSME Credit Score (Live Agentic Pipeline with Multi-Modal Input)
app.post('/api/v1/evaluate', requireSession, uploadStatement, cleanupUpload, validateEvaluateInput,
  withCharge('evaluate', { skip: isDemoEvaluation, reference: evaluateReference }),
  evaluateMSMECredit);

// Agent 3 Conversational Forensic Interrogation
app.post('/api/v1/chat/xai', requireSession, withCharge('chat', { reference: chatReference }), handleXAIChat);

// --- User & Profile Endpoints ---
app.post('/api/v1/auth/send-code', sendOtp);
app.post('/api/v1/auth/verify-code', verifyOtp);
app.post('/api/v1/auth/session', createSession);
app.get('/api/v1/users', requireSession, requireAdmin, getAllUsers);
app.get('/api/v1/telemetry/logins', requireSession, requireAdmin, getLoginTelemetry);

// --- History Endpoints ---
app.get('/api/v1/history', requireSession, getHistory);

// --- Billing ---
app.get('/api/v1/billing/account', requireSession, getBillingAccount);

// --- Agami Pipeline Simulation ---
app.post('/api/v1/agami/train', requireSession, requireAdmin, trainAgamiPipeline);

// SPA fallback for client routing (Express 5 compatible)
if (fs.existsSync(distPath)) {
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// --- Server Startup (Azure App Service / Container Apps / Local) ---
// Not required to boot, but features degrade without them. Names only; never values.
const RECOMMENDED_ENV = ['SANDBOX_API_KEY', 'SANDBOX_API_SECRET', 'FIREBASE_PROJECT_ID'];
function missingRecommendedEnv(env = process.env) {
  return RECOMMENDED_ENV.filter((name) => !String(env[name] || '').trim());
}

if (require.main === module) {
  const missing = missingRecommendedEnv();
  if (missing.length) {
    console.warn(`[Startup] Missing recommended environment variables: ${missing.join(', ')}. Sandbox registry lookups are disabled without SANDBOX_API_KEY/SANDBOX_API_SECRET; Firebase token verification falls back to the default project id without FIREBASE_PROJECT_ID.`);
  }
  const { getTableStore } = require('./platform/tableStore');
  getTableStore().ensureTables().catch((err) => {
    console.error('[Table Store] Failed to ensure tables:', err.message);
    process.exit(1);
  });
  app.listen(PORT, () => {
    console.log(`[Citadel Azure Kernel] Artificer Underwriting Engine online on port ${PORT}`);
  });
}

module.exports = app;
module.exports.missingRecommendedEnv = missingRecommendedEnv;
