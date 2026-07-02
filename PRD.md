# Product Requirements Document (PRD)
**Project:** EnverAI Tech - MSME Financial Health Card (IDBI Hackathon Track 03)
**Target Users:** IDBI Loan Officers and Credit Underwriters

## 1. Product Overview
The MSME Financial Health Card is an Agentic AI underwriting engine designed to score "New-to-Credit" (NTC) MSMEs using alternative operational data (Bank Statements, GST Returns, UPI Ledgers) rather than traditional CIBIL scores.

## 2. Core Features

### 2.1 Dual-Input Processing
The engine must support two modes of input to allow for robust testing and hackathon judging:
- **File Upload Mode:** Directly ingest unstructured data (CSVs, JSONs) simulating Account Aggregator or raw bank statement dumps.
- **Manual Simulation Mode:** An integrated code editor allowing the admin to tweak arbitrary metrics (e.g., artificially inflating bounce rates) to see how the AI dynamically adjusts the score.

### 2.2 Explainable AI (XAI) & Audit Trail
To solve the "black box" problem of AI lending, the system must produce a **Forensic Audit Trail**.
- Every final score must be accompanied by a detailed `reasoning` narrative.
- Every metric and decision must include an array of `citations` linking directly back to the original data (e.g., extracting the exact line item where a cheque bounced).

### 2.3 True Multi-Model Architecture
The engine leverages specialized AI models for specialized tasks via the NVIDIA NIM API:
- **Data Ingestion:** Utilizing **NVIDIA Nemotron 3 Nano** for maximum efficiency in agentic tasks, parsing unstructured financial dumps into strict JSON schemas.
- **Analytics & Decisioning:** Utilizing **NVIDIA Nemotron 3 Super and Ultra** for frontier-level logical reasoning to compute ratios, synthesize the final XAI report, and act as the Chief Credit Officer.

## 3. Design System (EnverAI Dotcom)
The frontend application MUST strictly adhere to the EnverAI brand identity:
- **Typography:** `Syne` (Headings/Body), `DM Mono` (Eyebrows/Tags), `Caveat` (Accents).
- **Colors:** Navy (`#1B2B4B`), Orange (`#E8660A`), Green (`#3A9A3C`), Cream (`#FAF6EF`).
- **Aesthetic:** Modern architectural design, soft rounded cards (`24px` radius), and smooth micro-interactions (`fadeUp`).

## 4. MVP Success Criteria
- [x] Successfully parse a raw, unstructured CSV bank statement.
- [x] Successfully generate a dynamic health score based on extracted math (not keyword matching).
- [x] Output a fully transparent Audit Trail with citations.
- [x] Wrap the logic in a highly polished, branded UI for the IDBI judges.
