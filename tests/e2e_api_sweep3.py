"""
Third API sweep — workflow chains and edge cases.
Focuses on: status flow, revenue calculation, slot dedup, appointment_time
parsing, profile_complete flag, vaccine_ok end-to-end, cancel+waitlist,
cross-client security, status value validation, multiple pets.

Usage: PYTHONUTF8=1 py -3.11 tests/e2e_api_sweep3.py
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


def check(name, resp, expected=200, key=None, value=None):
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
        name if ok else f"{name}: HTTP {resp.status_code} -> {resp.text[:200]}"
    )
    print(f"  [{label}] {name}")
    return resp


def chk(name, cond, detail=""):
    label = "PASS" if cond else "FAIL"
    (passes if cond else failures).append(name if cond else f"{name}: {detail}")
    print(f"  [{label}] {name}")


def tiny_png():
    def chunk(name, data):
        c = zlib.crc32(name + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + name + data + struct.pack(">I", c)
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
    idat = chunk(b"IDAT", zlib.compress(b"\x00\xFF\xFF\xFF"))
    iend = chunk(b"IEND", b"")
    return sig + ihdr + idat + iend


# Setup
demo = requests.post(f"{BASE}/auth/login", json={"email": "demo@groomnice.com", "password": "demo1234"})
HD = {"Authorization": f"Bearer {demo.json()['token']}"}

ra = requests.post(f"{BASE}/auth/register", json={
    "email": f"wf_{RUN_ID}@example.com", "password": "pass1234",
    "name": "WF Groomer", "slug": f"wf-{RUN_ID}",
})
HA = {"Authorization": f"Bearer {ra.json()['token']}"}
requests.patch(f"{BASE}/settings", headers=HA, json={
    "working_hours": {"days": [0,1,2,3,4,5,6], "start": "08:00", "end": "18:00", "slot_minutes": 60},
    "service_prices": {"Full Groom": 80, "Bath": 50, "Nail Trim": 20},
})

# ── 1. Status flow ─────────────────────────────────────────────────────────────
print("\n=== STATUS FLOW ===")
r = requests.post(f"{BASE}/bookings/quick", headers=HA, json={
    "phone": f"+1555{RUN_ID}0001", "client_name": "Status Client",
    "pet_name": "Rex", "service_type": "Full Groom", "appointment_time": "10:00",
})
chk("Quick book (HH:MM time)", r.status_code == 200)
bid = r.json().get("booking_id") if r.status_code == 200 else None

if bid:
    # Verify appointment_time was parsed correctly (should be 10:00)
    appts = requests.get(f"{BASE}/appointments/today", headers=HA).json()
    our = next((a for a in appts if a["id"] == bid), None)
    if our:
        chk("Quick book HH:MM → correct hour",
            our.get("appointment_date", "").endswith("T10:00:00") or "10:00" in (our.get("appointment_date") or ""),
            f"got '{our.get('appointment_date')}'")

    # Full status progression
    for status in ["in_progress", "completed"]:
        check(f"PATCH status -> {status}", requests.patch(
            f"{BASE}/bookings/{bid}/status", headers=HA, json={"status": status}), 200)

    # Verify completed booking appears in history (not today endpoint since it's today)
    appts2 = requests.get(f"{BASE}/appointments/today", headers=HA).json()
    our2 = next((a for a in appts2 if a["id"] == bid), None)
    chk("Completed booking still appears with status=completed",
        our2 and our2.get("status") == "completed",
        f"status={our2.get('status') if our2 else 'not found'}")

# ── 2. Status validation ───────────────────────────────────────────────────────
print("\n=== STATUS VALIDATION ===")
r2 = requests.post(f"{BASE}/bookings/quick", headers=HA, json={
    "phone": f"+1555{RUN_ID}0002", "client_name": "Val Client",
    "pet_name": "Boo", "service_type": "Bath", "appointment_time": "11:00",
})
bid2 = r2.json().get("booking_id") if r2.status_code == 200 else None
if bid2:
    r_bad = requests.patch(f"{BASE}/bookings/{bid2}/status", headers=HA,
                           json={"status": "hacked_value"})
    # This SHOULD reject invalid status — let's see if it does
    chk("PATCH invalid status value is rejected (400/422)",
        r_bad.status_code in (400, 422),
        f"got {r_bad.status_code}: {r_bad.text[:100]}")

# ── 3. Revenue reflects completed bookings ─────────────────────────────────────
print("\n=== REVENUE CALCULATION ===")
rev_before = requests.get(f"{BASE}/revenue", headers=HA).json()
today_rev_before = rev_before.get("today", {}).get("revenue", 0)

r3 = requests.post(f"{BASE}/bookings/quick", headers=HA, json={
    "phone": f"+1555{RUN_ID}0003", "client_name": "Rev Client",
    "pet_name": "Cash", "service_type": "Full Groom", "appointment_time": "12:00",
})
bid3 = r3.json().get("booking_id") if r3.status_code == 200 else None
if bid3:
    requests.patch(f"{BASE}/bookings/{bid3}/status", headers=HA, json={"status": "completed"})
    rev_after = requests.get(f"{BASE}/revenue", headers=HA).json()
    today_rev_after = rev_after.get("today", {}).get("revenue", 0)
    chk("Revenue increases after completing booking",
        today_rev_after > today_rev_before,
        f"before={today_rev_before}, after={today_rev_after}")
    chk("Completed booking counted in today.count",
        rev_after.get("today", {}).get("count", 0) > rev_before.get("today", {}).get("count", 0),
        f"before count={rev_before.get('today',{}).get('count')}, after={rev_after.get('today',{}).get('count')}")

# ── 4. Quick book with ISO datetime ───────────────────────────────────────────
print("\n=== APPOINTMENT TIME PARSING ===")
r_iso = requests.post(f"{BASE}/bookings/quick", headers=HA, json={
    "phone": f"+1555{RUN_ID}0004", "client_name": "ISO Client",
    "pet_name": "Iso", "service_type": "Bath",
    "appointment_time": "2026-06-01T14:00:00",  # ISO format
})
chk("Quick book with ISO datetime returns 200", r_iso.status_code == 200)
if r_iso.status_code == 200:
    bid_iso = r_iso.json()["booking_id"]
    appts_iso = requests.get(f"{BASE}/appointments/today", headers=HA).json()
    our_iso = next((a for a in appts_iso if a["id"] == bid_iso), None)
    if our_iso:
        appt_date = our_iso.get("appointment_date", "")
        chk("Quick book ISO datetime parses date correctly (not today 09:00)",
            "2026-06-01" in appt_date,
            f"got '{appt_date}' — expected date 2026-06-01")

# ── 5. Slot dedup: booked slot disappears from available ──────────────────────
print("\n=== SLOT DEDUP ===")
slots_before = requests.get(f"{BASE}/book/wf-{RUN_ID}/slots").json()
first_slot = None
for day in slots_before:
    if day.get("slots"):
        first_slot = (day["date"], day["slots"][0])
        break

if first_slot:
    slot_date, slot_time = first_slot
    r_book = requests.post(f"{BASE}/book/wf-{RUN_ID}", json={
        "phone": f"+1555{RUN_ID}0005", "name": "Slot Taker",
        "pet_name": "Blocker", "service_type": "Bath",
        "slot_date": slot_date, "slot_time": slot_time,
    })
    chk("Online book succeeds", r_book.status_code == 200)

    slots_after = requests.get(f"{BASE}/book/wf-{RUN_ID}/slots").json()
    # Check the booked slot is no longer available
    taken_still_available = any(
        d["date"] == slot_date and slot_time in d.get("slots", [])
        for d in slots_after
    )
    chk(f"Booked slot {slot_date} {slot_time} removed from available slots",
        not taken_still_available,
        f"slot {slot_time} still appears in available slots for {slot_date}")

    # Book the same slot again → should still succeed (no double-book guard)
    r_book2 = requests.post(f"{BASE}/book/wf-{RUN_ID}", json={
        "phone": f"+1555{RUN_ID}0006", "name": "Double Booker",
        "pet_name": "Overlap", "service_type": "Full Groom",
        "slot_date": slot_date, "slot_time": slot_time,
    })
    chk("Double-booking same slot is REJECTED (400/409)",
        r_book2.status_code in (400, 409),
        f"got {r_book2.status_code} — double-booking accepted silently")

# ── 6. Declined booking frees the slot ────────────────────────────────────────
print("\n=== DECLINED BOOKING FREES SLOT ===")
slots_b4 = requests.get(f"{BASE}/book/wf-{RUN_ID}/slots").json()
second_slot = None
for day in slots_b4:
    if day.get("slots"):
        second_slot = (day["date"], day["slots"][0])
        break

if second_slot:
    sd, st = second_slot
    r_ob = requests.post(f"{BASE}/book/wf-{RUN_ID}", json={
        "phone": f"+1555{RUN_ID}0007", "name": "Decline Me",
        "pet_name": "Bye", "service_type": "Bath",
        "slot_date": sd, "slot_time": st,
    })
    if r_ob.status_code == 200:
        dec_id = r_ob.json()["booking_id"]
        requests.patch(f"{BASE}/bookings/{dec_id}/status", headers=HA, json={"status": "declined"})
        slots_after_decline = requests.get(f"{BASE}/book/wf-{RUN_ID}/slots").json()
        slot_freed = any(
            d["date"] == sd and st in d.get("slots", [])
            for d in slots_after_decline
        )
        chk(f"Declined booking frees slot {sd} {st}",
            slot_freed,
            "slot not re-appearing after decline")

# ── 7. Cancel booking triggers gap fill (no crash) ───────────────────────────
print("\n=== CANCEL + GAP FILL ===")
requests.patch(f"{BASE}/settings", headers=HA, json={"send_gap_fill_text": True})
requests.post(f"{BASE}/waitlist", headers=HA, json={"phone": "+15550000001", "name": "WL Person"})
r_c = requests.post(f"{BASE}/bookings/quick", headers=HA, json={
    "phone": f"+1555{RUN_ID}0008", "client_name": "Cancel Me",
    "pet_name": "Gone", "service_type": "Bath", "appointment_time": "13:00",
})
if r_c.status_code == 200:
    r_cancel = check("PATCH status -> cancelled (triggers gap fill)",
                     requests.patch(f"{BASE}/bookings/{r_c.json()['booking_id']}/status",
                                    headers=HA, json={"status": "cancelled"}), 200)

# ── 8. Full vaccine_ok end-to-end ─────────────────────────────────────────────
print("\n=== FULL VACCINE_OK FLOW ===")
r_vb = requests.post(f"{BASE}/bookings/quick", headers=HA, json={
    "phone": f"+1555{RUN_ID}0009", "client_name": "Vaccine Journey",
    "pet_name": "Jabby", "service_type": "Full Groom", "appointment_time": "14:00",
})
vax_token = r_vb.json().get("intake_token") if r_vb.status_code == 200 else None
vax_bid = r_vb.json().get("booking_id") if r_vb.status_code == 200 else None

if vax_token and vax_bid:
    # Initially vaccine_ok should be False
    appts = requests.get(f"{BASE}/appointments/today", headers=HA).json()
    our_a = next((a for a in appts if a["id"] == vax_bid), None)
    chk("vaccine_ok starts False", our_a and our_a.get("vaccine_ok") is False,
        f"got {our_a.get('vaccine_ok') if our_a else 'not found'}")

    # Upload vaccine cert
    r_upload = requests.post(
        f"{BASE}/vaccine/{vax_token}",
        files={"file": ("cert.png", io.BytesIO(tiny_png()), "image/png")},
    )
    chk("Vaccine upload succeeds", r_upload.status_code == 200)

    # Groomer confirms via vault
    vault = requests.get(f"{BASE}/vaccine-vault", headers=HA).json()
    our_sub = next((s for s in vault if s.get("client_name") == "Vaccine Journey"), None)
    chk("Submission appears in vault", our_sub is not None,
        f"vault has {[s.get('client_name') for s in vault]}")

    if our_sub:
        requests.patch(f"{BASE}/vaccine-vault/{our_sub['id']}/confirm",
                       headers=HA, json={"expiry": "2029-01-01"})
        # Now vaccine_ok should be True
        appts2 = requests.get(f"{BASE}/appointments/today", headers=HA).json()
        our_a2 = next((a for a in appts2 if a["id"] == vax_bid), None)
        chk("vaccine_ok is True after vault confirm",
            our_a2 and our_a2.get("vaccine_ok") is True,
            f"got {our_a2.get('vaccine_ok') if our_a2 else 'not found'}")
        chk("ready is True when vaccine_ok + deposit_ok",
            our_a2 and our_a2.get("ready") is True,
            f"ready={our_a2.get('ready') if our_a2 else 'not found'}")

# ── 9. profile_complete flag ──────────────────────────────────────────────────
print("\n=== PROFILE COMPLETE FLAG ===")
r_pb = requests.post(f"{BASE}/bookings/quick", headers=HA, json={
    "phone": f"+1555{RUN_ID}0010", "client_name": "Profile Tester",
    "pet_name": "Fluffy", "service_type": "Bath", "appointment_time": "15:00",
})
prof_token = r_pb.json().get("intake_token") if r_pb.status_code == 200 else None
prof_bid = r_pb.json().get("booking_id") if r_pb.status_code == 200 else None

if prof_token and prof_bid:
    # Before: profile_complete should be False
    appts_p = requests.get(f"{BASE}/appointments/today", headers=HA).json()
    our_p = next((a for a in appts_p if a["id"] == prof_bid), None)
    chk("profile_complete starts False", our_p and our_p.get("profile_complete") is False,
        f"got {our_p.get('profile_complete') if our_p else 'not found'}")

    # Fill profile
    requests.put(f"{BASE}/profile/{prof_token}", json={
        "pet_name": "Fluffy", "breed": "Poodle", "age": "3",
        "weight": "20", "emergency_contact": "555-0000", "notes": "gentle",
    })

    # After: profile_complete should be True
    appts_p2 = requests.get(f"{BASE}/appointments/today", headers=HA).json()
    our_p2 = next((a for a in appts_p2 if a["id"] == prof_bid), None)
    chk("profile_complete is True after PUT /profile",
        our_p2 and our_p2.get("profile_complete") is True,
        f"got {our_p2.get('profile_complete') if our_p2 else 'not found'}")

# ── 10. Multiple pets on profile ──────────────────────────────────────────────
print("\n=== MULTIPLE PETS ===")
r_mp = requests.post(f"{BASE}/bookings/quick", headers=HA, json={
    "phone": f"+1555{RUN_ID}0011", "client_name": "Multi Pet Owner",
    "pet_name": "Pet1", "service_type": "Bath", "appointment_time": "16:00",
})
mp_token = r_mp.json().get("intake_token") if r_mp.status_code == 200 else None

if mp_token:
    for i in range(2, 5):
        check(f"Add pet #{i}", requests.post(f"{BASE}/profile/{mp_token}/pets",
              json={"pet_name": f"Pet{i}", "breed": "Labrador"}), 200)

    profile = requests.get(f"{BASE}/profile/{mp_token}").json()
    pet_count = len(profile.get("pets", []))
    chk("Profile has 4 pets after adding 3 more", pet_count == 4,
        f"got {pet_count} pets")

    # Cross-client pet security: get a pet_id from another client
    other_token = vax_token  # from vaccine journey client above
    if other_token:
        other_profile = requests.get(f"{BASE}/profile/{other_token}").json()
        if other_profile.get("pets"):
            other_pet_id = other_profile["pets"][0]["id"]
            r_cross = requests.put(
                f"{BASE}/profile/{mp_token}/pets/{other_pet_id}",
                json={"pet_name": "Stolen", "breed": "Hacker"},
            )
            chk("Cross-client pet update rejected (404)",
                r_cross.status_code == 404,
                f"got {r_cross.status_code}: {r_cross.text[:100]}")

# ── 11. Vaccine upload with no pets ───────────────────────────────────────────
print("\n=== VACCINE UPLOAD: NO PETS ===")
# Register a totally fresh client by creating a booking with no pet_name
r_np = requests.post(f"{BASE}/bookings/quick", headers=HA, json={
    "phone": f"+1555{RUN_ID}0012", "client_name": "No Pet Client",
    "pet_name": "", "service_type": "Bath", "appointment_time": "09:00",
})
np_token = r_np.json().get("intake_token") if r_np.status_code == 200 else None
if np_token:
    r_npu = check("Vaccine upload with no pets does not crash",
                  requests.post(f"{BASE}/vaccine/{np_token}",
                                files={"file": ("cert.png", io.BytesIO(tiny_png()), "image/png")}),
                  200)

# ── 12. Online booking pending confirm/decline ─────────────────────────────────
print("\n=== ONLINE BOOKING CONFIRM / DECLINE ===")
r_ob2 = requests.post(f"{BASE}/book/wf-{RUN_ID}", json={
    "phone": f"+1555{RUN_ID}0013", "name": "Pending Review",
    "pet_name": "TBD", "service_type": "Bath",
    "slot_date": "2026-06-10", "slot_time": "09:00",
})
if r_ob2.status_code == 200:
    pending_id = r_ob2.json()["booking_id"]
    check("Confirm pending_review booking",
          requests.patch(f"{BASE}/bookings/{pending_id}/status",
                         headers=HA, json={"status": "confirmed"}), 200)

r_ob3 = requests.post(f"{BASE}/book/wf-{RUN_ID}", json={
    "phone": f"+1555{RUN_ID}0014", "name": "To Decline",
    "pet_name": "Rejected", "service_type": "Full Groom",
    "slot_date": "2026-06-11", "slot_time": "09:00",
})
if r_ob3.status_code == 200:
    decline_id = r_ob3.json()["booking_id"]
    check("Decline pending_review booking",
          requests.patch(f"{BASE}/bookings/{decline_id}/status",
                         headers=HA, json={"status": "declined"}), 200)

# ── 13. History excludes today's bookings ─────────────────────────────────────
print("\n=== HISTORY EXCLUDES TODAY ===")
# Quick book something today, it should NOT appear in history
r_today = requests.post(f"{BASE}/bookings/quick", headers=HA, json={
    "phone": f"+1555{RUN_ID}0015", "client_name": "Today Only",
    "pet_name": "Now", "service_type": "Bath", "appointment_time": "08:00",
})
if r_today.status_code == 200:
    today_bid = r_today.json()["booking_id"]
    hist = requests.get(f"{BASE}/appointments/history?q=Today+Only", headers=HA).json()
    chk("Today's booking does NOT appear in history",
        not any(b["id"] == today_bid for b in hist),
        f"found today's booking in history")

# ── 14. Onboarding redirect: complete=False -> settings says so ───────────────
print("\n=== ONBOARDING STATE ===")
rb2 = requests.post(f"{BASE}/auth/register", json={
    "email": f"ob_{RUN_ID}@example.com", "password": "pass1234",
    "name": "OB Groomer", "slug": f"ob-{RUN_ID}",
})
HOB = {"Authorization": f"Bearer {rb2.json()['token']}"}
r_s = requests.get(f"{BASE}/settings", headers=HOB)
chk("Brand new groomer: onboarding_complete is False",
    r_s.json().get("onboarding_complete") is False,
    f"got {r_s.json().get('onboarding_complete')}")
requests.patch(f"{BASE}/settings", headers=HOB, json={"onboarding_complete": True})
r_s2 = requests.get(f"{BASE}/settings", headers=HOB)
chk("onboarding_complete persists as True after PATCH",
    r_s2.json().get("onboarding_complete") is True,
    f"got {r_s2.json().get('onboarding_complete')}")

# ── 15. Admin X-Admin-Key header (not just query param) ──────────────────────
print("\n=== ADMIN KEY HEADER ===")
check("Admin overview via X-Admin-Key header",
      requests.get(f"{BASE}/admin/overview",
                   headers={"X-Admin-Key": "admin-dev"}), 200, "total_groomers")
check("Admin overview wrong header key -> 403",
      requests.get(f"{BASE}/admin/overview",
                   headers={"X-Admin-Key": "wrong"}), 403)

# ── Summary ────────────────────────────────────────────────────────────────────
print(f"\n{'='*55}")
print(f"RESULTS: {len(passes)} passed, {len(failures)} failed")
if failures:
    print("\nFAILURES:")
    for f in failures:
        print(f"  x {f}")
sys.exit(1 if failures else 0)
