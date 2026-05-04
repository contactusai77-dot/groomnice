import os
from twilio.rest import Client

_client = None


def _get_client() -> Client:
    global _client
    if _client is None:
        _client = Client(os.getenv("TWILIO_ACCOUNT_SID"), os.getenv("TWILIO_AUTH_TOKEN"))
    return _client


def _from() -> str:
    return os.getenv("TWILIO_PHONE_NUMBER", "")


def _base() -> str:
    return os.getenv("BASE_URL", "http://localhost:4001")


def send_sms_raw(phone: str, message: str) -> None:
    _get_client().messages.create(to=phone, from_=_from(), body=message)


def send_intake_link(phone: str, name: str, token: str) -> None:
    url = f"{_base()}/profile/{token}"
    send_sms_raw(phone, f"Hi {name}! 🐾 Fill out your pet's profile (2 min): {url}")


def send_booking_confirmation(phone: str, name: str, stripe_url: str) -> None:
    send_sms_raw(
        phone,
        f"Hi {name}! Secure your grooming spot with a $25 deposit: {stripe_url}",
    )


def send_confirmation(phone: str, name: str) -> None:
    send_sms_raw(phone, f"You're confirmed! 🎉 We'll remind you 24hrs before. — Your groomer")


def send_vaccine_review_request(phone: str, pet_name: str, token: str) -> None:
    url = f"{_base()}/vaccine/{token}"
    send_sms_raw(
        phone,
        f"Hi! The Rabies cert photo for {pet_name} was unclear. Please re-upload: {url}",
    )
