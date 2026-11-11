# Usage Billing: $5 Free Credit + Stripe Top-ups

**Date:** 2026-11-11
**Status:** Approved design
**Depends on:** Part A (table store, sessions) of `2026-11-11-real-registry-data-design.md`

## Problem

The Account & Billing page (`frontend/src/components/AccountBilling/AccountBillingView.jsx`) and sidebar (`AuditorSidebar.jsx` ≈ lines 93–104) show hardcoded quota figures ("842 / 1,000"). The backend's `incrementUserUsage` (`userController.js` ≈ 401) adds a flat $0.02 per evaluation to `users.json`, which is container-local and lost on redeploy; chat is unmetered; and callers identify themselves via an unverified `req.body.userId`.

Goal: each verified email receives $5.00 of credit once; paid actions draw it down at fixed prices; users top up with Stripe Payment Links; balances persist and cannot be double-spent or bypassed.

## Decisions

- Fixed price per action (not token-metered).
- Prepaid credit packs, never expire. No subscriptions.
- $5 free grant once per verified email (no free-mail domain blocking).
- Storage: Azure Table Storage via the shared `tableStore`.
- Stripe Payment Links (created by the owner later); the app supplies `client_reference_id` and handles the webhook.

## Data model

Account identity: `accountId = 'acct_' + sha256(lowercase(email)).hex.slice(0, 32)` — deterministic (no email index needed) and valid for Stripe `client_reference_id` (alphanumeric/underscore only).

`accounts` (pk `'acct'`, rk `accountId`):
`email`, `balanceCents` (int), `freeGrantCents` (500), `freeGrantedAt`, `createdAt`, `lifetimePurchasedCents`, `lifetimeSpentCents`.

`ledger` (pk `accountId`, rk = `(9999999999999 - Date.now())` zero-padded + `_` + 6 random hex, giving newest-first listing):
`type` (`grant` | `charge` | `refund` | `purchase`), `amountCents` (signed: grants/purchases/refunds positive, charges negative), `balanceAfterCents`, `action` (e.g. `evaluate`), `reference` (charge id, Stripe session id, GSTIN), `createdAt`.

`stripeevents` (pk `'checkout'`, rk = Stripe Checkout Session id): `accountId`, `amountCents`, `processedAt`. Created with `createEntity`; a conflict means already processed.

## Components

### `backend/billing/pricing.js`

```js
PRICES_CENTS = { evaluate: 50, chat: 5, registryLookup: 2 }
FREE_GRANT_CENTS = 500
PACKS = [ { id: 'pack_10', cents: 1000, env: 'STRIPE_LINK_10' },
          { id: 'pack_25', cents: 2500, env: 'STRIPE_LINK_25' },
          { id: 'pack_100', cents: 10000, env: 'STRIPE_LINK_100' } ]
```

Prices are judgement-based placeholders; owner should validate against actual Gemini/Claude/Sandbox invoices. The evaluation price covers the registry lookups it performs.

### `backend/billing/ledgerService.js`

- `ensureAccount(email)` → creates the account with `balanceCents: 500` plus a `grant` ledger row if it does not exist (`createEntity`; conflict → read existing). Called at session issue time.
- `charge(email, action, reference)` → `{ ok: true, chargeId, balanceCents }` or `{ ok: false, code: 'INSUFFICIENT_CREDIT', balanceCents, priceCents }`.
  - Admin bypass: if email ∈ `ADMIN_EMAILS` (comma-separated env), record a `charge` row with `amountCents: 0` and `reference` noting admin, never block.
  - Read account (ETag) → if `balanceCents < price` → insufficient → else `updateEntity` with new balance and ETag. On `ConflictError`, re-read and retry, max 5 attempts, then throw.
  - Then append the ledger row. The balance is the source of truth; a failed ledger append is logged as an error but does not reverse the charge.
- `refund(email, chargeId, reason)` → adds the price back (same ETag loop) and appends a `refund` row referencing `chargeId`. Idempotent per `chargeId` within the request (callers refund at most once).
- `credit(accountId, cents, stripeSessionId)` → creates `stripeevents` row first (conflict → return `{ duplicate: true }`), then ETag-loop add to balance and `lifetimePurchasedCents`, then a `purchase` ledger row.
- `getAccountSummary(email, { ledgerLimit = 20 })`.

### `backend/billing/meter.js` (route helper)

`withCharge(action, handler)`: wraps a route. Charges before invoking the handler using `req.session.email`; on `INSUFFICIENT_CREDIT` returns `402 { code, balanceCents, priceCents, action }` before any work. Exposes `req.billing = { chargeId, refund(reason) }` so handlers refund on failure.

- `/api/v1/evaluate`: wrapped with `evaluate`. Refund when the pipeline streams an error (`step: 99`, JEV rejection, extraction failure) or throws. Not refunded on successful completion including `REGISTRY_SCREENING` results.
- `/api/v1/chat/xai`: wrapped with `chat`. Refund on error responses.
- `/api/v1/registry/gstin/:gstin`: wrapped with `registryLookup`. Refund when every section of the report came from cache (`cached: true`) or the GSTIN is invalid.
- Demo presets (demo mode) are not charged.

### `backend/billing/stripeWebhook.js`

- Route `POST /api/v1/billing/stripe-webhook`, registered **before** `express.json()` with `express.raw({ type: 'application/json' })`; exempt from the `/api/` rate limiter and session middleware.
- Verify with `stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)`; failure → 400.
- Handle `checkout.session.completed` (when `payment_status === 'paid'`) and `checkout.session.async_payment_succeeded`. Require `client_reference_id` matching `^acct_[0-9a-f]{32}$` and `currency === 'usd'`; credit `amount_total` cents. Missing/invalid → log and return 200 (so Stripe does not retry forever) without crediting.
- Duplicate events → 200 no-op.
- `stripe` npm package used only for signature verification; no Stripe API calls are made, so no secret key is required.

### Routes (`backend/routes/billing.js`)

- `GET /api/v1/billing/account` (session) → `{ accountId, email, balanceCents, freeGrantCents, prices, packs: [{ id, cents, url | null }], ledger: [...] }`. Pack `url` = configured Payment Link + `?client_reference_id=${accountId}&prefilled_email=${encodeURIComponent(email)}`; `null` when the env var is unset.

### Admin usage stats

`incrementUserUsage(userId)` gains a `costDollars` argument and is called with the charged price so the MasterDashboard `cost` column reflects real charges. (Persistence of `users.json` itself is out of scope.)

## Frontend

- `frontend/src/hooks/useBillingAccount.js`: fetches `/billing/account` via `apiFetch`; exposes `account`, `refresh()`. Refreshed after each evaluation/chat/probe and on window focus (to pick up Stripe top-ups).
- `AccountBillingView.jsx` quota card:
  - Big number `$3.50` with "credit remaining"; progress bar = balance / max(5.00, lifetime credited); subline "Includes $5.00 free credit" until the free grant is fully used.
  - Price list (Evaluation $0.50, Orc message $0.05, Registry lookup $0.02).
  - Buy buttons $10 / $25 / $100 → open the pack URL in a new tab; disabled with "Coming soon" when `url` is null.
  - Recent usage table from `ledger` (date, action, reference, amount, balance after).
  - Remove the hardcoded "842 / 1,000", "158 Runs" and renewal date. Seats, API keys and audit log are unchanged.
- `AuditorSidebar.jsx` quota card: shows live balance ("$3.50 credit") instead of "842 / 1,000".
- `OutOfCreditModal` component: shown on any 402 from `apiFetch`; states the action's price and current balance, offers the pack buttons and a link to the billing page.
- Buttons for paid actions show their price (e.g. "Run evaluation · $0.50").

## Error handling

- Table store unreachable during `charge` → 503 `{ code: 'BILLING_UNAVAILABLE' }`; the action does not run (fail closed).
- Webhook processing error after signature verification → 500 so Stripe retries; idempotency makes retries safe.
- Balance can never go below zero (checked inside the ETag loop).

## Testing

`node:test`, using the file-backed table store in a temp directory:
- `ensureAccount` grants $5 exactly once, including two concurrent calls.
- `charge` deducts and writes a ledger row; insufficient balance returns `INSUFFICIENT_CREDIT` without deducting; 20 concurrent $0.50 charges on a $5.00 balance → exactly 10 succeed, final balance 0.
- `refund` restores the balance and writes a `refund` row.
- Admin emails are never blocked and are charged $0.
- Webhook: valid signature credits once; replayed event is a no-op; bad signature → 400; non-USD or missing `client_reference_id` → 200 without credit. Signatures generated with `stripe.webhooks.generateTestHeaderString`.
- `withCharge`: 402 before the handler runs; refund called on handler failure.

## Configuration

`ADMIN_EMAILS`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_LINK_10`, `STRIPE_LINK_25`, `STRIPE_LINK_100` — added to `backend/.env.example` and `.env.azure.example` with placeholder values.

## Owner setup (after implementation)

1. In Stripe, create three Payment Links (USD $10, $25, $100) and set each link's success URL to `https://<app>/#billing`.
2. Add a webhook endpoint `https://<app>/api/v1/billing/stripe-webhook` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`; copy its signing secret to `STRIPE_WEBHOOK_SECRET`.
3. Put the three link URLs in `STRIPE_LINK_*`.

## Out of scope

Subscriptions, invoices/GST invoicing for purchases, refunds of purchases through the app, organisation-shared balances, free-mail domain blocking.
