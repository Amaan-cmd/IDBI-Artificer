# EnverAI Artificer — Repository Guidelines & Architecture

## Overview
EnverAI Artificer is an institutional-grade, multi-agent alternate-data credit underwriting citadel designed for autonomous forensic analysis across statutory registry data, banking feeds, and GST statements.

## Tech Stack
- **Frontend**: React 18, Vite, Lucide Icons, Vanilla CSS (Tailwind utilities where applicable), Firebase Auth & Azure Static Web Apps.
  - Path: `frontend/`
  - Dev server: `npm --prefix frontend run dev` (Port 5173)
  - Production build: `npm --prefix frontend run build`
- **Backend**: Node.js, Express, Google Gemini / Vertex AI, Microsoft Azure AI Foundry Claude Opus 5.5, @azure/storage-blob.
  - Path: `backend/`
  - Server: `node backend/server.js` (Port 4000)
  - Core API Routes: `/api/v1/credit`, `/api/v1/chat`, `/api/v1/history`, `/api/v1/user`
- **AI / Cloud Infrastructure**:
  - Microsoft Azure AI Foundry (`enver-odyssey-resource`) for Claude (`claude-opus-5-5`)
  - Google Gemini 2.5 Flash / 3.5 Flash for multi-agent triad
  - Azure Storage (`artificer-records`) for forensic JSON audits

## Useful Commands
- `npm run dev`: Start frontend dev server
- `npm run dev:backend`: Start backend server
- `npm run build`: Build production frontend
- `npm run smoke-test`: Run enterprise smoke evaluation suite
- `npm run claude`: Launch Claude Code CLI session

