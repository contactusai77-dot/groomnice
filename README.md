# Pet Groomer Automation Engine

Headless webhook relay: MoeGo → your logic → Twilio SMS. No database, no UI.

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Fill in your Twilio credentials and phone numbers
```

### 3. Run locally
```bash
npm run dev        # with auto-restart (nodemon)
# or
npm start
```

### 4. Test your logic without real MoeGo traffic
```bash
# Missing vaccine — should trigger customer SMS
curl -X POST http://localhost:3000/test \
  -H "Content-Type: application/json" \
  -d '{"status":"confirmed","vaccine_status":null}'

# Cancellation — should trigger owner gap-alert
curl -X POST http://localhost:3000/test \
  -H "Content-Type: application/json" \
  -d '{"status":"canceled"}'
```

Set `SEND_TEST_SMS=true` in your `.env` to actually fire the Twilio messages during testing.

## Deploy to Railway (5 minutes)

1. Push this folder to a GitHub repo
2. Go to railway.app → New Project → Deploy from GitHub
3. Add your `.env` variables in Railway's Variables tab
4. Railway gives you a URL like `https://my-pet-tool.up.railway.app`

## Connect MoeGo

1. MoeGo Settings → Webhooks → Add webhook
2. URL: `https://your-railway-url.up.railway.app/webhook`
3. Events: select **Appointment Created**, **Appointment Updated**, **Appointment Canceled**
4. Copy the signing secret into `WEBHOOK_SECRET` in Railway

## Files

| File | Role |
|---|---|
| `webhook_receiver.js` | Express server — receives MoeGo events, routes them |
| `logic_engine.js` | Rules engine — decides what messages to send |
| `messenger.js` | Twilio wrapper — fires the SMS |

## Adding a new rule

Open `logic_engine.js` and add a block inside `checkAppointment()`:

```js
// Rule: first-time customer welcome
if (appt.notes?.includes("first visit")) {
  actions.push({
    type: "sms",
    to: appt.customer_phone,
    message: `Welcome to the salon, ${appt.customer_name}! 🐾 ...`,
  });
}
```

No other files need to change.
