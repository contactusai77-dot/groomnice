import os
import uuid
from datetime import date, datetime, time as dt_time
from pathlib import Path
from typing import Optional

import stripe
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

load_dotenv()
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

from database import Base, engine, get_db
from models import Booking, Client, GroomerSettings, PetProfile, VaccineSubmission
from services.sms import (
    send_booking_confirmation,
    send_confirmation,
    send_intake_link,
    send_sms_raw,
    send_vaccine_review_request,
)
from services.stripe_svc import create_deposit_session
from services.vision import extract_vaccine_info

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Groomer API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

BASE_URL = os.getenv("BASE_URL", "http://localhost:4001")

# Serve uploaded vaccine images
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


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok"}


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

    booking = Booking(id=uuid.uuid4().hex, client_id=client.id, status="pending_payment",
                      appointment_date=datetime.combine(date.today(), dt_time(9, 0)))
    db.add(booking)
    db.flush()

    stripe_url = f"{BASE_URL}/"
    try:
        session = create_deposit_session(booking.id, client.name)
        booking.stripe_session_id = session.id
        stripe_url = session.url
    except Exception as e:
        print(f"[stripe] Skipped — {e}")

    db.commit()

    try:
        send_intake_link(phone, client.name, client.intake_token)
        send_booking_confirmation(phone, client.name, stripe_url)
    except Exception as e:
        print(f"[sms] Skipped — {e}")

    return {"booking_id": booking.id, "stripe_url": stripe_url, "message": "Booking created"}


# ── Groomer dashboard ─────────────────────────────────────────────────────────

@app.get("/api/appointments/today")
def get_today_appointments(db: Session = Depends(get_db)):
    today = date.today()
    bookings = (
        db.query(Booking)
        .filter(func.date(Booking.appointment_date) == today)
        .all()
    )
    result = []
    for b in bookings:
        c = b.client
        pet = c.pet_profile if c else None
        v_ok = _vaccine_ok(pet)
        deposit_ok = b.status in ("confirmed", "completed", "in_progress")
        result.append({
            "id": b.id,
            "appointment_date": b.appointment_date.isoformat() if b.appointment_date else None,
            "service_type": b.service_type or "Full Groom",
            "status": b.status,
            "client_name": c.name if c else "Unknown",
            "client_phone": c.phone if c else "",
            "pet_name": pet.pet_name if pet else "Unknown",
            "breed": pet.breed if pet else None,
            "vaccine_ok": v_ok,
            "deposit_ok": deposit_ok,
            "ready": v_ok and deposit_ok,
            "profile_complete": pet.profile_complete if pet else False,
        })
    return sorted(result, key=lambda x: x["appointment_date"] or "")


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
    elif req.pet_name and client.pet_profile:
        client.pet_profile.pet_name = req.pet_name

    appt_dt = datetime.combine(date.today(), dt_time(9, 0))
    if req.appointment_time:
        try:
            h, m = map(int, req.appointment_time.split(":"))
            appt_dt = datetime.combine(date.today(), dt_time(h, m))
        except ValueError:
            pass

    booking = Booking(
        id=uuid.uuid4().hex,
        client_id=client.id,
        service_type=req.service_type,
        appointment_date=appt_dt,
        status="pending_payment",
    )
    db.add(booking)
    db.flush()
    db.commit()

    try:
        send_intake_link(phone, client.name, client.intake_token)
    except Exception as e:
        print(f"[sms] Skipped — {e}")

    return {"booking_id": booking.id, "intake_token": client.intake_token}


@app.patch("/api/bookings/{booking_id}/status")
def update_status(booking_id: str, body: StatusUpdate, db: Session = Depends(get_db)):
    b = db.query(Booking).filter(Booking.id == booking_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Not found")
    b.status = body.status
    db.commit()
    return {"success": True}


@app.post("/api/bookings/{booking_id}/text-client")
async def text_client(booking_id: str, db: Session = Depends(get_db)):
    b = db.query(Booking).filter(Booking.id == booking_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Not found")
    c = b.client
    pet = c.pet_profile if c else None
    missing = []
    if not pet or not pet.profile_complete:
        missing.append("complete their profile")
    if not _vaccine_ok(pet):
        missing.append("upload their Rabies certificate")
    if b.status == "pending_payment":
        missing.append("pay the deposit")

    if missing:
        msg = f"Hi {c.name}! We still need you to {' and '.join(missing)} before your appointment."
    else:
        msg = f"Hi {c.name}! Just a reminder about your upcoming grooming appointment. See you soon! 🐾"

    try:
        send_sms_raw(c.phone, msg)
    except Exception as e:
        print(f"[sms] Skipped — {e}")

    return {"success": True, "message": msg}


# ── Clients ───────────────────────────────────────────────────────────────────

@app.get("/api/clients")
def get_clients(db: Session = Depends(get_db)):
    clients = db.query(Client).order_by(Client.created_at.desc()).all()
    result = []
    for c in clients:
        pet = c.pet_profile
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
            "pet_name": pet.pet_name if pet else None,
            "breed": pet.breed if pet else None,
            "vaccine_ok": _vaccine_ok(pet),
            "rabies_expiry": pet.rabies_expiry if pet else None,
            "profile_complete": pet.profile_complete if pet else False,
            "last_visit": last.created_at.isoformat() if last else None,
        })
    return result


# ── Pet profile (customer-facing) ─────────────────────────────────────────────

@app.get("/api/profile/{token}")
def get_profile(token: str, db: Session = Depends(get_db)):
    c = db.query(Client).filter(Client.intake_token == token).first()
    if not c:
        raise HTTPException(status_code=404, detail="Profile not found")
    pet = c.pet_profile
    return {
        "client_name": c.name,
        "pet_name": pet.pet_name if pet else None,
        "breed": pet.breed if pet else None,
        "age": pet.age if pet else None,
        "weight": pet.weight if pet else None,
        "emergency_contact": pet.emergency_contact if pet else None,
        "notes": pet.notes if pet else None,
        "rabies_expiry": pet.rabies_expiry if pet else None,
        "profile_complete": pet.profile_complete if pet else False,
    }


@app.put("/api/profile/{token}")
def update_profile(token: str, data: ProfileUpdate, db: Session = Depends(get_db)):
    c = db.query(Client).filter(Client.intake_token == token).first()
    if not c:
        raise HTTPException(status_code=404, detail="Profile not found")
    pet = c.pet_profile
    if not pet:
        pet = PetProfile(id=uuid.uuid4().hex, client_id=c.id)
        db.add(pet)
    for field in ("pet_name", "breed", "age", "weight", "emergency_contact", "notes"):
        setattr(pet, field, getattr(data, field))
    pet.profile_complete = True
    pet.completed_at = datetime.utcnow()
    db.commit()
    return {"success": True}


# ── Vaccine upload (customer-facing) ──────────────────────────────────────────

@app.post("/api/vaccine/{token}")
async def upload_vaccine(token: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    c = db.query(Client).filter(Client.intake_token == token).first()
    if not c:
        raise HTTPException(status_code=404, detail="Profile not found")

    image_bytes = await file.read()
    media_type = file.content_type or "image/jpeg"

    # Save image for groomer vault review
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
        image_filename=filename,
        ai_expiry=result.get("rabies_expiry"),
        status="needs_retake" if result.get("needs_review") else "pending",
    )
    db.add(submission)

    if not result.get("needs_review"):
        pet = c.pet_profile
        if pet and result.get("rabies_expiry"):
            pet.rabies_expiry = result["rabies_expiry"]

    db.commit()

    if result.get("needs_review"):
        try:
            pet = c.pet_profile
            send_vaccine_review_request(c.phone, pet.pet_name or "your pet", token)
        except Exception:
            pass
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
        pet = c.pet_profile if c else None
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
    c = s.client
    if c and c.pet_profile:
        c.pet_profile.rabies_expiry = body.expiry
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
    }


@app.patch("/api/settings")
def update_settings(body: SettingsUpdate, db: Session = Depends(get_db)):
    s = _get_settings(db)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(s, field, value)
    db.commit()
    return {"success": True}


# ── Stripe webhook ────────────────────────────────────────────────────────────

@app.post("/api/webhooks/stripe")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    secret = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    try:
        event = (
            stripe.Webhook.construct_event(payload, sig, secret)
            if secret
            else {"type": "checkout.session.completed", "data": {"object": {}}}
        )
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    if event["type"] == "checkout.session.completed":
        session_obj = event["data"]["object"]
        booking_id = (session_obj.get("metadata") or {}).get("booking_id")
        if booking_id:
            b = db.query(Booking).filter(Booking.id == booking_id).first()
            if b:
                b.status = "confirmed"
                db.commit()
                try:
                    send_confirmation(b.client.phone, b.client.name)
                except Exception as e:
                    print(f"[sms] Confirmation skipped — {e}")

    return {"received": True}


# ── Serve React build ─────────────────────────────────────────────────────────

_DIST = Path(__file__).parent / ".." / "frontend" / "dist"

if _DIST.is_dir():
    _assets = _DIST / "assets"
    if _assets.is_dir():
        app.mount("/assets", StaticFiles(directory=str(_assets)), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        return FileResponse(str(_DIST / "index.html"))
