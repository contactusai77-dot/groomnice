# Tests

Two test suites: backend (pytest) and frontend E2E (Playwright).

## Prerequisites

- Backend running on `http://localhost:8002`
- Frontend running on `http://localhost:4000`
- Python 3.11+ with pip
- Node.js 18+ with npm

---

## Backend tests (`tests/backend/`)

```bash
cd tests/backend
pip install -r requirements.txt
pytest -v
```

Tests run against an isolated `test_groomer.db` SQLite file (set via env var in `conftest.py`). The production DB is never touched.

### What's covered

| File | Coverage |
|---|---|
| `test_bookings.py` | Health, today appointments (count, fields, sorting, prices, ready flags), quick booking, status update, history (search, days filter) |
| `test_clients.py` | Client list, vaccine_ok logic, edit client name/phone, edit pet, 404 cases |
| `test_revenue.py` | Revenue structure, period hierarchy, by-service sum, revenue increase after completing |
| `test_settings.py` | All fields present, service prices match defaults, price update → new booking uses it, toggles |
| `test_customer.py` | Profile get/save, add pet, update pet, wrong token 404s, vaccine vault structure |

---

## E2E tests (`tests/e2e/`)

```bash
cd tests/e2e
npm install
npx playwright install chromium
npx playwright test
```

Tests run against the live local stack (frontend + backend). The `globalSetup` seeds fresh demo data before every run.

### Headed mode (watch the browser)

```bash
npx playwright test --headed
```

### Interactive UI mode

```bash
npx playwright test --ui
```

### Run a single spec

```bash
npx playwright test specs/clients.spec.ts
```

### What's covered

| File | Coverage |
|---|---|
| `groomer-dashboard.spec.ts` | Dashboard loads, 7 cards, badges, pet/client names, + button, booking drawer, Start button, 5 nav tabs |
| `clients.spec.ts` | Client list, search by name/pet, empty state, tap-to-edit, drawer fields, save changes, close |
| `reports.spec.ts` | Revenue cards, dollar amounts, by-service breakdown, history list, search, empty state |
| `customer-intake.spec.ts` | Pet profile loads, shows pet/client, update pet name, add pet, vaccine page, file upload area |

---

## Running everything

Start the backend and frontend first, then:

```bash
# Terminal 1 — backend
cd C:\smb\backend
uvicorn main:app --port 8002

# Terminal 2 — frontend
cd C:\smb\frontend
npm run dev

# Terminal 3 — tests
cd C:\smb\tests\backend && pytest -v
cd C:\smb\tests\e2e && npx playwright test
```
