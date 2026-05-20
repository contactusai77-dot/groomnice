import { APIRequestContext, Page } from "@playwright/test";

export const GROOMER = {
  email: "demo@groomnice.com",
  password: "demo1234",
};

/** Re-seeds the DB, patches onboarding_complete=true, returns the JWT token. */
export async function seedFresh(request: APIRequestContext): Promise<string> {
  await request.post("/api/seed?key=dev");
  const res = await request.post("/api/auth/login", {
    data: { email: GROOMER.email, password: GROOMER.password },
  });
  const { token } = await res.json();
  // Seed may not persist onboarding_complete correctly due to SQLite Boolean quirk
  await request.patch("/api/settings", {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    data: { onboarding_complete: true },
  });
  return token;
}

/** Returns the full clients list from the API. */
export async function getClients(request: APIRequestContext, token: string) {
  const res = await request.get("/api/clients", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json() as Promise<any[]>;
}

/** Patches a pet's temperament via PATCH /api/pets/:id */
export async function setPetTemperament(
  request: APIRequestContext,
  token: string,
  pet: { id: string; pet_name: string; breed: string; rabies_expiry?: string | null },
  temperament: "friendly" | "anxious" | "aggressive"
) {
  await request.patch(`/api/pets/${pet.id}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    data: {
      pet_name: pet.pet_name || "",
      breed: pet.breed || "",
      temperament,
      rabies_expiry: pet.rabies_expiry || "",
    },
  });
}

/**
 * Injects a floating caption overlay into the page — visible in Playwright video recordings.
 * style 'scenario' = purple header; 'note' = dark tooltip.
 */
export async function showCaption(
  page: Page,
  text: string,
  durationMs = 2800,
  style: "note" | "scenario" = "note"
) {
  const bgColor =
    style === "scenario" ? "rgba(109,40,217,0.95)" : "rgba(17,17,17,0.88)";
  await page.evaluate(
    ({ text, bgColor }) => {
      document.getElementById("__caption__")?.remove();
      const el = document.createElement("div");
      el.id = "__caption__";
      el.style.cssText = `
        position:fixed; bottom:100px; left:50%; transform:translateX(-50%);
        background:${bgColor}; color:#fff; padding:12px 28px; border-radius:14px;
        font-size:16px; font-weight:600; z-index:99999; max-width:84%;
        text-align:center; font-family:system-ui,sans-serif;
        box-shadow:0 4px 24px rgba(0,0,0,.4); pointer-events:none;
      `;
      el.textContent = text;
      document.body.appendChild(el);
    },
    { text, bgColor }
  );
  await page.waitForTimeout(durationMs);
  await page.evaluate(() => document.getElementById("__caption__")?.remove());
}

/** Slow cinematic login with deliberate pauses for recording. */
export async function loginAsGroomer(page: Page) {
  await page.goto("/login");
  await page.waitForTimeout(700);
  await page.getByPlaceholder("you@example.com").fill(GROOMER.email);
  await page.waitForTimeout(400);
  await page.getByPlaceholder("••••••••").fill(GROOMER.password);
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(/\/(dashboard|today|\?|$)/, { timeout: 10_000 });
  await page.waitForTimeout(1000);
}
