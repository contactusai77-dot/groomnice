/**
 * Demo: Deposit Protection for No-Shows
 *
 * Pre-seeded scenario:
 *   • Settings: require_deposit=true, deposit_amount=$25
 *   • Ashley Chen / Mochi (Nail Trim, 10:30) — pending_payment → "No Deposit"
 *   • Derek Walsh / Baxter (Bath & Cut, 14:30) — pending_payment → "No Deposit"
 *   • A new "Sarah Murphy / Max" booking (confirmed, deposit paid) that we
 *     later cancel to demonstrate the no-show flow.
 *
 * Recording flow:
 *   1. Settings → show $25 deposit requirement
 *   2. Dashboard → "No Deposit" badges on Ashley + Derek
 *   3. Derek receives cash → click "Mark Paid" → flips to "Ready"
 *   4. Sarah Murphy booking — client is a no-show → API marks cancelled
 *   5. Dashboard refresh → "Cancelled" badge, $25 deposit is kept
 */
import { test, expect } from "@playwright/test";
import { loginAsGroomer, seedFresh } from "./helpers";

let noShowBookingId = "";

test.beforeAll(async ({ request }) => {
  const token = await seedFresh(request);

  // Create a "Sarah Murphy" booking pre-confirmed (deposit already paid)
  const res = await request.post("/api/bookings/quick", {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    data: {
      phone: "5550009911",
      client_name: "Sarah Murphy",
      pet_name: "Max",
      service_type: "Full Groom",
      appointment_time: "12:00",
    },
  });

  if (res.ok()) {
    const data = await res.json();
    // quick-book creates "confirmed" bookings; store the booking id for later cancel
    // We need to find the booking via appointments list
  }

  // Fetch today's appointments to find Sarah's booking id
  const appts = await request.get("/api/appointments/today", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const list = await appts.json() as any[];
  const sarah = list.find(a => a.client_name === "Sarah Murphy");
  if (sarah) noShowBookingId = sarah.id;
});

test("deposit protection & no-show workflow", async ({ page }) => {
  await loginAsGroomer(page);

  // ── Step 1: Settings — show deposit is required ($25) ────────────────────────
  await page.getByRole("button", { name: /settings/i }).click();
  await page.waitForTimeout(1000);

  const depositSection = page.getByText(/deposit/i).first();
  await expect(depositSection).toBeVisible({ timeout: 8000 });
  await depositSection.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);

  // Show deposit amount input
  const depositInput = page.locator("input[type='number']").filter({ hasText: "" }).first();
  const depositToggle = page.locator("input[type='checkbox']").first();
  if (await depositToggle.isVisible({ timeout: 2000 })) {
    await depositToggle.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
  }
  await page.waitForTimeout(1200);

  // ── Step 2: Dashboard — show "No Deposit" badges ─────────────────────────────
  await page.getByRole("button", { name: /^today$/i }).click()
    .catch(() => page.goto("/"));
  await page.waitForURL(/\/(dashboard|today|\?|$)/, { timeout: 10_000 });
  await page.waitForTimeout(1200);

  // Scroll through cards until "No Deposit" badge is visible
  const noDepositBadge = page.getByText(/no deposit/i).first();
  if (await noDepositBadge.isVisible({ timeout: 5000 })) {
    await noDepositBadge.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
  }

  // Scroll down further to find Derek / Baxter's Mark Paid button
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(600);

  const markPaidBtn = page.getByRole("button", { name: /mark paid/i }).first();
  if (await markPaidBtn.isVisible({ timeout: 5000 })) {
    await markPaidBtn.scrollIntoViewIfNeeded();
    await markPaidBtn.hover();
    await page.waitForTimeout(800);

    // ── Step 3: Client pays — click Mark Paid ────────────────────────────────
    await markPaidBtn.click();
    await page.waitForTimeout(1500);

    // Badge should now be "Ready"
    const readyBadge = page.getByText("Ready").first();
    if (await readyBadge.isVisible({ timeout: 5000 })) {
      await readyBadge.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1200);
    }
  }

  // ── Step 4: Sarah Murphy no-show — cancel via API and reload ─────────────────
  if (noShowBookingId) {
    await page.evaluate(async (id) => {
      const t = localStorage.getItem("token") ?? "";
      await fetch(`/api/bookings/${id}/status`, {  // PATCH → cancelled
        method: "PATCH",
        headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
    }, noShowBookingId);

    await page.reload();
    await page.waitForURL(/\/(dashboard|today|\?|$)/, { timeout: 10_000 });
    await page.waitForTimeout(1200);

    // Show the cancelled card — $25 deposit was already taken and kept
    const cancelledBadge = page.getByText(/cancel/i).first();
    if (await cancelledBadge.isVisible({ timeout: 5000 })) {
      await cancelledBadge.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1800);
    }
  }
});
