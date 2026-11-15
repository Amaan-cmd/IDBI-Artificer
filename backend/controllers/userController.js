const crypto = require('crypto');
const { normaliseEmail } = require('../platform/session');
const { isAdminEmail } = require('../platform/admin');
const { ensureAccount } = require('../billing/ledgerService');
const records = require('../platform/entityRecords');

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

module.exports = { getAllUsers, getLoginTelemetry, incrementUserUsage, recordTelemetryLogin, findOrCreateUser, buildNewUser };

