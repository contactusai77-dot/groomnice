"""Tests for booking creation, status updates, today's view, and history."""
import pytest


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_today_appointments_returns_list(today_appointments):
    assert isinstance(today_appointments, list)
    assert len(today_appointments) == 7


def test_today_appointments_have_required_fields(today_appointments):
    required = {"id", "appointment_date", "service_type", "status", "price",
                "client_name", "client_phone", "pet_name", "vaccine_ok",
                "deposit_ok", "ready", "profile_complete"}
    for appt in today_appointments:
        assert required.issubset(appt.keys()), f"Missing fields in {appt}"


def test_today_appointments_sorted_by_time(today_appointments):
    dates = [a["appointment_date"] for a in today_appointments if a["appointment_date"]]
    assert dates == sorted(dates)


def test_today_appointments_prices_set(today_appointments):
    for appt in today_appointments:
        assert appt["price"] is not None, f"Missing price on {appt['service_type']}"
        assert appt["price"] > 0


def test_today_ready_flags(today_appointments):
    jane_biscuit = next(a for a in today_appointments if a["pet_name"] == "Biscuit")
    assert jane_biscuit["vaccine_ok"] is True
    assert jane_biscuit["deposit_ok"] is True
    assert jane_biscuit["ready"] is True

    marco_luna = next(a for a in today_appointments if a["pet_name"] == "Luna")
    assert marco_luna["vaccine_ok"] is False  # expired vaccine
    assert marco_luna["ready"] is False


def test_quick_booking_creates_new_client(client):
    r = client.post("/api/bookings/quick", json={
        "phone": "555-800-0001",
        "client_name": "New Client",
        "pet_name": "Fluffy",
        "service_type": "Bath",
        "appointment_time": "11:00",
    })
    assert r.status_code == 200
    body = r.json()
    assert "booking_id" in body
    assert "intake_token" in body


def test_quick_booking_auto_sets_price(client):
    r = client.post("/api/bookings/quick", json={
        "phone": "555-800-0002",
        "client_name": "Price Test",
        "pet_name": "Max",
        "service_type": "Full Groom",
        "appointment_time": "14:00",
    })
    assert r.status_code == 200
    # Verify the created booking has price = 75.0
    appts = client.get("/api/appointments/today").json()
    new_appt = next((a for a in appts if a["client_name"] == "Price Test"), None)
    assert new_appt is not None
    assert new_appt["price"] == 75.0


def test_quick_booking_existing_client_reuses(client, jane):
    r = client.post("/api/bookings/quick", json={
        "phone": jane["phone"],
        "client_name": jane["name"],
        "pet_name": "Biscuit",
        "service_type": "Nail Trim",
        "appointment_time": "08:00",
    })
    assert r.status_code == 200
    assert r.json()["intake_token"] == jane["intake_token"]


def test_update_booking_status(client, today_appointments):
    booking_id = today_appointments[0]["id"]
    r = client.patch(f"/api/bookings/{booking_id}/status", json={"status": "in_progress"})
    assert r.status_code == 200
    assert r.json()["success"] is True

    updated = client.get("/api/appointments/today").json()
    updated_appt = next(a for a in updated if a["id"] == booking_id)
    assert updated_appt["status"] == "in_progress"


def test_update_booking_status_to_completed(client, today_appointments):
    booking_id = today_appointments[0]["id"]
    r = client.patch(f"/api/bookings/{booking_id}/status", json={"status": "completed"})
    assert r.status_code == 200


def test_update_booking_status_nonexistent(client):
    r = client.patch("/api/bookings/doesnotexist/status", json={"status": "completed"})
    assert r.status_code == 404


def test_history_returns_past_appointments(client):
    r = client.get("/api/appointments/history")
    assert r.status_code == 200
    history = r.json()
    assert len(history) >= 10  # seed has 10 past bookings
    for appt in history:
        assert appt["status"] == "completed"


def test_history_sorted_descending(client):
    history = client.get("/api/appointments/history").json()
    dates = [a["appointment_date"] for a in history if a["appointment_date"]]
    assert dates == sorted(dates, reverse=True)


def test_history_search_by_client_name(client):
    r = client.get("/api/appointments/history?q=Jane")
    assert r.status_code == 200
    results = r.json()
    assert len(results) > 0
    for appt in results:
        assert "jane" in appt["client_name"].lower()


def test_history_search_no_match(client):
    r = client.get("/api/appointments/history?q=zzznomatch")
    assert r.status_code == 200
    assert r.json() == []


def test_history_days_filter(client):
    r7 = client.get("/api/appointments/history?days=5")
    r60 = client.get("/api/appointments/history?days=60")
    assert len(r7.json()) <= len(r60.json())
