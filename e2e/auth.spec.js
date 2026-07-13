import { test, expect } from "./fixtures.js";

// Credentials that should NOT exist in any environment — used to trigger errors.
const NONEXISTENT_EMAIL = `playwright-ghost-${Date.now()}@test-noreply.invalid`;
const WRONG_PASSWORD = "wrong-password-12345";

test.describe("Login page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");
  });

  test("renders the login page without crashing", async ({ page }) => {
    await expect(page.locator("body")).not.toContainText("Something went wrong");
    await expect(page.locator("body")).not.toContainText("Cannot GET");
  });

  test("shows an email input field", async ({ page }) => {
    const email = page.locator("input[type='email'], input[name='email']").first();
    await expect(email).toBeVisible();
  });

  test("shows a password input field", async ({ page }) => {
    const pass = page.locator("input[type='password']").first();
    await expect(pass).toBeVisible();
  });

  test("shows a submit button", async ({ page }) => {
    const btn = page
      .getByRole("button", { name: /log.?in|sign.?in|submit/i })
      .first();
    await expect(btn).toBeVisible();
  });

  test("shows an error message when submitting invalid credentials", async ({ page }) => {
    await page.locator("input[type='email'], input[name='email']").first().fill(NONEXISTENT_EMAIL);
    await page.locator("input[type='password']").first().fill(WRONG_PASSWORD);
    await page.getByRole("button", { name: /log.?in|sign.?in|submit/i }).first().click();

    // Wait for server response — allow up to 10 s for the error to appear.
    const errorLocator = page
      .locator("[class*='error'], [class*='alert'], [role='alert'], [class*='danger']")
      .first();
    await expect(errorLocator).toBeVisible({ timeout: 10_000 });
  });

  test("has a working link to the signup page", async ({ page }) => {
    const signupLink = page
      .getByRole("link", { name: /sign.?up|register|create.+(one|account)/i })
      .first();
    await expect(signupLink).toBeVisible();
    await signupLink.click();
    await expect(page).toHaveURL(/\/signup/);
  });

  test("has a forgot-password link", async ({ page }) => {
    const forgotLink = page.getByRole("link", { name: /forgot/i }).first();
    await expect(forgotLink).toBeVisible();
  });

  test("forgot-password link navigates to the forgot-password page", async ({ page }) => {
    const forgotLink = page.getByRole("link", { name: /forgot/i }).first();
    await forgotLink.click();
    await expect(page).toHaveURL(/\/forgot/);
  });
});

test.describe("Signup page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/signup");
    await page.waitForLoadState("domcontentloaded");
  });

  test("renders without crashing", async ({ page }) => {
    await expect(page.locator("body")).not.toContainText("Something went wrong");
  });

  test("shows an email input field", async ({ page }) => {
    const email = page.locator("input[type='email'], input[name='email']").first();
    await expect(email).toBeVisible();
  });

  test("shows a password input field", async ({ page }) => {
    const pass = page.locator("input[type='password']").first();
    await expect(pass).toBeVisible();
  });

  test("shows a signup / register submit button", async ({ page }) => {
    const btn = page
      .getByRole("button", { name: /sign.?up|register|create|submit/i })
      .first();
    await expect(btn).toBeVisible();
  });

  test("has a link back to the login page", async ({ page }) => {
    const loginLink = page
      .getByRole("link", { name: /log.?in|sign.?in|already.+account/i })
      .first();
    await expect(loginLink).toBeVisible();
    await loginLink.click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("shows a validation error when submitting empty form", async ({ page }) => {
    const btn = page
      .getByRole("button", { name: /sign.?up|register|create|submit/i })
      .first();
    await btn.click();

    // Either HTML5 native validation or an app-level error should appear.
    const emailInput = page.locator("input[type='email'], input[name='email']").first();
    const isNativeInvalid = await emailInput.evaluate((el) => !el.validity.valid);
    const hasErrorMsg = await page
      .locator("[class*='error'], [role='alert']")
      .first()
      .isVisible()
      .catch(() => false);

    expect(isNativeInvalid || hasErrorMsg).toBe(true);
  });
});

test.describe("Forgot-password page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/forgot-password");
    await page.waitForLoadState("domcontentloaded");
  });

  test("renders without crashing", async ({ page }) => {
    await expect(page.locator("body")).not.toContainText("Something went wrong");
  });

  test("shows an email input", async ({ page }) => {
    const email = page.locator("input[type='email'], input[name='email']").first();
    await expect(email).toBeVisible();
  });

  test("shows a submit button", async ({ page }) => {
    const btn = page.getByRole("button", { name: /send|submit|reset/i }).first();
    await expect(btn).toBeVisible();
  });
});
