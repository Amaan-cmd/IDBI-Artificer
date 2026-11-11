const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateMSMECredit } = require('../controllers/creditController');

// When the SSE stream breaks after headers are sent, the outer error handler
// must end the response and stop the keep-alive heartbeat without throwing.
test('stream failure after headers ends the response and stops the heartbeat', async () => {
  let writes = 0;
  let ended = false;
  const res = {
    headersSent: false,
    setHeader() {},
    flushHeaders() { this.headersSent = true; },
    write() { writes += 1; if (writes <= 2) throw new Error('socket closed'); },
    end() { ended = true; },
    status() { return this; },
    json() { return this; }
  };
  const req = {
    body: { gstin: '27AAHCE5539J1ZA' },
    session: { uid: 'u1', email: 'a@x.com', name: 'A', role: 'r' },
    on() {}
  };
  const origErr = console.error;
  console.error = () => {};
  try {
    await evaluateMSMECredit(req, res);
  } finally {
    console.error = origErr;
  }
  assert.equal(ended, true);
  // If the heartbeat interval leaked, this test process would never exit.
});
