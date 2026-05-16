"""Tests for settings — service pricing, toggles, deposit amount."""

SERVICES = ["Full Groom", "Bath & Cut", "Bath", "Nail Trim", "Puppy Cut", "De-shed"]
DEFAULT_PRICES = {
    "Full Groom": 75.0, "Bath & Cut": 60.0, "Bath": 45.0,
    "Nail Trim": 20.0, "Puppy Cut": 65.0, "De-shed": 70.0,
}


def test_get_settings_returns_all_fields(client):
    r = client.get("/api/settings")
    assert r.status_code == 200
    body = r.json()
    for field in ("require_deposit", "send_24h_reminder", "send_gap_fill_text",
                  "deposit_amount", "service_prices", "working_hours"):
        assert field in body, f"Missing '{field}' in settings"


def test_working_hours_has_required_subfields(client):
    wh = client.get("/api/settings").json()["working_hours"]
    assert "days" in wh and isinstance(wh["days"], list)
    assert "start" in wh and isinstance(wh["start"], str)
    assert "end" in wh and isinstance(wh["end"], str)
    assert "slot_minutes" in wh and wh["slot_minutes"] in (30, 60)


def test_update_working_hours(client):
    original = client.get("/api/settings").json()["working_hours"]
    new_wh = {**original, "slot_minutes": 30}
    r = client.patch("/api/settings", json={"working_hours": new_wh})
    assert r.status_code == 200
    updated = client.get("/api/settings").json()["working_hours"]
    assert updated["slot_minutes"] == 30
    # Restore
    client.patch("/api/settings", json={"working_hours": original})


def test_service_prices_has_all_services(client):
    prices = client.get("/api/settings").json()["service_prices"]
    for svc in SERVICES:
        assert svc in prices, f"Missing price for '{svc}'"
        assert prices[svc] > 0


def test_service_prices_match_defaults(client):
    prices = client.get("/api/settings").json()["service_prices"]
    for svc, expected in DEFAULT_PRICES.items():
        assert prices[svc] == expected, f"{svc}: expected {expected}, got {prices[svc]}"


def test_update_service_price(client):
    new_prices = {**DEFAULT_PRICES, "Full Groom": 85.0}
    r = client.patch("/api/settings", json={"service_prices": new_prices})
    assert r.status_code == 200

    updated = client.get("/api/settings").json()
    assert updated["service_prices"]["Full Groom"] == 85.0

    # Restore
    client.patch("/api/settings", json={"service_prices": DEFAULT_PRICES})


def test_update_deposit_amount(client):
    r = client.patch("/api/settings", json={"deposit_amount": 50.0})
    assert r.status_code == 200
    assert client.get("/api/settings").json()["deposit_amount"] == 50.0
    client.patch("/api/settings", json={"deposit_amount": 25.0})


def test_toggle_require_deposit(client):
    original = client.get("/api/settings").json()["require_deposit"]
    client.patch("/api/settings", json={"require_deposit": not original})
    assert client.get("/api/settings").json()["require_deposit"] == (not original)
    client.patch("/api/settings", json={"require_deposit": original})


def test_new_booking_price_reflects_settings(client):
    # Set Bath to $99
    prices = client.get("/api/settings").json()["service_prices"]
    client.patch("/api/settings", json={"service_prices": {**prices, "Bath": 99.0}})

    r = client.post("/api/bookings/quick", json={
        "phone": "555-700-1234", "client_name": "Price Check",
        "pet_name": "Spot", "service_type": "Bath", "appointment_time": "16:00",
    })
    assert r.status_code == 200

    appts = client.get("/api/appointments/today").json()
    appt = next((a for a in appts if a["client_name"] == "Price Check"), None)
    assert appt is not None
    assert appt["price"] == 99.0

    # Restore
    client.patch("/api/settings", json={"service_prices": {**prices, "Bath": 45.0}})
