import json
import math
import os
import re
import urllib.parse
import uuid
from datetime import date, datetime, time as dt_time, timedelta
from pathlib import Path
from typing import Optional

import httpx
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Header, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, field_validator
from sqlalchemy import func
from sqlalchemy.orm import Session

load_dotenv()

from database import Base, engine, get_db
from models import Booking, Client, Feedback, Groomer, GroomerSettings, PetProfile, VaccineSubmission, WaitlistEntry
from auth import create_access_token, get_current_groomer, hash_password, verify_password
from services.sms import (
    send_booking_confirmation,
    send_booking_request_received,
    send_gap_notification,
    send_intake_link,
    send_vaccine_link,
    send_vaccine_reminder,
)
from services.vision import extract_vaccine_info
from services.pricing import estimate_price
from services.importer import parse_csv, suggest_mapping, normalize_phone_safe, normalize_date

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Groomer API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

BASE_URL = os.getenv("BASE_URL", "http://localhost:4001")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
ADMIN_KEY = os.getenv("ADMIN_KEY", "admin-dev")

DEFAULT_WORKING_HOURS: dict = {
    "days": [0, 1, 2, 3, 4],
    "start": "09:00",
    "end": "17:00",
    "slot_minutes": 60,
}

DEFAULT_PRICES: dict = {
    "Full Groom": 75.0,
    "Bath & Cut": 60.0,
    "Bath": 45.0,
    "Nail Trim": 20.0,
    "Puppy Cut": 65.0,
    "De-shed": 70.0,
}

_UPLOADS = Path(__file__).parent / "uploads"
_UPLOADS.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(_UPLOADS)), name="uploads")


# ── Schemas ──────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str
    slug: str  # URL-safe business handle, e.g. "sarahs-paws"

class LoginRequest(BaseModel):
    email: str
    password: str

class GoogleAuthRequest(BaseModel):
    credential: str  # Google ID token

class BookingRequest(BaseModel):
    phone: str
    name: str

class QuickBookingRequest(BaseModel):
    phone: str
    client_name: str = ""
    pet_name: str = ""
    service_type: str = "Full Groom"
    appointment_time: str = ""  # "HH:MM"

class ProfileUpdate(BaseModel):
    pet_name: str
    breed: str = ""
    age: str = ""
    weight: str = ""
    emergency_contact: str = ""
    notes: str = ""

_VALID_STATUSES = {
    "pending_payment", "confirmed", "in_progress", "completed",
    "cancelled", "declined", "pending_review",
}

class StatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in _VALID_STATUSES:
            raise ValueError(f"Invalid status '{v}'. Must be one of: {sorted(_VALID_STATUSES)}")
        return v

class VaccineConfirmBody(BaseModel):
    expiry: str

class SettingsUpdate(BaseModel):
    require_deposit: Optional[bool] = None
    send_24h_reminder: Optional[bool] = None
    send_gap_fill_text: Optional[bool] = None
    deposit_amount: Optional[float] = None
    service_prices: Optional[dict] = None
    working_hours: Optional[dict] = None
    onboarding_complete: Optional[bool] = None
    is_mobile: Optional[bool] = None

class OnlineBookingRequest(BaseModel):
    phone: str
    name: str
    pet_name: str = ""
    service_type: str = "Full Groom"
    slot_date: str   # "YYYY-MM-DD"
    slot_time: str   # "HH:MM"

class WaitlistAdd(BaseModel):
    phone: str
    name: str

class ClientUpdate(BaseModel):
    name: str
    phone: str
    address: str = ""

class PetUpdate(BaseModel):
    pet_name: str = ""
    breed: str = ""
    age: str = ""
    weight: str = ""
    notes: str = ""
    temperament: str = "friendly"
    rabies_expiry: str = ""

class PriceEstimateRequest(BaseModel):
    breed: str = ""
    service_type: str = "Full Groom"
    temperament: str = "friendly"
    coat_condition: str = "normal"

class FeedbackCreate(BaseModel):
    email: str = ""
    type: str = "general"
    message: str

class ImportApplyRequest(BaseModel):
    rows: list[dict]
    mapping: dict[str, str]


# ── Helpers ───────────────────────────────────────────────────────────────────

from helpers import haversine as _haversine, normalize_phone, slug_from as _slug_from, vaccine_ok as _vaccine_ok

def _get_settings(db: Session, groomer_id: str) -> GroomerSettings:
    s = db.query(GroomerSettings).filter(GroomerSettings.groomer_id == groomer_id).first()
    if not s:
        s = GroomerSettings(groomer_id=groomer_id)
        db.add(s)
        db.commit()
        db.refresh(s)
    return s

def _find_open_slots_today(db: Session, settings: GroomerSettings, groomer_id: str) -> list:
    wh = settings.working_hours or DEFAULT_WORKING_HOURS
    today = datetime.utcnow().date()
    if today.weekday() not in wh.get("days", []):
        return []
    start_h, start_m = map(int, wh["start"].split(":"))
    end_h, end_m = map(int, wh["end"].split(":"))
    slot_mins = wh.get("slot_minutes", 60)
    slots, cur, end_t = [], start_h * 60 + start_m, end_h * 60 + end_m
    while cur < end_t:
        h, m = divmod(cur, 60)
        slots.append(f"{h:02d}:{m:02d}")
        cur += slot_mins
    today_start = datetime.combine(today, dt_time.min)
    tomorrow = today_start + timedelta(days=1)
    bookings = db.query(Booking).filter(
        Booking.groomer_id == groomer_id,
        Booking.appointment_date >= today_start,
        Booking.appointment_date < tomorrow,
        Booking.status.in_(["confirmed", "in_progress", "pending_review"]),
    ).all()
    booked = {f"{b.appointment_date.hour:02d}:{b.appointment_date.minute:02d}" for b in bookings if b.appointment_date}
    open_slots = [s for s in slots if s not in booked]
    return [f"{int(s[:2]) % 12 or 12}:{s[3:]} {'AM' if int(s[:2]) < 12 else 'PM'}" for s in open_slots]

def _get_prices(db: Session, groomer_id: str) -> dict:
    s = _get_settings(db, groomer_id)
    return s.service_prices or DEFAULT_PRICES

async def _geocode(address: str) -> Optional[tuple]:
    token = os.getenv("MAPBOX_TOKEN")
    if not token or not address.strip():
        return None
    encoded = urllib.parse.quote(address.strip())
    url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{encoded}.json?access_token={token}&limit=1&country=us"
    try:
        async with httpx.AsyncClient() as hc:
            r = await hc.get(url, timeout=5)
            features = r.json().get("features", [])
            if features:
                lng, lat = features[0]["geometry"]["coordinates"]
                return float(lat), float(lng)
    except Exception:
        pass
    return None

def _booking_dict(b, pet=None, c=None) -> dict:
    if c is None:
        c = b.client
    if pet is None:
        pet = b.pet or (c.pet_profiles[0] if c and c.pet_profiles else None)
    v_ok = _vaccine_ok(pet)
    deposit_ok = b.status in ("confirmed", "completed", "in_progress")
    return {
        "id": b.id,
        "appointment_date": b.appointment_date.isoformat() if b.appointment_date else None,
        "service_type": b.service_type or "Full Groom",
        "status": b.status,
        "price": b.price,
        "client_name": c.name if c else "Unknown",
        "client_phone": c.phone if c else "",
        "pet_name": pet.pet_name if pet else "Unknown",
        "breed": pet.breed if pet else None,
        "vaccine_ok": v_ok,
        "deposit_ok": deposit_ok,
        "ready": v_ok and deposit_ok,
        "profile_complete": pet.profile_complete if pet else False,
        "intake_token": c.intake_token if c else None,
        "pet_id": pet.id if pet else None,
        "temperament": pet.temperament if pet else "friendly",
        "source": b.source or "groomer",
    }

def _pet_dict(pet: PetProfile) -> dict:
    return {
        "id": pet.id,
        "pet_name": pet.pet_name,
        "breed": pet.breed,
        "age": pet.age,
        "weight": pet.weight,
        "emergency_contact": pet.emergency_contact,
        "notes": pet.notes,
        "rabies_expiry": pet.rabies_expiry,
        "profile_complete": pet.profile_complete,
        "temperament": pet.temperament or "friendly",
    }


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok"}


# ── Auth ──────────────────────────────────────────────────────────────────────

@app.post("/api/auth/register", status_code=201)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(Groomer).filter(Groomer.email == req.email.lower()).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    slug = req.slug.lower().strip() or _slug_from(req.name)
    if db.query(Groomer).filter(Groomer.slug == slug).first():
        raise HTTPException(status_code=409, detail="Slug already taken — try another")
    groomer = Groomer(
        email=req.email.lower(),
        password_hash=hash_password(req.password),
        name=req.name,
        slug=slug,
    )
    db.add(groomer)
    db.flush()
    db.add(GroomerSettings(groomer_id=groomer.id))
    db.commit()
    db.refresh(groomer)
    token = create_access_token(groomer.id)
    return {"token": token, "groomer": {"id": groomer.id, "name": groomer.name, "email": groomer.email, "slug": groomer.slug}}


@app.post("/api/auth/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    groomer = db.query(Groomer).filter(Groomer.email == req.email.lower()).first()
    if not groomer or not groomer.password_hash or not verify_password(req.password, groomer.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(groomer.id)
    return {"token": token, "groomer": {"id": groomer.id, "name": groomer.name, "email": groomer.email, "slug": groomer.slug}}


@app.post("/api/auth/google")
async def google_auth(req: GoogleAuthRequest, db: Session = Depends(get_db)):
    """Verify Google ID token and sign in or register the groomer."""
    async with httpx.AsyncClient() as client:
        r = await client.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={req.credential}")
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Google credential")
    info = r.json()
    if GOOGLE_CLIENT_ID and info.get("aud") != GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=401, detail="Token audience mismatch")
    google_id = info.get("sub")
    email = info.get("email", "").lower()
    name = info.get("name") or email.split("@")[0]

    groomer = db.query(Groomer).filter(
        (Groomer.google_id == google_id) | (Groomer.email == email)
    ).first()
    if groomer:
        if not groomer.google_id:
            groomer.google_id = google_id
            db.commit()
    else:
        slug = _slug_from(name)
        base_slug = slug
        i = 1
        while db.query(Groomer).filter(Groomer.slug == slug).first():
            slug = f"{base_slug}-{i}"
            i += 1
        groomer = Groomer(email=email, name=name, slug=slug, google_id=google_id)
        db.add(groomer)
        db.flush()
        db.add(GroomerSettings(groomer_id=groomer.id))
        db.commit()
        db.refresh(groomer)

    token = create_access_token(groomer.id)
    return {"token": token, "groomer": {"id": groomer.id, "name": groomer.name, "email": groomer.email, "slug": groomer.slug}}


@app.get("/api/auth/me")
def me(groomer: Groomer = Depends(get_current_groomer)):
    return {"id": groomer.id, "name": groomer.name, "email": groomer.email, "slug": groomer.slug}


# ── Seed ──────────────────────────────────────────────────────────────────────

@app.post("/api/seed")
def run_seed(key: str = Query(...)):
    if key != os.getenv("SEED_KEY", "dev"):
        raise HTTPException(status_code=403, detail="Forbidden")
    from database import Base, engine, SessionLocal
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        today = date.today()
        def appt(h, m): return datetime.combine(today, dt_time(h, m))

        g = Groomer(
            email="demo@groomnice.com",
            password_hash=hash_password("demo1234"),
            name="Demo Groomer",
            slug="demo",
        )
        db.add(g)
        db.flush()
        db.add(GroomerSettings(
            groomer_id=g.id, require_deposit=True, send_24h_reminder=True,
            send_gap_fill_text=True, deposit_amount=25.0,
            service_prices=DEFAULT_PRICES, working_hours=DEFAULT_WORKING_HOURS,
        ))

        clients_data = [
            ("Jane Smith",   "+15551110001", "Biscuit", "Golden Retriever", "2026-11-15", True),
            ("Marco Rivera", "+15551110002", "Luna",    "Poodle",           "2025-03-01", True),
            ("Ashley Chen",  "+15551110003", "Mochi",   "Shih Tzu",         None,         False),
            ("Tom Bradley",  "+15551110004", "Rex",     "German Shepherd",  "2027-01-20", True),
            ("Priya Nair",   "+15551110005", "Coco",    "Bichon Frise",     "2026-08-30", True),
            ("Derek Walsh",  "+15551110006", "Baxter",  "Labradoodle",      None,         True),
        ]
        client_rows, pet_rows = [], []
        for name, phone, pet_name, breed, vaccine_expiry, complete in clients_data:
            c = Client(id=uuid.uuid4().hex, groomer_id=g.id, phone=phone, name=name, intake_token=uuid.uuid4().hex)
            db.add(c); db.flush()
            p = PetProfile(id=uuid.uuid4().hex, client_id=c.id, pet_name=pet_name, breed=breed,
                           age="3 years", weight="25 lbs", emergency_contact="+15559990000",
                           rabies_expiry=vaccine_expiry, profile_complete=complete,
                           completed_at=datetime.utcnow() if complete else None)
            db.add(p); db.flush()
            client_rows.append(c); pet_rows.append(p)

        jane = client_rows[0]
        pepper = PetProfile(id=uuid.uuid4().hex, client_id=jane.id, pet_name="Pepper", breed="Corgi",
                            age="2 years", weight="28 lbs", emergency_contact="+15559990000",
                            rabies_expiry="2027-05-10", profile_complete=True, completed_at=datetime.utcnow())
        db.add(pepper); db.flush()

        today_bookings = [
            (0, 9,  0,  "Full Groom",  "confirmed",       75.0),
            (1, 10, 0,  "Bath & Cut",  "confirmed",       60.0),
            (2, 10, 30, "Nail Trim",   "pending_payment", 20.0),
            (3, 11, 30, "Full Groom",  "confirmed",       75.0),
            (4, 13, 0,  "Bath",        "in_progress",     45.0),
            (5, 14, 30, "Bath & Cut",  "pending_payment", 60.0),
        ]
        for idx, h, m, svc, status, price in today_bookings:
            db.add(Booking(id=uuid.uuid4().hex, groomer_id=g.id,
                           client_id=client_rows[idx].id, pet_id=pet_rows[idx].id,
                           appointment_date=appt(h, m), service_type=svc, status=status,
                           deposit_amount=25.0, price=price))
        db.add(Booking(id=uuid.uuid4().hex, groomer_id=g.id, client_id=jane.id, pet_id=pepper.id,
                       appointment_date=appt(15, 30), service_type="Bath & Cut", status="confirmed",
                       deposit_amount=25.0, price=60.0))

        for days_ago, idx, h, svc, status, price in [
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
        ]:
            past = datetime.combine(today - timedelta(days=days_ago), dt_time(h, 0))
            db.add(Booking(id=uuid.uuid4().hex, groomer_id=g.id,
                           client_id=client_rows[idx].id, pet_id=pet_rows[idx].id,
                           appointment_date=past, service_type=svc, status=status,
                           deposit_amount=25.0, price=price))

        db.commit()
        return {"seeded": True, "date": today.isoformat(), "demo_email": "demo@groomnice.com", "demo_password": "demo1234"}
    finally:
        db.close()


# ── Groomer dashboard ─────────────────────────────────────────────────────────

@app.get("/api/appointments/today")
def get_today_appointments(
    db: Session = Depends(get_db),
    groomer: Groomer = Depends(get_current_groomer),
):
    today = date.today()
    bookings = (
        db.query(Booking)
        .filter(Booking.groomer_id == groomer.id, func.date(Booking.appointment_date) == today)
        .all()
    )
    result = [_booking_dict(b) for b in bookings]
    return sorted(result, key=lambda x: x["appointment_date"] or "")


@app.get("/api/appointments/history")
def get_history(
    q: str = Query(""),
    days: int = Query(60),
    db: Session = Depends(get_db),
    groomer: Groomer = Depends(get_current_groomer),
):
    since = datetime.combine(date.today() - timedelta(days=days), dt_time(0, 0))
    today_start = datetime.combine(date.today(), dt_time(0, 0))
    bookings = (
        db.query(Booking)
        .filter(
            Booking.groomer_id == groomer.id,
            Booking.appointment_date >= since,
            Booking.appointment_date < today_start,
        )
        .order_by(Booking.appointment_date.desc())
        .all()
    )
    result = []
    for b in bookings:
        d = _booking_dict(b)
        if q:
            ql = q.lower()
            if ql not in d["client_name"].lower() and ql not in (d["pet_name"] or "").lower():
                continue
        result.append(d)
    return result


@app.get("/api/revenue")
def get_revenue(
    db: Session = Depends(get_db),
    groomer: Groomer = Depends(get_current_groomer),
):
    prices = _get_prices(db, groomer.id)
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)

    def revenue_for(start: date):
        bookings = (
            db.query(Booking)
            .filter(
                Booking.groomer_id == groomer.id,
                Booking.status == "completed",
                func.date(Booking.appointment_date) >= start,
                func.date(Booking.appointment_date) <= today,
            )
            .all()
        )
        total = sum(b.price if b.price is not None else prices.get(b.service_type or "", 0) for b in bookings)
        return {"revenue": round(total, 2), "count": len(bookings)}

    month_bookings = (
        db.query(Booking)
        .filter(
            Booking.groomer_id == groomer.id,
            Booking.status == "completed",
            func.date(Booking.appointment_date) >= month_start,
        )
        .all()
    )
    by_service: dict = {}
    for b in month_bookings:
        svc = b.service_type or "Other"
        p = b.price if b.price is not None else prices.get(svc, 0)
        if svc not in by_service:
            by_service[svc] = {"revenue": 0.0, "count": 0}
        by_service[svc]["revenue"] = round(by_service[svc]["revenue"] + p, 2)
        by_service[svc]["count"] += 1

    return {
        "today": revenue_for(today),
        "week": revenue_for(week_start),
        "month": revenue_for(month_start),
        "by_service": by_service,
    }


@app.post("/api/bookings/quick")
async def quick_booking(
    req: QuickBookingRequest,
    db: Session = Depends(get_db),
    groomer: Groomer = Depends(get_current_groomer),
):
    phone = normalize_phone(req.phone)
    client = db.query(Client).filter(
        Client.groomer_id == groomer.id, Client.phone == phone
    ).first()
    if not client:
        client = Client(
            id=uuid.uuid4().hex,
            groomer_id=groomer.id,
            phone=phone,
            name=req.client_name or phone,
            intake_token=uuid.uuid4().hex,
        )
        db.add(client)
        db.flush()
        pet = PetProfile(id=uuid.uuid4().hex, client_id=client.id, pet_name=req.pet_name or None)
        db.add(pet)
    elif req.pet_name and client.pet_profiles:
        client.pet_profiles[0].pet_name = req.pet_name

    appt_dt = datetime.combine(date.today(), dt_time(9, 0))
    if req.appointment_time:
        try:
            # Accept ISO datetime ("2026-05-19T10:00:00") or time-only ("10:00")
            if "T" in req.appointment_time:
                appt_dt = datetime.fromisoformat(req.appointment_time)
            else:
                h, m = map(int, req.appointment_time.split(":"))
                appt_dt = datetime.combine(date.today(), dt_time(h, m))
        except ValueError:
            pass

    settings = _get_settings(db, groomer.id)
    prices = settings.service_prices or DEFAULT_PRICES
    booking = Booking(
        id=uuid.uuid4().hex,
        groomer_id=groomer.id,
        client_id=client.id,
        service_type=req.service_type,
        appointment_date=appt_dt,
        status="confirmed",
        price=prices.get(req.service_type),
    )
    db.add(booking)
    db.flush()
    db.commit()

    send_intake_link(client.phone, client.name, client.intake_token)
    send_vaccine_link(client.phone, client.name, client.intake_token)

    return {"booking_id": booking.id, "intake_token": client.intake_token}


@app.patch("/api/bookings/{booking_id}/status")
def update_status(
    booking_id: str,
    body: StatusUpdate,
    db: Session = Depends(get_db),
    groomer: Groomer = Depends(get_current_groomer),
):
    b = db.query(Booking).filter(Booking.id == booking_id, Booking.groomer_id == groomer.id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Not found")
    b.status = body.status
    db.commit()
    if body.status == "confirmed" and b.client:
        pet = b.pet or (b.client.pet_profiles[0] if b.client.pet_profiles else None)
        if not _vaccine_ok(pet):
            expired = bool(pet and pet.rabies_expiry)
            send_vaccine_reminder(b.client.phone, b.client.name, b.client.intake_token, expired=expired)
    if body.status == "cancelled":
        settings = _get_settings(db, groomer.id)
        if settings.send_gap_fill_text:
            open_slots = _find_open_slots_today(db, settings, groomer.id)
            if open_slots:
                for entry in db.query(WaitlistEntry).filter(WaitlistEntry.groomer_id == groomer.id).all():
                    send_gap_notification(entry.phone, entry.name, open_slots)
    return {"success": True}


# ── Online booking (public, routed by groomer slug) ───────────────────────────

@app.get("/api/book/{slug}/slots")
def get_booking_slots(slug: str, db: Session = Depends(get_db)):
    g = db.query(Groomer).filter(Groomer.slug == slug).first()
    if not g:
        raise HTTPException(status_code=404, detail="Groomer not found")
    s = _get_settings(db, g.id)
    wh = s.working_hours or DEFAULT_WORKING_HOURS
    work_days: list = wh.get("days", [0, 1, 2, 3, 4])
    sh, sm = map(int, wh.get("start", "09:00").split(":"))
    eh, em = map(int, wh.get("end", "17:00").split(":"))
    slot_min: int = wh.get("slot_minutes", 60)

    today = date.today()
    now = datetime.utcnow()
    result = []

    for delta in range(7):
        d = today + timedelta(days=delta)
        if d.weekday() not in work_days:
            continue
        booked = db.query(Booking).filter(
            Booking.groomer_id == g.id,
            func.date(Booking.appointment_date) == d,
            Booking.status.notin_(["declined", "cancelled"]),
        ).all()
        booked_times = {b.appointment_date.strftime("%H:%M") for b in booked if b.appointment_date}

        slots = []
        current = datetime.combine(d, dt_time(sh, sm))
        day_end = datetime.combine(d, dt_time(eh, em))
        while current + timedelta(minutes=slot_min) <= day_end:
            if d == today and current <= now + timedelta(hours=1):
                current += timedelta(minutes=slot_min)
                continue
            label = current.strftime("%H:%M")
            if label not in booked_times:
                slots.append(label)
            current += timedelta(minutes=slot_min)

        if slots:
            result.append({"date": d.isoformat(), "day_name": d.strftime("%A"), "slots": slots})

    return result


@app.post("/api/book/{slug}")
async def online_booking(slug: str, req: OnlineBookingRequest, db: Session = Depends(get_db)):
    g = db.query(Groomer).filter(Groomer.slug == slug).first()
    if not g:
        raise HTTPException(status_code=404, detail="Groomer not found")

    phone = normalize_phone(req.phone)
    client = db.query(Client).filter(Client.groomer_id == g.id, Client.phone == phone).first()
    if not client:
        client = Client(id=uuid.uuid4().hex, groomer_id=g.id, phone=phone, name=req.name, intake_token=uuid.uuid4().hex)
        db.add(client)
        db.flush()
        pet = PetProfile(id=uuid.uuid4().hex, client_id=client.id, pet_name=req.pet_name or None)
        db.add(pet)
        db.flush()
    else:
        client.name = req.name
        if req.pet_name and client.pet_profiles:
            client.pet_profiles[0].pet_name = req.pet_name

    try:
        d = date.fromisoformat(req.slot_date)
        h, m = map(int, req.slot_time.split(":"))
        appt_dt = datetime.combine(d, dt_time(h, m))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid slot_date or slot_time")

    # Validate the requested slot falls within the groomer's working hours
    settings = _get_settings(db, g.id)
    wh = settings.working_hours or DEFAULT_WORKING_HOURS
    if d.weekday() not in wh.get("days", [0, 1, 2, 3, 4]):
        raise HTTPException(status_code=400, detail="Groomer is not available on that day")
    sh, sm = map(int, wh.get("start", "09:00").split(":"))
    eh, em = map(int, wh.get("end", "17:00").split(":"))
    slot_start_min = h * 60 + m
    slot_dur_min = wh.get("slot_minutes", 60)
    if slot_start_min < sh * 60 + sm or slot_start_min + slot_dur_min > eh * 60 + em:
        raise HTTPException(status_code=400, detail="Slot is outside groomer's working hours")

    # Reject if this exact slot is already taken
    conflict = db.query(Booking).filter(
        Booking.groomer_id == g.id,
        Booking.appointment_date == appt_dt,
        Booking.status.notin_(["declined", "canceled", "cancelled"]),
    ).first()
    if conflict:
        raise HTTPException(status_code=409, detail="That slot is no longer available")

    settings = _get_settings(db, g.id)
    prices = settings.service_prices or DEFAULT_PRICES
    booking = Booking(
        id=uuid.uuid4().hex,
        groomer_id=g.id,
        client_id=client.id,
        service_type=req.service_type,
        appointment_date=appt_dt,
        status="pending_review",
        source="online",
        price=prices.get(req.service_type),
    )
    db.add(booking)
    db.commit()

    send_booking_request_received(client.phone, client.name)
    send_vaccine_link(client.phone, client.name, client.intake_token)

    return {"booking_id": booking.id, "intake_token": client.intake_token, "status": "pending_review"}


# ── Clients ───────────────────────────────────────────────────────────────────

@app.get("/api/clients")
def get_clients(
    db: Session = Depends(get_db),
    groomer: Groomer = Depends(get_current_groomer),
):
    clients = db.query(Client).filter(Client.groomer_id == groomer.id).order_by(Client.created_at.desc()).all()
    result = []
    for c in clients:
        last = (
            db.query(Booking)
            .filter(Booking.client_id == c.id)
            .order_by(Booking.created_at.desc())
            .first()
        )
        result.append({
            "id": c.id,
            "name": c.name,
            "phone": c.phone,
            "intake_token": c.intake_token,
            "pets": [_pet_dict(p) for p in c.pet_profiles],
            "vaccine_ok": any(_vaccine_ok(p) for p in c.pet_profiles),
            "last_visit": last.created_at.isoformat() if last else None,
        })
    return result


@app.patch("/api/clients/{client_id}")
async def update_client(
    client_id: str,
    body: ClientUpdate,
    db: Session = Depends(get_db),
    groomer: Groomer = Depends(get_current_groomer),
):
    c = db.query(Client).filter(Client.id == client_id, Client.groomer_id == groomer.id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Not found")
    c.name = body.name
    c.phone = normalize_phone(body.phone)
    if body.address is not None:
        address = body.address.strip()
        c.address = address or None
        if address and address != (c.address or ""):
            geo = await _geocode(address)
            if geo:
                c.lat, c.lng = geo
    db.commit()
    return {"success": True}


@app.patch("/api/pets/{pet_id}")
def update_pet_groomer(
    pet_id: str,
    data: PetUpdate,
    db: Session = Depends(get_db),
    groomer: Groomer = Depends(get_current_groomer),
):
    pet = (
        db.query(PetProfile)
        .join(Client)
        .filter(PetProfile.id == pet_id, Client.groomer_id == groomer.id)
        .first()
    )
    if not pet:
        raise HTTPException(status_code=404, detail="Not found")
    for field in ("pet_name", "breed", "age", "weight", "notes", "temperament"):
        setattr(pet, field, getattr(data, field))
    pet.rabies_expiry = data.rabies_expiry.strip() or None
    db.commit()
    return {"success": True}


# ── Pet profile (customer-facing, token-gated) ────────────────────────────────

@app.get("/api/profile/{token}")
def get_profile(token: str, db: Session = Depends(get_db)):
    c = db.query(Client).filter(Client.intake_token == token).first()
    if not c:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"client_name": c.name, "pets": [_pet_dict(p) for p in c.pet_profiles]}


@app.put("/api/profile/{token}")
def update_profile(token: str, data: ProfileUpdate, db: Session = Depends(get_db)):
    c = db.query(Client).filter(Client.intake_token == token).first()
    if not c:
        raise HTTPException(status_code=404, detail="Profile not found")
    pet = c.pet_profiles[0] if c.pet_profiles else None
    if not pet:
        pet = PetProfile(id=uuid.uuid4().hex, client_id=c.id)
        db.add(pet)
    for field in ("pet_name", "breed", "age", "weight", "emergency_contact", "notes"):
        setattr(pet, field, getattr(data, field))
    pet.profile_complete = True
    pet.completed_at = datetime.utcnow()
    db.commit()
    return {"success": True}


@app.post("/api/profile/{token}/pets")
def add_pet(token: str, data: ProfileUpdate, db: Session = Depends(get_db)):
    c = db.query(Client).filter(Client.intake_token == token).first()
    if not c:
        raise HTTPException(status_code=404, detail="Profile not found")
    pet = PetProfile(id=uuid.uuid4().hex, client_id=c.id)
    for field in ("pet_name", "breed", "age", "weight", "emergency_contact", "notes"):
        setattr(pet, field, getattr(data, field))
    pet.profile_complete = True
    pet.completed_at = datetime.utcnow()
    db.add(pet)
    db.commit()
    db.refresh(pet)
    return {"success": True, "pet_id": pet.id}


@app.put("/api/profile/{token}/pets/{pet_id}")
def update_pet(token: str, pet_id: str, data: ProfileUpdate, db: Session = Depends(get_db)):
    c = db.query(Client).filter(Client.intake_token == token).first()
    if not c:
        raise HTTPException(status_code=404, detail="Profile not found")
    pet = db.query(PetProfile).filter(PetProfile.id == pet_id, PetProfile.client_id == c.id).first()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    for field in ("pet_name", "breed", "age", "weight", "emergency_contact", "notes"):
        setattr(pet, field, getattr(data, field))
    pet.profile_complete = True
    pet.completed_at = datetime.utcnow()
    db.commit()
    return {"success": True}


# ── Vaccine upload (customer-facing) ──────────────────────────────────────────

@app.post("/api/vaccine/{token}")
async def upload_vaccine(
    token: str,
    file: UploadFile = File(...),
    pet_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    c = db.query(Client).filter(Client.intake_token == token).first()
    if not c:
        raise HTTPException(status_code=404, detail="Profile not found")

    pet = None
    if pet_id:
        pet = db.query(PetProfile).filter(PetProfile.id == pet_id, PetProfile.client_id == c.id).first()
    if not pet and c.pet_profiles:
        pet = c.pet_profiles[0]

    image_bytes = await file.read()
    media_type = file.content_type or "image/jpeg"
    ext = (file.filename or "cert.jpg").rsplit(".", 1)[-1]
    filename = f"{uuid.uuid4().hex}.{ext}"
    (_UPLOADS / filename).write_bytes(image_bytes)

    try:
        result = extract_vaccine_info(image_bytes, media_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Vision processing failed: {e}")

    submission = VaccineSubmission(
        id=uuid.uuid4().hex,
        client_id=c.id,
        pet_id=pet.id if pet else None,
        image_filename=filename,
        ai_expiry=result.get("rabies_expiry"),
        status="needs_retake" if result.get("needs_review") else "pending",
    )
    db.add(submission)

    if not result.get("needs_review") and pet and result.get("rabies_expiry"):
        pet.rabies_expiry = result["rabies_expiry"]

    db.commit()

    if result.get("needs_review"):
        return {"rabies_expiry": None, "needs_review": True, "message": "Image unclear — please retake"}
    return {"rabies_expiry": result.get("rabies_expiry"), "needs_review": False, "message": "Certificate saved"}


# ── Vaccine vault (groomer-facing) ────────────────────────────────────────────

@app.get("/api/vaccine-vault")
def get_vault(
    db: Session = Depends(get_db),
    groomer: Groomer = Depends(get_current_groomer),
):
    submissions = (
        db.query(VaccineSubmission)
        .join(Client)
        .filter(Client.groomer_id == groomer.id,
                VaccineSubmission.status.in_(["pending", "needs_retake"]))
        .order_by(VaccineSubmission.created_at.desc())
        .all()
    )
    result = []
    for s in submissions:
        c = s.client
        pet = s.pet or (c.pet_profiles[0] if c and c.pet_profiles else None)
        result.append({
            "id": s.id,
            "client_name": c.name if c else "Unknown",
            "pet_name": pet.pet_name if pet else "Unknown",
            "image_url": f"/uploads/{s.image_filename}" if s.image_filename else None,
            "ai_expiry": s.ai_expiry,
            "status": s.status,
            "created_at": s.created_at.isoformat(),
        })
    return result


@app.patch("/api/vaccine-vault/{submission_id}/confirm")
def confirm_vaccine(
    submission_id: str,
    body: VaccineConfirmBody,
    db: Session = Depends(get_db),
    groomer: Groomer = Depends(get_current_groomer),
):
    s = (
        db.query(VaccineSubmission)
        .join(Client)
        .filter(VaccineSubmission.id == submission_id, Client.groomer_id == groomer.id)
        .first()
    )
    if not s:
        raise HTTPException(status_code=404, detail="Not found")
    s.confirmed_expiry = body.expiry
    s.status = "confirmed"
    target_pet = s.pet or (s.client.pet_profiles[0] if s.client and s.client.pet_profiles else None)
    if target_pet:
        target_pet.rabies_expiry = body.expiry
    db.commit()
    return {"success": True}


# ── Settings ──────────────────────────────────────────────────────────────────

@app.get("/api/settings")
def get_settings(
    db: Session = Depends(get_db),
    groomer: Groomer = Depends(get_current_groomer),
):
    s = _get_settings(db, groomer.id)
    return {
        "require_deposit": s.require_deposit,
        "send_24h_reminder": s.send_24h_reminder,
        "send_gap_fill_text": s.send_gap_fill_text,
        "deposit_amount": s.deposit_amount,
        "service_prices": s.service_prices or DEFAULT_PRICES,
        "working_hours": s.working_hours or DEFAULT_WORKING_HOURS,
        "onboarding_complete": bool(s.onboarding_complete),
        "is_mobile": bool(s.is_mobile),
    }


@app.patch("/api/settings")
def update_settings(
    body: SettingsUpdate,
    db: Session = Depends(get_db),
    groomer: Groomer = Depends(get_current_groomer),
):
    s = _get_settings(db, groomer.id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(s, field, value)
    db.commit()
    return {"success": True}


# ── Dynamic pricing ───────────────────────────────────────────────────────────

@app.post("/api/price-estimate")
def price_estimate(
    body: PriceEstimateRequest,
    db: Session = Depends(get_db),
    groomer: Groomer = Depends(get_current_groomer),
):
    result = estimate_price(body.breed, body.service_type, body.temperament, body.coat_condition)
    return result


# ── Smart route (mobile groomers) ─────────────────────────────────────────────

@app.get("/api/route/today")
async def get_route_today(
    db: Session = Depends(get_db),
    groomer: Groomer = Depends(get_current_groomer),
):
    today = datetime.utcnow().date()
    today_start = datetime.combine(today, dt_time.min)
    tomorrow = today_start + timedelta(days=1)
    bookings = db.query(Booking).filter(
        Booking.groomer_id == groomer.id,
        Booking.appointment_date >= today_start,
        Booking.appointment_date < tomorrow,
        Booking.status.notin_(["cancelled", "declined"]),
    ).all()

    stops = []
    for b in bookings:
        c = b.client
        pet = b.pet or (c.pet_profiles[0] if c and c.pet_profiles else None)
        stops.append({
            "booking_id": b.id,
            "client_name": c.name if c else "Unknown",
            "client_phone": c.phone if c else "",
            "pet_name": pet.pet_name if pet else "Unknown",
            "service_type": b.service_type or "Full Groom",
            "appointment_date": b.appointment_date.isoformat() if b.appointment_date else None,
            "status": b.status,
            "address": c.address if c else None,
            "lat": c.lat if c else None,
            "lng": c.lng if c else None,
            "drive_minutes": None,
            "drive_miles": None,
        })

    stops.sort(key=lambda s: s["appointment_date"] or "")
    geo_stops = [s for s in stops if s["lat"] and s["lng"]]

    if len(geo_stops) >= 2:
        # Nearest-neighbor route sort
        ordered, remaining = [stops[0]], stops[1:]
        while remaining:
            last = ordered[-1]
            if last["lat"] and last["lng"]:
                remaining.sort(
                    key=lambda s: _haversine(last["lat"], last["lng"], s["lat"], s["lng"])
                    if s["lat"] and s["lng"] else 9999
                )
            ordered.append(remaining.pop(0))
        stops = ordered

        # Drive times via Mapbox Directions
        token = os.getenv("MAPBOX_TOKEN")
        if token:
            for i in range(len(stops) - 1):
                a, b_stop = stops[i], stops[i + 1]
                if a["lat"] and a["lng"] and b_stop["lat"] and b_stop["lng"]:
                    try:
                        url = (
                            f"https://api.mapbox.com/directions/v5/mapbox/driving/"
                            f"{a['lng']},{a['lat']};{b_stop['lng']},{b_stop['lat']}"
                            f"?access_token={token}&overview=false"
                        )
                        async with httpx.AsyncClient() as hc:
                            r = await hc.get(url, timeout=5)
                            routes = r.json().get("routes", [])
                            if routes:
                                stops[i + 1]["drive_minutes"] = round(routes[0]["duration"] / 60)
                                stops[i + 1]["drive_miles"] = round(routes[0]["distance"] / 1609.34, 1)
                    except Exception:
                        pass

    return {"stops": stops, "has_locations": len(geo_stops) > 0, "geo_count": len(geo_stops)}


# ── CSV import ────────────────────────────────────────────────────────────────

@app.post("/api/import/preview")
async def import_preview(
    file: UploadFile = File(...),
    groomer: Groomer = Depends(get_current_groomer),
):
    raw = (await file.read()).decode("utf-8-sig")  # strip Excel BOM
    try:
        columns, rows = parse_csv(raw)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {e}")
    if not columns:
        raise HTTPException(status_code=400, detail="CSV has no headers")
    return {
        "columns": columns,
        "total_rows": len(rows),
        "sample_rows": rows[:3],
        "suggested_mapping": suggest_mapping(columns),
    }


@app.post("/api/import/apply")
def import_apply(
    body: ImportApplyRequest,
    db: Session = Depends(get_db),
    groomer: Groomer = Depends(get_current_groomer),
):
    if "client_phone" not in body.mapping.values():
        raise HTTPException(
            status_code=400,
            detail="No column is mapped to Phone. Please assign a phone column before importing.",
        )

    imported = skipped = 0
    issues: list[dict] = []
    seen_phones: dict[str, int] = {}  # normalized phone → first CSV row number (2-based)
    rev_map = {field: col for col, field in body.mapping.items()}

    def get(field: str, row: dict) -> str:
        col = rev_map.get(field)
        return row.get(col, "").strip() if col else ""

    for idx, row in enumerate(body.rows):
        row_num = idx + 2  # row 1 = header

        phone_raw = get("client_phone", row)
        if not phone_raw:
            skipped += 1
            issues.append({"row": row_num, "type": "no_phone", "field": "client_phone",
                           "value": "", "detail": "Phone cell is empty — row skipped"})
            continue

        phone = normalize_phone_safe(phone_raw)
        if not phone:
            skipped += 1
            issues.append({"row": row_num, "type": "bad_phone", "field": "client_phone",
                           "value": phone_raw,
                           "detail": f"'{phone_raw}' couldn't be parsed as a phone number — row skipped"})
            continue

        if phone in seen_phones:
            issues.append({"row": row_num, "type": "duplicate_phone", "field": "client_phone",
                           "value": phone_raw,
                           "detail": f"Same number as row {seen_phones[phone]} — this row's data will overwrite"})
        else:
            seen_phones[phone] = row_num

        name = get("client_name", row)
        if not name:
            name = "Unknown"
            issues.append({"row": row_num, "type": "missing_name", "field": "client_name",
                           "value": "", "detail": "Name was blank — saved as 'Unknown', update in Clients tab"})

        client = db.query(Client).filter(
            Client.groomer_id == groomer.id, Client.phone == phone
        ).first()
        if not client:
            client = Client(
                id=uuid.uuid4().hex,
                groomer_id=groomer.id,
                phone=phone,
                name=name,
                intake_token=uuid.uuid4().hex,
            )
            db.add(client)
            db.flush()
        else:
            if name and name != "Unknown" and client.name in ("Unknown", ""):
                client.name = name

        pet_name = get("pet_name", row)

        rabies_raw = get("rabies_expiry", row)
        rabies_normalized: str | None = None
        if rabies_raw:
            rabies_normalized = normalize_date(rabies_raw)
            if rabies_normalized is None:
                issues.append({"row": row_num, "type": "bad_date", "field": "rabies_expiry",
                               "value": rabies_raw,
                               "detail": f"'{rabies_raw}' is not a recognized date — expiry left blank"})

        if pet_name and not client.pet_profiles:
            db.add(PetProfile(
                id=uuid.uuid4().hex,
                client_id=client.id,
                pet_name=pet_name,
                breed=get("breed", row) or None,
                rabies_expiry=rabies_normalized,
                notes=get("notes", row) or None,
            ))

        imported += 1

    db.commit()
    return {"imported": imported, "skipped": skipped, "issues": issues}


# ── Feedback (public) ─────────────────────────────────────────────────────────

@app.post("/api/feedback")
def submit_feedback(body: FeedbackCreate, db: Session = Depends(get_db)):
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Message required")
    fb = Feedback(
        email=body.email.strip() or None,
        type=body.type,
        message=body.message.strip(),
    )
    db.add(fb)
    db.commit()
    return {"success": True}


@app.get("/api/admin/feedback")
def admin_feedback(
    x_admin_key: Optional[str] = Header(None),
    admin_key: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    _require_admin(x_admin_key, admin_key)
    rows = db.query(Feedback).order_by(Feedback.created_at.desc()).all()
    return [
        {"id": f.id, "email": f.email, "type": f.type, "message": f.message,
         "created_at": f.created_at.isoformat()}
        for f in rows
    ]


# ── Waitlist ──────────────────────────────────────────────────────────────────

@app.get("/api/waitlist")
def get_waitlist(
    db: Session = Depends(get_db),
    groomer: Groomer = Depends(get_current_groomer),
):
    entries = db.query(WaitlistEntry).filter(
        WaitlistEntry.groomer_id == groomer.id
    ).order_by(WaitlistEntry.created_at.asc()).all()
    return [{"id": e.id, "phone": e.phone, "name": e.name} for e in entries]


@app.post("/api/waitlist")
def add_waitlist(
    body: WaitlistAdd,
    db: Session = Depends(get_db),
    groomer: Groomer = Depends(get_current_groomer),
):
    entry = WaitlistEntry(groomer_id=groomer.id, phone=body.phone, name=body.name)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return {"id": entry.id, "phone": entry.phone, "name": entry.name}


@app.delete("/api/waitlist/{entry_id}")
def remove_waitlist(
    entry_id: str,
    db: Session = Depends(get_db),
    groomer: Groomer = Depends(get_current_groomer),
):
    entry = db.query(WaitlistEntry).filter(
        WaitlistEntry.id == entry_id, WaitlistEntry.groomer_id == groomer.id
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(entry)
    db.commit()
    return {"success": True}


# ── Admin ─────────────────────────────────────────────────────────────────────

def _require_admin(x_admin_key: Optional[str] = None, admin_key: Optional[str] = Query(None)):
    key = x_admin_key or admin_key
    if key != ADMIN_KEY:
        raise HTTPException(status_code=403, detail="Forbidden")


@app.get("/api/admin/overview")
def admin_overview(
    x_admin_key: Optional[str] = Header(None),
    admin_key: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    _require_admin(x_admin_key, admin_key)
    total_groomers = db.query(func.count(Groomer.id)).scalar()
    total_clients = db.query(func.count(Client.id)).scalar()
    total_bookings = db.query(func.count(Booking.id)).scalar()
    total_revenue = db.query(func.sum(Booking.price)).filter(Booking.status == "completed").scalar() or 0.0
    newest = db.query(Groomer).order_by(Groomer.created_at.desc()).first()
    return {
        "total_groomers": total_groomers,
        "total_clients": total_clients,
        "total_bookings": total_bookings,
        "total_revenue": round(float(total_revenue), 2),
        "newest_groomer": {"name": newest.name, "email": newest.email, "created_at": newest.created_at.isoformat()} if newest else None,
    }


@app.get("/api/admin/groomers")
def admin_groomers(
    x_admin_key: Optional[str] = Header(None),
    admin_key: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    _require_admin(x_admin_key, admin_key)
    groomers = db.query(Groomer).order_by(Groomer.created_at.desc()).all()
    result = []
    for g in groomers:
        client_count = db.query(func.count(Client.id)).filter(Client.groomer_id == g.id).scalar()
        booking_count = db.query(func.count(Booking.id)).filter(Booking.groomer_id == g.id).scalar()
        revenue = db.query(func.sum(Booking.price)).filter(
            Booking.groomer_id == g.id, Booking.status == "completed"
        ).scalar() or 0.0
        last_booking = db.query(Booking).filter(Booking.groomer_id == g.id).order_by(Booking.created_at.desc()).first()
        result.append({
            "id": g.id,
            "name": g.name,
            "email": g.email,
            "slug": g.slug,
            "google_linked": bool(g.google_id),
            "created_at": g.created_at.isoformat(),
            "client_count": client_count,
            "booking_count": booking_count,
            "total_revenue": round(float(revenue), 2),
            "last_booking_at": last_booking.created_at.isoformat() if last_booking else None,
        })
    return result


@app.get("/api/admin/groomers/{groomer_id}")
def admin_groomer_detail(
    groomer_id: str,
    x_admin_key: Optional[str] = Header(None),
    admin_key: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    _require_admin(x_admin_key, admin_key)
    g = db.query(Groomer).filter(Groomer.id == groomer_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Groomer not found")

    clients = db.query(Client).filter(Client.groomer_id == g.id).order_by(Client.created_at.desc()).all()
    client_list = []
    for c in clients:
        last = db.query(Booking).filter(Booking.client_id == c.id).order_by(Booking.appointment_date.desc()).first()
        client_list.append({
            "id": c.id,
            "name": c.name,
            "phone": c.phone,
            "pet_count": len(c.pet_profiles),
            "booking_count": len(c.bookings),
            "last_visit": last.appointment_date.isoformat() if last and last.appointment_date else None,
        })

    recent_bookings = (
        db.query(Booking).filter(Booking.groomer_id == g.id)
        .order_by(Booking.appointment_date.desc()).limit(20).all()
    )
    booking_list = [_booking_dict(b) for b in recent_bookings]

    revenue = db.query(func.sum(Booking.price)).filter(
        Booking.groomer_id == g.id, Booking.status == "completed"
    ).scalar() or 0.0

    return {
        "id": g.id,
        "name": g.name,
        "email": g.email,
        "slug": g.slug,
        "google_linked": bool(g.google_id),
        "created_at": g.created_at.isoformat(),
        "total_revenue": round(float(revenue), 2),
        "clients": client_list,
        "recent_bookings": booking_list,
    }


# ── Admin test runner ─────────────────────────────────────────────────────────

import json as _json
import subprocess
import sys as _sys

_RESULTS_PATH = Path(__file__).parent.parent / "tests" / "results" / "latest.json"
_RUN_ALL_PATH = Path(__file__).parent.parent / "tests" / "run_all.py"


@app.get("/api/admin/test-results")
def admin_test_results(
    x_admin_key: Optional[str] = Header(None),
    admin_key: Optional[str] = Query(None),
):
    _require_admin(x_admin_key, admin_key)
    if not _RESULTS_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail="No test results yet. POST /api/admin/run-tests to generate them.",
        )
    return _json.loads(_RESULTS_PATH.read_text(encoding="utf-8"))


@app.post("/api/admin/run-tests")
def admin_run_tests(
    x_admin_key: Optional[str] = Header(None),
    admin_key: Optional[str] = Query(None),
):
    _require_admin(x_admin_key, admin_key)
    if not _RUN_ALL_PATH.exists():
        raise HTTPException(status_code=404, detail="tests/run_all.py not found")
    _RESULTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    try:
        subprocess.run(
            [_sys.executable, str(_RUN_ALL_PATH)],
            capture_output=True, text=True, timeout=300,
            cwd=str(Path(__file__).parent.parent),
            env={**os.environ, "PYTHONUTF8": "1"},
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Test run timed out (>5 min)")
    if not _RESULTS_PATH.exists():
        raise HTTPException(status_code=500, detail="Tests ran but produced no results file")
    return _json.loads(_RESULTS_PATH.read_text(encoding="utf-8"))


# ── Serve React build ─────────────────────────────────────────────────────────

_DIST = Path(__file__).parent / ".." / "frontend" / "dist"

if _DIST.is_dir():
    _assets = _DIST / "assets"
    if _assets.is_dir():
        app.mount("/assets", StaticFiles(directory=str(_assets)), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        return FileResponse(str(_DIST / "index.html"))
