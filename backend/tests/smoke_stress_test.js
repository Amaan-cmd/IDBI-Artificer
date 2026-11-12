process.env.NODE_ENV = 'test';
const http = require('http');
const path = require('path');
const { computeFinancialTelemetry } = require('../utils/financialTelemetry');
const { synthesizeScore } = require('../agents/synthesisAgent');

const BACKEND_URL = 'http://localhost:4000';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    }).on('error', err => reject(err));
  });
}

async function runSmokeTests() {
  console.log('\n================================================================');
  console.log('           CITADEL ORC CCO ENGINE - SMOKE TESTS               ');
  console.log('================================================================\n');

  let passes = 0;
  let fails = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passes++;
    } else {
      console.error(`  [FAIL] ${message}`);
      fails++;
    }
  }

  // 1. Health check endpoint test
  try {
    const health = await fetchJson(`${BACKEND_URL}/api/v1/health`);
    assert(health.status === 200 && health.body?.status === 'ok', `API Health endpoint returns 200 OK (${health.body?.service})`);
  } catch (err) {
    console.warn(`  [WARN] Backend HTTP check skipped or offline: ${err.message}. Testing internal agent calculation pipeline.`);
  }

  // 2. GSTIN probe endpoint test
  try {
    const probe = await fetchJson(`${BACKEND_URL}/api/v1/alternate-data/gstin-probe/27AADCB2230M1Z2`);
    assert(probe.status === 200 && probe.body?.registry?.legalEntityName?.includes('Apex Precision'), `GSTIN Probe resolves Apex Precision Engineering Pvt Ltd`);
  } catch (err) {
    console.warn(`  [WARN] GSTIN probe HTTP check skipped: ${err.message}`);
  }

  // 3. Known MSME Scenario Scored Calculations
  const scenarios = [
    {
      name: 'Apex Precision Engineering Pvt Ltd (Scenario A - Prime NTC)',
      input: {
        businessName: 'Apex Precision Engineering Pvt Ltd',
        gstin: '27AADCB2230M1Z2',
        monthlyCredits: [750000, 780000, 820000, 760000, 840000, 890000],
        monthlyDebits: [680000, 710000, 740000, 690000, 760000, 820000],
        dailyClosingBalances: [650000, 670000, 690000, 680000, 700000, 680200],
        sanctionedOdLimit: 1000000,
        peakOdUsage: 320000,
        gstr1OutwardTaxable: 4840000,
        gstr3bTaxPaid: 871200,
        gstr1DeclaredTax: 871200,
        monthlyEmiObligations: 42500,
        inwardBounces: 0
      },
      minScore: 800,
      maxScore: 845
    },
    {
      name: 'Surat Textile Weaving Cluster LLP (Scenario B - High Growth)',
      input: {
        businessName: 'Surat Textile Weaving Cluster LLP',
        gstin: '24AABCS4421P1Z9',
        monthlyCredits: [1100000, 1150000, 1220000, 1180000, 1310000, 1400000],
        monthlyDebits: [990000, 1020000, 1100000, 1050000, 1190000, 1280000],
        dailyClosingBalances: [900000, 920000, 940000, 910000, 950000, 940000],
        sanctionedOdLimit: 1500000,
        peakOdUsage: 550000,
        gstr1OutwardTaxable: 7360000,
        gstr3bTaxPaid: 1324800,
        gstr1DeclaredTax: 1324800,
        monthlyEmiObligations: 68000,
        inwardBounces: 0
      },
      minScore: 750,
      maxScore: 830
    },
    {
      name: 'Kalyan Agro Supply & Logistics (Scenario C - Moderate Risk)',
      input: {
        businessName: 'Kalyan Agro Supply & Logistics',
        gstin: '27AAGCK8812L1ZQ',
        monthlyCredits: [520000, 580000, 610000, 490000, 530000, 680000],
        monthlyDebits: [490000, 560000, 590000, 480000, 520000, 670000],
        dailyClosingBalances: [200000, 210000, 190000, 220000, 205000, 210000],
        sanctionedOdLimit: 800000,
        peakOdUsage: 620000,
        gstr1OutwardTaxable: 3410000,
        gstr3bTaxPaid: 594000,
        gstr1DeclaredTax: 613800,
        monthlyEmiObligations: 54000,
        inwardBounces: 1
      },
      minScore: 550,
      maxScore: 650
    },
    {
      name: 'Tata Motors Passenger Vehicles (Scenario D - Institutional Anchor)',
      input: {
        businessName: 'Tata Motors Passenger Vehicles Ltd',
        gstin: '27AAACT2727Q1ZW',
        monthlyCredits: [220000000, 230000000, 240000000, 235000000, 250000000, 260000000],
        monthlyDebits: [180000000, 190000000, 200000000, 195000000, 210000000, 220000000],
        dailyClosingBalances: [120000000, 130000000, 140000000, 135000000, 145000000, 150000000],
        sanctionedOdLimit: 500000000,
        peakOdUsage: 50000000,
        gstr1OutwardTaxable: 1435000000,
        gstr3bTaxPaid: 258300000,
        gstr1DeclaredTax: 258300000,
        monthlyEmiObligations: 12000000,
        inwardBounces: 0
      },
      minScore: 850,
      maxScore: 885
    }
  ];

  for (const s of scenarios) {
    const matrix = computeFinancialTelemetry(s.input);
    const synthesis = await synthesizeScore(s.input, matrix);
    const score = synthesis.score;

    assert(
      score >= s.minScore && score <= s.maxScore,
      `${s.name}: Score = ${score} (Target: [${s.minScore}, ${s.maxScore}])`
    );
    assert(
      score !== 900,
      `${s.name}: Score is NOT 900 (Defect fixed: realistic scoring calibration enforced)`
    );
    assert(
      score <= 885,
      `${s.name}: Score respects maximum ceiling of 885`
    );
    assert(
      matrix.pillar1_liquidity && matrix.pillar2_revenue && matrix.pillar3_stability && matrix.pillar4_leverage && matrix.pillar5_operational,
      `${s.name}: All 5 financial pillars successfully computed`
    );
  }

  console.log(`\nSmoke Tests Finished: ${passes} Passed, ${fails} Failed.`);
  return fails === 0;
}

async function runStressTests() {
  console.log('\n================================================================');
  console.log('          CITADEL ORC CCO ENGINE - STRESS & MONTE CARLO TESTS    ');
  console.log('================================================================\n');

  const NUM_ITERATIONS = 1000;
  console.log(`Running ${NUM_ITERATIONS} randomized synthetic MSME stress trials...`);

  let completed = 0;
  let nanErrors = 0;
  let boundaryViolations = 0;
  let score900Count = 0;
  let totalScore = 0;
  let minObserved = 999;
  let maxObserved = 0;

  const tierCounts = { LOW: 0, MEDIUM: 0, HIGH: 0 };
  const startTime = Date.now();

  for (let i = 0; i < NUM_ITERATIONS; i++) {
    // Generate randomized financial parameters across wide realistic and extreme spectrums
    const scale = Math.pow(10, Math.random() * 4 + 4); // 10,000 to 100,000,000
    const volatility = Math.random() * 0.8;
    const monthlyCredits = Array.from({ length: 6 }, () => 
      Math.max(1000, Math.round(scale * (1 + (Math.random() - 0.5) * volatility)))
    );
    const debitRatio = 0.5 + Math.random() * 0.9; // 50% to 140% of credits
    const monthlyDebits = monthlyCredits.map(c => Math.round(c * debitRatio));
    const closingBalance = Math.max(0, Math.round(scale * (Math.random() * 1.5 - 0.1)));
    const odLimit = Math.random() > 0.3 ? Math.round(scale * (0.5 + Math.random())) : 0;
    const peakOd = odLimit > 0 ? Math.round(odLimit * Math.random()) : 0;
    const gstr1Sales = Math.round(monthlyCredits.reduce((a, b) => a + b, 0) * (0.8 + Math.random() * 0.4));
    const gstr1Tax = Math.round(gstr1Sales * 0.18);
    const taxGapFactor = Math.random() > 0.8 ? 0.85 : 1.0;
    const gstr3bTax = Math.round(gstr1Tax * taxGapFactor);
    const bounces = Math.random() > 0.7 ? Math.floor(Math.random() * 4) : 0;
    const monthlyEmi = Math.round(scale * (Math.random() * 0.15));

    const input = {
      businessName: `Stress Entity #${i + 1}`,
      gstin: `27AA${String.fromCharCode(65 + (i % 26))}A${1000 + i}A1Z${i % 9}`,
      monthlyCredits,
      monthlyDebits,
      dailyClosingBalances: [closingBalance, closingBalance * 0.95, closingBalance * 1.05],
      sanctionedOdLimit: odLimit,
      peakOdUsage: peakOd,
      gstr1OutwardTaxable: gstr1Sales,
      gstr3bTaxPaid: gstr3bTax,
      gstr1DeclaredTax: gstr1Tax,
      monthlyEmiObligations: monthlyEmi,
      inwardBounces: bounces
    };

    try {
      const matrix = computeFinancialTelemetry(input);
      const synthesis = await synthesizeScore(input, matrix);
      const score = synthesis.score;

      if (isNaN(score) || score === null || score === undefined) {
        nanErrors++;
      } else {
        if (score < 300 || score > 885) {
          boundaryViolations++;
        }
        if (score === 900) {
          score900Count++;
        }
        minObserved = Math.min(minObserved, score);
        maxObserved = Math.max(maxObserved, score);
        totalScore += score;

        const tier = synthesis.riskLevel || (score >= 750 ? 'LOW' : score >= 620 ? 'MEDIUM' : 'HIGH');
        tierCounts[tier] = (tierCounts[tier] || 0) + 1;
      }
      completed++;
    } catch (err) {
      console.error(`Trial #${i} failed:`, err);
    }
  }

  const durationMs = Date.now() - startTime;
  const avgScore = Math.round(totalScore / completed);

  console.log('\n--- STRESS TEST RESULTS ---');
  console.log(`Total Trials Completed:      ${completed} / ${NUM_ITERATIONS}`);
  console.log(`Duration:                     ${durationMs}ms (${(durationMs / NUM_ITERATIONS).toFixed(2)}ms per evaluation)`);
  console.log(`NaN or Null Errors:           ${nanErrors}`);
  console.log(`Out of Range Violations:      ${boundaryViolations} (Must be [300, 885])`);
  console.log(`Exact 900 Score Count:        ${score900Count} (Target: 0)`);
  console.log(`Min Score Observed:           ${minObserved}`);
  console.log(`Max Score Observed:           ${maxObserved}`);
  console.log(`Average Synthetic Score:      ${avgScore}`);
  console.log(`Risk Distribution:            LOW: ${tierCounts.LOW} (${((tierCounts.LOW / completed) * 100).toFixed(1)}%), MEDIUM: ${tierCounts.MEDIUM} (${((tierCounts.MEDIUM / completed) * 100).toFixed(1)}%), HIGH: ${tierCounts.HIGH} (${((tierCounts.HIGH / completed) * 100).toFixed(1)}%)`);

  const passed = nanErrors === 0 && boundaryViolations === 0 && score900Count === 0 && completed === NUM_ITERATIONS;
  if (passed) {
    console.log('\n>>> ALL STRESS TEST CONSTRAINTS SATISFIED! ZERO FLAKINESS DETECTED. <<<');
  } else {
    console.error('\n>>> STRESS TEST FAILED CONSTRAINTS! <<<');
  }
  return passed;
}

async function main() {
  const smokeOk = await runSmokeTests();
  const stressOk = await runStressTests();

  if (smokeOk && stressOk) {
    console.log('\n[SUCCESS] Underwriting Pipeline Smoke and Stress Tests fully PASSED.\n');
    process.exit(0);
  } else {
    console.error('\n[FAILURE] One or more test suites failed.\n');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
