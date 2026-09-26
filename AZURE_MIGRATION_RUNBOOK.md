# EnverAI Artificer: Frontend Redesign Specification & Lovable-Inspired Design System

> **Document Type:** Master Frontend UI/UX Design System & Architectural Blueprint  
> **Aesthetic Inspiration:** [Lovable.dev](https://lovable.dev) (Ultra-Modern Glassmorphism, AI-Centric Cockpits, Micro-Interactions, Sleek Dark/Light Polish)  
> **Application:** EnverAI Artificer — Institutional MSME Alternate-Data Underwriting Citadel  
> **Target Audience:** Frontend Architects, Product Designers, Multi-Agent Fleet (Antigravity, Claude, Codestral)  
> **Status:** Approved for Implementation  

---

## 1. Executive Vision & Design Philosophy

### 1.1 The Challenge
Traditional financial underwriting dashboards are cluttered, intimidating, and static. They present walls of tabular data without clear visual hierarchy, intuitive cognitive pathways, or real-time feedback.

### 1.2 The Lovable-Inspired Paradigm
Inspired by **Lovable.dev**, the new **Artificer Frontend** transforms institutional risk assessment into a fluid, ambient, and delightful cockpit. It balances **enterprise-grade density and precision** with **consumer-grade elegance**:

1. **Ambient Glassmorphism & High-Depth Surfaces**: Layered translucent surfaces with backdrop blurs, delicate 1px border glows, and directional lighting that makes key risk metrics pop.
2. **AI-Native Real-Time Ergonomics**: The 3-tier cognitive agent pipeline (**Fetcha**, **Geek**, and **Orc**) is visibly alive. The interface showcases streaming thought states, pulsating agent node graphs, and real-time metric counter rolls.
3. **Single-Viewport Information Architecture**: 0 unnecessary vertical scrolling. The cockpit is organized into a modular Bento Grid with instant drawer drill-downs and floating action docks.
4. **Forensic Traceability**: Every metric connects to an immutable citation badge with interactive hover previews and audited source documents.

---

## 2. Lovable Design System (Tokens & Variables)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      COLOR PALETTE & SURFACE SYSTEM                     │
├─────────────────────────────────────────────────────────────────────────┤
│  Dark Base:     #080C14  (Obsidian Deep)                                │
│  Card Base:     #0E1422  (Navy Slate with 60% opacity backdrop blur)    │
│  Card Highlight:#182238  (Hover elevation & sub-cards)                  │
│  Borders:       rgba(255, 255, 255, 0.08) / rgba(99, 102, 241, 0.2)     │
│                                                                         │
│  AI Accents:                                                            │
│  • Primary / Violet:   #6366F1 (Indigo Glow)                            │
│  • Cyan / Telemetry:   #06B6D4 (Electric Cyan)                          │
│  • Agent Geek / Emerald:#10B981 (Quantitative Success)                  │
│  • Warning / Amber:    #F59E0B (Risk Flag)                              │
│  • High Risk / Crimson:#EF4444 (Discrepancy / Default Friction)         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Color Tokens

| Token Name | Value (Dark Theme) | Value (Light Theme) | Usage |
| :--- | :--- | :--- | :--- |
| `--bg-canvas` | `#080C14` | `#F8FAFC` | Main application background |
| `--surface-glass` | `rgba(14, 20, 34, 0.65)` | `rgba(255, 255, 255, 0.8)` | Bento cards with `backdrop-filter: blur(16px)` |
| `--surface-elevated` | `rgba(24, 34, 56, 0.85)` | `rgba(255, 255, 255, 0.95)` | Modals, active states, popovers |
| `--border-subtle` | `rgba(255, 255, 255, 0.08)` | `rgba(0, 0, 0, 0.06)` | Standard card boundary |
| `--border-glow` | `rgba(99, 102, 241, 0.35)` | `rgba(99, 102, 241, 0.25)` | Focused inputs, agent thinking cards, hover glow |
| `--accent-primary` | `#6366F1` (Indigo) | `#4F46E5` | Primary buttons, active tabs, citadel score accent |
| `--accent-cyan` | `#06B6D4` (Electric Cyan)| `#0891B2` | Live scrapers, SSE telemetry, AA bank feeds |
| `--accent-emerald` | `#10B981` (Mint Glow) | `#059669` | Low risk tier, verified citations, healthy margins |
| `--accent-amber` | `#F59E0B` (Amber) | `#D97706` | Medium risk, NACH bounces, GST discrepancies |
| `--accent-rose` | `#EF4444` (Neon Rose) | `#DC2626` | High risk, court litigation alerts, debt stress |
| `--text-primary` | `#F9FAFB` | `#0F172A` | Primary headers, scores, key metrics |
| `--text-secondary` | `#94A3B8` | `#64748B` | Metric labels, sub-captions, timestamps |
| `--text-muted` | `#64748B` | `#94A3B8` | Helper text, disabled states, watermarks |

### 2.2 Typography Hierarchy

- **Header / Brand Font:** `Outfit`, `Plus Jakarta Sans`, or `Space Grotesk` (Geometric, punchy, modern).
- **Body & UI Font:** `Inter`, system-ui (Ultra-legible at small sizes).
- **Tabular & Code Font:** `JetBrains Mono` (Financial figures, GSTINs, Bank Account Numbers, JSON citations, timestamps).

```css
/* Typography Scale */
--text-xs:   0.75rem;   /* 12px - Badges, timestamps, citation tags */
--text-sm:   0.875rem;  /* 14px - Body text, metric labels */
--text-base: 1.0rem;    /* 16px - Standard interactive controls */
--text-lg:   1.125rem;  /* 18px - Section subheads */
--text-xl:   1.25rem;   /* 20px - Card titles */
--text-2xl:  1.5rem;    /* 24px - Module headers */
--text-4xl:  2.25rem;   /* 36px - Citadel Score Value */
--text-5xl:  3.0rem;    /* 48px - Primary KPI display */
```

### 2.3 Motion & Interaction Physics (Lovable Micro-Interactions)
- **Transitions:** `transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1)` (Snappy spring easing).
- **Hover Elevation:** Cards lift slightly (`transform: translateY(-2px)`) with subtle gradient border illumination.
- **Pulse Glows:** Live AI agents feature rhythmic multi-layer radial pulsing animations (`@keyframes agent-pulse`).
- **CountUp:** Numerical metrics (Citadel Score, Cash Buffer Ratio, ARR, Debt Limit) dynamically roll from zero to final value upon agent completion.
- **Glass Shimmer:** Skeleton loaders and running pipelines feature animated chromatic glass shimmers.

---

## 3. Component Hierarchy & Layout Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                           TOP FLOATING NAVBAR                                           │
│  [✦ EnverAI Artificer]       [Station: Ingestion | Underwriting | Master]        [SecOps: 04:52] [User] │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                        │
│  ┌────────────────────────────────────────────────┐  ┌──────────────────────────────────────────────┐  │
│  │           MULTI-SOURCE INGESTION DOCK          │  │       3-AGENT LIVE REASONING PIPELINE        │  │
│  │  [PDF/CSV Dropzone] [GSTN Live] [MCA21 Scraper]│  │  [✦ Fetcha: Ingest] ──> [✦ Geek: Telemetry]  │  │
│  │  [Account Aggregator API payload toggle]       │  │             └──> [✦ Orc: CCO Citadel]         │  │
│  └────────────────────────────────────────────────┘  └──────────────────────────────────────────────┘  │
│                                                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                                 BENTO UNDERWRITING GRID                                          │  │
│  │  ┌─────────────────────────┐  ┌───────────────────────────┐  ┌────────────────────────────────┐  │  │
│  │  │  CITADEL SCORE GAUGE    │  │ EXECUTIVE CCO NARRATIVE   │  │ 5-PILLAR RADAR & BENCHMARK     │  │  │
│  │  │     782 / 900           │  │ Directives, Risk Summary, │  │ Cash Flow | GST | Bureau       │  │  │
│  │  │     [LOW RISK]          │  │ Recommendations           │  │ Legal Risk | Operational ARR   │  │  │
│  │  └─────────────────────────┘  └───────────────────────────┘  └────────────────────────────────┘  │  │
│  │  ┌──────────────────────────────────────────────┐  ┌──────────────────────────────────────────┐  │  │
│  │  │ GEEK QUANTITATIVE TELEMETRY MATRIX           │  │ FORENSIC CITATION LEDGER                 │  │  │
│  │  │ • Cash Buffer: 0.28x   • ARR: ₹4.82 Cr       │  │ [Ref #1 Bank Stmt Page 3, Line 14]       │  │  │
│  │  │ • GST Gap: 1.2%        • Bounce Count: 0     │  │ [Ref #2 GSTR-3B Tax Challan Oct 2025]    │  │  │
│  │  │ • Max Debt Cap: ₹45.0L • Inward NACH: Clean  │  │ [Ref #3 MCA21 Director DIN Status Clear] │  │  │
│  │  └──────────────────────────────────────────────┘  └──────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                        │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  [⚡ Floating Action Bar: Download PDF Report | Re-Run Simulation | Open Conversational Underwriter]   │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Key Functional Modules & Screen Breakdown

### 4.1 Floating Glass Header (`PillNav` & `SecOpsBar`)
- **Left:** EnverAI Artificer Citadel logo with dynamic glowing spark indicator.
- **Center:** Segmented Pill Switcher (`Ingestion Station`, `Underwriting Cockpit`, `Master Audit Admin`).
- **Right:** 
  - **Inactivity Sentinel Badge:** Real-time countdown timer (300s institutional lock threshold) with interactive refresh.
  - **Environment / Network Badge:** `Azure Container App [Active]` or `GCP Live`.
  - **User Profile Capsule:** Google SSO badge with one-click secure sign-out.

### 4.2 Multi-Modal Ingestion Dock
- **Drag-and-Drop Holographic Zone:** Supports Bank Statements (PDF/CSV), GST Returns (JSON/PDF), and Balance Sheets.
- **Direct Live Connectors:**
  - **GSTN Sandbox API:** Enter 15-digit GSTIN $\rightarrow$ one-click pull of GSTR-1 & GSTR-3B filed turnover.
  - **Sahamati Account Aggregator (AA):** Ingest structured consent-based banking telemetry.
  - **Live Scraper Engine (`scraperService`):** One-click toggle for real-time MCA21 status, director active DIN tracking, and NCLT/e-Courts litigation crawlers.
- **Sample Persona Quick-Loader:** 1-click test personas (*Clean MSME Tech*, *Stressed Auto Ancillary*, *High Bounce Retailer*, *Fraudulent Circular Trading*).

### 4.3 3-Agent Real-Time Cognitive Pipeline Stream
- **Interactive Agent Pipeline Bar:**
  1. **Agent 1 (Fetcha - Ingestion & OCR):** Live status badge, extracted line items count, tabular sanitization logs.
  2. **Agent 2 (Geek - Quantitative Matrix):** Ratio calculations stream, Cash Buffer computation, bounce friction parser.
  3. **Agent 3 (Orc - Master Underwriter & CCO):** Credit synthesis, policy rules check, citation ledger generation.
- **Real-Time Stream Terminal:** Collapsible slide-down terminal showing live Server-Sent Events (SSE) reasoning tokens.

### 4.4 Bento Analytics Dashboard (The Underwriting Cockpit)

#### Bento Cell 1: Citadel Score Radial & Risk Tier
- Radial circular SVG gauge with dynamic gradient fill (`#10B981` for Low Risk, `#F59E0B` for Medium Risk, `#EF4444` for High Risk).
- Animated **CountUp** score (`300` to `900`).
- Prime Risk Pill: `PRIME / LOW RISK` with ambient neon backdrop glow.
- Recommended Credit Limit & Maximum Monthly EMI capacity badges.

#### Bento Cell 2: Geek Quantitative Telemetry Matrix
- **Cash Buffer Ratio:** Gauge showing monthly closing balances vs monthly debits (with $>0.15\text{x}$ benchmark marker).
- **Annualized Run Rate (ARR):** High-precision currency display in INR (Lakhs/Crores).
- **Tax Discrepancy %:** Visual comparison of GSTR-1 (Outward taxable sales) vs GSTR-3B (Taxes paid) with fraud flag thresholds.
- **NACH / Cheque Bounce Friction:** Number of inward/outward dishonors with friction impact score.

#### Bento Cell 3: Executive Underwriting Narrative (Orc CCO Verdict)
- Executive summary formatted in high-readability typography.
- Strengths & Primary Vulnerabilities bullet points.
- Key Risk Mitigants & Recommended Sanction Conditions.

#### Bento Cell 4: 5-Pillar Credit Radar & Risk Distribution
- Five-pillar normalized radar/bar visual:
  1. *Liquidity & Cash Buffer*
  2. *Turnover & Revenue Resilience*
  3. *Tax & Regulatory Compliance*
  4. *Banking Discipline & Bounce History*
  5. *Legal Standing & Corporate Governance*

#### Bento Cell 5: Forensic Citations & Evidence Ledger
- Expandable line-item audit table.
- Each citation displays: `Source Document`, `Page / Row Ref`, `Extracted Fact`, `Audit Verification Hash`.
- Hovering shows original snippet preview; clicking copies verified forensic reference.

### 4.5 Conversational Underwriting Drawer ("Chat with Orc CCO")
- Slide-out glass drawer on the right side of the screen (`width: 440px`).
- Connected to `POST /api/v1/chat/xai`.
- **Zero-Greeting, Fact-Grounded Underwriting Agent:** Immediate answers to loan officer questions (*"Why was the score penalized?", "Show all inward bounces in Q2", "What is the circular trading risk?"*).
- Interactive quick prompt chips:
  - *"Verify GST vs Bank turnover match"*
  - *"Break down cash buffer calculation"*
  - *"Check director litigation records"*
  - *"Draft sanction letter conditions"*

### 4.6 Master Admin & SecOps Cockpit (`MasterDashboard.jsx`)
- Executive overview for Chief Risk Officers (CRO) and DevOps:
  - Total Underwritten Volume & Applications Pipeline.
  - Multi-Agent Latency & Token Usage (Gemini 2.5 Flash / Pro & NVIDIA NIM).
  - Live SecOps Activity Log (Google SSO domain attempts, IP geolocation, Slack notification webhooks).
  - Tenant Management & API Rate Limits.

---

## 5. Lovable-Style Component Implementation Blueprint

### 5.1 Glass Card Base (`GlassCard.jsx`)
```jsx
// Base reusable container with ambient glow and border reflections
export const GlassCard = ({ children, className = '', glowColor = 'indigo', hover = true }) => {
  const glowStyles = {
    indigo: 'hover:border-indigo-500/40 hover:shadow-[0_0_25px_-5px_rgba(99,102,241,0.25)]',
    cyan: 'hover:border-cyan-500/40 hover:shadow-[0_0_25px_-5px_rgba(6,182,212,0.25)]',
    emerald: 'hover:border-emerald-500/40 hover:shadow-[0_0_25px_-5px_rgba(16,185,129,0.25)]',
  };

  return (
    <div className={`
      relative rounded-2xl bg-[#0E1422]/70 backdrop-blur-xl
      border border-white/[0.08] p-5 text-slate-100
      transition-all duration-300 ease-out
      ${hover ? `hover:-translate-y-0.5 ${glowStyles[glowColor] || glowStyles.indigo}` : ''}
      ${className}
    `}>
      {children}
    </div>
  );
};
```

### 5.2 Agent Pipeline Node (`AgentNode.jsx`)
```jsx
// Real-time agent status indicator with pulsating concentric rings
export const AgentNode = ({ name, role, status, model, isStreaming }) => {
  const statusColors = {
    idle: 'bg-slate-700 text-slate-400 border-slate-600',
    running: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/60 shadow-[0_0_15px_rgba(99,102,241,0.4)]',
    completed: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60',
    error: 'bg-rose-500/20 text-rose-300 border-rose-500/60',
  };

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border backdrop-blur-md transition-all ${statusColors[status]}`}>
      <div className="relative flex items-center justify-center">
        <span className={`h-2.5 w-2.5 rounded-full ${status === 'running' ? 'bg-indigo-400 animate-ping' : status === 'completed' ? 'bg-emerald-400' : 'bg-slate-500'}`} />
        <span className={`absolute h-2 w-2 rounded-full ${status === 'running' ? 'bg-indigo-400' : status === 'completed' ? 'bg-emerald-400' : 'bg-slate-500'}`} />
      </div>
      <div>
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-xs tracking-wider uppercase">{name}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-slate-300 font-mono">{model}</span>
        </div>
        <div className="text-[11px] text-slate-400">{role}</div>
      </div>
    </div>
  );
};
```

---

## 6. Frontend Tech Stack & Optimization Checklist

1. **Framework:** React 18 + Vite (ESBuild / Rollup for lightning-fast HMR and bundle splitting).
2. **Styling & Design System:**
   - Modern Tailwind CSS + Custom CSS Variables in `index.css`.
   - Backdrop filters with hardware acceleration (`backdrop-blur-md`, `will-change-transform`).
3. **Icons & Visuals:**
   - `lucide-react` for crisp 24px/16px icons.
   - Canvas-based visual effects (`GhostFibers`, `Threads`, `MagnetLines`) for background depth without CPU overhead.
4. **State Management & Streaming:**
   - Native `EventSource` (SSE) stream listener for real-time agent token rendering.
   - Lightweight Context for Authentication, Active Session, and Ingestion Payloads.
5. **Print & PDF Generation:**
   - Standardized institutional printable layout with clean page-break formatting for loan committee sanction packs.

---

## 7. Migration & Rollout Timeline

| Phase | Milestone | Deliverables |
| :--- | :--- | :--- |
| **Phase 1** | **Design System & Tokens** | Global CSS custom properties, glass card components, typography rules, color tokens in `index.css`. |
| **Phase 2** | **Ingestion Station Redesign** | Modern drag-and-drop dock, live GSTIN search field, MCA21 scraper toggle, quick test personas. |
| **Phase 3** | **Real-Time Agent Stream UI** | Visual 3-node agent workflow bar, streaming thought terminal, CountUp metric animations. |
| **Phase 4** | **Bento Analytics Cockpit** | Citadel Score gauge, Geek Quantitative Matrix, 5-Pillar Credit Radar, Forensic Citations Ledger. |
| **Phase 5** | **Conversational XAI Drawer** | Zero-greeting Orc CCO chat drawer with prompt suggestion pills and copyable citations. |
| **Phase 6** | **Master Admin & Polish** | SecOps telemetry, tenant economics, 5-minute inactivity lock, responsive test pass. |

---

*Authored by EnverAI Artificer Design & Engineering Team*  
*Lovable-Inspired Design Specification — Institutional MSME Credit Engine*
