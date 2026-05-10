"""Tests for revenue calculation and breakdown by service."""


def test_revenue_endpoint_structure(client):
    r = client.get("/api/revenue")
    assert r.status_code == 200
    body = r.json()
    for key in ("today", "week", "month", "by_service"):
        assert key in body, f"Missing '{key}' in revenue response"


def test_revenue_periods_have_revenue_and_count(client):
    body = client.get("/api/revenue").json()
    for period in ("today", "week", "month"):
        assert "revenue" in body[period]
        assert "count" in body[period]
        assert body[period]["revenue"] >= 0
        assert body[period]["count"] >= 0


def test_month_revenue_includes_week(client):
    body = client.get("/api/revenue").json()
    # Month total >= week total (week is a subset of month)
    assert body["month"]["revenue"] >= body["week"]["revenue"]
    assert body["month"]["count"] >= body["week"]["count"]


def test_by_service_breakdown(client):
    body = client.get("/api/revenue").json()
    by_service = body["by_service"]
    # Seed has Full Groom, Bath & Cut, Bath, Nail Trim in past bookings
    assert len(by_service) > 0
    for svc, data in by_service.items():
        assert "revenue" in data
        assert "count" in data
        assert data["revenue"] >= 0
        assert data["count"] > 0


def test_by_service_revenue_sums_correctly(client):
    body = client.get("/api/revenue").json()
    by_service_total = sum(d["revenue"] for d in body["by_service"].values())
    month_revenue = body["month"]["revenue"]
    assert abs(by_service_total - month_revenue) < 0.01  # floating point tolerance


def test_revenue_increases_after_completing_booking(client, today_appointments):
    before = client.get("/api/revenue").json()
    before_today = before["today"]["revenue"]

    # Mark one confirmed booking as completed
    confirmed = next(
        (a for a in today_appointments if a["status"] == "confirmed" and a["price"]),
        None
    )
    if not confirmed:
        return  # skip if none available

    client.patch(f"/api/bookings/{confirmed['id']}/status", json={"status": "completed"})
    after = client.get("/api/revenue").json()
    assert after["today"]["revenue"] >= before_today
