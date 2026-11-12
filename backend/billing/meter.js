const { charge, refund } = require('./ledgerService');

const NO_CHARGE = Object.freeze({ chargeId: null, priceCents: 0, refund: async () => {} });

/**
 * Charges req.session.email for `action` before the route handler runs.
 * 402 when credit is insufficient, 503 when billing is unreachable (fail
 * closed). Any 4xx/5xx response refunds automatically; handlers that report
 * failure inside a 200 stream (SSE step 99) call req.billing.refund(reason).
 *
 * opts.skip(req)      -> true to run the handler without charging (demo presets)
 * opts.reference(req) -> ledger reference (e.g. the GSTIN)
 */
function withCharge(action, { skip, reference } = {}) {
  return async function meter(req, res, next) {
    if (skip && skip(req)) {
      req.billing = NO_CHARGE;
      return next();
    }

    let result;
    try {
      result = await charge(req.session.email, action, reference ? String(reference(req) || '') : '');
    } catch (err) {
      console.error(`[Billing] Charge failed (${action}):`, err.message);
      return res.status(503).json({ code: 'BILLING_UNAVAILABLE', error: 'Billing is temporarily unavailable. Please retry shortly.' });
    }
    if (!result.ok) {
      return res.status(402).json({
        code: result.code, balanceCents: result.balanceCents, priceCents: result.priceCents, action,
        error: 'Not enough credit for this action. Top up to continue.'
      });
    }

    let refunded = null;
    const doRefund = (reason) => {
      if (!refunded) {
        refunded = refund(req.session.email, result, action, reason).catch((err) => {
          console.error(`[Billing] Refund failed for ${result.chargeId}:`, err.message);
        });
      }
      return refunded;
    };
    req.billing = { chargeId: result.chargeId, priceCents: result.priceCents, balanceCents: result.balanceCents, refund: doRefund };
    res.on('finish', () => {
      if (res.statusCode >= 400) doRefund(`HTTP ${res.statusCode}`);
    });
    return next();
  };
}

module.exports = { withCharge };
