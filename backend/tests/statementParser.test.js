const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { parseBankStatement, parseAmount, parseDateAtStart } = require('../agents/statementParser');

const SAMPLE = fs.readFileSync(path.join(__dirname, '..', '..', 'dataset', 'Sample_Bank_Statement.csv'), 'utf8');

const rejects = (text, code, re) => assert.throws(() => parseBankStatement(text), (err) => {
  assert.equal(err.code, code);
  if (re) assert.match(err.message, re);
  return true;
});

test('sample CSV: monthly sums, balances and bounce count match the file', () => {
  const r = parseBankStatement(SAMPLE);
  assert.equal(r.format, 'comma');
  assert.deepEqual(r.months, ['2026-03', '2026-04', '2026-05']);
  assert.equal(r.monthsAnalyzed, 3);
  assert.deepEqual(r.monthlyCredits, [470000, 390000, 146200]);
  assert.deepEqual(r.monthlyDebits, [370000, 150500, 175000]);
  // The file's own SUMMARY: Total Credits 1006200.00, Total Debits 695500.00.
  assert.equal(r.totalCreditVolume, 1006200);
  assert.equal(r.totalDebitVolume, 695500);
  assert.equal(r.bankOpeningBalance, 450000.5);
  assert.equal(r.bankClosingBalance, 760700.5);
  // "Cheque Bounce Charges" is the only bounce evidence; the SUMMARY states 1.
  assert.equal(r.inwardBounces, 1);
  assert.equal(r.monthlyEmiObligations, 0);
  assert.equal(r.totalDebitAttempts, 7);
  assert.equal(r.transactions.length, 13);
  assert.deepEqual(r.transactions[0], {
    date: '2026-03-01', narration: 'UPI/Sales/QR-01', debit: 0, credit: 150000, balance: 600000.5, type: 'CREDIT', amount: 150000
  });
  assert.equal(r.dailyClosingBalances.length, 13);
  assert.equal(r.dailyClosingBalances.at(-1), 760700.5);
  assert.equal(r.sanctionedOdLimit, undefined);
});

test('tab-separated variant parses identically', () => {
  const r = parseBankStatement(SAMPLE.replace(/,/g, '\t'));
  assert.equal(r.format, 'tab');
  assert.deepEqual(r.monthlyCredits, [470000, 390000, 146200]);
  assert.deepEqual(r.monthlyDebits, [370000, 150500, 175000]);
  assert.equal(r.bankClosingBalance, 760700.5);
});

test('quoted CSV with Indian grouping, ₹, DD/MM/YYYY and EMI debits', () => {
  const text = [
    'Account Holder: Real Widgets Pvt Ltd',
    'Opening Balance: ₹7,50,000.00',
    'Txn Date,Description,Debit Amount (INR),Credit Amount (INR),Balance (INR)',
    '02/01/2026,"NEFT/ACME, Pune",,"₹2,50,000.00","₹10,00,000.00"',
    '10/01/2026,EMI LOAN 123,"₹50,000.00",,"₹9,50,000.00"',
    '05/02/2026,UPI/Sales,,"₹1,25,000.50","₹10,75,000.50"',
    '10/02/2026,EMI LOAN 123,"₹50,000.00",,"₹10,25,000.50"'
  ].join('\n');
  const r = parseBankStatement(text);
  assert.deepEqual(r.monthlyCredits, [250000, 125000.5]);
  assert.deepEqual(r.monthlyDebits, [50000, 50000]);
  assert.equal(r.monthlyEmiObligations, 50000);
  assert.equal(r.bankOpeningBalance, 750000);
  assert.equal(r.bankClosingBalance, 1025000.5);
  assert.equal(r.transactions[0].narration, 'NEFT/ACME, Pune');
  assert.equal(r.inwardBounces, 0);
});

test('pipe table with single Amount + Dr/Cr column, ISO dates, newest first', () => {
  const text = [
    '| Date | Particulars | Amount | Dr/Cr | Balance |',
    '|------|-------------|--------|-------|---------|',
    '| 2026-05-20 | ATM WDL | 10,000.00 | Dr | 1,05,000.00 Cr |',
    '| 2026-05-03 | CHQ RET 4411 | 5,000.00 | Dr | 1,15,000.00 Cr |',
    '| 2026-04-15 | NEFT IN | 40,000.00 | Cr | 1,20,000.00 Cr |',
    '| 2026-04-01 | RENT | 20,000.00 | Dr | 80,000.00 Cr |'
  ].join('\n');
  const r = parseBankStatement(text);
  assert.equal(r.format, 'pipe');
  assert.deepEqual(r.monthlyCredits, [40000, 0]);
  assert.deepEqual(r.monthlyDebits, [20000, 15000]);
  assert.equal(r.bankOpeningBalance, 100000);
  assert.equal(r.bankClosingBalance, 105000);
  assert.equal(r.inwardBounces, 1);
  assert.equal(r.transactions[0].date, '2026-04-01');
});

test('single Amount column with Cr/Dr suffix, DD MMM YYYY, overdrawn balances and OD limit', () => {
  const text = [
    'OD Limit: 5,00,000.00',
    'Date\tRemarks\tAmount\tBalance',
    '01 Jun 2026\tSUPPLIER PAY\t1,00,000.00 Dr\t50,000.00 Dr',
    '05 Jun 2026\tCUSTOMER RCPT\t30,000.00 Cr\t20,000.00 Dr',
    '20 Jun 2026\tCUSTOMER RCPT\t70,000.00 Cr\t50,000.00 Cr'
  ].join('\n');
  const r = parseBankStatement(text);
  assert.deepEqual(r.monthlyCredits, [100000]);
  assert.deepEqual(r.monthlyDebits, [100000]);
  assert.equal(r.bankOpeningBalance, 50000);
  assert.equal(r.bankClosingBalance, 50000);
  assert.deepEqual(r.dailyClosingBalances, [-50000, -20000, 50000]);
  assert.equal(r.sanctionedOdLimit, 500000);
  assert.equal(r.peakOdUsage, 50000);
});

test('single Amount column without any direction marker is rejected, not guessed', () => {
  const text = ['Date,Narration,Amount,Balance',
    '01-03-2026,A,100.00,1100.00', '02-03-2026,B,50.00,1050.00', '03-03-2026,C,25.00,1075.00'].join('\n');
  rejects(text, 'INVALID', /direction/);
});

test('PDF-style whitespace text: three amount columns ordered by the header', () => {
  const text = [
    'Opening Balance: 1,00,000.00',
    'Date        Narration                 Withdrawal    Deposit     Balance',
    '03-03-2026  UPI/CUSTOMER/A1           -             25,000.00   1,25,000.00',
    '05-03-2026  NEFT/VENDOR 998877        10,000.00     -           1,15,000.00',
    '07-04-2026  IMPS/CLIENT 07-04-2026    0.00          5,000.00    1,20,000.00'
  ].join('\n');
  const r = parseBankStatement(text);
  assert.equal(r.format, 'text');
  assert.deepEqual(r.monthlyCredits, [25000, 5000]);
  assert.deepEqual(r.monthlyDebits, [10000, 0]);
  assert.equal(r.bankClosingBalance, 120000);
  assert.equal(r.transactions[1].narration, 'NEFT/VENDOR 998877');
  assert.equal(r.transactions[2].narration, 'IMPS/CLIENT');
});

test('PDF-style text with empty columns omitted: direction from the running balance', () => {
  const text = [
    'Opening Balance: 1,00,000.00',
    '03-03-2026 UPI/CUSTOMER/A1 25,000.00 1,25,000.00',
    '05-03-2026 NEFT/VENDOR 10,000.00 1,15,000.00',
    '07-03-2026 IMPS/CLIENT 5,000.00 1,20,000.00'
  ].join('\n');
  const r = parseBankStatement(text);
  assert.deepEqual(r.monthlyCredits, [30000]);
  assert.deepEqual(r.monthlyDebits, [10000]);
  // Without an opening balance the first row's direction is unknown.
  rejects(text.replace(/^Opening Balance.*\n/, ''), 'INVALID', /opening balance/);
  // A row that does not reconcile in either direction rejects the statement.
  rejects(text.replace('1,15,000.00', '1,17,000.00'), 'INVALID');
});

test('broken running-balance continuity is rejected', () => {
  // One altered balance breaks two of thirteen checks (84.6% < 90%).
  const tampered = SAMPLE.replace('04-Apr-2026,UPI/Sales/QR-02,UPI29384,04-Apr-2026,0,180000.00,730000.50',
    '04-Apr-2026,UPI/Sales/QR-02,UPI29384,04-Apr-2026,0,180000.00,735000.50');
  assert.notEqual(tampered, SAMPLE);
  rejects(tampered, 'INVALID', /continuity/);
  // An inflated deposit with untouched balances is also caught.
  rejects(SAMPLE.replace(',0,320000.00,720000.50', ',0,920000.00,720000.50'), 'INVALID', /continuity/);
});

test('a stated closing balance that disagrees with the rows is rejected', () => {
  rejects(SAMPLE.replace('Closing Balance: 760700.50', 'Closing Balance: 960700.50'), 'INVALID', /Closing balance/);
});

test('fewer than three rows under a real header is rejected', () => {
  rejects('Date,Narration,Withdrawal,Deposit,Balance\n01-03-2026,A,0,100.00,100.00\n', 'INVALID', /rows/);
});

test('garbage text throws NOT_DETECTED', () => {
  rejects('Dear customer, thank you for banking with us. 12345 lorem ipsum.', 'NOT_DETECTED');
  rejects('', 'NOT_DETECTED');
});

test('amount and date primitives', () => {
  assert.equal(parseAmount('7,50,000.00').value, 750000);
  assert.equal(parseAmount('₹ 1,000.50').value, 1000.5);
  assert.equal(parseAmount('INR 500').value, 500);
  assert.equal(parseAmount('1,000 Dr').value, -1000);
  assert.equal(parseAmount('1000Cr').value, 1000);
  assert.equal(parseAmount('(2,000)').value, -2000);
  assert.equal(parseAmount('').blank, true);
  assert.equal(parseAmount('abc'), null);
  assert.equal(parseDateAtStart('01-Mar-2026').iso, '2026-03-01');
  assert.equal(parseDateAtStart('01/03/2026').iso, '2026-03-01');
  assert.equal(parseDateAtStart('01-03-2026').iso, '2026-03-01');
  assert.equal(parseDateAtStart('2026-03-01').iso, '2026-03-01');
  assert.equal(parseDateAtStart('1 Mar 2026').iso, '2026-03-01');
  assert.equal(parseDateAtStart('31-Apr-2026'), null);
  assert.equal(parseDateAtStart('Mar 2026'), null);
});
