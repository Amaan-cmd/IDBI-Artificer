const { azureStorage } = require('../utils/azureStorage');
const { isAdminEmail } = require('../platform/admin');
const records = require('../platform/entityRecords');

const getHistory = async (req, res) => {
  const email = req.session.email;
  let history;
  try {
    history = await records.listHistory();
  } catch (err) {
    console.error('[History] Read failed:', err.message);
    return res.status(503).json({ error: 'History is temporarily unavailable.' });
  }
  if (!isAdminEmail(email)) {
    history = history.filter(h => String(h.userEmail || '').toLowerCase() === email);
  }
  history.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  res.json({ status: 'success', history });
};

// A failed write is logged, never thrown: the evaluation is still delivered.
const addHistoryRecord = async (record) => {
  const newRecord = {
    id: record.id || `h_${Date.now()}`,
    timestamp: record.timestamp || new Date().toISOString(),
    ...record
  };

  try {
    await records.addHistory(newRecord);
  } catch (err) {
    console.error('[History] Write failed:', err.message);
  }

  // Forensic audit copy in Azure Blob Storage when configured.
  try {
    await azureStorage.saveAuditPayload(newRecord.id, newRecord);
  } catch (err) {
    console.warn('[Azure Storage] History sync warning:', err.message);
  }

  return newRecord;
};

module.exports = { getHistory, addHistoryRecord };
