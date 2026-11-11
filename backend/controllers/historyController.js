const fs = require('fs');
const path = require('path');
const { azureStorage } = require('../utils/azureStorage');
const { isAdminEmail } = require('../platform/admin');

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
  const email = req.session.email;
  let history = getHistoryData();
  if (!isAdminEmail(email)) {
    history = history.filter(h => String(h.userEmail || '').toLowerCase() === email);
  }
  history.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  res.json({ status: 'success', history });
};

const addHistoryRecord = async (record) => {
  const newRecord = {
    id: record.id || `h_${Date.now()}`,
    timestamp: record.timestamp || new Date().toISOString(),
    ...record
  };

  const history = getHistoryData();
  history.unshift(newRecord);
  if (history.length > 500) history.length = 500;
  saveHistoryData(history);

  // Sync to Azure Blob Storage if configured in Azure Container Apps
  try {
    await azureStorage.saveAuditPayload(newRecord.id, newRecord);
  } catch (err) {
    console.warn('[Azure Storage] History sync warning:', err.message);
  }

  return newRecord;
};

module.exports = { getHistory, addHistoryRecord };
