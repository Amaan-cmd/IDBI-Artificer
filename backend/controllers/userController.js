const crypto = require('crypto');
const { normaliseEmail, issueSessionToken } = require('../platform/session');
const { isAdminEmail } = require('../platform/admin');
const { sanitizeEmail, sanitizeOtpDigits, isSafeInput } = require('../utils/sanitize');
const { ensureAccount } = require('../billing/ledgerService');
const records = require('../platform/entityRecords');
const { isEmailConfigured, sendOtpEmail } = require('../services/emailSender');

// Login audit entries live in table storage; a failed write never blocks sign-in.
const recordTelemetryLogin = async (entry) => {
  const { user, ...rest } = entry;
  const record = {
    id: `log_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    timestamp: new Date().toISOString(),
    ...rest,
    userId: user?.id || rest.userId || null
  };
  try {
    await records.addLogin(record);
  } catch (e) {
    console.warn('[SecOps] Failed to record login audit entry:', e.message);
  }
  return record;
};

const sendOtp = async (req, res) => {
  const cleanEmail = sanitizeEmail(req.body.email || '', 100);
  if (!cleanEmail || !cleanEmail.includes('@') || !isSafeInput(cleanEmail)) {
    return res.status(400).json({ error: 'Valid corporate email is required.' });
  }
  
  const isProduction = process.env.NODE_ENV === 'production';
  // Never claim a code was sent when there is no way to deliver it.
  if (isProduction && !isEmailConfigured()) {
    return res.status(503).json({ code: 'EMAIL_UNAVAILABLE', error: 'Email sign-in is not available right now. Please sign in with Google or Apple.' });
  }

  let code;
  try {
    code = await records.issueOtp(cleanEmail);
  } catch (err) {
    if (err instanceof records.OtpCooldownError) {
      res.set?.('Retry-After', String(err.retryAfterSec));
      return res.status(429).json({ code: 'OTP_COOLDOWN', error: `A code was just sent. Please wait ${err.retryAfterSec}s before requesting another.`, retryAfter: err.retryAfterSec });
    }
    console.error('[Auth] OTP issue failed:', err.message);
    return res.status(503).json({ code: 'OTP_UNAVAILABLE', error: 'Could not issue a verification code. Please retry.' });
  }

  if (isEmailConfigured()) {
    try {
      await sendOtpEmail(cleanEmail, code);
      console.log(`[Auth Sentinel] Verification code emailed to ${cleanEmail}`);
    } catch (err) {
      console.error('[Auth] Email send failed:', err.message);
      await records.clearOtp(cleanEmail).catch(() => {});
      return res.status(502).json({ code: 'EMAIL_SEND_FAILED', error: 'The verification email could not be sent. Please retry or sign in with Google or Apple.' });
    }
  } else {
    // Development without an email sender: the console is the only way to read the code.
    console.log(`[Auth Sentinel] Verification code for ${cleanEmail}: ${code} (email sender not configured)`);
  }

  // Development-only convenience: echo the code back to the client. Never for
  // admin addresses, so a misconfigured deployment cannot hand out admin sessions.
  const isDevOrDemo = process.env.NODE_ENV !== 'production'
    && process.env.ENABLE_DEMO_OTP === 'true'
    && !isAdminEmail(cleanEmail);

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

  let isValid;
  try {
    // Brute-force guard: a code is burned after MAX_OTP_ATTEMPTS wrong guesses.
    isValid = await records.verifyOtpCode(cleanEmail, cleanCode);
  } catch (err) {
    console.error('[Auth] OTP verification failed:', err.message);
    return res.status(503).json({ code: 'OTP_UNAVAILABLE', error: 'Verification is temporarily unavailable. Please retry.' });
  }

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid or expired verification code. Please request a new code.' });
  }

  let user;
  try {
    user = await findOrCreateUser({ email: cleanEmail, provider: 'email' });
  } catch (err) {
    console.error('[Auth] User record failed:', err.message);
    return res.status(503).json({ code: 'USER_STORE_UNAVAILABLE', error: 'Sign-in is temporarily unavailable. Please retry.' });
  }

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

  ensureAccount(cleanEmail).catch((err) => console.error('[Billing] ensureAccount at sign-in failed:', err.message));
  return res.json({ status: 'success', user, sessionToken: issueSessionToken(user) });
};

const getAllUsers = async (req, res) => {
  const users = await records.listUsers();
  // Strip sensitive passkeys before returning
  const sanitizedUsers = users.map(({ passkey, ...u }) => u);
  res.json({ status: 'success', users: sanitizedUsers });
};

const getLoginTelemetry = async (req, res) => {
  const logins = await records.listLogins();
  res.json({ status: 'success', logins });
};

// costDollars is the price actually charged for the action (0 for admins and
// demo presets). Usage counters are informational: failures are only logged.
const incrementUserUsage = async (email, costDollars = 0) => {
  if (!email) return;
  try {
    await records.updateUser(normaliseEmail(email), (user) => ({
      ...user,
      calls: (user.calls || 0) + 1,
      cost: Math.round(((user.cost || 0) + costDollars) * 100) / 100
    }));
  } catch (err) {
    console.warn('[Users] Usage counter update failed:', err.message);
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

const findOrCreateUser = async ({ email, name, provider }) => {
  const cleanEmail = normaliseEmail(email);
  const existing = await records.updateUser(cleanEmail, (user) => ({ ...user, lastLogin: new Date().toISOString() }));
  if (existing) return existing;
  return records.saveUser(buildNewUser({ email: cleanEmail, name, provider }));
};

module.exports = { getAllUsers, getLoginTelemetry, incrementUserUsage, recordTelemetryLogin, sendOtp, verifyOtp, findOrCreateUser, buildNewUser };

