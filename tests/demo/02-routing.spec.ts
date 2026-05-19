/**
 * Demo: Smart Route Optimization
 *
 * Mobile groomer with 5 clients spread across Austin TX.
 * Route API response is mocked with realistic nearest-neighbor ordering
 * and OSRM drive times so the demo is always crisp regardless of geocoding.
 *
 * Optimized order (nearest-neighbor from groomer base at 30.27, -97.74):
 *   1. Jane Smith     — N Lamar Blvd       → 6 min drive
 *   2. Tom Bradley    — Shoal Creek Blvd   → 11 min drive
 *   3. Priya Nair     — FM 620 N           → 14 min drive
 *   4. Marco Rivera   — Bee Cave Rd        → 18 min (loop back west)
 *   5. Derek Walsh    — S Congress Ave     → 22 min (south end)
 */
import { test, expect } from "@playwright/test";
import { loginAsGroomer, seedFresh } from "./helpers";

const TODAY = new Date().toISOString().slice(0, 10);

const MOCK_ROUTE = {
  stops: [
    {
      booking_id: "s1", client_name: "Jane Smith",   pet_name: "Biscuit",
      service_type: "Full Groom",  appointment_date: `${TODAY}T09:00:00`,
      address: "1205 N Lamar Blvd, Austin, TX 78703",
      lat: 30.2797, lng: -97.7415, distance_km: 2.1, duration_minutes: 6,
    },
    {
      booking_id: "s2", client_name: "Tom Bradley",  pet_name: "Rex",
      service_type: "Full Groom",  appointment_date: `${TODAY}T11:30:00`,
      address: "4501 Shoal Creek Blvd, Austin, TX 78756",
      lat: 30.3193, lng: -97.7302, distance_km: 4.8, duration_minutes: 11,
    },
    {
      booking_id: "s3", client_name: "Priya Nair",   pet_name: "Coco",
      service_type: "Bath",        appointment_date: `${TODAY}T13:00:00`,
      address: "6900 N FM 620, Austin, TX 78726",
      lat: 30.3823, lng: -97.7413, distance_km: 7.2, duration_minutes: 14,
    },
    {
      booking_id: "s4", client_name: "Marco Rivera", pet_name: "Luna",
      service_type: "Bath & Cut",  appointment_date: `${TODAY}T10:00:00`,
      address: "3201 Bee Cave Rd, Austin, TX 78746",
      lat: 30.2612, lng: -97.8001, distance_km: 12.4, duration_minutes: 18,
    },
    {
      booking_id: "s5", client_name: "Derek Walsh",  pet_name: "Baxter",
      service_type: "Bath & Cut",  appointment_date: `${TODAY}T14:30:00`,
      address: "2100 S Congress Ave, Austin, TX 78704",
      lat: 30.2350, lng: -97.7508, distance_km: 8.1, duration_minutes: 16,
    },
  ],
  has_locations: true,
  geo_count: 5,
};

test.beforeAll(async ({ request }) => {
  const token = await seedFresh(request);
  // Enable mobile mode so the Route view toggle is visible in DayView
  await request.patch("/api/settings", {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    data: { is_mobile: true },
  });
});

test("smart route optimization workflow", async ({ page }) => {
  // Intercept route API before any navigation
  await page.route("**/api/route/today", route =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(MOCK_ROUTE) })
  );

  await loginAsGroomer(page);
  // is_mobile was set to true in beforeAll via API — dashboard now shows Route toggle

  // ── Show List view briefly ───────────────────────────────────────────────────
  await expect(page.locator('button[aria-label="List view"]')).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(1000);

  // ── Switch to Route view ─────────────────────────────────────────────────────
  await page.locator('button[aria-label="Route view"]').hover();
  await page.waitForTimeout(500);
  await page.locator('button[aria-label="Route view"]').click();
  await page.waitForTimeout(1800);

  // ── Show route header (X of N stops mapped) ──────────────────────────────────
  const routeHeader = page.getByText(/\d+ of \d+ stops mapped/i);
  if (await routeHeader.isVisible({ timeout: 5000 })) {
    await routeHeader.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
  }

  // ── Scroll through route stops slowly ───────────────────────────────────────
  for (let i = 0; i < 3; i++) {
    await page.mouse.wheel(0, 220);
    await page.waitForTimeout(900);
  }

  // ── Hover "Open in Maps" ─────────────────────────────────────────────────────
  const mapsBtn = page.getByRole("button", { name: /open in maps/i });
  if (await mapsBtn.isVisible({ timeout: 3000 })) {
    await mapsBtn.scrollIntoViewIfNeeded();
    await mapsBtn.hover();
    await page.waitForTimeout(1500);
  }

  // ── Hover Refresh ────────────────────────────────────────────────────────────
  const refreshBtn = page.getByRole("button", { name: /refresh/i });
  if (await refreshBtn.isVisible({ timeout: 2000 })) {
    await refreshBtn.hover();
    await page.waitForTimeout(800);
  }

  await page.waitForTimeout(1000);
});
