"""Tests for client list, edit client, and edit pet (groomer-facing)."""


def test_get_clients_returns_list(client):
    r = client.get("/api/clients")
    assert r.status_code == 200
    clients = r.json()
    assert len(clients) >= 6


def test_clients_have_required_fields(client):
    clients = client.get("/api/clients").json()
    required = {"id", "name", "phone", "intake_token", "pets", "vaccine_ok", "last_visit"}
    for c in clients:
        assert required.issubset(c.keys())


def test_jane_has_two_pets(jane):
    assert len(jane["pets"]) == 2
    pet_names = {p["pet_name"] for p in jane["pets"]}
    assert "Biscuit" in pet_names
    assert "Pepper" in pet_names


def test_vaccine_ok_reflects_expiry(client):
    clients = client.get("/api/clients").json()
    marco = next(c for c in clients if c["name"] == "Marco Rivera")
    # Marco's vaccine expired in 2025
    assert marco["vaccine_ok"] is False

    tom = next(c for c in clients if c["name"] == "Tom Bradley")
    assert tom["vaccine_ok"] is True


def test_edit_client_name_and_phone(client, first_client):
    r = client.patch(f"/api/clients/{first_client['id']}", json={
        "name": "Updated Name",
        "phone": "555-123-9999",
    })
    assert r.status_code == 200
    assert r.json()["success"] is True

    updated = client.get("/api/clients").json()
    match = next((c for c in updated if c["id"] == first_client["id"]), None)
    assert match is not None
    assert match["name"] == "Updated Name"


def test_edit_client_nonexistent(client):
    r = client.patch("/api/clients/doesnotexist", json={"name": "X", "phone": "555-000"})
    assert r.status_code == 404


def test_edit_pet_groomer(client, jane):
    pet_id = jane["pets"][0]["id"]
    r = client.patch(f"/api/pets/{pet_id}", json={
        "pet_name": "Biscuit Jr.",
        "breed": "Golden",
        "age": "4 years",
        "weight": "60 lbs",
        "notes": "Loves baths",
    })
    assert r.status_code == 200
    assert r.json()["success"] is True

    updated_clients = client.get("/api/clients").json()
    updated_jane = next(c for c in updated_clients if "Jane" in c["name"])
    updated_pet = next(p for p in updated_jane["pets"] if p["id"] == pet_id)
    assert updated_pet["pet_name"] == "Biscuit Jr."
    assert updated_pet["age"] == "4 years"


def test_edit_pet_nonexistent(client):
    r = client.patch("/api/pets/doesnotexist", json={
        "pet_name": "X", "breed": "", "age": "", "weight": "", "notes": ""
    })
    assert r.status_code == 404
