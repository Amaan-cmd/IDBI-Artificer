const { charge, refund, accountIdFor } = require('./ledgerService');
const { PRICES_CENTS } = require('./pricing');

const NO_CHARGE = Object.freeze({ chargeId: null, priceCents: 0, refund: async () => {} });

/**
 * Charges req.session.email for `action` before the route handler runs.
 * 401 without a session email, 402 when credit is insufficient, 503 when
 * billing is unreachable (fail closed). Any 4xx/5xx response refunds
 * automatically; handlers that report failure inside a 200 stream (SSE step
 * 99) call req.billing.refund(reason).
 *
 * opts.skip(req)      -> true to run the handler without charging (demo presets)
 * opts.reference(req) -> ledger reference (e.g. the GSTIN)
 */
function withCharge(action, { skip, reference } = {}) {
  if (!Object.prototype.hasOwnProperty.call(PRICES_CENTS, action)) {
    throw new Error('Unknown billable action: ' + action);
  }
  return async function meter(req, res, next) {
    if (skip && skip(req)) {
      req.billing = NO_CHARGE;
      return next();
    }

    const email = req.session?.email;
    if (!email) {
      return res.status(401).json({ code: 'SESSION_REQUIRED', error: 'Sign in required.' });
    }

    let result;
    try {
      // Bounded so request-derived text cannot bloat ledger rows.
      result = await charge(email, action, reference ? String(reference(req) ?? '').slice(0, 64) : '');
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

    // A failed refund resets the guard so a later call retries; the ledger
    // refund is idempotent per chargeId, so retries cannot double-refund.
    let refunded = null;
    const doRefund = (reason) => {
      if (!refunded) {
        refunded = refund(email, result, action, reason).catch((err) => {
          console.error(`[Billing] REFUND_LOST chargeId=${result.chargeId} accountId=${accountIdFor(email)} priceCents=${result.priceCents}: ${err.message}`);
          refunded = null;
        });
      }
      return refunded;
    };
    req.billing = { chargeId: result.chargeId, priceCents: result.priceCents, balanceCents: result.balanceCents, refund: doRefund };
    res.on('finish', () => {
      if (res.statusCode >= 400) doRefund(`HTTP ${res.statusCode}`);
    });
    // A client disconnect mid-stream (status 200) is deliberately not refunded:
    // the work was done. SSE handlers must refund failures explicitly via
    // req.billing.refund.
    res.on('close', () => {
      if (!res.writableFinished && res.statusCode >= 400) doRefund(`HTTP ${res.statusCode} (connection closed)`);
    });
    return next();
  };
}

module.exports = { withCharge };
