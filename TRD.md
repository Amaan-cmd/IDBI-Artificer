# Technical Requirements Document (TRD)
**Project:** EnverAI Tech - MSME Financial Health Card (IDBI Hackathon Track 03)

## 1. System Architecture

The MVP is built on a modern, decoupled React/Node stack, supercharged by a True Multi-Model Agentic pipeline.

```mermaid
graph TD
    %% Define styles for Brutalist EnverAI Theme
    classDef client fill:#FAF6EF,stroke:#1B2B4B,stroke-width:2px,color:#1B2B4B,font-weight:bold,shape:rect
    classDef api fill:#e6e6e6,stroke:#1B2B4B,stroke-width:2px,color:#121212,font-weight:bold,shape:rect
    classDef ai fill:#1B2B4B,stroke:#1B2B4B,stroke-width:2px,color:#FFFFFF,font-weight:bold,shape:rect
    classDef data fill:#ffffff,stroke:#E8660A,stroke-width:2px,stroke-dasharray: 5 5,color:#E8660A,font-weight:bold

    subgraph Frontend Layer
        UI[React UI - Admin Portal]:::client
    end

    subgraph Backend Layer (Node.js)
        API[Express API /api/v1/evaluate]:::api
    end

    subgraph True Multi-Model AI Engine
        Ingest[Agent 1: Ingestion<br>NVIDIA Nemotron 3 Nano]:::ai
        Analyze[Agent 2: Analysis<br>NVIDIA Nemotron 3 Super]:::ai
        Synth[Agent 3: Synthesis<br>NVIDIA Nemotron 3 Ultra]:::ai
    end

    subgraph Data Sources
        AA[(Unstructured File/CSV)]:::data
        Manual[(Structured JSON)]:::data
    end

    AA --> UI
    Manual --> UI
    UI -->|Multipart/JSON Payload| API
    API --> Ingest
    Ingest -->|Cleansed JSON| Analyze
    Analyze -->|Ratios & Citations| Synth
    Synth -->|Final XAI Report| API
    API -->|Audit Trail Display| UI
```

## 2. Technical Stack
- **Frontend:** React + Vite, customized CSS utilizing EnverAI design tokens (`Syne`, `#1B2B4B`).
- **Backend:** Node.js + Express.
- **Middleware:** `multer` (for handling in-memory `multipart/form-data` uploads).
- **AI Integration (NVIDIA NIM):** `openai` Node.js SDK configured for `build.nvidia.com` endpoint utilizing the Nemotron family of models (Nano, Super, Ultra).
- **Authentication:** Standard Bearer token via `NVIDIA_API_KEY` environment variable.

## 3. API Schemas & Explainable AI (XAI)

To satisfy the Explainable AI requirement, the Agent pipelines adhere to strict JSON response schemas heavily leveraging `reasoning` and `citations`.

### 3.1 Agent 2: Analysis Schema
```typescript
interface AnalysisOutput {
  revenueRunRate: number;
  cashBufferRatio: number;
  isCashFlowStable: boolean;
  hasBounces: boolean;
  taxCompliance: "Excellent" | "Average" | "Poor";
  reasoning: string; // Forensic justification of the ratios
  citations: string[]; // Explicit line-item references from the ingested data
}
```

### 3.2 Agent 3: Synthesis Schema
```typescript
interface SynthesisOutput {
  score: number; // 300 - 900
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  narrative: string; // Executive summary
  reasoning: string; // Granular breakdown of why this score was applied
  citations: string[]; // e.g. ["Risk elevated due to inwardBounces > 0"]
}
```

## 4. Execution Flow
1. Admin selects a file or enters manual JSON in the React Dashboard.
2. Frontend posts to `http://localhost:4000/api/v1/evaluate`.
3. `server.js` parses the payload (file or body text) and calls the `creditController`.
4. The controller sequentially executes `ingestionAgent` -> `analysisAgent` -> `synthesisAgent`.
5. The final merged payload (Data + Ratios + Decision + Citations) is returned to the UI.
6. The UI conditionally renders the Forensic Audit Trail.
