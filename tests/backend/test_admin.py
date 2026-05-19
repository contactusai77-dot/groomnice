"""Integration tests for /api/admin/* endpoints."""

ADMIN_KEY = "admin-dev"
BAD_KEY = "wrong-key"
HEADERS_OK = {"X-Admin-Key": ADMIN_KEY}
HEADERS_BAD = {"X-Admin-Key": BAD_KEY}


# ── Key validation ────────────────────────────────────────────────────────────

def test_overview_wrong_key_403(client):
    r = client.get("/api/admin/overview", headers=HEADERS_BAD)
    assert r.status_code == 403


def test_groomers_wrong_key_403(client):
    r = client.get("/api/admin/groomers", headers=HEADERS_BAD)
    assert r.status_code == 403


def test_feedback_wrong_key_403(client):
    r = client.get("/api/admin/feedback", headers=HEADERS_BAD)
    assert r.status_code == 403


def test_overview_no_key_403(client):
    r = client.get("/api/admin/overview", headers={})
    assert r.status_code == 403


# ── Overview ──────────────────────────────────────────────────────────────────

def test_overview_returns_counts(client):
    r = client.get("/api/admin/overview", headers=HEADERS_OK)
    assert r.status_code == 200
    body = r.json()
    for field in ("total_groomers", "total_clients", "total_bookings", "total_revenue"):
        assert field in body, f"Missing '{field}'"


def test_overview_counts_are_non_negative(client):
    body = client.get("/api/admin/overview", headers=HEADERS_OK).json()
    assert body["total_groomers"] >= 1      # at least demo groomer
    assert body["total_clients"] >= 6       # seed has 6 clients
    assert body["total_bookings"] >= 7      # seed has 7 today + 10 history
    assert body["total_revenue"] >= 0.0


def test_overview_newest_groomer_present(client):
    body = client.get("/api/admin/overview", headers=HEADERS_OK).json()
    newest = body.get("newest_groomer")
    if newest is not None:
        for field in ("name", "email", "created_at"):
            assert field in newest


# ── Groomer list ──────────────────────────────────────────────────────────────

def test_groomers_returns_list(client):
    r = client.get("/api/admin/groomers", headers=HEADERS_OK)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_groomers_include_demo(client):
    groomers = client.get("/api/admin/groomers", headers=HEADERS_OK).json()
    emails = [g["email"] for g in groomers]
    assert "demo@groomnice.com" in emails


def test_groomers_have_required_fields(client):
    groomers = client.get("/api/admin/groomers", headers=HEADERS_OK).json()
    required = {"id", "name", "email", "slug", "client_count", "booking_count", "total_revenue"}
    for g in groomers:
        assert required.issubset(g.keys()), f"Missing fields in groomer row: {g}"


# ── Groomer detail ────────────────────────────────────────────────────────────

def test_groomer_detail_demo(client):
    groomers = client.get("/api/admin/groomers", headers=HEADERS_OK).json()
    demo = next(g for g in groomers if g["email"] == "demo@groomnice.com")
    r = client.get(f"/api/admin/groomers/{demo['id']}", headers=HEADERS_OK)
    assert r.status_code == 200
    body = r.json()
    assert "clients" in body
    assert "recent_bookings" in body
    assert len(body["clients"]) >= 6


def test_groomer_detail_nonexistent_404(client):
    r = client.get("/api/admin/groomers/does-not-exist-id", headers=HEADERS_OK)
    assert r.status_code == 404


def test_groomer_detail_wrong_key_403(client):
    groomers = client.get("/api/admin/groomers", headers=HEADERS_OK).json()
    demo_id = next(g["id"] for g in groomers if g["email"] == "demo@groomnice.com")
    r = client.get(f"/api/admin/groomers/{demo_id}", headers=HEADERS_BAD)
    assert r.status_code == 403


# ── Admin feedback ────────────────────────────────────────────────────────────

def test_admin_feedback_returns_list(client):
    # Submit one so the list is non-empty
    client.post("/api/feedback", json={"type": "bug", "message": "admin feedback test"})
    r = client.get("/api/admin/feedback", headers=HEADERS_OK)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_admin_feedback_entries_have_fields(client):
    entries = client.get("/api/admin/feedback", headers=HEADERS_OK).json()
    for entry in entries:
        assert "id" in entry
        assert "type" in entry
        assert "message" in entry
        assert "created_at" in entry


# ── Query-param key also works ────────────────────────────────────────────────

def test_overview_query_param_key(client):
    r = client.get(f"/api/admin/overview?admin_key={ADMIN_KEY}")
    assert r.status_code == 200
