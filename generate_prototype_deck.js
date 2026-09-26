const pptxgen = require('pptxgenjs');
const path = require('path');
const fs = require('fs');

async function generatePitchDeck() {
  const pptx = new pptxgen();

  // Modern 16:9 Widescreen Presentation (13.333" x 7.5")
  pptx.defineLayout({ name: 'WIDE_16_9', width: 13.333, height: 7.5 });
  pptx.layout = 'WIDE_16_9';
  pptx.author = 'EnverAI Tech Inc.';
  pptx.company = 'EnverAI Tech Inc.';
  pptx.title = 'EnverAI Artificer - BITSoM Vertex Builders Pitch Fest 2026';
  pptx.subject = 'Autonomous MSME Credit Intelligence & Underwriting Citadel';

  // Palette Tokens matching BITSoM Vertex branding
  const COLOR_BG = 'FFFFFF';
  const COLOR_BG_SUBTLE = 'F8FAFC';
  const COLOR_CARD = 'FFFFFF';
  const COLOR_BORDER = 'E2E8F0';
  const COLOR_BORDER_ACCENT = 'FDBA74';
  const COLOR_TEXT_PRIMARY = '0F172A';     // Deep slate/navy
  const COLOR_TEXT_SECONDARY = '334155';   // Charcoal
  const COLOR_TEXT_MUTED = '64748B';       // Slate gray
  const COLOR_ORANGE = 'F05A28';           // BITSoM Vertex Primary Orange
  const COLOR_ORANGE_DARK = 'C2410C';
  const COLOR_ORANGE_LIGHT = 'FFF7ED';
  const COLOR_BLUE = '1E40AF';             // Institutional Blue
  const COLOR_BLUE_LIGHT = 'EFF6FF';
  const COLOR_GREEN = '15803D';            // Success Green
  const COLOR_GREEN_LIGHT = 'F0FDF4';

  const archImgPath = path.resolve(__dirname, 'assets/deck_images/architecture.png');
  const uiImgPath = path.resolve(__dirname, 'assets/deck_images/ui_mockup.png');
  const flowImgPath = path.resolve(__dirname, 'assets/deck_images/process_flow.png');

  // Helper: Standard Slide Header for BITSoM Vertex Template
  function applySlideHeader(slide, title, category = "Builders Pitch Fest 2026") {
    slide.background = { color: COLOR_BG };

    // Top Header: Left Brand
    slide.addText("BITSoM vertex  |  H2S", {
      x: 0.8, y: 0.32, w: 4.5, h: 0.35,
      fontSize: 13, fontFace: 'Arial', color: '1E293B', bold: true
    });

    // Top Header: Right Event
    slide.addText(category, {
      x: 7.5, y: 0.32, w: 5.0, h: 0.35,
      fontSize: 13, fontFace: 'Arial', color: COLOR_ORANGE, bold: true, align: 'right'
    });

    // Thin separator line
    slide.addShape(pptx.ShapeType.line, {
      x: 0.8, y: 0.72, w: 11.733, h: 0,
      line: { color: COLOR_BORDER, width: 1 }
    });

    // Slide Title
    slide.addText(title, {
      x: 0.8, y: 0.85, w: 11.733, h: 0.55,
      fontSize: 22, fontFace: 'Arial', color: COLOR_TEXT_PRIMARY, bold: true
    });

    // Bottom orange accent line / glow bar
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 7.38, w: 13.333, h: 0.12,
      fill: { color: COLOR_ORANGE }, line: { color: COLOR_ORANGE, width: 0 }
    });
  }

  // =========================================================================
  // SLIDE 1: Cover Slide
  // =========================================================================
  const slide1 = pptx.addSlide();
  slide1.background = { color: COLOR_BG };

  // Top branding
  slide1.addText("BITSoM vertex  |  H2S", {
    x: 0.8, y: 0.45, w: 5.0, h: 0.4,
    fontSize: 15, fontFace: 'Arial', color: '1E293B', bold: true
  });
  slide1.addText("Builders Pitch Fest 2026", {
    x: 7.5, y: 0.45, w: 5.0, h: 0.4,
    fontSize: 15, fontFace: 'Arial', color: COLOR_ORANGE, bold: true, align: 'right'
  });

  // Orange accent bar in middle
  slide1.addShape(pptx.ShapeType.rect, {
    x: 0, y: 3.35, w: 13.333, h: 0.08,
    fill: { color: COLOR_ORANGE }, line: { color: COLOR_ORANGE, width: 0 }
  });

  // Top Section: Event Hero Title
  slide1.addText("Builders\nPitch Fest 2026", {
    x: 0.8, y: 1.15, w: 8.0, h: 1.8,
    fontSize: 38, fontFace: 'Arial', color: COLOR_ORANGE, bold: true, lineSpacing: 42
  });

  // Startup details card below orange bar
  slide1.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y: 3.65, w: 11.733, h: 3.2,
    fill: { color: COLOR_BG_SUBTLE }, line: { color: COLOR_BORDER, width: 1.2 }, rectRadius: 0.12
  });

  slide1.addText("STARTUP SUBMISSION", {
    x: 1.2, y: 3.9, w: 6.0, h: 0.3,
    fontSize: 11, fontFace: 'Arial', color: COLOR_ORANGE_DARK, bold: true, letterSpacing: 1.5
  });

  slide1.addText("EnverAI Artificer", {
    x: 1.2, y: 4.25, w: 8.5, h: 0.65,
    fontSize: 32, fontFace: 'Arial', color: COLOR_TEXT_PRIMARY, bold: true
  });

  slide1.addText("Autonomous Multi-Agent Alternate-Data Underwriting Citadel for New-to-Credit (NTC) MSMEs", {
    x: 1.2, y: 4.95, w: 10.8, h: 0.55,
    fontSize: 15, fontFace: 'Arial', color: COLOR_TEXT_SECONDARY, bold: true
  });

  // Pill Badges
  const badges = [
    { text: "Google Vertex AI & Gemini 2.5", color: COLOR_BLUE, bg: COLOR_BLUE_LIGHT, x: 1.2 },
    { text: "TAT: < 55 Seconds (vs 14 Days)", color: COLOR_ORANGE_DARK, bg: COLOR_ORANGE_LIGHT, x: 4.4 },
    { text: "100% Extraction on 1,000+ Records", color: COLOR_GREEN, bg: COLOR_GREEN_LIGHT, x: 7.7 }
  ];
  badges.forEach(b => {
    slide1.addShape(pptx.ShapeType.roundRect, {
      x: b.x, y: 5.65, w: 3.0, h: 0.4,
      fill: { color: b.bg }, line: { color: COLOR_BORDER, width: 1 }, rectRadius: 0.08
    });
    slide1.addText(b.text, {
      x: b.x, y: 5.65, w: 3.0, h: 0.4,
      fontSize: 10, fontFace: 'Arial', color: b.color, bold: true, align: 'center', valign: 'middle'
    });
  });

  slide1.addText("Presenter: EnverAI Tech Inc. • Team Citadel • Contact: contact@enveraitech.com • Website: enveraitech.com", {
    x: 1.2, y: 6.25, w: 10.8, h: 0.35,
    fontSize: 11, fontFace: 'Arial', color: COLOR_TEXT_MUTED
  });

  // Bottom glowing accent bar
  slide1.addShape(pptx.ShapeType.rect, {
    x: 0, y: 7.38, w: 13.333, h: 0.12,
    fill: { color: COLOR_ORANGE }, line: { color: COLOR_ORANGE, width: 0 }
  });

  // =========================================================================
  // SLIDE 2: IMPORTANT (Guidelines & Alignment)
  // =========================================================================
  const slide2 = pptx.addSlide();
  applySlideHeader(slide2, "IMPORTANT — Submission Framework & Evaluation Alignment");

  slide2.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y: 1.5, w: 11.733, h: 5.6,
    fill: { color: COLOR_BG_SUBTLE }, line: { color: COLOR_BORDER, width: 1.2 }, rectRadius: 0.12
  });

  slide2.addText("BITSoM Vertex Evaluation Standard & Prototype Alignment", {
    x: 1.1, y: 1.7, w: 11.0, h: 0.4,
    fontSize: 15, fontFace: 'Arial', color: COLOR_ORANGE_DARK, bold: true
  });

  slide2.addText("This deck rigorously evaluates EnverAI Artificer against the 6 evaluation pillars prescribed by the BITSoM Vertex review board, grounded in our working prototype, verified telemetry, and empirical data:", {
    x: 1.1, y: 2.1, w: 11.0, h: 0.45,
    fontSize: 11, fontFace: 'Arial', color: COLOR_TEXT_MUTED
  });

  const criteriaCards = [
    {
      title: "1. Clearly Validated Problem & Market",
      desc: "Addresses the $300B+ credit deficit for 63M Indian MSMEs where 70% of NTC applicants are rejected by legacy CIBIL bureau scoring.",
      color: COLOR_ORANGE_DARK, bg: COLOR_ORANGE_LIGHT, x: 1.1, y: 2.65, w: 5.4, h: 1.25
    },
    {
      title: "2. Meaningful & Responsible AI",
      desc: "3-agent persona segregation (Fetcha, Geek, Orc) with Gemini 2.5, deterministic financial math, and NeMo zero-hallucination guardrails.",
      color: COLOR_BLUE, bg: COLOR_BLUE_LIGHT, x: 6.7, y: 2.65, w: 5.4, h: 1.25
    },
    {
      title: "3. Scalable Technical Depth",
      desc: "Decoupled enterprise architecture (Node.js/Express, React 19, Google Vertex AI) with Server-Sent Events (SSE) and line-item audit trails.",
      color: COLOR_GREEN, bg: COLOR_GREEN_LIGHT, x: 1.1, y: 4.05, w: 5.4, h: 1.25
    },
    {
      title: "4. Product Maturity & Traction",
      desc: "Selected for FITT (IIT Delhi) & Jubilant Life Foundation incubators; attended Hub71 Validation Workshop; validated on 1,000+ Indian financial records.",
      color: COLOR_ORANGE_DARK, bg: COLOR_ORANGE_LIGHT, x: 6.7, y: 4.05, w: 5.4, h: 1.25
    },
    {
      title: "5. Sustainable Business Model",
      desc: "High-margin B2B API pricing ($0.50-$2.00/evaluation) vs $0.05 LLM cost (92%+ gross margin), delivering 99% cost reduction to banks.",
      color: COLOR_BLUE, bg: COLOR_BLUE_LIGHT, x: 1.1, y: 5.45, w: 5.4, h: 1.3
    },
    {
      title: "6. Growth via BITSoM Vertex",
      desc: "Leveraging incubator network to navigate 6-month enterprise bank procurement cycles and access live shadow-underwriting sandboxes.",
      color: COLOR_GREEN, bg: COLOR_GREEN_LIGHT, x: 6.7, y: 5.45, w: 5.4, h: 1.3
    }
  ];

  criteriaCards.forEach(c => {
    slide2.addShape(pptx.ShapeType.roundRect, {
      x: c.x, y: c.y, w: c.w, h: c.h,
      fill: { color: COLOR_CARD }, line: { color: COLOR_BORDER, width: 1 }, rectRadius: 0.08
    });
    slide2.addText(c.title, {
      x: c.x + 0.15, y: c.y + 0.12, w: c.w - 0.3, h: 0.3,
      fontSize: 11.5, fontFace: 'Arial', color: c.color, bold: true
    });
    slide2.addText(c.desc, {
      x: c.x + 0.15, y: c.y + 0.42, w: c.w - 0.3, h: c.h - 0.5,
      fontSize: 10, fontFace: 'Arial', color: COLOR_TEXT_SECONDARY, lineSpacing: 14
    });
  });

  // =========================================================================
  // SLIDE 3: Startup Snapshot
  // =========================================================================
  const slide3 = pptx.addSlide();
  applySlideHeader(slide3, "Startup Snapshot");

  // Left Box: Question 1
  slide3.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y: 1.5, w: 5.7, h: 5.6,
    fill: { color: COLOR_BG_SUBTLE }, line: { color: COLOR_BORDER, width: 1.2 }, rectRadius: 0.12
  });
  slide3.addShape(pptx.ShapeType.roundRect, {
    x: 1.1, y: 1.7, w: 5.1, h: 0.38,
    fill: { color: COLOR_ORANGE_LIGHT }, line: { color: COLOR_BORDER_ACCENT, width: 1 }, rectRadius: 0.06
  });
  slide3.addText("1. WHAT DOES YOUR STARTUP DO?", {
    x: 1.2, y: 1.7, w: 4.9, h: 0.38,
    fontSize: 11, fontFace: 'Arial', color: COLOR_ORANGE_DARK, bold: true, valign: 'middle'
  });

  slide3.addText("Autonomous MSME Credit Intelligence & Underwriting Citadel", {
    x: 1.1, y: 2.2, w: 5.1, h: 0.55,
    fontSize: 15, fontFace: 'Arial', color: COLOR_TEXT_PRIMARY, bold: true
  });

  slide3.addText([
    { text: "• Core Value Proposition: ", options: { bold: true, color: COLOR_TEXT_PRIMARY } },
    { text: "EnverAI Artificer is an autonomous, multi-agent underwriting platform engineered specifically for New-to-Credit (NTC) MSMEs.\n\n", options: { color: COLOR_TEXT_SECONDARY } },
    { text: "• Ingests Unstructured Alternate Data: ", options: { bold: true, color: COLOR_TEXT_PRIMARY } },
    { text: "Eliminates manual file audits by reconciling multi-page bank statements (PDF/CSV), Account Aggregator (AA / Sahamati) JSON feeds, GST returns (GSTR-1, GSTR-3B), and public regulatory records (MCA21, litigation databases).\n\n", options: { color: COLOR_TEXT_SECONDARY } },
    { text: "• Instant Verifiable Health Card: ", options: { bold: true, color: COLOR_TEXT_PRIMARY } },
    { text: "Synthesizes an institutional-grade Credit Health Card (Score: 300–900, Risk Tier: LOW/MED/HIGH, quantitative debt/liquidity ratios, and forensic line-item citations) in under 55 seconds, reducing decision latency by 99.5%.", options: { color: COLOR_TEXT_SECONDARY } }
  ], {
    x: 1.1, y: 2.8, w: 5.1, h: 4.1,
    fontSize: 10.5, fontFace: 'Arial', lineSpacing: 16
  });

  // Right Box: Question 2
  slide3.addShape(pptx.ShapeType.roundRect, {
    x: 6.833, y: 1.5, w: 5.7, h: 5.6,
    fill: { color: COLOR_BG_SUBTLE }, line: { color: COLOR_BORDER, width: 1.2 }, rectRadius: 0.12
  });
  slide3.addShape(pptx.ShapeType.roundRect, {
    x: 7.133, y: 1.7, w: 5.1, h: 0.38,
    fill: { color: COLOR_GREEN_LIGHT }, line: { color: COLOR_BORDER, width: 1 }, rectRadius: 0.06
  });
  slide3.addText("2. WHAT MILESTONE BEST REPRESENTS YOUR PROGRESS SO FAR?", {
    x: 7.233, y: 1.7, w: 4.9, h: 0.38,
    fontSize: 10.5, fontFace: 'Arial', color: COLOR_GREEN, bold: true, valign: 'middle'
  });

  slide3.addText("Incubator Selection (FITT & Jubilant), Hub71 & 1,000+ Datasets", {
    x: 7.133, y: 2.2, w: 5.1, h: 0.55,
    fontSize: 14.5, fontFace: 'Arial', color: COLOR_TEXT_PRIMARY, bold: true
  });

  slide3.addText([
    { text: "• Institutional Incubator Selection & Global Validation: ", options: { bold: true, color: COLOR_TEXT_PRIMARY } },
    { text: "Officially selected for FITT (Foundation for Innovation and Technology Transfer — IIT Delhi) and the Jubilant Life Foundation Incubator programs; successfully attended and completed the global Hub71 Validation Workshop.\n\n", options: { color: COLOR_TEXT_SECONDARY } },
    { text: "• Validated across 1,000+ Indian Financial Records: ", options: { bold: true, color: COLOR_TEXT_PRIMARY } },
    { text: "Benchmark tested on real-world Indian bank statements and GST returns from the AgamiAI open dataset with 100% extraction accuracy and zero hallucinations.\n\n", options: { color: COLOR_TEXT_SECONDARY } },
    { text: "• Production Multi-Agent Underwriting Cockpit: ", options: { bold: true, color: COLOR_TEXT_PRIMARY } },
    { text: "Live deployed engine powered by Google Gemini 2.5 Flash & Pro featuring real-time Server-Sent Events (SSE) telemetry and Conversational XAI Interrogation Drawer.", options: { color: COLOR_TEXT_SECONDARY } }
  ], {
    x: 7.133, y: 2.8, w: 5.1, h: 4.1,
    fontSize: 10, fontFace: 'Arial', lineSpacing: 15
  });

  // =========================================================================
  // SLIDE 4: Problem Understanding
  // =========================================================================
  const slide4 = pptx.addSlide();
  applySlideHeader(slide4, "Problem Understanding");

  // Left Box: Question 1
  slide4.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y: 1.5, w: 5.7, h: 5.6,
    fill: { color: COLOR_BG_SUBTLE }, line: { color: COLOR_BORDER, width: 1.2 }, rectRadius: 0.12
  });
  slide4.addShape(pptx.ShapeType.roundRect, {
    x: 1.1, y: 1.7, w: 5.1, h: 0.38,
    fill: { color: COLOR_ORANGE_LIGHT }, line: { color: COLOR_BORDER_ACCENT, width: 1 }, rectRadius: 0.06
  });
  slide4.addText("1. WHAT PROBLEM ARE YOU SOLVING, AND WHO EXPERIENCES IT?", {
    x: 1.2, y: 1.7, w: 4.9, h: 0.38,
    fontSize: 9.5, fontFace: 'Arial', color: COLOR_ORANGE_DARK, bold: true, valign: 'middle'
  });

  slide4.addText("Legacy Bureaus Exclude 70% of Creditworthy NTC MSMEs", {
    x: 1.1, y: 2.2, w: 5.1, h: 0.55,
    fontSize: 15, fontFace: 'Arial', color: COLOR_TEXT_PRIMARY, bold: true
  });

  slide4.addText([
    { text: "The Problem:\n", options: { bold: true, color: COLOR_ORANGE_DARK } },
    { text: "• The $300B+ MSME Credit Void: ", options: { bold: true, color: COLOR_TEXT_PRIMARY } },
    { text: "63M+ Indian MSMEs generate 30% of GDP, yet 70% of New-to-Credit applicants are rejected due to zero legacy CIBIL/bureau repayment footprints.\n", options: { color: COLOR_TEXT_SECONDARY } },
    { text: "• 5 to 14 Days Underwriting Turnaround (TAT): ", options: { bold: true, color: COLOR_TEXT_PRIMARY } },
    { text: "Lenders rely on slow, manual CA cross-verification, physical shop audits, and line-by-line bank PDF scanning.\n", options: { color: COLOR_TEXT_SECONDARY } },
    { text: "• High Unit Cost ($25-$50 / ₹2,000-₹4,000): ", options: { bold: true, color: COLOR_TEXT_PRIMARY } },
    { text: "Manual processing makes small-ticket working capital loans (<₹10 Lakhs) commercially unviable for banks.\n\n", options: { color: COLOR_TEXT_SECONDARY } },
    { text: "Who Experiences It Most Acutely:\n", options: { bold: true, color: COLOR_BLUE } },
    { text: "1. 63M+ Indian MSME Owners: Starved of formal credit, forced into predatory informal lenders charging 30-60% annual interest.\n2. Commercial Banks, SFBs & NBFCs: Credit officers overwhelmed with paperwork, missing loan growth targets.", options: { color: COLOR_TEXT_SECONDARY } }
  ], {
    x: 1.1, y: 2.8, w: 5.1, h: 4.1,
    fontSize: 10, fontFace: 'Arial', lineSpacing: 15
  });

  // Right Box: Question 2
  slide4.addShape(pptx.ShapeType.roundRect, {
    x: 6.833, y: 1.5, w: 5.7, h: 5.6,
    fill: { color: COLOR_BG_SUBTLE }, line: { color: COLOR_BORDER, width: 1.2 }, rectRadius: 0.12
  });
  slide4.addShape(pptx.ShapeType.roundRect, {
    x: 7.133, y: 1.7, w: 5.1, h: 0.38,
    fill: { color: COLOR_GREEN_LIGHT }, line: { color: COLOR_BORDER, width: 1 }, rectRadius: 0.06
  });
  slide4.addText("2. WHAT EVIDENCE VALIDATES THIS AS A MEANINGFUL PROBLEM?", {
    x: 7.233, y: 1.7, w: 4.9, h: 0.38,
    fontSize: 9.5, fontFace: 'Arial', color: COLOR_GREEN, bold: true, valign: 'middle'
  });

  slide4.addText("Documented Macro Gap Meets India Stack Opportunity", {
    x: 7.133, y: 2.2, w: 5.1, h: 0.55,
    fontSize: 15, fontFace: 'Arial', color: COLOR_TEXT_PRIMARY, bold: true
  });

  slide4.addText([
    { text: "Empirical Evidence & Market Validation:\n", options: { bold: true, color: COLOR_GREEN } },
    { text: "• $350B+ Documented Addressable Credit Gap: ", options: { bold: true, color: COLOR_TEXT_PRIMARY } },
    { text: "Documented in exhaustive research by the Reserve Bank of India (U.K. Sinha Committee) and the International Finance Corporation (IFC).\n\n", options: { color: COLOR_TEXT_SECONDARY } },
    { text: "• Data-Rich but Intelligence-Poor: ", options: { bold: true, color: COLOR_TEXT_PRIMARY } },
    { text: "The India Stack (Account Aggregator / Sahamati, GSTN, ULI) makes raw transactional data digitally accessible via API, yet 85%+ of financial institutions lack automated cognitive software to synthesize and audit it.\n\n", options: { color: COLOR_TEXT_SECONDARY } },
    { text: "• Strict Regulatory XAI Mandate: ", options: { bold: true, color: COLOR_TEXT_PRIMARY } },
    { text: "RBI Digital Lending Guidelines strictly prohibit 'black-box' opaque AI scoring. Lenders are legally required to provide verifiable reasons and audit trails for every credit decision — which Artificer natively provides through exact line-item citations.", options: { color: COLOR_TEXT_SECONDARY } }
  ], {
    x: 7.133, y: 2.8, w: 5.1, h: 4.1,
    fontSize: 10.5, fontFace: 'Arial', lineSpacing: 16
  });

  // =========================================================================
  // SLIDE 5: Customer & Market
  // =========================================================================
  const slide5 = pptx.addSlide();
  applySlideHeader(slide5, "Customer & Market");

  // Left Box: Question 1
  slide5.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y: 1.5, w: 5.7, h: 5.6,
    fill: { color: COLOR_BG_SUBTLE }, line: { color: COLOR_BORDER, width: 1.2 }, rectRadius: 0.12
  });
  slide5.addShape(pptx.ShapeType.roundRect, {
    x: 1.1, y: 1.7, w: 5.1, h: 0.38,
    fill: { color: COLOR_ORANGE_LIGHT }, line: { color: COLOR_BORDER_ACCENT, width: 1 }, rectRadius: 0.06
  });
  slide5.addText("1. WHO IS YOUR IDEAL CUSTOMER & WHO MAKES BUYING DECISIONS?", {
    x: 1.2, y: 1.7, w: 4.9, h: 0.38,
    fontSize: 9.5, fontFace: 'Arial', color: COLOR_ORANGE_DARK, bold: true, valign: 'middle'
  });

  slide5.addText("Institutional Lenders & Digital Co-Lending Ecosystem", {
    x: 1.1, y: 2.2, w: 5.1, h: 0.55,
    fontSize: 15, fontFace: 'Arial', color: COLOR_TEXT_PRIMARY, bold: true
  });

  slide5.addText([
    { text: "Ideal Customer Profile (ICP):\n", options: { bold: true, color: COLOR_ORANGE_DARK } },
    { text: "• Tier 1 & 2 Commercial Banks: ", options: { bold: true, color: COLOR_TEXT_PRIMARY } },
    { text: "Public and private sector lenders (IDBI, SBI, HDFC, ICICI) seeking to fulfill mandatory MSME Priority Sector Lending (PSL) quotas efficiently.\n", options: { color: COLOR_TEXT_SECONDARY } },
    { text: "• Small Finance Banks (SFBs) & NBFCs: ", options: { bold: true, color: COLOR_TEXT_PRIMARY } },
    { text: "AU Small Finance, Equitas, Tata Capital, Aditya Birla Capital scaling unsecured business loans.\n", options: { color: COLOR_TEXT_SECONDARY } },
    { text: "• Digital Fintech Co-Lenders: ", options: { bold: true, color: COLOR_TEXT_PRIMARY } },
    { text: "OCEN & ULI platforms needing sub-minute pre-underwriting APIs.\n\n", options: { color: COLOR_TEXT_SECONDARY } },
    { text: "Economic Buyers & Stakeholders:\n", options: { bold: true, color: COLOR_BLUE } },
    { text: "• Chief Risk Officer (CRO) & Chief Credit Officer (CCO): Require default prevention, mathematical accuracy, and RBI audit compliance.\n• Head of MSME / Digital Lending: Drives loan disbursement volume and lower cost-per-file.\n• User Personas: Credit Underwriters & Loan Officers.", options: { color: COLOR_TEXT_SECONDARY } }
  ], {
    x: 1.1, y: 2.8, w: 5.1, h: 4.1,
    fontSize: 10, fontFace: 'Arial', lineSpacing: 15
  });

  // Right Box: Question 2
  slide5.addShape(pptx.ShapeType.roundRect, {
    x: 6.833, y: 1.5, w: 5.7, h: 5.6,
    fill: { color: COLOR_BG_SUBTLE }, line: { color: COLOR_BORDER, width: 1.2 }, rectRadius: 0.12
  });
  slide5.addShape(pptx.ShapeType.roundRect, {
    x: 7.133, y: 1.7, w: 5.1, h: 0.38,
    fill: { color: COLOR_GREEN_LIGHT }, line: { color: COLOR_BORDER, width: 1 }, rectRadius: 0.06
  });
  slide5.addText("2. HOW LARGE IS THE OPPORTUNITY YOU ARE TARGETING?", {
    x: 7.233, y: 1.7, w: 4.9, h: 0.38,
    fontSize: 10.5, fontFace: 'Arial', color: COLOR_GREEN, bold: true, valign: 'middle'
  });

  slide5.addText("$1.2B SAM in Indian MSME Underwriting Intelligence", {
    x: 7.133, y: 2.2, w: 5.1, h: 0.55,
    fontSize: 15, fontFace: 'Arial', color: COLOR_TEXT_PRIMARY, bold: true
  });

  // TAM / SAM / SOM Cards
  const marketCards = [
    { label: "TAM: $530 Billion (₹44 Lakh Cr)", desc: "Total Indian MSME commercial credit market opportunity.", color: COLOR_ORANGE_DARK, bg: COLOR_ORANGE_LIGHT, y: 2.85 },
    { label: "SAM: $1.2 Billion (₹10,000 Cr)", desc: "Annual technology spend on credit underwriting, appraisal software & financial data ingestion across 1,200+ regulated lending entities processing ~50M files/yr.", color: COLOR_BLUE, bg: COLOR_BLUE_LIGHT, y: 3.85 },
    { label: "SOM: $45 Million ARR (₹375 Cr)", desc: "Capturing 3-5% of digital MSME loan origination volume across Indian commercial banks & SFBs within 4 years.", color: COLOR_GREEN, bg: COLOR_GREEN_LIGHT, y: 4.85 }
  ];

  marketCards.forEach(m => {
    slide5.addShape(pptx.ShapeType.roundRect, {
      x: 7.133, y: m.y, w: 5.1, h: 0.9,
      fill: { color: COLOR_CARD }, line: { color: COLOR_BORDER, width: 1 }, rectRadius: 0.08
    });
    slide5.addText(m.label, {
      x: 7.283, y: m.y + 0.1, w: 4.8, h: 0.3,
      fontSize: 11.5, fontFace: 'Arial', color: m.color, bold: true
    });
    slide5.addText(m.desc, {
      x: 7.283, y: m.y + 0.38, w: 4.8, h: 0.45,
      fontSize: 9.5, fontFace: 'Arial', color: COLOR_TEXT_SECONDARY, lineSpacing: 13
    });
  });

  slide5.addText("Monetization: ₹50 ($0.60)/API call (92%+ gross margin over $0.05 LLM cost) + $25k-$100k/yr enterprise licenses.", {
    x: 7.133, y: 5.95, w: 5.1, h: 0.8,
    fontSize: 10, fontFace: 'Arial', color: COLOR_TEXT_MUTED, italic: true
  });

  // =========================================================================
  // SLIDE 6: Solution Overview
  // =========================================================================
  const slide6 = pptx.addSlide();
  applySlideHeader(slide6, "Solution Overview");

  // Top Q1 Card
  slide6.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y: 1.5, w: 11.733, h: 1.45,
    fill: { color: COLOR_BG_SUBTLE }, line: { color: COLOR_BORDER, width: 1.2 }, rectRadius: 0.1
  });
  slide6.addText("1. WHAT IS YOUR SOLUTION, AND HOW DOES IT SOLVE THE IDENTIFIED PROBLEM?", {
    x: 1.1, y: 1.62, w: 11.0, h: 0.28,
    fontSize: 10.5, fontFace: 'Arial', color: COLOR_ORANGE_DARK, bold: true
  });
  slide6.addText("EnverAI Artificer is an autonomous multi-agent underwriting citadel that replaces slow, manual 14-day loan evaluations with a 55-second multi-modal computational audit.\nIt eliminates credit officer paper-pushing by ingesting multi-modal operational data (Bank statements, GST returns, MCA21 registries), deterministically computing financial ratios, and synthesizing a verifiable MSME Health Card (300-900 score) with line-item audit proof.", {
    x: 1.1, y: 1.92, w: 11.0, h: 0.95,
    fontSize: 10.5, fontFace: 'Arial', color: COLOR_TEXT_SECONDARY, lineSpacing: 15
  });

  // Bottom Left: Q2 Capabilities
  slide6.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y: 3.1, w: 6.8, h: 4.0,
    fill: { color: COLOR_BG_SUBTLE }, line: { color: COLOR_BORDER, width: 1.2 }, rectRadius: 0.1
  });
  slide6.addText("2. CORE CAPABILITIES OF THE PRODUCT", {
    x: 1.0, y: 3.25, w: 6.4, h: 0.3,
    fontSize: 11, fontFace: 'Arial', color: COLOR_BLUE, bold: true
  });

  const capabilities = [
    { title: "Multi-Modal Ingestion & Normalization: ", desc: "Auto-parses bank statements (PDF/CSV), Account Aggregator JSON, and GSTR-1/3B filings without manual data entry." },
    { title: "Deterministic Ratio Modeling: ", desc: "Computes Cash Buffer Ratio (>0.15x safety), Annualized Run Rate, and Inward NACH bounce friction." },
    { title: "GSTR Tax Reconciliation: ", desc: "Cross-checks declared outward sales (GSTR-1) against tax paid (GSTR-3B) to detect turnover misrepresentation." },
    { title: "Live Registry Web Scraper: ", desc: "Pulls real-time GSTIN validation, MCA21 director tracking, and court litigation records." },
    { title: "Conversational XAI Underwriter Drawer: ", desc: "Interactive drawer allowing loan officers to cross-examine decisions with zero hallucinations." }
  ];

  let capY = 3.6;
  capabilities.forEach(c => {
    slide6.addText([
      { text: "• " + c.title, options: { bold: true, color: COLOR_TEXT_PRIMARY } },
      { text: c.desc, options: { color: COLOR_TEXT_SECONDARY } }
    ], {
      x: 1.0, y: capY, w: 6.4, h: 0.58,
      fontSize: 9.8, fontFace: 'Arial', lineSpacing: 13
    });
    capY += 0.62;
  });

  // Bottom Right: Q3 Measurable Value
  slide6.addShape(pptx.ShapeType.roundRect, {
    x: 7.8, y: 3.1, w: 4.733, h: 4.0,
    fill: { color: COLOR_BG_SUBTLE }, line: { color: COLOR_BORDER, width: 1.2 }, rectRadius: 0.1
  });
  slide6.addText("3. MEASURABLE VALUE DELIVERED", {
    x: 8.0, y: 3.25, w: 4.3, h: 0.3,
    fontSize: 11, fontFace: 'Arial', color: COLOR_GREEN, bold: true
  });

  const valueStats = [
    { metric: "99.5% TAT Reduction", sub: "14 days down to < 55 seconds", color: COLOR_ORANGE_DARK, bg: COLOR_ORANGE_LIGHT },
    { metric: "99.8% Cost Savings", sub: "₹4,000 manual cost to ₹4.20 ($0.05)", color: COLOR_BLUE, bg: COLOR_BLUE_LIGHT },
    { metric: "Zero (0%) Hallucinations", sub: "100% deterministic line-item citations", color: COLOR_GREEN, bg: COLOR_GREEN_LIGHT },
    { metric: "+25% to +40% NTC Approvals", sub: "Expands credit pool without default risk", color: COLOR_TEXT_PRIMARY, bg: COLOR_CARD }
  ];

  let statY = 3.65;
  valueStats.forEach(s => {
    slide6.addShape(pptx.ShapeType.roundRect, {
      x: 8.0, y: statY, w: 4.333, h: 0.72,
      fill: { color: s.bg }, line: { color: COLOR_BORDER, width: 1 }, rectRadius: 0.08
    });
    slide6.addText(s.metric, {
      x: 8.15, y: statY + 0.08, w: 4.0, h: 0.3,
      fontSize: 12, fontFace: 'Arial', color: s.color, bold: true
    });
    slide6.addText(s.sub, {
      x: 8.15, y: statY + 0.36, w: 4.0, h: 0.28,
      fontSize: 9.5, fontFace: 'Arial', color: COLOR_TEXT_SECONDARY
    });
    statY += 0.8;
  });

  // =========================================================================
  // SLIDE 7: Technology & AI Architecture
  // =========================================================================
  const slide7 = pptx.addSlide();
  applySlideHeader(slide7, "Technology & AI Architecture");

  // Left Column: Q1 Architecture & Q2 AI Role
  slide7.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y: 1.5, w: 6.8, h: 5.6,
    fill: { color: COLOR_BG_SUBTLE }, line: { color: COLOR_BORDER, width: 1.2 }, rectRadius: 0.12
  });

  slide7.addText("1. END-TO-END ARCHITECTURE & DATA FLOW", {
    x: 1.0, y: 1.7, w: 6.4, h: 0.3,
    fontSize: 11, fontFace: 'Arial', color: COLOR_ORANGE_DARK, bold: true
  });

  slide7.addText([
    { text: "• Ingestion & Buffer Layer: ", options: { bold: true, color: COLOR_TEXT_PRIMARY } },
    { text: "React 19 client streams statements/CSVs to Node.js/Express API; temporary in-memory buffering with zero-trace post-processing scrubbing.\n", options: { color: COLOR_TEXT_SECONDARY } },
    { text: "• Agent 1 - FETCHA (Gemini 2.5 Flash): ", options: { bold: true, color: COLOR_TEXT_PRIMARY } },
    { text: "Parses high-density tabular statements in ~5.8s; executes live scraping for GSTIN status and MCA21 corporate registry data.\n", options: { color: COLOR_TEXT_SECONDARY } },
    { text: "• Agent 2 - GEEK (Gemini 2.5 Pro): ", options: { bold: true, color: COLOR_TEXT_PRIMARY } },
    { text: "Mathematical ratio matrix calculating Cash Buffer, Debt Service Capacity, and GSTR-1 vs 3B turnover alignment.\n", options: { color: COLOR_TEXT_SECONDARY } },
    { text: "• Agent 3 - ORC (Gemini 2.5 Pro): ", options: { bold: true, color: COLOR_TEXT_PRIMARY } },
    { text: "Chief Credit Officer orchestrating final 300-900 score, risk categorization, and immutable line-item evidence ledger.\n", options: { color: COLOR_TEXT_SECONDARY } },
    { text: "• Real-Time Cockpit: ", options: { bold: true, color: COLOR_TEXT_PRIMARY } },
    { text: "Server-Sent Events (SSE) stream agent updates to React dashboard.", options: { color: COLOR_TEXT_SECONDARY } }
  ], {
    x: 1.0, y: 2.05, w: 6.4, h: 2.4,
    fontSize: 9.8, fontFace: 'Arial', lineSpacing: 14
  });

  slide7.addShape(pptx.ShapeType.line, {
    x: 1.0, y: 4.6, w: 6.4, h: 0,
    line: { color: COLOR_BORDER, width: 1 }
  });

  slide7.addText("2. ROLE OF AI & WORKFLOWS POWERED BY IT", {
    x: 1.0, y: 4.75, w: 6.4, h: 0.3,
    fontSize: 11, fontFace: 'Arial', color: COLOR_BLUE, bold: true
  });

  slide7.addText([
    { text: "• Unstructured Tabular Normalization: ", options: { bold: true, color: COLOR_TEXT_PRIMARY } },
    { text: "Handles 50+ divergent Indian bank statement layouts, removing malformed OCR artifacts without data loss.\n", options: { color: COLOR_TEXT_SECONDARY } },
    { text: "• Multi-Source Anomaly Synthesis: ", options: { bold: true, color: COLOR_TEXT_PRIMARY } },
    { text: "Reconciles mismatches between declared tax turnover vs bank cash deposits.\n", options: { color: COLOR_TEXT_SECONDARY } },
    { text: "• Conversational XAI Drawer: ", options: { bold: true, color: COLOR_TEXT_PRIMARY } },
    { text: "Empowers underwriters to cross-examine loan decisions via natural language Q&A with direct ledger citations.", options: { color: COLOR_TEXT_SECONDARY } }
  ], {
    x: 1.0, y: 5.1, w: 6.4, h: 1.8,
    fontSize: 9.8, fontFace: 'Arial', lineSpacing: 14
  });

  // Right Column: Architecture Diagram Graphic
  slide7.addShape(pptx.ShapeType.roundRect, {
    x: 7.8, y: 1.5, w: 4.733, h: 5.6,
    fill: { color: COLOR_BG_SUBTLE }, line: { color: COLOR_BORDER, width: 1.2 }, rectRadius: 0.12
  });

  slide7.addText("CITADEL PIPELINE ARCHITECTURE", {
    x: 8.0, y: 1.7, w: 4.3, h: 0.3,
    fontSize: 11, fontFace: 'Arial', color: COLOR_ORANGE_DARK, bold: true, align: 'center'
  });

  if (fs.existsSync(archImgPath)) {
    slide7.addImage({
      path: archImgPath,
      x: 8.0, y: 2.1, w: 4.333, h: 4.7
    });
  } else {
    slide7.addText("Architecture Diagram Asset Ready", {
      x: 8.0, y: 3.5, w: 4.333, h: 1.0,
      fontSize: 12, fontFace: 'Arial', color: COLOR_TEXT_MUTED, align: 'center'
    });
  }

  // =========================================================================
  // SLIDE 8: Competitive Advantage
  // =========================================================================
  const slide8 = pptx.addSlide();
  applySlideHeader(slide8, "Competitive Advantage");

  // Left Box: Question 1
  slide8.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y: 1.5, w: 5.7, h: 5.6,
    fill: { color: COLOR_BG_SUBTLE }, line: { color: COLOR_BORDER, width: 1.2 }, rectRadius: 0.12
  });
  slide8.addShape(pptx.ShapeType.roundRect, {
    x: 1.1, y: 1.7, w: 5.1, h: 0.38,
    fill: { color: COLOR_ORANGE_LIGHT }, line: { color: COLOR_BORDER_ACCENT, width: 1 }, rectRadius: 0.06
  });
  slide8.addText("1. WHAT ALTERNATIVES EXIST TODAY & HOW DO WE COMPARE?", {
    x: 1.2, y: 1.7, w: 4.9, h: 0.38,
    fontSize: 9.5, fontFace: 'Arial', color: COLOR_ORANGE_DARK, bold: true, valign: 'middle'
  });

  slide8.addText("Legacy Bureaus & Brittle OCR vs. Agentic Intelligence", {
    x: 1.1, y: 2.2, w: 5.1, h: 0.55,
    fontSize: 14.5, fontFace: 'Arial', color: COLOR_TEXT_PRIMARY, bold: true
  });

  const compCards = [
    { title: "Legacy Bureaus (CIBIL/Experian):", desc: "Require 2+ years of formal repayment history. Exclude NTC borrowers completely. Artificer evaluates real-time cash flows with 0 bureau track record.", color: COLOR_TEXT_MUTED },
    { title: "Traditional Rule Engines (Perfios, Karza):", desc: "Rigid regex/keyword parsers that break on novel bank statement formats; lack holistic reasoning or tax reconciliation context.", color: COLOR_TEXT_MUTED },
    { title: "Generic LLM Wrappers:", desc: "Suffer from catastrophic arithmetic hallucinations, ungrounded scoring, and lack banking compliance security.", color: COLOR_TEXT_MUTED },
    { title: "EnverAI Artificer Citadel:", desc: "Combines high-speed agentic parsing, deterministic ratio math, NeMo guardrails, and line-item evidence citations in < 55s.", color: COLOR_GREEN }
  ];

  let compY = 2.85;
  compCards.forEach(c => {
    slide8.addShape(pptx.ShapeType.roundRect, {
      x: 1.1, y: compY, w: 5.1, h: 0.95,
      fill: { color: COLOR_CARD }, line: { color: COLOR_BORDER, width: 1 }, rectRadius: 0.06
    });
    slide8.addText(c.title, {
      x: 1.25, y: compY + 0.08, w: 4.8, h: 0.28,
      fontSize: 10.5, fontFace: 'Arial', color: c.color === COLOR_GREEN ? COLOR_GREEN : COLOR_TEXT_PRIMARY, bold: true
    });
    slide8.addText(c.desc, {
      x: 1.25, y: compY + 0.36, w: 4.8, h: 0.52,
      fontSize: 9.2, fontFace: 'Arial', color: COLOR_TEXT_SECONDARY, lineSpacing: 13
    });
    compY += 1.05;
  });

  // Right Box: Question 2
  slide8.addShape(pptx.ShapeType.roundRect, {
    x: 6.833, y: 1.5, w: 5.7, h: 5.6,
    fill: { color: COLOR_BG_SUBTLE }, line: { color: COLOR_BORDER, width: 1.2 }, rectRadius: 0.12
  });
  slide8.addShape(pptx.ShapeType.roundRect, {
    x: 7.133, y: 1.7, w: 5.1, h: 0.38,
    fill: { color: COLOR_GREEN_LIGHT }, line: { color: COLOR_BORDER, width: 1 }, rectRadius: 0.06
  });
  slide8.addText("2. IF A FOUNDATION MODEL SHIPS THIS TOMORROW, WHY DO WE WIN?", {
    x: 7.233, y: 1.7, w: 4.9, h: 0.38,
    fontSize: 9.2, fontFace: 'Arial', color: COLOR_GREEN, bold: true, valign: 'middle'
  });

  slide8.addText("India Stack Moat, Decoupled Math & Institutional Trust", {
    x: 7.133, y: 2.2, w: 5.1, h: 0.55,
    fontSize: 14.5, fontFace: 'Arial', color: COLOR_TEXT_PRIMARY, bold: true
  });

  slide8.addText([
    { text: "Four Defensibility Moats Against Foundation Models:\n\n", options: { bold: true, color: COLOR_GREEN } },
    { text: "1. India Stack & Regulatory Domain Moat: ", options: { bold: true, color: COLOR_TEXT_PRIMARY } },
    { text: "General LLMs do not understand RBI Fair Lending mandates, Account Aggregator consent flows, or Indian tax nuances (GSTR-1 vs 3B turnover reconciliation).\n\n", options: { color: COLOR_TEXT_SECONDARY } },
    { text: "2. Decoupled Persona Architecture: ", options: { bold: true, color: COLOR_TEXT_PRIMARY } },
    { text: "A single LLM prompt fails on high-density financial arithmetic. We decouple ingestion (Fetcha), deterministic math (Geek), and synthesis (Orc).\n\n", options: { color: COLOR_TEXT_SECONDARY } },
    { text: "3. Enterprise Security Citadel: ", options: { bold: true, color: COLOR_TEXT_PRIMARY } },
    { text: "Turnkey enterprise governance: Google SSO domain locks, Citadel password walls, 5-minute silent sentinels, and Slack SecOps alerts.\n\n", options: { color: COLOR_TEXT_SECONDARY } },
    { text: "4. Fine-Tuned Domain Data Flywheel: ", options: { bold: true, color: COLOR_TEXT_PRIMARY } },
    { text: "Continually tuned on Indian MSME transactional ledgers and loan default correlation benchmarks.", options: { color: COLOR_TEXT_SECONDARY } }
  ], {
    x: 7.133, y: 2.8, w: 5.1, h: 4.1,
    fontSize: 10, fontFace: 'Arial', lineSpacing: 15
  });

  // =========================================================================
  // SLIDE 9: Vision & Roadmap
  // =========================================================================
  const slide9 = pptx.addSlide();
  applySlideHeader(slide9, "Vision & Roadmap");

  // Left Box: Question 1
  slide9.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y: 1.5, w: 5.7, h: 5.6,
    fill: { color: COLOR_BG_SUBTLE }, line: { color: COLOR_BORDER, width: 1.2 }, rectRadius: 0.12
  });
  slide9.addShape(pptx.ShapeType.roundRect, {
    x: 1.1, y: 1.7, w: 5.1, h: 0.38,
    fill: { color: COLOR_ORANGE_LIGHT }, line: { color: COLOR_BORDER_ACCENT, width: 1 }, rectRadius: 0.06
  });
  slide9.addText("1. WHAT ARE YOUR NEXT MAJOR PRODUCT & BUSINESS MILESTONES?", {
    x: 1.2, y: 1.7, w: 4.9, h: 0.38,
    fontSize: 9.5, fontFace: 'Arial', color: COLOR_ORANGE_DARK, bold: true, valign: 'middle'
  });

  slide9.addText("12-Month Institutional Scaling Trajectory", {
    x: 1.1, y: 2.2, w: 5.1, h: 0.55,
    fontSize: 15, fontFace: 'Arial', color: COLOR_TEXT_PRIMARY, bold: true
  });

  const milestones = [
    {
      quarter: "Q3 2026: Production Certification & AA Integration",
      bullets: "• Direct SDK integration with Sahamati Account Aggregators (Setu, Anumati, Finvu).\n• Complete SOC2 Type II and ISO 27001 banking security audits.",
      color: COLOR_ORANGE_DARK
    },
    {
      quarter: "Q4 2026: Institutional Pilot Deployments",
      bullets: "• Launch paid shadow-underwriting pilots with 3 Small Finance Banks (SFBs) & NBFCs.\n• Evaluate 50,000 live NTC loan files in parallel with human underwriters.",
      color: COLOR_BLUE
    },
    {
      quarter: "Q1-Q2 2027: Ecosystem Expansion (OCEN & ULI)",
      bullets: "• Release real-time pre-underwriting API for RBI Unified Lending Interface (ULI) and OCEN 4.0.\n• Deploy automated post-disbursal early-warning covenant tracking.",
      color: COLOR_GREEN
    }
  ];

  let msY = 2.85;
  milestones.forEach(m => {
    slide9.addShape(pptx.ShapeType.roundRect, {
      x: 1.1, y: msY, w: 5.1, h: 1.25,
      fill: { color: COLOR_CARD }, line: { color: COLOR_BORDER, width: 1 }, rectRadius: 0.08
    });
    slide9.addText(m.quarter, {
      x: 1.25, y: msY + 0.1, w: 4.8, h: 0.3,
      fontSize: 11, fontFace: 'Arial', color: m.color, bold: true
    });
    slide9.addText(m.bullets, {
      x: 1.25, y: msY + 0.42, w: 4.8, h: 0.75,
      fontSize: 9.5, fontFace: 'Arial', color: COLOR_TEXT_SECONDARY, lineSpacing: 14
    });
    msY += 1.35;
  });

  // Right Box: Question 2
  slide9.addShape(pptx.ShapeType.roundRect, {
    x: 6.833, y: 1.5, w: 5.7, h: 5.6,
    fill: { color: COLOR_BG_SUBTLE }, line: { color: COLOR_BORDER, width: 1.2 }, rectRadius: 0.12
  });
  slide9.addShape(pptx.ShapeType.roundRect, {
    x: 7.133, y: 1.7, w: 5.1, h: 0.38,
    fill: { color: COLOR_GREEN_LIGHT }, line: { color: COLOR_BORDER, width: 1 }, rectRadius: 0.06
  });
  slide9.addText("2. WHAT IS YOUR LONG-TERM VISION FOR THE STARTUP?", {
    x: 7.233, y: 1.7, w: 4.9, h: 0.38,
    fontSize: 10.5, fontFace: 'Arial', color: COLOR_GREEN, bold: true, valign: 'middle'
  });

  slide9.addText("The Autonomous Credit Operating System for Emerging Markets", {
    x: 7.133, y: 2.2, w: 5.1, h: 0.55,
    fontSize: 15, fontFace: 'Arial', color: COLOR_TEXT_PRIMARY, bold: true
  });

  slide9.addText([
    { text: "• Global Emerging Markets Expansion: ", options: { bold: true, color: COLOR_TEXT_PRIMARY } },
    { text: "Scale Artificer's alternate-data underwriting engine across Southeast Asia, Middle East, and Latin America where MSME credit deficits exceed $1.5 Trillion.\n\n", options: { color: COLOR_TEXT_SECONDARY } },
    { text: "• Democratizing $100 Billion+ in Inclusive Capital: ", options: { bold: true, color: COLOR_TEXT_PRIMARY } },
    { text: "Eliminate collateral requirements for creditworthy small businesses, enabling 100 million micro-merchants to access formal credit at fair interest rates.\n\n", options: { color: COLOR_TEXT_SECONDARY } },
    { text: "• Ubiquitous Financial Risk Infrastructure: ", options: { bold: true, color: COLOR_TEXT_PRIMARY } },
    { text: "Expand the EnverAI Agent OS from origination underwriting into automated loan servicing, dynamic credit line adjustments, and real-time fraud mitigation.", options: { color: COLOR_TEXT_SECONDARY } }
  ], {
    x: 7.133, y: 2.85, w: 5.1, h: 4.0,
    fontSize: 10.5, fontFace: 'Arial', lineSpacing: 16
  });

  // =========================================================================
  // SLIDE 10: Team
  // =========================================================================
  const slide10 = pptx.addSlide();
  applySlideHeader(slide10, "Team");

  // Left Box: Question 1
  slide10.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y: 1.5, w: 5.7, h: 5.6,
    fill: { color: COLOR_BG_SUBTLE }, line: { color: COLOR_BORDER, width: 1.2 }, rectRadius: 0.12
  });
  slide10.addShape(pptx.ShapeType.roundRect, {
    x: 1.1, y: 1.7, w: 5.1, h: 0.38,
    fill: { color: COLOR_ORANGE_LIGHT }, line: { color: COLOR_BORDER_ACCENT, width: 1 }, rectRadius: 0.06
  });
  slide10.addText("1. WHY IS YOUR TEAM UNIQUELY POSITIONED TO SOLVE THIS?", {
    x: 1.2, y: 1.7, w: 4.9, h: 0.38,
    fontSize: 9.5, fontFace: 'Arial', color: COLOR_ORANGE_DARK, bold: true, valign: 'middle'
  });

  slide10.addText("Rare Intersection of FinTech, Multi-Agent AI & System Rigor", {
    x: 1.1, y: 2.2, w: 5.1, h: 0.55,
    fontSize: 14.5, fontFace: 'Arial', color: COLOR_TEXT_PRIMARY, bold: true
  });

  slide10.addText([
    { text: "• Proven Execution Velocity: ", options: { bold: true, color: COLOR_TEXT_PRIMARY } },
    { text: "Designed, engineered, benchmarked, and deployed a production-grade multi-agent underwriting platform in record time, validated on 1,000+ real-world financial records.\n\n", options: { color: COLOR_TEXT_SECONDARY } },
    { text: "• Obsession with Explainable AI & Zero Hallucinations: ", options: { bold: true, color: COLOR_TEXT_PRIMARY } },
    { text: "Unlike teams building generic chatbots, we engineered isolated persona segregation and deterministic mathematical guardrails to satisfy stringent banking audit standards.\n\n", options: { color: COLOR_TEXT_SECONDARY } },
    { text: "• Deep Understanding of Credit Realities: ", options: { bold: true, color: COLOR_TEXT_PRIMARY } },
    { text: "We understand that MSME lending isn't just about parsing text — it requires evaluating liquidity buffers, tax compliance regularities, and business resilience under macro stress.", options: { color: COLOR_TEXT_SECONDARY } }
  ], {
    x: 1.1, y: 2.8, w: 5.1, h: 4.1,
    fontSize: 10.2, fontFace: 'Arial', lineSpacing: 15
  });

  // Right Box: Question 2
  slide10.addShape(pptx.ShapeType.roundRect, {
    x: 6.833, y: 1.5, w: 5.7, h: 5.6,
    fill: { color: COLOR_BG_SUBTLE }, line: { color: COLOR_BORDER, width: 1.2 }, rectRadius: 0.12
  });
  slide10.addShape(pptx.ShapeType.roundRect, {
    x: 7.133, y: 1.7, w: 5.1, h: 0.38,
    fill: { color: COLOR_GREEN_LIGHT }, line: { color: COLOR_BORDER, width: 1 }, rectRadius: 0.06
  });
  slide10.addText("2. WHAT DOMAIN & TECHNICAL EXPERTISE DOES THE TEAM BRING?", {
    x: 7.233, y: 1.7, w: 4.9, h: 0.38,
    fontSize: 9.2, fontFace: 'Arial', color: COLOR_GREEN, bold: true, valign: 'middle'
  });

  slide10.addText("Technical Depth Across Google Vertex AI & Banking Tech", {
    x: 7.133, y: 2.2, w: 5.1, h: 0.55,
    fontSize: 14.5, fontFace: 'Arial', color: COLOR_TEXT_PRIMARY, bold: true
  });

  const teamCards = [
    { title: "Multi-Agent AI & LLM Engineering", desc: "Expertise in Google Gemini 2.5 Flash & Pro, Vertex AI SDK, prompt isolation, NeMo guardrail implementations, and structured JSON output guarantees.", color: COLOR_ORANGE_DARK },
    { title: "Full-Stack Enterprise Cloud Architecture", desc: "High-throughput Node.js/Express backends, React 19 frontends, Server-Sent Events (SSE) telemetry, Firebase, and enterprise Docker/VPC deployments.", color: COLOR_BLUE },
    { title: "Indian FinTech & Regulatory Mastery", desc: "Comprehensive knowledge of RBI digital lending regulations, Account Aggregator consent models, GSTN schemas, and banking core integration.", color: COLOR_GREEN }
  ];

  let tmY = 2.85;
  teamCards.forEach(t => {
    slide10.addShape(pptx.ShapeType.roundRect, {
      x: 7.133, y: tmY, w: 5.1, h: 1.25,
      fill: { color: COLOR_CARD }, line: { color: COLOR_BORDER, width: 1 }, rectRadius: 0.08
    });
    slide10.addText(t.title, {
      x: 7.283, y: tmY + 0.1, w: 4.8, h: 0.3,
      fontSize: 11, fontFace: 'Arial', color: t.color, bold: true
    });
    slide10.addText(t.desc, {
      x: 7.283, y: tmY + 0.42, w: 4.8, h: 0.75,
      fontSize: 9.5, fontFace: 'Arial', color: COLOR_TEXT_SECONDARY, lineSpacing: 14
    });
    tmY += 1.35;
  });

  // =========================================================================
  // SLIDE 11: Why BITSoM Vertex?
  // =========================================================================
  const slide11 = pptx.addSlide();
  applySlideHeader(slide11, "Why BITSoM Vertex?");

  // Left Box: Question 1
  slide11.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y: 1.5, w: 5.7, h: 5.6,
    fill: { color: COLOR_BG_SUBTLE }, line: { color: COLOR_BORDER, width: 1.2 }, rectRadius: 0.12
  });
  slide11.addShape(pptx.ShapeType.roundRect, {
    x: 1.1, y: 1.7, w: 5.1, h: 0.38,
    fill: { color: COLOR_ORANGE_LIGHT }, line: { color: COLOR_BORDER_ACCENT, width: 1 }, rectRadius: 0.06
  });
  slide11.addText("1. WHY HAVE YOU APPLIED TO THE BITSOM VERTEX PROGRAMME?", {
    x: 1.2, y: 1.7, w: 4.9, h: 0.38,
    fontSize: 9.5, fontFace: 'Arial', color: COLOR_ORANGE_DARK, bold: true, valign: 'middle'
  });

  slide11.addText("Institutional Mentorship & Banking Network", {
    x: 1.1, y: 2.2, w: 5.1, h: 0.55,
    fontSize: 15, fontFace: 'Arial', color: COLOR_TEXT_PRIMARY, bold: true
  });

  slide11.addText([
    { text: "• Mentorship from Senior Banking Leaders: ", options: { bold: true, color: COLOR_TEXT_PRIMARY } },
    { text: "Direct guidance from veteran Chief Risk Officers (CROs) and FinTech leaders to refine our 300-900 scoring calibration and enterprise GTM playbook.\n\n", options: { color: COLOR_TEXT_SECONDARY } },
    { text: "• Building on FITT, Jubilant & Hub71 Validation: ", options: { bold: true, color: COLOR_TEXT_PRIMARY } },
    { text: "Having earned selection for FITT (IIT Delhi) and Jubilant Life Foundation incubators, and completed the Hub71 Validation Workshop, BITSoM Vertex provides the specific commercial banking bridge and institutional trust to close enterprise bank pilots.\n\n", options: { color: COLOR_TEXT_SECONDARY } },
    { text: "• Regulatory Sandbox Navigation: ", options: { bold: true, color: COLOR_TEXT_PRIMARY } },
    { text: "Strategic mentorship to fast-track inclusion into RBI regulatory sandbox cohorts and structured institutional co-lending partnerships.", options: { color: COLOR_TEXT_SECONDARY } }
  ], {
    x: 1.1, y: 2.8, w: 5.1, h: 4.1,
    fontSize: 10, fontFace: 'Arial', lineSpacing: 15
  });

  // Right Box: Question 2
  slide11.addShape(pptx.ShapeType.roundRect, {
    x: 6.833, y: 1.5, w: 5.7, h: 5.6,
    fill: { color: COLOR_BG_SUBTLE }, line: { color: COLOR_BORDER, width: 1.2 }, rectRadius: 0.12
  });
  slide11.addShape(pptx.ShapeType.roundRect, {
    x: 7.133, y: 1.7, w: 5.1, h: 0.38,
    fill: { color: COLOR_GREEN_LIGHT }, line: { color: COLOR_BORDER, width: 1 }, rectRadius: 0.06
  });
  slide11.addText("2. WHICH CHALLENGE IS CURRENTLY LIMITING YOUR GROWTH?", {
    x: 7.233, y: 1.7, w: 4.9, h: 0.38,
    fontSize: 10, fontFace: 'Arial', color: COLOR_GREEN, bold: true, valign: 'middle'
  });

  slide11.addText("Enterprise Banking Procurement Cycles & Live Sandbox Access", {
    x: 7.133, y: 2.2, w: 5.1, h: 0.55,
    fontSize: 14.5, fontFace: 'Arial', color: COLOR_TEXT_PRIMARY, bold: true
  });

  slide11.addText([
    { text: "• Long Enterprise Sales Cycles (6 to 9 Months): ", options: { bold: true, color: COLOR_TEXT_PRIMARY } },
    { text: "Selling to commercial banks requires navigating bureaucratic committee procurement. BITSoM Vertex provides executive access to CROs/CCOs, shrinking sales cycles from months to weeks.\n\n", options: { color: COLOR_TEXT_SECONDARY } },
    { text: "• Access to Live Institutional Shadow-Underwriting: ", options: { bold: true, color: COLOR_TEXT_PRIMARY } },
    { text: "While our engine is validated on 1,000+ real records, we need formal banking sandbox partnerships to evaluate live loan files in parallel with human underwriting teams to establish statistical default-prediction proofs.\n\n", options: { color: COLOR_TEXT_SECONDARY } },
    { text: "• Vertex Catalytic Value: ", options: { bold: true, color: COLOR_TEXT_PRIMARY } },
    { text: "Provides the ecosystem backing to transition Artificer from validated prototype to deployed banking infrastructure.", options: { color: COLOR_TEXT_SECONDARY } }
  ], {
    x: 7.133, y: 2.8, w: 5.1, h: 4.1,
    fontSize: 10.2, fontFace: 'Arial', lineSpacing: 15
  });

  // =========================================================================
  // SLIDE 12: Supporting Material
  // =========================================================================
  const slide12 = pptx.addSlide();
  applySlideHeader(slide12, "Supporting Material");

  slide12.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y: 1.5, w: 11.733, h: 5.6,
    fill: { color: COLOR_BG_SUBTLE }, line: { color: COLOR_BORDER, width: 1.2 }, rectRadius: 0.12
  });

  slide12.addText("PROJECT ARTIFACTS, LIVE PROTOTYPE & VERIFICATION LINKS", {
    x: 1.1, y: 1.7, w: 11.0, h: 0.35,
    fontSize: 12, fontFace: 'Arial', color: COLOR_ORANGE_DARK, bold: true
  });

  const links = [
    { label: "Deployed Project Link:", val: "https://enveraitech.in/artificer (Local Development: http://localhost:5173)", color: COLOR_BLUE },
    { label: "Project Demo Video (3–5 Minutes):", val: "High-definition walkthrough showcasing multi-agent ingestion, financial ratio matrix, and Conversational XAI Drawer.", color: COLOR_ORANGE_DARK },
    { label: "Website:", val: "https://enveraitech.com", color: COLOR_GREEN },
    { label: "GitHub Repository:", val: "https://github.com/Amaan-cmd/IDBI-Artificer", color: COLOR_TEXT_PRIMARY },
    { label: "Product Documentation:", val: "Comprehensive technical specifications in repository root (ARTIFICER.md, IDBI_ARTIFICER_EXPLAINER.md, PRD.md, TRD.md)", color: COLOR_BLUE },
    { label: "Contact Details:", val: "Founding Team • daddy@enveraitech.com / contact@enveraitech.com • EnverAI Tech Inc.", color: COLOR_ORANGE_DARK }
  ];

  let lkY = 2.15;
  links.forEach(l => {
    slide12.addShape(pptx.ShapeType.roundRect, {
      x: 1.1, y: lkY, w: 11.133, h: 0.72,
      fill: { color: COLOR_CARD }, line: { color: COLOR_BORDER, width: 1 }, rectRadius: 0.08
    });
    slide12.addText(l.label, {
      x: 1.3, y: lkY + 0.08, w: 4.0, h: 0.28,
      fontSize: 11, fontFace: 'Arial', color: l.color, bold: true
    });
    slide12.addText(l.val, {
      x: 1.3, y: lkY + 0.36, w: 10.6, h: 0.28,
      fontSize: 10, fontFace: 'Arial', color: COLOR_TEXT_SECONDARY
    });
    lkY += 0.82;
  });

  // =========================================================================
  // SLIDE 13: Thank You Slide
  // =========================================================================
  const slide13 = pptx.addSlide();
  slide13.background = { color: COLOR_BG };

  // Top branding
  slide13.addText("BITSoM vertex  |  H2S", {
    x: 0.8, y: 0.45, w: 5.0, h: 0.4,
    fontSize: 15, fontFace: 'Arial', color: '1E293B', bold: true
  });
  slide13.addText("Builders Pitch Fest 2026", {
    x: 7.5, y: 0.45, w: 5.0, h: 0.4,
    fontSize: 15, fontFace: 'Arial', color: COLOR_ORANGE, bold: true, align: 'right'
  });

  // Orange accent bar in middle
  slide13.addShape(pptx.ShapeType.rect, {
    x: 0, y: 3.25, w: 13.333, h: 0.08,
    fill: { color: COLOR_ORANGE }, line: { color: COLOR_ORANGE, width: 0 }
  });

  // Top Section
  slide13.addText("Builders\nPitch Fest 2026", {
    x: 0.8, y: 1.1, w: 8.0, h: 1.8,
    fontSize: 38, fontFace: 'Arial', color: COLOR_ORANGE, bold: true, lineSpacing: 42
  });

  // Bottom Section Card
  slide13.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y: 3.55, w: 11.733, h: 3.3,
    fill: { color: COLOR_BG_SUBTLE }, line: { color: COLOR_BORDER, width: 1.2 }, rectRadius: 0.12
  });

  slide13.addText("THANK YOU", {
    x: 1.2, y: 3.85, w: 8.0, h: 0.8,
    fontSize: 44, fontFace: 'Arial', color: COLOR_TEXT_PRIMARY, bold: true
  });

  slide13.addText("EnverAI Artificer: Autonomous, Explainable MSME Credit Intelligence", {
    x: 1.2, y: 4.7, w: 10.8, h: 0.5,
    fontSize: 16, fontFace: 'Arial', color: COLOR_ORANGE_DARK, bold: true
  });

  slide13.addText("We are excited to partner with BITSoM Vertex to unlock $300 Billion in MSME credit.\nReady for reviewer questions, prototype demonstration, and deep-dive technical evaluation.", {
    x: 1.2, y: 5.25, w: 10.8, h: 0.7,
    fontSize: 12, fontFace: 'Arial', color: COLOR_TEXT_SECONDARY, lineSpacing: 18
  });

  slide13.addText("Contact: daddy@enveraitech.com • Website: enveraitech.com • GitHub: github.com/Amaan-cmd/IDBI-Artificer", {
    x: 1.2, y: 6.2, w: 10.8, h: 0.35,
    fontSize: 11, fontFace: 'Arial', color: COLOR_TEXT_MUTED
  });

  // Bottom glowing accent bar
  slide13.addShape(pptx.ShapeType.rect, {
    x: 0, y: 7.38, w: 13.333, h: 0.12,
    fill: { color: COLOR_ORANGE }, line: { color: COLOR_ORANGE, width: 0 }
  });

  // Save presentations cleanly
  const backupFile = 'BITSoM_Vertex_PitchFest_2026_Artificer.pptx';
  await pptx.writeFile({ fileName: backupFile });
  console.log(`[Success] Master presentation generated: ${backupFile}`);

  const v2File = 'EnverAI_Artificer_BITSoM_2026.pptx';
  await pptx.writeFile({ fileName: v2File });
  console.log(`[Success] Master presentation generated: ${v2File}`);

  const outputFile = 'EnverAI_BITSoM_Pitch_Deck.pptx';
  try {
    await pptx.writeFile({ fileName: outputFile });
    console.log(`[Success] Master presentation generated: ${outputFile}`);
  } catch (err) {
    if (err.code === 'EBUSY') {
      console.log(`[Notice] ${outputFile} is currently open in PowerPoint viewer. Please check ${backupFile} or ${v2File}.`);
    } else {
      throw err;
    }
  }
}

generatePitchDeck().catch(err => {
  console.error('[Error] Deck generation failed:', err);
  process.exit(1);
});
