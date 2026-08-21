/**
 * Dispatches real-time security and underwriting notifications to Slack
 * (Reaches user's connected iOS notification / Spark workspace).
 */
async function sendSlackNotification({ title, message, fields = [], color = '#E8660A' }) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const payload = {
    attachments: [
      {
        color: color,
        title: `🚨 [EnverAI Artificer Security] ${title}`,
        text: message,
        fields: [
          ...fields,
          { title: "Timestamp (IST)", value: timestamp, short: true },
          { title: "Environment", value: process.env.NODE_ENV || "production", short: true }
        ],
        footer: "EnverAI Artificer Telemetry Engine"
      }
    ]
  };

  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      console.log('[Slack Alert] Notification successfully dispatched to Slack.');
    } catch (error) {
      console.warn('[Slack Alert] Failed to dispatch Slack webhook:', error.message);
    }
  } else {
    console.log('[Slack Alert Simulation]', JSON.stringify(payload, null, 2));
  }
}

module.exports = { sendSlackNotification };
