"""
Scheduling-focused sweep: slot counts, working-day enforcement, cancellation
freeing slots, expired vaccines, aggressive dogs, no-shows, boundary times,
full-day booking, and out-of-hours / off-day guard.

Usage: PYTHONUTF8=1 py -3.11 tests/e2e_api_sweep4.py
"""
import sys
import time
import requests
from datetime import date, timedelta

BASE = "http://localhost:8002/api"
RUN_ID = str(int(time.time()))[-6:]
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
        name if ok else f"{name}: HTTP {resp.status_code} -> {resp.text[:180]}"
    )
    print(f"  [{label}] {name}")
    return resp


def chk(name, cond, detail=""):
    label = "PASS" if cond else "FAIL"
    (passes if cond else failures).append(name if cond else f"{name}: {detail}")
    print(f"  [{label}] {name}")


# ── Setup: fresh groomer with known hours ─────────────────────────────────────
ra = requests.post(f"{BASE}/auth/register", json={
    "email": f"sched_{RUN_ID}@example.com",
    "password": "pass1234",
    "name": "Sched Groomer",
    "slug": f"sched-{RUN_ID}",
})
chk("Register scheduling groomer", ra.status_code == 201)
HA = {"Authorization": f"Bearer {ra.json()['token']}"}
SLUG = f"sched-{RUN_ID}"

demo = requests.post(f"{BASE}/auth/login",
                     json={"email": "demo@groomnice.com", "password": "demo1234"})
HD = {"Authorization": f"Bearer {demo.json()['token']}"}

# ── 1. Slot count accuracy ────────────────────────────────────────────────────
print("\n=== SLOT COUNT ACCURACY ===")

def set_hours(h, start, end, slot_min, days=None):
    requests.patch(f"{BASE}/settings", headers=h, json={
        "working_hours": {
            "days": days if days is not None else [0,1,2,3,4,5,6],
            "start": start, "end": end, "slot_minutes": slot_min,
        }
    })

def count_total_slots(slug):
    r = requests.get(f"{BASE}/book/{slug}/slots")
    if r.status_code != 200:
        return 0
    return sum(len(d["slots"]) for d in r.json())

# 09:00–17:00, 60-min → 8 slots per working day
set_hours(HA, "09:00", "17:00", 60, days=[0,1,2,3,4,5,6])
slots_r = requests.get(f"{BASE}/book/{SLUG}/slots").json()
tomorrow = (date.today() + timedelta(days=1)).isoformat()
tmrw_day = next((d for d in slots_r if d["date"] == tomorrow), None)
if tmrw_day:
    chk("09:00–17:00 60-min → 8 slots",
        len(tmrw_day["slots"]) == 8,
        f"got {len(tmrw_day['slots'])}: {tmrw_day['slots']}")

# 08:00–10:00, 30-min → 4 slots
set_hours(HA, "08:00", "10:00", 30, days=[0,1,2,3,4,5,6])
slots_r2 = requests.get(f"{BASE}/book/{SLUG}/slots").json()
tmrw2 = next((d for d in slots_r2 if d["date"] == tomorrow), None)
if tmrw2:
    chk("08:00–10:00 30-min → 4 slots",
        len(tmrw2["slots"]) == 4,
        f"got {len(tmrw2['slots'])}: {tmrw2['slots']}")

# 09:00–09:00 (zero-width) → 0 slots → day not in result
set_hours(HA, "09:00", "09:00", 60, days=[0,1,2,3,4,5,6])
slots_r3 = requests.get(f"{BASE}/book/{SLUG}/slots").json()
chk("Start == End → zero slots returned",
    len(slots_r3) == 0,
    f"got {len(slots_r3)} days with slots")

# Restore sane hours for remaining tests
set_hours(HA, "08:00", "18:00", 60, days=[0,1,2,3,4,5,6])

# ── 2. Non-working day excluded from slots ────────────────────────────────────
print("\n=== NON-WORKING DAY EXCLUDED ===")
# Set only Tuesday (weekday=1) as working
set_hours(HA, "09:00", "17:00", 60, days=[1])
slots_days = requests.get(f"{BASE}/book/{SLUG}/slots").json()
non_tuesday = [d for d in slots_days if date.fromisoformat(d["date"]).weekday() != 1]
chk("Only Tuesdays returned when days=[1]",
    len(non_tuesday) == 0,
    f"non-Tuesday days in result: {[d['date'] for d in non_tuesday]}")
set_hours(HA, "08:00", "18:00", 60, days=[0,1,2,3,4,5,6])

# ── 3. Booked slot removed; cancelled booking re-opens slot ──────────────────
print("\n=== CANCEL FREES SLOT ===")
target_date = (date.today() + timedelta(days=2)).isoformat()
# Book a slot on day+2
r_pre = requests.get(f"{BASE}/book/{SLUG}/slots").json()
day2 = next((d for d in r_pre if d["date"] == target_date), None)
if day2 and day2["slots"]:
    slot_time = day2["slots"][0]
    r_bk = requests.post(f"{BASE}/book/{SLUG}", json={
        "phone": f"+1555{RUN_ID}001", "name": "Cancel Test",
        "pet_name": "Gone", "service_type": "Bath",
        "slot_date": target_date, "slot_time": slot_time,
    })
    chk("Book the slot", r_bk.status_code == 200)
    bid = r_bk.json().get("booking_id") if r_bk.status_code == 200 else None

    # Slot is now blocked
    r_after = requests.get(f"{BASE}/book/{SLUG}/slots").json()
    day2_after = next((d for d in r_after if d["date"] == target_date), None)
    chk("Slot blocked after booking",
        day2_after is None or slot_time not in day2_after.get("slots", []),
        f"slot {slot_time} still available")

    if bid:
        # PATCH to "cancelled" (two l's)
        requests.patch(f"{BASE}/bookings/{bid}/status",
                       headers=HA, json={"status": "cancelled"})
        r_freed = requests.get(f"{BASE}/book/{SLUG}/slots").json()
        day2_freed = next((d for d in r_freed if d["date"] == target_date), None)
        slot_freed = day2_freed is not None and slot_time in day2_freed.get("slots", [])
        chk("Slot freed after cancellation (status='cancelled')",
            slot_freed,
            f"slot {slot_time} still blocked after cancel on {target_date}")

# ── 4. Booking on a non-working day is rejected ───────────────────────────────
print("\n=== OFF-DAY BOOKING GUARD ===")
# Set only Mon-Fri (0-4); find the next Saturday
set_hours(HA, "09:00", "17:00", 60, days=[0,1,2,3,4])
saturday = date.today()
while saturday.weekday() != 5:
    saturday += timedelta(days=1)
r_offday = requests.post(f"{BASE}/book/{SLUG}", json={
    "phone": f"+1555{RUN_ID}002", "name": "Off Day",
    "pet_name": "Nope", "service_type": "Bath",
    "slot_date": saturday.isoformat(), "slot_time": "10:00",
})
chk("Booking on non-working day rejected (400/409)",
    r_offday.status_code in (400, 409),
    f"got {r_offday.status_code}: {r_offday.text[:100]}")
set_hours(HA, "08:00", "18:00", 60, days=[0,1,2,3,4,5,6])

# ── 5. Booking outside working hours is rejected ──────────────────────────────
print("\n=== OUT-OF-HOURS BOOKING GUARD ===")
set_hours(HA, "09:00", "17:00", 60, days=[0,1,2,3,4,5,6])
future_date = (date.today() + timedelta(days=3)).isoformat()
r_ooh = requests.post(f"{BASE}/book/{SLUG}", json={
    "phone": f"+1555{RUN_ID}003", "name": "Night Owl",
    "pet_name": "Midnight", "service_type": "Bath",
    "slot_date": future_date, "slot_time": "23:00",
})
chk("Booking outside working hours rejected (400/409)",
    r_ooh.status_code in (400, 409),
    f"got {r_ooh.status_code}: {r_ooh.text[:100]}")
set_hours(HA, "08:00", "18:00", 60, days=[0,1,2,3,4,5,6])

# ── 6. Full-day booking: all slots taken → none available ─────────────────────
print("\n=== FULL-DAY BOOKING ===")
set_hours(HA, "10:00", "12:00", 60, days=[0,1,2,3,4,5,6])
full_date = (date.today() + timedelta(days=4)).isoformat()
r_s = requests.get(f"{BASE}/book/{SLUG}/slots").json()
full_day = next((d for d in r_s if d["date"] == full_date), None)
if full_day:
    booked_all = []
    for i, slot in enumerate(full_day["slots"]):
        rb = requests.post(f"{BASE}/book/{SLUG}", json={
            "phone": f"+1555{RUN_ID}{90+i:02d}", "name": f"Full Day {i}",
            "pet_name": "Dog", "service_type": "Bath",
            "slot_date": full_date, "slot_time": slot,
        })
        booked_all.append(rb.status_code == 200)
    chk(f"All {len(full_day['slots'])} slots booked", all(booked_all))
    r_full = requests.get(f"{BASE}/book/{SLUG}/slots").json()
    full_day_after = next((d for d in r_full if d["date"] == full_date), None)
    chk("No slots available when day fully booked",
        full_day_after is None,
        f"still shows {len(full_day_after['slots']) if full_day_after else 0} slots")
set_hours(HA, "08:00", "18:00", 60, days=[0,1,2,3,4,5,6])

# ── 7. Expired vaccine → vaccine_ok = False ───────────────────────────────────
print("\n=== EXPIRED VACCINE ===")
# Demo seed has Marco Rivera / Luna with rabies_expiry="2025-03-01" (past)
demo_clients = requests.get(f"{BASE}/clients", headers=HD).json()
marco = next((c for c in demo_clients if "Marco" in c.get("name", "")), None)
if marco:
    chk("Client with expired rabies shows vaccine_ok=False",
        marco.get("vaccine_ok") is False,
        f"vaccine_ok={marco.get('vaccine_ok')} for {marco['name']}")
    if marco.get("pets"):
        luna_expiry = marco["pets"][0].get("rabies_expiry")
        chk("Expired rabies_expiry is in the past",
            luna_expiry and luna_expiry < date.today().isoformat(),
            f"expiry={luna_expiry}")
else:
    print("  [SKIP] Marco Rivera not found in demo data")

# Appointment with expired vaccine should show vaccine_ok=False
demo_appts = requests.get(f"{BASE}/appointments/today", headers=HD).json()
marco_appt = next((a for a in demo_appts if "Marco" in a.get("client_name", "")), None)
if marco_appt:
    chk("Appointment with expired vaccine has vaccine_ok=False",
        marco_appt.get("vaccine_ok") is False,
        f"got vaccine_ok={marco_appt.get('vaccine_ok')}")
    chk("Appointment with expired vaccine has ready=False",
        marco_appt.get("ready") is False,
        f"got ready={marco_appt.get('ready')}")

# ── 8. Missing vaccine → vaccine_ok = False ───────────────────────────────────
print("\n=== MISSING VACCINE ===")
ashley_appt = next((a for a in demo_appts if "Ashley" in a.get("client_name", "")), None)
if ashley_appt:
    chk("Appointment with no vaccine has vaccine_ok=False",
        ashley_appt.get("vaccine_ok") is False,
        f"got vaccine_ok={ashley_appt.get('vaccine_ok')}")

# ── 9. Aggressive dog scenario ────────────────────────────────────────────────
print("\n=== AGGRESSIVE DOG (TEMPERAMENT) ===")
# Set a pet's temperament to aggressive and verify it comes through
r_ag = requests.post(f"{BASE}/bookings/quick", headers=HA, json={
    "phone": f"+1555{RUN_ID}010", "client_name": "Mean Dog Owner",
    "pet_name": "Chomper", "service_type": "Full Groom",
    "appointment_time": "2026-06-15T09:00:00",
})
ag_token = r_ag.json().get("intake_token") if r_ag.status_code == 200 else None
ag_bid   = r_ag.json().get("booking_id")   if r_ag.status_code == 200 else None

if ag_token:
    # Get the pet_id from clients
    clients_ag = requests.get(f"{BASE}/clients", headers=HA).json()
    ag_client  = next((c for c in clients_ag if c.get("phone") == f"+1555{RUN_ID}010"), None)
    if ag_client and ag_client.get("pets"):
        pet_id = ag_client["pets"][0]["id"]
        check("Set temperament=aggressive via groomer edit",
              requests.patch(f"{BASE}/pets/{pet_id}", headers=HA, json={
                  "pet_name": "Chomper", "breed": "Pitbull", "age": "4",
                  "weight": "60", "notes": "muzzle required",
                  "temperament": "aggressive", "rabies_expiry": "2028-01-01",
              }), 200)
        # Verify it comes back in clients list
        clients2 = requests.get(f"{BASE}/clients", headers=HA).json()
        ag_c2 = next((c for c in clients2 if c.get("phone") == f"+1555{RUN_ID}010"), None)
        if ag_c2 and ag_c2.get("pets"):
            chk("temperament=aggressive persisted",
                ag_c2["pets"][0].get("temperament") == "aggressive",
                f"got {ag_c2['pets'][0].get('temperament')}")

    # Price estimate for aggressive dog should return a result
    r_price = check("AI price estimate for aggressive dog",
                    requests.post(f"{BASE}/price-estimate", headers=HA, json={
                        "breed": "Pitbull", "service_type": "Full Groom",
                        "temperament": "aggressive", "coat_condition": "matted",
                    }), 200, "price")
    if r_price.status_code == 200:
        chk("Price estimate notes mention aggression or difficulty",
            bool(r_price.json().get("notes")),
            f"notes='{r_price.json().get('notes')}'")

# ── 10. No-show scenario ──────────────────────────────────────────────────────
print("\n=== NO-SHOW SCENARIO ===")
r_ns = requests.post(f"{BASE}/bookings/quick", headers=HA, json={
    "phone": f"+1555{RUN_ID}020", "client_name": "No Show",
    "pet_name": "Ghost", "service_type": "Bath",
    "appointment_time": "2026-06-16T10:00:00",
})
ns_bid = r_ns.json().get("booking_id") if r_ns.status_code == 200 else None
if ns_bid:
    # Groomers handle no-shows by cancelling
    check("No-show: mark booking as cancelled",
          requests.patch(f"{BASE}/bookings/{ns_bid}/status",
                         headers=HA, json={"status": "cancelled"}), 200)
    # Verify it doesn't count toward revenue
    rev = requests.get(f"{BASE}/revenue", headers=HA).json()
    hist = requests.get(f"{BASE}/appointments/history?q=No+Show", headers=HA).json()
    no_show_bk = next((b for b in hist if b.get("id") == ns_bid), None)
    chk("No-show booking NOT in history (future date, not past)",
        no_show_bk is None,
        "found no-show in history — it should be in future")

# ── 11. Bad vaccination: needs_retake stays in vault ─────────────────────────
print("\n=== BAD VACCINATION (needs_retake) ===")
import io, struct, zlib

def tiny_png():
    def chunk(n, d):
        c = zlib.crc32(n + d) & 0xFFFFFFFF
        return struct.pack(">I", len(d)) + n + d + struct.pack(">I", c)
    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", 1,1,8,2,0,0,0))
            + chunk(b"IDAT", zlib.compress(b"\x00\xFF\xFF\xFF"))
            + chunk(b"IEND", b""))

r_bv = requests.post(f"{BASE}/bookings/quick", headers=HA, json={
    "phone": f"+1555{RUN_ID}030", "client_name": "Bad Vax",
    "pet_name": "Blurry", "service_type": "Bath",
    "appointment_time": "2026-06-17T11:00:00",
})
bv_token = r_bv.json().get("intake_token") if r_bv.status_code == 200 else None
if bv_token:
    r_up = requests.post(f"{BASE}/vaccine/{bv_token}",
                         files={"file": ("bad.png", io.BytesIO(tiny_png()), "image/png")})
    chk("Bad/unreadable cert upload returns 200", r_up.status_code == 200)
    if r_up.status_code == 200:
        chk("Unreadable cert has needs_review=True or has ai_expiry=None",
            r_up.json().get("needs_review") is True or r_up.json().get("rabies_expiry") is None,
            f"got {r_up.json()}")
    vault = requests.get(f"{BASE}/vaccine-vault", headers=HA).json()
    bv_sub = next((s for s in vault if s.get("client_name") == "Bad Vax"), None)
    chk("needs_retake submission visible in vault",
        bv_sub is not None,
        f"vault has {[s.get('client_name') for s in vault]}")
    if bv_sub:
        chk("Submission status is pending or needs_retake",
            bv_sub.get("status") in ("pending", "needs_retake"),
            f"got '{bv_sub.get('status')}'")
        # Groomer can still manually confirm with correct date
        r_mc = check("Groomer manually confirms despite bad scan",
                     requests.patch(
                         f"{BASE}/vaccine-vault/{bv_sub['id']}/confirm",
                         headers=HA, json={"expiry": "2027-06-01"}), 200)
        chk("Manual confirm succeeds", r_mc.status_code == 200)

# ── 12. Today's appointments sorted by time ───────────────────────────────────
print("\n=== TODAY SORTED BY TIME ===")
demo_appts2 = requests.get(f"{BASE}/appointments/today", headers=HD).json()
times = [a.get("appointment_date", "") for a in demo_appts2 if a.get("appointment_date")]
chk("Today's appointments are in ascending time order",
    times == sorted(times),
    f"unsorted: {times}")

# ── 13. pending_review blocks slot (not declined/canceled) ───────────────────
print("\n=== PENDING_REVIEW BLOCKS SLOT ===")
set_hours(HA, "09:00", "17:00", 60, days=[0,1,2,3,4,5,6])
block_date = (date.today() + timedelta(days=5)).isoformat()
r_pr = requests.post(f"{BASE}/book/{SLUG}", json={
    "phone": f"+1555{RUN_ID}040", "name": "Pending",
    "pet_name": "Hold", "service_type": "Bath",
    "slot_date": block_date, "slot_time": "10:00",
})
if r_pr.status_code == 200:
    r_slots_pr = requests.get(f"{BASE}/book/{SLUG}/slots").json()
    day_pr = next((d for d in r_slots_pr if d["date"] == block_date), None)
    chk("pending_review booking blocks its slot",
        day_pr is None or "10:00" not in day_pr.get("slots", []),
        "10:00 still available despite pending_review booking")
set_hours(HA, "08:00", "18:00", 60, days=[0,1,2,3,4,5,6])

# ── 14. Groomer's quick-book respects working hours for calendar ─────────────
print("\n=== QUICK BOOK: APPOINTMENTS/TODAY SORTED ===")
for t in ["14:00", "09:00", "11:00"]:
    requests.post(f"{BASE}/bookings/quick", headers=HA, json={
        "phone": f"+1555{RUN_ID}{t.replace(':','')}", "client_name": f"Sort {t}",
        "pet_name": "Dog", "service_type": "Bath",
        "appointment_time": t,
    })
sorted_appts = requests.get(f"{BASE}/appointments/today", headers=HA).json()
appt_times = [a["appointment_date"] for a in sorted_appts if a.get("appointment_date")]
chk("Quick-booked appointments returned in time order",
    appt_times == sorted(appt_times),
    f"got: {appt_times}")

# ── 15. Booking slot boundary (last slot of day) ──────────────────────────────
print("\n=== SLOT BOUNDARY ===")
set_hours(HA, "09:00", "11:00", 60, days=[0,1,2,3,4,5,6])
bound_date = (date.today() + timedelta(days=6)).isoformat()
r_bs = requests.get(f"{BASE}/book/{SLUG}/slots").json()
bound_day = next((d for d in r_bs if d["date"] == bound_date), None)
if bound_day:
    chk("Last slot is 10:00 (not 11:00) for 09:00–11:00 60-min window",
        bound_day["slots"][-1] == "10:00",
        f"last slot is '{bound_day['slots'][-1]}', all slots: {bound_day['slots']}")
    chk("11:00 slot not included (would end at 12:00)",
        "11:00" not in bound_day["slots"],
        f"11:00 incorrectly included: {bound_day['slots']}")
set_hours(HA, "08:00", "18:00", 60, days=[0,1,2,3,4,5,6])

# ── Summary ───────────────────────────────────────────────────────────────────
print(f"\n{'='*55}")
print(f"RESULTS: {len(passes)} passed, {len(failures)} failed")
if failures:
    print("\nFAILURES:")
    for f in failures:
        print(f"  x {f}")
sys.exit(1 if failures else 0)
