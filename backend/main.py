import os
import uuid
from datetime import date, datetime, time as dt_time, timedelta
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

load_dotenv()

from database import Base, engine, get_db
from models import Booking, Client, GroomerSettings, PetProfile, VaccineSubmission
from services.vision import extract_vaccine_info

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Groomer API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

BASE_URL = os.getenv("BASE_URL", "http://localhost:4001")

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

class StatusUpdate(BaseModel):
    status: str

class VaccineConfirmBody(BaseModel):
    expiry: str

class SettingsUpdate(BaseModel):
    require_deposit: Optional[bool] = None
    send_24h_reminder: Optional[bool] = None
    send_gap_fill_text: Optional[bool] = None
    deposit_amount: Optional[float] = None
    service_prices: Optional[dict] = None

class ClientUpdate(BaseModel):
    name: str
    phone: str

class PetUpdate(BaseModel):
    pet_name: str = ""
    breed: str = ""
    age: str = ""
    weight: str = ""
    notes: str = ""


# ── Helpers ───────────────────────────────────────────────────────────────────

def normalize_phone(raw: str) -> str:
    digits = "".join(c for c in raw if c.isdigit())
    if len(digits) == 10:
        return f"+1{digits}"
    if len(digits) == 11 and digits.startswith("1"):
        return f"+{digits}"
    return f"+{digits}"

def _vaccine_ok(pet: Optional[PetProfile]) -> bool:
    if not pet or not pet.rabies_expiry:
        return False
    try:
        return datetime.fromisoformat(pet.rabies_expiry) > datetime.utcnow()
    except ValueError:
        return bool(pet.rabies_expiry)

def _get_settings(db: Session) -> GroomerSettings:
    s = db.query(GroomerSettings).filter(GroomerSettings.id == 1).first()
    if not s:
        s = GroomerSettings(id=1)
        db.add(s)
        db.commit()
        db.refresh(s)
    return s

def _get_prices(db: Session) -> dict:
    s = _get_settings(db)
    return s.service_prices or DEFAULT_PRICES

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
    }


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok"}


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
            c = Client(id=uuid.uuid4().hex, phone=phone, name=name, intake_token=uuid.uuid4().hex)
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
            db.add(Booking(id=uuid.uuid4().hex, client_id=client_rows[idx].id, pet_id=pet_rows[idx].id,
                           appointment_date=appt(h, m), service_type=svc, status=status,
                           deposit_amount=25.0, price=price))
        db.add(Booking(id=uuid.uuid4().hex, client_id=jane.id, pet_id=pepper.id,
                       appointment_date=appt(15, 30), service_type="Bath & Cut", status="confirmed",
                       deposit_amount=25.0, price=60.0))

        # Past bookings across several weeks for history/revenue demo
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
            db.add(Booking(id=uuid.uuid4().hex, client_id=client_rows[idx].id, pet_id=pet_rows[idx].id,
                           appointment_date=past, service_type=svc, status=status,
                           deposit_amount=25.0, price=price))

        db.add(GroomerSettings(id=1, require_deposit=True, send_24h_reminder=True,
                               send_gap_fill_text=True, deposit_amount=25.0,
                               service_prices=DEFAULT_PRICES))
        db.commit()
        return {"seeded": True, "date": today.isoformat()}
    finally:
        db.close()


# ── Customer booking flow ─────────────────────────────────────────────────────

@app.post("/api/bookings")
async def create_booking(req: BookingRequest, db: Session = Depends(get_db)):
    phone = normalize_phone(req.phone)
    client = db.query(Client).filter(Client.phone == phone).first()
    if not client:
        client = Client(id=uuid.uuid4().hex, phone=phone, name=req.name, intake_token=uuid.uuid4().hex)
        db.add(client)
        db.flush()
        db.add(PetProfile(id=uuid.uuid4().hex, client_id=client.id))

    booking = Booking(id=uuid.uuid4().hex, client_id=client.id, status="confirmed",
                      appointment_date=datetime.combine(date.today(), dt_time(9, 0)))
    db.add(booking)
    db.commit()
    return {"booking_id": booking.id, "message": "Booking created"}


# ── Groomer dashboard ─────────────────────────────────────────────────────────

@app.get("/api/appointments/today")
def get_today_appointments(db: Session = Depends(get_db)):
    today = date.today()
    bookings = (
        db.query(Booking)
        .filter(func.date(Booking.appointment_date) == today)
        .all()
    )
    result = [_booking_dict(b) for b in bookings]
    return sorted(result, key=lambda x: x["appointment_date"] or "")


@app.get("/api/appointments/history")
def get_history(q: str = Query(""), days: int = Query(60), db: Session = Depends(get_db)):
    since = datetime.combine(date.today() - timedelta(days=days), dt_time(0, 0))
    today_start = datetime.combine(date.today(), dt_time(0, 0))
    bookings = (
        db.query(Booking)
        .filter(Booking.appointment_date >= since)
        .filter(Booking.appointment_date < today_start)
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
def get_revenue(db: Session = Depends(get_db)):
    prices = _get_prices(db)
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)

    def revenue_for(start: date):
        bookings = (
            db.query(Booking)
            .filter(Booking.status == "completed")
            .filter(func.date(Booking.appointment_date) >= start)
            .filter(func.date(Booking.appointment_date) <= today)
            .all()
        )
        total = sum(b.price if b.price is not None else prices.get(b.service_type or "", 0) for b in bookings)
        return {"revenue": round(total, 2), "count": len(bookings)}

    # Revenue by service type (month)
    month_bookings = (
        db.query(Booking)
        .filter(Booking.status == "completed")
        .filter(func.date(Booking.appointment_date) >= month_start)
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
async def quick_booking(req: QuickBookingRequest, db: Session = Depends(get_db)):
    phone = normalize_phone(req.phone)
    client = db.query(Client).filter(Client.phone == phone).first()
    if not client:
        client = Client(
            id=uuid.uuid4().hex,
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
            h, m = map(int, req.appointment_time.split(":"))
            appt_dt = datetime.combine(date.today(), dt_time(h, m))
        except ValueError:
            pass

    settings = _get_settings(db)
    prices = settings.service_prices or DEFAULT_PRICES
    booking = Booking(
        id=uuid.uuid4().hex,
        client_id=client.id,
        service_type=req.service_type,
        appointment_date=appt_dt,
        status="confirmed",
        price=prices.get(req.service_type),
    )
    db.add(booking)
    db.flush()
    db.commit()
    return {"booking_id": booking.id, "intake_token": client.intake_token}


@app.patch("/api/bookings/{booking_id}/status")
def update_status(booking_id: str, body: StatusUpdate, db: Session = Depends(get_db)):
    b = db.query(Booking).filter(Booking.id == booking_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Not found")
    b.status = body.status
    db.commit()
    return {"success": True}



# ── Clients ───────────────────────────────────────────────────────────────────

@app.get("/api/clients")
def get_clients(db: Session = Depends(get_db)):
    clients = db.query(Client).order_by(Client.created_at.desc()).all()
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


# ── Client / pet edit (groomer-facing) ───────────────────────────────────────

@app.patch("/api/clients/{client_id}")
def update_client(client_id: str, body: ClientUpdate, db: Session = Depends(get_db)):
    c = db.query(Client).filter(Client.id == client_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Not found")
    c.name = body.name
    c.phone = normalize_phone(body.phone)
    db.commit()
    return {"success": True}


@app.patch("/api/pets/{pet_id}")
def update_pet_groomer(pet_id: str, data: PetUpdate, db: Session = Depends(get_db)):
    pet = db.query(PetProfile).filter(PetProfile.id == pet_id).first()
    if not pet:
        raise HTTPException(status_code=404, detail="Not found")
    for field in ("pet_name", "breed", "age", "weight", "notes"):
        setattr(pet, field, getattr(data, field))
    db.commit()
    return {"success": True}


# ── Pet profile (customer-facing) ─────────────────────────────────────────────

@app.get("/api/profile/{token}")
def get_profile(token: str, db: Session = Depends(get_db)):
    c = db.query(Client).filter(Client.intake_token == token).first()
    if not c:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {
        "client_name": c.name,
        "pets": [_pet_dict(p) for p in c.pet_profiles],
    }


@app.put("/api/profile/{token}")
def update_profile(token: str, data: ProfileUpdate, db: Session = Depends(get_db)):
    """Backward-compat: edits the first pet (or creates one)."""
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
def get_vault(db: Session = Depends(get_db)):
    submissions = (
        db.query(VaccineSubmission)
        .filter(VaccineSubmission.status == "pending")
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
def confirm_vaccine(submission_id: str, body: VaccineConfirmBody, db: Session = Depends(get_db)):
    s = db.query(VaccineSubmission).filter(VaccineSubmission.id == submission_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Not found")
    s.confirmed_expiry = body.expiry
    s.status = "confirmed"
    target_pet = s.pet
    if not target_pet:
        c = s.client
        if c and c.pet_profiles:
            target_pet = c.pet_profiles[0]
    if target_pet:
        target_pet.rabies_expiry = body.expiry
    db.commit()
    return {"success": True}


# ── Settings ──────────────────────────────────────────────────────────────────

@app.get("/api/settings")
def get_settings(db: Session = Depends(get_db)):
    s = _get_settings(db)
    return {
        "require_deposit": s.require_deposit,
        "send_24h_reminder": s.send_24h_reminder,
        "send_gap_fill_text": s.send_gap_fill_text,
        "deposit_amount": s.deposit_amount,
        "service_prices": s.service_prices or DEFAULT_PRICES,
    }


@app.patch("/api/settings")
def update_settings(body: SettingsUpdate, db: Session = Depends(get_db)):
    s = _get_settings(db)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(s, field, value)
    db.commit()
    return {"success": True}



# ── Serve React build ─────────────────────────────────────────────────────────

_DIST = Path(__file__).parent / ".." / "frontend" / "dist"

if _DIST.is_dir():
    _assets = _DIST / "assets"
    if _assets.is_dir():
        app.mount("/assets", StaticFiles(directory=str(_assets)), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        return FileResponse(str(_DIST / "index.html"))
