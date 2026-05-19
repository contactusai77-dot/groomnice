"""
Pure helper functions — no DB, no auth, no network dependencies.
Importable in unit tests without pulling in FastAPI or jose.
"""
import math
import re
from datetime import datetime
from typing import Optional


def normalize_phone(raw: str) -> str:
    digits = "".join(c for c in raw if c.isdigit())
    if len(digits) == 10:
        return f"+1{digits}"
    if len(digits) == 11 and digits.startswith("1"):
        return f"+{digits}"
    return f"+{digits}"


def slug_from(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower().strip()).strip("-")
    return s or "groomer"


def vaccine_ok(pet) -> bool:
    if not pet or not pet.rabies_expiry:
        return False
    try:
        return datetime.fromisoformat(pet.rabies_expiry) > datetime.utcnow()
    except ValueError:
        return bool(pet.rabies_expiry)


def haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in miles between two (lat, lng) points."""
    R = 3958.8
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dlng / 2) ** 2)
    return R * 2 * math.asin(math.sqrt(a))
