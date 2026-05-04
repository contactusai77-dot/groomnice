/**
 * logic_engine.js — The Brain
 * Receives a normalized appointment object and returns zero or more
 * { to, message } actions for the messenger to execute.
 */

/**
 * @typedef {Object} Appointment
 * @property {string}  id
 * @property {string}  status          - e.g. "confirmed", "canceled", "no_show"
 * @property {string}  customer_name
 * @property {string}  customer_phone
 * @property {string}  pet_name
 * @property {string}  pet_species     - e.g. "dog", "cat"
 * @property {string|null} vaccine_status  - null / "" means unknown/missing
 * @property {string|null} rabies_expiry   - ISO date string or null
 * @property {string}  appointment_date   - ISO date string
 * @property {string}  [notes]
 */

/**
 * @typedef {Object} Action
 * @property {"sms"}   type
 * @property {string}  to       - E.164 phone number
 * @property {string}  message
 */

/**
 * Evaluate one appointment event and return the list of SMS actions to fire.
 * @param {Appointment} appt
 * @param {string} ownerPhone - salon owner's phone for internal alerts
 * @returns {Action[]}
 */
function checkAppointment(appt, ownerPhone) {
  const actions = [];
  const petLabel = `${appt.pet_name} (${appt.customer_name})`;

  // --- Rule 1: Missing or expired vaccine record ---
  const missingVaccine =
    !appt.vaccine_status || appt.vaccine_status.trim() === "";

  const vaccineExpired =
    appt.rabies_expiry && new Date(appt.rabies_expiry) < new Date();

  if (missingVaccine || vaccineExpired) {
    const reason = vaccineExpired
      ? "Rabies certificate on file is expired"
      : "No Rabies certificate on file";

    actions.push({
      type: "sms",
      to: appt.customer_phone,
      message:
        `Hi ${appt.customer_name}! We're looking forward to seeing ${appt.pet_name}. ` +
        `${reason}. Please reply with a photo of the current Rabies certificate ` +
        `before your appointment on ${formatDate(appt.appointment_date)}. Thanks! 🐾`,
    });
  }

  // --- Rule 2: Canceled appointment — alert owner to fill the gap ---
  if (appt.status === "canceled") {
    actions.push({
      type: "sms",
      to: ownerPhone,
      message:
        `⚠️ Gap alert: ${petLabel}'s appointment on ` +
        `${formatDate(appt.appointment_date)} was CANCELED. ` +
        `Consider reaching out to your waitlist.`,
    });
  }

  // --- Rule 3: No-show ---
  if (appt.status === "no_show") {
    actions.push({
      type: "sms",
      to: ownerPhone,
      message:
        `🚫 No-show: ${petLabel} did not arrive for their ` +
        `${formatDate(appt.appointment_date)} appointment.`,
    });

    // Optionally send a gentle follow-up to the customer
    actions.push({
      type: "sms",
      to: appt.customer_phone,
      message:
        `Hi ${appt.customer_name}, we missed you and ${appt.pet_name} today! ` +
        `Reply RESCHEDULE and we'll get you back on the calendar. 🐾`,
    });
  }

  return actions;
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

module.exports = { checkAppointment };
