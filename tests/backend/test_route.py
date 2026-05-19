"""Integration tests for GET /api/route/today."""


def test_route_returns_stops_and_metadata(client):
    r = client.get("/api/route/today")
    assert r.status_code == 200
    body = r.json()
    assert "stops" in body
    assert "has_locations" in body
    assert "geo_count" in body
    assert isinstance(body["stops"], list)
    assert isinstance(body["geo_count"], int)


def test_route_stops_have_required_fields(client, today_appointments):
    body = client.get("/api/route/today").json()
    required = {"booking_id", "client_name", "client_phone", "pet_name",
                "service_type", "appointment_date", "status", "address"}
    for stop in body["stops"]:
        assert required.issubset(stop.keys()), f"Stop missing fields: {stop}"


def test_route_stops_count_matches_today_appointments(client, today_appointments):
    """Route must include at least all seeded non-cancelled bookings."""
    route = client.get("/api/route/today").json()
    seed_active = [a for a in today_appointments if a["status"] not in ("declined", "cancelled")]
    # Other tests may add bookings during the session — route count can only grow
    assert len(route["stops"]) >= len(seed_active)


def test_route_excludes_cancelled_bookings(client):
    """Bookings cancelled today must not appear in the route."""
    # Create and immediately cancel a booking
    r = client.post("/api/bookings/quick", json={
        "phone": "555-500-0001", "client_name": "Route Cancel",
        "pet_name": "Dog", "service_type": "Bath", "appointment_time": "08:30",
    })
    assert r.status_code == 200
    bid = r.json()["booking_id"]
    client.patch(f"/api/bookings/{bid}/status", json={"status": "cancelled"})

    route = client.get("/api/route/today").json()
    booking_ids = [s["booking_id"] for s in route["stops"]]
    assert bid not in booking_ids, "Cancelled booking should not appear in route"


def test_route_stops_sorted_by_time(client):
    """Stops without geocoordinates must be returned in appointment-time order."""
    route = client.get("/api/route/today").json()
    times = [s["appointment_date"] for s in route["stops"] if s["appointment_date"]]
    # Without geo data, nearest-neighbour doesn't reorder — stays chronological
    if not route["has_locations"]:
        assert times == sorted(times)


def test_route_geo_count_is_non_negative(client):
    body = client.get("/api/route/today").json()
    assert body["geo_count"] >= 0
    assert body["geo_count"] <= len(body["stops"])
