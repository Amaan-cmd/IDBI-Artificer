/**
 * Stripe webhook for Payment Link top-ups. The stripe package is used only to
 * verify signatures; no Stripe API calls are made, so no secret key is needed.
 */
const Stripe = require('stripe');
const { credit, AccountNotFoundError } = require('./ledgerService');

const ACCOUNT_RE = /^acct_[0-9a-f]{32}$/;
const stripe = new Stripe('sk_unused_signature_verification_only');

function buildStripeWebhook({ secret = () => process.env.STRIPE_WEBHOOK_SECRET, creditFn = credit } = {}) {
  return async function stripeWebhook(req, res) {
    const whSecret = String(secret() || '').trim();
    if (!whSecret) {
      console.error('[Billing] STRIPE_WEBHOOK_SECRET is not set; rejecting webhook.');
      return res.status(503).json({ error: 'Webhook not configured.' });
    }

    if (req.body === undefined) {
      // No body, or a content type express.raw did not accept.
      return res.status(400).json({ error: 'Invalid payload.' });
    }
    if (!Buffer.isBuffer(req.body)) {
      console.error('[Billing] Stripe webhook received a parsed body; it must be mounted with express.raw before express.json');
      return res.status(500).json({ error: 'Webhook misconfigured.' });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], whSecret);
    } catch (err) {
      console.warn('[Billing] Stripe signature rejected:', err.message);
      return res.status(400).json({ error: 'Invalid signature.' });
    }

    if (event.type !== 'checkout.session.completed' && event.type !== 'checkout.session.async_payment_succeeded') {
      return res.json({ received: true });
    }

    const s = event.data?.object || {};
    if (s.payment_status !== 'paid') {
      // Normal for delayed payment methods; async_payment_succeeded follows.
      console.info(`[Billing] Stripe session ${s.id} not credited yet: not paid.`);
      return res.json({ received: true, credited: false });
    }
    const problem =
      (s.mode !== 'payment' && `mode ${s.mode}`) ||
      (!ACCOUNT_RE.test(s.client_reference_id || '') && 'missing or invalid client_reference_id') ||
      (s.currency !== 'usd' && `currency ${s.currency}`) ||
      ((!Number.isInteger(s.amount_total) || s.amount_total <= 0) && 'no amount_total');
    if (problem) {
      // 200 so Stripe does not retry an event we will never credit.
      console.error(`[Billing] Stripe session ${s.id} not credited: ${problem}.`);
      return res.json({ received: true, credited: false });
    }

    try {
      const r = await creditFn(s.client_reference_id, s.amount_total, s.id);
      return res.json({ received: true, credited: !r.duplicate, duplicate: Boolean(r.duplicate) });
    } catch (err) {
      if (err instanceof AccountNotFoundError) {
        // 200 so Stripe does not retry; needs manual follow-up.
        console.error(`[Billing] Stripe session ${s.id} not credited: no billing account ${s.client_reference_id}. Manual follow-up required.`);
        return res.json({ received: true, credited: false });
      }
      console.error(`[Billing] Crediting Stripe session ${s.id} failed:`, err.message);
      return res.status(500).json({ error: 'Webhook processing failed.' });
    }
  };
}

module.exports = { buildStripeWebhook, stripeWebhook: buildStripeWebhook() };
