/**
 * GSTIN format lookups and demo-mode sample entities.
 * Preset entities are returned only when VITE_DEMO_MODE=true and are flagged sampleData.
 */
import { isDemoMode } from './demoMode';

export const STATE_CODE_MAP = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
  '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
  '19': 'West Bengal', '23': 'Madhya Pradesh', '24': 'Gujarat', '27': 'Maharashtra',
  '29': 'Karnataka', '32': 'Kerala', '33': 'Tamil Nadu', '36': 'Telangana'
};

export const ENTITY_TYPE_MAP = {
  'C': 'Private Limited Company',
  'P': 'Sole Proprietorship',
  'F': 'Partnership Firm / LLP',
  'T': 'Trust / Society',
  'H': 'Hindu Undivided Family (HUF)',
  'A': 'Association of Persons'
};

export const KNOWN_GSTINS = {
  '27AAHCE5539J1ZA': {
    legalEntityName: 'ENVER-AITECH INDIA PRIVATE LIMITED',
    tradeName: 'Enver AI Tech',
    cin: 'U47190MH2023PTC402519',
    pan: 'AAHCE5539J',
    state: 'Maharashtra',
    stateCode: '27',
    entityType: 'Private Limited Company',
    mcaStatus: 'Active',
    monthlyCredits: [780000, 810000, 845000, 890000, 940000, 1015000],
    monthlyDebits: [490000, 515000, 540000, 560000, 605000, 640000],
    closingBalance: 654000,
    sanctionedOdLimit: 1200000,
    peakOdUsage: 140000,
    gstr1OutwardTaxable: 5280000,
    gstr1DeclaredTax: 950400,
    gstr3bTaxPaid: 947500,
    monthlyEmiObligations: 28000,
    inwardBounces: 0,
    taxPaymentReliability: '99.8%',
    eWayBillMonthlyVolumeAvg: '₹1,450,000'
  },
  '27AADCB2230M1Z2': {
    legalEntityName: 'Apex Precision Engineering Pvt Ltd',
    tradeName: 'Apex Precision',
    cin: 'U28110MH2018PTC304891',
    pan: 'AADCB2230M',
    state: 'Maharashtra',
    stateCode: '27',
    entityType: 'Private Limited Company',
    mcaStatus: 'Active',
    monthlyCredits: [750000, 780000, 820000, 760000, 840000, 890000],
    monthlyDebits: [680000, 710000, 740000, 690000, 760000, 820000],
    closingBalance: 680200,
    sanctionedOdLimit: 1000000,
    peakOdUsage: 320000,
    gstr1OutwardTaxable: 4840000,
    gstr1DeclaredTax: 871200,
    gstr3bTaxPaid: 871200,
    monthlyEmiObligations: 42500,
    inwardBounces: 0,
    taxPaymentReliability: '99.2%',
    eWayBillMonthlyVolumeAvg: '₹1,850,000'
  },
  '24AABCS4421P1Z9': {
    legalEntityName: 'Surat Textile Weaving Cluster LLP',
    tradeName: 'Surat Textiles',
    cin: 'AAB-4421',
    pan: 'AABCS4421P',
    state: 'Gujarat',
    stateCode: '24',
    entityType: 'Partnership Firm / LLP',
    mcaStatus: 'Active',
    monthlyCredits: [1100000, 1150000, 1220000, 1180000, 1310000, 1400000],
    monthlyDebits: [990000, 1020000, 1100000, 1050000, 1190000, 1280000],
    closingBalance: 420000,
    sanctionedOdLimit: 1500000,
    peakOdUsage: 960000,
    gstr1OutwardTaxable: 7360000,
    gstr1DeclaredTax: 1324800,
    gstr3bTaxPaid: 1305000,
    monthlyEmiObligations: 68000,
    inwardBounces: 0,
    taxPaymentReliability: '96.2%',
    eWayBillMonthlyVolumeAvg: '₹2,600,000'
  },
  '27AAGCK8812L1ZQ': {
    legalEntityName: 'Kalyan Agro Supply & Logistics',
    tradeName: 'Kalyan Agro',
    cin: 'Proprietorship',
    pan: 'AAGCK8812L',
    state: 'Maharashtra',
    stateCode: '27',
    entityType: 'Sole Proprietorship',
    mcaStatus: 'Active',
    monthlyCredits: [520000, 610000, 580000, 490000, 560000, 640000],
    monthlyDebits: [460000, 540000, 520000, 445000, 510000, 575000],
    closingBalance: 145000,
    sanctionedOdLimit: 500000,
    peakOdUsage: 372000,
    gstr1OutwardTaxable: 3400000,
    gstr1DeclaredTax: 612000,
    gstr3bTaxPaid: 595000,
    monthlyEmiObligations: 22000,
    inwardBounces: 1,
    taxPaymentReliability: '92.5%',
    eWayBillMonthlyVolumeAvg: '₹950,000'
  },
  '27AABPQ1063C1Z5': {
    legalEntityName: 'Kariman Enterprises',
    tradeName: 'Kariman Enterprises',
    cin: 'Sole Proprietorship',
    pan: 'AABPQ1063C',
    state: 'Maharashtra',
    stateCode: '27',
    entityType: 'Sole Proprietorship',
    mcaStatus: 'Active',
    monthlyCredits: [642000, 678000, 725000, 660000, 694000, 721000],
    monthlyDebits: [545000, 560000, 610000, 570000, 580000, 605000],
    closingBalance: 284500,
    sanctionedOdLimit: 600000,
    peakOdUsage: 215000,
    gstr1OutwardTaxable: 4180000,
    gstr1DeclaredTax: 752400,
    gstr3bTaxPaid: 741600,
    monthlyEmiObligations: 26500,
    inwardBounces: 0,
    taxPaymentReliability: '98.5%',
    eWayBillMonthlyVolumeAvg: '₹1,180,000'
  },
  '27AAACT2727Q1ZW': {
    legalEntityName: 'Tata Motors Passenger Vehicles Limited',
    tradeName: 'Tata Motors',
    cin: 'U34100MH2021PLC367069',
    pan: 'AAACT2727Q',
    state: 'Maharashtra',
    stateCode: '27',
    entityType: 'Private Limited Company',
    mcaStatus: 'Active',
    monthlyCredits: [238000000, 245000000, 256000000, 241000000, 252000000, 268000000],
    monthlyDebits: [210000000, 218000000, 225000000, 214000000, 222000000, 235000000],
    closingBalance: 125000000,
    sanctionedOdLimit: 450000000,
    peakOdUsage: 85000000,
    gstr1OutwardTaxable: 1500000000,
    gstr1DeclaredTax: 270000000,
    gstr3bTaxPaid: 268500000,
    monthlyEmiObligations: 6500000,
    inwardBounces: 0,
    taxPaymentReliability: '99.9%',
    eWayBillMonthlyVolumeAvg: '₹380,000,000'
  }
};

export function getGSTINProbeData(gstin) {
  if (!isDemoMode || !gstin) return null;
  const clean = gstin.trim().toUpperCase();
  const aliasMap = {
    '27AABCU9603R1ZM': '27AADCB2230M1Z2', // Apex Precision
    '24AAJCS4912K1ZW': '24AABCS4421P1Z9', // Surat Textiles
    '27AAECK3910F1ZU': '27AAGCK8812L1ZQ'  // Kalyan Agro
  };
  const resolvedKey = aliasMap[clean] || clean;
  const known = KNOWN_GSTINS[resolvedKey];

  if (known) {
    const months = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'];
    const returns = months.map((m, idx) => ({
      month: m,
      taxable_sales: known.monthlyCredits[idx] || 750000,
      taxable_debits: known.monthlyDebits[idx] || 650000,
      cgst: Math.round(((known.monthlyCredits[idx] || 750000) * 0.09)),
      sgst: Math.round(((known.monthlyCredits[idx] || 750000) * 0.09)),
      filing_date: `${m}-11`,
      status: 'FILED_ON_TIME'
    }));

    return {
      status: 'success',
      sampleData: true,
      gstin: clean,
      registry: {
        legalEntityName: known.legalEntityName,
        tradeName: known.tradeName,
        pan: known.pan,
        state: known.state,
        stateCode: known.stateCode,
        entityType: known.entityType,
        mcaStatus: known.mcaStatus,
        filingCompliance: {
          taxPaymentReliability: known.taxPaymentReliability,
          eWayBillMonthlyVolumeAvg: known.eWayBillMonthlyVolumeAvg
        }
      },
      timeline: {
        filingStatus: 'ACTIVE',
        returns,
        closingBalance: known.closingBalance,
        sanctionedOdLimit: known.sanctionedOdLimit,
        peakOdUsage: known.peakOdUsage,
        gstr1OutwardTaxable: known.gstr1OutwardTaxable,
        gstr1DeclaredTax: known.gstr1DeclaredTax,
        gstr3bTaxPaid: known.gstr3bTaxPaid,
        monthlyEmiObligations: known.monthlyEmiObligations,
        inwardBounces: known.inwardBounces,
        summary: {
          total_gstr1_sales: known.gstr1OutwardTaxable,
          total_gstr3b_tax_paid: known.gstr3bTaxPaid
        }
      }
    };
  }

  return null;
}
