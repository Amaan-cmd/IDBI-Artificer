# Real Registry Data for Fetcha (+ Shared Platform Foundation)

**Date:** 2026-11-11
**Status:** Approved design
**Companion spec:** `2026-11-11-usage-billing-design.md` (depends on Part A of this document)

## Problem

Fetcha presents fabricated data as live statutory intelligence:

- `backend/services/scraperService.js` scrapes DuckDuckGo results, then derives CIN, turnover, litigation and risk flag from a hash of the GSTIN string (`hashGstin`, lines ~296–395). `generateGSTTimeline` (~396) fabricates monthly sales, balances, OD limit, EMIs and bounces the same way.
- `backend/agents/ingestionAgent.js` Route C (lines 199–260) turns that fabricated timeline into a complete bank-statement payload and scores it.
- `backend/controllers/creditController.js` fallback (lines 162–227) substitutes a hardcoded ₹96.8L revenue when ingestion fails and still emits a score.
- `frontend/src/utils/gstinRegistry.js` `getGSTINProbeData` repeats the hash fabrication client-side and is used by `App.jsx`, `NewEvaluationView.jsx`, `CommandPalette.jsx` and `orcIntelligence.js`.
- Default GSTINs (`27AADCB2230M1Z2`, `27AAHCE5539J1ZA`) are injected when none is supplied.

Goal: every registry fact shown or scored is either fetched from a real source with provenance, or explicitly marked unavailable. Nothing is invented outside an explicitly labelled demo mode.

## Part A — Shared Platform Foundation

Needed by this spec (registry cache) and the billing spec (ledger, sessions).

### A1. Table store (`backend/platform/tableStore.js`)

- Uses `@azure/data-tables` with the existing `AZURE_STORAGE_CONNECTION_STRING`.
- Interface: `getEntity(table, pk, rk)`, `upsertEntity(table, entity)`, `updateEntity(table, entity, etag)` (throws `ConflictError` on ETag mismatch), `createEntity(table, entity)` (throws `ConflictError` if it exists), `listEntities(table, pk, {limit})`.
- Tables created on startup if missing: `accounts`, `ledger`, `stripeevents`, `registrycache`.
- When no connection string is set: a file-backed implementation under `backend/data/local-store/` (gitignored) with the same interface and ETag semantics, logging a one-time warning. If `NODE_ENV=production` and no connection string, the server refuses to start.

### A2. Server-verified sessions (`backend/platform/session.js`, `backend/middleware/requireSession.js`)

- Signed JWT (HS256, `jsonwebtoken`), secret `SESSION_JWT_SECRET` (required in production), 12-hour expiry. Claims: `sub` (normalised lowercase email), `uid` (existing user id), `name`, `role`, `provider`.
- Issued only by paths the server itself verifies:
  - `POST /api/v1/users/login` (password) — on success.
  - `POST /api/v1/auth/verify-code` (email OTP) — on success.
  - New `POST /api/v1/auth/session` — body `{ idToken }`; verifies a Firebase ID token with `jose` against Google's securetoken JWKS (`iss = https://securetoken.google.com/${FIREBASE_PROJECT_ID}`, `aud = FIREBASE_PROJECT_ID`, unexpired, `email_verified = true`).
- Login responses add `sessionToken`. Frontend stores it alongside `enverai_user_session` and sends `Authorization: Bearer <token>` via a small `apiFetch` helper (`frontend/src/utils/apiClient.js`).
- `requireSession` middleware: verifies the token, sets `req.session = { email, uid, name, role }`, else `401 { code: 'SESSION_REQUIRED' }`. The frontend treats 401 by returning to the login gate.
- Protected routes: `/api/v1/evaluate`, `/api/v1/chat/xai`, `/api/v1/registry/*`, `/api/v1/history`, `/api/v1/billing/*` (except the Stripe webhook). Controllers read identity from `req.session`, never from `req.body.userId`/`userEmail`. Every frontend caller of these routes (`App.jsx`, `OrcTerminal.jsx`, `MasterDashboard.jsx`) switches from `fetch` to `apiFetch`.
- The client-side `fallbackAdmin` logins in `VerificationGate.jsx` (≈ lines 329, 359) and the Azure SWA `/.auth/me` path obtain no token, so they cannot use protected routes. They remain only to show the UI shell; protected calls from them get 401 → login gate. SWA/Entra users sign in via email OTP to get a session (known limitation, acceptable for now).

## Part B — Registry Data

### B1. Sandbox client (`backend/services/registry/sandboxClient.js`)

- Base URL `https://api.sandbox.co.in` (override `SANDBOX_BASE_URL`, e.g. `https://test-api.sandbox.co.in`). Credentials `SANDBOX_API_KEY`, `SANDBOX_API_SECRET`.
- `POST /authenticate` with `x-api-key`, `x-api-secret`; token from `data.access_token`; cached in memory for 23h; one re-auth retry on 401/403.
- Every call sends `authorization: <token>` (no Bearer), `x-api-key`, `x-api-version: 1.0.0`, `Content-Type: application/json`, `x-accept-cache: true`.
- 10s timeout; one retry on network error or 5xx.
- Normalises errors: HTTP 200 with `data.status_cd === "0"` is a provider error carrying `data.error.error_cd|error_code` and `message`. Returns `{ ok: true, body, transactionId }` or `{ ok: false, kind: 'not_found'|'invalid_input'|'provider_error'|'unavailable', code, message, transactionId }`.

### B2. Providers

All provider results share one envelope:

```js
{ status: 'ok', data, source: 'GSTN via Sandbox', fetchedAt: ISO, transactionId }
{ status: 'unavailable', reason, source }        // provider down / not covered / not found
{ status: 'ambiguous', candidates: [...], source } // MCA name match only
```

`backend/services/registry/gstProvider.js`
- `searchGstin(gstin)` → `POST /gst/compliance/public/gstin/search` `{ gstin }`. Maps: `lgnm`→`legalName`, `tradeNam`→`tradeName`, `sts`→`status`, `rgdt`→`registrationDate`, `cxdt`→`cancellationDate`, `ctb`→`constitution`, `dty`→`taxpayerType`, `nba`→`natureOfBusiness`, `pradr.addr`→`principalAddress` (formatted), `einvoiceStatus`, `lstupdt`→`lastUpdated`. `FO8000` → `unavailable` reason "GSTIN not found on GST portal".
- `trackReturns(gstin, financialYear)` → `POST /gst/compliance/public/gstrs/track?financial_year=FY YYYY-YY` `{ gstin }`. Returns `EFiledlist` entries mapped to `{ returnType, period: 'YYYY-MM', filedOn: 'YYYY-MM-DD', arn, mode, status, valid }`. `RET13510` → `ok` with an empty list (no filings is a fact, not an outage).

`backend/services/registry/mcaProvider.js`
- `getCompany(cin)` → `POST /kyc/mca/company/master-data` `{ cin }` (validate `^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$` first). Maps `company_name`, `company_status`, `company_registration_date`, `authorized_capital`, `paidup_capital`, `company_class`, `company_category`, `company_roc_code`, `nic_code`, `company_industrial_classification`, `registered_office_address`, `listing_status`. Accepts `data` as object or single-element array. Code 521 → `unavailable` "Company not found on MCA21".
- `findCompanyByName(legalName)` → Sandbox Search Company (`GET`, `company_name`, `limit=10`). Normalise names (uppercase, strip punctuation, collapse whitespace, unify `PVT`/`PRIVATE`, `LTD`/`LIMITED`). Exactly one exact normalised match → that CIN. Otherwise `ambiguous` with up to 10 candidates `{ cin, name }`, or `unavailable` if zero.
- Directors, charges and litigation: always `{ status: 'unavailable', reason: 'Not covered by current data provider' }`.

### B3. Registry service (`backend/services/registry/registryService.js`)

`getRegistryReport(gstin, { cin } = {})`:
1. Validate GSTIN format (existing regex). Invalid → 400 at the route.
2. Cache lookup in `registrycache` (pk = GSTIN, rk = section). TTL: GST registration 7 days, filings 24 hours, MCA 7 days. Cache stores the full envelope including `fetchedAt` and `transactionId`; a cached response is marked `cached: true`.
3. GST registration via `searchGstin`.
4. Filings via `trackReturns` for the current and previous financial year (2 calls), merged.
5. MCA only when the GST `constitution` indicates a company or LLP (Private Limited, Public Limited, LLP, etc.). If `cin` given → `getCompany(cin)`; else `findCompanyByName(legalName)` then `getCompany` on a unique match. Proprietorships/partnerships → MCA section `unavailable` "Not an MCA-registered entity type".
6. Compute `filingMetrics` (B4).
7. Return `{ gstin, pan: gstin.slice(2,12), gst, filings, filingMetrics, mca, directors, charges, litigation, generatedAt }`.

Sections fail independently; a provider outage yields `unavailable` for that section, never a fabricated value.

### B4. Filing metrics (`backend/services/registry/filingMetrics.js`, pure function)

Input: filing list + registration date + taxpayer type + "as of" date. Window: last 12 completed tax periods (not before registration date).

- Frequency detection per return type: if GSTR-3B periods are only quarter-end months → quarterly (QRMP), else monthly.
- Due dates: GSTR-1 monthly 11th of next month, quarterly 13th after quarter; GSTR-3B monthly 20th, quarterly 24th; CMP-08 18th after quarter (composition dealers).
- Outputs for GSTR-3B (or CMP-08 for composition) and GSTR-1: `expectedPeriods`, `filedPeriods`, `missingPeriods` (list), `lateFilings` (count), `averageDaysLate` (over late filings), `lastFiledPeriod`.
- Overall `filingDiscipline`: `REGULAR` (0 missing, avg late ≤ 5 days), `IRREGULAR` (1–2 missing or avg late > 5), `DELINQUENT` (≥ 3 missing in window), `UNKNOWN` (filings unavailable).

### B5. Score adjustments (`backend/services/registry/registryAdjustments.js`, pure function)

`applyRegistryAdjustments(decision, registryReport)` runs in `creditController` after `synthesizeScore`, on both the LLM and deterministic paths, so the adjustment does not depend on the LLM following prompt instructions.

| Condition | Effect |
|---|---|
| GST status Cancelled or Suspended | Score capped at 479, risk HIGH, red flag "GST registration {status} since {date}" |
| MCA status Strike Off / Dormant / Under Liquidation / any non-Active | −150 |
| `filingDiscipline` DELINQUENT | −60 |
| `filingDiscipline` IRREGULAR | −20 |
| `filingDiscipline` REGULAR | +15 |
| Section unavailable / UNKNOWN | 0, and adds "Not verified: {section}" to the decision's caveats |

Score is re-clamped to the existing 320–885 range and the risk level recomputed with the existing thresholds (≥750 LOW, ≥620 MEDIUM, else HIGH). Each applied adjustment is appended to `decision.registryAdjustments` as `{ label, points, citation }`.

### B6. Pipeline changes

- **Routes:** add `GET /api/v1/registry/gstin/:gstin?cin=` (session required) returning the registry report. Replace `/api/v1/alternate-data/gstin-probe/:gstin` with a thin alias to the same handler. Remove `/api/v1/alternate-data/gst/:gstin` (fabricated timeline). Keep `/api/v1/alternate-data/account-aggregator/:businessId` only when `DEMO_MODE=true`.
- **ingestionAgent:**
  - Route A (file): replace `scrapeBusinessIntelligence` with `getRegistryReport(resolvedGstin)`; pass the report to the LLM prompt as verified context; attach as `registryReport` (renamed from `scrapedRegistryData`, keeping the old key as an alias for one release).
  - Route C (GSTIN only): no longer builds financials. Returns `{ reportType: 'REGISTRY_SCREENING', gstin, registryReport }`.
  - Remove default GSTIN substitutions; unknown GSTIN stays `null`.
- **creditController:**
  - GSTIN-only: skip JEV/Geek/Orc scoring, stream step 4 with `{ status: 'success', reportType: 'REGISTRY_SCREENING', gstin, businessName: gst.legalName, registryReport }`. Saved to history with `score: null`.
  - File/manual: run the existing pipeline, then `applyRegistryAdjustments`. Payload includes `registryReport`.
  - Fallback path: if heuristic extraction from the file fails, stream an error (`step: 99`, "Could not extract financials from the uploaded statement") instead of the hardcoded ₹96.8L object. Remove `'27AADCB2230M1Z2'` / `'27AAHCE5539J1ZA'` defaults.
- **grokClient.js:** the `scrapeBusinessIntelligence` tool calls `getRegistryReport`.
- **scraperService.js:** delete `lookupGSTINOnline`, `hashGstin`, `scrapeBusinessIntelligence`, `generateGSTTimeline`. `KNOWN_GSTINS` moves to `backend/demo/demoEntities.js`.

### B7. Provenance

Every section carries `source`, `fetchedAt`, `transactionId`, `cached`. The Orc citations list gains entries such as `GSTN via Sandbox · fetched 2026-11-11 14:02 IST · txn 5248feb5`. The Raw JSON tab shows the full `registryReport`.

### B8. Demo mode

- `DEMO_MODE=true` (backend) / `VITE_DEMO_MODE=true` (frontend). Default false.
- In demo mode only: preset entities (`KNOWN_GSTINS`, `PRELOADED_SCENARIOS`, the hardcoded history entries in `App.jsx` ≈ lines 290–346, the AA sample endpoint) are available, and every surface showing them carries a visible **SAMPLE DATA** badge. Registry lookups for preset GSTINs return the preset with `source: 'Sample data (demo mode)'`.
- Outside demo mode: presets are hidden; any GSTIN goes to the real registry service.

### B9. Frontend

- `gstinRegistry.js`: delete the hash generator; `getGSTINProbeData` returns demo presets only in demo mode, else `null`. Keep `STATE_CODE_MAP` / `ENTITY_TYPE_MAP` (pure lookups from the GSTIN format, which are real).
- `App.jsx` `probeGSTIN`: only fires for a full, valid 15-character GSTIN, debounced 600 ms; calls the registry route through `apiFetch`; no local fabricated pre-fill.
- Probe card (`NewEvaluationView.jsx`) shows: legal/trade name, GST status + registration date, constitution, taxpayer type, filing discipline badge with missing/late counts, MCA status/incorporation/capital (or "Not an MCA entity" / "Not available" / candidate picker when ambiguous), and provenance lines. No financial figures.
- New `RegistryScreeningReport` component renders a `REGISTRY_SCREENING` result: same content as the probe card plus the filing table (period, return, filed on, days late, ARN) and a prompt "Upload a bank statement for a full credit score".
- Ambiguous MCA match: candidate list; selecting one re-requests with `?cin=`.
- `orcIntelligence.js`: uses the evaluation payload (including `registryReport` and `registryAdjustments`) instead of `KNOWN_GSTINS` for non-demo entities; presets only in demo mode.
- `CommandPalette.jsx`: preset entries only in demo mode.

## Error handling

- Sandbox outage → sections `unavailable`; evaluation still runs on the uploaded statement; caveats list what wasn't verified.
- Invalid GSTIN → 400 before any provider call.
- Sandbox auth failure → logged once with the HTTP status (never the key), sections `unavailable`.
- No secrets in logs or responses; `transactionId` is safe to show.

## Testing

`node:test` (`backend/tests/*.test.js`, run via `npm --prefix backend test`; the backend `test` script is currently a placeholder and becomes `node --test tests/`):
- `sandboxClient`: token caching/refresh, `status_cd: "0"` mapping, timeout/retry — using a stubbed `fetch`.
- `gstProvider` / `mcaProvider`: mapping from recorded fixture responses (from the Sandbox docs examples) in `backend/tests/fixtures/sandbox/`, including not-found codes, array-vs-object `data`, ambiguous name match.
- `filingMetrics`: monthly vs quarterly detection, late/missing computation, registration-date window, composition dealer.
- `registryAdjustments`: each table row, clamping, risk recomputation.
- `registryService`: section independence when one provider fails; cache hit marks `cached: true` and makes no provider call.
- `tableStore` (file implementation): ETag conflict behaviour.
- `requireSession`: missing/invalid/expired token → 401; valid token sets `req.session`.
- After implementation: one live call per Sandbox endpoint against a public GSTIN/CIN (Quicko Infosoft, CIN `U72900GJ2015PTC082637`) to confirm the integration; results not committed.

## Out of scope

Directors, charges and litigation data (needs a second provider); consented GST return contents (GSP) and Account Aggregator bank data; Entra ID server-side verification.
