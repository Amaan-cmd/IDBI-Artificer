const test = require('node:test');
const assert = require('node:assert/strict');
const { sendOtpEmail, isEmailConfigured, otpMessage } = require('../services/emailSender');

test('isEmailConfigured needs both connection string and sender', () => {
  const prev = { c: process.env.ACS_EMAIL_CONNECTION_STRING, s: process.env.ACS_EMAIL_SENDER };
  try {
    process.env.ACS_EMAIL_CONNECTION_STRING = 'endpoint=https://x/;accesskey=y';
    delete process.env.ACS_EMAIL_SENDER;
    assert.equal(isEmailConfigured(), false);
    process.env.ACS_EMAIL_SENDER = 'DoNotReply@x.azurecomm.net';
    assert.equal(isEmailConfigured(), true);
  } finally {
    for (const [k, v] of [['ACS_EMAIL_CONNECTION_STRING', prev.c], ['ACS_EMAIL_SENDER', prev.s]]) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  }
});

test('sendOtpEmail sends the code to the recipient and surfaces rejections', async () => {
  process.env.ACS_EMAIL_SENDER = 'DoNotReply@x.azurecomm.net';
  try {
    const sent = [];
    const ok = { beginSend: async (m) => { sent.push(m); return { pollUntilDone: async () => ({ status: 'Succeeded' }) }; } };
    await sendOtpEmail('a@bank.com', '123456', { emailClient: ok });
    assert.equal(sent[0].recipients.to[0].address, 'a@bank.com');
    assert.equal(sent[0].senderAddress, 'DoNotReply@x.azurecomm.net');
    assert.match(sent[0].content.subject, /123456/);
    assert.match(otpMessage('a@bank.com', '654321').content.plainText, /654321/);

    const bad = { beginSend: async () => { throw new Error('401 Denied'); } };
    await assert.rejects(sendOtpEmail('a@bank.com', '123456', { emailClient: bad }), /Denied/);
  } finally {
    delete process.env.ACS_EMAIL_SENDER;
  }
});
