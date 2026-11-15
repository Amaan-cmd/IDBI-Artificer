/**
 * Sends sign-in codes through Azure Communication Services Email.
 * Config: ACS_EMAIL_CONNECTION_STRING and ACS_EMAIL_SENDER (a verified sender
 * address, e.g. DoNotReply@<id>.azurecomm.net or noreply@enveraitech.in).
 */
let client = null;

const isEmailConfigured = () => Boolean((process.env.ACS_EMAIL_CONNECTION_STRING || '').trim() && (process.env.ACS_EMAIL_SENDER || '').trim());

function getClient() {
  if (!client) {
    const { EmailClient } = require('@azure/communication-email');
    client = new EmailClient(process.env.ACS_EMAIL_CONNECTION_STRING.trim());
  }
  return client;
}

function otpMessage(to, code) {
  return {
    senderAddress: process.env.ACS_EMAIL_SENDER.trim(),
    recipients: { to: [{ address: to }] },
    content: {
      subject: `${code} is your Artificer sign-in code`,
      plainText: `Your Artificer sign-in code is ${code}.\n\nIt expires in 10 minutes. If you did not request it, you can ignore this email.\n\nEnver AI Tech · Artificer`,
      html: `<div style="font-family:Arial,sans-serif;color:#0f172a">
<p>Your Artificer sign-in code is</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:12px 0">${code}</p>
<p style="color:#475569">It expires in 10 minutes. If you did not request it, you can ignore this email.</p>
<p style="color:#94a3b8;font-size:12px">Enver AI Tech · Artificer</p></div>`
    }
  };
}

// Resolves once ACS accepts the message (bad credentials or sender throw here).
// Delivery can take several seconds, so its outcome is only logged.
async function sendOtpEmail(to, code, { emailClient = null } = {}) {
  const c = emailClient || getClient();
  const poller = await c.beginSend(otpMessage(to, code));
  Promise.resolve(poller.pollUntilDone())
    .then((result) => {
      if (result?.status !== 'Succeeded') console.error(`[Email] Delivery ${result?.status || 'failed'}: ${result?.error?.message || ''}`);
    })
    .catch((err) => console.error('[Email] Delivery check failed:', err.message));
}

module.exports = { isEmailConfigured, sendOtpEmail, otpMessage };
