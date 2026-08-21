const fs = require('fs');
const path = require('path');
const { db } = require('../utils/firebaseAdmin');
const { sendSlackNotification } = require('../services/slackNotifier');

const usersFilePath = path.join(__dirname, '../data/users.json');

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

const loginUser = async (req, res) => {
  const { username, password, email, authType } = req.body;
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || 'Unknown Device';

  // 1. Google Auth Gate: Strictly @enveraitech.com domain
  if (authType === 'google' || email) {
    const userEmail = (email || username || '').trim().toLowerCase();
    if (!userEmail.endsWith('@enveraitech.com')) {
      console.warn(`[Security Alert] Unauthorized login attempt blocked from email: ${userEmail}`);
      
      // Dispatch Slack security alert
      sendSlackNotification({
        title: "UNAUTHORIZED GOOGLE LOGIN ATTEMPT BLOCKED",
        message: `Attempted access from non-EnverAI email: *${userEmail}*`,
        fields: [
          { title: "Target Email", value: userEmail, short: true },
          { title: "IP Address", value: clientIp, short: true },
          { title: "Status", value: "REJECTED (Access Denied)", short: true }
        ],
        color: '#CC0000'
      });

      return res.status(403).json({ error: 'Access Denied. Only @enveraitech.com verified enterprise accounts are permitted.' });
    }

    const userId = `u_google_${Date.now()}`;
    const userObj = {
      id: userId,
      username: userEmail.split('@')[0],
      email: userEmail,
      calls: 0,
      cost: 0,
      lastLogin: new Date().toISOString()
    };

    // Log to Firestore / local
    if (db) {
      try {
        await db.collection('telemetry_logins').add({
          user: userObj,
          ip: clientIp,
          userAgent,
          type: 'google',
          timestamp: new Date().toISOString()
        });
      } catch (e) {}
    }

    sendSlackNotification({
      title: "Authorized EnverAI Enterprise Login",
      message: `EnverAI Personnel *${userEmail}* logged into Artificer Portal.`,
      fields: [
        { title: "User Email", value: userEmail, short: true },
        { title: "Client IP", value: clientIp, short: true }
      ],
      color: '#3A9A3C'
    });

    return res.json({ status: 'success', user: userObj });
  }

  // 2. Manual Login Brick Wall: ONLY 'Andalaus' / 'Citadel@296'
  const normalizedUsername = (username || '').trim();
  const normalizedPassword = (password || '').trim();

  if (normalizedUsername !== 'Andalaus' || normalizedPassword !== 'Citadel@296') {
    console.warn(`[Security Alert] Manual login brick wall blocked attempt for username: ${normalizedUsername}`);
    
    sendSlackNotification({
      title: "MANUAL AUTHENTICATION FAILED",
      message: `Brick-wall rejected invalid credentials for username: *${normalizedUsername}*`,
      fields: [
        { title: "Provided Username", value: normalizedUsername, short: true },
        { title: "IP Address", value: clientIp, short: true },
        { title: "Action", value: "Connection Blocked", short: true }
      ],
      color: '#CC0000'
    });

    return res.status(401).json({ error: 'Access Denied. Invalid master credentials.' });
  }

  // Authorized master demo user
  const masterUser = {
    id: 'u_andalaus_master',
    username: 'Andalaus',
    email: 'andalaus@enveraitech.com',
    role: 'Master Security Administrator',
    calls: 0,
    cost: 0,
    lastLogin: new Date().toISOString()
  };

  if (db) {
    try {
      await db.collection('telemetry_logins').add({
        user: masterUser,
        ip: clientIp,
        userAgent,
        type: 'manual_master',
        timestamp: new Date().toISOString()
      });
    } catch (e) {}
  }

  sendSlackNotification({
    title: "Master Admin Authenticated (Andalaus)",
    message: `Master Administrator *Andalaus* successfully authenticated into Artificer.`,
    fields: [
      { title: "Account", value: "Andalaus (Master Security)", short: true },
      { title: "IP Address", value: clientIp, short: true }
    ],
    color: '#3A9A3C'
  });

  return res.json({ status: 'success', user: masterUser });
};

const getAllUsers = async (req, res) => {
  if (db) {
    try {
      const snapshot = await db.collection('users').get();
      const users = snapshot.docs.map(doc => doc.data());
      return res.json({ status: 'success', users });
    } catch (e) {
      console.error("Firestore getAllUsers failed:", e);
    }
  }
  
  const users = getUsers();
  res.json({ status: 'success', users });
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
    user.calls += 1;
    user.cost += 0.02;
    saveUsers(users);
  }
};

module.exports = { loginUser, getAllUsers, incrementUserUsage };
