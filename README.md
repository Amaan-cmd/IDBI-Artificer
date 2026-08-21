# EnverAI Artificer: Autonomous MSME Underwriting Citadel

**Enterprise Agentic MSME Financial Health & Risk Intelligence Platform**  
*Built for the BITSoM Vertex Pitch Fest 2026 by EnverAI Tech Inc.*

---

## 🏛️ Architecture Overview

EnverAI Artificer is an enterprise multi-agent alternate-data underwriting engine that assesses New-to-Credit (NTC) MSMEs in under 10 seconds with zero hallucinations.

```
                         [ MULTI-MODAL DATA STREAMS ]
        Bank Statements (PDF/CSV) │ GST Returns │ Account Aggregator │ MCA Registries
                                       │
                                       ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ 1. FETCHA (Agent 1: Ingestion & Live Scraper) - Gemini 2.5 Flash            │
  │    • Ingests statements & live-scrapes GSTIN/MCA21 public registries        │
  └─────────────────────────────────────┬───────────────────────────────────────┘
                                        │
                                        ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ 2. GEEK (Agent 2: Quantitative Telemetry Matrix) - Gemini 2.5 Pro           │
  │    • Computes Cash Buffer Ratio, Annualized Run Rate & Debt Capacity        │
  └─────────────────────────────────────┬───────────────────────────────────────┘
                                        │
                                        ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ 3. ORC (Agent 3: Orchestrator & Chief Credit Officer) - Gemini 2.5 Pro      │
  │    • Synthesizes 300-900 Health Score, Risk Tiers, and Forensic Citations   │
  │    • Powers Conversational XAI Drawer for zero-token-waste interrogation    │
  └─────────────────────────────────────┬───────────────────────────────────────┘
                                        │
                                        ▼
                        [ INSTITUTIONAL COCKPIT & XAI ]
          2-Column Analytics Citadel • Immutable Citations Ledger • SecOps
```

---

## 🔒 Enterprise Security Citadel

- **Google SSO Domain Gate:** Exclusively permits `@enveraitech.com` verified enterprise accounts.
- **Citadel Brick Wall:** Master security password authentication (`Andalaus` / `Citadel@296`) with interactive visibility toggle.
- **5-Minute Silent Sentinel:** Orc locks the session automatically after 300 seconds of idle state.
- **Slack SecOps Real-Time Dispatch:** Broadcasts authentication events, client IPs, and evaluation telemetry directly to Slack / iOS Spark.
- **Master Admin Citadel:** Real-time visibility into multi-agent daemon latency, API unit economics (~$0.05/eval), and audit archive.

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
# Runs on http://localhost:5173
```

---

## 📊 Presentation Artifacts

- **Vector Pitch Deck PDF:** [`EnverAI_Artificer_BITSoM_Pitch_Deck.pdf`](./EnverAI_Artificer_BITSoM_Pitch_Deck.pdf)
- **HTML Presentation Source:** [`BITSoM_Pitch_Deck.html`](./BITSoM_Pitch_Deck.html)
- **Master Technical Specifications:** [`ARTIFICER.md`](./ARTIFICER.md)
- **BITSoM Deck Content Markdown:** [`BITSoM_Pitch_Deck_Content.md`](./BITSoM_Pitch_Deck_Content.md)
