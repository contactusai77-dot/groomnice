"""
Integration tests for CSV import: preview and apply.
"""
import io


def _csv(*rows: str) -> bytes:
    return "\n".join(rows).encode()


GOOD_CSV = _csv(
    "Owner Name,Phone,Pet,Breed,Rabies Exp,Notes",
    "Jane Import,5551234500,Buddy,Poodle,04/2027,friendly",
    "Tom Import,5551234501,Rex,Lab,2027-01-01,",
)

BAD_PHONE_CSV = _csv(
    "Owner Name,Phone,Pet",
    "Alice,123,Dog",          # too short
    "Bob,,Cat",               # empty phone
    "Carol,5551234502,Fish",  # good row
)

DUP_PHONE_CSV = _csv(
    "Name,Phone,Pet",
    "First,5551239900,Dog",
    "Second,5551239900,Cat",  # same number
)

BAD_DATE_CSV = _csv(
    "Name,Phone,Pet,Rabies Exp",
    "Dave,5551239910,Dog,TBD",         # unparseable date
    "Eve,5551239911,Cat,not-a-date",   # also bad
)

NO_PHONE_COLUMN_CSV = _csv(
    "Name,Pet",
    "Frank,Dog",
)


def _preview(client, csv_bytes: bytes):
    return client.post(
        "/api/import/preview",
        files={"file": ("test.csv", io.BytesIO(csv_bytes), "text/csv")},
    )


def _apply(client, rows, mapping):
    return client.post("/api/import/apply", json={"rows": rows, "mapping": mapping})


# ── Preview ───────────────────────────────────────────────────────────────────

def test_preview_returns_columns_and_rows(client):
    r = _preview(client, GOOD_CSV)
    assert r.status_code == 200
    body = r.json()
    assert "columns" in body
    assert "total_rows" in body
    assert "sample_rows" in body
    assert "suggested_mapping" in body
    assert body["total_rows"] == 2
    assert len(body["sample_rows"]) == 2


def test_preview_suggested_mapping_identifies_phone(client):
    r = _preview(client, GOOD_CSV)
    mapping = r.json()["suggested_mapping"]
    assert "client_phone" in mapping.values(), f"phone not mapped: {mapping}"


def test_preview_bad_csv_no_header_400(client):
    r = _preview(client, b"")
    assert r.status_code == 400


# ── Apply ─────────────────────────────────────────────────────────────────────

def test_apply_no_phone_column_400(client):
    r = _apply(client, [{"Name": "X"}], {"Name": "client_name"})
    assert r.status_code == 400
    assert "phone" in r.json()["detail"].lower()


def test_apply_good_rows_imported(client):
    rows = [
        {"Owner Name": "ImportA", "Phone": "5550001100", "Pet": "Ace",
         "Breed": "Labrador", "Rabies Exp": "2027-06-01", "Notes": ""},
        {"Owner Name": "ImportB", "Phone": "5550001101", "Pet": "Bolt",
         "Breed": "Poodle", "Rabies Exp": "2028-01-01", "Notes": ""},
    ]
    mapping = {"Owner Name": "client_name", "Phone": "client_phone",
               "Pet": "pet_name", "Breed": "breed", "Rabies Exp": "rabies_expiry"}
    r = _apply(client, rows, mapping)
    assert r.status_code == 200
    assert r.json()["imported"] == 2
    assert r.json()["skipped"] == 0


def test_apply_empty_phone_skipped(client):
    rows = [
        {"Name": "NoPhone", "Phone": "", "Pet": "Dog"},
    ]
    mapping = {"Name": "client_name", "Phone": "client_phone", "Pet": "pet_name"}
    r = _apply(client, rows, mapping)
    assert r.status_code == 200
    assert r.json()["skipped"] == 1
    issue_types = [i["type"] for i in r.json()["issues"]]
    assert "no_phone" in issue_types


def test_apply_bad_phone_skipped(client):
    rows = [{"Name": "BadPhone", "Phone": "123", "Pet": "Cat"}]
    mapping = {"Name": "client_name", "Phone": "client_phone", "Pet": "pet_name"}
    r = _apply(client, rows, mapping)
    assert r.status_code == 200
    assert r.json()["skipped"] == 1
    assert "bad_phone" in [i["type"] for i in r.json()["issues"]]


def test_apply_duplicate_phone_flagged(client):
    rows = [
        {"Name": "First", "Phone": "5550009901", "Pet": "Dog"},
        {"Name": "Second", "Phone": "5550009901", "Pet": "Cat"},
    ]
    mapping = {"Name": "client_name", "Phone": "client_phone", "Pet": "pet_name"}
    r = _apply(client, rows, mapping)
    assert r.status_code == 200
    # Both rows imported (second overwrites first), duplicate flagged as issue
    assert "duplicate_phone" in [i["type"] for i in r.json()["issues"]]


def test_apply_bad_date_flagged_not_skipped(client):
    rows = [{"Name": "BadDate", "Phone": "5550009910", "Pet": "Dog", "Rabies": "TBD"}]
    mapping = {"Name": "client_name", "Phone": "client_phone",
               "Pet": "pet_name", "Rabies": "rabies_expiry"}
    r = _apply(client, rows, mapping)
    assert r.status_code == 200
    assert r.json()["imported"] == 1   # row not skipped
    assert r.json()["skipped"] == 0
    assert "bad_date" in [i["type"] for i in r.json()["issues"]]


def test_apply_missing_name_flagged_and_saved_as_unknown(client):
    rows = [{"Name": "", "Phone": "5550009920", "Pet": "Dog"}]
    mapping = {"Name": "client_name", "Phone": "client_phone", "Pet": "pet_name"}
    r = _apply(client, rows, mapping)
    assert r.status_code == 200
    assert r.json()["imported"] == 1
    assert "missing_name" in [i["type"] for i in r.json()["issues"]]


def test_apply_imports_appear_in_clients(client):
    rows = [{"Name": "Verify Import", "Phone": "5550009930", "Pet": "Fido"}]
    mapping = {"Name": "client_name", "Phone": "client_phone", "Pet": "pet_name"}
    _apply(client, rows, mapping)

    clients = client.get("/api/clients").json()
    names = [c["name"] for c in clients]
    assert "Verify Import" in names
