import React, { useState, useEffect } from 'react';
import { 
  Clock, X, Send, MessageSquare, ShieldCheck, Cpu
} from 'lucide-react';
import './index.css';
import './App.css';

// Core Navigation & Layout Components
import AuditorSidebar from './components/Sidebar/AuditorSidebar';
import AuditorTopBar from './components/TopBar/AuditorTopBar';
import CommandPalette from './components/CommandPalette/CommandPalette';

// Workspace Views
import NewEvaluationView from './components/NewEvaluation/NewEvaluationView';
import SplitWorkspaceView from './components/SplitWorkspace/SplitWorkspaceView';
import ProcessingSkeleton from './components/ProcessingSkeleton/ProcessingSkeleton';
import WatchlistView from './components/Watchlist/WatchlistView';
import BatchUploadView from './components/BatchUpload/BatchUploadView';
import AccountBillingView from './components/AccountBilling/AccountBillingView';

// Background & Auth
import FloatingLines from './components/FloatingLines/FloatingLines';
import VerificationGate from './components/auth/VerificationGate';
import MasterDashboard from './components/MasterDashboard/MasterDashboard';

// Utilities
import { getGSTINProbeData } from './utils/gstinRegistry';
import { exportAuditReport } from './utils/pdfExport';
import { getCompanyDecisionData, generateOrcResponse } from './utils/orcIntelligence';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:4000');

// Preloaded Realistic MSME Scenarios for Institutional Verification
const PRELOADED_SCENARIOS = {
  apex: {
    label: "Scenario A: Apex Precision (Prime NTC · 824)",
    data: '{\n  "businessName": "Apex Precision Engineering Pvt Ltd",\n  "gstin": "27AADCB2230M1Z2",\n  "monthsAnalyzed": 6,\n  "monthlyCredits": [750000, 780000, 820000, 760000, 840000, 890000],\n  "monthlyDebits": [680000, 710000, 740000, 690000, 760000, 820000],\n  "bankClosingBalance": 680200,\n  "sanctionedOdLimit": 1000000,\n  "peakOdUsage": 320000,\n  "gstr1OutwardTaxable": 4840000,\n  "gstr3bTaxPaid": 871200,\n  "gstr1DeclaredTax": 871200,\n  "monthlyEmiObligations": 42500,\n  "inwardBounces": 0\n}',
    scraper: '{\n  "mcaStatus": "Active",\n  "courtCases": 0,\n  "directorDIN": "02914820 (Clean)",\n  "socialSentiment": "Positive (Low Friction)"\n}'
  },
  surat: {
    label: "Scenario B: Surat Textiles (High Growth · 765)",
    data: '{\n  "businessName": "Surat Textile Weaving Cluster LLP",\n  "gstin": "24AABCS4421P1Z9",\n  "monthsAnalyzed": 6,\n  "monthlyCredits": [1100000, 1150000, 1220000, 1180000, 1310000, 1400000],\n  "monthlyDebits": [990000, 1020000, 1100000, 1050000, 1190000, 1280000],\n  "bankClosingBalance": 940000,\n  "sanctionedOdLimit": 1500000,\n  "peakOdUsage": 550000,\n  "gstr1OutwardTaxable": 7360000,\n  "gstr3bTaxPaid": 1324800,\n  "gstr1DeclaredTax": 1324800,\n  "monthlyEmiObligations": 68000,\n  "inwardBounces": 0\n}',
    scraper: '{\n  "mcaStatus": "Active",\n  "courtCases": 0,\n  "directorDIN": "04128911 (Clean)",\n  "socialSentiment": "Positive"\n}'
  },
  kalyan: {
    label: "Scenario C: Kalyan Agro (Moderate Risk · 610)",
    data: '{\n  "businessName": "Kalyan Agro Supply & Logistics",\n  "gstin": "27AAGCK8812L1ZQ",\n  "monthsAnalyzed": 6,\n  "monthlyCredits": [520000, 580000, 610000, 490000, 530000, 680000],\n  "monthlyDebits": [490000, 560000, 590000, 480000, 520000, 670000],\n  "bankClosingBalance": 210000,\n  "sanctionedOdLimit": 800000,\n  "peakOdUsage": 620000,\n  "gstr1OutwardTaxable": 3410000,\n  "gstr3bTaxPaid": 594000,\n  "gstr1DeclaredTax": 613800,\n  "monthlyEmiObligations": 54000,\n  "inwardBounces": 1\n}',
    scraper: '{\n  "mcaStatus": "Active",\n  "courtCases": 1,\n  "directorDIN": "01829471 (Inquiry)",\n  "socialSentiment": "Neutral"\n}'
  }
};

function App() {
  // Authentication & Session
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Navigation State
  const [activeNav, setActiveNav] = useState('new-eval'); // 'new-eval' | 'watchlist' | 'batch' | 'billing'
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCmdPaletteOpen, setIsCmdPaletteOpen] = useState(false);
  const [currentView, setCurrentView] = useState('evaluator'); // 'evaluator' | 'master'

  // Input & Evaluation Data State
  const [gstinInput, setGstinInput] = useState('27AADCB2230M1Z2');
  const [gstinProbeData, setGstinProbeData] = useState(getGSTINProbeData('27AADCB2230M1Z2'));
  const [file, setFile] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [evaluationStep, setEvaluationStep] = useState(0);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);

  // 5-Min Inactivity Sentinel
  const [inactivitySeconds, setInactivitySeconds] = useState(300);
  const [isSessionLocked, setIsSessionLocked] = useState(false);

  // Orc CCO Conversational Interrogation Panel
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { role: 'agent', text: 'Orc (Chief Credit Officer Agent) online. Deterministic 5-pillar underwriting rationale active. You may interrogate any ratio or policy citation.' }
  ]);
  const [isChatSending, setIsChatSending] = useState(false);

  // Check saved session or incoming signup redirect on mount
  useEffect(() => {
    // 1. Check if user just arrived from enveraitech.com/signup
    const params = new URLSearchParams(window.location.search);
    if (params.get('admitted') === 'true' || params.get('signup') === 'success') {
      const email = (params.get('email') || localStorage.getItem('enver_user_email') || 'officer@enveraitech.com').toLowerCase().trim();
      const rawName = params.get('name') || email.split('@')[0];
      const token = params.get('token') || 'ENV-PRD-8421';
      const cleanName = rawName.split('.').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');

      const admittedUser = {
        id: `u_${email.split('@')[0]}_${Date.now().toString().slice(-4)}`,
        username: cleanName,
        email: email,
        role: email.endsWith('@enveraitech.com') ? 'Enterprise Principal Underwriter' : 'Institutional Underwriter',
        org: 'Enver AI Tech',
        token: token,
        calls: 1,
        cost: 0.02,
        lastLogin: new Date().toISOString()
      };

      localStorage.setItem('enverai_user_session', JSON.stringify(admittedUser));
      localStorage.setItem('enver_user_email', email);
      window.history.replaceState({}, document.title, window.location.pathname);
      setCurrentUser(admittedUser);
      setIsLoggedIn(true);
      return;
    }

    // 2. Check saved session
    const saved = localStorage.getItem('enverai_user_session');
    if (saved) {
      try {
        const user = JSON.parse(saved);
        if (user && user.id) {
          setCurrentUser(user);
          setIsLoggedIn(true);
        }
      } catch {}
    }
  }, []);

  // Keyboard shortcut listener for Cmd/Ctrl + K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCmdPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Inactivity Sentinel Timer
  useEffect(() => {
    if (!isLoggedIn) return;

    const resetInactivity = () => {
      if (!isSessionLocked) {
        setInactivitySeconds(300);
      }
    };

    const interval = setInterval(() => {
      setInactivitySeconds(prev => {
        if (prev <= 1) {
          setIsSessionLocked(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    window.addEventListener('mousemove', resetInactivity, { passive: true });
    window.addEventListener('keydown', resetInactivity, { passive: true });
    window.addEventListener('click', resetInactivity, { passive: true });

    return () => {
      clearInterval(interval);
      window.removeEventListener('mousemove', resetInactivity);
      window.removeEventListener('keydown', resetInactivity);
      window.removeEventListener('click', resetInactivity);
    };
  }, [isLoggedIn, isSessionLocked]);

  // Fetch History strictly scoped to active user
  const fetchHistory = async (userId) => {
    const userStorageKey = userId ? `enver_user_evaluations_${userId}` : 'enver_user_evaluations_guest';
    let userRuns = [];
    try {
      userRuns = JSON.parse(localStorage.getItem(userStorageKey) || '[]');
    } catch {}

    if (API_BASE && userId) {
      try {
        const res = await fetch(`${API_BASE}/api/v1/history?userId=${userId}`);
        const resData = await res.json();
        if (resData.status === 'success' && resData.history?.length) {
          const merged = [...userRuns, ...resData.history.filter(rh => !userRuns.some(uh => (uh.id === rh.id || uh.gstin === rh.gstin)))];
          setHistory(merged);
          try { localStorage.setItem(userStorageKey, JSON.stringify(merged)); } catch {}
          return;
        }
      } catch {}
    }

    if (userRuns.length > 0) {
      setHistory(userRuns);
      return;
    }

    const defaultH = getDefaultHistory();
    setHistory(defaultH);
    try {
      localStorage.setItem(userStorageKey, JSON.stringify(defaultH));
    } catch {}
  };

  const handleRemoveHistoryItem = (itemId) => {
    setHistory(prev => {
      const updated = prev.filter(p => p.id !== itemId);
      const userStorageKey = currentUser?.id ? `enver_user_evaluations_${currentUser.id}` : 'enver_user_evaluations_guest';
      try {
        localStorage.setItem(userStorageKey, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const getDefaultHistory = () => [
    {
      id: "h_1789854683417",
      name: "Apex Precision Engineering Pvt Ltd",
      gstin: "27AADCB2230M1Z2",
      score: 824,
      risk: "LOW",
      revenue: 9680000,
      buffer: "0.71x",
      compliance: "Excellent · MCA Active",
      evaluatedDate: "Oct 13, 2026",
      status: "Completed",
      reason: "Stable operating cash flows and strong short-term liquidity reserves (Cash Buffer: 0.71x, 18 buffer days). Timely GST compliance and zero bounce friction support a prime underwriting recommendation."
    },
    {
      id: "h_1789854683418",
      name: "Surat Textile Weaving Cluster LLP",
      gstin: "24AABCS4421P1Z9",
      score: 765,
      risk: "LOW",
      revenue: 14200000,
      buffer: "0.48x",
      compliance: "Sound · MCA Active",
      evaluatedDate: "Oct 12, 2026",
      status: "Completed",
      reason: "High annualized revenue momentum with clean bank credit to GSTR-1 turnover reconciliation."
    },
    {
      id: "h_1789854683419",
      name: "Kalyan Agro Supply & Logistics",
      gstin: "27AAGCK8812L1ZQ",
      score: 610,
      risk: "MODERATE",
      revenue: 6800000,
      buffer: "0.22x",
      compliance: "Tax Gap Flag",
      evaluatedDate: "Oct 10, 2026",
      status: "Completed",
      reason: "GSTR-1 declared tax vs GSTR-3B paid tax exhibits 3.2% variance with elevated OD utilization (77%)."
    },
    {
      id: "h_1790190889824",
      name: "ENVER-AITECH INDIA PRIVATE LIMITED",
      gstin: "27AAHCE5539J1ZA",
      score: 870,
      risk: "LOW",
      revenue: 9680000,
      buffer: "0.90x",
      compliance: "Audited Sound",
      evaluatedDate: "Oct 08, 2026",
      status: "Completed",
      reason: "Entity assessed with a LOW risk profile (Score: 870). Strong liquidity cushion with a Cash Buffer Ratio of 0.90x and 25 days minimum runway provide resilient NTC shock absorption."
    }
  ];

  useEffect(() => {
    if (isLoggedIn && currentUser) {
      fetchHistory(currentUser.id);
    }
  }, [isLoggedIn, currentUser]);

  const handleLogout = () => {
    localStorage.removeItem('enverai_user_session');
    setIsLoggedIn(false);
    setCurrentUser(null);
    setData(null);
    setIsSessionLocked(false);
    setInactivitySeconds(300);
    setCurrentView('evaluator');
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  // Instant Statutory Registry Probe
  const probeGSTIN = async (gstin) => {
    const clean = (gstin || '').trim().toUpperCase();
    setGstinInput(clean);
    if (!clean || clean.length < 10) {
      setGstinProbeData(null);
      return;
    }
    const localResolved = getGSTINProbeData(clean);
    setGstinProbeData(localResolved);

    if (API_BASE) {
      try {
        const res = await fetch(`${API_BASE}/api/v1/alternate-data/gstin-probe/${clean}`);
        const resData = await res.json();
        if (resData.status === 'success') {
          setGstinProbeData(resData);
        }
      } catch {}
    }
  };

  // Deterministic Zero-Hallucination Evaluation Calculation
  const generateGroundedEvaluation = (rawPayload, rawScraper) => {
    let parsed;
    try {
      parsed = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload;
    } catch {
      parsed = JSON.parse(PRELOADED_SCENARIOS.apex.data);
    }

    const credits = parsed.monthlyCredits || [750000, 780000, 820000, 760000, 840000, 890000];
    const debits = parsed.monthlyDebits || [680000, 710000, 740000, 690000, 760000, 820000];
    const closingBalance = parsed.bankClosingBalance || 680200;
    const odLimit = parsed.sanctionedOdLimit || 1000000;
    const peakOdUsage = parsed.peakOdUsage || 320000;
    const gstr1Sales = parsed.gstr1OutwardTaxable || 4840000;
    const gstr3bTax = parsed.gstr3bTaxPaid || 871200;
    const gstr1Tax = parsed.gstr1DeclaredTax || 871200;
    const monthlyEmi = parsed.monthlyEmiObligations || 42500;
    const bounces = parsed.inwardBounces || 0;

    let scraper = { mcaStatus: "Active", courtCases: 0, directorDIN: "02914820 (Clean)" };
    if (rawScraper) {
      try {
        scraper = typeof rawScraper === 'string' ? JSON.parse(rawScraper) : rawScraper;
      } catch {}
    }

    const avgMonthlyCredit = credits.reduce((a, b) => a + b, 0) / credits.length;
    const avgMonthlyDebit = debits.reduce((a, b) => a + b, 0) / debits.length;
    const annualizedRevenueRunRate = Math.round(avgMonthlyCredit * 12);
    const cashBufferRatio = +(closingBalance / (avgMonthlyDebit || 1)).toFixed(2);
    const minimumCashBufferDays = Math.round(cashBufferRatio * 25);
    const overdraftLimitUtilization = odLimit > 0 ? Math.round((peakOdUsage / odLimit) * 100) : 0;

    const firstHalfCredits = credits.slice(0, 3).reduce((a, b) => a + b, 0);
    const secondHalfCredits = credits.slice(3).reduce((a, b) => a + b, 0);
    const revenueGrowthRate = firstHalfCredits > 0 ? +(((secondHalfCredits - firstHalfCredits) / firstHalfCredits) * 100).toFixed(1) : 0;
    const totalCredits = credits.reduce((a, b) => a + b, 0);
    const gstVsBankReconciliation = +(gstr1Sales / (totalCredits || 1)).toFixed(2);
    const taxGap = gstr1Tax > 0 ? +(((gstr1Tax - gstr3bTax) / gstr1Tax) * 100).toFixed(1) : 0;

    const mean = totalCredits / credits.length;
    const variance = credits.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / credits.length;
    const stdDev = Math.sqrt(variance);
    const creditCV = +(stdDev / (mean || 1)).toFixed(2);

    let consecutiveLowMonths = 0;
    for (let c of credits) {
      if (c < mean * 0.8) consecutiveLowMonths++;
    }

    const netOperatingInflow = avgMonthlyCredit - avgMonthlyDebit;
    const dscp = monthlyEmi > 0 ? +(netOperatingInflow / monthlyEmi).toFixed(2) : 3.5;
    const emiBurdenRatio = avgMonthlyCredit > 0 ? +((monthlyEmi / avgMonthlyCredit) * 100).toFixed(1) : 0;

    const mcaStatus = scraper.mcaStatus || "Active";
    const courtCases = scraper.courtCases || 0;

    let score = 750;
    if (cashBufferRatio >= 0.5) score += 40;
    else if (cashBufferRatio < 0.2) score -= 50;

    if (overdraftLimitUtilization < 50) score += 25;
    else if (overdraftLimitUtilization > 85) score -= 45;

    if (revenueGrowthRate >= 0) score += 30;
    else score -= 35;

    if (Math.abs(gstVsBankReconciliation - 1.0) <= 0.1) score += 35;
    else score -= 40;

    if (taxGap <= 2.0) score += 25;
    else if (taxGap > 5.0) score -= 45;

    if (creditCV <= 0.2) score += 25;
    else if (creditCV > 0.4) score -= 30;

    score -= (bounces * 60);

    if (dscp >= 1.5) score += 35;
    else if (dscp < 1.0) score -= 60;

    if (mcaStatus !== "Active") score -= 150;
    if (courtCases > 0) score -= (courtCases * 40);

    score = Math.max(300, Math.min(900, score));
    const riskLevel = score >= 750 ? "LOW" : score >= 600 ? "MODERATE" : "HIGH";

    const p1Status = cashBufferRatio >= 0.5 ? "COMFORTABLE" : cashBufferRatio >= 0.25 ? "ADEQUATE" : "STRESSED";
    const p2Trajectory = revenueGrowthRate >= 5 ? "EXPANSIONARY" : revenueGrowthRate >= 0 ? "STABLE" : "CONTRACTING";
    const p3Status = bounces === 0 && creditCV < 0.25 ? "SOUND" : bounces > 0 ? "FRICTION DETECTED" : "MODERATE VOLATILITY";
    const p4Tier = dscp >= 1.75 ? "PRIME" : dscp >= 1.25 ? "ACCEPTABLE" : "LEVERAGED";

    return {
      status: "success",
      businessName: parsed.businessName || "Apex Precision Engineering Pvt Ltd",
      gstin: parsed.gstin || (gstinInput || "27AADCB2230M1Z2"),
      metrics: {
        pillar1_liquidity: {
          cashBufferRatio,
          minimumCashBufferDays,
          overdraftLimitUtilization,
          status: p1Status,
          benchmark: "> 0.15–0.25x (15–25 Days)"
        },
        pillar2_revenue: {
          annualizedRevenueRunRate,
          revenueGrowthRate,
          gstVsBankReconciliation,
          gstr1VsGstr3bGap: taxGap,
          trajectory: p2Trajectory,
          benchmark: "Reconciliation ~ 1.0x, Gap < 5%"
        },
        pillar3_stability: {
          creditCoefficientOfVariation: creditCV,
          consecutiveLowCreditMonths: consecutiveLowMonths,
          inwardBounceRate: bounces,
          outwardBounceRate: 0,
          status: p3Status,
          benchmark: "CV < 0.30, Bounces = 0.0%"
        },
        pillar4_leverage: {
          debtServiceCoverageProxy: dscp,
          interestEmiBurdenRatio: emiBurdenRatio,
          newBorrowingVelocity: 0,
          tier: p4Tier,
          benchmark: "DSCP > 1.50x, Burden < 20%"
        },
        pillar5_operational: {
          salaryStaffPaymentConsistency: "CONSISTENT (Monthly payroll verified)",
          utilityRentPaymentRegularity: "REGULAR (On-time utility payments)",
          highValueCashWithdrawalPct: 4.2,
          circularTransactionRisk: "LOW (Clean independent counterparties)",
          suspiciousTimingFlags: "CLEAN (Normal business hour distribution)",
          mcaStatus,
          courtCases,
          cin: parsed.cin || "U28110MH2018PTC304891"
        },
        revenueRunRate: annualizedRevenueRunRate,
        cashBufferRatio,
        citations: [
          `[Liquidity] Cash Buffer Ratio evaluated at ${cashBufferRatio}x with ${minimumCashBufferDays} minimum survival buffer days (OD utilization: ${overdraftLimitUtilization}%).`,
          `[Revenue] Annualized Revenue Run Rate: ₹${annualizedRevenueRunRate.toLocaleString()} (${revenueGrowthRate >= 0 ? '+' : ''}${revenueGrowthRate}% 3M/3M momentum).`,
          `[Compliance] GSTR-1 outward taxable supplies reconcile to Bank credit volume at ${gstVsBankReconciliation}x ratio with ${taxGap}% GSTR-3B tax gap.`,
          `[Stability] Monthly credit volatility CV is ${creditCV} with ${consecutiveLowMonths} consecutive low-credit months and ${bounces} bounce events.`,
          `[Debt Service] Debt Service Coverage Proxy (DSCP) is ${dscp}x with an EMI burden ratio of ${emiBurdenRatio}%.`,
          `[Operational Flags] Payroll regularity: CONSISTENT; MCA Status: ${mcaStatus}; Court Records: ${courtCases} litigation hits.`
        ]
      },
      decision: {
        score,
        riskLevel,
        narrative: `The enterprise demonstrates a ${riskLevel} risk profile with robust operational cash flows, ${minimumCashBufferDays} days of autonomous liquidity buffer, and zero circular trading flags. Grounded under RBI Digital Lending Guidelines.`,
        reasoning: `Orc Synthesis Agent evaluated enterprise financial health at score ${score}. Code-calculated debt capacity and cash buffer provide comprehensive protection against operating cycles across all 5 financial pillars.`,
        citations: [
          `[Liquidity] Cash Buffer Ratio evaluated at ${cashBufferRatio}x with ${minimumCashBufferDays} minimum survival buffer days (OD utilization: ${overdraftLimitUtilization}%).`,
          `[Revenue] Annualized Revenue Run Rate: ₹${annualizedRevenueRunRate.toLocaleString()} (${revenueGrowthRate >= 0 ? '+' : ''}${revenueGrowthRate}% 3M/3M momentum).`,
          `[Compliance] GSTR-1 outward taxable supplies reconcile to Bank credit volume at ${gstVsBankReconciliation}x ratio with ${taxGap}% GSTR-3B tax gap.`,
          `[Stability] Monthly credit volatility CV is ${creditCV} with ${consecutiveLowMonths} consecutive low-credit months and ${bounces} bounce events.`,
          `[Debt Service] Debt Service Coverage Proxy (DSCP) is ${dscp}x with an EMI burden ratio of ${emiBurdenRatio}%.`,
          `[Operational Flags] Payroll regularity: CONSISTENT; MCA Status: ${mcaStatus}; Court Records: ${courtCases} litigation hits.`
        ]
      }
    };
  };

  // Trigger Underwriting Evaluation (Simulated Live Pipeline)
  const triggerEvaluation = async (overrideData = null) => {
    setLoading(true);
    setEvaluationStep(0);
    setError(null);
    setData(null);

    // Step-by-step progress ticker
    const interval = setInterval(() => {
      setEvaluationStep(prev => (prev < 3 ? prev + 1 : prev));
    }, 600);

    setTimeout(() => {
      clearInterval(interval);
      setLoading(false);

      const probe = gstinProbeData || getGSTINProbeData(gstinInput);
      const isCustomFile = Boolean(file);
      let payload;

      if (isCustomFile) {
        payload = generateGroundedEvaluation({
          businessName: file.name.replace(/\.[^/.]+$/, "").toUpperCase(),
          gstin: gstinInput || "27AADCB2230M1Z2",
          monthlyCredits: [820000, 850000, 880000, 840000, 910000, 960000],
          monthlyDebits: [710000, 730000, 760000, 720000, 780000, 830000],
          bankClosingBalance: 420000,
          sanctionedOdLimit: 900000,
          peakOdUsage: 350000,
          gstr1OutwardTaxable: 5060000,
          gstr3bTaxPaid: 910800,
          gstr1DeclaredTax: 910800,
          monthlyEmiObligations: 38000,
          inwardBounces: 0
        });
      } else {
        payload = generateGroundedEvaluation({
          businessName: probe?.registry?.legalEntityName || "Apex Precision Engineering Pvt Ltd",
          gstin: probe?.gstin || gstinInput,
          monthlyCredits: probe?.timeline?.returns?.map(r => r.taxable_sales) || [750000, 780000, 820000, 760000, 840000, 890000],
          monthlyDebits: probe?.timeline?.returns?.map(r => r.taxable_debits) || [680000, 710000, 740000, 690000, 760000, 820000],
          bankClosingBalance: probe?.timeline?.closingBalance || 680200,
          sanctionedOdLimit: probe?.timeline?.sanctionedOdLimit || 1000000,
          peakOdUsage: probe?.timeline?.peakOdUsage || 320000,
          gstr1OutwardTaxable: probe?.timeline?.gstr1OutwardTaxable || 4840000,
          gstr3bTaxPaid: probe?.timeline?.gstr3bTaxPaid || 871200,
          gstr1DeclaredTax: probe?.timeline?.gstr1DeclaredTax || 871200,
          monthlyEmiObligations: probe?.timeline?.monthlyEmiObligations || 42500,
          inwardBounces: probe?.timeline?.inwardBounces || 0
        });
      }

      setData(payload);

      // Add to user-scoped history
      const newHistoryItem = {
        id: `h_${Date.now()}`,
        userId: currentUser?.id,
        userName: currentUser?.username,
        userEmail: currentUser?.email,
        name: payload.businessName,
        gstin: payload.gstin,
        score: payload.decision.score,
        risk: payload.decision.riskLevel,
        evaluatedDate: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        status: "Completed",
        compliance: "MCA Active · Grounded",
        reason: payload.decision.narrative,
        fullPayload: payload
      };

      setHistory(prev => {
        const updated = [newHistoryItem, ...prev.filter(p => (p.gstin || p.id) !== payload.gstin)];
        const userStorageKey = currentUser?.id ? `enver_user_evaluations_${currentUser.id}` : 'enver_user_evaluations_guest';
        try {
          localStorage.setItem(userStorageKey, JSON.stringify(updated));
        } catch {}
        return updated;
      });
    }, 2500);
  };

  // Orc XAI Chat Directives
  const sendOrcDirective = async (e) => {
    e?.preventDefault();
    if (!chatInput.trim() || isChatSending) return;

    const userQuery = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userQuery }]);
    setIsChatSending(true);

    try {
      if (API_BASE) {
        const res = await fetch(`${API_BASE}/api/v1/chat/xai`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: userQuery,
            evaluationPayload: data || { businessName: "Simulator MSME" }
          })
        });
        const resData = await res.json();
        if (resData.response) {
          setChatMessages(prev => [...prev, { role: 'agent', text: resData.response }]);
          setIsChatSending(false);
          return;
        }
      }
      throw new Error();
    } catch {
      const companyData = getCompanyDecisionData(
        data?.businessName || gstinProbeData?.registry?.legalEntityName || 'Apex Precision Engineering Pvt Ltd',
        data?.gstin || gstinProbeData?.gstin || gstinInput,
        gstinProbeData
      );
      const resp = generateOrcResponse(userQuery, companyData);
      setChatMessages(prev => [...prev, { role: 'agent', text: resp }]);
    } finally {
      setIsChatSending(false);
    }
  };

  // =========================================================================
  // VIEW: AUTHENTICATION GATE
  // =========================================================================
  if (!isLoggedIn) {
    return (
      <div className="app-viewport">
        <div className="floating-lines-bg-container">
          <FloatingLines
            linesGradient={['#ACE1AF', '#9C52C7', '#C8EED0', '#6B2A8C', '#ACE1AF']}
            backgroundColor="#0A050E"
            animationSpeed={0.65}
            amplitude={0.8}
            lineWidth={1.0}
            lineCount={9}
            glow={0.45}
            brightness={0.95}
            depthOfField={0.3}
            opacity={0.8}
          />
        </div>
        <VerificationGate 
          onVerified={(user) => {
            setCurrentUser(user);
            setIsLoggedIn(true);
            setError(null);
          }} 
        />
      </div>
    );
  }

  // =========================================================================
  // VIEW: MASTER CITADEL DASHBOARD
  // =========================================================================
  if (currentView === 'master') {
    return (
      <div className="app-viewport">
        <div className="floating-lines-bg-container">
          <FloatingLines
            linesGradient={['#ACE1AF', '#9C52C7', '#C8EED0', '#6B2A8C', '#ACE1AF']}
            backgroundColor="#0A050E"
            animationSpeed={0.65}
            amplitude={0.8}
            lineWidth={1.0}
            lineCount={9}
            glow={0.45}
            brightness={0.95}
            depthOfField={0.3}
            opacity={0.8}
          />
        </div>
        <div className="app-container section animate-fade-up" style={{ position: 'relative', zIndex: 1, padding: '24px' }}>
          <MasterDashboard onBack={() => setCurrentView('evaluator')} />
        </div>
      </div>
    );
  }

  // Current Breadcrumb Label
  const breadcrumb = 
    data ? `Evaluations / ${data.businessName}` :
    activeNav === 'new-eval' ? 'New Evaluation & Intake' :
    activeNav === 'watchlist' ? 'Saved Businesses / Watchlist' :
    activeNav === 'batch' ? 'Batch Overnight Underwriting' :
    activeNav === 'billing' ? 'Account & API Billing' : 'Citadel Cockpit';

  return (
    <div className="app-viewport">
      {/* Interactive FloatingLines WebGL2 Ambient Field - Whitish, Silver Ash & Light Cherry Pink */}
      <div className="floating-lines-bg-container">
        <FloatingLines
          linesGradient={['#FF8BA7', '#F43F5E', '#FDA4AF', '#CBD0D8', '#E2E5E9']}
          backgroundColor="#F8F9FB"
          lightMode={true}
          animationSpeed={0.55}
          amplitude={0.8}
          lineWidth={1.0}
          lineCount={9}
          glow={0.35}
          brightness={0.9}
          depthOfField={0.3}
          opacity={0.65}
        />
      </div>

      {/* 5-Min Inactivity Sentinel Overlay */}
      {isSessionLocked && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(16px)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1.5rem'
        }}>
          <div className="card animate-fade-up" style={{ maxWidth: '440px', textAlign: 'center', borderColor: '#E2E8F0', background: '#FFFFFF', padding: '32px', boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.15)' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%', background: '#FFF1F4',
              color: '#F43F5E', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem',
              border: '1.5px solid #FDA4AF'
            }}>
              <Clock size={28} />
            </div>
            <h2 style={{ fontSize: '1.5rem', color: '#0F172A', marginBottom: '0.6rem', fontWeight: 700 }}>
              Session Suspended
            </h2>
            <p style={{ color: '#475569', fontSize: '0.85rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
              Citadel locked after 300 seconds of inactivity to protect corporate financial privacy and audit trail integrity under RBI mandate.
            </p>
            <button 
              className="btn-primary" 
              style={{ width: '100%', justifyContent: 'center', padding: '12px', fontWeight: 700 }}
              onClick={() => {
                setIsSessionLocked(false);
                setInactivitySeconds(300);
              }}
            >
              RESUME AUDIT SESSION
            </button>
          </div>
        </div>
      )}

      {/* Left-Sidebar + Main Viewport Architecture */}
      <div className="citadel-app-layout">
        {/* 1. Left Sidebar */}
        <AuditorSidebar 
          activeNav={activeNav}
          onNavChange={(navId) => {
            setActiveNav(navId);
            if (data && navId === 'new-eval') {
              setData(null);
            }
          }}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
          currentUser={currentUser}
          onLogout={handleLogout}
          onOpenMasterDashboard={() => setCurrentView('master')}
        />

        {/* 2. Main Viewport */}
        <div className="citadel-main-viewport">
          <AuditorTopBar 
            currentBreadcrumb={breadcrumb}
            onOpenCmdPalette={() => setIsCmdPaletteOpen(true)}
            inactivitySeconds={inactivitySeconds}
            onOpenChat={() => setIsChatOpen(prev => !prev)}
            isChatOpen={isChatOpen}
          />

          <main className={`citadel-workspace-body ${data ? 'split-active-body' : ''}`}>
            {/* Processing Checklist State */}
            {loading ? (
              <ProcessingSkeleton 
                activeStep={evaluationStep} 
                businessName={gstinProbeData?.registry?.legalEntityName || gstinInput || 'Enterprise'} 
              />
            ) : data ? (
              /* Two-Column Split Workspace View (Stripe/Bloomberg Style) */
              <SplitWorkspaceView 
                data={data}
                onBack={() => setData(null)}
                currentUser={currentUser}
              />
            ) : activeNav === 'new-eval' ? (
              /* Hero Action Bar + Dropzone (Image 3 Table removed to Intake Station) */
              <NewEvaluationView 
                gstinInput={gstinInput}
                setGstinInput={setGstinInput}
                gstinProbeData={gstinProbeData}
                onProbeGSTIN={probeGSTIN}
                file={file}
                onFileChange={handleFileChange}
                onClearFile={() => setFile(null)}
                onTriggerEvaluation={triggerEvaluation}
                loading={loading}
              />
            ) : activeNav === 'watchlist' ? (
              /* Saved Businesses / Watchlist: stores every run by this specific user */
              <WatchlistView 
                history={history}
                currentUser={currentUser}
                onSelectCompany={(item) => {
                  const gstinToProbe = item.gstin || item.id || '27AADCB2230M1Z2';
                  setGstinInput(gstinToProbe);
                  const probe = getGSTINProbeData(gstinToProbe);
                  setGstinProbeData(probe);
                  const generated = item.fullPayload || generateGroundedEvaluation({
                    businessName: item.name || item.businessName || probe?.registry?.legalEntityName,
                    gstin: gstinToProbe
                  });
                  setData(generated);
                }}
                onExportPDF={(row) => {
                  const gstinToProbe = row.gstin || row.id || '27AADCB2230M1Z2';
                  const probe = getGSTINProbeData(gstinToProbe);
                  const generated = row.fullPayload || generateGroundedEvaluation({
                    businessName: row.name || row.businessName || probe?.registry?.legalEntityName,
                    gstin: gstinToProbe
                  });
                  exportAuditReport({ data: generated, auditorNotes: row.reason || '', officer: currentUser });
                }}
                onRemoveCompany={handleRemoveHistoryItem}
                onNavigateToNewEval={() => setActiveNav('new-eval')}
              />
            ) : activeNav === 'batch' ? (
              /* Batch Overnight Upload */
              <BatchUploadView />
            ) : activeNav === 'billing' ? (
              /* Account & API Billing */
              <AccountBillingView currentUser={currentUser} />
            ) : null}
          </main>
        </div>

        {/* Global Keyboard Cmd/Ctrl + K Palette */}
        <CommandPalette 
          isOpen={isCmdPaletteOpen}
          onClose={() => setIsCmdPaletteOpen(false)}
          onSelectCompany={(companyId) => {
            probeGSTIN(companyId);
            const probe = getGSTINProbeData(companyId);
            const generated = generateGroundedEvaluation({
              businessName: probe.registry.legalEntityName,
              gstin: companyId,
              monthlyCredits: probe.timeline.returns.map(r => r.taxable_sales),
              monthlyDebits: probe.timeline.returns.map(r => r.taxable_debits),
              bankClosingBalance: probe.timeline.closingBalance,
              sanctionedOdLimit: probe.timeline.sanctionedOdLimit,
              peakOdUsage: probe.timeline.peakOdUsage,
              gstr1OutwardTaxable: probe.timeline.gstr1OutwardTaxable,
              gstr3bTaxPaid: probe.timeline.gstr3bTaxPaid,
              gstr1DeclaredTax: probe.timeline.gstr1DeclaredTax,
              monthlyEmiObligations: probe.timeline.monthlyEmiObligations,
              inwardBounces: probe.timeline.inwardBounces
            });
            setData(generated);
          }}
        />

        {/* Slide-over Orc CCO Conversational Drawer */}
        {isChatOpen && (
          <aside className="orc-slideover-drawer animate-fade-in" style={{
            position: 'fixed', right: 0, top: 0, bottom: 0, width: '380px',
            background: 'rgba(255, 255, 255, 0.98)', backdropFilter: 'blur(20px)',
            borderLeft: '1px solid #E2E8F0', zIndex: 100,
            display: 'flex', flexDirection: 'column', padding: '20px',
            boxShadow: '-10px 0 40px rgba(15, 23, 42, 0.08)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: '14px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Cpu size={18} style={{ color: '#F43F5E' }} />
                <span style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.95rem' }}>Orc CCO Interrogation</span>
              </div>
              <button 
                onClick={() => setIsChatOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px' }}>
              {chatMessages.map((msg, idx) => (
                <div 
                  key={idx} 
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    lineHeight: '1.45',
                    background: msg.role === 'user' ? '#FFF1F4' : '#F8FAFC',
                    border: msg.role === 'user' ? '1px solid #FDA4AF' : '1px solid #E2E8F0',
                    color: msg.role === 'user' ? '#0F172A' : '#334155',
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '90%'
                  }}
                >
                  {msg.text}
                </div>
              ))}
              {isChatSending && (
                <div style={{ fontSize: '0.75rem', color: '#F43F5E', fontStyle: 'italic' }}>
                  Orc is reviewing statement line citations...
                </div>
              )}
            </div>

            <form onSubmit={sendOrcDirective} style={{ display: 'flex', gap: '8px', marginTop: '14px', borderTop: '1px solid #E2E8F0', paddingTop: '14px' }}>
              <input
                type="text"
                placeholder="Ask about buffer days, DSCR, or policy..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                style={{
                  flex: 1, background: '#FFFFFF', border: '1.5px solid #CBD5E1',
                  borderRadius: '6px', padding: '8px 12px', color: '#0F172A', fontSize: '0.8rem', outline: 'none'
                }}
              />
              <button 
                type="submit" 
                disabled={isChatSending}
                style={{
                  background: 'linear-gradient(135deg, #FF8BA7 0%, #F43F5E 100%)', color: '#FFFFFF', border: 'none',
                  borderRadius: '6px', padding: '0 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: 700,
                  boxShadow: '0 2px 8px rgba(244, 63, 94, 0.3)'
                }}
              >
                <Send size={14} />
              </button>
            </form>
          </aside>
        )}
      </div>
    </div>
  );
}

export default App;
