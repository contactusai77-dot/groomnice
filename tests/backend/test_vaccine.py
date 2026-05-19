"""
Integration tests for vaccine upload and vault confirmation flow.

OCR (extract_vaccine_info) is mocked in all tests to avoid real Anthropic calls.
"""
import io
import struct
import zlib
import pytest
from unittest.mock import patch


def _tiny_png() -> bytes:
    """Minimal valid 1x1 PNG."""
    def chunk(name: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(name + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + name + data + struct.pack(">I", crc)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(b"\x00\xFF\xFF\xFF"))
        + chunk(b"IEND", b"")
    )


@pytest.fixture(scope="module")
def upload_token(client):
    """Create a fresh client and return their intake token."""
    r = client.post("/api/bookings/quick", json={
        "phone": "555-400-0001", "client_name": "Vaccine Tester",
        "pet_name": "Fluffy", "service_type": "Bath", "appointment_time": "13:00",
    })
    assert r.status_code == 200
    return r.json()["intake_token"]


# ── Upload ────────────────────────────────────────────────────────────────────

def test_upload_bad_token_404(client):
    r = client.post(
        "/api/vaccine/does-not-exist-token-xyz",
        files={"file": ("cert.jpg", b"fake", "image/jpeg")},
    )
    assert r.status_code == 404


def test_upload_success_with_clear_cert(client, upload_token):
    """OCR returns a valid expiry -> submission created as pending."""
    with patch("main.extract_vaccine_info", return_value={
        "rabies_expiry": "2028-06-01", "pet_name": "Fluffy",
        "confidence": "high", "needs_review": False,
    }):
        r = client.post(
            f"/api/vaccine/{upload_token}",
            files={"file": ("cert.png", io.BytesIO(_tiny_png()), "image/png")},
        )
    assert r.status_code == 200
    body = r.json()
    assert body["rabies_expiry"] == "2028-06-01"
    assert body["needs_review"] is False


def test_upload_unreadable_cert_needs_review(client, upload_token):
    """OCR returns needs_review=True -> submission created as needs_retake."""
    with patch("main.extract_vaccine_info", return_value={
        "rabies_expiry": None, "pet_name": None,
        "confidence": "low", "needs_review": True,
    }):
        r = client.post(
            f"/api/vaccine/{upload_token}",
            files={"file": ("blur.png", io.BytesIO(_tiny_png()), "image/png")},
        )
    assert r.status_code == 200
    assert r.json()["needs_review"] is True
    assert r.json()["rabies_expiry"] is None


def test_upload_creates_vault_entry(client, upload_token):
    """A pending submission must appear in the groomer's vault."""
    with patch("main.extract_vaccine_info", return_value={
        "rabies_expiry": "2027-01-01", "needs_review": False, "confidence": "high",
    }):
        client.post(
            f"/api/vaccine/{upload_token}",
            files={"file": ("cert2.jpg", b"\xff\xd8\xff\xe0fake", "image/jpeg")},
        )

    vault = client.get("/api/vaccine-vault").json()
    entry = next((s for s in vault if s["client_name"] == "Vaccine Tester"), None)
    assert entry is not None
    assert entry["status"] in ("pending", "needs_retake")


# ── Vault confirm ─────────────────────────────────────────────────────────────

def test_confirm_updates_pet_rabies_expiry(client, upload_token):
    """Confirming a submission must update the pet's rabies_expiry in the DB."""
    with patch("main.extract_vaccine_info", return_value={
        "rabies_expiry": "2029-03-01", "needs_review": False, "confidence": "high",
    }):
        client.post(
            f"/api/vaccine/{upload_token}",
            files={"file": ("cert3.jpg", b"\xff\xd8fake", "image/jpeg")},
        )

    vault = client.get("/api/vaccine-vault").json()
    entry = next((s for s in vault if s["client_name"] == "Vaccine Tester"), None)
    assert entry is not None

    r = client.patch(f"/api/vaccine-vault/{entry['id']}/confirm", json={"expiry": "2030-01-01"})
    assert r.status_code == 200
    assert r.json()["success"] is True

    clients = client.get("/api/clients").json()
    tester = next((c for c in clients if c["name"] == "Vaccine Tester"), None)
    assert tester is not None
    expiry = tester["pets"][0].get("rabies_expiry") if tester["pets"] else None
    assert expiry == "2030-01-01"


def test_confirmed_submission_disappears_from_vault(client, upload_token):
    """After confirm, the submission must no longer appear in vault list."""
    with patch("main.extract_vaccine_info", return_value={
        "rabies_expiry": "2028-12-01", "needs_review": False, "confidence": "high",
    }):
        client.post(
            f"/api/vaccine/{upload_token}",
            files={"file": ("cert4.jpg", b"\xff\xd8", "image/jpeg")},
        )

    vault_before = client.get("/api/vaccine-vault").json()
    entry = next((s for s in vault_before if s["client_name"] == "Vaccine Tester"), None)
    assert entry is not None, "Submission not found in vault before confirm"

    client.patch(f"/api/vaccine-vault/{entry['id']}/confirm", json={"expiry": "2028-12-01"})

    vault_after = client.get("/api/vaccine-vault").json()
    still_there = any(
        s["id"] == entry["id"] and s["status"] in ("pending", "needs_retake")
        for s in vault_after
    )
    assert not still_there, "Confirmed submission still visible in vault"


def test_confirm_nonexistent_submission_404(client):
    r = client.patch("/api/vaccine-vault/doesnotexist/confirm", json={"expiry": "2027-01-01"})
    assert r.status_code == 404


def test_vault_entries_have_required_fields(client):
    vault = client.get("/api/vaccine-vault").json()
    for entry in vault:
        for field in ("id", "client_name", "pet_name", "status", "created_at"):
            assert field in entry, f"Missing field '{field}' in vault entry"
        assert entry["status"] in ("pending", "needs_retake")
