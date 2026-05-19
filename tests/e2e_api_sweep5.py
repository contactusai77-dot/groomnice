"""
Sweep 5 - vault confirm flow, multi-pet, custom prices, route, waitlist isolation,
admin 404, status flow end-to-end, deposit settings, is_mobile toggle, and
all remaining edge-case 404s.

Usage: python tests/e2e_api_sweep5.py
       (requires live server on localhost:8002)
"""
import io
import struct
import sys
import time
import zlib
import requests
from datetime import date, timedelta

BASE = "http://localhost:8002/api"
RUN = str(int(time.time()))[-6:]
failures: list[str] = []
passes: list[str] = []


def check(name, resp, expected=200, key=None, value=None):
    ok = resp.status_code == expected
    if ok and key:
        try:
            d = resp.json()
            ok = key in d if not isinstance(d, list) else True
            if ok and value is not None:
                ok = d.get(key) == value
        except Exception:
            ok = False
    label = "PASS" if ok else "FAIL"
    (passes if ok else failures).append(
        name if ok else f"{name}: HTTP {resp.status_code} -> {resp.text[:200]}"
    )
    print(f"  [{label}] {name}")
    return resp


def chk(name, cond, detail=""):
    label = "PASS" if cond else "FAIL"
    (passes if cond else failures).append(name if cond else f"{name}: {detail}")
    print(f"  [{label}] {name}")


def tiny_png() -> bytes:
    def chunk(n, d):
        c = zlib.crc32(n + d) & 0xFFFFFFFF
        return struct.pack(">I", len(d)) + n + d + struct.pack(">I", c)
    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(b"\x00\xFF\xFF\xFF"))
            + chunk(b"IEND", b""))


# ── Auth setup ────────────────────────────────────────────────────────────────
demo = requests.post(f"{BASE}/auth/login", json={"email": "demo@groomnice.com", "password": "demo1234"})
chk("Demo login", demo.status_code == 200)
HD = {"Authorization": f"Bearer {demo.json()['token']}"}

ra = requests.post(f"{BASE}/auth/register", json={
    "email": f"sw5_{RUN}@example.com", "password": "pass1234",
    "name": "Sweep5 Groomer", "slug": f"sw5-{RUN}",
})
chk("Register sweep5 groomer", ra.status_code == 201)
HA = {"Authorization": f"Bearer {ra.json()['token']}"}
SLUG5 = f"sw5-{RUN}"

rb = requests.post(f"{BASE}/auth/register", json={
    "email": f"sw5b_{RUN}@example.com", "password": "pass1234",
    "name": "Sweep5B Groomer", "slug": f"sw5b-{RUN}",
})
chk("Register sweep5-B groomer", rb.status_code == 201)
HB = {"Authorization": f"Bearer {rb.json()['token']}"}


# ── 1. Vault: confirm removes from vault + updates pet expiry ─────────────────
print("\n=== VAULT CONFIRM FLOW ===")
requests.patch(f"{BASE}/settings", headers=HA, json={
    "working_hours": {"days": [0,1,2,3,4,5,6], "start": "08:00", "end": "18:00", "slot_minutes": 60},
})
r_bk = requests.post(f"{BASE}/bookings/quick", headers=HA, json={
    "phone": f"+1555{RUN}001", "client_name": "Vault Client",
    "pet_name": "Vax Dog", "service_type": "Bath",
    "appointment_time": "2026-08-01T09:00:00",
})
chk("Create booking for vault test", r_bk.status_code == 200)
vt = r_bk.json().get("intake_token") if r_bk.status_code == 200 else None

if vt:
    # OCR stub returns needs_review=True when ANTHROPIC_API_KEY is blank on server,
    # but the live server may have a key. Either result is fine — we just need a submission.
    r_up = requests.post(f"{BASE}/vaccine/{vt}",
                         files={"file": ("cert.png", io.BytesIO(tiny_png()), "image/png")})
    chk("Upload vaccine cert (any result)", r_up.status_code == 200)

    vault = requests.get(f"{BASE}/vaccine-vault", headers=HA).json()
    sub = next((s for s in vault if s.get("client_name") == "Vault Client"), None)
    chk("Submission appears in vault", sub is not None,
        f"vault entries: {[s.get('client_name') for s in vault]}")

    if sub:
        r_conf = check("Confirm vault submission",
                       requests.patch(f"{BASE}/vaccine-vault/{sub['id']}/confirm",
                                      headers=HA, json={"expiry": "2029-01-01"}), 200)
        # Must disappear from vault
        vault2 = requests.get(f"{BASE}/vaccine-vault", headers=HA).json()
        still = any(s["id"] == sub["id"] for s in vault2)
        chk("Confirmed submission gone from vault", not still,
            "confirmed entry still visible")

        # Pet's rabies_expiry must be updated
        clients5 = requests.get(f"{BASE}/clients", headers=HA).json()
        vc = next((c for c in clients5 if c.get("phone") == f"+1555{RUN}001"), None)
        if vc and vc.get("pets"):
            chk("Pet rabies_expiry updated after vault confirm",
                vc["pets"][0].get("rabies_expiry") == "2029-01-01",
                f"got {vc['pets'][0].get('rabies_expiry')}")

    check("Confirm nonexistent submission -> 404",
          requests.patch(f"{BASE}/vaccine-vault/does-not-exist/confirm",
                         headers=HA, json={"expiry": "2028-01-01"}), 404)


# ── 2. Vaccine upload: bad token -> 404 ──────────────────────────────────────
print("\n=== VACCINE / PROFILE BAD TOKEN ===")
check("Vaccine upload bad token -> 404",
      requests.post(f"{BASE}/vaccine/no-such-token-xyz",
                    files={"file": ("x.jpg", b"\xff\xd8", "image/jpeg")}), 404)
check("Profile GET bad token -> 404",
      requests.get(f"{BASE}/profile/no-such-token-xyz"), 404)
check("Profile PUT bad token -> 404",
      requests.put(f"{BASE}/profile/no-such-token-xyz",
                   json={"pet_name": "X"}), 404)


# ── 3. Multi-pet via profile token ───────────────────────────────────────────
print("\n=== MULTI-PET VIA PROFILE TOKEN ===")
r_mp = requests.post(f"{BASE}/bookings/quick", headers=HA, json={
    "phone": f"+1555{RUN}010", "client_name": "Multi Pet Owner",
    "pet_name": "First Dog", "service_type": "Bath",
    "appointment_time": "2026-08-02T10:00:00",
})
chk("Quick-book for multi-pet client", r_mp.status_code == 200)
mp_tok = r_mp.json().get("intake_token") if r_mp.status_code == 200 else None

if mp_tok:
    r_add = check("Add second pet via profile token",
                  requests.post(f"{BASE}/profile/{mp_tok}/pets",
                                json={"pet_name": "Second Cat", "breed": "Siamese",
                                      "age": "2", "weight": "10"}), 200, "pet_id")
    if r_add.status_code == 200:
        pet2_id = r_add.json().get("pet_id")
        if pet2_id:
            check("Update second pet by ID",
                  requests.put(f"{BASE}/profile/{mp_tok}/pets/{pet2_id}",
                               json={"pet_name": "Second Cat Updated", "breed": "Siamese",
                                     "age": "3", "weight": "11"}), 200)

    profile = requests.get(f"{BASE}/profile/{mp_tok}").json()
    chk("Profile has 2 pets after add",
        len(profile.get("pets", [])) >= 2,
        f"got {len(profile.get('pets', []))} pets")


# ── 4. Custom service price flows through to booking ─────────────────────────
print("\n=== CUSTOM SERVICE PRICE ===")
requests.patch(f"{BASE}/settings", headers=HA, json={
    "service_prices": {"Full Groom": 99.0, "Bath": 50.0, "Nail Trim": 25.0}
})
r_cp = requests.post(f"{BASE}/bookings/quick", headers=HA, json={
    "phone": f"+1555{RUN}020", "client_name": "Price Test",
    "pet_name": "Dog", "service_type": "Full Groom",
    "appointment_time": "2026-08-03T11:00:00",
})
chk("Quick-book with custom price", r_cp.status_code == 200)
if r_cp.status_code == 200:
    appts_cp = requests.get(f"{BASE}/appointments/today", headers=HA).json()
    # The booking is for a future date so check via history won't work yet;
    # verify the booking_id exists at minimum.
    chk("Custom-priced booking has booking_id", bool(r_cp.json().get("booking_id")))


# ── 5. Booking with unlisted service type (price = None) ─────────────────────
print("\n=== UNKNOWN SERVICE TYPE ===")
r_uk = requests.post(f"{BASE}/bookings/quick", headers=HA, json={
    "phone": f"+1555{RUN}021", "client_name": "Unknown Svc",
    "pet_name": "Dog", "service_type": "Blowout Special",
    "appointment_time": "2026-08-04T12:00:00",
})
chk("Unknown service type accepted (price=None)", r_uk.status_code == 200,
    f"got {r_uk.status_code}: {r_uk.text[:100]}")


# ── 6. Route today excludes cancelled ────────────────────────────────────────
print("\n=== ROUTE EXCLUDES CANCELLED ===")
r_route_bk = requests.post(f"{BASE}/bookings/quick", headers=HA, json={
    "phone": f"+1555{RUN}030", "client_name": "Route Cancel",
    "pet_name": "Dog", "service_type": "Bath",
    "appointment_time": "09:30",
})
chk("Create booking for route cancel test", r_route_bk.status_code == 200)
if r_route_bk.status_code == 200:
    rb_id = r_route_bk.json()["booking_id"]
    requests.patch(f"{BASE}/bookings/{rb_id}/status", headers=HA, json={"status": "cancelled"})
    route = requests.get(f"{BASE}/route/today", headers=HA).json()
    route_ids = [s["booking_id"] for s in route.get("stops", [])]
    chk("Cancelled booking absent from route", rb_id not in route_ids,
        f"cancelled booking {rb_id} still in route")


# ── 7. Route structure ────────────────────────────────────────────────────────
print("\n=== ROUTE STRUCTURE ===")
r_rt = check("GET /route/today has required fields",
             requests.get(f"{BASE}/route/today", headers=HA), 200, "stops")
if r_rt.status_code == 200:
    chk("Route has has_locations field", "has_locations" in r_rt.json())
    chk("Route has geo_count field", "geo_count" in r_rt.json())


# ── 8. Waitlist cross-tenant isolation ───────────────────────────────────────
print("\n=== WAITLIST ISOLATION ===")
r_wla = requests.post(f"{BASE}/waitlist", headers=HA,
                      json={"phone": f"+1555{RUN}040", "name": "Groomer A Waiter"})
chk("Add waitlist entry for groomer A", r_wla.status_code == 200)
if r_wla.status_code == 200:
    wl_id_a = r_wla.json()["id"]
    # Groomer B tries to delete groomer A's entry -> 404
    r_del_b = requests.delete(f"{BASE}/waitlist/{wl_id_a}", headers=HB)
    chk("Groomer B cannot delete groomer A's waitlist entry (404)",
        r_del_b.status_code == 404,
        f"got {r_del_b.status_code}")
    # Groomer A's own list must contain the entry
    entries_a = requests.get(f"{BASE}/waitlist", headers=HA).json()
    chk("Groomer A sees own waitlist entry",
        any(e["id"] == wl_id_a for e in entries_a))
    # Groomer B's list must NOT contain the entry
    entries_b = requests.get(f"{BASE}/waitlist", headers=HB).json()
    chk("Groomer B does not see groomer A's entry",
        not any(e["id"] == wl_id_a for e in entries_b))
    # Cleanup
    requests.delete(f"{BASE}/waitlist/{wl_id_a}", headers=HA)


# ── 9. Admin groomer detail 404 ───────────────────────────────────────────────
print("\n=== ADMIN 404 ===")
check("Admin groomer detail nonexistent -> 404",
      requests.get(f"{BASE}/admin/groomers/does-not-exist-id?admin_key=admin-dev"), 404)


# ── 10. Status lifecycle + deposit_ok ────────────────────────────────────────
print("\n=== STATUS LIFECYCLE ===")
r_lc = requests.post(f"{BASE}/bookings/quick", headers=HA, json={
    "phone": f"+1555{RUN}050", "client_name": "Lifecycle Client",
    "pet_name": "Rex", "service_type": "Full Groom",
    "appointment_time": "10:00",
})
chk("Lifecycle booking created", r_lc.status_code == 200)
if r_lc.status_code == 200:
    lc_id = r_lc.json()["booking_id"]
    for status in ("confirmed", "in_progress", "completed"):
        r_st = requests.patch(f"{BASE}/bookings/{lc_id}/status",
                              headers=HA, json={"status": status})
        chk(f"Status transition -> {status}", r_st.status_code == 200,
            f"got {r_st.status_code}: {r_st.text[:80]}")

    # completed -> deposit_ok = True
    appts = requests.get(f"{BASE}/appointments/today", headers=HA).json()
    lc_appt = next((a for a in appts if a["id"] == lc_id), None)
    if lc_appt:
        chk("Completed booking deposit_ok=True", lc_appt.get("deposit_ok") is True,
            f"deposit_ok={lc_appt.get('deposit_ok')}")


# ── 11. is_mobile and deposit_amount persist ──────────────────────────────────
print("\n=== SETTINGS PERSISTENCE ===")
requests.patch(f"{BASE}/settings", headers=HA, json={
    "is_mobile": True, "deposit_amount": 35.0,
})
s = requests.get(f"{BASE}/settings", headers=HA).json()
chk("is_mobile persists", s.get("is_mobile") is True,
    f"got {s.get('is_mobile')}")
chk("deposit_amount persists", s.get("deposit_amount") == 35.0,
    f"got {s.get('deposit_amount')}")

# Toggle off
requests.patch(f"{BASE}/settings", headers=HA, json={"is_mobile": False})
s2 = requests.get(f"{BASE}/settings", headers=HA).json()
chk("is_mobile toggle off persists", s2.get("is_mobile") is False)


# ── 12. Revenue only counts completed bookings ────────────────────────────────
print("\n=== REVENUE ISOLATION ===")
# Groomer A has no completed bookings — revenue must be $0
rev5 = requests.get(f"{BASE}/revenue", headers=HA).json()
chk("New groomer month revenue starts at 0",
    rev5["month"]["revenue"] == 0.0,
    f"got {rev5['month']['revenue']}")

# Create + complete a booking and check revenue increases
r_rev_bk = requests.post(f"{BASE}/bookings/quick", headers=HA, json={
    "phone": f"+1555{RUN}060", "client_name": "Rev Client",
    "pet_name": "Dog", "service_type": "Full Groom",
    "appointment_time": "11:30",
})
if r_rev_bk.status_code == 200:
    rev_id = r_rev_bk.json()["booking_id"]
    requests.patch(f"{BASE}/bookings/{rev_id}/status",
                   headers=HA, json={"status": "completed"})
    rev5b = requests.get(f"{BASE}/revenue", headers=HA).json()
    chk("Revenue increases after completing booking",
        rev5b["today"]["revenue"] > 0,
        f"today revenue={rev5b['today']['revenue']}")
    chk("Completed service appears in by_service",
        "Full Groom" in rev5b.get("by_service", {}),
        f"by_service keys: {list(rev5b.get('by_service', {}).keys())}")


# ── 13. History: future booking not in history ────────────────────────────────
print("\n=== HISTORY FUTURE EXCLUDED ===")
r_fut = requests.post(f"{BASE}/bookings/quick", headers=HA, json={
    "phone": f"+1555{RUN}070", "client_name": "Future Client",
    "pet_name": "Dog", "service_type": "Bath",
    "appointment_time": "2027-12-01T10:00:00",
})
if r_fut.status_code == 200:
    fut_id = r_fut.json()["booking_id"]
    hist = requests.get(f"{BASE}/appointments/history", headers=HA).json()
    chk("Future booking absent from history",
        not any(b["id"] == fut_id for b in hist))


# ── 14. Online booking: source=online in response + pending_review ────────────
print("\n=== ONLINE BOOKING SOURCE ===")
requests.patch(f"{BASE}/settings", headers=HA, json={
    "working_hours": {"days": [0,1,2,3,4,5,6], "start": "08:00", "end": "20:00", "slot_minutes": 60}
})
slots5 = requests.get(f"{BASE}/book/{SLUG5}/slots").json()
if slots5:
    day5 = slots5[0]
    slot5 = day5["slots"][0]
    r_ob = requests.post(f"{BASE}/book/{SLUG5}", json={
        "phone": f"+1555{RUN}080", "name": "Online Booker",
        "pet_name": "Dog", "service_type": "Bath",
        "slot_date": day5["date"], "slot_time": slot5,
    })
    chk("Online booking created", r_ob.status_code == 200)
    if r_ob.status_code == 200:
        chk("Online booking status=pending_review",
            r_ob.json().get("status") == "pending_review",
            f"got {r_ob.json().get('status')}")
        # It should appear in groomer's today/upcoming with source=online
        all_appts = requests.get(f"{BASE}/appointments/today", headers=HA).json()
        ob_appt = next((a for a in all_appts if a["id"] == r_ob.json().get("booking_id")), None)
        if ob_appt:
            chk("Online booking source=online in response",
                ob_appt.get("source") == "online",
                f"got source={ob_appt.get('source')}")


# ── 15. Quick-book existing client reuses token ───────────────────────────────
print("\n=== QUICK-BOOK EXISTING CLIENT ===")
r_qb1 = requests.post(f"{BASE}/bookings/quick", headers=HA, json={
    "phone": f"+1555{RUN}090", "client_name": "Existing Client",
    "pet_name": "Dog One", "service_type": "Bath",
    "appointment_time": "14:00",
})
chk("First booking creates client", r_qb1.status_code == 200)
if r_qb1.status_code == 200:
    tok1 = r_qb1.json()["intake_token"]
    r_qb2 = requests.post(f"{BASE}/bookings/quick", headers=HA, json={
        "phone": f"+1555{RUN}090", "client_name": "Existing Client",
        "pet_name": "Dog Two", "service_type": "Nail Trim",
        "appointment_time": "15:00",
    })
    chk("Second booking for same phone returns same token",
        r_qb2.status_code == 200 and r_qb2.json().get("intake_token") == tok1,
        f"tok1={tok1}, tok2={r_qb2.json().get('intake_token')}")


# ── 16. Price estimate returns required fields ────────────────────────────────
print("\n=== PRICE ESTIMATE FIELDS ===")
for svc in ["Full Groom", "Bath", "Nail Trim"]:
    r_pe = requests.post(f"{BASE}/price-estimate", headers=HA, json={
        "breed": "Labrador", "service_type": svc,
        "temperament": "friendly", "coat_condition": "normal",
    })
    chk(f"Price estimate for {svc} returns 200",
        r_pe.status_code == 200, f"got {r_pe.status_code}")
    if r_pe.status_code == 200:
        for key in ("price", "duration_minutes", "notes"):
            chk(f"  {svc} estimate has '{key}'", key in r_pe.json(),
                f"missing {key} in {r_pe.json()}")


# ── Summary ───────────────────────────────────────────────────────────────────
print(f"\n{'='*55}")
print(f"RESULTS: {len(passes)} passed, {len(failures)} failed")
if failures:
    print("\nFAILURES:")
    for f in failures:
        print(f"  x {f}")
sys.exit(1 if failures else 0)
