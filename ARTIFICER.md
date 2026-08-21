# EnverAI Artificer: Enterprise Agentic MSME Underwriting & Risk Intelligence Engine

**Master Technical Specification & Architecture Manual**  
*Author: EnverAI Engineering Team*  
*Classification: Enterprise Confidential / Institutional Lending Grade*

---

## 1. Executive Summary & Problem Space

### The $300B+ MSME Credit Gap
In India and emerging markets, over 63 million Micro, Small, and Medium Enterprises (MSMEs) contribute ~30% of GDP but face an estimated credit deficit exceeding **$300 Billion**. Traditional banking institutions reject up to 70% of New-to-Credit (NTC) applications because conventional credit bureaus (CIBIL / Experian) rely heavily on collateral and historical bureau footprints.

### The Solution: EnverAI Artificer
**Artificer** is an autonomous, explainable multi-agent underwriting citadel powered by **Google Cloud Vertex AI & Gemini Models**. Artificer ingests and reconciles multi-modal operational alternate data:
1. **Account Aggregator (AA / Sahamati) Bank Feeds & Statements (PDF/CSV)**
2. **GSTN Sandbox Filings (GSTR-1, GSTR-3B monthly turnover & tax payments)**
3. **Public Regulatory Registries (MCA21 company status, director tracking, NCLT insolvency & litigation filings)**
4. **Digital Cash Flow Ledgers (UPI, POS debits, supplier trade credit)**

Artificer compiles this telemetry in seconds into an immutable **MSME Financial Health Card** (Score: 300–900, Risk Tier: LOW/MEDIUM/HIGH, granular financial ratios, and traceable line-item citations) with **Zero Hallucinations**.

---

## 2. Multi-Agent Citadel Architecture

```
                          [ MULTI-MODAL DATA STREAMS ]
         Bank Statements (PDF/CSV) │ GSTN Returns │ Account Aggregator │ MCA Registry
                                        │
                                        ▼
   ╔═══════════════════════════════════════════════════════════════════════════════════╗
   ║                           ENVERAI ARTIFICER CITADEL                               ║
   ╠═══════════════════════════════════════════════════════════════════════════════════╣
   ║                                                                                   ║
   ║  1. FETCHA (Agent 1: Ingestion & Live Scraper) - Gemini 2.5 Flash                 ║
   ║     • Parses multi-page statements, GST returns, and JSON bank feeds              ║
   ║     • Executes live public web scraping (GSTIN status, MCA21, Court Registries)   ║
   ║     • Normalizes and validates tabular cash flows into structured schemas         ║
   ║                                    │                                              ║
   ║                                    ▼                                              ║
   ║  2. GEEK (Agent 2: Quantitative Telemetry Matrix) - Gemini 2.5 Pro                ║
   ║     • Ingests ONLY verified schemas from Fetcha                                   ║
   ║     • Computes Cash Buffer Ratio (closing cash / monthly debits)                  ║
   ║     • Annualized Revenue Run Rate & GSTR-1 vs GSTR-3B Tax Reconciliation          ║
   ║     • Inward NACH/ECS return bounce friction & debt capacity matrix               ║
   ║                                    │                                              ║
   ║                                    ▼                                              ║
   ║  3. ORC (Agent 3: Orchestrator & Chief Credit Officer) - Gemini 2.5 Pro           ║
   ║     • Orchestrator for session lifecycle and conversational interrogation         ║
   ║     • Cross-verifies character risk, financial resilience, and legal standing     ║
   ║     • Synthesizes Holistic Health Score (300-900) & Risk Tier (LOW/MED/HIGH)      ║
   ║     • Generates Executive Underwriting Narrative & Immutable Citations Ledger     ║
   ║     • Enforces NeMo anti-hallucination guardrails and output schema safety        ║
   ║                                                                                   ║
   ╚═══════════════════════════════════════════════════════════════════════════════════╝
                                        │
                                        ▼
                        [ INSTITUTIONAL COCKPIT & XAI ]
         2-Column Analytics Grid • Forensic Citations • Conversational Drawer
```

---

## 3. The Multi-Agent Persona Specifications

### Agent 1: Fetcha (`ingestionAgent.js`)
- **Engine:** Google Gemini 2.5 Flash (`gemini-2.5-flash`)
- **Role:** High-speed tabular parser, data sanitizer, and live web scraper.
- **Key Responsibilities:**
  - Ingests raw bank statements (CSV/PDF) and Sahamati Account Aggregator payloads.
  - Optional Live Web Scraper (`scraperService.js`) targeting GSTIN search, MCA21 company status, and court case registries.
  - Sanitizes and structures input data into canonical schemas before downstream handoff.

### Agent 2: Geek (`analysisAgent.js`)
- **Engine:** Google Gemini 2.5 Pro (`gemini-2.5-pro`)
- **Role:** Quantitative calculation matrix & financial ratio modeling.
- **Key Metrics Computed:**
  - **Cash Buffer Ratio:** $\text{Average Monthly Closing Balance} / \text{Total Monthly Debits}$ (Safety benchmark: $>0.15\text{x}$).
  - **Annualized Run Rate:** Outward supplies and recurring credits annualized.
  - **GSTR Compliance Rating:** Reconciliation between taxable supplies (GSTR-1) and tax payments (GSTR-3B).
  - **Return / Bounce Friction:** Count of inward NACH/ECS dishonors and cheque bounces.
  - **Debt Service Capacity:** Maximum sustainable monthly debt installment.

### Agent 3: Orc (`synthesisAgent.js` & `chatController.js`)
- **Engine:** Google Gemini 2.5 Pro (`gemini-2.5-pro`)
- **Role:** Chief Credit Officer (CCO), Master Orchestrator, and XAI Citadel.
- **Key Responsibilities:**
  - Orchestrates the full underwriting pipeline from ingestion to policy signoff.
  - Evaluates holistic 300–900 credit score with prime risk benchmarking.
  - Generates immutable line-item evidence citations for complete auditing.
  - Powers the **Conversational Underwriter Drawer** (`POST /api/v1/chat/xai`) for zero-greeting, fact-grounded forensic decision interrogation.

---

## 4. Enterprise Security Citadel & Compliance

1. **Google SSO Domain Gate:**
   - Client and server strictly reject any non-`@enveraitech.com` identity with immediate signout and security logging.
2. **Master Citadel Password Wall:**
   - Dedicated master credentials (`Andalaus` / `Citadel@296`) with brick-wall validation.
3. **Real-time Slack SecOps Alerts (`slackNotifier.js`):**
   - Automatically dispatches security payloads (user identity, IP address, login status, underwriting completions) to Slack / iOS Spark.
4. **5-Minute Silent Inactivity Sentinel:**
   - Automatically locks the underwriting cockpit after 300 seconds of idle user state for institutional compliance.
5. **Zero-Trace Data Scrubbing:**
   - Raw statement files are processed in memory/tmp and scrubbed immediately post-evaluation.
6. **NeMo Hallucination Guardrails (`nemoGuardrails.js`):**
   - Cross-checks arithmetic calculations and enforces strict schema validation.

---

## 5. UI Architecture & Cockpit Design

1. **Single-Page Viewport Containment:**
   - Ingestion dashboard fits cleanly within `100vh` without unnecessary vertical scrollbars.
2. **Balanced 2-Column Analytics Grid:**
   - Symmetrically displays the Holistic Score & Geek Quantitative Matrix on the left, alongside the Orc XAI Citadel, Line-Item Citations Ledger, and Interactive Directives on the right.
3. **Master Admin Citadel (`MasterDashboard.jsx`):**
   - Executive KPIs (Evaluation Volume, Multi-Agent Invocations, API Unit Economics).
   - Live Daemon Status (Fetcha, Geek, Orc latency & uptime).
   - Personnel Telemetry, Underwriting Audit Archive, and Security Rail status.
4. **Floating Artistic Orc Mascot:**
   - Sleek dark geometric emblem triggering the slide-over decision interrogation drawer.

---

## 6. API Route Registry

| Endpoint | Method | Component / Handler | Description |
| :--- | :--- | :--- | :--- |
| `/api/v1/evaluate` | `POST` | `creditController.js` | Executes 3-stage agentic underwriting stream (Fetcha $\rightarrow$ Geek $\rightarrow$ Orc) |
| `/api/v1/chat/xai` | `POST` | `chatController.js` | Direct zero-token-waste conversational interrogation with Orc |
| `/api/v1/users/login` | `POST` | `userController.js` | Strict domain SSO + Master Citadel authentication with Slack alerting |
| `/api/v1/users` | `GET` | `userController.js` | Retrieves active personnel telemetry & agent daemon costs |
| `/api/v1/history` | `GET` | `historyController.js` | Retrieves audited evaluation archives |
| `/api/v1/agami/train` | `POST` | `agamiController.js` | Ingests real-world Hugging Face MSME dataset records |

---

*EnverAI Artificer • Next-Generation Agentic Credit Intelligence*
