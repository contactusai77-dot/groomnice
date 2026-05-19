"""
Tests for booking status field validation.

The StatusUpdate schema rejects any value not in the allowed set.
All valid transitions are also exercised.
"""
import pytest

VALID_STATUSES = [
    "pending_payment", "confirmed", "in_progress",
    "completed", "cancelled", "declined", "pending_review",
]

INVALID_STATUSES = [
    "done", "canceled",  # US spelling without double-l
    "CONFIRMED",         # wrong case
    "complete",
    "",
    "random_string",
    "null",
]


@pytest.fixture(scope="module")
def booking_id(client):
    r = client.post("/api/bookings/quick", json={
        "phone": "555-SV-0001", "client_name": "Status Val",
        "pet_name": "Dog", "service_type": "Bath", "appointment_time": "08:00",
    })
    assert r.status_code == 200
    return r.json()["booking_id"]


@pytest.mark.parametrize("status", VALID_STATUSES)
def test_valid_status_accepted(client, booking_id, status):
    r = client.patch(f"/api/bookings/{booking_id}/status", json={"status": status})
    assert r.status_code == 200, f"Valid status '{status}' rejected: {r.text}"


@pytest.mark.parametrize("status", INVALID_STATUSES)
def test_invalid_status_rejected_422(client, booking_id, status):
    r = client.patch(f"/api/bookings/{booking_id}/status", json={"status": status})
    assert r.status_code == 422, f"Invalid status '{status}' should be rejected but got {r.status_code}"


def test_status_transition_full_lifecycle(client):
    """confirmed -> in_progress -> completed is the happy path."""
    r = client.post("/api/bookings/quick", json={
        "phone": "555-SV-0010", "client_name": "Lifecycle Client",
        "pet_name": "Rex", "service_type": "Full Groom", "appointment_time": "09:00",
    })
    bid = r.json()["booking_id"]

    for status in ("confirmed", "in_progress", "completed"):
        patch_r = client.patch(f"/api/bookings/{bid}/status", json={"status": status})
        assert patch_r.status_code == 200, f"Transition to '{status}' failed"

    today = client.get("/api/appointments/today").json()
    final = next((a for a in today if a["id"] == bid), None)
    assert final is not None
    assert final["status"] == "completed"
    assert final["deposit_ok"] is True  # completed counts as deposit_ok


def test_status_missing_field_422(client, booking_id):
    r = client.patch(f"/api/bookings/{booking_id}/status", json={})
    assert r.status_code == 422


def test_status_wrong_type_422(client, booking_id):
    r = client.patch(f"/api/bookings/{booking_id}/status", json={"status": 42})
    assert r.status_code == 422
