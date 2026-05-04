/**
 * messenger.js — The Voice
 * Thin wrapper around the Twilio SDK. Sends SMS messages.
 */

require("dotenv").config();
const twilio = require("twilio");

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * Send a single SMS.
 * @param {string} to      - E.164 recipient number, e.g. "+15551234567"
 * @param {string} message - Body text (keep under 160 chars to avoid multi-part billing)
 * @returns {Promise<string>} Twilio message SID on success
 */
async function sendSMS(to, message) {
  const result = await client.messages.create({
    from: process.env.TWILIO_PHONE_NUMBER,
    to,
    body: message,
  });
  console.log(`[messenger] SMS sent → ${to} | SID: ${result.sid}`);
  return result.sid;
}

/**
 * Fire all actions returned by the logic engine.
 * Failures are logged but do not throw, so one bad number won't block others.
 * @param {import('./logic_engine').Action[]} actions
 */
async function dispatchActions(actions) {
  for (const action of actions) {
    if (action.type === "sms") {
      try {
        await sendSMS(action.to, action.message);
      } catch (err) {
        console.error(
          `[messenger] Failed to send SMS to ${action.to}: ${err.message}`
        );
      }
    }
  }
}

module.exports = { sendSMS, dispatchActions };
