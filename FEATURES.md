# Groomnice — Feature List

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

### New Appointment Drawer (groomer-created)
- Quick-book form: phone, client name, pet name, service, time
- Looks up existing client by phone — creates new client if not found
- On success: shows two copy buttons — **Profile Link** (intake form) and **Vaccine Link** (upload cert)
- Groomer texts links manually from their own phone

### Clients Tab
- Full client list with last visit and vaccine status icon per client
- Search by client name or pet name (live filter)
- Empty state when no search results
- Tap any client to open edit drawer
- Edit drawer: update client name, phone, and all pet names/details
- Multi-pet support: one client can have multiple pets

### Reports Tab
- Revenue cards: **Today**, **This Week**, **This Month**
- This Month by Service breakdown (per service type)
- Searchable appointment history (last 60 days, filterable by name/pet)

### Vaccine Vault Tab
- Groomer uploads vaccine cert photo (or client uploads via their link)
- **Claude Haiku AI OCR** extracts Rabies expiry date from the image
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

---

## Client-Facing (public URLs, no login required)

### Online Booking (`/book`)
- Step 1: Pick a service (Bath, Full Groom, etc.)
- Step 2: Pick an available date and time slot (based on groomer's working hours, excludes already-booked slots)
- Step 3: Enter name, phone number, pet name
- Creates a **pending** booking — groomer must confirm
- Client sees "Request Sent" screen with confirmation message
- SMS sent to client on submission (when Twilio configured)

### Pet Intake Form (`/profile/{token}`)
- Client fills in pet details: name, breed, age, weight, emergency contact, notes
- Multi-pet support: client can add additional pets
- Groomer sends this link after creating a new appointment

### Vaccine Upload (`/vaccine/{token}`)
- Client uploads a photo of their pet's vaccine certificate
- AI OCR processes it and extracts Rabies expiry
- Result goes into the groomer's Vault for review
- Groomer sends this link after creating a new appointment

---

## Backend & Infrastructure

- **FastAPI** + **SQLAlchemy** backend (SQLite local, Postgres on Railway)
- **Twilio SMS stub**: wired at all booking creation points, no-op until `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` env vars are set
- SMS triggers: new groomer booking (profile + vaccine links), online booking received, booking confirmed
- `POST /api/seed?key=groomnice2026` — re-seeds demo data on prod
- Deployed on **Railway**: `groomnice-production.up.railway.app`
- GitHub: `contactusai77-dot/groomnice`

---

## Known Gaps (planned)

- Vaccine upload page (`/vaccine/{token}`) does not pre-validate the token — shows upload UI for any URL, 404 only surfaces on submit
- Twilio SMS not active (credentials not yet added)
- No client-side cancellation flow
- No groomer notification (push/SMS) when a new online booking request arrives
