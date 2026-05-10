"""Tests for customer-facing routes: profile, pet management, vaccine vault."""
import pytest


@pytest.fixture(scope="module")
def token(client):
    """Create a fresh booking and return the client's intake token."""
    r = client.post("/api/bookings/quick", json={
        "phone": "555-600-0001", "client_name": "Customer Tester",
        "pet_name": "", "service_type": "Bath", "appointment_time": "12:00",
    })
    assert r.status_code == 200
    return r.json()["intake_token"]


# ── Profile ───────────────────────────────────────────────────────────────────

def test_get_profile(client, token):
    r = client.get(f"/api/profile/{token}")
    assert r.status_code == 200
    body = r.json()
    assert "client_name" in body
    assert "pets" in body
    assert body["client_name"] == "Customer Tester"


def test_get_profile_invalid_token(client):
    r = client.get("/api/profile/invalidtoken123")
    assert r.status_code == 404


def test_save_first_pet_profile(client, token):
    r = client.put(f"/api/profile/{token}", json={
        "pet_name": "Daisy", "breed": "Beagle",
        "age": "2 years", "weight": "22 lbs",
        "emergency_contact": "555-999-0000", "notes": "Shy",
    })
    assert r.status_code == 200
    assert r.json()["success"] is True

    profile = client.get(f"/api/profile/{token}").json()
    assert len(profile["pets"]) >= 1
    assert profile["pets"][0]["pet_name"] == "Daisy"
    assert profile["pets"][0]["breed"] == "Beagle"
    assert profile["pets"][0]["profile_complete"] is True


def test_add_second_pet(client, token):
    r = client.post(f"/api/profile/{token}/pets", json={
        "pet_name": "Rex", "breed": "Poodle",
        "age": "5 years", "weight": "30 lbs",
        "emergency_contact": "555-999-0000", "notes": "",
    })
    assert r.status_code == 200
    assert r.json()["success"] is True
    assert "pet_id" in r.json()

    profile = client.get(f"/api/profile/{token}").json()
    names = {p["pet_name"] for p in profile["pets"]}
    assert "Daisy" in names
    assert "Rex" in names


def test_update_specific_pet(client, token):
    profile = client.get(f"/api/profile/{token}").json()
    pet_id = next(p["id"] for p in profile["pets"] if p["pet_name"] == "Daisy")

    r = client.put(f"/api/profile/{token}/pets/{pet_id}", json={
        "pet_name": "Daisy Mae", "breed": "Beagle mix",
        "age": "3 years", "weight": "24 lbs",
        "emergency_contact": "555-999-0001", "notes": "Loves treats",
    })
    assert r.status_code == 200

    profile = client.get(f"/api/profile/{token}").json()
    updated = next(p for p in profile["pets"] if p["id"] == pet_id)
    assert updated["pet_name"] == "Daisy Mae"
    assert updated["age"] == "3 years"


def test_update_pet_wrong_token(client, token):
    profile = client.get(f"/api/profile/{token}").json()
    pet_id = profile["pets"][0]["id"]
    r = client.put(f"/api/profile/wrongtoken/pets/{pet_id}", json={
        "pet_name": "X", "breed": "", "age": "", "weight": "",
        "emergency_contact": "", "notes": "",
    })
    assert r.status_code == 404


# ── Vaccine vault ─────────────────────────────────────────────────────────────

def test_vaccine_vault_returns_list(client):
    r = client.get("/api/vaccine-vault")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_vaccine_vault_entries_have_fields(client):
    submissions = client.get("/api/vaccine-vault").json()
    for s in submissions:
        assert "id" in s
        assert "client_name" in s
        assert "pet_name" in s
        assert "status" in s


def test_seed_refreshes_data(client):
    r = client.post("/api/seed?key=testkey")
    assert r.status_code == 200
    assert r.json()["seeded"] is True

    appts = client.get("/api/appointments/today").json()
    assert len(appts) == 7  # back to seed state
