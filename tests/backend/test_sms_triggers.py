"""
Tests for automatic SMS triggers: vaccine reminder on booking confirm,
and gap fill notification on cancellation.

SMS functions are mocked — these tests verify the *trigger logic*, not Twilio delivery.
"""
from unittest.mock import patch


# ── Helpers ────────────────────────────────────────────────────────────────────

def _make_booking(client, phone, name="SMS Test", pet="TestDog", service="Bath", time="16:30"):
    r = client.post("/api/bookings/quick", json={
        "phone": phone, "client_name": name,
        "pet_name": pet, "service_type": service, "appointment_time": time,
    })
    assert r.status_code == 200
    return r.json()["booking_id"]


def _all_7_days():
    return {"days": [0, 1, 2, 3, 4, 5, 6], "start": "09:00", "end": "17:00", "slot_minutes": 60}


# ── Vaccine reminder ────────────────────────────────────────────────────────────

def test_confirm_missing_vaccine_sends_reminder(client):
    """New client has no vaccine on file — confirming the booking sends a reminder."""
    booking_id = _make_booking(client, "555-300-0001", name="No Vax Client", pet="NovaxDog")

    with patch("main.send_vaccine_reminder") as mock_sms:
        r = client.patch(f"/api/bookings/{booking_id}/status", json={"status": "confirmed"})
        assert r.status_code == 200
        mock_sms.assert_called_once()
        args, kwargs = mock_sms.call_args
        # expired=False because pet has no rabies_expiry at all (missing, not expired)
        expired_arg = kwargs.get("expired", args[3] if len(args) > 3 else None)
        assert expired_arg is False


def test_confirm_expired_vaccine_sends_expired_flag(client, today_appointments):
    """Marco Rivera / Luna has an expired vaccine — reminder must use expired=True."""
    luna = next((a for a in today_appointments if a["pet_name"] == "Luna"), None)
    if luna is None:
        import pytest; pytest.skip("Luna not in seed data")

    with patch("main.send_vaccine_reminder") as mock_sms:
        client.patch(f"/api/bookings/{luna['id']}/status", json={"status": "confirmed"})
        mock_sms.assert_called_once()
        args, kwargs = mock_sms.call_args
        expired_arg = kwargs.get("expired", args[3] if len(args) > 3 else None)
        assert expired_arg is True


def test_confirm_valid_vaccine_no_reminder(client):
    """Pet with a future rabies expiry must NOT trigger a vaccine reminder on confirm."""
    booking_id = _make_booking(client, "555-300-9900", name="Valid Vax Owner", pet="HealthyPup")

    # Find the freshly-created pet and give it a known future vaccine expiry
    clients = client.get("/api/clients").json()
    vax_client = next((c for c in clients if c["name"] == "Valid Vax Owner"), None)
    if vax_client and vax_client.get("pets"):
        pet_id = vax_client["pets"][0]["id"]
        client.patch(f"/api/pets/{pet_id}", json={
            "pet_name": "HealthyPup", "breed": "Retriever",
            "age": "2 years", "weight": "40 lbs",
            "notes": "", "temperament": "friendly",
            "rabies_expiry": "2099-01-01",
        })

    with patch("main.send_vaccine_reminder") as mock_sms:
        client.patch(f"/api/bookings/{booking_id}/status", json={"status": "confirmed"})
        mock_sms.assert_not_called()


def test_non_confirm_status_no_vaccine_reminder(client):
    """Changing status to in_progress must never trigger a vaccine reminder."""
    booking_id = _make_booking(client, "555-300-0002", name="In Progress Client", pet="IPDog")

    with patch("main.send_vaccine_reminder") as mock_sms:
        client.patch(f"/api/bookings/{booking_id}/status", json={"status": "in_progress"})
        mock_sms.assert_not_called()


# ── Gap fill notification ───────────────────────────────────────────────────────

def test_cancel_with_waitlist_sends_gap_notification(client):
    """Cancelling a booking when gap fill is on and waitlist has entries fires the SMS."""
    client.patch("/api/settings", json={
        "send_gap_fill_text": True,
        "working_hours": _all_7_days(),
    })
    add_r = client.post("/api/waitlist", json={"phone": "555-301-0001", "name": "Gap Watcher"})
    entry_id = add_r.json()["id"]

    booking_id = _make_booking(client, "555-301-0010", name="Cancel Me", pet="CancelDog")

    try:
        with patch("main.send_gap_notification") as mock_sms:
            r = client.patch(f"/api/bookings/{booking_id}/status", json={"status": "cancelled"})
            assert r.status_code == 200
            mock_sms.assert_called_once()
            args, _ = mock_sms.call_args
            assert args[1] == "Gap Watcher"
            assert isinstance(args[2], list) and len(args[2]) > 0
    finally:
        client.delete(f"/api/waitlist/{entry_id}")


def test_cancel_gap_fill_disabled_no_notification(client):
    """When send_gap_fill_text is False, cancellation must NOT trigger SMS."""
    client.patch("/api/settings", json={
        "send_gap_fill_text": False,
        "working_hours": _all_7_days(),
    })
    add_r = client.post("/api/waitlist", json={"phone": "555-301-0002", "name": "Silent Watcher"})
    entry_id = add_r.json()["id"]

    booking_id = _make_booking(client, "555-301-0020", name="Silent Cancel", pet="SilentDog")

    try:
        with patch("main.send_gap_notification") as mock_sms:
            client.patch(f"/api/bookings/{booking_id}/status", json={"status": "cancelled"})
            mock_sms.assert_not_called()
    finally:
        client.delete(f"/api/waitlist/{entry_id}")
        client.patch("/api/settings", json={"send_gap_fill_text": True})


def test_cancel_empty_waitlist_no_notification(client):
    """No waitlist entries means gap fill SMS must not fire at all."""
    # Clear all waitlist entries
    for e in client.get("/api/waitlist").json():
        client.delete(f"/api/waitlist/{e['id']}")

    client.patch("/api/settings", json={
        "send_gap_fill_text": True,
        "working_hours": _all_7_days(),
    })

    booking_id = _make_booking(client, "555-301-0030", name="Empty Waitlist Client", pet="EmptyDog")

    with patch("main.send_gap_notification") as mock_sms:
        client.patch(f"/api/bookings/{booking_id}/status", json={"status": "cancelled"})
        mock_sms.assert_not_called()


def test_gap_notification_includes_multiple_waitlist_entries(client):
    """Every waitlist entry gets its own SMS call when a slot opens."""
    client.patch("/api/settings", json={
        "send_gap_fill_text": True,
        "working_hours": _all_7_days(),
    })

    entry_ids = []
    for i in range(3):
        r = client.post("/api/waitlist", json={"phone": f"555-301-010{i}", "name": f"Waiter {i}"})
        entry_ids.append(r.json()["id"])

    booking_id = _make_booking(client, "555-301-0040", name="Multi Notify", pet="MultiDog")

    try:
        with patch("main.send_gap_notification") as mock_sms:
            client.patch(f"/api/bookings/{booking_id}/status", json={"status": "cancelled"})
            assert mock_sms.call_count == 3
    finally:
        for eid in entry_ids:
            client.delete(f"/api/waitlist/{eid}")
