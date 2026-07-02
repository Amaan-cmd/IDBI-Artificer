const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const { evaluateMSMECredit } = require('./controllers/creditController');

const upload = multer({ dest: 'uploads/' });

const app = express();

// Cybersecurity Hardening
app.use(helmet()); // Secure HTTP headers
app.use(cors());
app.use(express.json());
app.use(mongoSanitize()); // Prevent NoSQL Injection attacks in payload

// API Throttling / DDoS mitigation
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests from this IP, please try again later.' }
});
app.use('/api/', limiter);

const PORT = process.env.PORT || 4000;

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

// Simulate GSTN Sandbox Fetch
app.get('/api/v1/alternate-data/gst/:gstin', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(gstDataPath, 'utf8'));
    res.json({
      status: 'success',
      source: 'GSTN Portal',
      data: data
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch GST data' });
  }
});

// Evaluate MSME Credit Score (Live Agentic Pipeline with Multi-Modal Input)
app.post('/api/v1/evaluate', upload.single('statement'), evaluateMSMECredit);

// --- Server Startup ---
app.listen(PORT, () => {
  console.log(`[Backend] MSME Health Card Backend running on http://localhost:${PORT}`);
});
