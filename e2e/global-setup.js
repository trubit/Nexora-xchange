/**
 * Playwright global setup — pre-warms the Vite dev server so all lazy-loaded
 * chunks are compiled before the test suite starts.
 *
 * Without this, the first browser that visits "/" triggers compilation of every
 * home-page component (~10 heavy imports), which can take 30-50 s and cause
 * beforeEach timeout failures in multiple home tests.
 */
import { chromium } from "@playwright/test";

export default async function globalSetup() {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5173";
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Home page — triggers compilation of ALL home section components (lazy chunk).
    // Wait until the footer renders so we know the entire lazy chunk has resolved.
    await page.goto(`${baseURL}/`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.locator("footer, .bottom-bar, nav").first().waitFor({ timeout: 90_000 });

    // Auth pages — compile login / signup / forgot-password components.
    await page.goto(`${baseURL}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.goto(`${baseURL}/signup`, { waitUntil: "domcontentloaded", timeout: 60_000 });

    // Markets page — compile the markets component (also requires auth token).
    await page.evaluate(() => {
      localStorage.setItem("token", "e2e-test-token");
      localStorage.setItem(
        "user",
        JSON.stringify({
          id: "e2e-user",
          email: "e2e@test.invalid",
          role: "user",
          emailVerified: true,
        }),
      );
    });
    await page.goto(`${baseURL}/markets`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  } catch {
    // Warm-up failures are non-fatal; tests will still run (possibly slower).
  } finally {
    await browser.close();
  }
}
