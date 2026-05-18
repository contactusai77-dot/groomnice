import csv
import io
import re
from datetime import datetime
from typing import Optional

TARGET_FIELDS = ["client_name", "client_phone", "pet_name", "breed", "rabies_expiry", "notes"]

FIELD_ALIASES: dict[str, list[str]] = {
    "client_name": [
        "owner", "owner name", "client", "client name", "name", "customer",
        "customer name", "full name", "contact name", "contact",
    ],
    "client_phone": [
        "phone", "mobile", "cell", "phone number", "contact number",
        "client phone", "mobile phone", "telephone", "tel", "cell phone",
        "home phone", "work phone",
    ],
    "pet_name": [
        "pet", "pet name", "animal", "dog", "dog name", "cat", "cat name",
        "patient", "patient name", "animal name", "pet's name",
    ],
    "breed": [
        "breed", "dog breed", "animal breed", "species", "type",
        "dog type", "pet breed", "variety",
    ],
    "rabies_expiry": [
        "rabies", "rabies expiry", "rabies exp", "rabies expiration",
        "vaccine", "vaccination", "vaccination date", "vaccine date",
        "expiry", "exp date", "expiration", "rabies due", "rabies date",
        "rabies certificate", "certificate expiry",
    ],
    "notes": [
        "notes", "comments", "special instructions", "memo",
        "additional notes", "special needs", "remarks", "grooming notes",
    ],
}


def parse_csv(content: str) -> tuple[list[str], list[dict]]:
    reader = csv.DictReader(io.StringIO(content))
    columns = list(reader.fieldnames or [])
    rows = [dict(row) for row in reader]
    return columns, rows


def suggest_mapping(columns: list[str]) -> dict[str, str]:
    mapping: dict[str, str] = {}
    used_fields: set[str] = set()
    for col in columns:
        col_lower = col.lower().strip()
        for field, aliases in FIELD_ALIASES.items():
            if field in used_fields:
                continue
            if col_lower in aliases or any(alias in col_lower for alias in aliases):
                mapping[col] = field
                used_fields.add(field)
                break
    return mapping


_DATE_FORMATS = [
    "%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%m-%d-%Y", "%m-%d-%y",
    "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d",
]

def normalize_date(raw: str) -> Optional[str]:
    """Parse a date string into YYYY-MM-DD; return None if unrecognizable."""
    s = raw.strip()
    if not s:
        return None
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    for fmt in ("%b %Y", "%B %Y"):  # "Apr 2027", "April 2027"
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-01")
        except ValueError:
            pass
    m = re.match(r"^(\d{1,2})[/-](\d{4})$", s)  # "04/2027"
    if m:
        try:
            return datetime(int(m.group(2)), int(m.group(1)), 1).strftime("%Y-%m-%d")
        except ValueError:
            pass
    return None


def normalize_phone_safe(raw: str) -> Optional[str]:
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 10:
        return f"+1{digits}"
    if len(digits) == 11 and digits.startswith("1"):
        return f"+{digits}"
    if len(digits) >= 7:
        return f"+{digits}"
    return None
