/**
 * Demo: Deposit Protection for No-Shows
 *
 * Three scenarios shown back-to-back:
 *   Scenario A — Client pays deposit upfront → status flips to "Ready"
 *   Scenario B — Client books but skips deposit → "No Deposit" warning badge
 *                → groomer collects cash on arrival → Mark Paid → "Ready"
 *   Scenario C — Confirmed client is a no-show → appointment cancelled
 *                → $25 deposit is already collected and kept by the groomer
 *
 * Pre-seeded state (from /api/seed):
 *   • require_deposit=true, deposit_amount=25
 *   • Ashley Chen / Mochi (Nail Trim, 10:30) — pending_payment → "No Deposit"
 *   • Derek Walsh / Baxter (Bath & Cut, 14:30) — pending_payment → "No Deposit"
 *   • Sarah Murphy / Max — created in beforeAll as a confirmed booking (deposit
 *     already paid) that we cancel mid-demo to show the no-show flow.
 */
import { test, expect } from "@playwright/test";
import { loginAsGroomer, seedFresh, showCaption } from "./helpers";

let noShowBookingId = "";

test.beforeAll(async ({ request }) => {
  const token = await seedFresh(request);

  // Create Sarah Murphy as a quick-book (confirmed, deposit paid)
  await request.post("/api/bookings/quick", {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    data: {
      phone: "5550009911",
      client_name: "Sarah Murphy",
      pet_name: "Max",
      service_type: "Full Groom",
      appointment_time: "12:00",
    },
  });

  // Find Sarah's booking id
  const appts = await request.get("/api/appointments/today", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const list = (await appts.json()) as any[];
  const sarah = list.find(a => a.client_name === "Sarah Murphy");
  if (sarah) noShowBookingId = sarah.id;
});

test("deposit protection & no-show — 3 scenarios", async ({ page }) => {
  await loginAsGroomer(page);

  // ── Settings: show $25 deposit requirement ────────────────────────────────────
  await showCaption(page, "$25 deposit required to hold every appointment slot", 2800, "scenario");

  await page.getByRole("button", { name: /settings/i }).click();
  await page.waitForTimeout(1000);

  const depositSection = page.getByText(/deposit/i).first();
  await expect(depositSection).toBeVisible({ timeout: 8000 });
  await depositSection.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);

  const depositToggle = page.locator("input[type='checkbox']").first();
  if (await depositToggle.isVisible({ timeout: 2000 })) {
    await depositToggle.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
  }
  await page.waitForTimeout(800);

  // ── Navigate to dashboard ─────────────────────────────────────────────────────
  await page.getByRole("button", { name: /^today$/i }).click()
    .catch(() => page.goto("/"));
  await page.waitForURL(/\/(dashboard|today|\?|$)/, { timeout: 10_000 });
  await page.waitForTimeout(1200);

  // ── Scenario A: Client paid deposit → "Ready" badge ──────────────────────────
  await showCaption(page, "Scenario A: Client pays deposit online → slot confirmed ✅", 3000, "scenario");
  await page.waitForTimeout(500);

  // Look for a "Ready" badge (confirmed booking = deposit ok)
  const readyBadge = page.getByText("Ready").first();
  if (await readyBadge.isVisible({ timeout: 5000 })) {
    await readyBadge.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
  }
  await showCaption(page, "Deposit collected — groomer can focus on grooming", 2400, "note");

  // ── Scenario B: No deposit paid → "No Deposit" badge ─────────────────────────
  await showCaption(page, "Scenario B: Client books but skips the deposit payment", 3000, "scenario");

  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(600);

  const noDepositBadge = page.getByText(/no deposit/i).first();
  if (await noDepositBadge.isVisible({ timeout: 5000 })) {
    await noDepositBadge.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
  }

  await showCaption(page, "⚠️  'No Deposit' badge flags the risk before the appointment", 2800, "note");

  // Client pays in cash on arrival → Mark Paid
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(500);

  const markPaidBtn = page.getByRole("button", { name: /mark paid/i }).first();
  if (await markPaidBtn.isVisible({ timeout: 5000 })) {
    await markPaidBtn.scrollIntoViewIfNeeded();
    await markPaidBtn.hover();
    await page.waitForTimeout(800);
    await showCaption(page, "Client arrives and pays cash → groomer clicks 'Mark Paid'", 2600, "note");
    await markPaidBtn.click();
    await page.waitForTimeout(1500);

    const readyAfterPay = page.getByText("Ready").first();
    if (await readyAfterPay.isVisible({ timeout: 5000 })) {
      await readyAfterPay.scrollIntoViewIfNeeded();
      await showCaption(page, "✅ Badge flips to 'Ready' — appointment proceeds", 2600, "note");
    }
  }

  // ── Scenario C: No-show — cancel via API and reload ──────────────────────────
  await showCaption(page, "Scenario C: Confirmed client doesn't show up", 3000, "scenario");

  if (noShowBookingId) {
    await page.evaluate(async (id) => {
      const t = localStorage.getItem("token") ?? "";
      await fetch(`/api/bookings/${id}/status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
    }, noShowBookingId);

    await page.reload();
    await page.waitForURL(/\/(dashboard|today|\?|$)/, { timeout: 10_000 });
    await page.waitForTimeout(1200);

    await showCaption(page, "Groomer marks the appointment cancelled", 2400, "note");

    const cancelledBadge = page.getByText(/cancel/i).first();
    if (await cancelledBadge.isVisible({ timeout: 5000 })) {
      await cancelledBadge.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
    }

    await showCaption(
      page,
      "✅ Appointment cancelled — $25 deposit already collected & kept",
      3400,
      "scenario"
    );
    await page.waitForTimeout(1000);
  }
});
