# Groomnice

Mobile-first groomer dashboard — simpler and cheaper than MoeGo for solo and small-shop groomers.

**Live:** https://groomnice-production.up.railway.app  
**Stack:** FastAPI + SQLAlchemy + SQLite/Postgres · React + TypeScript + Vite + Tailwind CSS  
**AI:** Claude Haiku OCR for vaccine cert parsing

---

## Features

See [FEATURES.md](FEATURES.md) for the full list. Key highlights:

- **Today tab** — appointment cards, Start/Done workflow, Ready/No Vaccine badges, pending online booking requests with Confirm/Decline
- **Online booking** (`/book`) — client-facing multi-step flow: service → date/slot → info → pending confirmation
- **Booking drawer** — groomer creates same-day appointments; confirmation screen shows both Profile Link and Vaccine Link to text the client
- **Clients tab** — searchable list, tap-to-edit drawer, multi-pet support
- **Reports** — revenue cards (today/week/month), by-service breakdown, searchable history
- **Vaccine Vault** — AI OCR reads Rabies expiry from cert photos; groomer reviews and confirms
- **Settings** — per-service pricing, working hours (days/open/close/slot duration), automation toggles
- **Customer pages** — `/profile/{token}` intake form, `/vaccine/{token}` upload page

---

## Local Development

Both servers must run in separate terminals. **Use Command Prompt, not PowerShell** (uvicorn `--reload` is unreliable on Windows PowerShell).

### Backend (port 8002)

```bat
cd backend
dev.bat
```

`dev.bat` seeds the database with demo data then starts the server. To seed manually:

```bat
py -3.11 seed.py
py -3.11 -m uvicorn main:app --port 8002
```

### Frontend (port 4000)

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:4000` — the groomer dashboard.  
Open `http://localhost:4000/book` — the client-facing booking page.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SEED_KEY` | No | Key for `POST /api/seed` (default: `dev`) |
| `BASE_URL` | No | Public base URL used in SMS links (default: `http://localhost:4001`) |
| `ANTHROPIC_API_KEY` | Yes | Claude Haiku for vaccine OCR |
| `TWILIO_ACCOUNT_SID` | No | Twilio SMS — stub fires when set |
| `TWILIO_AUTH_TOKEN` | No | Twilio SMS |
| `TWILIO_PHONE_NUMBER` | No | Twilio from-number |
| `DATABASE_URL` | No | Postgres URL for Railway prod (SQLite used if unset) |

Copy `.env.example` to `.env` and fill in values.

---

## Seeding Demo Data

```bash
# Local (key = "dev" by default)
curl -X POST http://localhost:8002/api/seed?key=dev

# Production
curl -X POST https://groomnice-production.up.railway.app/api/seed?key=groomnice2026
```

Creates 6 clients, 7 today appointments, 10 past bookings, and groomer settings.

---

## Deploy to Railway

1. Push to `contactusai77-dot/groomnice` on GitHub
2. Railway auto-deploys on push (Dockerfile in repo root)
3. Set env vars in Railway Variables tab
4. Seed prod data: `POST /api/seed?key=groomnice2026`

---

## Testing

See [tests/README.md](tests/README.md) for full instructions.

```bash
# Backend (pytest)
cd tests/backend && pytest -v

# E2E (Playwright — requires local servers running)
cd tests/e2e && npx playwright test
```

72 E2E tests across 6 spec files. Dashboard generated at `tests/e2e/dashboard.html` after each run.

---

## Project Structure

```
backend/          FastAPI app, models, seed data, services (vision, sms)
frontend/         React + Vite app
  src/
    api/          API client (client.ts)
    components/   AppointmentCard, BookingDrawer, BottomNav, StatusBadge
    pages/        DayView, Clients, ReportsPage, VaccineVault, SettingsPage,
                  BookingForm, PetProfile, VaccineUpload
tests/
  backend/        pytest suite (isolated SQLite)
  e2e/            Playwright suite (chromium + mobile)
    specs/        client-workflow, groomer-workflow, groomer-dashboard,
                  clients, reports, customer-intake
```
