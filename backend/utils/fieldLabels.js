/**
 * Human-readable labels for the financial fields the ingestion agent can list
 * in dataGaps. dataGaps itself stays machine-readable (raw keys); these labels
 * are used only where a gap is shown to a person (decision caveats).
 */
const FIELD_LABELS = Object.freeze({
  businessName: 'Account holder name',
  gstin: 'GSTIN',
  monthlyCredits: 'Monthly credits',
  monthlyDebits: 'Monthly debits',
  totalCreditVolume: 'Total credits',
  totalDebitVolume: 'Total debits',
  bankOpeningBalance: 'Opening balance',
  bankClosingBalance: 'Closing balance',
  dailyClosingBalances: 'Running balance series',
  sanctionedOdLimit: 'Sanctioned OD/CC limit',
  peakOdUsage: 'Peak OD utilisation',
  gstr1OutwardTaxable: 'GSTR-1 outward taxable supplies',
  gstr3bTaxPaid: 'GSTR-3B tax paid',
  gstr1DeclaredTax: 'GSTR-1 declared tax',
  inwardBounces: 'Inward cheque / NACH returns',
  totalDebitAttempts: 'Debit attempts',
  outwardBounces: 'Outward payment returns',
  totalOutwardAttempts: 'Outward payment attempts',
  monthlyEmiObligations: 'Monthly EMI obligations',
  newBorrowingCount6M: 'New borrowings (last 6 months)',
  totalTaxPaid: 'Total GST paid',
  gstComplianceScore: 'GST compliance score',
  transactions: 'Transaction list'
});

// Unknown keys are de-camelCased rather than shown raw ("fooBarBaz" -> "Foo bar baz").
function fieldLabel(key) {
  if (Object.prototype.hasOwnProperty.call(FIELD_LABELS, key)) return FIELD_LABELS[key];
  const words = String(key).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim().toLowerCase();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : String(key);
}

const gapCaveat = (key) => `Not found in statement: ${fieldLabel(key)}`;

module.exports = { FIELD_LABELS, fieldLabel, gapCaveat };
