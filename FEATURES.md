# Groomnice — Feature List

## Auth & Multi-Tenant

### Groomer Registration & Login
- Email + password registration with a custom URL slug (e.g. `groomnice.com/book/sarahs-paws`)
- Slug auto-generated from business name, editable before submitting
- Google Sign-In (one-click, no password needed) — button shown when `VITE_GOOGLE_CLIENT_ID` is set
- JWT tokens (30-day expiry), stored in `localStorage`
- All dashboard API calls require `Authorization: Bearer <token>` — 401 if missing or invalid
- Demo account: `demo@groomnice.com` / `demo1234`

### Multi-Tenant Data Isolation
- Every groomer sees only their own clients, bookings, settings, and waitlist
- Public booking page (`/book/{slug}`) routes to the correct groomer by slug
- Customer profile and vaccine pages are token-gated (no groomer login required)

---

## Groomer Dashboard (5-tab mobile app)

### Today Tab
- Daily appointment list sorted by time
- Per-card info: time, service type, pet name, breed, owner name
- Vaccine status badge per card: **Ready**, **No Vaccine**, **No Deposit**, **Grooming**, **Done**
- **Online booking badge**: cards from client self-booking are labeled "Online"
- **Start / Done** button to move appointment through grooming workflow
- **Text** button opens SMS to client with pre-filled reminder message
- **Mark Paid** button for unpaid/deposit-pending appointments
- **Pending Requests** section: online booking requests appear at top with **Confirm** and **Decline** buttons
- Revenue earned today shown in header (completed appointments only)
- Floating **+** button to create same-day appointments
- **List / Calendar view toggle**: switch between appointment list and a day-view time grid
  - Calendar view shows every working-hours slot as a row
  - Booked slots display pet name, service, status dot
  - Open slots display as green "Available" — tap any to open quick-book drawer with time pre-filled

### New Appointment Drawer (groomer-created)
- Quick-book form: phone, client name, pet name, service, time
- Looks up existing client by phone — creates new client if not found
- On success: shows two copy buttons — **Profile Link** (intake form) and **Vaccine Link** (upload cert)
- Groomer texts links manually from their own phone

### Clients Tab
- Full client list with last visit and vaccine status icon per client
- Search by client name or pet name (live filter)
- Tap any client to open edit drawer
- Edit drawer: update client name, phone, and all pet names/details
- Multi-pet support: one client can have multiple pets

### Reports Tab
- Revenue cards: **Today**, **This Week**, **This Month**
- This Month by Service breakdown (per service type)
- Searchable appointment history (last 60 days, filterable by name/pet)

### Vaccine Vault Tab
- Groomer uploads vaccine cert photo (or client uploads via their link)
- **Claude Haiku AI OCR** extracts expiry date from the image (Rabies, DHPP, Bordetella, or any "Exp" label)
- Groomer reviews AI result and confirms or corrects the expiry date
- Confirmed expiry updates the client's record and flips their badge to **Ready**
- Flags unclear images as "needs retake"

### Settings Tab
- Per-service pricing (Full Groom, Bath & Cut, Bath, Nail Trim, Puppy Cut, De-shed)
- Required deposit amount
- **Online Booking — Working Hours**: configure working days (Mon–Sun toggles), open/close times, and slot duration (30 or 60 min)
- Automation toggles (Twilio SMS — wired, activates when credentials are added):
  - Send 24-hour reminder text
  - Send "Fill My Gap" text on cancellation
- **Gap Fill Waitlist**: add/remove clients (name + phone) who get auto-texted when a slot opens due to cancellation

---

## Client-Facing (public URLs, no login required)

### Online Booking (`/book/{slug}`)
- Groomer's unique booking URL — each groomer has their own slug
- Step 1: Pick a service (Bath, Full Groom, etc.)
- Step 2: Pick an available date and time slot (based on groomer's working hours, excludes already-booked slots)
- Step 3: Enter name, phone number, pet name
- Creates a **pending_review** booking — groomer must confirm
- Client sees "Request Sent" screen with confirmation message
- SMS sent to client on submission (when Twilio configured)

### Pet Intake Form (`/profile/{token}`)
- Client fills in pet details: name, breed, age, weight, emergency contact, notes
- Multi-pet support: client can add additional pets
- Groomer sends this link after creating a new appointment

### Vaccine Upload (`/vaccine/{token}`)
- Client uploads a photo of their pet's vaccine certificate
- AI OCR processes it and extracts expiry date
- Result goes into the groomer's Vault for review
- Groomer sends this link after creating a new appointment

---

## Admin Dashboard (`/admin`)

- Key-gated with `ADMIN_KEY` env var (stored in `localStorage` after first entry)
- Dark-themed, separate from groomer dashboard
- **Overview cards**: total groomers, total clients, total bookings, total platform revenue
- **Groomer list**: each row shows name, email, `/book/slug`, Google-linked indicator, revenue, client count, booking count, join date, last booking date
- **Detail panel**: click any groomer → slide-in panel with their full client list + last 20 bookings with status badges and prices

---

## Backend & Infrastructure

- **FastAPI** + **SQLAlchemy** backend (SQLite local, Postgres on Railway)
- **JWT auth**: python-jose + passlib[bcrypt] (bcrypt pinned to 4.0.1 for compatibility)
- **Google OAuth**: ID token verified via Google's tokeninfo endpoint (no server-side SDK needed)
- **Twilio SMS stub**: wired at all booking creation points, no-op until `TWILIO_*` env vars set
- SMS triggers:
  - New groomer booking (profile + vaccine links)
  - Online booking received, booking confirmed
  - **Vaccine reminder**: on booking confirm, if vaccine missing or expired → targeted SMS with upload link
  - **Gap fill**: on cancellation, if toggle on → SMS all waitlist entries with open slot times + booking link
- `POST /api/seed?key=groomnice2026` — re-seeds demo data on prod
- Deployed on **Railway**: `groomnice-production.up.railway.app` (trial expired — needs upgrade)
- GitHub: `contactusai77-dot/groomnice`

### Railway env vars needed for production
```
DATABASE_URL        (auto-set by Railway Postgres add-on)
ANTHROPIC_API_KEY
JWT_SECRET          (strong random string)
ADMIN_KEY           (strong random string)
SEED_KEY            groomnice2026
TWILIO_ACCOUNT_SID  (when SMS is activated)
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER
```

---

## Known Gaps (planned)

- Twilio SMS not active (credentials not yet added to Railway)
- Railway trial expired — needs plan upgrade before next deploy
- Google OAuth requires `VITE_GOOGLE_CLIENT_ID` set in both frontend `.env` and Railway — not yet configured
- No client-side cancellation flow
- No groomer push/SMS notification when a new online booking request arrives
