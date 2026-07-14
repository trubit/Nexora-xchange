import { test, expect } from "./fixtures.js";

// Credentials that should NOT exist in any environment — used to trigger errors.
const NONEXISTENT_EMAIL = `playwright-ghost-${Date.now()}@test-noreply.invalid`;
const WRONG_PASSWORD = "wrong-password-12345";

test.describe("Login page", () => {
  test.beforeEach(async ({ page }) => {
    await expect(async () => {
      await page.goto("/login", { waitUntil: "domcontentloaded" });
    }).toPass({ timeout: 15_000, intervals: [500, 1000] });
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
    // Target the submit button directly — the Google auth button's aria-label also matches
    // sign-in patterns and would navigate away from the page if clicked.
    // force: true bypasses the CSS animation stability check on the login page.
    await page.locator("button[type='submit']").first().click({ force: true });

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
    // force: true bypasses Playwright's stability check so CSS animations on the
    // login page don't prevent the click from firing.
    await signupLink.click({ force: true });
    await expect(page).toHaveURL(/\/signup/, { timeout: 10_000 });
  });

  test("has a forgot-password link", async ({ page }) => {
    const forgotLink = page.getByRole("link", { name: /forgot/i }).first();
    await expect(forgotLink).toBeVisible();
  });

  test("forgot-password link navigates to the forgot-password page", async ({ page }) => {
    const forgotLink = page.getByRole("link", { name: /forgot/i }).first();
    await forgotLink.click({ force: true });
    await expect(page).toHaveURL(/\/forgot/, { timeout: 10_000 });
  });
});

test.describe("Signup page", () => {
  test.beforeEach(async ({ page }) => {
    await expect(async () => {
      await page.goto("/signup", { waitUntil: "domcontentloaded" });
    }).toPass({ timeout: 15_000, intervals: [500, 1000] });
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
    await loginLink.click({ force: true });
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("shows a validation error when submitting empty form", async ({ page }) => {
    // The signup form uses noValidate and disables the submit button until all
    // fields pass client-side validation — clicking an empty form is prevented
    // at the UI level rather than showing a post-submit error message.
    const btn = page.locator("button[type='submit']").first();
    await expect(btn).toBeDisabled();
  });
});

test.describe("Forgot-password page", () => {
  test.beforeEach(async ({ page }) => {
    // Retry once on NS_ERROR_CONNECTION_REFUSED — Firefox can briefly refuse
    // new connections while socket.io tears down after the previous test's page
    // closes. expect().toPass() retries the whole goto on any thrown error.
    await expect(async () => {
      await page.goto("/forgot-password", { waitUntil: "domcontentloaded" });
    }).toPass({ timeout: 15_000, intervals: [500, 1000] });
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
