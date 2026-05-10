/**
 * Runs once before all tests — seeds the backend with fresh demo data
 * so every test run starts from a known state.
 */
export default async function globalSetup() {
  const res = await fetch("http://localhost:8002/api/seed?key=dev", { method: "POST" });
  if (!res.ok) {
    throw new Error(`Seed failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  console.log(`\n  Seeded DB for date: ${data.date}\n`);
}
