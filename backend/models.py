import uuid
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import relationship
from database import Base


def _uuid() -> str:
    return uuid.uuid4().hex


class Groomer(Base):
    __tablename__ = "groomers"

    id = Column(String, primary_key=True, default=_uuid)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=True)  # null for Google-only accounts
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)  # /book/{slug}
    google_id = Column(String, unique=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    clients = relationship("Client", back_populates="groomer")
    settings = relationship("GroomerSettings", back_populates="groomer", uselist=False)
    waitlist = relationship("WaitlistEntry", back_populates="groomer")


class Client(Base):
    __tablename__ = "clients"

    id = Column(String, primary_key=True, default=_uuid)
    groomer_id = Column(String, ForeignKey("groomers.id"), nullable=False, index=True)
    phone = Column(String, nullable=False)
    name = Column(String, nullable=False)
    intake_token = Column(String, unique=True, default=_uuid)
    created_at = Column(DateTime, default=datetime.utcnow)

    groomer = relationship("Groomer", back_populates="clients")
    pet_profiles = relationship("PetProfile", back_populates="client")
    bookings = relationship("Booking", back_populates="client")
    vaccine_submissions = relationship("VaccineSubmission", back_populates="client")


class PetProfile(Base):
    __tablename__ = "pet_profiles"

    id = Column(String, primary_key=True, default=_uuid)
    client_id = Column(String, ForeignKey("clients.id"), nullable=False)
    pet_name = Column(String)
    breed = Column(String)
    age = Column(String)
    weight = Column(String)
    emergency_contact = Column(String)
    notes = Column(String)
    rabies_expiry = Column(String)
    profile_complete = Column(Boolean, default=False)
    completed_at = Column(DateTime)

    client = relationship("Client", back_populates="pet_profiles")
    bookings = relationship("Booking", back_populates="pet")
    vaccine_submissions = relationship("VaccineSubmission", back_populates="pet")


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(String, primary_key=True, default=_uuid)
    groomer_id = Column(String, ForeignKey("groomers.id"), nullable=False, index=True)
    client_id = Column(String, ForeignKey("clients.id"), nullable=False)
    pet_id = Column(String, ForeignKey("pet_profiles.id"), nullable=True)
    appointment_date = Column(DateTime)
    service_type = Column(String, default="Full Groom")
    status = Column(String, default="pending_payment")
    stripe_session_id = Column(String)
    deposit_amount = Column(Float, default=25.0)
    price = Column(Float, nullable=True)
    source = Column(String, default="groomer")  # "groomer" | "online"
    created_at = Column(DateTime, default=datetime.utcnow)

    client = relationship("Client", back_populates="bookings")
    pet = relationship("PetProfile", back_populates="bookings")


class VaccineSubmission(Base):
    __tablename__ = "vaccine_submissions"

    id = Column(String, primary_key=True, default=_uuid)
    client_id = Column(String, ForeignKey("clients.id"), nullable=False)
    pet_id = Column(String, ForeignKey("pet_profiles.id"), nullable=True)
    image_filename = Column(String)
    ai_expiry = Column(String)
    confirmed_expiry = Column(String)
    status = Column(String, default="pending")  # pending | confirmed | needs_retake
    created_at = Column(DateTime, default=datetime.utcnow)

    client = relationship("Client", back_populates="vaccine_submissions")
    pet = relationship("PetProfile", back_populates="vaccine_submissions")


class WaitlistEntry(Base):
    __tablename__ = "waitlist"

    id = Column(String, primary_key=True, default=_uuid)
    groomer_id = Column(String, ForeignKey("groomers.id"), nullable=False, index=True)
    phone = Column(String, nullable=False)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    groomer = relationship("Groomer", back_populates="waitlist")


class GroomerSettings(Base):
    __tablename__ = "groomer_settings"

    groomer_id = Column(String, ForeignKey("groomers.id"), primary_key=True)
    require_deposit = Column(Boolean, default=True)
    send_24h_reminder = Column(Boolean, default=True)
    send_gap_fill_text = Column(Boolean, default=True)
    deposit_amount = Column(Float, default=25.0)
    service_prices = Column(JSON, nullable=True)
    working_hours = Column(JSON, nullable=True)

    groomer = relationship("Groomer", back_populates="settings")
