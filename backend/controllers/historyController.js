const fs = require('fs');
const path = require('path');

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
  
  // Resilient local JSON persistence
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

  const history = getHistoryData();
  history.unshift(newRecord);
  saveHistoryData(history);
  return newRecord;
};

module.exports = { getHistory, addHistoryRecord };
