const { getRegistryReport } = require('../services/registry/registryService');
const { isDemoMode } = require('../platform/demoMode');
const { demoRegistryReport } = require('../demo/demoEntities');

const { GSTIN_RE, isAcceptedGstin } = require('../utils/gstin');

const paramGstin = (req) => String(req.params.gstin || '').trim().toUpperCase();

function gstinError(gstin) {
  if (!GSTIN_RE.test(gstin)) return 'Enter a valid 15-character GSTIN.';
  if (!isAcceptedGstin(gstin)) return 'Enter a valid 15-character GSTIN (check digit mismatch).';
  return null;
}

// Runs before billing so malformed GSTINs are never charged.
function requireValidGstin(req, res, next) {
  const error = gstinError(paramGstin(req));
  if (error) return res.status(400).json({ code: 'INVALID_GSTIN', error });
  return next();
}

const isDemoRegistryRequest = (req) => isDemoMode() && Boolean(demoRegistryReport(paramGstin(req)));

// Sections served from the registry cache cost us nothing upstream.
const fullyCached = (report) => ['gst', 'filings', 'mca'].every((k) => !report[k] || report[k].cached !== false);

async function getRegistry(req, res) {
  const gstin = paramGstin(req);
  const error = gstinError(gstin);
  if (error) return res.status(400).json({ code: 'INVALID_GSTIN', error });
  if (isDemoMode()) {
    const sample = demoRegistryReport(gstin);
    if (sample) return res.json({ status: 'success', registryReport: sample });
  }
  try {
    const cin = typeof req.query.cin === 'string' && req.query.cin.trim() ? req.query.cin.trim().toUpperCase() : null;
    const registryReport = await getRegistryReport(gstin, { cin });
    if (fullyCached(registryReport)) await req.billing?.refund('cached registry result');
    return res.json({ status: 'success', registryReport });
  } catch (err) {
    console.error('[Registry] Report failed:', err.message);
    return res.status(503).json({ code: 'REGISTRY_UNAVAILABLE', error: 'Registry lookup is temporarily unavailable.' });
  }
}

module.exports = { getRegistry, requireValidGstin, isDemoRegistryRequest, paramGstin, GSTIN_RE };
