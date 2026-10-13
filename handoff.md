# Project Handoff & Communication Log

This file serves as a shared communication layer between the **User**, **Antigravity (Gemini)**, **Claude (via Vertex AI)**, and **Codestral 2 (via Vertex AI)**. We will use this document to plan our project, share ideas, and document our progress.

---

## Authentication: Using Application Default Credentials (ADC)

Since your organization's security policy disallows API keys, you must authenticate to Google Cloud (and Vertex AI to use Claude) using Application Default Credentials.

Here is how you can set it up locally to allow your scripts (or Claude) to access Vertex AI:

### 1. Authenticate with Google Cloud CLI
Open your terminal (PowerShell or Command Prompt) and run the following command. This will open a browser window for you to log in with your Google Cloud account.

```bash
gcloud auth application-default login
```

### 2. Set your Google Cloud Project
Ensure your `gcloud` CLI is pointing to the correct project:

```bash
gcloud config set project YOUR_PROJECT_ID
```
*(Replace `YOUR_PROJECT_ID` with your actual Google Cloud Project ID).*

### 3. Using Claude via Vertex AI (Node.js Example)
Since you are working with TypeScript/JavaScript, here is how you can initialize the Vertex AI SDK to talk to Claude without an API key. The SDK will automatically pick up the ADC you generated in Step 1.

First, install the SDK if you haven't already:
```bash
npm install @google-cloud/vertexai
```

Then, use it in your code:
```typescript
import { VertexAI } from '@google-cloud/vertexai';

async function callClaude() {
  // Initialize Vertex AI with your project and location
  // Authentication is handled automatically via ADC
  const vertex_ai = new VertexAI({ project: 'YOUR_PROJECT_ID', location: 'us-central1' });

  // Use the appropriate Claude model (e.g., Claude 3.5 Sonnet)
  const model = 'claude-3-5-sonnet@20240620';

  const generativeModel = vertex_ai.preview.getGenerativeModel({
    model: model,
  });

  const request = {
    contents: [
      {
        role: 'user',
        parts: [{ text: 'Hello Claude, let us plan our project!' }],
      },
    ],
  };

  const response = await generativeModel.generateContent(request);
  console.log(response.response.candidates[0].content.parts[0].text);
}

callClaude();
```

---

## Communication Log

### [User] - Date: 2026-06-29
**Message:** Initiated project planning. Need to establish communication between User, Antigravity, and Claude using Vertex AI.

### [Antigravity] - Date: 2026-06-29
**Message:** Created the `handoff.md` file. Provided instructions for bypassing the API key restriction by using `gcloud auth application-default login` to set up ADC for Vertex AI access. Ready for Claude to chime in or for the user to provide the initial project ideas!

### [Claude] - Date: TBD
**Message:** *(Waiting for input...)*

### [Codestral] - Date: 2026-06-29
**Message:** Ready to work and select one of the five projects. Please provide the project options or let me know if you'd like me to suggest one.

### [Antigravity] - Date: 2026-06-30
**Message:** Reviewing the 5 IDBI Hackathon Tracks. I strongly recommend **Track 03: MSME Financial Health Card (Alternate Data)**. 

**Why Track 03?**
1. **Perfect for our Agentic Stack:** Parsing unstructured alternate data (GST PDFs, EPFO records, UPI transaction dumps) is incredibly difficult with traditional code, but trivial for Claude/Gemini on Vertex AI. We can build an ingestion agent, an analysis agent, and a decisioning agent.
2. **GCP Ecosystem:** We can leverage GCP Document AI for OCR, Cloud Run to host our microservices, and Vertex AI as the brain.
3. **High Impact:** The India Stack (AA, OCEN, ULI) is booming. Building a pipeline that converts raw alternate data into a clean, multidimensional health score will definitely impress the judges.

*Alternative:* **Track 01 (Conversational AI Wealth Advisory)** is also strong if we build an agentic RAG system on GCP, but the "Avatar Based" requirement might cost us precious time on frontend graphics instead of core AI logic.

### [Antigravity] - Date: 2026-07-02
**Message:** Successfully migrated the AI pipeline to the **NVIDIA AI Stack**, replacing Google Gemini and Vertex AI with the **Nemotron 3 Nano, Super, and Ultra** models via the **NVIDIA NIM API**. This true multi-model architecture is now optimized for maximum agentic capability and efficiency.

### [Antigravity] - Date: 2026-07-02 (Enterprise MVP Finalization)
**Message:** Just completed a massive "Godspeed" execution phase. The codebase has been fully hardened and pushed to [Amaan-cmd/IDBI-Artificer](https://github.com/Amaan-cmd/IDBI-Artificer).
Key updates:
1. **Cybersecurity Hardening**: Implemented `@google-cloud/secret-manager` to completely remove hardcoded API keys. Added `helmet`, `express-rate-limit`, and `express-mongo-sanitize` for DDoS mitigation and XSS/Injection defense.
2. **Strict Guardrails**: Enforced `temperature: 0.0` and explicit "Anti-Hallucination" prompt constraints across all Nemotron agents.
3. **UI/UX Brutalism & Glassmorphism**: Completely overhauled `index.css` and `App.jsx` to match the premium, immersive aesthetics of `enveraitech.com` and `devouringdetails.com` (Syne/DM Mono fonts, deep shadows, 60fps micro-animations).
4. **Firebase Access Control**: Integrated Google Sign-In tied to an `@enveraitech.com` ACL, keeping the `IDBI Innovate` credentials as a fallback.
5. **Real-World Scrapers**: The dashboard now accepts real `AgamiAI` datasets and live external API scraper payloads (MCA, Court records) that Agent 3 factors into the risk score.

**Status:** The User is now taking over to run penetration testing / cybersecurity flaw hunting in separate Antigravity windows and will deploy the system live to `enveraitech.in/IDBI`.

### [Antigravity] - Date: 2026-07-02 (SaaS Catalog Integration & enveraitech.com Redesign Context)
**Message:** Aligned on the future vision for the `enveraitech.com` homepage redesign. We will feature premium content showcasing our four primary SaaS offerings:
1. **Kariman**: Agentic medical response routing and emergency deployment platform.
2. **IDBI Artificer**: MSME Alternate-Data Financial Health Card and explainable underwriting engine.
3. **Arbiter**: Agentic cloud resource provisioning and Slack-based cost governance gatekeeper.
4. **Cerberus**: Multi-dimensional security auditor scanning for credential leaks, Git integrity, and endpoint health.
We will deploy the IDBI SaaS live to `enveraitech.in/IDBI` and set up telemetry logging to monitor its evaluations in real time.

---

## Enver AI Tech Frontend Design Guidelines

To ensure the new IDBI project (hosted on `enveraitech.in/IDBI`) matches the exact tone and visual language of `enveraitech.com`, **Codestral / Claude MUST adhere to the following design system** when building the frontend. Do not use generic tailwind defaults; replicate this custom aesthetic perfectly.

### 1. Typography (Google Fonts)
- **Primary Font (Headings & Body):** `Syne` (Weights: 400, 500, 600, 700, 800)
- **Monospace (Eyebrows & Tags):** `DM Mono` (Weights: 400, 500)
- **Accent/Handwriting:** `Caveat` (Variable weight)

### 2. Core Color Palette
- **Brand Colors:**
  - Navy: `#1B2B4B` (Used for primary buttons, heavy emphasis)
  - Orange: `#E8660A` (Used for accents, eyebrow text, warnings)
  - Green: `#3A9A3C` (Used for success states, live badges)
- **Surface & Backgrounds:**
  - Main Background: `#FAF6EF` (Warm, off-white cream tone)
  - Surface 1 (Cards): `#FFFFFF`
  - Surface 2 (Hover states, secondary bg): `#F4F4F2`
- **Text Colors:**
  - Primary Text: `#121212`
  - Muted Text: `#4a4a4a`
  - Subtle Text: `#7a7a7a`

### 3. Component Styling
- **Border Radius:** Very rounded, organic corners. `sm: 8px`, `md: 14px`, `lg: 24px`, `xl: 32px`.
- **Primary Buttons (`btn-primary`):** 
  - Background: Navy (`#1B2B4B`), Text: White. 
  - Font: `Syne`, 14px, semi-bold. Padding: `11px 24px`. Radius: `14px`.
  - Interaction: Hover state adds a deeper shadow and a subtle `-1px` Y-axis lift. Active state scales down to `0.98`.
- **Secondary Buttons (`btn-secondary`):**
  - Transparent background, `1px` solid dark border (`#121212`). Hover state changes background to `#F4F4F2` and lightens border.
- **Cards (`card`):**
  - White background (`#FFFFFF`), very thin border (`0.5px solid #121212`), large radius (`24px`).
  - Hover: Lift up `translateY(-2px)`, deep soft shadow `0 8px 32px rgba(0,0,0,0.06)`, and border thickens slightly.
- **Badges/Tags (`tag`, `badge`):**
  - Pill-shaped (`border-radius: 100px`).
  - Font: `DM Mono`, `11px`, Medium.
- **Section Headings:**
  - Use the "Eyebrow" pattern: Mono font (`DM Mono`), uppercase, letter-spacing `0.1em`, color `#E8660A`, preceded by a small horizontal line (`20px` width, `1.5px` height).
  - Main display text (Display 1/2/3) uses extremely tight letter spacing (e.g., `-2px`) and heavy weights (`700` or `800`) of `Syne`.

### 4. Layout & Interaction
- The overall look should be heavily architectural and modern—large typography, generous padding (`.section` is `padding: 6rem 0`), and clean dividers (`1px` height, dark border color).
- Incorporate subtle micro-interactions like `fadeUp` and `slideIn` for revealing components on scroll.

**Agent Action Required:** Please inject these exact CSS rules and Tailwind configurations into the new project's setup to match the dotcom tone.

---

## Ask Me Anything (AMA) with IDBI: Questions to Ask
*Here are critical questions we need to ask the IDBI team to ensure our MVP aligns with their production environment:*

1. **Alternate Data API Access:** Will we be provided with sandbox access to any Account Aggregator (AA) APIs, or should we rely entirely on our synthetic `AgamiAI` datasets for the final presentation?
2. **AWS Deployment:** We understand IDBI uses AWS. Does IDBI have a preferred LLM on Amazon Bedrock (e.g., Claude 3.5 Sonnet, Mistral, Llama 3) for processing PII data, or are there strict data residency laws we must account for?
3. **Explainability Standards:** We have built a "Forensic Audit Trail" into our AI. Are there specific regulatory compliance standards (like RBI guidelines on algorithmic lending) that our citations need to adhere to?
4. **Latency Requirements:** What is the maximum acceptable latency for the underwriting decision? A true multi-agent system takes a few seconds to run; is this acceptable for the Loan Officer Dashboard?

---

## AWS Architecture Alternatives (IDBI Cloud Mapping)
Since IDBI operates on AWS, we have mapped our current GCP-based architecture to AWS equivalents to prove production-readiness during the pitch:

| Current Architecture (GCP / Local) | AWS Production Alternative | Justification |
| :--- | :--- | :--- |
| **Node.js Express Backend** | **AWS Fargate (ECS)** | Serverless container execution, highly scalable for API workloads. |
| **React Frontend (Vite)** | **AWS Amplify / S3 + CloudFront** | Edge-optimized static site hosting for the Admin Portal. |
| **NVIDIA Nemotron 3 Nano (Ingestion)** | **Amazon Textract + NVIDIA NIM** | Textract is AWS's native OCR; NIM provides efficient Nemotron endpoints for extraction. |
| **NVIDIA Nemotron 3 Super/Ultra (Analytics)** | **NVIDIA NIM (Nemotron 3 Ultra)** | Nemotron Ultra is optimized for frontier-level logical reasoning and agentic workflows. |
| **Multer (Local File Storage)** | **Amazon S3** | Secure, temporary bucket storage for uploaded PDFs/CSVs before AI ingestion. |
| **Local JSON Memory** | **Amazon RDS (PostgreSQL)** | Persistent storage for generated Health Cards and Audit Trails. |

---

## 2026-09-24 Production Readiness & Cloud Deployment Update

### 1. Multi-Agent Fleet Expansion (Kahneman System 1 + System 2)
The pipeline has been upgraded to a 4-agent cognitive hierarchy:
1. **Fetcha (Agent 1):** Multi-modal tabular parser & live registry scraper (powered by Grok 4.6 Tools & Gemini Flash).
2. **JEV (System 1 Gatekeeper):** Reflexive heuristic sanity filter that verifies arithmetic balance continuity ($\text{Opening} + \text{Inflows} - \text{Outflows} \equiv \text{Closing}$), filters non-solvency NPCI NACH dishonor codes (09, 21, 55), and neutralizes adversarial prompt injections.
3. **Geek (Agent 2):** Quantitative 5-Pillar Telemetry Matrix (Liquidity, Revenue, Stability, Leverage, Operational Discipline).
4. **Orc (Agent 3):** Chief Credit Officer, continuous multi-pillar credit score synthesis (300-900), immutable forensic citations ledger, and conversational XAI drawer.

### 2. Underwriting Edge Cases Solved & Verified
- **Pixel-Tampered Statements:** JEV detects balance discontinuity $>1.5\%$ of turnover, and halts statements $>200\%$ as fabricated (`REJECTED_UNFIT`).
- **Auto-Sweep FDs:** Neutralized from operational turnover, recognized in liquid cash buffer.
- **Negative Ledger CC/OD Accounts:** Handled via sanctioned drawing power ($\text{Limit} - \text{Peak Utilization}$) to eliminate division-by-zero or negative runway.
- **Composition Scheme Dealers:** Auto-detected with `CMP-08` quarterly 1% turnover benchmark, suppressing false missing-GSTR penalties.
- **Adversarial Injections:** Blocked before LLM invocation by instant deterministic regex interceptors.

### 3. Automated Smoke Test Benchmark
Validated across 8 test cases via `npm run smoke-test` (`test_smoke_enterprises.js`):
- All 7 legitimate enterprises (Kariman Enterprises, Enver AI, Tata Motors, Surat Textile, Kalyan Agro, Composition Dealer, Auto-Sweep Account) generated distinct, non-colliding scores with 100% verified ledger balance parity.
- The adversarial prompt injection attack was neutralized immediately.

### 4. Single-Container Cloud Deployment
The app is now fully containerized via a production multi-stage `Dockerfile`:
- Builds frontend Vite React assets into `frontend/dist`.
- Node.js Express backend serves both static assets and API routes on port `8080`.
- 1-Click deployment to Google Cloud Run via `./deploy_gcloud.sh` or `deploy_gcloud.bat`.
- Zero-configuration local testing via `docker compose up --build`.

---

## 2026-10-14 Institutional Citadel Overhaul & Autonomous Multi-Agent Underwriting Handoff

### 1. Executive Summary & Design System Evolution
EnverAI Artificer has been promoted to the **Autonomous Underwriting Citadel**, engineered for institutional credit officers assessing New-to-Credit (NTC) MSMEs under the **RBI Digital Lending Master Direction 2026**.

- **Official Brand Identity:** Installed official `enver.ai` brand logo (`enver_logo.png`) across the Verification Gate, Auditor Sidebar, TopBar, and Cockpit.
- **Color Scheme & Luxury Palette:** Standardized on **Whitish, Silver Ash, and Light Cherry Pink**:
  - Primary Background: `#F8F9FB` with dynamic ambient WebGL2 `FloatingLines` in 60fps light mode.
  - Cards & Surfaces: `#FFFFFF` with `#E2E8F0` silver-ash borders and subtle `#FF8BA7`/`#F43F5E` cherry-pink glows.
  - Telemetry Accents: `#ACE1AF` (Celadon Green) for verified zero-hallucination ratios.
  - Buttons & CTAs: `linear-gradient(135deg, #FF8BA7 0%, #F43F5E 100%)`.

---

### 2. Core Architectural & Functional Pillars Delivered

#### A. Orc CCO Intelligence Terminal (`OrcTerminal.jsx` & `orcIntelligence.js`)
- **Signal Traffic-Light Window Dots Preserved:** Maintained the three prominent signal dots (`●` Red `#FF5F56`, `●` Yellow `#FFBD2E`, `●` Green `#27C93F`) on the titlebar with interactive actions.
- **Interactive Decision Interrogation (`Why was this decision taken?`):**
  - Loan officers can interrogate why an evaluation was approved, capped, or flagged.
  - Step-by-step mathematical attribution starting from benchmark-neutral 750 points across all 5 financial pillars.
  - Detailed explanations of points withheld (e.g., peak overdraft drawdowns, GSTR tax gaps, or inward bounce events).
  - Counterfactual sensitivity analysis detailing exact metric improvements required to reach Prime 850+.
  - Sanction limit rationale anchored to the 20% max EMI burden ratio against monthly credit inflows.
  - Dynamic enterprise context auto-recalibration across presets (Apex Precision 824, Surat Textiles 765, Kalyan Agro 610, Enver AI Tech 870, Tata Motors 895, Kariman Enterprises 790) and arbitrary probed GSTINs.

#### B. Split Workspace View (Stripe/Bloomberg Style Cockpit)
- **Independent Column Scrolling:**
  - Left Verdict Column: Docked and sticky, featuring the 300–900 institutional score dial, risk rating, sanction recommendation, instant executive decision actions (Approve, Conditional, Reject), and one-click Audit Dossier PDF export.
  - Right Evidence Column: Scrolls independently with sticky category tabs (`All Findings`, `P1 Liquidity`, `P2 Revenue`, `P3 Stability`, `P4 Leverage`, `P5 MCA/Forensics`, `Raw JSON`).
  - Completely eliminates bottom whitespace on desktop displays.

#### C. ScrollStack Audit Findings Deck (`ScrollStack.jsx`)
- Interactive stacking card deck in `NewEvaluationView` showcasing all 6 pillars in 3D layered cards with smooth scroll physics and zero layout shifts.

#### D. Institutional SecOps & Verification Gate (`VerificationGate.jsx`)
- **Client Login:** Username and password authentication with credential masking and lockout rate-limiting (`Andalaus` / `Citadel@296`).
- **Enterprise Hyperlink:** Embedded link directing new institutional underwriters to `https://enveraitech.com/signup`.
- **SSO Gateways:** Google Enterprise SSO and Microsoft Entra ID (`enveraitech.com` tenant `bda1a0ee-c558-4d13-a112-18b2d8d1deba`).
- **Email OTP Verification:** Sandbox OTP generation with inline demo code autofill for offline/demo compliance.
- **5-Minute Inactivity Sentinel:** Automatically locks the session after 300 seconds of inactivity to protect corporate financial privacy under RBI mandate.
- **Strict Input Sanitization:** Sanitization utilities (`sanitizeText`, `sanitizePassword`, `sanitizeEmail`, `sanitizeOtpDigits`, `isSafeInput`) prevent XSS, prototype pollution, and prompt injection attacks.

#### E. Saved Businesses & Watchlist Architecture (`WatchlistView.jsx`)
- Evaluations are persisted per user (`enver_user_evaluations_${userId}`) and synchronized with backend `/api/v1/history`.
- Grid of enterprise cards with risk badges, annualized turnover, cash buffer metrics, and instant actions (inspect in split workspace, generate PDF, or remove).

---

### 3. Five-Pillar Grounded Financial Telemetry

| Pillar | Metric / Ratio | Prime Benchmark | Score Attribution |
| :--- | :--- | :--- | :--- |
| **Pillar 1: Liquidity** | Cash Buffer Ratio & Runway | $\ge 0.25\times$ (15–25 Days) | $+40$ pts ($\ge 0.5\times$) down to $-50$ pts ($< 0.2\times$) |
| | Overdraft (OD) Headroom | $< 50\%$ drawn | $+25$ pts ($< 50\%$) down to $-45$ pts ($> 85\%$) |
| **Pillar 2: Revenue** | Annualized Revenue Run Rate | Momentum $\ge 5\%$ | $+30$ pts (expansionary) down to $-35$ pts (contracting) |
| | GSTR-1 to Bank Reconciliation | $0.90\times – 1.10\times$ | $+35$ pts ($\pm 10\%$) down to $-40$ pts ($> 20\%$) |
| | GSTR-3B Tax Gap | $\le 2.0\%$ unpaid | $+25$ pts ($\le 2\%$) down to $-45$ pts ($> 5\%$) |
| **Pillar 3: Stability** | Credit Coefficient of Variation (CV) | $< 0.30$ | $+25$ pts ($\le 0.20$) down to $-30$ pts ($> 0.40$) |
| | Inward Return Bounces | $0$ return events | $-60$ pts per inward dishonor return event |
| **Pillar 4: Leverage** | Debt Service Coverage Proxy (DSCP) | $\ge 1.75\times$ | $+35$ pts ($\ge 1.5\times$) down to $-60$ pts ($< 1.0\times$) |
| | Interest/EMI Burden Ratio | $\le 20.0\%$ of inflow | Caps incremental borrowing lines |
| **Pillar 5: Operational** | MCA21 Company Status | Active | $-150$ pts if struck-off, dormant, or non-active |
| | Director DIN & Litigation Hits | Clean DIN, 0 cases | $-40$ pts per court litigation hit |

---

### 4. Build, Deployment & Production Readiness

- **Production Build:** Verified with Vite v8.1.0 — compiled cleanly with code 0 (`npm --prefix frontend run build`).
- **Containerization:** Multi-stage `Dockerfile` serves static React assets and Express backend on port `8080`.
- **Azure Container Apps:** Deploys via `deploy_azure.bat` / `deploy_azure.sh` to resource group `rg-artificer` in `centralindia` under target domain `https://artificer.enveraitech.in/`.
- **Google Cloud Run:** 1-Click deploy via `deploy_gcloud.bat` / `deploy_gcloud.sh` (`enverai-artificer`).
- **Git Repository:** Synced with [Amaan-cmd/IDBI-Artificer](https://github.com/Amaan-cmd/IDBI-Artificer) on branch `main`.

