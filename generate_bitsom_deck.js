const pptxgen = require('pptxgenjs');

async function createDeck() {
  const pptx = new pptxgen();

  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'Enver AI Tech';
  pptx.company = 'Enver AI Tech';
  pptx.title = 'EnverAI Artificer - BITSoM Vertex Pitch Deck 2026';

  // EnverAI Palette Tokens
  const NAVY = '1B2B4B';
  const ORANGE = 'E8660A';
  const GREEN = '3A9A3C';
  const CREAM = 'FAF6EF';
  const WHITE = 'FFFFFF';
  const DARK = '121212';
  const MUTED = '555555';
  const CARD_BG = 'FFFFFF';
  const BORDER = 'E0DCD3';

  // Helper function to add standard slide headers
  function addSlideHeader(slide, title, category = "BITSoM vertex | H2S • Builders Pitch Fest 2026") {
    slide.background = { color: CREAM };
    
    // Top Eyebrow / Tagline
    slide.addText(category.toUpperCase(), {
      x: 0.8, y: 0.4, w: 10, h: 0.3,
      fontSize: 10, fontFace: 'Arial', color: ORANGE, bold: true, letterSpacing: 1.5
    });

    // Main Slide Title
    slide.addText(title, {
      x: 0.8, y: 0.7, w: 11, h: 0.6,
      fontSize: 22, fontFace: 'Arial', color: NAVY, bold: true
    });

    // Top border line
    slide.addShape(pptx.ShapeType.line, {
      x: 0.8, y: 1.35, w: 11.7, h: 0,
      line: { color: BORDER, width: 1 }
    });
  }

  // ==================== SLIDE 1: Cover ====================
  const slide1 = pptx.addSlide();
  slide1.background = { color: NAVY };

  slide1.addText("BITSoM vertex | H2S", {
    x: 1.0, y: 1.2, w: 8.0, h: 0.4,
    fontSize: 14, fontFace: 'Arial', color: ORANGE, bold: true
  });

  slide1.addText("Builders Pitch Fest 2026", {
    x: 1.0, y: 1.7, w: 10.0, h: 0.5,
    fontSize: 18, fontFace: 'Arial', color: 'A0B2D6', bold: true
  });

  slide1.addText("EnverAI Artificer", {
    x: 1.0, y: 2.5, w: 11.0, h: 1.2,
    fontSize: 44, fontFace: 'Arial', color: WHITE, bold: true
  });

  slide1.addText("Autonomous MSME Credit Intelligence & Alternate-Data Underwriting Engine", {
    x: 1.0, y: 3.8, w: 11.0, h: 0.8,
    fontSize: 20, fontFace: 'Arial', color: ORANGE, bold: true
  });

  slide1.addText("Sashing MSME loan evaluation turnaround from 5 days to under 55 seconds with Google Gemini Multi-Agent XAI.", {
    x: 1.0, y: 4.8, w: 10.5, h: 0.8,
    fontSize: 14, fontFace: 'Arial', color: 'D5E0F2', italic: true
  });

  slide1.addText("Team: Enver AI Tech • Contact: daddy@enveraitech.com • enveraitech.com", {
    x: 1.0, y: 6.2, w: 11.0, h: 0.4,
    fontSize: 11, fontFace: 'Arial', color: '8EA3C7'
  });

  // ==================== SLIDE 2: Important Guidelines Alignment ====================
  const slide2 = pptx.addSlide();
  addSlideHeader(slide2, "Context & Submission Alignment", "Submission Context");

  slide2.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y: 1.6, w: 11.7, h: 5.0,
    fill: { color: CARD_BG }, line: { color: BORDER, width: 1 }, rectRadius: 0.15
  });

  slide2.addText("BITSoM Vertex Evaluation Standard", {
    x: 1.2, y: 1.9, w: 10.5, h: 0.4,
    fontSize: 16, fontFace: 'Arial', color: NAVY, bold: true
  });

  slide2.addText("This submission is structured specifically to present EnverAI Artificer across product depth, technology innovation, business viability, and enterprise readiness:", {
    x: 1.2, y: 2.3, w: 10.5, h: 0.5,
    fontSize: 12, fontFace: 'Arial', color: MUTED
  });

  const guidelinesBullets = [
    { text: "Validated Customer Problem: Addressing the $350B+ MSME credit gap for 63M+ Indian enterprises.", options: { bold: true, color: NAVY } },
    { text: "Meaningful Application of AI: True 3-stage Google Cloud Agentic Pipeline (Gemini 2.5 Flash & Pro) with zero-hallucination guardrails.", options: { color: DARK } },
    { text: "Technical Depth: Decoupled enterprise architecture with deterministic mathematical ratio verification & line-item forensic citations.", options: { color: DARK } },
    { text: "Product Maturity & Traction: Validated across 1,000+ real-world Indian bank statement records with 100% extraction accuracy.", options: { color: DARK } },
    { text: "Sustainable Business Model: High-margin B2B SaaS per-evaluation API pricing ($0.50-$2.00/call) saving banks ₹4,000+ per loan inquiry.", options: { color: DARK } }
  ];

  slide2.addText(guidelinesBullets, {
    x: 1.2, y: 2.9, w: 10.5, h: 3.4,
    fontSize: 12, fontFace: 'Arial', bullet: { type: 'bullet', code: '25AA' }, lineSpacing: 24
  });

  // ==================== SLIDE 3: Startup Snapshot ====================
  const slide3 = pptx.addSlide();
  addSlideHeader(slide3, "Startup Snapshot");

  // Box 1: What we do
  slide3.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y: 1.6, w: 5.7, h: 5.0,
    fill: { color: CARD_BG }, line: { color: BORDER, width: 1 }, rectRadius: 0.15
  });
  slide3.addText("1. WHAT DOES YOUR STARTUP DO?", {
    x: 1.1, y: 1.9, w: 5.1, h: 0.35,
    fontSize: 12, fontFace: 'Arial', color: ORANGE, bold: true
  });
  slide3.addText("Autonomous MSME Credit Underwriting Engine", {
    x: 1.1, y: 2.3, w: 5.1, h: 0.5,
    fontSize: 16, fontFace: 'Arial', color: NAVY, bold: true
  });
  slide3.addText("EnverAI Artificer is an intelligent agentic platform that autonomously evaluates New-to-Credit (NTC) MSMEs using alternative operational data (Bank statements, GST returns, UPI transaction dumps, and public MCA/court litigations).\n\nIt generates an instant, verifiable MSME Financial Health Card (Score: 300-900, Risk Tier, and Forensic Line-Item Audit Trail) in under 55 seconds, eliminating manual underwriting friction for commercial banks and NBFCs.", {
    x: 1.1, y: 2.9, w: 5.1, h: 3.4,
    fontSize: 11, fontFace: 'Arial', color: DARK, lineSpacing: 20
  });

  // Box 2: Milestone
  slide3.addShape(pptx.ShapeType.roundRect, {
    x: 6.8, y: 1.6, w: 5.7, h: 5.0,
    fill: { color: CARD_BG }, line: { color: BORDER, width: 1 }, rectRadius: 0.15
  });
  slide3.addText("2. WHAT MILESTONE REPRESENTS PROGRESS?", {
    x: 7.1, y: 1.9, w: 5.1, h: 0.35,
    fontSize: 12, fontFace: 'Arial', color: GREEN, bold: true
  });
  slide3.addText("Validated Multi-Agent Benchmark & Live SaaS", {
    x: 7.1, y: 2.3, w: 5.1, h: 0.5,
    fontSize: 16, fontFace: 'Arial', color: NAVY, bold: true
  });
  slide3.addText("• 3-Agent Google Gemini Pipeline: Built & validated using Gemini 2.5 Flash (Ingestion) and Gemini 2.5 Pro (Analytics & Synthesis).\n\n• 1,000+ Indian Financial Datasets Processed: Benchmark tested on real Indian bank statements and GST filings from the AgamiAI open dataset with 100% extraction accuracy.\n\n• Production-Ready Web Portal: Live explainable dashboard with Server-Sent Events (SSE) streaming, biometric telemetry, and instant XAI audit trail generation.", {
    x: 7.1, y: 2.9, w: 5.1, h: 3.4,
    fontSize: 11, fontFace: 'Arial', color: DARK, lineSpacing: 20
  });

  // ==================== SLIDE 4: Problem Understanding ====================
  const slide4 = pptx.addSlide();
  addSlideHeader(slide4, "Problem Understanding: The $350B+ MSME Credit Void");

  slide4.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y: 1.6, w: 5.7, h: 5.0,
    fill: { color: CARD_BG }, line: { color: BORDER, width: 1 }, rectRadius: 0.15
  });
  slide4.addText("1. THE ACUTE PROBLEM", {
    x: 1.1, y: 1.9, w: 5.1, h: 0.35,
    fontSize: 12, fontFace: 'Arial', color: ORANGE, bold: true
  });
  slide4.addText("Legacy CIBIL Models Exclude NTC MSMEs", {
    x: 1.1, y: 2.3, w: 5.1, h: 0.5,
    fontSize: 15, fontFace: 'Arial', color: NAVY, bold: true
  });
  slide4.addText("• 85%+ Rejection Rate for NTC MSMEs: Over 63M MSMEs drive 30% of India's GDP, but lack legacy credit bureau repayment histories.\n\n• 3-5 Days Underwriting Latency: Credit officers manually verify hundreds of pages of bank PDFs and GST returns.\n\n• High Unit Economics: Manual processing costs ₹3,000 - ₹5,000 per application, making small-ticket MSME loans economically unviable for banks.", {
    x: 1.1, y: 2.9, w: 5.1, h: 3.4,
    fontSize: 11, fontFace: 'Arial', color: DARK, lineSpacing: 18
  });

  slide4.addShape(pptx.ShapeType.roundRect, {
    x: 6.8, y: 1.6, w: 5.7, h: 5.0,
    fill: { color: CARD_BG }, line: { color: BORDER, width: 1 }, rectRadius: 0.15
  });
  slide4.addText("2. EVIDENCE & MARKET VALIDATION", {
    x: 7.1, y: 1.9, w: 5.1, h: 0.35,
    fontSize: 12, fontFace: 'Arial', color: GREEN, bold: true
  });
  slide4.addText("India Stack Boom Meets Cognitive Deficit", {
    x: 7.1, y: 2.3, w: 5.1, h: 0.5,
    fontSize: 15, fontFace: 'Arial', color: NAVY, bold: true
  });
  slide4.addText("• $350B+ Addressable Credit Gap: Documented by RBI and IFC research reports across Indian micro and small businesses.\n\n• Data Rich, Intelligence Poor: With Account Aggregator (AA / Sahamati), GSTN, and ULI, data is accessible via API, but banks lack automated cognitive engines to synthesize and audit it.\n\n• Black Box Regulatory Barrier: Banks cannot deploy opaque AI models; RBI mandates fully explainable and auditable lending decisions.", {
    x: 7.1, y: 2.9, w: 5.1, h: 3.4,
    fontSize: 11, fontFace: 'Arial', color: DARK, lineSpacing: 18
  });

  // ==================== SLIDE 5: Customer & Market ====================
  const slide5 = pptx.addSlide();
  addSlideHeader(slide5, "Target Customer & Market Opportunity");

  slide5.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y: 1.6, w: 5.7, h: 5.0,
    fill: { color: CARD_BG }, line: { color: BORDER, width: 1 }, rectRadius: 0.15
  });
  slide5.addText("1. IDEAL CUSTOMER & BUYERS", {
    x: 1.1, y: 1.9, w: 5.1, h: 0.35,
    fontSize: 12, fontFace: 'Arial', color: ORANGE, bold: true
  });
  slide5.addText("Institutional Lenders & Digital Platforms", {
    x: 1.1, y: 2.3, w: 5.1, h: 0.5,
    fontSize: 15, fontFace: 'Arial', color: NAVY, bold: true
  });
  slide5.addText("• Target Institutions: Public/Private Commercial Banks, Small Finance Banks (SFBs), NBFCs, and OCEN-enabled Digital Lending Platforms.\n\n• Economic Buyers: Chief Risk Officers (CRO), Chief Credit Officers (CCO), Heads of MSME Lending, and Digital Transformation Executives.\n\n• User Personas: Credit Underwriters, Risk Managers, and Branch Loan Officers.", {
    x: 1.1, y: 2.9, w: 5.1, h: 3.4,
    fontSize: 11, fontFace: 'Arial', color: DARK, lineSpacing: 18
  });

  slide5.addShape(pptx.ShapeType.roundRect, {
    x: 6.8, y: 1.6, w: 5.7, h: 5.0,
    fill: { color: CARD_BG }, line: { color: BORDER, width: 1 }, rectRadius: 0.15
  });
  slide5.addText("2. MARKET SIZING (TAM / SAM / SOM)", {
    x: 7.1, y: 1.9, w: 5.1, h: 0.35,
    fontSize: 12, fontFace: 'Arial', color: GREEN, bold: true
  });
  slide5.addText("$12B+ Addressable Underwriting Tech TAM", {
    x: 7.1, y: 2.3, w: 5.1, h: 0.5,
    fontSize: 15, fontFace: 'Arial', color: NAVY, bold: true
  });
  slide5.addText("• TAM ($530 Billion): Total Indian MSME commercial credit market.\n\n• SAM ($12 Billion): Indian automated credit intelligence & alternate-data ingestion market across commercial banks & NBFCs.\n\n• SOM ($250 Million ARR): Capturing 5% of digital MSME loan origination volume across Tier-1/Tier-2 Indian banks & SFBs within 4 years.", {
    x: 7.1, y: 2.9, w: 5.1, h: 3.4,
    fontSize: 11, fontFace: 'Arial', color: DARK, lineSpacing: 18
  });

  // ==================== SLIDE 6: Solution Overview ====================
  const slide6 = pptx.addSlide();
  addSlideHeader(slide6, "Solution Overview: The EnverAI Artificer Engine");

  // 3 columns for capabilities
  const colW = 3.65;
  const colGap = 0.38;

  slide6.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y: 1.6, w: colW, h: 5.0,
    fill: { color: CARD_BG }, line: { color: BORDER, width: 1 }, rectRadius: 0.15
  });
  slide6.addText("MULTI-MODAL INGESTION", {
    x: 1.0, y: 1.9, w: colW - 0.4, h: 0.3,
    fontSize: 11, fontFace: 'Arial', color: ORANGE, bold: true
  });
  slide6.addText("1. Ingestion Agent", {
    x: 1.0, y: 2.2, w: colW - 0.4, h: 0.4,
    fontSize: 15, fontFace: 'Arial', color: NAVY, bold: true
  });
  slide6.addText("• Ingests AA JSON, GST filings (GSTR-1, 3B), CSVs, and PDF bank statements.\n• Normalizes noisy tables and removes malformed rows without data loss.\n• Zero hallucination extraction schema.", {
    x: 1.0, y: 2.7, w: colW - 0.4, h: 3.6,
    fontSize: 10.5, fontFace: 'Arial', color: DARK, lineSpacing: 18
  });

  slide6.addShape(pptx.ShapeType.roundRect, {
    x: 0.8 + colW + colGap, y: 1.6, w: colW, h: 5.0,
    fill: { color: CARD_BG }, line: { color: BORDER, width: 1 }, rectRadius: 0.15
  });
  slide6.addText("FORENSIC TELEMETRY", {
    x: 1.0 + colW + colGap, y: 1.9, w: colW - 0.4, h: 0.3,
    fontSize: 11, fontFace: 'Arial', color: GREEN, bold: true
  });
  slide6.addText("2. Analysis Agent", {
    x: 1.0 + colW + colGap, y: 2.2, w: colW - 0.4, h: 0.4,
    fontSize: 15, fontFace: 'Arial', color: NAVY, bold: true
  });
  slide6.addText("• Computes Cash Buffer Ratio (liquidity reserve vs debits).\n• Calculates Annualized Revenue Run Rate & GSTR tax compliance score.\n• Detects inward/outward cheque and auto-debit bounces.", {
    x: 1.0 + colW + colGap, y: 2.7, w: colW - 0.4, h: 3.6,
    fontSize: 10.5, fontFace: 'Arial', color: DARK, lineSpacing: 18
  });

  slide6.addShape(pptx.ShapeType.roundRect, {
    x: 0.8 + 2 * (colW + colGap), y: 1.6, w: colW, h: 5.0,
    fill: { color: CARD_BG }, line: { color: BORDER, width: 1 }, rectRadius: 0.15
  });
  slide6.addText("CHIEF CREDIT OFFICER", {
    x: 1.0 + 2 * (colW + colGap), y: 1.9, w: colW - 0.4, h: 0.3,
    fontSize: 11, fontFace: 'Arial', color: NAVY, bold: true
  });
  slide6.addText("3. Synthesis Agent", {
    x: 1.0 + 2 * (colW + colGap), y: 2.2, w: colW - 0.4, h: 0.4,
    fontSize: 15, fontFace: 'Arial', color: NAVY, bold: true
  });
  slide6.addText("• Correlates internal ratios with MCA status & litigation records.\n• Synthesizes Holistic Score (300-900) & Risk Tier (LOW/MED/HIGH).\n• Produces immutable line-item XAI Forensic Audit Trail in <55s.", {
    x: 1.0 + 2 * (colW + colGap), y: 2.7, w: colW - 0.4, h: 3.6,
    fontSize: 10.5, fontFace: 'Arial', color: DARK, lineSpacing: 18
  });

  // ==================== SLIDE 7: Technology & AI Architecture ====================
  const slide7 = pptx.addSlide();
  addSlideHeader(slide7, "Technology & Google Agent Architecture");

  slide7.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y: 1.6, w: 11.7, h: 5.0,
    fill: { color: CARD_BG }, line: { color: BORDER, width: 1 }, rectRadius: 0.15
  });

  slide7.addText("END-TO-END GOOGLE VERTEX AI AGENTIC PIPELINE", {
    x: 1.1, y: 1.85, w: 11.0, h: 0.3,
    fontSize: 12, fontFace: 'Arial', color: ORANGE, bold: true
  });

  const techBullets = [
    { text: "1. Data Ingestion Layer: Multipart upload buffers statements in-memory; Account Aggregator JSON / GSTN sandbox streams ingested securely.", options: { bold: true, color: NAVY } },
    { text: "2. Agent 1 (Gemini 2.5 Flash): Parses messy, high-density tabular transactions into structured, validated JSON schemas in ~5.8 seconds.", options: { color: DARK } },
    { text: "3. Agent 2 (Gemini 2.5 Pro): Computes mathematical ratios (Cash Buffer, Debt Service, Tax Regularity) with explicit line-item justifications.", options: { color: DARK } },
    { text: "4. Agent 3 (Gemini 2.5 Pro - Chief Credit Officer): Integrates external fraud/litigation scrapers, synthesizes 300-900 Health Score and executive narrative.", options: { color: DARK } },
    { text: "5. Google Content Safety & Anti-Hallucination Rails: Input rail blocks prompt injection; output rail enforces strict schema integrity and bounds.", options: { color: DARK } },
    { text: "6. Frontend Presentation (React 19 + Vite): Delivers live SSE stream progress, interactive telemetry cards, and downloadable XAI Audit Trails.", options: { color: DARK } }
  ];

  slide7.addText(techBullets, {
    x: 1.1, y: 2.25, w: 11.0, h: 4.1,
    fontSize: 11.5, fontFace: 'Arial', bullet: { type: 'bullet', code: '25AA' }, lineSpacing: 22
  });

  // ==================== SLIDE 8: Competitive Advantage ====================
  const slide8 = pptx.addSlide();
  addSlideHeader(slide8, "Competitive Advantage & Defensibility");

  slide8.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y: 1.6, w: 5.7, h: 5.0,
    fill: { color: CARD_BG }, line: { color: BORDER, width: 1 }, rectRadius: 0.15
  });
  slide8.addText("1. CURRENT MARKET ALTERNATIVES", {
    x: 1.1, y: 1.9, w: 5.1, h: 0.35,
    fontSize: 12, fontFace: 'Arial', color: ORANGE, bold: true
  });
  slide8.addText("Legacy Rules vs. Generic AI Wrappers", {
    x: 1.1, y: 2.3, w: 5.1, h: 0.5,
    fontSize: 15, fontFace: 'Arial', color: NAVY, bold: true
  });
  slide8.addText("• Legacy Rule Engines (Perfios, Karza): Static rule heuristics that fail on unstructured/altered formats and lack reasoning capability.\n\n• Generic LLM Prompts: Suffer from hallucinations, lack mathematical grounding, and fail banking compliance standards.\n\n• EnverAI Artificer: Verifiable mathematical extraction, zero-temperature guardrails, and deterministic line-item citations linking every score deduction to raw data.", {
    x: 1.1, y: 2.9, w: 5.1, h: 3.4,
    fontSize: 11, fontFace: 'Arial', color: DARK, lineSpacing: 18
  });

  slide8.addShape(pptx.ShapeType.roundRect, {
    x: 6.8, y: 1.6, w: 5.7, h: 5.0,
    fill: { color: CARD_BG }, line: { color: BORDER, width: 1 }, rectRadius: 0.15
  });
  slide8.addText("2. FOUNDATION MODEL DEFENSIBILITY", {
    x: 7.1, y: 1.9, w: 5.1, h: 0.35,
    fontSize: 12, fontFace: 'Arial', color: GREEN, bold: true
  });
  slide8.addText("Why Foundation Models Can't Displace Us", {
    x: 7.1, y: 2.3, w: 5.1, h: 0.5,
    fontSize: 15, fontFace: 'Arial', color: NAVY, bold: true
  });
  slide8.addText("• India Stack Regulatory Moat: Underwriting rules must comply with RBI Fair Lending mandates and Indian tax nuances (GSTR-1 vs 3B turnover matching).\n\n• Multi-Modal Verification Middleware: Proprietary calibration between transactional ledger data, external MCA records, and core banking APIs.\n\n• Enterprise Domain ACL & Auditability: Turnkey enterprise governance, role-based access, and tamper-proof decision logging.", {
    x: 7.1, y: 2.9, w: 5.1, h: 3.4,
    fontSize: 11, fontFace: 'Arial', color: DARK, lineSpacing: 18
  });

  // ==================== SLIDE 9: Vision & Roadmap ====================
  const slide9 = pptx.addSlide();
  addSlideHeader(slide9, "Vision & Execution Roadmap");

  slide9.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y: 1.6, w: 5.7, h: 5.0,
    fill: { color: CARD_BG }, line: { color: BORDER, width: 1 }, rectRadius: 0.15
  });
  slide9.addText("1. NEXT MAJOR MILESTONES (12 MONTHS)", {
    x: 1.1, y: 1.9, w: 5.1, h: 0.35,
    fontSize: 12, fontFace: 'Arial', color: ORANGE, bold: true
  });
  slide9.addText("Scaling from Pilot to Enterprise SaaS", {
    x: 1.1, y: 2.3, w: 5.1, h: 0.5,
    fontSize: 15, fontFace: 'Arial', color: NAVY, bold: true
  });
  slide9.addText("• Q3 2026: Direct integration with Sahamati Account Aggregator SDK and live GSTN sandbox APIs.\n\n• Q4 2026: Launch institutional pilot with 3 Small Finance Banks (SFBs) / NBFCs; achieve SOC2 Type II compliance.\n\n• Q1 2027: Roll out real-time pre-underwriting API for OCEN (Open Credit Enablement Network) and ULI (Unified Lending Interface).", {
    x: 1.1, y: 2.9, w: 5.1, h: 3.4,
    fontSize: 11, fontFace: 'Arial', color: DARK, lineSpacing: 18
  });

  slide9.addShape(pptx.ShapeType.roundRect, {
    x: 6.8, y: 1.6, w: 5.7, h: 5.0,
    fill: { color: CARD_BG }, line: { color: BORDER, width: 1 }, rectRadius: 0.15
  });
  slide9.addText("2. LONG-TERM VISION (3-5 YEARS)", {
    x: 7.1, y: 1.9, w: 5.1, h: 0.35,
    fontSize: 12, fontFace: 'Arial', color: GREEN, bold: true
  });
  slide9.addText("Autonomous Credit Operating System", {
    x: 7.1, y: 2.3, w: 5.1, h: 0.5,
    fontSize: 15, fontFace: 'Arial', color: NAVY, bold: true
  });
  slide9.addText("• Global Emerging Markets Expansion: Extend Artificer's alternate-data underwriting engine across Southeast Asia, Middle East, and Latin America.\n\n• Ecosystem Orchestration: Become the ubiquitous risk infrastructure powering $100 Billion+ in digital loans.\n\n• Comprehensive AI Governance: Offer full-suite agentic risk monitoring and automated loan covenants tracking post-disbursal.", {
    x: 7.1, y: 2.9, w: 5.1, h: 3.4,
    fontSize: 11, fontFace: 'Arial', color: DARK, lineSpacing: 18
  });

  // ==================== SLIDE 10: Team ====================
  const slide10 = pptx.addSlide();
  addSlideHeader(slide10, "Founding Team & Unique Positioning");

  slide10.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y: 1.6, w: 11.7, h: 5.0,
    fill: { color: CARD_BG }, line: { color: BORDER, width: 1 }, rectRadius: 0.15
  });

  slide10.addText("CROSS-FUNCTIONAL EXPERTISE IN AI, FINTECH & CLOUD", {
    x: 1.1, y: 1.9, w: 11.0, h: 0.3,
    fontSize: 12, fontFace: 'Arial', color: ORANGE, bold: true
  });

  const teamBullets = [
    { text: "Interdisciplinary Engineering & FinTech DNA: Deep expertise across Google Cloud Vertex AI, multi-agent system design, and quantitative credit risk modeling.", options: { bold: true, color: NAVY } },
    { text: "Architectural & Full-Stack Mastery: Proven ability to build ultra-low-latency, resilient decoupled systems with real-time SSE streaming and zero-trust security.", options: { color: DARK } },
    { text: "Regulatory & Compliance Savvy: Deep understanding of RBI digital lending guidelines, Account Aggregator consent architectures, and GSTN tax frameworks.", options: { color: DARK } },
    { text: "Rapid Prototyping & Execution: Built, validated, benchmarked, and hardened EnverAI Artificer with enterprise-grade guardrails and live dataset ingestion in record time.", options: { color: DARK } }
  ];

  slide10.addText(teamBullets, {
    x: 1.1, y: 2.3, w: 11.0, h: 4.0,
    fontSize: 12, fontFace: 'Arial', bullet: { type: 'bullet', code: '25AA' }, lineSpacing: 24
  });

  // ==================== SLIDE 11: Why BITSoM Vertex? ====================
  const slide11 = pptx.addSlide();
  addSlideHeader(slide11, "Why BITSoM Vertex?");

  slide11.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y: 1.6, w: 5.7, h: 5.0,
    fill: { color: CARD_BG }, line: { color: BORDER, width: 1 }, rectRadius: 0.15
  });
  slide11.addText("1. WHY WE APPLIED", {
    x: 1.1, y: 1.9, w: 5.1, h: 0.35,
    fontSize: 12, fontFace: 'Arial', color: ORANGE, bold: true
  });
  slide11.addText("Institutional Mentorship & Bank Network", {
    x: 1.1, y: 2.3, w: 5.1, h: 0.5,
    fontSize: 15, fontFace: 'Arial', color: NAVY, bold: true
  });
  slide11.addText("• Mentorship from Banking Veterans: Access to senior risk executives and FinTech leaders to refine enterprise GTM and credit scoring calibration.\n\n• Institutional Credibility: BITSoM Vertex incubation offers the brand trust necessary to partner with risk-averse commercial banking institutions.\n\n• Capital & Growth Acceleration: Guidance on scaling enterprise sales cycles and navigating regulatory sandbox programs.", {
    x: 1.1, y: 2.9, w: 5.1, h: 3.4,
    fontSize: 11, fontFace: 'Arial', color: DARK, lineSpacing: 18
  });

  slide11.addShape(pptx.ShapeType.roundRect, {
    x: 6.8, y: 1.6, w: 5.7, h: 5.0,
    fill: { color: CARD_BG }, line: { color: BORDER, width: 1 }, rectRadius: 0.15
  });
  slide11.addText("2. CURRENT GROWTH BOTTLENECK", {
    x: 7.1, y: 1.9, w: 5.1, h: 0.35,
    fontSize: 12, fontFace: 'Arial', color: GREEN, bold: true
  });
  slide11.addText("Enterprise Banking Procurement Cycles", {
    x: 7.1, y: 2.3, w: 5.1, h: 0.5,
    fontSize: 15, fontFace: 'Arial', color: NAVY, bold: true
  });
  slide11.addText("• Long Enterprise Sales Cycles: Commercial bank procurement takes 6-9 months without warm executive introductions.\n\n• Access to Live Institutional Sandbox: Need formal banking sandbox partnerships to run parallel shadow-underwriting on live loan applications.\n\n• BITSoM Vertex Catalyst: Unlocks executive access to CROs/CCOs, shrinking pilot closing cycles from months to weeks.", {
    x: 7.1, y: 2.9, w: 5.1, h: 3.4,
    fontSize: 11, fontFace: 'Arial', color: DARK, lineSpacing: 18
  });

  // ==================== SLIDE 12: Supporting Material ====================
  const slide12 = pptx.addSlide();
  addSlideHeader(slide12, "Supporting Material & Links");

  slide12.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y: 1.6, w: 11.7, h: 5.0,
    fill: { color: CARD_BG }, line: { color: BORDER, width: 1 }, rectRadius: 0.15
  });

  slide12.addText("PROJECT ASSETS, REPOSITORY & DEMO VERIFICATION", {
    x: 1.1, y: 1.9, w: 11.0, h: 0.3,
    fontSize: 12, fontFace: 'Arial', color: ORANGE, bold: true
  });

  const linksBullets = [
    { text: "Deployed Web Platform: Live at enveraitech.in/artificer (Local development: http://localhost:5173)", options: { bold: true, color: NAVY } },
    { text: "Project Demo Video (3-5 Minutes): High-res walkthrough of multi-agent ingestion, financial ratio computation, and XAI Forensic Audit Trail.", options: { color: DARK } },
    { text: "Company Website: enveraitech.com", options: { color: DARK } },
    { text: "GitHub Repository: https://github.com/Amaan-cmd/IDBI-Artificer", options: { color: DARK } },
    { text: "Product Specification & Architecture Documentation: Included in project root (ARTIFICER.md & BITSoM_Pitch_Deck_Content.md)", options: { color: DARK } },
    { text: "Contact Details: Founding Team (daddy@enveraitech.com / contact@enveraitech.com)", options: { color: DARK } }
  ];

  slide12.addText(linksBullets, {
    x: 1.1, y: 2.3, w: 11.0, h: 4.0,
    fontSize: 12, fontFace: 'Arial', bullet: { type: 'bullet', code: '25AA' }, lineSpacing: 24
  });

  // ==================== SLIDE 13: Thank You ====================
  const slide13 = pptx.addSlide();
  slide13.background = { color: NAVY };

  slide13.addText("BITSoM vertex | H2S", {
    x: 1.0, y: 1.2, w: 8.0, h: 0.4,
    fontSize: 14, fontFace: 'Arial', color: ORANGE, bold: true
  });

  slide13.addText("Builders Pitch Fest 2026", {
    x: 1.0, y: 1.7, w: 10.0, h: 0.5,
    fontSize: 18, fontFace: 'Arial', color: 'A0B2D6', bold: true
  });

  slide13.addText("THANK YOU", {
    x: 1.0, y: 2.6, w: 11.0, h: 1.2,
    fontSize: 48, fontFace: 'Arial', color: WHITE, bold: true
  });

  slide13.addText("EnverAI Artificer: Powering the Future of Explainable, Inclusive MSME Credit.", {
    x: 1.0, y: 4.0, w: 11.0, h: 0.8,
    fontSize: 18, fontFace: 'Arial', color: ORANGE, bold: true
  });

  slide13.addText("Q&A • We are ready for your questions.", {
    x: 1.0, y: 5.0, w: 10.0, h: 0.5,
    fontSize: 15, fontFace: 'Arial', color: 'D5E0F2', italic: true
  });

  slide13.addText("Enver AI Tech • daddy@enveraitech.com • enveraitech.com", {
    x: 1.0, y: 6.2, w: 11.0, h: 0.4,
    fontSize: 11, fontFace: 'Arial', color: '8EA3C7'
  });

  // Save the presentation
  const fileName = 'EnverAI_BITSoM_Pitch_Deck.pptx';
  await pptx.writeFile({ fileName });
  console.log(`[Pitch Deck Generator] Presentation saved successfully as ${fileName}`);
}

createDeck().catch(err => console.error('Error generating deck:', err));
