"""Run: py -3.11 seed.py  (from the backend/ directory)"""
from datetime import date, datetime, time as dt_time, timedelta
import uuid
from database import SessionLocal, engine, Base
from models import Booking, Client, GroomerSettings, PetProfile, VaccineSubmission

Base.metadata.drop_all(bind=engine)   # drop old schema (handles missing columns)
Base.metadata.create_all(bind=engine)  # recreate fresh
db = SessionLocal()

def _uuid():
    return uuid.uuid4().hex

today = date.today()

def appt(h, m):
    return datetime.combine(today, dt_time(h, m))

# ── Clients + pets ────────────────────────────────────────────────────────────
clients = [
    # (name, phone, pet_name, breed, vaccine_expiry, profile_complete)
    ("Jane Smith",    "+15551110001", "Biscuit",  "Golden Retriever", "2026-11-15", True),
    ("Marco Rivera",  "+15551110002", "Luna",     "Poodle",           "2025-03-01", True),   # expired
    ("Ashley Chen",   "+15551110003", "Mochi",    "Shih Tzu",         None,         False),  # missing
    ("Tom Bradley",   "+15551110004", "Rex",      "German Shepherd",  "2027-01-20", True),
    ("Priya Nair",    "+15551110005", "Coco",     "Bichon Frisé",     "2026-08-30", True),
    ("Derek Walsh",   "+15551110006", "Baxter",   "Labradoodle",      None,         True),   # missing
]

client_rows = []
for name, phone, pet_name, breed, vaccine_expiry, profile_complete in clients:
    c = Client(id=_uuid(), phone=phone, name=name, intake_token=_uuid())
    db.add(c)
    db.flush()

    pet = PetProfile(
        id=_uuid(),
        client_id=c.id,
        pet_name=pet_name,
        breed=breed,
        age="3 years",
        weight="25 lbs",
        emergency_contact="+15559990000",
        rabies_expiry=vaccine_expiry,
        profile_complete=profile_complete,
        completed_at=datetime.utcnow() if profile_complete else None,
    )
    db.add(pet)
    client_rows.append(c)

db.flush()

# ── Today's bookings ──────────────────────────────────────────────────────────
bookings_data = [
    # (client_index, hour, minute, service, status)
    (0, 9,  0,  "Full Groom",  "confirmed"),      # Jane / Biscuit   — ready ✅
    (1, 10, 0,  "Bath & Cut",  "confirmed"),      # Marco / Luna     — vaccine expired 🔴
    (2, 10, 30, "Nail Trim",   "pending_payment"),# Ashley / Mochi   — no vaccine + no deposit 🔴
    (3, 11, 30, "Full Groom",  "confirmed"),      # Tom / Rex        — ready ✅
    (4, 13, 0,  "Bath",        "in_progress"),    # Priya / Coco     — grooming now 🔵
    (5, 14, 30, "Bath & Cut",  "pending_payment"),# Derek / Baxter   — no vaccine 🔴
]

for idx, h, m, service, status in bookings_data:
    b = Booking(
        id=_uuid(),
        client_id=client_rows[idx].id,
        appointment_date=appt(h, m),
        service_type=service,
        status=status,
        deposit_amount=25.0,
    )
    db.add(b)

# ── Past bookings (shows up in Clients "last visit") ──────────────────────────
past = datetime.utcnow() - timedelta(days=14)
for i, c in enumerate(client_rows[:3]):
    b = Booking(
        id=_uuid(),
        client_id=c.id,
        appointment_date=past,
        service_type="Full Groom",
        status="completed",
        deposit_amount=25.0,
    )
    db.add(b)

# ── Groomer settings ──────────────────────────────────────────────────────────
db.add(GroomerSettings(
    id=1,
    require_deposit=True,
    send_24h_reminder=True,
    send_gap_fill_text=True,
    deposit_amount=25.0,
))

db.commit()
db.close()

print("Seeded:")
print(f"  {len(clients)} clients")
print(f"  {len(bookings_data)} appointments for today ({today})")
print(f"  3 past bookings")
print(f"  Groomer settings")
print()
print("Appointment breakdown:")
labels = [
    "09:00  Jane   / Biscuit  - Full Groom   [confirmed]     <- Ready",
    "10:00  Marco  / Luna     - Bath & Cut   [confirmed]     <- Vaccine EXPIRED",
    "10:30  Ashley / Mochi    - Nail Trim    [pending_pay]   <- No vaccine + no deposit",
    "11:30  Tom    / Rex      - Full Groom   [confirmed]     <- Ready",
    "13:00  Priya  / Coco     - Bath         [in_progress]   <- Grooming now",
    "14:30  Derek  / Baxter   - Bath & Cut   [pending_pay]   <- No vaccine",
]
for label in labels:
    print(f"  {label}")
