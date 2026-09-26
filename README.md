# EnverAI Artificer: Autonomous MSME Underwriting Citadel

**Enterprise Agentic MSME Financial Health & Risk Intelligence Platform**  
*Proprietary Intellectual Property of EnverAI Tech Inc. ([enveraitech.com](https://enveraitech.com))*

---

## 🏛️ Architecture Overview

**EnverAI Artificer** is an institutional multi-agent alternate-data underwriting engine that assesses New-to-Credit (NTC) MSMEs in under 10 seconds with zero hallucinations. It combines fast heuristic reflexive gating (**Kahneman System 1**) with deep quantitative underwriting and explainable AI synthesis (**Kahneman System 2**).

```
                         [ MULTI-MODAL DATA STREAMS ]
        Bank Statements (PDF/CSV) │ GST Returns │ Account Aggregator │ MCA Registries
                                       │
                                       ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ 1. FETCHA (Agent 1: Ingestion & Live Scraper) - Grok 4.6 Tools / Gemini     │
  │    • Ingests statements & live-scrapes GSTIN & MCA21 statutory registries   │
  │    • Normalizes multi-period financial cash flows into canonical schemas    │
  └─────────────────────────────────────┬───────────────────────────────────────┘
                                        │
                                        ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ 🛡️ JEV (System 1: Cognitive Sanity & Balance Continuity Gatekeeper)         │
  │    • Verifies arithmetic ledger continuity: Opening + Credits - Debits = Cls │
  │    • Discriminates NPCI NACH bounce reason codes (ignoring transit faults)  │
  │    • Neutralizes adversarial prompt injections & fabricated balance files   │
  └─────────────────────────────────────┬───────────────────────────────────────┘
                                        │
                                        ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ 2. GEEK (Agent 2: Quantitative Telemetry Matrix) - Gemini 2.5 Pro           │
  │    • Computes Cash Buffer Ratio, Annualized Run Rate & Debt Capacity Proxy  │
  │    • Calculates Coefficient of Variation (CV) & Working Capital Runway     │
  └─────────────────────────────────────┬───────────────────────────────────────┘
                                        │
                                        ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ 3. ORC (Agent 3: Orchestrator & Chief Credit Officer) - Gemini 2.5 Pro      │
  │    • Synthesizes 300-900 Holistic Credit Score, Risk Tiers (LOW/MED/HIGH)   │
  │    • Produces granular Forensic Citations Ledger & CCO Decision Narrative   │
  │    • Powers Conversational XAI Drawer for zero-token-waste interrogation    │
  └─────────────────────────────────────┬───────────────────────────────────────┘
                                        │
                                        ▼
                        [ INSTITUTIONAL COCKPIT & XAI ]
          2-Column Analytics Citadel • Immutable Citations Ledger • SecOps
```

---

## 🛡️ Underwriting Edge Cases & Forensic Safeguards

Artificer features automated defensive safeguards against the primary vectors that tamper with or distort SME credit scoring:

1. **Arithmetic Balance Continuity Engine (Anti-Pixel Tampering)**  
   Verifies that $\text{Opening Balance} + \sum \text{Inflows} - \sum \text{Outflows} \equiv \text{Closing Balance}$. Discrepancies $> 1.5\%$ flag audit warnings; extreme ledger fabrications ($> 200\%$) trigger immediate `REJECTED_UNFIT`.
2. **Auto-Sweep Fixed Deposit Turnover Neutralization**  
   Internal sweep-in and sweep-out transfers between current and fixed deposit accounts are excluded from operational revenue to prevent turnover inflation, while recognizing the swept deposits in the liquid cash buffer.
3. **CC / OD Negative Ledger & Drawing Power**  
   Accounts operating with negative cash credit balances utilize remaining sanctioned drawing power ($\text{Sanctioned Limit} - \text{Peak Utilization}$) to calculate true survival buffer days without zero-division errors.
4. **Composition Scheme Handling (`CMP-08`)**  
   Identifies composition dealers paying flat quarterly 1% turnover tax, benchmarking against CMP-08 filing timelines and suppressing false "missing GSTR-1" flags.
5. **NPCI NACH Reason Code Discrimination**  
   Distinguishes solvency dishonors (Code 01/02 insufficient funds) from non-solvency transit or technical errors (Code 09, 21, 55, mandate expiration, signature mismatch), ensuring technical failures do not penalize creditworthiness.
6. **Adversarial Prompt Injection Defense**  
   Instant deterministic security interceptors scan incoming metadata and narrations for malicious prompt-override signatures (e.g. `[SYSTEM OVERRIDE]`, `ignore all debits`), halting execution before LLM invocation.

---

## 🔒 Enterprise Security Citadel

- **Google SSO Domain Gate:** Exclusively permits `@enveraitech.com` verified enterprise accounts.
- **Citadel Brick Wall:** Master security password authentication with interactive visibility toggle.
- **5-Minute Silent Sentinel:** Orc locks the session automatically after 300 seconds of idle state.
- **Slack SecOps Real-Time Dispatch:** Broadcasts authentication events, client IPs, and evaluation telemetry directly to Slack / iOS Spark.
- **Master Admin Citadel:** Real-time visibility into multi-agent daemon latency, API unit economics (~$0.02/eval), and audit archive.

---

## 🚀 Running Locally

### 1. Backend Server
```bash
node backend/server.js
# Runs on http://localhost:4000
```

### 2. Frontend Cockpit
```bash
npm run dev --prefix frontend
# Runs on http://localhost:5173 (proxied to backend)
```

### 3. Automated Enterprise Smoke Test Suite
```bash
npm run smoke-test
# or: node test_smoke_enterprises.js
```
Runs 8 automated test cases covering real GSTINs (Kariman Enterprises, Enver AI, Tata Motors Passenger Vehicles, Surat Textile, Kalyan Agro) and edge-case injection scenarios.

---

## ☁️ Cloud Deployment

The repository is containerized and ready for single-container serverless deployment to **Google Cloud Run**, **Azure Container Apps**, or **AWS ECS**.

### Option A: One-Click Google Cloud Run (Recommended)

#### Linux / macOS / Cloud Shell:
```bash
chmod +x deploy_gcloud.sh
./deploy_gcloud.sh
```

#### Windows:
```cmd
deploy_gcloud.bat
```

#### Or via gcloud CLI directly:
```bash
gcloud run deploy enverai-artificer \
  --source . \
  --platform managed \
  --region us-central1 \
  --port 8080 \
  --memory 1Gi \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production
```

### Option B: Local Docker Container
```bash
docker compose up --build
# Cockpit and API accessible on http://localhost:8080
```

---

## 📊 Technical Documentation

- **Master System Specifications:** [`ARTIFICER.md`](./ARTIFICER.md)
- **Azure Enterprise Migration Runbook:** [`azure.md`](./azure.md)
- **Deployment & Architecture Specifications:** [`DESIGN_SPECIFICATION.md`](./DESIGN_SPECIFICATION.md)
