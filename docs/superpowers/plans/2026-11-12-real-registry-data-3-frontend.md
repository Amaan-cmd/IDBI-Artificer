# Real Registry Data — Plan Part 3: Frontend

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The UI shows only real registry data (or "Not available") with provenance, renders GSTIN-only registry screenings, and never fabricates scores or financials outside demo mode.

**Architecture:** `utils/demoMode.js` gates presets. GSTIN probes go to the backend registry route. `getCompanyDecisionData` derives from the real evaluation payload (or demo presets in demo mode) and returns `null` otherwise; views render empty states for `null`. New components: `RegistryProbeCard`, `RegistryScreeningReport`, `SampleDataBadge`.

**Tech Stack:** React 18, Vite. No frontend test runner exists; each task verifies with `npm --prefix frontend run build` plus a manual check against the running backend.

**Prerequisite:** Parts 1 and 2 complete.

---

### Task 20: Demo flag and gstinRegistry cleanup

**Files:**
- Create: `frontend/src/utils/demoMode.js`, `frontend/src/components/SampleDataBadge/SampleDataBadge.jsx`
- Modify: `frontend/src/utils/gstinRegistry.js:22-30,166-327`, `frontend/.env.example`

- [ ] **Step 1: Create `frontend/src/utils/demoMode.js`**

```js
export const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';
```

- [ ] **Step 2: Create `SampleDataBadge.jsx`**

```jsx
import React from 'react';

export default function SampleDataBadge() {
  return (
    <span
      className="sample-data-badge"
      title="Sample data for demonstration. Not a real registry record."
      style={{
        display: 'inline-block', padding: '2px 8px', borderRadius: '999px', fontSize: '0.7rem',
        fontWeight: 700, letterSpacing: '0.05em', background: 'var(--status-amber-bg)',
        color: 'var(--status-amber-text)', border: '1px solid var(--status-amber-border)'
      }}
    >
      SAMPLE DATA
    </span>
  );
}
```

- [ ] **Step 3: Strip the generator from `gstinRegistry.js`**

Delete `hashGstin` (lines 22–30) and everything in `getGSTINProbeData` after the `if (known) { ... }` block (the "Dynamic Generator", lines 223–326). Change the function head and add the demo gate:

```js
import { isDemoMode } from './demoMode';

export function getGSTINProbeData(gstin) {
  if (!isDemoMode || !gstin) return null;
  const clean = gstin.trim().toUpperCase();
```

Inside the `if (known)` return object add `sampleData: true,`. After the `if (known) {...}` block add `return null;`.

- [ ] **Step 4: Env example** — append to `frontend/.env.example`:

```
# Show preset sample companies labelled SAMPLE DATA (true/false)
VITE_DEMO_MODE=false
```

- [ ] **Step 5: Build, commit**

Run: `npm --prefix frontend run build` → succeeds.

```bash
git add frontend/src/utils/demoMode.js frontend/src/components/SampleDataBadge/SampleDataBadge.jsx frontend/src/utils/gstinRegistry.js frontend/.env.example
git commit -m "feat(frontend): demo-mode flag; remove client-side GSTIN fabrication"
```

---

### Task 21: App.jsx — real probes, no fabricated evaluation fallback

**Files:**
- Modify: `frontend/src/App.jsx` (state init ~141, history defaults ~290–346, `probeGSTIN` ~371, `triggerEvaluation` ~566–736, `sendOrcDirective` ~771–806)

- [ ] **Step 1: Initial state** — replace

```js
  const [gstinInput, setGstinInput] = useState('27AADCB2230M1Z2');
  const [gstinProbeData, setGstinProbeData] = useState(getGSTINProbeData('27AADCB2230M1Z2'));
```

with

```js
  const [gstinInput, setGstinInput] = useState('');
  const [gstinProbeData, setGstinProbeData] = useState(null);
  const [probeState, setProbeState] = useState({ loading: false, error: null });
  const probeTimerRef = useRef(null);
```

(add `useRef` to the React import).

- [ ] **Step 2: Hardcoded history** — the array of preset history entries (~lines 290–346, entries like "Kalyan Agro", "ENVER-AITECH") is only used when the backend returns nothing. Wrap where it is applied so it is used only when `isDemoMode` is true, and add `sampleData: true` to each entry. Import `isDemoMode` from `./utils/demoMode`.

- [ ] **Step 3: Replace `probeGSTIN`**

```js
  const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

  const probeGSTIN = (gstin, { cin } = {}) => {
    const clean = (gstin || '').trim().toUpperCase();
    setGstinInput(clean);
    clearTimeout(probeTimerRef.current);
    if (!GSTIN_RE.test(clean)) {
      setGstinProbeData(null);
      setProbeState({ loading: false, error: null });
      return;
    }
    setProbeState({ loading: true, error: null });
    probeTimerRef.current = setTimeout(async () => {
      try {
        const qs = cin ? `?cin=${encodeURIComponent(cin)}` : '';
        const res = await apiFetch(`/api/v1/registry/gstin/${clean}${qs}`);
        const body = await res.json().catch(() => ({}));
        if (res.ok && body.registryReport) {
          setGstinProbeData({ gstin: clean, registryReport: body.registryReport });
          setProbeState({ loading: false, error: null });
        } else {
          setGstinProbeData(null);
          setProbeState({ loading: false, error: body.error || `Registry lookup failed (HTTP ${res.status})` });
        }
      } catch {
        setGstinProbeData(null);
        setProbeState({ loading: false, error: 'Registry lookup failed. Check your connection.' });
      }
    }, 600);
  };
```

- [ ] **Step 4: `triggerEvaluation`** — delete the `scraperData` append (`if (gstinProbeData?.registry) {...}`). Replace the `if (!response.ok) { throw ... }` check with:

```js
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        sseError = body.error || `Underwriting Engine returned HTTP ${response.status}`;
      }
```

and wrap the stream-reading block in `if (response.ok && response.body && ...)`. Change the `catch (networkErr)` body to:

```js
      console.warn('[Citadel Network Pipeline Notice]:', networkErr.message);
      if (!isDemoMode) sseError = 'The underwriting engine could not be reached. Please retry.';
```

In the `completedPayload` history item, change `score: completedPayload.decision?.score || 750,` to `score: completedPayload.decision?.score ?? null,` and `risk: completedPayload.decision?.riskLevel || 'LOW',` to `risk: completedPayload.decision?.riskLevel ?? null,`, and `status:` to `completedPayload.reportType === 'REGISTRY_SCREENING' ? 'Registry Screening' : 'Completed (Live Pipeline)'`.

Wrap the entire "Resilient Fallback" section (from `console.info('[Citadel Engine] Live cloud pipeline unreachable...` to the final `setLoading(false);`) in `if (isDemoMode) { ... }`, and before it add:

```js
    if (!isDemoMode) {
      setError('No evaluation result was returned. Please retry.');
      setLoading(false);
      return;
    }
```

- [ ] **Step 5: `sendOrcDirective` fallback** — in the `catch` block replace the `getCompanyDecisionData(...)` call with:

```js
      const companyData = getCompanyDecisionData(
        data?.businessName || gstinProbeData?.registryReport?.gst?.data?.legalName,
        data?.gstin || gstinProbeData?.gstin || gstinInput,
        gstinProbeData,
        data
      );
      const resp = companyData
        ? generateOrcResponse(userQuery, companyData)
        : 'Orc is unavailable right now, and there is no completed evaluation to explain yet. Run an evaluation, then ask again.';
```

- [ ] **Step 6: Pass new props** — where `<NewEvaluationView` is rendered add `evaluationData={data}`, `probeState={probeState}`, and change `onProbeGSTIN={probeGSTIN}` to pass through unchanged (signature now accepts `{ cin }`). Remove the `getGSTINProbeData` import if no longer referenced; at lines ~985–1025 (`gstinToProbe` / `companyId` handlers) replace `getGSTINProbeData(x)` + `setGstinProbeData(probe)` pairs with `probeGSTIN(x)`.

- [ ] **Step 7: Build, commit**

Run: `npm --prefix frontend run build` → succeeds.

```bash
git add frontend/src/App.jsx
git commit -m "feat(frontend): backend registry probes; no fabricated evaluations outside demo mode"
```

---

### Task 22: orcIntelligence derives from the real payload

**Files:**
- Modify: `frontend/src/utils/orcIntelligence.js:1-60` (and any later references to `resolvedKey`-based fabrication)
- Modify: `frontend/src/components/OrcTerminal/OrcTerminal.jsx:8-16`

- [ ] **Step 1: New signature and source selection** — replace the top of `getCompanyDecisionData` through the `inwardBounces` line with:

```js
import { KNOWN_GSTINS } from './gstinRegistry';
import { isDemoMode } from './demoMode';

export function getCompanyDecisionData(businessName, gstin, probeData = null, evaluationPayload = null) {
  const cleanGstin = (gstin || '').trim().toUpperCase();
  const telemetry = evaluationPayload?.agent1Telemetry;
  const hasRealFinancials = Array.isArray(telemetry?.monthlyCredits) && telemetry.monthlyCredits.length > 0;
  const known = !hasRealFinancials && isDemoMode ? KNOWN_GSTINS[cleanGstin] : null;
  if (!hasRealFinancials && !known) return null;

  const src = hasRealFinancials ? telemetry : known;
  const report = evaluationPayload?.registryReport || probeData?.registryReport || null;
  const name = businessName || src.businessName || src.legalEntityName || report?.gst?.data?.legalName || 'Enterprise';
  const entityType = report?.gst?.data?.constitution || src.entityType || 'Not verified';
  const mcaStatus = report?.mca?.status === 'ok' ? report.mca.data.status : (known?.mcaStatus || 'Not verified');

  const credits = src.monthlyCredits;
  const debits = src.monthlyDebits || [];
  const closingBalance = src.closingBalance ?? src.bankClosingBalance ?? 0;
  const sanctionedOdLimit = src.sanctionedOdLimit ?? 0;
  const peakOdUsage = src.peakOdUsage ?? 0;
  const gstr1Sales = src.gstr1OutwardTaxable ?? 0;
  const gstr1Tax = src.gstr1DeclaredTax ?? 0;
  const gstr3bTax = src.gstr3bTaxPaid ?? 0;
  const monthlyEmi = src.monthlyEmiObligations ?? 0;
  const inwardBounces = src.inwardBounces ?? 0;
  const sampleData = Boolean(known);
```

Replace the court-case/DIN lines that key off `resolvedKey` with:

```js
  const courtCases = known ? (cleanGstin === '27AAGCK8812L1ZQ' ? 1 : 0) : null; // null = not available from provider
  const directorDIN = known ? (cleanGstin === '27AAGCK8812L1ZQ' ? '01829471 (Inquiry)' : '02914820 (Clean)') : 'Not available';
```

Then read the rest of the function: wherever `courtCases` is used in arithmetic or comparisons, guard with `courtCases !== null &&`; wherever it is rendered in text, render `courtCases ?? 'Not available'`. Where the function returns its object, override the self-computed score with the backend's when present and expose provenance:

```js
    score: evaluationPayload?.decision?.score ?? score,
    sampleData,
    registryAdjustments: evaluationPayload?.decision?.registryAdjustments || [],
```

(apply `riskTier` from `evaluationPayload.decision.riskLevel` the same way if the object has a risk field).

- [ ] **Step 2: `generateOrcResponse`** — read its body; any branch that references `resolvedKey`, `KNOWN_GSTINS`, or `getGSTINProbeData` directly must use the `companyData` argument instead. Remove the `getGSTINProbeData` import.

- [ ] **Step 3: OrcTerminal** — accept `evaluationPayload` and pass it:

```jsx
export default function OrcTerminal({ currentBusiness, evaluationPayload = null, onQuickInspect }) {
  const companyData = useMemo(() => getCompanyDecisionData(
    currentBusiness?.name, currentBusiness?.gstin, currentBusiness?.probeData, evaluationPayload
  ), [currentBusiness?.name, currentBusiness?.gstin, currentBusiness?.probeData, evaluationPayload]);
```

Wherever the terminal reads `companyData.x` before a user message (header, initial system line), guard for `null` and show: `No evaluation yet. Run an evaluation, then interrogate Orc about the decision.` In the send handler, if `companyData` is null and the backend call fails, reply with that same text instead of calling `generateOrcResponse`.

- [ ] **Step 4: Build, commit**

Run: `npm --prefix frontend run build` → succeeds.

```bash
git add frontend/src/utils/orcIntelligence.js frontend/src/components/OrcTerminal/OrcTerminal.jsx
git commit -m "feat(orc): explanations derive from the real evaluation payload, not presets"
```

---

### Task 23: Registry probe card, screening report, empty states

**Files:**
- Create: `frontend/src/components/Registry/RegistryProbeCard.jsx`, `frontend/src/components/Registry/RegistryScreeningReport.jsx`, `frontend/src/components/Registry/Registry.css`
- Modify: `frontend/src/components/NewEvaluation/NewEvaluationView.jsx`, `frontend/src/components/CommandPalette/CommandPalette.jsx`

- [ ] **Step 1: `Registry.css`**

```css
.registry-card { margin-top: 1rem; padding: 1rem 1.25rem; border: 1px solid var(--border-subtle, #E2E8F0); border-radius: 14px; background: var(--surface-card, #fff); }
.registry-row { display: grid; grid-template-columns: 180px 1fr; gap: 6px 12px; font-size: 0.85rem; }
.registry-label { color: var(--text-secondary); }
.registry-unavailable { color: var(--text-secondary); font-style: italic; }
.registry-provenance { margin-top: 0.75rem; font-size: 0.72rem; color: var(--text-secondary); font-family: var(--font-mono, monospace); }
.registry-badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 0.72rem; font-weight: 700; }
.registry-badge.REGULAR { background: var(--status-green-bg); color: var(--status-green-text); }
.registry-badge.IRREGULAR { background: var(--status-amber-bg); color: var(--status-amber-text); }
.registry-badge.DELINQUENT { background: var(--status-red-bg); color: var(--status-red-text); }
.registry-badge.UNKNOWN { background: var(--surface-muted, #F1F5F9); color: var(--text-secondary); }
.registry-candidates button { display: block; margin: 4px 0; text-align: left; background: none; border: 1px solid var(--border-subtle, #E2E8F0); border-radius: 8px; padding: 6px 10px; cursor: pointer; width: 100%; }
.registry-filings { width: 100%; border-collapse: collapse; margin-top: 0.75rem; font-size: 0.8rem; }
.registry-filings th, .registry-filings td { text-align: left; padding: 4px 8px; border-bottom: 1px solid var(--border-subtle, #E2E8F0); }
```

- [ ] **Step 2: `RegistryProbeCard.jsx`**

```jsx
import React from 'react';
import SampleDataBadge from '../SampleDataBadge/SampleDataBadge';
import './Registry.css';

const formatInr = (n) => (typeof n === 'number' ? `₹${n.toLocaleString('en-IN')}` : '—');

export function Provenance({ section }) {
  if (!section || section.status !== 'ok') return null;
  return (
    <div className="registry-provenance">
      {section.source} · fetched {new Date(section.fetchedAt).toLocaleString('en-IN')}
      {section.transactionId ? ` · txn ${String(section.transactionId).slice(0, 8)}` : ''}
      {section.cached ? ' · cached' : ''}
    </div>
  );
}

function Unavailable({ section }) {
  return <span className="registry-unavailable">{section?.reason || 'Not available'}</span>;
}

export default function RegistryProbeCard({ report, onSelectCin }) {
  if (!report) return null;
  const { gst, mca, filingMetrics } = report;
  const p = filingMetrics?.primary;

  return (
    <div className="registry-card">
      {report.sampleData && <SampleDataBadge />}
      <div className="registry-row">
        <span className="registry-label">Legal name</span>
        <span>{gst.status === 'ok' ? gst.data.legalName : <Unavailable section={gst} />}</span>
        {gst.status === 'ok' && (<>
          <span className="registry-label">Trade name</span><span>{gst.data.tradeName || '—'}</span>
          <span className="registry-label">GST status</span><span>{gst.data.status}{gst.data.registrationDate ? ` · registered ${gst.data.registrationDate}` : ''}{gst.data.cancellationDate ? ` · cancelled ${gst.data.cancellationDate}` : ''}</span>
          <span className="registry-label">Constitution</span><span>{gst.data.constitution || '—'}</span>
          <span className="registry-label">Taxpayer type</span><span>{gst.data.taxpayerType || '—'}</span>
          <span className="registry-label">Address</span><span>{gst.data.principalAddress || '—'}</span>
        </>)}
        <span className="registry-label">Filing discipline</span>
        <span>
          <span className={`registry-badge ${filingMetrics?.filingDiscipline || 'UNKNOWN'}`}>{filingMetrics?.filingDiscipline || 'UNKNOWN'}</span>
          {p ? ` ${p.returnType}: ${p.filedPeriods}/${p.expectedPeriods} filed, ${p.missingPeriods.length} missing, ${p.lateFilings} late (avg ${p.averageDaysLate} days)` : ''}
        </span>
        <span className="registry-label">MCA21</span>
        <span>
          {mca.status === 'ok' && (<>{mca.data.status} · CIN {mca.data.cin}{mca.data.incorporationDate ? ` · incorporated ${mca.data.incorporationDate}` : ''}{mca.data.paidUpCapital != null ? ` · paid-up ${formatInr(mca.data.paidUpCapital)}` : ''}</>)}
          {mca.status === 'unavailable' && <Unavailable section={mca} />}
          {mca.status === 'ambiguous' && (
            <div className="registry-candidates">
              <span className="registry-unavailable">Several companies match the GST legal name. Select the correct one:</span>
              {mca.candidates.map(c => (
                <button key={c.cin} type="button" onClick={() => onSelectCin?.(c.cin)}>{c.name} · {c.cin}</button>
              ))}
            </div>
          )}
        </span>
        <span className="registry-label">Directors / charges / litigation</span>
        <span className="registry-unavailable">Not covered by current data provider</span>
      </div>
      <Provenance section={gst} />
      <Provenance section={mca} />
    </div>
  );
}
```

- [ ] **Step 3: `RegistryScreeningReport.jsx`**

```jsx
import React from 'react';
import RegistryProbeCard, { Provenance } from './RegistryProbeCard';
import './Registry.css';

export default function RegistryScreeningReport({ payload, onSelectCin }) {
  const report = payload?.registryReport;
  if (!report) return null;
  const filings = report.filings?.status === 'ok' ? [...report.filings.data].sort((a, b) => (a.period < b.period ? 1 : -1)) : [];

  return (
    <div className="registry-card">
      <h3 style={{ margin: 0 }}>Registry Screening · {payload.businessName}</h3>
      <p className="registry-unavailable" style={{ marginTop: 4 }}>
        No credit score: registries do not contain revenue. Upload a bank statement for a full 5-pillar credit score.
      </p>
      <RegistryProbeCard report={report} onSelectCin={onSelectCin} />
      {filings.length > 0 && (
        <table className="registry-filings">
          <thead><tr><th>Period</th><th>Return</th><th>Filed on</th><th>ARN</th><th>Status</th></tr></thead>
          <tbody>
            {filings.map(f => (
              <tr key={`${f.returnType}-${f.period}-${f.arn}`}>
                <td>{f.period}</td><td>{f.returnType}</td><td>{f.filedOn || '—'}</td><td>{f.arn || '—'}</td><td>{f.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Provenance section={report.filings} />
    </div>
  );
}
```

- [ ] **Step 4: NewEvaluationView wiring**

- Props: add `evaluationData = null, probeState = { loading: false, error: null }`.
- Imports: `RegistryProbeCard`, `RegistryScreeningReport`, `SampleDataBadge`, `isDemoMode`; remove `getGSTINProbeData`.
- Replace the derived values block (`const resolved = ...` through `previewBadge`) with:

```jsx
  const report = gstinProbeData?.registryReport || evaluationData?.registryReport || null;
  const legalName = report?.gst?.status === 'ok' ? report.gst.data.legalName : null;
  const isResolved = Boolean(legalName);
  const businessName = evaluationData?.businessName || legalName || (file?.name ? file.name.replace(/\.[^/.]+$/, '').toUpperCase() : 'Enterprise');
  const gstinToDisplay = evaluationData?.gstin || gstinProbeData?.gstin || gstinInput || '';
  const isScreening = evaluationData?.reportType === 'REGISTRY_SCREENING';
  const previewDecision = isScreening ? null : getCompanyDecisionData(businessName, gstinToDisplay, gstinProbeData, evaluationData);
  const previewColor = previewDecision ? (previewDecision.score >= 750 ? 'var(--status-green-text)' : previewDecision.score >= 620 ? 'var(--status-amber-text)' : 'var(--status-red-text)') : undefined;
  const previewBadge = previewDecision ? (previewDecision.score >= 750 ? 'badge-comfortable' : previewDecision.score >= 620 ? 'badge-moderate' : 'badge-stressed') : '';
```

- Presets: render the "Presets:" suggestions block only when `isDemoMode`, with `<SampleDataBadge />` next to the label.
- Search input: placeholder `Enter a 15-character GSTIN`; `onKeyDown` Enter calls `onProbeGSTIN(gstinInput.trim())` (validation is in App).
- Below the search bar: `{probeState.loading && <span className="registry-unavailable">Looking up GSTN and MCA21…</span>}` and `{probeState.error && <span style={{ color: 'var(--status-red-text)' }}>{probeState.error}</span>}`.
- In the HITL card, replace the three header badges with `<RegistryProbeCard report={report} onSelectCin={(cin) => onProbeGSTIN(gstinInput, { cin })} />` rendered under the legal-name heading, and set the heading to `businessName`. Change the authorize button label to `file ? '⚡ INGEST & GENERATE CREDIT SCORE' : '⚡ RUN REGISTRY SCREENING'`.
- Findings tab: if `isScreening`, render `<RegistryScreeningReport payload={evaluationData} onSelectCin={(cin) => onProbeGSTIN(gstinInput, { cin })} />`; else if `!previewDecision`, render `<div className="registry-card registry-unavailable">Run an evaluation to see findings.</div>` instead of `<ScrollStack>`; else the existing ScrollStack, with `{previewDecision.sampleData && <SampleDataBadge />}` in the findings meta bar.
- OrcTerminal: pass `evaluationPayload={evaluationData}`.
- "Open Full Split Workspace" button: `disabled={!evaluationData || isScreening}`.

- [ ] **Step 5: CommandPalette** — import `isDemoMode`; build the preset command list from `KNOWN_GSTINS` only when `isDemoMode` (else empty array); delete uses of `getGSTINProbeData` and route selections through the existing `onProbe`/select callback with the GSTIN only.

- [ ] **Step 6: Build and manual verification**

Run: `npm --prefix frontend run build` → succeeds.

Manual (backend running with `SANDBOX_*` set, `DEMO_MODE` unset; frontend `VITE_DEMO_MODE` unset):
1. Log in with password. No presets shown; GSTIN field empty.
2. Enter `24AAACQ1234A1Z5`-style real GSTIN (use a GSTIN you know, e.g. your own company's). Probe card shows legal name, status, filing discipline, MCA section, provenance lines "GSTN via Sandbox · fetched …".
3. Click "Run registry screening" → screening report with filing table; findings tab shows it; no score anywhere.
4. Upload a bank statement for the same GSTIN → score shown; Raw JSON contains `registryReport` and `decision.registryAdjustments`.
5. Enter an invalid GSTIN → no request; enter a valid-format but non-existent GSTIN → "GSTIN not found on GST portal".
6. Stop the backend and run an evaluation → error banner, no score.
7. With `VITE_DEMO_MODE=true` and `DEMO_MODE=true`: presets visible with SAMPLE DATA badges and produce scores.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/Registry/ frontend/src/components/NewEvaluation/NewEvaluationView.jsx frontend/src/components/CommandPalette/CommandPalette.jsx
git commit -m "feat(frontend): real registry probe card, registry screening report, empty states"
```

---

### Task 24: Live verification and env docs

**Files:**
- Modify: `backend/.env.example`, `backend/.env.azure.example`

- [ ] **Step 1: Env docs** — append to both files:

```
# Sessions
SESSION_JWT_SECRET=replace-with-a-long-random-string
ADMIN_EMAILS=andalaus@enveraitech.com
FIREBASE_PROJECT_ID=idbi-innovate
# Persistent storage (required in production)
AZURE_STORAGE_CONNECTION_STRING=
# Sandbox.co.in registry data
SANDBOX_API_KEY=
SANDBOX_API_SECRET=
# SANDBOX_BASE_URL=https://test-api.sandbox.co.in
# Preset sample companies (labelled SAMPLE DATA)
DEMO_MODE=false
```

- [ ] **Step 2: One live call per endpoint** (consumes a few Sandbox credits; results not committed)

```bash
cd backend && node -e "
require('dotenv').config();
const { getRegistryReport } = require('./services/registry/registryService');
const { createFileTableStore } = require('./platform/tableStore');
const store = createFileTableStore(require('os').tmpdir() + '/live-check');
getRegistryReport(process.argv[1], { store }).then(r => console.log(JSON.stringify({ gst: r.gst.status, name: r.gst.data?.legalName, filings: r.filings.status, n: r.filings.data?.length, discipline: r.filingMetrics.filingDiscipline, mca: r.mca.status, cin: r.mca.data?.cin }, null, 2)));
" <REAL_GSTIN_OF_A_PRIVATE_LIMITED_COMPANY>
```

Expected: `gst: "ok"` with the real legal name, `filings: "ok"`, a discipline value, and `mca: "ok"` (or `ambiguous` with candidates). Paste the output in the PR description.

- [ ] **Step 3: Full test + build + smoke**

Run: `npm --prefix backend test` → all PASS. `npm --prefix frontend run build` → succeeds. `npm run smoke-test` → note results (the smoke suite's preset-GSTIN cases require `DEMO_MODE=true`; run it with that flag and report any failures honestly).

- [ ] **Step 4: Commit**

```bash
git add backend/.env.example backend/.env.azure.example
git commit -m "docs: environment variables for sessions, storage, Sandbox and demo mode"
```

---

## Self-review against spec

- A1 table store → Tasks 2–3. A2 sessions, `/auth/session`, protected routes, frontend `apiFetch` → Tasks 4–8.
- B1 client → 9. B2 providers → 10–11. B3 service + cache → 13. B4 metrics → 12. B5 adjustments → 14 (applied in 18). B6 routes/ingestion/controller/grok/scraper removal → 16–19. B7 provenance → 14 (citations), 23 (UI). B8 demo mode → 15, 20, 21, 23. B9 frontend → 20–23. Testing → per task + 24.
- Deviation from spec, deliberate: `/api/v1/users` and `/api/v1/telemetry/logins` now require an admin session (they currently expose every user's email publicly).
- Not in this plan (billing plan follows): accounts, ledger, pricing, Stripe.
