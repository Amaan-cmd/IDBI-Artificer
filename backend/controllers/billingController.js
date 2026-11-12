const { getAccountSummary } = require('../billing/ledgerService');
const { PRICES_CENTS, packLinks } = require('../billing/pricing');

async function getBillingAccount(req, res) {
  try {
    const summary = await getAccountSummary(req.session.email);
    return res.json({
      status: 'success',
      ...summary,
      prices: PRICES_CENTS,
      packs: packLinks(summary.accountId, summary.email)
    });
  } catch (err) {
    console.error('[Billing] Account summary failed:', err.message);
    return res.status(503).json({ code: 'BILLING_UNAVAILABLE', error: 'Billing is temporarily unavailable.' });
  }
}

module.exports = { getBillingAccount };
