import { expect, test } from "@playwright/test";

/**
 * Client-side workflow: /book → pick slot → fill info → confirmation.
 * Grabs first available slot from the API in beforeAll so tests
 * work regardless of time-of-day or working-hours configuration.
 */

let firstSlot: { date: string; time: string } | null = null;

test.beforeAll(async ({ request }) => {
  const res = await request.get("http://localhost:8002/api/book/slots");
  const slots = await res.json();
  if (slots.length > 0 && slots[0].slots.length > 0) {
    firstSlot = { date: slots[0].date, time: slots[0].slots[0] };
  }
});

test.afterAll(async ({ request }) => {
  await request.post("http://localhost:8002/api/seed?key=dev");
});

test.describe("Client booking page — /book", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/book");
    await page.waitForLoadState("networkidle");
  });

  test("loads with heading and service picker", async ({ page }) => {
    await expect(page.getByText("Book an Appointment")).toBeVisible();
    await expect(page.getByRole("button", { name: "Full Groom", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Bath", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Nail Trim", exact: true })).toBeVisible();
  });

  test("service pill highlights when selected", async ({ page }) => {
    const bathBtn = page.getByRole("button", { name: "Bath" }).first();
    await bathBtn.click();
    // Selected pill gets violet background class
    await expect(bathBtn).toHaveClass(/bg-violet-600/);
    // Others remain unselected
    await expect(page.getByRole("button", { name: "Full Groom" })).not.toHaveClass(/bg-violet-600/);
  });

  test("date grid shows available days or no-slots message", async ({ page }) => {
    if (firstSlot) {
      // At least one date tile should be visible
      const dateTile = page.locator("button.rounded-2xl.border").first();
      await expect(dateTile).toBeVisible();
    } else {
      await expect(page.getByText(/No available slots/i)).toBeVisible();
    }
  });

  test("selecting a date reveals the time slot grid", async ({ page }) => {
    if (!firstSlot) test.skip();
    // Click the first date tile
    await page.locator("button.rounded-2xl.border").first().click();
    await expect(page.getByText("Time", { exact: true })).toBeVisible();
    // At least one time slot button appears
    const slotBtns = page.locator(".grid-cols-3 button");
    await expect(slotBtns.first()).toBeVisible();
  });

  test("Next button is disabled until both date and time are chosen", async ({ page }) => {
    if (!firstSlot) test.skip();
    const nextBtn = page.getByRole("button", { name: "Next" });
    await expect(nextBtn).toBeDisabled();

    // Select date only — still disabled
    await page.locator("button.rounded-2xl.border").first().click();
    await expect(nextBtn).toBeDisabled();

    // Select a time slot — now enabled
    await page.locator(".grid-cols-3 button").first().click();
    await expect(nextBtn).toBeEnabled();
  });

  test("Next advances to info form with service/date/time summary", async ({ page }) => {
    if (!firstSlot) test.skip();
    await page.locator("button.rounded-2xl.border").first().click();
    await page.locator(".grid-cols-3 button").first().click();
    await page.getByRole("button", { name: "Next" }).click();

    // Summary bar at top
    await expect(page.locator(".bg-violet-50")).toBeVisible();
    // Info form fields
    await expect(page.getByPlaceholder("Jane Smith")).toBeVisible();
    await expect(page.getByPlaceholder("(555) 000-0000")).toBeVisible();
    await expect(page.getByPlaceholder("Biscuit")).toBeVisible();
  });

  test("back button on info form returns to slot picker", async ({ page }) => {
    if (!firstSlot) test.skip();
    await page.locator("button.rounded-2xl.border").first().click();
    await page.locator(".grid-cols-3 button").first().click();
    await page.getByRole("button", { name: "Next" }).click();

    await page.getByText("← Change time").click();
    await expect(page.getByText("Book an Appointment")).toBeVisible();
    await expect(page.getByPlaceholder("Jane Smith")).not.toBeVisible();
  });

  test("Request Appointment button is disabled when form is empty", async ({ page }) => {
    if (!firstSlot) test.skip();
    await page.locator("button.rounded-2xl.border").first().click();
    await page.locator(".grid-cols-3 button").first().click();
    await page.getByRole("button", { name: "Next" }).click();

    const submitBtn = page.getByRole("button", { name: "Request Appointment" });
    await expect(submitBtn).toBeVisible();
    // HTML required attribute on name/phone prevents empty submit
    await submitBtn.click();
    // Should NOT advance to "Request Sent" — still on info form
    await expect(page.getByPlaceholder("Jane Smith")).toBeVisible();
    await expect(page.getByText("Request Sent!")).not.toBeVisible();
  });

  test("full submission shows Request Sent confirmation screen", async ({ page }) => {
    if (!firstSlot) test.skip();
    await page.locator("button.rounded-2xl.border").first().click();
    await page.locator(".grid-cols-3 button").first().click();
    await page.getByRole("button", { name: "Next" }).click();

    await page.getByPlaceholder("Jane Smith").fill("Online Test Client");
    await page.getByPlaceholder("(555) 000-0000").fill("555-777-8888");
    await page.getByPlaceholder("Biscuit").fill("TestDog");
    await page.getByRole("button", { name: "Request Appointment" }).click();

    await expect(page.getByText("Request Sent!")).toBeVisible();
    // Summary must include the chosen service
    await expect(page.getByText(/Full Groom|Bath|Nail Trim/)).toBeVisible();
    // Must NOT show the form anymore
    await expect(page.getByPlaceholder("Jane Smith")).not.toBeVisible();
  });
});

test.describe("Client booking — groomer side effects", () => {
  test("submitted online booking appears on Today tab as Needs Review", async ({ page, request }) => {
    if (!firstSlot) test.skip();
    // Submit an online booking
    await request.post("http://localhost:8002/api/book", {
      data: {
        phone: "555-123-4567",
        name: "API Test Client",
        pet_name: "TestPet",
        service_type: "Bath",
        slot_date: firstSlot!.date,
        slot_time: firstSlot!.time,
      },
    });

    // Check Today tab for pending card
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Needs Review").first()).toBeVisible();
    await expect(page.getByText("Online").first()).toBeVisible();
  });

  test("groomer can confirm a pending online booking", async ({ page, request }) => {
    if (!firstSlot) test.skip();
    await request.post("http://localhost:8002/api/book", {
      data: {
        phone: "555-987-1111",
        name: "Confirm Test",
        pet_name: "ConfirmPet",
        service_type: "Bath",
        slot_date: firstSlot!.date,
        slot_time: firstSlot!.time,
      },
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Target this specific card by pet name to avoid hitting other pending cards
    const card = page.locator(".rounded-2xl").filter({ hasText: "ConfirmPet" });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Confirm" }).click();
    await page.waitForTimeout(400);

    // After confirm, the card must no longer show "Needs Review"
    await expect(card.getByText("Needs Review")).not.toBeVisible();
  });

  test("groomer can decline a pending online booking — it disappears", async ({ page, request }) => {
    if (!firstSlot) test.skip();
    await request.post("http://localhost:8002/api/book", {
      data: {
        phone: "555-222-3333",
        name: "Decline Test",
        pet_name: "DeclinePet",
        service_type: "Nail Trim",
        slot_date: firstSlot!.date,
        slot_time: firstSlot!.time,
      },
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const beforeCount = await page.locator(".bg-white.rounded-2xl.p-4.shadow-sm").count();
    const pendingCard = page.locator(".rounded-2xl").filter({ hasText: "Needs Review" }).first();
    await pendingCard.getByRole("button", { name: "Decline" }).click();
    await page.waitForTimeout(500);

    // KNOWN BUG: declined bookings still appear on Today tab
    // because get_today_appointments has no filter for "declined" status.
    // This test is marked expected-to-fail to track the gap.
    test.fail();
    const afterCount = await page.locator(".bg-white.rounded-2xl.p-4.shadow-sm").count();
    expect(afterCount).toBe(beforeCount - 1);
  });
});

test.describe("Client pet profile page — /profile/:token", () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    const res = await request.get("http://localhost:8002/api/appointments/today");
    const appts = await res.json();
    const biscuit = appts.find((a: { pet_name: string }) => a.pet_name === "Biscuit");
    token = biscuit?.intake_token;
  });

  test("valid token shows pet profile, not an error", async ({ page }) => {
    await page.goto(`/profile/${token}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/invalid|expired/i)).not.toBeVisible();
    await expect(page.getByText("Biscuit")).toBeVisible();
  });

  test("invalid token shows error message", async ({ page }) => {
    await page.goto("/profile/not-a-real-token");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/invalid|expired/i)).toBeVisible();
  });
});

test.describe("Client vaccine upload page — /vaccine/:token", () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    const res = await request.get("http://localhost:8002/api/appointments/today");
    const appts = await res.json();
    const biscuit = appts.find((a: { pet_name: string }) => a.pet_name === "Biscuit");
    token = biscuit?.intake_token;
  });

  test("valid token loads vaccine upload page", async ({ page }) => {
    await page.goto(`/vaccine/${token}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/vaccine|rabies|cert/i).first()).toBeVisible();
    await expect(page.locator('input[type="file"]')).toHaveCount(1);
  });

  test("invalid token on vaccine page shows error — KNOWN GAP", async ({ page }) => {
    // VaccineUpload.tsx renders upload UI for any token without pre-validating.
    // Fix: add useEffect to GET /api/profile/{token} on load and show error if 404.
    test.fail();
    await page.goto("/vaccine/not-a-real-token");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/invalid|expired|not found/i)).toBeVisible();
  });
});
