const admin = require('firebase-admin');

let db = null;
try {
  // Only attempt Firestore initialization if credentials or Cloud environment is explicitly configured
  if (process.env.FIREBASE_CONFIG || process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.ENABLE_FIRESTORE === 'true') {
    admin.initializeApp();
    db = admin.firestore();
    console.log('[Backend] Firestore initialized successfully.');
  } else {
    console.log('[Backend] Firestore not forced in local dev. Using resilient local JSON storage.');
  }
} catch (e) {
  console.warn('[Backend] Firebase Admin initialization notice. Defaulting to local JSON storage.');
}

module.exports = { admin, db };
