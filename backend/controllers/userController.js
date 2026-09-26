const fs = require('fs');
const path = require('path');
const { db } = require('../utils/firebaseAdmin');
const { sendSlackNotification } = require('../services/slackNotifier');

const usersFilePath = path.join(__dirname, '../data/users.json');
const telemetryLoginsPath = path.join(__dirname, '../data/telemetry_logins.json');

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

  // 1. Dual-write to local JSON telemetry archive
  try {
    const logs = getLocalTelemetryLogins();
    logs.unshift(record);
    // Keep last 500 login audit records
    if (logs.length > 500) logs.length = 500;
    fs.writeFileSync(telemetryLoginsPath, JSON.stringify(logs, null, 2), 'utf8');
  } catch (e) {
    console.warn("[SecOps] Failed to append to local telemetry_logins.json:", e.message);
  }

  // 2. Dual-write to Firestore DB collection if available
  if (db) {
    try {
      await db.collection('telemetry_logins').doc(record.id).set(record);
    } catch (e) {
      console.warn("[SecOps] Firestore telemetry_logins write notice:", e.message);
    }
  }

  return record;
};

const loginUser = async (req, res) => {
  const { username, password, email, authType } = req.body;
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || 'Unknown Device';

  let rawIdentifier = (email || username || '').trim().toLowerCase();

  // If user entered only handle e.g. "andalaus", automatically qualify as "andalaus@enveraitech.com"
  if (rawIdentifier && !rawIdentifier.includes('@')) {
    rawIdentifier = `${rawIdentifier}@enveraitech.com`;
  }
  const userEmail = rawIdentifier;

  // 1. Strict Domain Enforcement: Strictly @enveraitech.com accounts only
  if (!userEmail || !userEmail.endsWith('@enveraitech.com')) {
    console.warn(`[Security Alert] Unauthorized access attempt blocked for non-enveraitech domain: ${userEmail || '(blank)'}`);
    
    await recordTelemetryLogin({
      email: userEmail || 'unknown',
      ip: clientIp,
      userAgent,
      type: authType || 'manual',
      status: 'REJECTED_UNAUTHORIZED_DOMAIN',
      reason: 'Domain must end with @enveraitech.com'
    });

    sendSlackNotification({
      title: "UNAUTHORIZED LOGIN ATTEMPT BLOCKED",
      message: `Attempted access from non-EnverAI identity: *${userEmail}*`,
      fields: [
        { title: "Target Email", value: userEmail, short: true },
        { title: "IP Address", value: clientIp, short: true },
        { title: "Status", value: "REJECTED (Access Denied)", short: true }
      ],
      color: '#CC0000'
    });

    return res.status(403).json({ 
      error: 'Access Denied: Only verified @enveraitech.com enterprise accounts are permitted to access the Underwriting Citadel.' 
    });
  }

  // 2. Google OAuth SSO branch (Google Workspace verified @enveraitech.com)
  if (authType === 'google') {
    const userHandle = userEmail.split('@')[0];
    const users = getUsers();
    const existingUser = users.find(u => u.email.toLowerCase() === userEmail);
    const formattedName = existingUser?.username || userHandle.split('.').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');

    const userObj = {
      id: existingUser?.id || `u_google_${Date.now()}`,
      username: formattedName || 'Enver Officer',
      email: userEmail,
      role: existingUser?.role || 'Enterprise Institutional Underwriter',
      org: 'Enver AI Tech',
      calls: existingUser?.calls || 0,
      cost: existingUser?.cost || 0,
      lastLogin: new Date().toISOString()
    };

    await recordTelemetryLogin({
      user: userObj,
      email: userEmail,
      ip: clientIp,
      userAgent,
      type: 'google_workspace',
      status: 'AUTHORIZED'
    });

    sendSlackNotification({
      title: "Authorized EnverAI Enterprise Login",
      message: `EnverAI Personnel *${userEmail}* logged into Artificer Portal via Google Workspace SSO.`,
      fields: [
        { title: "User Email", value: userEmail, short: true },
        { title: "Client IP", value: clientIp, short: true }
      ],
      color: '#3A9A3C'
    });

    return res.json({ status: 'success', user: userObj });
  }

  // 3. Corporate Credential Verification (Citadel Passkey Wall)
  const normalizedPassword = (password || '').trim();
  const masterPasskey = process.env.CITADEL_SECOPS_PASSKEY || 'Citadel@296';
  
  const users = getUsers();
  const existingUser = users.find(u => u.email.toLowerCase() === userEmail);
  const userSpecificPasskey = existingUser?.passkey;

  const isPasswordValid = Boolean(
    normalizedPassword && 
    (normalizedPassword === masterPasskey || (userSpecificPasskey && normalizedPassword === userSpecificPasskey))
  );

  if (!isPasswordValid) {
    console.warn(`[Security Alert] Invalid Citadel Security Key attempt for user: ${userEmail}`);
    
    await recordTelemetryLogin({
      email: userEmail,
      ip: clientIp,
      userAgent,
      type: 'corporate_credential',
      status: 'REJECTED_INVALID_PASSKEY',
      reason: 'Supplied passkey does not match authorized Citadel security key'
    });

    sendSlackNotification({
      title: "AUTHENTICATION FAILED (INVALID CITADEL KEY)",
      message: `Invalid security key provided for *${userEmail}*`,
      fields: [
        { title: "Email", value: userEmail, short: true },
        { title: "IP Address", value: clientIp, short: true },
        { title: "Status", value: "BLOCKED (Invalid Key)", short: true }
      ],
      color: '#CC0000'
    });

    return res.status(401).json({ 
      error: 'Access Denied: Invalid Citadel Security Key / Passkey. Only authorized personnel possessing the security key may access.' 
    });
  }

  // Valid credentials verified
  const userHandle = userEmail.split('@')[0];
  const formattedName = existingUser?.username || (userHandle === 'andalaus' 
    ? 'Andalaus' 
    : userHandle.split('.').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' '));

  const authenticatedUser = {
    id: existingUser?.id || `u_${userHandle}_${Date.now()}`,
    username: formattedName,
    email: userEmail,
    role: existingUser?.role || (userHandle === 'andalaus' || userHandle === 'amaan' 
      ? 'Chief Underwriting Officer & Master SecOps' 
      : 'Institutional Credit Officer'),
    org: 'Enver AI Tech',
    calls: existingUser?.calls || 0,
    cost: existingUser?.cost || 0,
    lastLogin: new Date().toISOString()
  };

  await recordTelemetryLogin({
    user: authenticatedUser,
    email: userEmail,
    ip: clientIp,
    userAgent,
    type: 'corporate_credential',
    status: 'AUTHORIZED'
  });

  sendSlackNotification({
    title: "Authorized EnverAI Credential Login",
    message: `Enterprise User *${userEmail}* authenticated successfully into Artificer Underwriting Cockpit.`,
    fields: [
      { title: "User", value: formattedName, short: true },
      { title: "Email", value: userEmail, short: true },
      { title: "IP Address", value: clientIp, short: true }
    ],
    color: '#3A9A3C'
  });

  return res.json({ status: 'success', user: authenticatedUser });
};

const getAllUsers = async (req, res) => {
  if (db) {
    try {
      const snapshot = await db.collection('users').get();
      if (!snapshot.empty) {
        const users = snapshot.docs.map(doc => doc.data());
        return res.json({ status: 'success', users });
      }
    } catch (e) {
      console.error("Firestore getAllUsers failed:", e);
    }
  }
  
  const users = getUsers();
  // Strip sensitive passkeys before returning
  const sanitizedUsers = users.map(({ passkey, ...u }) => u);
  res.json({ status: 'success', users: sanitizedUsers });
};

const getLoginTelemetry = async (req, res) => {
  if (db) {
    try {
      const snapshot = await db.collection('telemetry_logins').orderBy('timestamp', 'desc').limit(100).get();
      if (!snapshot.empty) {
        const logins = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return res.json({ status: 'success', logins });
      }
    } catch (e) {
      console.warn("Firestore getLoginTelemetry notice:", e.message);
    }
  }

  const logins = getLocalTelemetryLogins();
  res.json({ status: 'success', logins });
};

const incrementUserUsage = async (userId) => {
  if (db) {
    try {
      const admin = require('firebase-admin');
      const userRef = db.collection('users').doc(userId);
      await userRef.update({
        calls: admin.firestore.FieldValue.increment(1),
        cost: admin.firestore.FieldValue.increment(0.02)
      });
      return;
    } catch (e) {}
  }

  const users = getUsers();
  const user = users.find(u => u.id === userId);
  if (user) {
    user.calls = (user.calls || 0) + 1;
    user.cost = Math.round(((user.cost || 0) + 0.02) * 100) / 100;
    saveUsers(users);
  }
};

module.exports = { loginUser, getAllUsers, getLoginTelemetry, incrementUserUsage, recordTelemetryLogin };

