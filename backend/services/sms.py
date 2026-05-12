import logging
import os

logger = logging.getLogger(__name__)


def _configured() -> bool:
    return all(os.getenv(k) for k in ("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"))


def _base() -> str:
    return os.getenv("BASE_URL", "http://localhost:4001")


def send_sms(phone: str, body: str) -> bool:
    """Send SMS via Twilio. Returns False (no-op) when credentials are not configured."""
    if not _configured():
        logger.info("[SMS stub] to=%s | %s", phone, body[:120])
        return False
    try:
        from twilio.rest import Client
        sid = os.getenv("TWILIO_ACCOUNT_SID")
        token = os.getenv("TWILIO_AUTH_TOKEN")
        from_ = os.getenv("TWILIO_PHONE_NUMBER", "")
        Client(sid, token).messages.create(body=body, from_=from_, to=phone)
        return True
    except Exception as e:
        logger.error("SMS send failed to %s: %s", phone, e)
        return False


def send_intake_link(phone: str, name: str, token: str) -> bool:
    url = f"{_base()}/profile/{token}"
    return send_sms(phone, f"Hi {name}! Fill out your pet's profile (2 min): {url}")


def send_vaccine_link(phone: str, name: str, token: str) -> bool:
    url = f"{_base()}/vaccine/{token}"
    return send_sms(phone, f"Hi {name}! Please upload your pet's vaccine cert: {url}")


def send_booking_confirmation(phone: str, name: str) -> bool:
    return send_sms(
        phone,
        f"Hi {name}! Your grooming appointment is confirmed. Cancellations under 24h incur a $25 fee. See you soon!",
    )


def send_booking_request_received(phone: str, name: str) -> bool:
    return send_sms(phone, f"Hi {name}! We received your booking request and will confirm within the hour.")
