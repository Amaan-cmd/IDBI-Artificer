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
  fs.writeFileSync(historyFilePath, JSON.stringify(history, null, 2), 'utf8');
};

const getHistory = (req, res) => {
  const userId = req.query.userId;
  let history = getHistoryData();
  
  if (userId) {
    history = history.filter(h => h.userId === userId);
  }
  
  // Sort descending by timestamp
  history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  res.json({ status: 'success', history });
};

const addHistoryRecord = (record) => {
  const history = getHistoryData();
  const newRecord = {
    id: `h_${Date.now()}`,
    timestamp: new Date().toISOString(),
    ...record
  };
  history.unshift(newRecord);
  saveHistoryData(history);
  return newRecord;
};

module.exports = { getHistory, addHistoryRecord };
