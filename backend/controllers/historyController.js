const fs = require('fs');
const path = require('path');
const { db } = require('../utils/firebaseAdmin');

const historyFilePath = path.join(__dirname, '../data/history.json');

const getHistoryData = () => {
  try {
    const data = fs.readFileSync(historyFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
};

const saveHistoryData = (history) => {
  try {
    fs.writeFileSync(historyFilePath, JSON.stringify(history, null, 2), 'utf8');
  } catch(e) {
    console.warn("Failed to save local history.json");
  }
};

const getHistory = async (req, res) => {
  const userId = req.query.userId;
  
  if (db) {
    try {
      let query = db.collection('history');
      if (userId) {
        query = query.where('userId', '==', userId);
      }
      const snapshot = await query.orderBy('timestamp', 'desc').get();
      const history = snapshot.docs.map(doc => doc.data());
      return res.json({ status: 'success', history });
    } catch (e) {
      console.error("Firestore getHistory failed:", e);
    }
  }

  // Fallback to local JSON persistence
  let history = getHistoryData();
  if (userId && userId !== 'u_andalaus_master') {
    history = history.filter(h => h.userId === userId || !h.userId);
  }
  history.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  res.json({ status: 'success', history });
};

const addHistoryRecord = async (record) => {
  const newRecord = {
    id: `h_${Date.now()}`,
    timestamp: new Date().toISOString(),
    ...record
  };

  if (db) {
    try {
      await db.collection('history').doc(newRecord.id).set(newRecord);
      return newRecord;
    } catch (e) {
      console.error("Firestore addHistoryRecord failed:", e);
    }
  }

  // Fallback
  const history = getHistoryData();
  history.unshift(newRecord);
  saveHistoryData(history);
  return newRecord;
};

module.exports = { getHistory, addHistoryRecord };
