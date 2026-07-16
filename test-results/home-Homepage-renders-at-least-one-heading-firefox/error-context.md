# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: home.spec.js >> Homepage >> renders at least one heading
- Location: e2e\home.spec.js:55:3

# Error details

```
Test timeout of 60000ms exceeded while running "beforeEach" hook.
```

# Test source

```ts
  1  | import { test, expect } from "./fixtures.js";
  2  | 
  3  | test.describe("Homepage", () => {
> 4  |   test.beforeEach(async ({ page }) => {
     |        ^ Test timeout of 60000ms exceeded while running "beforeEach" hook.
  5  |     // domcontentloaded avoids blocking on Vite's lazy-chunk network waterfall.
  6  |     // expect().toPass() retries on NS_ERROR_CONNECTION_REFUSED — Firefox may
  7  |     // briefly refuse connections while socket.io tears down after a prior page.
  8  |     await expect(async () => {
  9  |       await page.goto("/", { waitUntil: "domcontentloaded" });
  10 |     }).toPass({ timeout: 30_000, intervals: [500, 1000] });
  11 |     // Wait for React to mount and render the nav (from MainLayout, always present).
  12 |     await page.locator("header, nav").first().waitFor({ timeout: 55_000 });
  13 |   });
  14 | 
  15 |   test("loads without a JS crash", async ({ page }) => {
  16 |     const errors = [];
  17 |     page.on("pageerror", (err) => errors.push(err.message));
  18 |     await page.waitForLoadState("domcontentloaded");
  19 |     expect(errors.filter((e) => !e.includes("favicon"))).toHaveLength(0);
  20 |   });
  21 | 
  22 |   test("has a non-empty page title", async ({ page }) => {
  23 |     await expect(page).toHaveTitle(/.+/);
  24 |   });
  25 | 
  26 |   test("renders the navigation header", async ({ page }) => {
  27 |     const header = page.locator("header, nav").first();
  28 |     await expect(header).toBeVisible();
  29 |   });
  30 | 
  31 |   test("shows a login or sign-in link", async ({ page }) => {
  32 |     // React Bootstrap <Button as={NavLink}> renders as <a role="button">, not role="link",
  33 |     // so we locate by href rather than ARIA role.
  34 |     const loginLink = page.locator('a[href="/login"]').first();
  35 |     await expect(loginLink).toBeVisible();
  36 |   });
  37 | 
  38 |   test("navigates to /login when the login link is clicked", async ({ page }) => {
  39 |     const loginLink = page.locator('a[href="/login"]').first();
  40 |     await loginLink.click();
  41 |     await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  42 |   });
  43 | 
  44 |   test("shows a sign-up or get-started call-to-action", async ({ page }) => {
  45 |     // React Bootstrap <Button as={NavLink}> gets role="button", not role="link",
  46 |     // so check both roles and also the href.
  47 |     const cta = page
  48 |       .locator('a[href="/signup"]')
  49 |       .or(page.getByRole("link", { name: /sign.?up|get.?started|register|create/i }))
  50 |       .or(page.getByRole("button", { name: /sign.?up|get.?started|register|create/i }))
  51 |       .first();
  52 |     await expect(cta).toBeVisible();
  53 |   });
  54 | 
  55 |   test("renders at least one heading", async ({ page }) => {
  56 |     // Headings live inside the lazy Home chunk — give Suspense time to resolve.
  57 |     const heading = page.getByRole("heading").first();
  58 |     await expect(heading).toBeVisible({ timeout: 15_000 });
  59 |   });
  60 | 
  61 |   test("footer or bottom bar is present", async ({ page }) => {
  62 |     // BottomBar renders <footer class="bottom-bar"> inside the lazy Home chunk.
  63 |     // Give the Suspense boundary time to resolve and render the component.
  64 |     const footer = page.locator("footer, [class*='bottom-bar'], [class*='footer']").first();
  65 |     await expect(footer).toBeVisible({ timeout: 15_000 });
  66 |   });
  67 | 
  68 |   test("markets page is reachable from the nav", async ({ page }) => {
  69 |     const marketsLink = page.getByRole("link", { name: /markets/i }).first();
  70 |     if (await marketsLink.isVisible()) {
  71 |       await marketsLink.click();
  72 |       await expect(page).toHaveURL(/\/markets/);
  73 |     } else {
  74 |       test.skip();
  75 |     }
  76 |   });
  77 | });
  78 | 
```