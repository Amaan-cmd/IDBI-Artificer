# Registry Pre-Screen: Grade Without Financial Statements

**Date:** 2026-11-12
**Status:** Approved design
**Depends on:** registry data (`2026-11-11-real-registry-data-design.md`), usage billing (`2026-11-11-usage-billing-design.md`)

## Problem

A GSTIN-only run returns a registry screening with no score. Lenders want a first-pass signal before the borrower shares financials, but registries contain no revenue, cash or debt data, so a 300–900 credit score cannot be produced honestly.

## Decisions

- Two clearly separated results. A **pre-screen grade** from registry facts is available for every GSTIN. The **full credit score** (300–900, five pillars) is still produced only from real financial data.
- The pre-screen is a grade (A–E) with a verdict, never a 300–900 number.
- The grade is deterministic: there is no LLM in the grading, so the same facts always give the same grade.
- Every factor uses real registry data or is excluded as "Not available". Nothing is imputed.
- The confidence ladder is Registry (this spec) → GST-verified turnover via taxpayer OTP consent (Tier 2, separate spec) → bank data via upload or Account Aggregator (Tier 3, separate spec).

## Model: `backend/services/registry/preScreen.js`

`computePreScreen(report, { asOf = new Date() })` is a pure function. Its input is the registry report from `getRegistryReport` (`gst`, `filings`, `filingMetrics`, `mca`).

### Knockouts

Any knockout sets grade E and verdict DECLINE, regardless of points:
- `gst.status === 'ok'` and `gst.data.status` matches `/cancel|suspend/i`.
- `mca.status === 'ok'` and `mca.data.status` is not `Active` (case-insensitive, trimmed).

### Factors (100 points when all are assessable)

| Key | Label | Source | Points | Assessable when |
|---|---|---|---|---|
| `vintage` | Business age | earlier of `gst.data.registrationDate` and `mca.data.incorporationDate` | under 1 yr: 0 · 1 to under 3: 15 · 3 to under 5: 25 · 5+: 35 (max 35) | at least one valid date |
| `gstr3b` | GSTR-3B filing discipline | `filingMetrics.filingDiscipline` | REGULAR: 30 · IRREGULAR: 15 · DELINQUENT: 0 (max 30) | discipline is not `UNKNOWN` |
| `gstr1` | GSTR-1 completeness | `filingMetrics.gstr1.missingPeriods.length` | 0 missing: 15 · 1–2: 8 · 3+: 0 (max 15) | `filingMetrics.gstr1` present with `expectedPeriods > 0` (not applicable to composition taxpayers) |
| `timeliness` | Filing timeliness | `filingMetrics.primary.averageDaysLate` | ≤ 5 days: 10 · ≤ 15: 5 · more: 0 (max 10) | `primary.expectedPeriods > 0` |
| `mca` | Company standing | `mca.data.status` | Active: 10 (max 10) | `mca.status === 'ok'`. If `mca.reason` is the not-an-MCA-entity reason (proprietorships, partnerships), the factor is **not applicable** and is excluded. |

When a factor is not assessable, its label is listed in `notAssessed` with the reason (for example "GST filing history: Not available") and its max is excluded from `maxPoints`.

### Grade

- `percent = round(100 × points / maxPoints)`. If `maxPoints === 0`, the grade is `null` with verdict `INSUFFICIENT_DATA`.
- Grade bands: A ≥ 85, B 70–84, C 55–69, D 40–54, E < 40.
- Verdict: A and B give PROCEED. C and D give REQUEST_DOCUMENTS. E gives DECLINE.
- Coverage is `maxPoints / 100` (proprietorships: `maxPoints / 90`, because MCA does not apply). If coverage is below 0.6, a grade better than C is lowered to C, and the caveat "Limited registry coverage" is added.
- Knockouts override everything else.

### Output

```js
{
  grade: 'A'|'B'|'C'|'D'|'E'|null,
  verdict: 'PROCEED'|'REQUEST_DOCUMENTS'|'DECLINE'|'INSUFFICIENT_DATA',
  percent, points, maxPoints, coverage,
  factors: [{ key, label, detail, points, max, citation }], // assessable factors only
  knockouts: [{ label, citation }],
  notAssessed: [{ label, reason }],
  caveats: [string],
  financialsNotAssessed: ['Revenue', 'Cash buffer', 'Debt service'],
  unlocks: ['GST consent → verified turnover', 'Bank statement → full credit score'],
  asOf, version: 1
}
```

`detail` is human-readable, for example "GST active since 2019-04-01 (6.8 yrs)" or "GSTR-3B: 24/24 filed, avg 1.2 days late". `citation` reuses the registry `cite()` format (source, fetchedAt, transaction id).

The weights live in one exported table (`PRE_SCREEN_RULES`) so they can be tuned in one place.

## Integration

- **Screening via `/api/v1/evaluate`** (GSTIN only): `screeningPayload.preScreen = computePreScreen(report)`. Billing is unchanged (registry-lookup price, free when no fresh data).
- **`/api/v1/registry/gstin/:g` and the probe alias:** the response includes `preScreen` next to `registryReport`. There is no extra charge.
- **History:** screening records keep `score: null` and add `preScreenGrade` and `preScreenVerdict`. Scored evaluations are unchanged.
- **Chat:** `handleXAIChat` accepts a screening payload that has `preScreen`. It explains the grade from its factors (Claude or Gemini, with a grounded fallback listing the factors) instead of replying "no completed evaluation". It is billed like any chat message.
- **Full evaluations:** unchanged. The 300–900 score and the registry adjustments behave exactly as before.

## Frontend

- `components/Registry/PreScreenCard.jsx`, rendered at the top of `RegistryScreeningReport`:
  - The header shows "REGISTRY PRE-SCREEN · Grade B · Proceed".
  - Factor rows show +/− markers, the detail, points/max, and the citation on hover.
  - It lists "Not assessed" items and the "Not assessed: revenue, cash buffer, debt" line.
  - An "Unlock" section has an "Attach bank statement" action that focuses the existing upload. The GST-consent unlock shows "Coming soon" until Tier 2.
- Wherever a 300–900 score is shown for a run (dashboard rows, Watchlist, History), a screening shows a "Pre-screen B" badge with distinct styling, never a number on the score scale.
- The live GSTIN probe card shows the grade badge as soon as the report loads.

## Error handling

- A missing or `unavailable` section is never an error. It becomes a not-assessed factor.
- `computePreScreen` never throws on a malformed report. Unexpected shapes are treated as not assessable.

## Testing (`node:test`)

- Knockouts: GST cancelled, GST suspended, and MCA "Strike Off" each give E / DECLINE even with otherwise perfect factors.
- Each factor's thresholds, including the boundaries: vintage exactly at 1, 3 and 5 years; 1 and 3 missing GSTR-1 periods; 5 and 15 days late.
- Missing GST filings: the filing factors are excluded and the percent is computed on the remaining max.
- A proprietorship (not an MCA entity): the MCA factor is not applicable and coverage uses 90.
- Coverage below 0.6 caps the grade at C and adds the caveat.
- No assessable data gives grade `null` and `INSUFFICIENT_DATA`.
- Route tests: the `/evaluate` screening result and `/registry` responses include `preScreen`, and the screening history record carries the grade.

## Out of scope

- Tier 2: GST taxpayer-consent flow (Sandbox taxpayer OTP session, GSTR-3B/GSTR-1 fetch, verified turnover and trend).
- Tier 3: Account Aggregator bank-data fetch.
- Calibrating weights against repayment outcomes (no outcome data yet).
