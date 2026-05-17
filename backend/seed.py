"""Run: py -3.11 seed.py  (from the backend/ directory)"""
from datetime import date, datetime, time as dt_time, timedelta
import uuid
from database import SessionLocal, engine, Base
from models import Booking, Client, Groomer, GroomerSettings, PetProfile, VaccineSubmission
from auth import hash_password

SERVICE_PRICES = {
    "Full Groom": 75.0,
    "Bath & Cut": 60.0,
    "Bath": 45.0,
    "Nail Trim": 20.0,
    "Puppy Cut": 65.0,
    "De-shed": 70.0,
}

DEFAULT_WORKING_HOURS = {
    "days": [0, 1, 2, 3, 4],
    "start": "09:00",
    "end": "17:00",
    "slot_minutes": 60,
}

Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)
db = SessionLocal()

def _uuid():
    return uuid.uuid4().hex

today = date.today()

def appt(h, m):
    return datetime.combine(today, dt_time(h, m))

# ── Demo groomer ──────────────────────────────────────────────────────────────
groomer = Groomer(
    id=_uuid(),
    email="demo@groomnice.com",
    password_hash=hash_password("demo1234"),
    name="Demo Groomer",
    slug="demo",
)
db.add(groomer)
db.flush()

# ── Groomer settings ──────────────────────────────────────────────────────────
db.add(GroomerSettings(
    groomer_id=groomer.id,
    require_deposit=True,
    send_24h_reminder=True,
    send_gap_fill_text=True,
    deposit_amount=25.0,
    service_prices=SERVICE_PRICES,
    working_hours=DEFAULT_WORKING_HOURS,
))

# ── Clients + pets ────────────────────────────────────────────────────────────
clients_data = [
    # (name, phone, pet_name, breed, vaccine_expiry, profile_complete)
    ("Jane Smith",    "+15551110001", "Biscuit",  "Golden Retriever", "2026-11-15", True),
    ("Marco Rivera",  "+15551110002", "Luna",     "Poodle",           "2025-03-01", True),   # expired
    ("Ashley Chen",   "+15551110003", "Mochi",    "Shih Tzu",         None,         False),  # missing
    ("Tom Bradley",   "+15551110004", "Rex",      "German Shepherd",  "2027-01-20", True),
    ("Priya Nair",    "+15551110005", "Coco",     "Bichon Frise",     "2026-08-30", True),
    ("Derek Walsh",   "+15551110006", "Baxter",   "Labradoodle",      None,         True),   # missing
]

client_rows = []
pet_rows = []
for name, phone, pet_name, breed, vaccine_expiry, profile_complete in clients_data:
    c = Client(id=_uuid(), groomer_id=groomer.id, phone=phone, name=name, intake_token=_uuid())
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
    db.flush()
    client_rows.append(c)
    pet_rows.append(pet)

# ── Jane Smith's second pet ───────────────────────────────────────────────────
jane = client_rows[0]
jane_pet2 = PetProfile(
    id=_uuid(),
    client_id=jane.id,
    pet_name="Pepper",
    breed="Corgi",
    age="2 years",
    weight="28 lbs",
    emergency_contact="+15559990000",
    rabies_expiry="2027-05-10",
    profile_complete=True,
    completed_at=datetime.utcnow(),
)
db.add(jane_pet2)
db.flush()

# ── Today's bookings ──────────────────────────────────────────────────────────
bookings_data = [
    (0, 9,  0,  "Full Groom",  "confirmed"),
    (1, 10, 0,  "Bath & Cut",  "confirmed"),
    (2, 10, 30, "Nail Trim",   "pending_payment"),
    (3, 11, 30, "Full Groom",  "confirmed"),
    (4, 13, 0,  "Bath",        "in_progress"),
    (5, 14, 30, "Bath & Cut",  "pending_payment"),
]

for idx, h, m, service, status in bookings_data:
    b = Booking(
        id=_uuid(),
        groomer_id=groomer.id,
        client_id=client_rows[idx].id,
        pet_id=pet_rows[idx].id,
        appointment_date=appt(h, m),
        service_type=service,
        status=status,
        deposit_amount=25.0,
        price=SERVICE_PRICES.get(service),
    )
    db.add(b)

db.add(Booking(
    id=_uuid(), groomer_id=groomer.id, client_id=jane.id, pet_id=jane_pet2.id,
    appointment_date=appt(15, 30), service_type="Bath & Cut", status="confirmed",
    deposit_amount=25.0, price=60.0,
))

# ── Past bookings for history + revenue demo ──────────────────────────────────
past_bookings = [
    (3,  0, 10, "Full Groom",  "completed", 75.0),
    (3,  1, 11, "Bath & Cut",  "completed", 60.0),
    (3,  2, 14, "Nail Trim",   "completed", 20.0),
    (7,  3, 9,  "Full Groom",  "completed", 75.0),
    (7,  4, 13, "Bath",        "completed", 45.0),
    (14, 0, 10, "Bath & Cut",  "completed", 60.0),
    (14, 5, 11, "Full Groom",  "completed", 75.0),
    (21, 1, 9,  "Nail Trim",   "completed", 20.0),
    (21, 3, 14, "Full Groom",  "completed", 75.0),
    (28, 2, 10, "Bath & Cut",  "completed", 60.0),
]
for days_ago, idx, h, svc, status, price in past_bookings:
    past_dt = datetime.combine(today - timedelta(days=days_ago), dt_time(h, 0))
    db.add(Booking(
        id=_uuid(), groomer_id=groomer.id, client_id=client_rows[idx].id, pet_id=pet_rows[idx].id,
        appointment_date=past_dt, service_type=svc, status=status,
        deposit_amount=25.0, price=price,
    ))

db.commit()
db.close()

print("Seeded:")
print(f"  Demo groomer: demo@groomnice.com / demo1234  (slug: demo)")
print(f"  {len(clients_data)} clients (Jane Smith has 2 pets: Biscuit + Pepper)")
print(f"  {len(bookings_data) + 1} appointments for today ({today})")
print(f"  10 past bookings for history/revenue demo")
print(f"  Groomer settings")
print()
print("Appointment breakdown:")
labels = [
    "09:00  Jane   / Biscuit  - Full Groom   [confirmed]      <- Ready",
    "10:00  Marco  / Luna     - Bath & Cut   [confirmed]      <- Vaccine EXPIRED",
    "10:30  Ashley / Mochi    - Nail Trim    [pending_pay]    <- No vaccine + no deposit",
    "11:30  Tom    / Rex      - Full Groom   [confirmed]      <- Ready",
    "13:00  Priya  / Coco     - Bath         [in_progress]    <- Grooming now",
    "14:30  Derek  / Baxter   - Bath & Cut   [pending_pay]    <- No vaccine",
    "15:30  Jane   / Pepper   - Bath & Cut   [confirmed]      <- Ready (multi-pet demo)",
]
for label in labels:
    print(f"  {label}")
