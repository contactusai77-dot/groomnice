/**
 * webhook_receiver.js — The Ear
 * Express server that listens for MoeGo webhook POST requests,
 * normalizes the payload, runs it through the logic engine,
 * and dispatches any resulting SMS actions.
 */

require("dotenv").config();
const express = require("express");
const crypto = require("crypto");
const { checkAppointment } = require("./logic_engine");
const { dispatchActions } = require("./messenger");

const app = express();
const PORT = process.env.PORT || 3000;

// Parse raw body first so we can verify the HMAC signature when present
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// ---------------------------------------------------------------------------
// Signature verification (optional but recommended once in production)
// MoeGo signs payloads with HMAC-SHA256 using your webhook secret.
// ---------------------------------------------------------------------------
function verifySignature(req) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return true; // skip if no secret configured yet

  const signature = req.headers["x-moego-signature"] || "";
  const expected = crypto
    .createHmac("sha256", secret)
    .update(req.rawBody)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// ---------------------------------------------------------------------------
// Normalize MoeGo payload → our internal Appointment shape
// Adjust field names below once you see real payloads from MoeGo.
// ---------------------------------------------------------------------------
function normalizePayload(body) {
  const appt = body.appointment || body.data || body;
  const pet = appt.pet || {};
  const customer = appt.client || appt.customer || {};

  return {
    id: appt.id || appt.appointment_id || "unknown",
    status: (appt.status || "").toLowerCase(),
    customer_name: customer.name || customer.full_name || "Valued Customer",
    customer_phone: customer.phone || customer.mobile || "",
    pet_name: pet.name || "your pet",
    pet_species: (pet.species || "dog").toLowerCase(),
    vaccine_status: pet.vaccine_status || pet.rabies_status || null,
    rabies_expiry: pet.rabies_expiry || pet.vaccine_expiry || null,
    appointment_date: appt.start_time || appt.date || new Date().toISOString(),
    notes: appt.notes || "",
  };
}

// ---------------------------------------------------------------------------
// Main webhook endpoint
// ---------------------------------------------------------------------------
app.post("/webhook", async (req, res) => {
  // Always respond quickly — MoeGo will retry on timeout
  if (!verifySignature(req)) {
    console.warn("[receiver] Invalid signature — request rejected");
    return res.status(401).json({ error: "Invalid signature" });
  }

  const event = req.body;
  const eventType = event.event_type || event.type || "unknown";
  console.log(`[receiver] Event received: ${eventType}`);
  console.log("[receiver] Raw payload:", JSON.stringify(event, null, 2));

  // Acknowledge immediately so MoeGo doesn't time out
  res.status(200).json({ received: true });

  // Process asynchronously after responding
  try {
    const appointment = normalizePayload(event);

    if (!appointment.customer_phone) {
      console.warn("[receiver] No phone number in payload — skipping SMS");
      return;
    }

    const actions = checkAppointment(
      appointment,
      process.env.OWNER_PHONE_NUMBER
    );

    if (actions.length === 0) {
      console.log("[receiver] No actions triggered for this event");
    } else {
      console.log(`[receiver] Dispatching ${actions.length} action(s)`);
      await dispatchActions(actions);
    }
  } catch (err) {
    console.error("[receiver] Processing error:", err.message);
  }
});

// ---------------------------------------------------------------------------
// Health check — lets Railway/Render know the server is alive
// ---------------------------------------------------------------------------
app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// ---------------------------------------------------------------------------
// Test endpoint — POST here with fake data to verify your logic locally
// ---------------------------------------------------------------------------
app.post("/test", async (req, res) => {
  const fakeAppointment = {
    id: "test-001",
    status: req.body.status || "confirmed",
    customer_name: "Jane Smith",
    customer_phone: process.env.OWNER_PHONE_NUMBER || "+15550000000",
    pet_name: "Biscuit",
    pet_species: "dog",
    vaccine_status: req.body.vaccine_status ?? null,
    rabies_expiry: req.body.rabies_expiry ?? null,
    appointment_date: new Date(Date.now() + 86400000).toISOString(),
  };

  const actions = checkAppointment(
    fakeAppointment,
    process.env.OWNER_PHONE_NUMBER
  );

  res.json({
    appointment: fakeAppointment,
    actions_generated: actions,
    sms_sent: false, // set SEND_TEST_SMS=true to actually fire them
  });

  if (process.env.SEND_TEST_SMS === "true") {
    await dispatchActions(actions);
  }
});

app.listen(PORT, () => {
  console.log(`[receiver] Listening on port ${PORT}`);
  console.log(`[receiver] Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`[receiver] Health check: http://localhost:${PORT}/health`);
  console.log(`[receiver] Test endpoint: http://localhost:${PORT}/test`);
});
