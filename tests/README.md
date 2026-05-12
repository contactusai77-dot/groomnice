# Tests

Two suites: **backend** (pytest, isolated SQLite) and **E2E** (Playwright, live local stack).

---

## Prerequisites

- Backend running on `http://localhost:8002`
- Frontend running on `http://localhost:4001` (or 4000 if 4001 is free)
- Python 3.11+
- Node.js 18+

Start both before running E2E tests:

```bat
# Terminal 1
cd backend && dev.bat

# Terminal 2
cd frontend && npm run dev
```

---

## Backend tests (`tests/backend/`)

```bash
cd tests/backend
pip install -r requirements.txt
pytest -v
```

Runs against an isolated `test_groomer.db` (set via env var in `conftest.py`). Production DB is never touched.

| File | Coverage |
|---|---|
| `test_bookings.py` | Health, today appointments (count, fields, sorting, prices, ready flags), quick booking, status update, history |
| `test_clients.py` | Client list, vaccine_ok logic, edit client name/phone, edit pet, 404 cases |
| `test_revenue.py` | Revenue structure, period hierarchy, by-service sum, revenue increase after completing |
| `test_settings.py` | All fields present, service prices match defaults, price update, working_hours field |
| `test_customer.py` | Profile get/save, add pet, update pet, wrong token 404s, vaccine vault, online booking slots + submission |

---

## E2E tests (`tests/e2e/`)

```bash
cd tests/e2e
npm install
npx playwright install chromium
npx playwright test
```

The `globalSetup` seeds fresh demo data before every run. Spec files run sequentially (`workers: 1`) to prevent state pollution. Mutation tests re-seed via `afterAll`.

### Useful commands

```bash
npx playwright test --headed                        # watch the browser
npx playwright test --ui                            # interactive UI mode
npx playwright test specs/client-workflow.spec.ts  # single spec
npx playwright test --project=chromium             # chromium only (faster)
npx playwright test -g "confirm a pending"         # filter by test name
```

### Spec files

| File | Tests | Coverage |
|---|---|---|
| `client-workflow.spec.ts` | 16 | `/book` multi-step flow (service, slot, form, submission), confirm/decline on Today tab, `/profile` and `/vaccine` customer pages |
| `groomer-workflow.spec.ts` | 16 | Today tab ordering, Start/Done, booking drawer (both copy links), Settings working hours config |
| `groomer-dashboard.spec.ts` | 10 | Dashboard loads, 7 cards, badges, pet/client names, + button, booking drawer, Start button, nav tabs |
| `clients.spec.ts` | 10 | Client list, search by name/pet, empty state, tap-to-edit, save changes, close |
| `reports.spec.ts` | 9 | Revenue cards, dollar amounts, by-service breakdown, history list, search, empty state |
| `customer-intake.spec.ts` | 8 | Pet profile loads, shows pet/client, edit form, add pet, vaccine page, file upload input |

**Total: 72 tests · 69 pass · 3 expected-to-fail (known gaps)**

### Known gaps (`test.fail()`)

These tests are intentionally marked to fail — they document real app bugs, not test bugs:

| Test | Gap | Fix needed |
|---|---|---|
| `client-workflow` — "decline booking disappears" | Declined bookings still appear on Today tab | Add `status != 'declined'` filter to `GET /api/appointments/today` |
| `client-workflow` — "invalid token on vaccine page shows error" | `/vaccine/{token}` shows upload UI for any token | Add `useEffect` in `VaccineUpload.tsx` to validate token on load |
| `customer-intake` — "invalid token on vaccine page shows error" | Same as above | Same fix |

### Test dashboard

After each run, generate a visual HTML dashboard:

```bash
npx playwright test --project=chromium   # runs tests + writes test-results.json
node generate-dashboard.mjs              # generates dashboard.html
```

Open `tests/e2e/dashboard.html` in a browser to see pass/fail by workflow and suite.

---

## Running everything

```bash
# Terminal 1 — backend
cd backend && dev.bat

# Terminal 2 — frontend
cd frontend && npm run dev

# Terminal 3 — backend tests
cd tests/backend && pytest -v

# Terminal 4 — E2E tests
cd tests/e2e && npx playwright test
```
