import { test, expect } from "./fixtures.js";

test.describe("Homepage", () => {
  test.beforeEach(async ({ page }) => {
    // domcontentloaded avoids blocking on Vite's lazy-chunk network waterfall.
    // expect().toPass() retries on NS_ERROR_CONNECTION_REFUSED — Firefox may
    // briefly refuse connections while socket.io tears down after a prior page.
    await expect(async () => {
      await page.goto("/", { waitUntil: "domcontentloaded" });
    }).toPass({ timeout: 30_000, intervals: [500, 1000] });
    // Wait for React to mount and render the nav (from MainLayout, always present).
    await page.locator("header, nav").first().waitFor({ timeout: 55_000 });
  });

  test("loads without a JS crash", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.waitForLoadState("domcontentloaded");
    expect(errors.filter((e) => !e.includes("favicon"))).toHaveLength(0);
  });

  test("has a non-empty page title", async ({ page }) => {
    await expect(page).toHaveTitle(/.+/);
  });

  test("renders the navigation header", async ({ page }) => {
    const header = page.locator("header, nav").first();
    await expect(header).toBeVisible();
  });

  test("shows a login or sign-in link", async ({ page }) => {
    // React Bootstrap <Button as={NavLink}> renders as <a role="button">, not role="link",
    // so we locate by href rather than ARIA role.
    const loginLink = page.locator('a[href="/login"]').first();
    await expect(loginLink).toBeVisible();
  });

  test("navigates to /login when the login link is clicked", async ({ page }) => {
    const loginLink = page.locator('a[href="/login"]').first();
    await loginLink.click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("shows a sign-up or get-started call-to-action", async ({ page }) => {
    // React Bootstrap <Button as={NavLink}> gets role="button", not role="link",
    // so check both roles and also the href.
    const cta = page
      .locator('a[href="/signup"]')
      .or(page.getByRole("link", { name: /sign.?up|get.?started|register|create/i }))
      .or(page.getByRole("button", { name: /sign.?up|get.?started|register|create/i }))
      .first();
    await expect(cta).toBeVisible();
  });

  test("renders at least one heading", async ({ page }) => {
    // Headings live inside the lazy Home chunk — give Suspense time to resolve.
    const heading = page.getByRole("heading").first();
    await expect(heading).toBeVisible({ timeout: 15_000 });
  });

  test("footer or bottom bar is present", async ({ page }) => {
    // BottomBar renders <footer class="bottom-bar"> inside the lazy Home chunk.
    // Give the Suspense boundary time to resolve and render the component.
    const footer = page.locator("footer, [class*='bottom-bar'], [class*='footer']").first();
    await expect(footer).toBeVisible({ timeout: 15_000 });
  });

  test("markets page is reachable from the nav", async ({ page }) => {
    const marketsLink = page.getByRole("link", { name: /markets/i }).first();
    if (await marketsLink.isVisible()) {
      await marketsLink.click();
      await expect(page).toHaveURL(/\/markets/);
    } else {
      test.skip();
    }
  });
});
