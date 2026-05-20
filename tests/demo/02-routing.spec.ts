/**
 * Demo: Smart Route Optimization
 *
 * Scenario shown in three beats:
 *   Beat 1 — Unoptimized (time-sorted): 5 Austin stops in appointment order →
 *             crisscross driving → ~127 min total drive time
 *   Beat 2 — Groomnice optimizer runs (nearest-neighbor from groomer base)
 *   Beat 3 — Optimized route: same 5 stops, logical geographic order →
 *             ~65 min total drive time  (saves ~62 minutes)
 *
 * The /api/route/today endpoint is mocked so the demo is crisp regardless
 * of Mapbox token availability.
 */
import { test, expect } from "@playwright/test";
import { loginAsGroomer, seedFresh, showCaption } from "./helpers";

const TODAY = new Date().toISOString().slice(0, 10);

// Time-sorted (appointment order) — shows inefficient crisscross driving
const UNOPTIMIZED_ROUTE = {
  stops: [
    {
      booking_id: "s1", client_name: "Jane Smith",   pet_name: "Biscuit",
      service_type: "Full Groom",  appointment_date: `${TODAY}T09:00:00`,
      address: "1205 N Lamar Blvd, Austin, TX 78703",
      lat: 30.2797, lng: -97.7415, distance_km: 2.1, duration_minutes: 6,
    },
    {
      booking_id: "s4", client_name: "Marco Rivera", pet_name: "Luna",
      service_type: "Bath & Cut",  appointment_date: `${TODAY}T10:00:00`,
      address: "3201 Bee Cave Rd, Austin, TX 78746",
      lat: 30.2612, lng: -97.8001, distance_km: 18.3, duration_minutes: 31,
    },
    {
      booking_id: "s2", client_name: "Tom Bradley",  pet_name: "Rex",
      service_type: "Full Groom",  appointment_date: `${TODAY}T11:30:00`,
      address: "4501 Shoal Creek Blvd, Austin, TX 78756",
      lat: 30.3193, lng: -97.7302, distance_km: 22.7, duration_minutes: 38,
    },
    {
      booking_id: "s3", client_name: "Priya Nair",   pet_name: "Coco",
      service_type: "Bath",        appointment_date: `${TODAY}T13:00:00`,
      address: "6900 N FM 620, Austin, TX 78726",
      lat: 30.3823, lng: -97.7413, distance_km: 15.9, duration_minutes: 27,
    },
    {
      booking_id: "s5", client_name: "Derek Walsh",  pet_name: "Baxter",
      service_type: "Bath & Cut",  appointment_date: `${TODAY}T14:30:00`,
      address: "2100 S Congress Ave, Austin, TX 78704",
      lat: 30.2350, lng: -97.7508, distance_km: 14.6, duration_minutes: 25,
    },
  ],
  has_locations: true,
  geo_count: 5,
};

// Nearest-neighbor from groomer base (30.27, -97.74) — minimal total drive
const OPTIMIZED_ROUTE = {
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
  await request.patch("/api/settings", {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    data: { is_mobile: true },
  });
});

test("smart route optimization — before & after", async ({ page }) => {
  await loginAsGroomer(page);

  // ── Beat 1: Unoptimized route (time-sorted, crisscross driving) ──────────────
  await page.route("**/api/route/today", route =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(UNOPTIMIZED_ROUTE) })
  );

  await showCaption(page, "Today: 5 mobile grooming stops across Austin TX", 2400, "scenario");

  await expect(page.locator('button[aria-label="List view"]')).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(800);

  await page.locator('button[aria-label="Route view"]').click();
  await page.waitForTimeout(1800);

  await showCaption(page, "Without optimization — appointments sorted by time only", 2600, "scenario");

  // Scroll slowly through the unoptimized stops
  const routeHeader = page.getByText(/\d+ of \d+ stops mapped/i);
  if (await routeHeader.isVisible({ timeout: 5000 })) {
    await routeHeader.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
  }

  for (let i = 0; i < 3; i++) {
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(800);
  }

  await showCaption(page, "❌ Crisscross driving: ~127 min total drive time", 3000, "note");
  await page.waitForTimeout(600);

  // Scroll back to top before switching route mock
  await page.mouse.wheel(0, -1000);
  await page.waitForTimeout(700);

  // ── Beat 2: Optimizer runs ────────────────────────────────────────────────────
  await showCaption(page, "Nearest-neighbor algorithm groups stops geographically…", 3000, "scenario");

  // Swap route mock to optimized version then click Refresh
  await page.unroute("**/api/route/today");
  await page.route("**/api/route/today", route =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(OPTIMIZED_ROUTE) })
  );

  const refreshBtn = page.getByRole("button", { name: /refresh/i });
  if (await refreshBtn.isVisible({ timeout: 3000 })) {
    await refreshBtn.hover();
    await page.waitForTimeout(500);
    await refreshBtn.click();
    await page.waitForTimeout(2000);
  }

  // ── Beat 3: Optimized route — tight geographic order ─────────────────────────
  await showCaption(page, "✅ Optimized route — logical geographic order", 2800, "scenario");

  if (await routeHeader.isVisible({ timeout: 5000 })) {
    await routeHeader.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
  }

  for (let i = 0; i < 3; i++) {
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(900);
  }

  await showCaption(page, "~65 min total drive time — saves 62 minutes per day", 3200, "note");

  // ── Open in Maps button ───────────────────────────────────────────────────────
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(500);

  const mapsBtn = page.getByRole("button", { name: /open in maps/i });
  if (await mapsBtn.isVisible({ timeout: 4000 })) {
    await mapsBtn.scrollIntoViewIfNeeded();
    await mapsBtn.hover();
    await showCaption(page, "One tap opens full turn-by-turn directions in Google Maps", 2800, "note");
  }

  await page.waitForTimeout(1000);
});
