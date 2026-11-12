/**
 * Fixed prices per billable action, in US cents. Judgement-based placeholders:
 * validate against actual Gemini / Claude / Sandbox invoices. The evaluation
 * price covers the registry lookups it performs.
 */
const PRICES_CENTS = Object.freeze({ evaluate: 50, chat: 5, registryLookup: 2 });
const FREE_GRANT_CENTS = 500;
const PACKS = Object.freeze([
  { id: 'pack_10', cents: 1000, env: 'STRIPE_LINK_10' },
  { id: 'pack_25', cents: 2500, env: 'STRIPE_LINK_25' },
  { id: 'pack_100', cents: 10000, env: 'STRIPE_LINK_100' }
]);

// Payment Link URLs for an account. url is null when the link is not configured.
function packLinks(accountId, email, env = process.env) {
  return PACKS.map(({ id, cents, env: name }) => {
    const base = String(env[name] || '').trim();
    if (!base) return { id, cents, url: null };
    const sep = base.includes('?') ? '&' : '?';
    return { id, cents, url: `${base}${sep}client_reference_id=${accountId}&prefilled_email=${encodeURIComponent(email)}` };
  });
}

module.exports = { PRICES_CENTS, FREE_GRANT_CENTS, PACKS, packLinks };
