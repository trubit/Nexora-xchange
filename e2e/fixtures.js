import { test as base } from "@playwright/test";

// Intercept all backend API calls so tests are independent of the Express
// server. Login returns 401 (triggers the error-message UI); everything
// else returns an empty 200 so the app boots without crashing or hanging.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route("**/api/**", (route) => {
      const url = route.request().url();
      const method = route.request().method();

      if (method === "POST" && url.includes("/api/auth/login")) {
        route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ message: "Invalid email or password." }),
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: "{}",
        });
      }
    });

    await use(page);
  },
});

export { expect } from "@playwright/test";
