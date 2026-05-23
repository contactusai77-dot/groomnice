/**
 * Demo: Full Walkthrough — Legal, Features, Groomer & Client Flow
 *
 * Covers everything end-to-end:
 *   1. Groomer signs up — ToS + data consent checkboxes (legally required)
 *   2. Groomer dashboard tour — Today, Requests tab, Settings
 *   3. Client visits booking page — consent checkbox before submitting
 *   4. Groomer sees request badge → opens Requests tab → confirms
 *   5. Client page auto-updates to "Confirmed!" without refresh
 */
import { test, expect } from "@playwright/test";
import { showCaption } from "./helpers";

const TS = Date.now();
const GROOMER_EMAIL = `demo_walk_${TS}@example.com`;
const GROOMER_PASS  = "demo1234";
const GROOMER_NAME  = "Sarah's Paws";
const GROOMER_SLUG  = `sarahs-paws-${TS}`;

let token = "";
let slug  = "";

test.beforeAll(async ({ request }) => {
  // Register a fresh groomer so we can show the real signup flow in the test
  const r = await request.post("/api/auth/register", {
    data: {
      email: GROOMER_EMAIL,
      password: GROOMER_PASS,
      name: GROOMER_NAME,
      slug: GROOMER_SLUG,
      tos_accepted: true,
      data_consent: true,
    },
  });
  const body = await r.json();
  token = body.token;
  slug  = body.groomer?.slug ?? GROOMER_SLUG;

  // Mark onboarding complete so dashboard loads directly
  await request.patch("/api/settings", {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    data: { onboarding_complete: true },
  });
});

test("full platform walkthrough — legal, features, groomer and client flow", async ({ page, context }) => {

  // ════════════════════════════════════════════════════════════════════════════
  // SCENE 1 — GROOMER SIGN UP (legal consent)
  // ════════════════════════════════════════════════════════════════════════════
  await page.goto("/register");
  await page.waitForTimeout(800);

  await showCaption(page, "GROOMER SIGN UP — free to start, no card required", 2800, "scenario");

  // Fill the form
  await page.getByPlaceholder("Sarah Johnson").fill(GROOMER_NAME);
  await page.waitForTimeout(400);
  await page.getByPlaceholder("sarah@example.com").fill(GROOMER_EMAIL);
  await page.waitForTimeout(400);
  await page.getByPlaceholder("••••••••").fill(GROOMER_PASS);
  await page.waitForTimeout(400);

  await showCaption(page, "Booking URL auto-generated from business name — clients visit /book/your-slug", 3000, "note");
  await page.waitForTimeout(800);

  // ToS checkbox
  const tosCheckbox = page.locator("input[type='checkbox']").first();
  await tosCheckbox.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await showCaption(
    page,
    "Terms of Service — AI outputs may contain errors, liability capped at fees paid. Legally binding clickwrap.",
    3800,
    "note"
  );
  await tosCheckbox.check();
  await page.waitForTimeout(800);

  // Data consent checkbox
  const consentCheckbox = page.locator("input[type='checkbox']").nth(1);
  await showCaption(
    page,
    "Data consent — client records and appointments processed to run the service. Required by privacy law.",
    3600,
    "note"
  );
  await consentCheckbox.check();
  await page.waitForTimeout(800);

  await showCaption(page, "Both timestamps stored in the database — enforceable proof of consent", 2800, "note");
  await page.waitForTimeout(600);

  // Submit — but we already registered in beforeAll, so just login instead
  await page.goto("/login");
  await page.waitForTimeout(500);
  await page.getByPlaceholder("you@example.com").fill(GROOMER_EMAIL);
  await page.waitForTimeout(300);
  await page.getByPlaceholder("••••••••").fill(GROOMER_PASS);
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(/\/(|today|\?)/, { timeout: 10_000 });
  await page.waitForTimeout(1000);

  // ════════════════════════════════════════════════════════════════════════════
  // SCENE 2 — GROOMER DASHBOARD TOUR
  // ════════════════════════════════════════════════════════════════════════════
  await showCaption(page, "GROOMER DASHBOARD — today's appointments at a glance", 2800, "scenario");
  await page.waitForTimeout(1000);

  // Requests tab (empty badge for now)
  const requestsTab = page.getByRole("button", { name: /requests/i });
  await expect(requestsTab).toBeVisible({ timeout: 5000 });
  await showCaption(page, "Requests tab — all incoming booking requests in one place. Badge shows pending count.", 3000, "note");
  await page.waitForTimeout(1000);

  // Settings tour
  await page.getByRole("button", { name: /settings/i }).click();
  await page.waitForTimeout(800);

  await showCaption(page, "SETTINGS — controls for deposit, reminders, availability, and more", 2600, "scenario");
  await page.waitForTimeout(600);

  const depositSection = page.getByText(/deposit/i).first();
  await depositSection.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await showCaption(page, "Require deposit from new clients — protects against no-shows", 2600, "note");
  await page.waitForTimeout(800);

  const dayOverrides = page.getByText(/day overrides/i).first();
  await dayOverrides.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await showCaption(page, "Block specific dates — they disappear from the client booking page instantly", 2600, "note");
  await page.waitForTimeout(800);

  const notifPhone = page.getByPlaceholder(/\+1 555/i);
  if (await notifPhone.isVisible({ timeout: 2000 })) {
    await notifPhone.scrollIntoViewIfNeeded();
    await showCaption(page, "Notification phone — get a text when clients book (optional, requires Twilio)", 2600, "note");
    await page.waitForTimeout(800);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SCENE 3 — CLIENT BOOKS (on a second page, groomer page stays open)
  // ════════════════════════════════════════════════════════════════════════════
  const clientPage = await context.newPage();
  await clientPage.goto(`/book/${slug}`);
  await clientPage.waitForTimeout(800);

  await showCaption(clientPage, "CLIENT BOOKING PAGE — no account, no app, just a link", 2800, "scenario");

  // Service
  await clientPage.getByRole("button", { name: /^Full Groom$/i }).click();
  await clientPage.waitForTimeout(400);

  // Date
  const dateScroller = clientPage.locator(".overflow-x-auto").first();
  await expect(dateScroller).toBeVisible({ timeout: 8000 });
  await showCaption(clientPage, "30 days of real-time availability — blocked dates and booked slots hidden", 2800, "note");
  await dateScroller.locator("button").first().click();
  await clientPage.waitForTimeout(500);

  // Time
  const timeGrid = clientPage.locator(".grid.grid-cols-3").first();
  await expect(timeGrid.locator("button").first()).toBeVisible({ timeout: 8000 });
  await timeGrid.locator("button").first().click();
  await clientPage.waitForTimeout(400);

  await clientPage.getByRole("button", { name: /next/i }).click();
  await clientPage.waitForTimeout(600);

  // Client details
  await showCaption(clientPage, "Client fills their details — name, phone, pet name", 2400, "note");
  await clientPage.getByPlaceholder("Jane Smith").fill("Rachel Green");
  await clientPage.waitForTimeout(300);
  await clientPage.getByPlaceholder(/555/).fill("5559871234");
  await clientPage.waitForTimeout(300);
  await clientPage.getByPlaceholder("Biscuit").fill("Phoebe");
  await clientPage.waitForTimeout(300);

  // Client consent checkbox
  const clientConsent = clientPage.locator("input[type='checkbox']");
  if (await clientConsent.isVisible({ timeout: 2000 })) {
    await clientConsent.scrollIntoViewIfNeeded();
    await showCaption(
      clientPage,
      "Client agrees to Terms of Service — AI disclaimer included, timestamp stored",
      3200,
      "note"
    );
    await clientConsent.check();
    await clientPage.waitForTimeout(600);
  }

  // Submit
  const submitBtn = clientPage.getByRole("button", { name: /request appointment/i });
  await submitBtn.hover();
  await clientPage.waitForTimeout(400);
  await showCaption(clientPage, "One tap to send the request", 1800, "note");
  await submitBtn.click();
  await clientPage.waitForTimeout(1500);

  await expect(clientPage.getByText(/request sent/i)).toBeVisible({ timeout: 8000 });
  await showCaption(
    clientPage,
    "Spinning — this page polls every 5s and auto-updates when groomer confirms. No refresh needed.",
    3400,
    "note"
  );
  await clientPage.waitForTimeout(1000);

  // ════════════════════════════════════════════════════════════════════════════
  // SCENE 4 — GROOMER SEES REQUEST & APPROVES
  // ════════════════════════════════════════════════════════════════════════════
  await page.bringToFront();
  await page.getByRole("button", { name: /requests/i }).click();
  await page.waitForTimeout(1000);

  await showCaption(page, "GROOMER — Requests tab lights up with a badge", 2800, "scenario");

  const badge = page.locator(".bg-red-500");
  if (await badge.isVisible({ timeout: 5000 })) {
    await showCaption(page, "Red badge — can't be missed. Auto-refreshes every 30s.", 2600, "note");
    await page.waitForTimeout(800);
  }

  const pendingCard = page.locator(".border-amber-200").first();
  if (await pendingCard.isVisible({ timeout: 5000 })) {
    await pendingCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await showCaption(page, "Full request detail — date, time, service, client name, pet", 2800, "note");
    await page.waitForTimeout(600);
  }

  const confirmBtn = page.getByRole("button", { name: /^confirm$/i }).first();
  if (await confirmBtn.isVisible({ timeout: 5000 })) {
    await confirmBtn.hover();
    await page.waitForTimeout(500);
    await showCaption(page, "Groomer taps Confirm — client is notified immediately", 2000, "note");
    await confirmBtn.click();
    await page.waitForTimeout(1500);
    await showCaption(page, "✅ Confirmed — request cleared, badge gone", 2600, "scenario");
    await page.waitForTimeout(800);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SCENE 5 — CLIENT PAGE AUTO-UPDATES
  // ════════════════════════════════════════════════════════════════════════════
  await clientPage.bringToFront();
  await showCaption(clientPage, "CLIENT — same page, still open, waiting for the poll…", 2400, "note");

  await expect(clientPage.getByText(/confirmed!/i)).toBeVisible({ timeout: 12000 });
  await page.waitForTimeout(600);

  await showCaption(
    clientPage,
    "✅ 'Confirmed!' — appeared automatically. No SMS, no refresh, no app install needed.",
    4000,
    "scenario"
  );
  await clientPage.waitForTimeout(2000);

  await clientPage.close();
});
