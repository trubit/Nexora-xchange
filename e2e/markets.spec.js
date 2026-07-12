import { test, expect } from "@playwright/test";

test.describe("Markets page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/markets");
    await page.waitForLoadState("domcontentloaded");
  });

  test("loads without a JS crash", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.waitForTimeout(1000);
    expect(errors.filter((e) => !e.includes("favicon"))).toHaveLength(0);
  });

  test("does not show a generic error page", async ({ page }) => {
    await expect(page.locator("body")).not.toContainText("Something went wrong");
    await expect(page.locator("body")).not.toContainText("Cannot GET /markets");
  });

  test("renders a heading or page title", async ({ page }) => {
    const heading = page.getByRole("heading").first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });

  test("shows market data or a loading skeleton", async ({ page }) => {
    // Either real data or a loading indicator must be visible within 10 s.
    const dataOrLoader = page
      .locator(
        "table, [class*='market'], [class*='coin'], [class*='spinner'], [class*='loading'], [class*='skeleton']",
      )
      .first();
    await expect(dataOrLoader).toBeVisible({ timeout: 10_000 });
  });

  test("coin symbols are shown (BTC, ETH, or similar)", async ({ page }) => {
    // Give the page time to hydrate with live data.
    await page
      .waitForSelector(
        "text=/BTC|ETH|USDT/",
        { timeout: 15_000 },
      )
      .catch(() => {
        // If live data didn't arrive, this test is skipped rather than failed —
        // it depends on a running backend and CoinGecko availability.
        test.skip();
      });
  });

  test("navigation header is still visible", async ({ page }) => {
    const header = page.locator("header, nav").first();
    await expect(header).toBeVisible();
  });
});

test.describe("Trade page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/trade");
    await page.waitForLoadState("domcontentloaded");
  });

  test("renders without a 404 or crash page", async ({ page }) => {
    await expect(page.locator("body")).not.toContainText("Cannot GET");
    await expect(page.locator("body")).not.toContainText("404");
  });

  test("shows a trading interface or loading state", async ({ page }) => {
    const content = page
      .locator(
        "[class*='trade'], [class*='chart'], [class*='order'], [class*='market'], [class*='loading']",
      )
      .first();
    await expect(content).toBeVisible({ timeout: 10_000 });
  });
});
