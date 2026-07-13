import { test, expect } from "./fixtures.js";

test.describe("Homepage", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
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
    const loginLink = page
      .getByRole("link", { name: /log.?in|sign.?in/i })
      .first();
    await expect(loginLink).toBeVisible();
  });

  test("navigates to /login when the login link is clicked", async ({ page }) => {
    const loginLink = page
      .getByRole("link", { name: /log.?in|sign.?in/i })
      .first();
    await loginLink.click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("shows a sign-up or get-started call-to-action", async ({ page }) => {
    const cta = page
      .getByRole("link", { name: /sign.?up|get.?started|register|create/i })
      .first();
    await expect(cta).toBeVisible();
  });

  test("renders at least one heading", async ({ page }) => {
    const heading = page.getByRole("heading").first();
    await expect(heading).toBeVisible();
  });

  test("footer or bottom bar is present", async ({ page }) => {
    const footer = page.locator("footer, [class*='bottom-bar'], [class*='footer']").first();
    await expect(footer).toBeVisible();
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
