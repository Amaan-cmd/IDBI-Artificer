// Deterministic parser for bank-statement transaction tables (no LLM).
//
// Supported input:
//   * delimited tables (comma with quoted fields, tab, pipe) with a header row
//     naming a date column and either debit + credit columns or a single
//     amount column with a Dr/Cr indicator (column, suffix or sign);
//   * whitespace-aligned text extracted from PDFs, where a transaction line
//     starts with a date and ends with amounts (best effort, conservative).
//
// Only observed values are returned. A table that is found but cannot be read
// exactly (unparseable amount, rows out of date order, running balance that
// does not add up) is rejected with an error; nothing is guessed.
//
// Decisions:
//   * Bounces: a row whose narration matches BOUNCE_RE is one bounce event.
//     A bounce *charge* row ("Cheque Bounce Charges") counts, because the bank
//     only levies it for a bounce; but a charge on the same date as a
//     non-charge bounce row is treated as part of that event, not a second one.
//   * EMI: average per calendar month of withdrawals whose narration matches
//     EMI_RE. None found -> 0 (the whole statement was observed), not a gap.
//     NACH / ACH debits are not always loans, so this can overstate.
//   * totalDebitAttempts: number of withdrawal rows in the statement.

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const MIN_ROWS = 3;
const CONTINUITY_TOLERANCE = 1; // rupees
const MIN_CONTINUITY_RATIO = 0.9;

const BOUNCE_RE = /bounce|dishono?u?r|chq\s*ret|return(ed)?\s*(chq|cheque|ach|nach)/i;
const CHARGE_RE = /charges?|chgs?|\bfee/i;
const EMI_RE = /\bemi\b|loan|ach\s*d|nach/i;

class StatementParseError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'StatementParseError';
    this.code = code; // 'NOT_DETECTED' | 'INVALID'
  }
}
const notDetected = (msg) => new StatementParseError(msg, 'NOT_DETECTED');
const invalid = (msg) => new StatementParseError(msg, 'INVALID');

// ---------------------------------------------------------------- dates

const MON = '(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\\.?';
const DATE_FORMS = [
  // DD-MMM-YYYY, DD MMM YYYY, DD/MMM/YY, DD-MMM-YY
  { re: new RegExp(`^(\\d{1,2})[\\s\\-/.]+${MON}[\\s\\-/.,]+(\\d{4}|\\d{2})`, 'i'), d: 1, m: 2, y: 3, named: true },
  // YYYY-MM-DD, YYYY/MM/DD
  { re: /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?![\d])/, d: 3, m: 2, y: 1 },
  // DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, DD/MM/YY
  { re: /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})(?![\d])/, d: 1, m: 2, y: 3 }
];

// Returns { iso, y, m, d, length } for a date at the start of `s`, else null.
function parseDateAtStart(s) {
  const str = String(s || '').trim();
  for (const f of DATE_FORMS) {
    const match = f.re.exec(str);
    if (!match) continue;
    const d = Number(match[f.d]);
    const m = f.named ? MONTHS[match[f.m].toLowerCase().slice(0, 3)] : Number(match[f.m]);
    let y = Number(match[f.y]);
    if (match[f.y].length === 2) y += 2000;
    if (!m || m < 1 || m > 12 || d < 1 || d > 31) return null;
    const probe = new Date(Date.UTC(y, m - 1, d));
    if (probe.getUTCMonth() !== m - 1) return null; // e.g. 31-Apr
    const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return { iso, y, m, d, length: match[0].length };
  }
  return null;
}

// A cell that is exactly a date (time of day allowed after it).
function parseDateCell(s) {
  const str = String(s || '').trim();
  const r = parseDateAtStart(str);
  if (!r) return null;
  const rest = str.slice(r.length).trim();
  return rest === '' || /^\d{1,2}:\d{2}(:\d{2})?(\s*[ap]m)?$/i.test(rest) ? r : null;
}

// ---------------------------------------------------------------- amounts

// Parses "7,50,000.00", "₹ 1,000", "INR 500", "1,000.00 Cr", "(2,000)", "-50".
// Returns { value, mark } (value signed; mark 'cr' | 'dr' | null), { blank: true }
// for an empty cell, or null when the cell is not an amount.
function parseAmount(raw) {
  let s = String(raw ?? '').trim();
  if (s === '' || /^-{1,2}$/.test(s)) return { value: 0, mark: null, blank: true };
  let mark = null;
  const suffix = /\s*(?<![a-z])(cr|dr)\.?$/i.exec(s);
  if (suffix) { mark = suffix[1].toLowerCase(); s = s.slice(0, suffix.index).trim(); }
  s = s.replace(/^(?:₹|inr|rs\.?)\s*/i, '');
  let negative = false;
  const paren = /^\((.*)\)$/.exec(s);
  if (paren) { negative = true; s = paren[1].trim(); }
  if (s.startsWith('-')) { negative = !negative; s = s.slice(1).trim(); }
  s = s.replace(/^(?:₹|inr|rs\.?)\s*/i, '');
  if (!/^\d[\d,]*(\.\d+)?$/.test(s) || /,,|,\./.test(s)) return null;
  let value = Number(s.replace(/,/g, ''));
  if (!Number.isFinite(value)) return null;
  if (negative || mark === 'dr') value = -Math.abs(value);
  return { value, mark, blank: false };
}

const round2 = (n) => Math.round(n * 100) / 100;

// "Opening Balance: 450000.50" -> 450000.5 (first or last occurrence).
function labelled(text, labels, which) {
  const re = new RegExp(`(?:${labels})[ \\t]*[:=-]?[ \\t]*((?:₹|INR|Rs\\.?)?[ \\t]*\\(?-?[ \\t]*\\d[\\d,]*(?:\\.\\d+)?\\)?(?:[ \\t]*(?:Cr|Dr)\\.?(?![A-Za-z]))?)`, 'gi');
  const hits = [...text.matchAll(re)].map(m => parseAmount(m[1])).filter(a => a && !a.blank).map(a => a.value);
  if (!hits.length) return undefined;
  return which === 'first' ? hits[0] : hits[hits.length - 1];
}

// ---------------------------------------------------------------- tables

function splitCsv(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(c => c.trim());
}

const SPLITTERS = {
  tab: (l) => l.split('\t').map(c => c.trim()),
  pipe: (l) => {
    const cells = l.split('|').map(c => c.trim());
    if (cells.length && cells[0] === '') cells.shift();
    if (cells.length && cells[cells.length - 1] === '') cells.pop();
    return cells;
  },
  comma: splitCsv
};
const DELIM_CHAR = { tab: '\t', pipe: '|', comma: ',' };

function classifyHeader(cell) {
  const c = String(cell).toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z/ ]/g, ' ')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ')
    .trim();
  if (/^(txn |transaction |tran |trans |posting |post |book )?date$/.test(c)) return 'date';
  if (/^value date$/.test(c)) return 'valueDate';
  if (/^(dr\/cr|cr\/dr|debit\/credit|credit\/debit|dr cr|cr dr|type|txn type|transaction type|d\/c|c\/d)$/.test(c)) return 'drcr';
  if (/^(withdrawals?|debits?|dr)( amt| amount| amounts)?$/.test(c)) return 'debit';
  if (/^(deposits?|credits?|cr)( amt| amount| amounts)?$/.test(c)) return 'credit';
  if (/^((closing|running|available|ledger) )?balance( amt| amount)?$/.test(c)) return 'balance';
  if (/^(txn |transaction )?(amount|amt)$/.test(c)) return 'amount';
  if (/^(narration|description|particulars|remarks|details|transaction details|transaction remarks|transaction description|txn description)$/.test(c)) return 'narration';
  return null;
}

// Column indexes when `cells` is a usable header, else null.
function headerColumns(cells) {
  const cols = {};
  cells.forEach((cell, i) => {
    const k = classifyHeader(cell);
    if (k && cols[k] === undefined) cols[k] = i;
  });
  if (cols.date === undefined && cols.valueDate !== undefined) cols.date = cols.valueDate;
  if (cols.date === undefined) return null;
  const split = cols.debit !== undefined && cols.credit !== undefined;
  if (!split && cols.amount === undefined) return null;
  cols.mode = split ? 'split' : 'single';
  return cols;
}

function findDelimitedHeader(lines) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/\d{4}/.test(line)) continue; // headers carry no years / figures
    for (const delim of ['tab', 'pipe', 'comma']) {
      if (!line.includes(DELIM_CHAR[delim])) continue;
      const cols = headerColumns(SPLITTERS[delim](line));
      if (cols) return { index: i, delim, cols };
    }
  }
  return null;
}

function debitCreditFromSingle(cells, cols) {
  const amt = parseAmount(cells[cols.amount]);
  if (!amt || amt.blank) return null;
  let side = null;
  if (cols.drcr !== undefined) {
    const ind = String(cells[cols.drcr] || '').trim().toLowerCase();
    if (/^(dr|d|debit|withdrawal)\.?$/.test(ind)) side = 'dr';
    else if (/^(cr|c|credit|deposit)\.?$/.test(ind)) side = 'cr';
  }
  if (!side && amt.mark) side = amt.mark;
  if (!side && amt.value < 0) side = 'dr';
  if (!side) return null; // direction unknown: do not guess
  const v = Math.abs(amt.value);
  return side === 'dr' ? { debit: v, credit: 0 } : { debit: 0, credit: v };
}

function parseDelimited(lines, header) {
  const { cols, delim } = header;
  const split = SPLITTERS[delim];
  const rows = [];
  for (let j = header.index + 1; j < lines.length; j++) {
    const line = lines[j];
    if (!/[A-Za-z0-9]/.test(line)) continue; // blank or ruler line
    const cells = split(line);
    if (headerColumns(cells)) continue; // header repeated on a new page
    const date = parseDateCell(cells[cols.date]);
    if (!date) {
      if (rows.length) break; // end of table (summary, footer)
      continue;
    }
    let debit;
    let credit;
    if (cols.mode === 'split') {
      const d = parseAmount(cells[cols.debit]);
      const c = parseAmount(cells[cols.credit]);
      if (!d || !c) throw invalid(`Unreadable amount on line ${j + 1}`);
      debit = Math.abs(d.value);
      credit = Math.abs(c.value);
    } else {
      const dc = debitCreditFromSingle(cells, cols);
      if (!dc) throw invalid(`Unreadable amount or Dr/Cr direction on line ${j + 1}`);
      ({ debit, credit } = dc);
    }
    let balance = null;
    if (cols.balance !== undefined) {
      const b = parseAmount(cells[cols.balance]);
      if (!b) throw invalid(`Unreadable balance on line ${j + 1}`);
      balance = b.blank ? null : b.value;
    }
    const narration = cols.narration !== undefined ? String(cells[cols.narration] || '') : '';
    rows.push({ date: date.iso, narration, debit, credit, balance });
  }
  return { rows, hasBalance: cols.balance !== undefined };
}

// ---------------------------------------------------------------- PDF text

const TEXT_AMOUNT = /^(?:₹|INR|Rs\.?)?\(?-?[\d,]*\d\.\d{2}\)?(?:Cr|Dr)?\.?$/i;

// Whitespace-aligned lines: "<date> <narration ...> [<amt>] <amt> <balance>".
// Amounts must carry two decimals so reference numbers are never read as money.
function collectTextRows(lines) {
  const raw = [];
  let order = null; // 'debitFirst' | 'creditFirst', from a header line
  for (const line of lines) {
    const t = line.trim();
    if (!order && /date/i.test(t) && !/\d{4}/.test(t)) {
      const d = t.search(/withdrawal|debit|\bdr\b/i);
      const c = t.search(/deposit|credit|\bcr\b/i);
      if (d >= 0 && c >= 0) order = d < c ? 'debitFirst' : 'creditFirst';
    }
    const date = parseDateAtStart(t);
    if (!date) continue;
    const tokens = t.slice(date.length).trim().split(/\s+/).filter(Boolean);
    const merged = [];
    for (const tok of tokens) {
      if (/^(cr|dr)\.?$/i.test(tok) && merged.length) merged[merged.length - 1] += tok;
      else merged.push(tok);
    }
    const amounts = [];
    while (merged.length && (TEXT_AMOUNT.test(merged[merged.length - 1]) || merged[merged.length - 1] === '-')) {
      amounts.unshift(merged.pop());
    }
    if (amounts.length < 2 || amounts[amounts.length - 1] === '-') continue;
    // Drop a value-date token left at the end of the narration.
    if (merged.length && parseDateCell(merged[merged.length - 1])) merged.pop();
    raw.push({ date: date.iso, narration: merged.join(' '), amounts: amounts.map(parseAmount) });
  }
  return { raw, order };
}

// Resolves each text row to debit/credit using the header column order (three
// amounts) or the running balance (two amounts). Unresolvable rows reject the
// statement.
function resolveTextRows(raw, order, opening) {
  const rows = [];
  let prev = opening;
  for (const r of raw) {
    if (r.amounts.some(a => !a)) throw invalid('Unreadable amount in statement text');
    const balance = r.amounts[r.amounts.length - 1].value;
    let debit;
    let credit;
    if (r.amounts.length >= 3 && order) {
      const [a, b] = r.amounts.slice(-3, -1).map(x => Math.abs(x.value));
      [debit, credit] = order === 'debitFirst' ? [a, b] : [b, a];
    } else {
      const amt = r.amounts[r.amounts.length - 2];
      const v = Math.abs(amt.value);
      if (amt.mark === 'dr') [debit, credit] = [v, 0];
      else if (amt.mark === 'cr') [debit, credit] = [0, v];
      else if (prev === undefined || prev === null) throw invalid('Cannot tell debit from credit without an opening balance');
      else if (Math.abs(prev + v - balance) <= CONTINUITY_TOLERANCE) [debit, credit] = [0, v];
      else if (Math.abs(prev - v - balance) <= CONTINUITY_TOLERANCE) [debit, credit] = [v, 0];
      else throw invalid(`Running balance does not reconcile on ${r.date}`);
    }
    rows.push({ date: r.date, narration: r.narration, debit, credit, balance });
    prev = balance;
  }
  return rows;
}

// ---------------------------------------------------------------- checks

// Rows in chronological order; a reverse-chronological export is flipped.
function chronological(rows) {
  const asc = rows.every((r, i) => i === 0 || rows[i - 1].date <= r.date);
  if (asc) return rows;
  const desc = rows.every((r, i) => i === 0 || rows[i - 1].date >= r.date);
  if (desc) return rows.slice().reverse();
  throw invalid('Transaction rows are not in date order');
}

// prev balance + credit - debit == balance (within ₹1) for >= 90% of checks.
function checkContinuity(rows, opening) {
  let running = opening ?? null;
  let checks = 0;
  let passes = 0;
  for (const r of rows) {
    if (r.balance === null) {
      if (running !== null) running = round2(running + r.credit - r.debit);
      continue;
    }
    if (running !== null) {
      checks++;
      if (Math.abs(running + r.credit - r.debit - r.balance) <= CONTINUITY_TOLERANCE) passes++;
    }
    running = r.balance;
  }
  if (!checks || passes / checks < MIN_CONTINUITY_RATIO) {
    throw invalid(`Running balance continuity failed (${passes}/${checks} rows reconcile)`);
  }
  return { checks, passes };
}

function monthKey(iso) { return iso.slice(0, 7); }
function monthRange(first, last) {
  const out = [];
  let [y, m] = first.split('-').map(Number);
  const [ly, lm] = last.split('-').map(Number);
  while (y < ly || (y === ly && m <= lm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

function countBounces(rows) {
  const hits = rows.filter(r => BOUNCE_RE.test(r.narration));
  const eventDates = new Set(hits.filter(r => !CHARGE_RE.test(r.narration)).map(r => r.date));
  const lone = hits.filter(r => CHARGE_RE.test(r.narration) && !eventDates.has(r.date));
  return hits.filter(r => !CHARGE_RE.test(r.narration)).length + lone.length;
}

// ---------------------------------------------------------------- main

/**
 * Parses a bank-statement transaction table out of `text`.
 * Throws StatementParseError: code 'NOT_DETECTED' when there is no
 * transaction table, 'INVALID' when one is found but does not validate.
 */
function parseBankStatement(text) {
  const src = String(text || '');
  const lines = src.split(/\r?\n/);
  const labelledOpening = labelled(src, 'Opening Balance|Opening Bal\\.?|Op\\.? Bal(?:ance)?', 'first');
  const labelledClosing = labelled(src, 'Closing Balance|Closing Bal\\.?|Cl\\.? Bal(?:ance)?', 'last');

  let rows;
  let hasBalance;
  let format;
  const header = findDelimitedHeader(lines);
  if (header) {
    ({ rows, hasBalance } = parseDelimited(lines, header));
    rows = chronological(rows);
    format = header.delim;
  } else {
    const { raw, order } = collectTextRows(lines);
    if (raw.length < MIN_ROWS) throw notDetected('No transaction table found');
    rows = resolveTextRows(chronological(raw), order, labelledOpening);
    hasBalance = true;
    format = 'text';
  }

  if (rows.length < MIN_ROWS) {
    throw (header ? invalid : notDetected)(`Only ${rows.length} transaction rows found (need ${MIN_ROWS})`);
  }
  hasBalance = hasBalance && rows.some(r => r.balance !== null);
  if (hasBalance) checkContinuity(rows, labelledOpening);

  // Calendar-month totals, chronological, including months with no rows.
  const months = monthRange(monthKey(rows[0].date), monthKey(rows[rows.length - 1].date));
  const credits = Object.fromEntries(months.map(m => [m, 0]));
  const debits = Object.fromEntries(months.map(m => [m, 0]));
  for (const r of rows) {
    credits[monthKey(r.date)] += r.credit;
    debits[monthKey(r.date)] += r.debit;
  }
  const monthlyCredits = months.map(m => round2(credits[m]));
  const monthlyDebits = months.map(m => round2(debits[m]));

  const out = {
    format,
    months,
    monthsAnalyzed: months.length,
    monthlyCredits,
    monthlyDebits,
    totalCreditVolume: round2(rows.reduce((a, r) => a + r.credit, 0)),
    totalDebitVolume: round2(rows.reduce((a, r) => a + r.debit, 0)),
    inwardBounces: countBounces(rows),
    totalDebitAttempts: rows.filter(r => r.debit > 0).length,
    monthlyEmiObligations: round2(
      rows.filter(r => r.debit > 0 && EMI_RE.test(r.narration)).reduce((a, r) => a + r.debit, 0) / months.length
    ),
    transactions: rows.map(r => ({
      date: r.date,
      narration: r.narration,
      debit: r.debit,
      credit: r.credit,
      balance: r.balance,
      type: r.credit > 0 && r.debit === 0 ? 'CREDIT' : r.debit > 0 && r.credit === 0 ? 'DEBIT' : 'MIXED',
      amount: r.credit > 0 && r.debit === 0 ? r.credit : r.debit > 0 && r.credit === 0 ? r.debit : round2(r.credit - r.debit)
    }))
  };

  if (labelledOpening !== undefined) out.bankOpeningBalance = labelledOpening;
  if (hasBalance) {
    // Running balance after every row, so a missing balance cell is filled from
    // the reconciled arithmetic of the rows around it.
    let running = labelledOpening ?? null;
    const first = rows.find(r => r.balance !== null);
    if (running === null) {
      const idx = rows.indexOf(first);
      running = round2(rows.slice(0, idx + 1).reduce((a, r) => a - r.credit + r.debit, first.balance));
      out.bankOpeningBalance = running;
    }
    const endOfDay = new Map();
    for (const r of rows) {
      running = r.balance !== null ? r.balance : round2(running + r.credit - r.debit);
      endOfDay.set(r.date, running);
    }
    out.dailyClosingBalances = [...endOfDay.values()];
    out.bankClosingBalance = running;
    // End-to-end: the summed rows must carry the opening to the closing
    // balance. The 90% row rule tolerates a stray row; this stops a stray row
    // from inflating the monthly totals.
    const net = out.bankOpeningBalance + out.totalCreditVolume - out.totalDebitVolume;
    if (Math.abs(net - running) > CONTINUITY_TOLERANCE) {
      throw invalid(`Running balance continuity failed: rows sum to ${round2(net)}, statement closes at ${running}`);
    }
    if (labelledClosing !== undefined && Math.abs(labelledClosing - running) > CONTINUITY_TOLERANCE) {
      throw invalid(`Closing balance ${running} does not match the stated ${labelledClosing}`);
    }
  } else if (labelledClosing !== undefined) {
    out.bankClosingBalance = labelledClosing;
  }

  const odLimit = labelled(src, 'Sanctioned Limit', 'last')
    ?? labelled(src, 'OD Limit|CC Limit|Overdraft Limit', 'last')
    ?? labelled(src, 'Drawing Power', 'last');
  if (odLimit !== undefined) {
    out.sanctionedOdLimit = Math.abs(odLimit);
    if (out.dailyClosingBalances) {
      const lowest = Math.min(...rows.filter(r => r.balance !== null).map(r => r.balance));
      out.peakOdUsage = lowest < 0 ? Math.abs(lowest) : 0;
    }
  }
  return out;
}

module.exports = {
  parseBankStatement,
  StatementParseError,
  parseAmount,
  parseDateAtStart,
  classifyHeader,
  BOUNCE_RE,
  EMI_RE
};
