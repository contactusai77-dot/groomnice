"""
Integration tests for public online booking:
  slot enumeration, booking creation, duplicate-slot guard, working-hours guard.
"""
import pytest
from datetime import date, timedelta

DEMO_SLUG = "demo"


# ── Slot endpoint ─────────────────────────────────────────────────────────────

def test_get_slots_returns_list(client):
    r = client.get(f"/api/book/{DEMO_SLUG}/slots")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_get_slots_nonexistent_slug_404(client):
    r = client.get("/api/book/no-such-slug-xyz-9999/slots")
    assert r.status_code == 404


def test_slots_structure(client):
    slots = client.get(f"/api/book/{DEMO_SLUG}/slots").json()
    for day in slots:
        assert "date" in day
        assert "day_name" in day
        assert "slots" in day
        assert isinstance(day["slots"], list)


def test_slots_within_working_hours(client):
    """All returned slots must start within the groomer's working window."""
    original = client.get("/api/settings").json()["working_hours"]
    client.patch("/api/settings", json={"working_hours": {
        **original, "start": "09:00", "end": "17:00", "days": [0, 1, 2, 3, 4, 5, 6],
    }})
    slots = client.get(f"/api/book/{DEMO_SLUG}/slots").json()
    for day in slots:
        for slot in day["slots"]:
            h = int(slot.split(":")[0])
            assert 9 <= h < 17, f"Slot {slot} on {day['date']} outside 09:00-17:00"
    client.patch("/api/settings", json={"working_hours": original})


def test_slot_count_matches_window(client):
    """09:00-11:00 with 60-min slots should yield exactly 2 slots per day."""
    original = client.get("/api/settings").json()["working_hours"]
    client.patch("/api/settings", json={"working_hours": {
        "days": [0, 1, 2, 3, 4, 5, 6], "start": "09:00", "end": "11:00", "slot_minutes": 60,
    }})
    slots = client.get(f"/api/book/{DEMO_SLUG}/slots").json()
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    tmrw = next((d for d in slots if d["date"] == tomorrow), None)
    if tmrw:
        assert len(tmrw["slots"]) == 2, f"Expected 2 slots, got {tmrw['slots']}"
    client.patch("/api/settings", json={"working_hours": original})


def test_last_slot_ends_before_window_end(client):
    """For 09:00-11:00 60-min slots, last slot is 10:00, not 11:00."""
    original = client.get("/api/settings").json()["working_hours"]
    client.patch("/api/settings", json={"working_hours": {
        "days": [0, 1, 2, 3, 4, 5, 6], "start": "09:00", "end": "11:00", "slot_minutes": 60,
    }})
    slots = client.get(f"/api/book/{DEMO_SLUG}/slots").json()
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    tmrw = next((d for d in slots if d["date"] == tomorrow), None)
    if tmrw:
        assert "11:00" not in tmrw["slots"]
        assert "10:00" in tmrw["slots"]
    client.patch("/api/settings", json={"working_hours": original})


# ── Online booking creation ───────────────────────────────────────────────────

def test_online_booking_nonexistent_slug_404(client):
    r = client.post("/api/book/no-such-slug-xyz", json={
        "phone": "555-111-2222", "name": "Test",
        "pet_name": "Dog", "service_type": "Bath",
        "slot_date": "2026-06-01", "slot_time": "10:00",
    })
    assert r.status_code == 404


def test_online_booking_returns_pending_review(client):
    """Customer bookings must start as pending_review, not confirmed."""
    slots = client.get(f"/api/book/{DEMO_SLUG}/slots").json()
    if not slots:
        pytest.skip("No available slots")
    day = slots[0]
    slot = day["slots"][0]

    r = client.post(f"/api/book/{DEMO_SLUG}", json={
        "phone": "555-700-8801", "name": "Online Tester",
        "pet_name": "Doggo", "service_type": "Bath",
        "slot_date": day["date"], "slot_time": slot,
    })
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "pending_review"
    assert "booking_id" in body
    assert "intake_token" in body


def test_online_booking_invalid_date_400(client):
    r = client.post(f"/api/book/{DEMO_SLUG}", json={
        "phone": "555-700-8899", "name": "Test",
        "pet_name": "Dog", "service_type": "Bath",
        "slot_date": "not-a-date", "slot_time": "10:00",
    })
    assert r.status_code == 400


def test_duplicate_slot_rejected_409(client):
    """Booking an already-taken slot must return 409."""
    original = client.get("/api/settings").json()["working_hours"]
    client.patch("/api/settings", json={"working_hours": {
        "days": [0, 1, 2, 3, 4, 5, 6], "start": "08:00", "end": "20:00", "slot_minutes": 60,
    }})

    target_date = (date.today() + timedelta(days=6)).isoformat()
    r1 = client.post(f"/api/book/{DEMO_SLUG}", json={
        "phone": "555-700-9901", "name": "First",
        "pet_name": "Dog", "service_type": "Bath",
        "slot_date": target_date, "slot_time": "08:00",
    })
    assert r1.status_code == 200

    r2 = client.post(f"/api/book/{DEMO_SLUG}", json={
        "phone": "555-700-9902", "name": "Second",
        "pet_name": "Cat", "service_type": "Bath",
        "slot_date": target_date, "slot_time": "08:00",
    })
    assert r2.status_code == 409
    client.patch("/api/settings", json={"working_hours": original})


def test_booked_slot_removed_from_available(client):
    """After a booking, that slot must no longer appear in /slots."""
    original = client.get("/api/settings").json()["working_hours"]
    client.patch("/api/settings", json={"working_hours": {
        "days": [0, 1, 2, 3, 4, 5, 6], "start": "08:00", "end": "20:00", "slot_minutes": 60,
    }})
    target_date = (date.today() + timedelta(days=7)).isoformat()

    client.post(f"/api/book/{DEMO_SLUG}", json={
        "phone": "555-700-9910", "name": "Blocker",
        "pet_name": "Dog", "service_type": "Bath",
        "slot_date": target_date, "slot_time": "15:00",
    })

    slots_after = client.get(f"/api/book/{DEMO_SLUG}/slots").json()
    day_after = next((d for d in slots_after if d["date"] == target_date), None)
    taken = day_after and "15:00" in day_after.get("slots", [])
    assert not taken, "Booked slot 15:00 should not appear in available slots"
    client.patch("/api/settings", json={"working_hours": original})


# ── Working-hours guard rails ─────────────────────────────────────────────────

def test_off_day_booking_rejected(client):
    """Booking on a non-working day must be rejected with 400."""
    original = client.get("/api/settings").json()["working_hours"]
    # Only Tuesdays (1)
    client.patch("/api/settings", json={"working_hours": {**original, "days": [1]}})

    saturday = date.today()
    while saturday.weekday() != 5:
        saturday += timedelta(days=1)

    r = client.post(f"/api/book/{DEMO_SLUG}", json={
        "phone": "555-700-9920", "name": "Off Day",
        "pet_name": "Dog", "service_type": "Bath",
        "slot_date": saturday.isoformat(), "slot_time": "10:00",
    })
    assert r.status_code in (400, 409)
    client.patch("/api/settings", json={"working_hours": original})


def test_out_of_hours_booking_rejected(client):
    """Booking at 23:00 when window ends at 17:00 must be rejected."""
    original = client.get("/api/settings").json()["working_hours"]
    client.patch("/api/settings", json={"working_hours": {
        **original, "start": "09:00", "end": "17:00", "days": [0, 1, 2, 3, 4, 5, 6],
    }})

    future_date = (date.today() + timedelta(days=8)).isoformat()
    r = client.post(f"/api/book/{DEMO_SLUG}", json={
        "phone": "555-700-9930", "name": "Night Owl",
        "pet_name": "Dog", "service_type": "Bath",
        "slot_date": future_date, "slot_time": "23:00",
    })
    assert r.status_code in (400, 409)
    client.patch("/api/settings", json={"working_hours": original})
