const { getRegistryReport } = require('../services/registry/registryService');
const { isDemoMode } = require('../platform/demoMode');
const { demoRegistryReport } = require('../demo/demoEntities');

const { GSTIN_RE } = require('../utils/gstin');

async function getRegistry(req, res) {
  const gstin = String(req.params.gstin || '').trim().toUpperCase();
  if (!GSTIN_RE.test(gstin)) {
    return res.status(400).json({ code: 'INVALID_GSTIN', error: 'Enter a valid 15-character GSTIN.' });
  }
  if (isDemoMode()) {
    const sample = demoRegistryReport(gstin);
    if (sample) return res.json({ status: 'success', registryReport: sample });
  }
  try {
    const cin = typeof req.query.cin === 'string' && req.query.cin.trim() ? req.query.cin.trim().toUpperCase() : null;
    const registryReport = await getRegistryReport(gstin, { cin });
    return res.json({ status: 'success', registryReport });
  } catch (err) {
    console.error('[Registry] Report failed:', err.message);
    return res.status(503).json({ code: 'REGISTRY_UNAVAILABLE', error: 'Registry lookup is temporarily unavailable.' });
  }
}

module.exports = { getRegistry, GSTIN_RE };
