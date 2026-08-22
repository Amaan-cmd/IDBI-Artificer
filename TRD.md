# Technical Requirement Document (TRD)

**Project:** EnverAI Artificer - Multi-Agent Alternate-Data Underwriting Citadel  
**Author:** EnverAI Tech Inc.  
**Tech Stack:** Node.js (Express), React (Vite), Google Cloud Vertex AI / Gemini 2.5 SDK, Firebase Hosting, Cloud Run  

---

## 1. System Architecture
- **Ingestion & Scraper Engine (Fetcha - Agent 1):** Gemini 2.5 Flash (`@google/genai` or Vertex AI) with Cheerio/Scrapling live web scraping.
- **Quantitative Matrix Engine (Geek - Agent 2):** Gemini 2.5 Pro with deterministic mathematical ratio modeling and benchmark verification.
- **Synthesis & XAI Engine (Orc - Agent 3):** Gemini 2.5 Pro Chief Credit Officer with NeMo hallucination rails and zero-token-waste conversational interrogation endpoint (`POST /api/v1/chat/xai`).
- **Master Admin Citadel:** Full personnel telemetry, multi-agent daemon latency monitoring, and audit log archive.
- **SecOps Alerting:** Real-time Slack dispatch integration on every auth event and completed underwriting run.
