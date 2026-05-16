"""Tests for the gap fill waitlist CRUD endpoints."""


def test_get_waitlist_returns_list(client):
    r = client.get("/api/waitlist")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_add_waitlist_entry(client):
    r = client.post("/api/waitlist", json={"phone": "555-201-0001", "name": "Waitlist Jane"})
    assert r.status_code == 200
    body = r.json()
    assert "id" in body
    assert body["phone"] == "555-201-0001"
    assert body["name"] == "Waitlist Jane"
    client.delete(f"/api/waitlist/{body['id']}")


def test_get_waitlist_includes_added_entry(client):
    r = client.post("/api/waitlist", json={"phone": "555-201-0002", "name": "Listed Bob"})
    entry_id = r.json()["id"]

    entries = client.get("/api/waitlist").json()
    phones = [e["phone"] for e in entries]
    assert "555-201-0002" in phones
    client.delete(f"/api/waitlist/{entry_id}")


def test_waitlist_entries_have_required_fields(client):
    r = client.post("/api/waitlist", json={"phone": "555-201-0003", "name": "Fields Check"})
    entry_id = r.json()["id"]

    entries = client.get("/api/waitlist").json()
    entry = next(e for e in entries if e["id"] == entry_id)
    assert {"id", "phone", "name"}.issubset(entry.keys())
    client.delete(f"/api/waitlist/{entry_id}")


def test_delete_waitlist_entry(client):
    add_r = client.post("/api/waitlist", json={"phone": "555-201-0099", "name": "Del Me"})
    entry_id = add_r.json()["id"]

    del_r = client.delete(f"/api/waitlist/{entry_id}")
    assert del_r.status_code == 200
    assert del_r.json()["success"] is True

    ids = [e["id"] for e in client.get("/api/waitlist").json()]
    assert entry_id not in ids


def test_delete_waitlist_nonexistent(client):
    r = client.delete("/api/waitlist/doesnotexist")
    assert r.status_code == 404


def test_multiple_entries_all_returned(client):
    ids = []
    for i in range(3):
        r = client.post("/api/waitlist", json={"phone": f"555-201-010{i}", "name": f"Entry {i}"})
        ids.append(r.json()["id"])

    entries = client.get("/api/waitlist").json()
    entry_ids = [e["id"] for e in entries]
    for eid in ids:
        assert eid in entry_ids

    for eid in ids:
        client.delete(f"/api/waitlist/{eid}")
