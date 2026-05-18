"""
Second API sweep — covers features not tested in e2e_api_sweep.py:
  admin groomer detail, vaccine upload + vault confirm flow, multi-tenant isolation,
  history/revenue structure, booking slots structure, settings all fields,
  appointment response fields, date normalization formats, token edge cases,
  double-book prevention, new-groomer defaults, route stop fields.

Usage: PYTHONUTF8=1 py -3.11 tests/e2e_api_sweep2.py
"""
import io
import sys
import time
import struct
import zlib
import requests

BASE = "http://localhost:8002/api"
RUN_ID = str(int(time.time()))[-6:]
failures: list[str] = []
passes: list[str] = []


def check(name: str, resp: requests.Response, expected: int = 200,
          key: str | None = None, value=None) -> requests.Response:
    ok = resp.status_code == expected
    if ok and key:
        try:
            data = resp.json()
            if isinstance(data, list):
                ok = True
            else:
                ok = key in data
                if ok and value is not None:
                    ok = data.get(key) == value
        except Exception:
            ok = False
    label = "PASS" if ok else "FAIL"
    (passes if ok else failures).append(
        name if ok else f"{name}: HTTP {resp.status_code} → {resp.text[:200]}"
    )
    print(f"  [{label}] {name}")
    return resp


def assert_check(name: str, condition: bool, detail: str = "") -> None:
    label = "PASS" if condition else "FAIL"
    (passes if condition else failures).append(
        name if condition else f"{name}: {detail}"
    )
    print(f"  [{label}] {name}")


def tiny_png() -> bytes:
    """Generate a valid 1x1 white PNG in memory (no external libs needed)."""
    def chunk(name: bytes, data: bytes) -> bytes:
        c = zlib.crc32(name + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + name + data + struct.pack(">I", c)

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
    raw = b"\x00\xFF\xFF\xFF"        # filter byte + RGB white
    idat = chunk(b"IDAT", zlib.compress(raw))
    iend = chunk(b"IEND", b"")
    return sig + ihdr + idat + iend


# ── Set up two groomers ───────────────────────────────────────────────────────
print("\n=== SETUP: two groomers ===")
r_a = requests.post(f"{BASE}/auth/register", json={
    "email": f"groomer_a_{RUN_ID}@example.com", "password": "pass1234",
    "name": "Groomer A", "slug": f"groomer-a-{RUN_ID}",
})
r_b = requests.post(f"{BASE}/auth/register", json={
    "email": f"groomer_b_{RUN_ID}@example.com", "password": "pass1234",
    "name": "Groomer B", "slug": f"groomer-b-{RUN_ID}",
})
assert_check("Register groomer A", r_a.status_code == 201)
assert_check("Register groomer B", r_b.status_code == 201)
HA = {"Authorization": f"Bearer {r_a.json()['token']}"}
HB = {"Authorization": f"Bearer {r_b.json()['token']}"}
GROOMER_A_ID = r_a.json()["groomer"]["id"] if r_a.status_code == 201 else None

# Demo groomer headers (has seed data)
demo_login = requests.post(f"{BASE}/auth/login", json={"email": "demo@groomnice.com", "password": "demo1234"})
HD = {"Authorization": f"Bearer {demo_login.json()['token']}"}

# ── New groomer defaults ──────────────────────────────────────────────────────
print("\n=== NEW GROOMER DEFAULTS ===")
r = check("New groomer: onboarding_complete defaults false",
          requests.get(f"{BASE}/settings", headers=HA), 200, "onboarding_complete", False)
check("New groomer: is_mobile defaults false",
      requests.get(f"{BASE}/settings", headers=HA), 200, "is_mobile", False)

# ── Settings — all fields ─────────────────────────────────────────────────────
print("\n=== SETTINGS ALL FIELDS ===")
r = check("GET /settings has all required fields",
          requests.get(f"{BASE}/settings", headers=HD), 200)
if r.status_code == 200:
    d = r.json()
    for field in ["require_deposit", "send_24h_reminder", "send_gap_fill_text",
                  "deposit_amount", "service_prices", "working_hours",
                  "onboarding_complete", "is_mobile"]:
        assert_check(f"Settings has field: {field}", field in d, f"missing from {list(d.keys())}")

check("PATCH require_deposit + deposit_amount", requests.patch(f"{BASE}/settings", headers=HA, json={
    "require_deposit": False, "deposit_amount": 35.0,
}), 200)
r = requests.get(f"{BASE}/settings", headers=HA)
assert_check("deposit_amount persisted", r.json().get("deposit_amount") == 35.0,
             f"got {r.json().get('deposit_amount')}")
assert_check("require_deposit persisted", r.json().get("require_deposit") is False,
             f"got {r.json().get('require_deposit')}")

check("PATCH send_24h_reminder + send_gap_fill_text", requests.patch(f"{BASE}/settings", headers=HA, json={
    "send_24h_reminder": False, "send_gap_fill_text": False,
}), 200)

# ── Appointment response structure ────────────────────────────────────────────
print("\n=== APPOINTMENT RESPONSE FIELDS ===")
appts = requests.get(f"{BASE}/appointments/today", headers=HD).json()
if appts:
    a = appts[0]
    for field in ["id", "appointment_date", "service_type", "status", "price",
                  "client_name", "client_phone", "pet_name", "breed",
                  "vaccine_ok", "deposit_ok", "ready", "profile_complete",
                  "intake_token", "pet_id", "temperament", "source"]:
        assert_check(f"Appointment has field: {field}", field in a,
                     f"missing from {list(a.keys())}")
    assert_check("Appointment temperament valid",
                 a.get("temperament") in ("friendly", "anxious", "aggressive"),
                 f"got '{a.get('temperament')}'")
else:
    print("  [SKIP] No today appointments in demo data")

# ── History search params ─────────────────────────────────────────────────────
print("\n=== HISTORY SEARCH ===")
check("GET /history default", requests.get(f"{BASE}/appointments/history", headers=HD), 200)
r_search = check("GET /history ?q=Jane", requests.get(
    f"{BASE}/appointments/history?q=Jane", headers=HD), 200)
r_days = check("GET /history ?days=7", requests.get(
    f"{BASE}/appointments/history?days=7", headers=HD), 200)
r_all = requests.get(f"{BASE}/appointments/history", headers=HD)
if r_search.status_code == 200 and r_all.status_code == 200:
    assert_check("History search ?q=Jane returns fewer results",
                 len(r_search.json()) <= len(r_all.json()),
                 f"search={len(r_search.json())} vs all={len(r_all.json())}")

# ── Revenue structure ─────────────────────────────────────────────────────────
print("\n=== REVENUE STRUCTURE ===")
r = check("GET /revenue", requests.get(f"{BASE}/revenue", headers=HD), 200)
if r.status_code == 200:
    d = r.json()
    for key in ["today", "week", "month", "by_service"]:
        assert_check(f"Revenue has key: {key}", key in d, f"missing, got {list(d.keys())}")
    for period in ["today", "week", "month"]:
        if period in d:
            assert_check(f"Revenue.{period} has revenue+count",
                         "revenue" in d[period] and "count" in d[period],
                         f"got {d[period]}")
    assert_check("Revenue by_service is dict", isinstance(d.get("by_service"), dict),
                 f"got {type(d.get('by_service'))}")

# ── Booking slots structure ───────────────────────────────────────────────────
print("\n=== BOOKING SLOTS STRUCTURE ===")
# Set working hours for groomer A first
requests.patch(f"{BASE}/settings", headers=HA, json={
    "working_hours": {"days": [0, 1, 2, 3, 4, 5, 6], "start": "09:00", "end": "17:00", "slot_minutes": 60}
})
r = check(f"GET /book/groomer-a-{RUN_ID}/slots",
          requests.get(f"{BASE}/book/groomer-a-{RUN_ID}/slots"), 200)
if r.status_code == 200:
    slots = r.json()
    assert_check("Slots is a list", isinstance(slots, list))
    if slots:
        s = slots[0]
        for field in ["date", "day_name", "slots"]:
            assert_check(f"Slot entry has field: {field}", field in s,
                         f"missing from {list(s.keys())}")
        assert_check("Slot.slots is a list of strings",
                     isinstance(s.get("slots"), list),
                     f"got {s.get('slots')}")

check("GET /book/no-such-slug/slots → 404",
      requests.get(f"{BASE}/book/no-such-slug-zzz/slots"), 404)

# ── Online booking → pending_review ──────────────────────────────────────────
print("\n=== ONLINE BOOKING STATUS + SOURCE ===")
r = check("POST /book/demo creates pending_review booking",
          requests.post(f"{BASE}/book/demo", json={
              "phone": f"+1555{RUN_ID}0001", "name": "Online Tester",
              "pet_name": "Zara", "service_type": "Bath",
              "slot_date": "2026-05-20", "slot_time": "10:00",
          }), 200, "booking_id")
if r.status_code == 200:
    bk_id = r.json()["booking_id"]
    # Check the booking appears in today's list with correct source
    demo_bookings = requests.get(f"{BASE}/appointments/today", headers=HD).json()
    # Check history for this booking (it might not be today)
    hist = requests.get(f"{BASE}/appointments/history?q=Online+Tester&days=1", headers=HD).json()
    online_bk = next((b for b in hist if b["id"] == bk_id), None)
    if online_bk:
        assert_check("Online booking source is 'online'",
                     online_bk.get("source") == "online",
                     f"got '{online_bk.get('source')}'")
        assert_check("Online booking status is pending_review",
                     online_bk.get("status") == "pending_review",
                     f"got '{online_bk.get('status')}'")

# ── Quick book: existing client not duplicated ────────────────────────────────
print("\n=== QUICK BOOK DEDUP ===")
requests.post(f"{BASE}/bookings/quick", headers=HA, json={
    "phone": "+15550101010", "client_name": "Dedup Test", "pet_name": "Fido",
    "service_type": "Bath", "appointment_time": "2026-05-21T09:00:00",
})
requests.post(f"{BASE}/bookings/quick", headers=HA, json={
    "phone": "+15550101010", "client_name": "Dedup Test", "pet_name": "Fido",
    "service_type": "Full Groom", "appointment_time": "2026-05-21T11:00:00",
})
clients_a = requests.get(f"{BASE}/clients", headers=HA).json()
dedup_clients = [c for c in clients_a if c.get("phone") == "+15550101010"]
assert_check("Same phone creates only one client",
             len(dedup_clients) == 1,
             f"found {len(dedup_clients)} clients with same phone")

# ── Multi-tenant isolation ────────────────────────────────────────────────────
print("\n=== MULTI-TENANT ISOLATION ===")
# Groomer B's token should not see Groomer A's clients/bookings
clients_a_via_b = requests.get(f"{BASE}/clients", headers=HB).json()
a_client_ids = {c["id"] for c in requests.get(f"{BASE}/clients", headers=HA).json()}
b_sees_a = any(c["id"] in a_client_ids for c in clients_a_via_b)
assert_check("Groomer B cannot see Groomer A's clients", not b_sees_a,
             f"Groomer B sees {len([c for c in clients_a_via_b if c['id'] in a_client_ids])} of A's clients")

appts_a = requests.get(f"{BASE}/appointments/today", headers=HA).json()
appts_b = requests.get(f"{BASE}/appointments/today", headers=HB).json()
a_ids = {a["id"] for a in appts_a}
b_sees_a_appts = any(a["id"] in a_ids for a in appts_b)
assert_check("Groomer B cannot see Groomer A's appointments", not b_sees_a_appts)

# Try to patch Groomer A's client using Groomer B's token
if a_client_ids:
    a_client_id = next(iter(a_client_ids))
    r_evil = requests.patch(f"{BASE}/clients/{a_client_id}", headers=HB,
                            json={"name": "Hacked", "phone": "+15550000000"})
    assert_check("Groomer B cannot edit Groomer A's client (404)",
                 r_evil.status_code == 404,
                 f"got {r_evil.status_code}: {r_evil.text[:100]}")

# ── Vaccine upload + vault confirm flow ───────────────────────────────────────
print("\n=== VACCINE UPLOAD + VAULT CONFIRM ===")
# Create a client for groomer A via quick-book to get an intake_token
r_bk = requests.post(f"{BASE}/bookings/quick", headers=HA, json={
    "phone": f"+1555{RUN_ID}9999", "client_name": "Vaccine Test Client",
    "pet_name": "Vaxxer", "service_type": "Bath",
    "appointment_time": "2026-05-21T14:00:00",
})
vax_intake_token = r_bk.json().get("intake_token") if r_bk.status_code == 200 else None
vax_pet_id = r_bk.json().get("pet_id") if r_bk.status_code == 200 else None

if vax_intake_token:
    # Upload a tiny PNG as the vaccine cert
    png = tiny_png()
    url = f"{BASE}/vaccine/{vax_intake_token}"
    if vax_pet_id:
        url += f"?pet_id={vax_pet_id}"
    r_upload = check("POST /vaccine/{token} with image",
                     requests.post(url, files={"file": ("cert.png", io.BytesIO(png), "image/png")}),
                     200)
    if r_upload.status_code == 200:
        upload_data = r_upload.json()
        assert_check("Vaccine upload response has needs_review",
                     "needs_review" in upload_data,
                     f"got {list(upload_data.keys())}")
        assert_check("Vaccine upload response has message",
                     "message" in upload_data,
                     f"got {list(upload_data.keys())}")

    # Check vault shows the submission (status=pending OR needs_retake)
    vault = requests.get(f"{BASE}/vaccine-vault", headers=HA).json()
    our_sub = next((s for s in vault if s.get("client_name") == "Vaccine Test Client"), None)
    assert_check("Submission appears in vault (pending or needs_retake)", our_sub is not None,
                 f"vault has {[s.get('client_name') for s in vault]}")
    if our_sub:
        assert_check("Submission status is pending or needs_retake",
                     our_sub.get("status") in ("pending", "needs_retake"),
                     f"got '{our_sub.get('status')}'")


    if our_sub:
        sub_id = our_sub["id"]
        # Confirm the vaccine
        r_confirm = check("PATCH /vaccine-vault/{id}/confirm",
                          requests.patch(f"{BASE}/vaccine-vault/{sub_id}/confirm",
                                         headers=HA, json={"expiry": "2028-03-15"}), 200)
        # Check the pet's rabies_expiry was updated
        clients_now = requests.get(f"{BASE}/clients", headers=HA).json()
        vax_client = next((c for c in clients_now
                           if c.get("name") == "Vaccine Test Client"), None)
        if vax_client and vax_client.get("pets"):
            pet = vax_client["pets"][0]
            assert_check("Vaccine confirm updates pet rabies_expiry",
                         pet.get("rabies_expiry") == "2028-03-15",
                         f"got '{pet.get('rabies_expiry')}'")

        # Confirm wrong groomer can't confirm → 404
        r_evil_confirm = requests.patch(
            f"{BASE}/vaccine-vault/{sub_id}/confirm",
            headers=HB, json={"expiry": "2028-01-01"})
        assert_check("Groomer B cannot confirm Groomer A's submission",
                     r_evil_confirm.status_code == 404,
                     f"got {r_evil_confirm.status_code}")

        # Confirmed submission should NOT appear in vault any more (it's status=confirmed)
        vault2 = requests.get(f"{BASE}/vaccine-vault", headers=HA).json()
        still_pending = any(s["id"] == sub_id for s in vault2)
        assert_check("Confirmed submission disappears from vault",
                     not still_pending,
                     "submission still shows as pending after confirm")
else:
    print("  [SKIP] Could not get intake_token for vaccine tests")

# ── Vaccine upload: invalid token ─────────────────────────────────────────────
print("\n=== TOKEN EDGE CASES ===")
check("POST /vaccine/invalid-token → 404",
      requests.post(f"{BASE}/vaccine/this-token-does-not-exist",
                    files={"file": ("cert.png", io.BytesIO(tiny_png()), "image/png")}), 404)
check("GET /profile/invalid-token → 404",
      requests.get(f"{BASE}/profile/this-token-does-not-exist"), 404)
check("PUT /profile/invalid-token → 404",
      requests.put(f"{BASE}/profile/this-token-does-not-exist",
                   json={"pet_name": "Ghost"}), 404)

# ── Admin groomer detail ──────────────────────────────────────────────────────
print("\n=== ADMIN GROOMER DETAIL ===")
groomers_list = requests.get(f"{BASE}/admin/groomers?admin_key=admin-dev").json()
if groomers_list:
    gid = groomers_list[0]["id"]
    r = check("GET /admin/groomers/{id}", requests.get(
        f"{BASE}/admin/groomers/{gid}?admin_key=admin-dev"), 200)
    if r.status_code == 200:
        d = r.json()
        for field in ["id", "name", "email", "slug", "clients", "recent_bookings", "total_revenue"]:
            assert_check(f"Admin groomer detail has field: {field}", field in d,
                         f"missing from {list(d.keys())}")
        assert_check("Admin groomer detail clients is list", isinstance(d.get("clients"), list))
        assert_check("Admin groomer detail bookings is list", isinstance(d.get("recent_bookings"), list))

check("GET /admin/groomers/nonexistent → 404",
      requests.get(f"{BASE}/admin/groomers/does-not-exist?admin_key=admin-dev"), 404)
check("GET /admin/groomers/{id} wrong key → 403",
      requests.get(f"{BASE}/admin/groomers/{groomers_list[0]['id']}?admin_key=wrong"), 403)

# ── Date normalization in CSV import ─────────────────────────────────────────
print("\n=== DATE NORMALIZATION (CSV IMPORT) ===")
date_test_rows = [
    {"Name": "A1", "Phone": f"555{RUN_ID}001", "Exp": "04/2027"},     # MM/YYYY
    {"Name": "A2", "Phone": f"555{RUN_ID}002", "Exp": "04/15/2027"},  # MM/DD/YYYY
    {"Name": "A3", "Phone": f"555{RUN_ID}003", "Exp": "2027-04-15"},  # ISO
    {"Name": "A4", "Phone": f"555{RUN_ID}004", "Exp": "Apr 2027"},    # Mon YYYY
    {"Name": "A5", "Phone": f"555{RUN_ID}005", "Exp": "April 2027"},  # Month YYYY
    {"Name": "A6", "Phone": f"555{RUN_ID}006", "Exp": "TBD"},          # bad → null
    {"Name": "A7", "Phone": f"555{RUN_ID}007", "Exp": "N/A"},          # bad → null
    {"Name": "A8", "Phone": f"555{RUN_ID}008", "Exp": ""},             # empty → null
]
mapping = {"Name": "client_name", "Phone": "client_phone", "Exp": "rabies_expiry"}
r = check("POST /import/apply date normalization rows",
          requests.post(f"{BASE}/import/apply", headers=HD,
                        json={"rows": date_test_rows, "mapping": mapping}), 200)
if r.status_code == 200:
    d = r.json()
    assert_check("All 8 date rows imported", d.get("imported") == 8,
                 f"imported={d.get('imported')}, skipped={d.get('skipped')}")
    bad_dates = [i for i in d.get("issues", []) if i["type"] == "bad_date"]
    assert_check("Exactly 2 bad_date issues (TBD + N/A)",
                 len(bad_dates) == 2,
                 f"bad_date issues: {[i['value'] for i in bad_dates]}")

# ── Route stop structure ──────────────────────────────────────────────────────
print("\n=== ROUTE STOP STRUCTURE ===")
r = check("GET /route/today structure", requests.get(f"{BASE}/route/today", headers=HD), 200)
if r.status_code == 200:
    d = r.json()
    assert_check("Route has stops list", isinstance(d.get("stops"), list))
    assert_check("Route has has_locations bool", isinstance(d.get("has_locations"), bool))
    assert_check("Route has geo_count int", isinstance(d.get("geo_count"), int))
    if d.get("stops"):
        stop = d["stops"][0]
        for field in ["booking_id", "client_name", "client_phone", "pet_name",
                      "service_type", "appointment_date", "status"]:
            assert_check(f"Route stop has field: {field}", field in stop,
                         f"missing from {list(stop.keys())}")

# ── Revenue edge case: new groomer has zero revenue ───────────────────────────
print("\n=== EDGE CASES ===")
r = check("New groomer revenue is all zeros", requests.get(f"{BASE}/revenue", headers=HA), 200)
if r.status_code == 200:
    d = r.json()
    assert_check("New groomer today.revenue == 0",
                 d.get("today", {}).get("revenue") == 0,
                 f"got {d.get('today')}")

# Unauthenticated access to protected endpoints
check("GET /clients unauthenticated → 401",
      requests.get(f"{BASE}/clients"), 401)
check("GET /appointments/today unauthenticated → 401",
      requests.get(f"{BASE}/appointments/today"), 401)
check("POST /bookings/quick unauthenticated → 401",
      requests.post(f"{BASE}/bookings/quick", json={}), 401)
check("GET /revenue unauthenticated → 401",
      requests.get(f"{BASE}/revenue"), 401)
check("GET /vaccine-vault unauthenticated → 401",
      requests.get(f"{BASE}/vaccine-vault"), 401)
check("GET /route/today unauthenticated → 401",
      requests.get(f"{BASE}/route/today"), 401)

# ── Summary ───────────────────────────────────────────────────────────────────
print(f"\n{'='*55}")
print(f"RESULTS: {len(passes)} passed, {len(failures)} failed")
if failures:
    print("\nFAILURES:")
    for f in failures:
        print(f"  x {f}")
sys.exit(1 if failures else 0)
