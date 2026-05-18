"""
Full API sweep — runs against local server (localhost:8002).
Usage: py -3.11 tests/e2e_api_sweep.py
"""
import io
import sys
import time
import requests

RUN_ID = str(int(time.time()))[-6:]  # unique suffix per run

BASE = "http://localhost:8002/api"
failures: list[str] = []
passes: list[str] = []


def check(name: str, resp: requests.Response, expected: int = 200,
          key: str | None = None, value=None) -> requests.Response:
    ok = resp.status_code == expected
    if ok and key:
        try:
            data = resp.json()
            ok = key in data if not isinstance(data, list) else True
            if ok and value is not None:
                ok = data.get(key) == value
        except Exception:
            ok = False
    label = "PASS" if ok else "FAIL"
    (passes if ok else failures).append(
        name if ok else f"{name}: got {resp.status_code} → {resp.text[:140]}"
    )
    print(f"  [{label}] {name}")
    return resp


# ── Auth ──────────────────────────────────────────────────────────────────────
print("\n=== AUTH ===")
NEW_EMAIL = f"e2e_{RUN_ID}@example.com"
NEW_SLUG = f"e2e-groomer-{RUN_ID}"
r = check("Register new groomer", requests.post(f"{BASE}/auth/register", json={
    "email": NEW_EMAIL, "password": "pass1234", "name": "E2E Groomer", "slug": NEW_SLUG,
}), 201, "token")
NEW_TOKEN = r.json().get("token") if r.status_code == 201 else None

check("Register duplicate email → 409", requests.post(f"{BASE}/auth/register", json={
    "email": NEW_EMAIL, "password": "x", "name": "Dup", "slug": f"dup-slug-{RUN_ID}",
}), 409)

check("Register duplicate slug → 409", requests.post(f"{BASE}/auth/register", json={
    "email": f"other_{RUN_ID}@example.com", "password": "x", "name": "Other", "slug": NEW_SLUG,
}), 409)

r = check("Login valid credentials", requests.post(f"{BASE}/auth/login", json={
    "email": "demo@groomnice.com", "password": "demo1234",
}), 200, "token")
DEMO_TOKEN = r.json().get("token") if r.status_code == 200 else None

check("Login wrong password → 401", requests.post(f"{BASE}/auth/login", json={
    "email": "demo@groomnice.com", "password": "wrong",
}), 401)

H = {"Authorization": f"Bearer {DEMO_TOKEN}"}

check("GET /auth/me authenticated", requests.get(f"{BASE}/auth/me", headers=H), 200, "email")
check("GET /auth/me unauthenticated → 401", requests.get(f"{BASE}/auth/me"), 401)

# ── Dashboard ─────────────────────────────────────────────────────────────────
print("\n=== DASHBOARD ===")
check("GET /appointments/today", requests.get(f"{BASE}/appointments/today", headers=H), 200)
check("GET /appointments/history", requests.get(f"{BASE}/appointments/history", headers=H), 200)
check("GET /revenue has today key", requests.get(f"{BASE}/revenue", headers=H), 200, "today")
check("GET /clients", requests.get(f"{BASE}/clients", headers=H), 200)
check("GET /vaccine-vault", requests.get(f"{BASE}/vaccine-vault", headers=H), 200)
r = check("GET /settings has onboarding_complete", requests.get(f"{BASE}/settings", headers=H),
          200, "onboarding_complete")
check("GET /waitlist", requests.get(f"{BASE}/waitlist", headers=H), 200)
check("GET /route/today has stops", requests.get(f"{BASE}/route/today", headers=H), 200, "stops")

# ── Quick booking ─────────────────────────────────────────────────────────────
print("\n=== BOOKINGS ===")
r = check("Quick book new appointment", requests.post(f"{BASE}/bookings/quick", headers=H, json={
    "phone": "+15550001111",
    "client_name": "E2E Client",
    "pet_name": "Fluffy",
    "service_type": "Bath",
    "appointment_time": "2026-05-19T10:00:00",
}), 200, "booking_id")
booking_id = r.json().get("booking_id") if r.status_code == 200 else None
intake_token = r.json().get("intake_token") if r.status_code == 200 else None

if booking_id:
    check("PATCH booking → confirmed", requests.patch(
        f"{BASE}/bookings/{booking_id}/status", headers=H, json={"status": "confirmed"}), 200)
    check("PATCH booking → completed", requests.patch(
        f"{BASE}/bookings/{booking_id}/status", headers=H, json={"status": "completed"}), 200)

# ── Settings ──────────────────────────────────────────────────────────────────
print("\n=== SETTINGS ===")
check("PATCH onboarding_complete + is_mobile", requests.patch(f"{BASE}/settings", headers=H, json={
    "onboarding_complete": True, "is_mobile": True,
}), 200)
check("PATCH working_hours", requests.patch(f"{BASE}/settings", headers=H, json={
    "working_hours": {"days": [0, 1, 2, 3, 4], "start": "09:00", "end": "17:00", "slot_minutes": 60},
}), 200)
check("PATCH service_prices", requests.patch(f"{BASE}/settings", headers=H, json={
    "service_prices": {"Full Groom": 80, "Bath": 50},
}), 200)

# ── Waitlist ──────────────────────────────────────────────────────────────────
print("\n=== WAITLIST ===")
r = check("Add waitlist entry", requests.post(f"{BASE}/waitlist", headers=H,
          json={"phone": "+15559998888", "name": "Wait Person"}), 200)
wl_id = r.json().get("id") if r.status_code == 200 else None
if wl_id:
    check("Delete waitlist entry", requests.delete(f"{BASE}/waitlist/{wl_id}", headers=H), 200)

# ── Clients / Pets ────────────────────────────────────────────────────────────
print("\n=== CLIENTS / PETS ===")
clients = requests.get(f"{BASE}/clients", headers=H).json()
if isinstance(clients, list) and clients:
    c = clients[0]
    check("PATCH client (name/phone/address)", requests.patch(
        f"{BASE}/clients/{c['id']}", headers=H, json={
            "name": c["name"], "phone": c["phone"], "address": "123 Main St, Austin TX",
        }), 200)
    if c.get("pets"):
        pet = c["pets"][0]
        check("PATCH pet incl rabies_expiry", requests.patch(
            f"{BASE}/pets/{pet['id']}", headers=H, json={
                "pet_name": pet.get("pet_name") or "Buddy",
                "breed": "Poodle", "age": "3", "weight": "20",
                "notes": "e2e test", "temperament": "anxious",
                "rabies_expiry": "2027-06-01",
            }), 200)
        # Verify the date was actually saved
        updated = requests.get(f"{BASE}/clients", headers=H).json()
        saved = next((p for cl in updated for p in cl.get("pets", [])
                      if p["id"] == pet["id"]), None)
        ok = saved and saved.get("rabies_expiry") == "2027-06-01"
        label = "PASS" if ok else "FAIL"
        msg = "rabies_expiry persisted correctly"
        (passes if ok else failures).append(msg if ok else f"{msg}: got {saved}")
        print(f"  [{label}] {msg}")

# ── Price estimate ────────────────────────────────────────────────────────────
print("\n=== AI PRICE ESTIMATE ===")
check("POST /price-estimate returns price", requests.post(f"{BASE}/price-estimate", headers=H, json={
    "breed": "Golden Retriever", "service_type": "Full Groom",
    "temperament": "friendly", "coat_condition": "normal",
}), 200, "price")

# ── Online booking ────────────────────────────────────────────────────────────
print("\n=== ONLINE BOOKING (customer-facing) ===")
check("GET /book/demo/slots", requests.get(f"{BASE}/book/demo/slots"), 200)
check("GET /book/nonexistent/slots → 404", requests.get(f"{BASE}/book/no-such-slug/slots"), 404)

r = check("POST /book/demo creates booking", requests.post(f"{BASE}/book/demo", json={
    "phone": "+15550002222", "name": "Online Customer", "pet_name": "Rex",
    "service_type": "Bath", "slot_date": "2026-05-19", "slot_time": "11:00",
}), 200, "booking_id")
online_intake = r.json().get("intake_token") if r.status_code == 200 else None

# ── Customer profile ──────────────────────────────────────────────────────────
print("\n=== CUSTOMER PROFILE ===")
if intake_token:
    check("GET /profile/{token}", requests.get(f"{BASE}/profile/{intake_token}"), 200, "pets")
    check("PUT /profile/{token} (update pet)", requests.put(
        f"{BASE}/profile/{intake_token}", json={
            "pet_name": "Fluffy", "breed": "Poodle", "age": "2",
            "weight": "15", "emergency_contact": "555-0000", "notes": "gentle",
        }), 200)
    r2 = check("POST /profile/{token}/pets (add second pet)",
               requests.post(f"{BASE}/profile/{intake_token}/pets",
                             json={"pet_name": "Spot", "breed": "Dalmatian"}), 200)
    if r2.status_code == 200:
        pet2_id = r2.json().get("pet_id")
        if pet2_id:
            check("PUT /profile/{token}/pets/{id}", requests.put(
                f"{BASE}/profile/{intake_token}/pets/{pet2_id}",
                json={"pet_name": "Spot", "age": "1"}), 200)
else:
    print("  [SKIP] No intake_token — skipping profile tests")

# ── Feedback ──────────────────────────────────────────────────────────────────
print("\n=== FEEDBACK ===")
check("POST /feedback (bug)", requests.post(f"{BASE}/feedback", json={
    "email": "user@example.com", "type": "bug", "message": "Test bug report",
}), 200)
check("POST /feedback (no email)", requests.post(f"{BASE}/feedback", json={
    "type": "feature", "message": "Add dark mode",
}), 200)
check("POST /feedback empty message → 400", requests.post(f"{BASE}/feedback", json={
    "type": "general", "message": "",
}), 400)

# ── CSV Import ────────────────────────────────────────────────────────────────
print("\n=== CSV IMPORT ===")
csv_bytes = (
    "Owner Name,Phone,Pet,Breed,Rabies Exp,Notes\n"
    "Jane Smith,5551234567,Buddy,Poodle,04/2027,friendly\n"   # good row
    "Bad Row,,NoPhone,,-,no phone here\n"                      # empty phone → skip
    "Bad Phone,123,Tiny,,-,too short\n"                        # bad phone → skip
    "Dup Person,5551234567,Dup Pet,Lab,TBD,\n"                 # dup phone + bad date
    "No Name,,Named,,2027-01-01,\n"                            # also empty phone
).encode()

r = check("POST /import/preview", requests.post(
    f"{BASE}/import/preview",
    headers={"Authorization": f"Bearer {DEMO_TOKEN}"},
    files={"file": ("clients.csv", io.BytesIO(csv_bytes), "text/csv")},
), 200, "suggested_mapping")

if r.status_code == 200:
    mapping = r.json().get("suggested_mapping", {})
    all_rows = [
        {"Owner Name": "Jane Smith", "Phone": "5551234567", "Pet": "Buddy",
         "Breed": "Poodle", "Rabies Exp": "04/2027", "Notes": "friendly"},
        {"Owner Name": "Bad Row", "Phone": "", "Pet": "NoPhone",
         "Breed": "", "Rabies Exp": "-", "Notes": "no phone here"},
        {"Owner Name": "Bad Phone", "Phone": "123", "Pet": "Tiny",
         "Breed": "", "Rabies Exp": "", "Notes": ""},
        {"Owner Name": "Dup Person", "Phone": "5551234567", "Pet": "Dup Pet",
         "Breed": "Lab", "Rabies Exp": "TBD", "Notes": ""},
        {"Owner Name": "", "Phone": "", "Pet": "Named",
         "Breed": "", "Rabies Exp": "2027-01-01", "Notes": ""},
    ]

    r2 = check("POST /import/apply returns issues", requests.post(
        f"{BASE}/import/apply", headers=H,
        json={"rows": all_rows, "mapping": mapping},
    ), 200, "issues")

    if r2.status_code == 200:
        d = r2.json()
        print(f"     imported={d.get('imported')}, skipped={d.get('skipped')}, "
              f"issues={len(d.get('issues', []))}")
        issue_types = [i["type"] for i in d.get("issues", [])]
        print(f"     issue types: {issue_types}")
        # Expect: 2 imported (Jane + Dup who overwrites), 3 skipped, issues flagged
        ok_imported = d.get("imported") == 2
        ok_skipped = d.get("skipped") == 3
        ok_bad_date = "bad_date" in issue_types
        ok_dup = "duplicate_phone" in issue_types
        for label, cond in [
            ("import/apply: imported==2 (Jane + Dup overwrite)", ok_imported),
            ("import/apply: skipped==3", ok_skipped),
            ("import/apply: bad_date issue raised", ok_bad_date),
            ("import/apply: duplicate_phone issue raised", ok_dup),
        ]:
            mark = "PASS" if cond else "FAIL"
            (passes if cond else failures).append(
                label if cond else f"{label} (got {d})"
            )
            print(f"  [{mark}] {label}")

    check("POST /import/apply no Phone column → 400", requests.post(
        f"{BASE}/import/apply", headers=H,
        json={"rows": all_rows, "mapping": {"Owner Name": "client_name"}},
    ), 400)

# ── Admin ─────────────────────────────────────────────────────────────────────
print("\n=== ADMIN ===")
check("GET /admin/overview", requests.get(f"{BASE}/admin/overview?admin_key=admin-dev"), 200)
check("GET /admin/groomers", requests.get(f"{BASE}/admin/groomers?admin_key=admin-dev"), 200)
check("GET /admin/feedback", requests.get(f"{BASE}/admin/feedback?admin_key=admin-dev"), 200)
check("GET /admin/overview wrong key → 403",
      requests.get(f"{BASE}/admin/overview?admin_key=wrong"), 403)

# ── Health ────────────────────────────────────────────────────────────────────
print("\n=== MISC ===")
check("GET /health", requests.get(f"{BASE}/health"), 200, "status")

# ── Summary ───────────────────────────────────────────────────────────────────
print(f"\n{'='*50}")
print(f"RESULTS: {len(passes)} passed, {len(failures)} failed")
if failures:
    print("\nFAILURES:")
    for f in failures:
        print(f"  ✗ {f}")
sys.exit(1 if failures else 0)
