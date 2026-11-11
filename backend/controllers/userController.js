const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { normaliseEmail, issueSessionToken } = require('../platform/session');
const { isAdminEmail } = require('../platform/admin');
const { sanitizeEmail, sanitizeOtpDigits, isSafeInput } = require('../utils/sanitize');

const usersFilePath = path.join(__dirname, '../data/users.json');
const telemetryLoginsPath = path.join(__dirname, '../data/telemetry_logins.json');

// In-memory verification code store for email OTP authentication
const otpCache = new Map();

const getUsers = () => {
  try {
    const data = fs.readFileSync(usersFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
};

const saveUsers = (users) => {
  try {
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2), 'utf8');
  } catch (e) {
    console.warn("Failed to save local users.json");
  }
};

const getLocalTelemetryLogins = () => {
  try {
    if (!fs.existsSync(telemetryLoginsPath)) return [];
    const data = fs.readFileSync(telemetryLoginsPath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
};

const recordTelemetryLogin = async (entry) => {
  const record = {
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...entry
  };

  // Secure local append to telemetry audit ledger
  try {
    const logs = getLocalTelemetryLogins();
    logs.unshift(record);
    // Keep last 500 login audit records
    if (logs.length > 500) logs.length = 500;
    fs.writeFileSync(telemetryLoginsPath, JSON.stringify(logs, null, 2), 'utf8');
  } catch (e) {
    console.warn("[SecOps] Failed to append to local telemetry_logins.json:", e.message);
  }

  return record;
};

const sendOtp = async (req, res) => {
  const cleanEmail = sanitizeEmail(req.body.email || '', 100);
  if (!cleanEmail || !cleanEmail.includes('@') || !isSafeInput(cleanEmail)) {
    return res.status(400).json({ error: 'Valid corporate email is required.' });
  }
  
  // Generate a cryptographically random 6-digit verification code
  const code = crypto.randomInt(100000, 1000000).toString();
  otpCache.set(cleanEmail, {
    code,
    expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes expiry
  });

  console.log(`[Auth Sentinel] Dispatching verification code for ${cleanEmail}: ${code}`);

  const isDevOrDemo = process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEMO_OTP === 'true';

  const responsePayload = {
    status: 'success',
    message: `Verification code dispatched to ${cleanEmail}`,
    email: cleanEmail
  };

  // Strictly protected: Never leak demoCode in production deployments
  if (isDevOrDemo) {
    responsePayload.demoCode = code;
  }

  return res.json(responsePayload);
};

const verifyOtp = async (req, res) => {
  const cleanEmail = sanitizeEmail(req.body.email || '', 100);
  const cleanCode = sanitizeOtpDigits(req.body.code || '', 6);

  if (!cleanEmail || !cleanCode || cleanCode.length < 6) {
    return res.status(400).json({ error: 'Valid email and 6-digit verification code are required.' });
  }

  const cached = otpCache.get(cleanEmail);

  const isValid = Boolean(cached && cached.expiresAt > Date.now() && cached.code === cleanCode);

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid or expired verification code. Please request a new code.' });
  }

  // Find or automatically create user account
  const users = getUsers();
  let user = users.find(u => u.email && u.email.toLowerCase() === cleanEmail);

  if (!user) {
    const handle = cleanEmail.split('@')[0];
    const domain = cleanEmail.split('@')[1];
    const formattedName = handle.split('.').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
    
    user = {
      id: `u_${handle}_${Date.now().toString().slice(-4)}`,
      username: formattedName || 'Institutional Officer',
      email: cleanEmail,
      role: domain === 'enveraitech.com' ? 'Enterprise Principal Underwriter' : 'Institutional Risk Evaluator',
      status: 'Active (Email Verified)',
      org: domain.includes('idbi') ? 'IDBI Bank Ltd.' : 'Enver AI Tech Partner',
      calls: 0,
      cost: 0,
      lastLogin: new Date().toISOString()
    };
    users.push(user);
    saveUsers(users);
  } else {
    user.lastLogin = new Date().toISOString();
    saveUsers(users);
  }

  // Clean cache
  otpCache.delete(cleanEmail);

  // Record login in audit ledger
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || 'Browser';
  await recordTelemetryLogin({
    email: cleanEmail,
    ip: clientIp,
    userAgent,
    type: 'email_otp',
    status: 'SUCCESS'
  });

  return res.json({ status: 'success', user, sessionToken: issueSessionToken(user) });
};

const getAllUsers = async (req, res) => {
  const users = getUsers();
  // Strip sensitive passkeys before returning
  const sanitizedUsers = users.map(({ passkey, ...u }) => u);
  res.json({ status: 'success', users: sanitizedUsers });
};

const getLoginTelemetry = async (req, res) => {
  const logins = getLocalTelemetryLogins();
  res.json({ status: 'success', logins });
};

const incrementUserUsage = async (userId) => {
  const users = getUsers();
  const user = users.find(u => u.id === userId);
  if (user) {
    user.calls = (user.calls || 0) + 1;
    user.cost = Math.round(((user.cost || 0) + 0.02) * 100) / 100;
    saveUsers(users);
  }
};

// Builds a new user record for a server-verified identity. Pure (no I/O).
const buildNewUser = ({ email, name, provider = 'firebase' }) => {
  const cleanEmail = normaliseEmail(email);
  const parts = cleanEmail.split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error('A valid email is required to create a user.');
  }
  const [handle, domain] = parts;
  const formattedName = (name || handle).split(/[._-]/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
  const now = new Date().toISOString();
  return {
    id: `u_${handle.replace(/[^a-z0-9]/g, '')}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    username: formattedName || 'Institutional Underwriter',
    email: cleanEmail,
    role: isAdminEmail(cleanEmail) ? 'Enterprise Principal Underwriter' : 'Institutional Underwriter',
    org: domain.toUpperCase(),
    provider,
    status: `Active (${provider} verified)`,
    calls: 0,
    cost: 0,
    createdAt: now,
    lastLogin: now
  };
};

const findOrCreateUser = ({ email, name, provider }) => {
  const cleanEmail = normaliseEmail(email);
  const users = getUsers();
  let user = users.find(u => u.email && u.email.toLowerCase() === cleanEmail);
  if (!user) {
    user = buildNewUser({ email: cleanEmail, name, provider });
    users.push(user);
  } else {
    user.lastLogin = new Date().toISOString();
  }
  saveUsers(users);
  return user;
};

module.exports = { getAllUsers, getLoginTelemetry, incrementUserUsage, recordTelemetryLogin, sendOtp, verifyOtp, findOrCreateUser, buildNewUser };

