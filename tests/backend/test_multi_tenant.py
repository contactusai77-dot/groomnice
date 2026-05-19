"""
Multi-tenant isolation tests.

Verifies that groomer B cannot read or mutate groomer A's data through any endpoint.
"""
import pytest


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── Setup: give groomer B some data to test with ──────────────────────────────

@pytest.fixture(scope="module")
def groomer_b_booking(client, groomer_b):
    """Create a booking under groomer B and return its ID."""
    tok = groomer_b["token"]
    r = client.post("/api/bookings/quick",
                    headers=_auth(tok),
                    json={"phone": "555-MT-0001", "client_name": "B Client",
                          "pet_name": "B Dog", "service_type": "Bath", "appointment_time": "10:00"})
    assert r.status_code == 200, f"groomer_b quick-book failed: {r.text}"
    return r.json()["booking_id"]


@pytest.fixture(scope="module")
def groomer_b_client_id(client, groomer_b):
    """Return the client ID created under groomer B."""
    tok = groomer_b["token"]
    clients = client.get("/api/clients", headers=_auth(tok)).json()
    return clients[0]["id"] if clients else None


@pytest.fixture(scope="module")
def groomer_b_waitlist_id(client, groomer_b):
    """Create a waitlist entry for groomer B and return its ID."""
    tok = groomer_b["token"]
    r = client.post("/api/waitlist", headers=_auth(tok),
                    json={"phone": "555-MT-0099", "name": "B Waiter"})
    assert r.status_code == 200
    return r.json()["id"]


# ── Appointment isolation ─────────────────────────────────────────────────────

def test_groomer_a_cannot_see_groomer_b_appointments(client, groomer_b_booking):
    """Groomer A's today endpoint must not include groomer B's bookings."""
    appts = client.get("/api/appointments/today").json()
    ids = [a["id"] for a in appts]
    assert groomer_b_booking not in ids


def test_groomer_a_cannot_update_groomer_b_booking(client, groomer_b_booking):
    """PATCH booking/{id}/status as groomer A on groomer B's booking must return 404."""
    r = client.patch(f"/api/bookings/{groomer_b_booking}/status",
                     json={"status": "completed"})
    assert r.status_code == 404


# ── Client isolation ──────────────────────────────────────────────────────────

def test_groomer_a_cannot_see_groomer_b_clients(client, groomer_b_client_id):
    """Groomer A's /clients list must not include groomer B's clients."""
    clients = client.get("/api/clients").json()
    ids = [c["id"] for c in clients]
    assert groomer_b_client_id not in ids


def test_groomer_a_cannot_edit_groomer_b_client(client, groomer_b_client_id):
    """PATCH /clients/{id} as groomer A on groomer B's client must return 404."""
    if groomer_b_client_id is None:
        pytest.skip("No groomer B client available")
    r = client.patch(f"/api/clients/{groomer_b_client_id}",
                     json={"name": "Hacked", "phone": "555-000-0000"})
    assert r.status_code == 404


# ── Waitlist isolation ────────────────────────────────────────────────────────

def test_groomer_a_cannot_see_groomer_b_waitlist(client, groomer_b, groomer_b_waitlist_id):
    """Groomer A's /waitlist must not include groomer B's entries."""
    entries = client.get("/api/waitlist").json()
    ids = [e["id"] for e in entries]
    assert groomer_b_waitlist_id not in ids


def test_groomer_a_cannot_delete_groomer_b_waitlist_entry(client, groomer_b_waitlist_id):
    """DELETE /waitlist/{id} as groomer A on groomer B's entry must return 404."""
    r = client.delete(f"/api/waitlist/{groomer_b_waitlist_id}")
    assert r.status_code == 404


# ── Revenue isolation ─────────────────────────────────────────────────────────

def test_revenue_scoped_to_authenticated_groomer(client, groomer_b):
    """Groomer B's revenue must not include groomer A (demo)'s completed bookings."""
    tok = groomer_b["token"]
    rev_b = client.get("/api/revenue", headers=_auth(tok)).json()
    rev_demo = client.get("/api/revenue").json()
    # Groomer B has no completed bookings — revenue must be $0
    assert rev_b["month"]["revenue"] == 0.0
    # Demo has completed bookings (seeded)
    assert rev_demo["month"]["revenue"] > 0.0


# ── Settings isolation ────────────────────────────────────────────────────────

def test_settings_scoped_to_groomer(client, groomer_b):
    """Updating groomer B's settings must not affect groomer A's settings."""
    tok = groomer_b["token"]
    original_a = client.get("/api/settings").json()

    client.patch("/api/settings", headers=_auth(tok),
                 json={"deposit_amount": 9999.0})

    settings_a_after = client.get("/api/settings").json()
    assert settings_a_after["deposit_amount"] == original_a["deposit_amount"]
