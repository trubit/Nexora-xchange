import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "server",
    environment: "node",
    globals: true,
    setupFiles: ["./server/test/setup.js"],
    include: ["server/**/*.{test,spec}.js"],
    exclude: ["node_modules", "dist"],
    env: {
      NODE_ENV: "test",
      JWT_SECRET: "vitest-test-jwt-secret-minimum-32-chars!!",
      JWT_EXPIRES_IN: "1h",
      SUPPORT_EMAIL: "support@test.example.com",
      REDIS_ENABLED: "false",
      LOG_LEVEL: "silent",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary", "html"],
      reportsDirectory: "./coverage/server",
      include: ["server/**/*.js"],
      exclude: [
        "server/test/**",
        "server/index.js",
        "server/**/*.spec.*",
        "server/**/*.test.*",
        "server/scripts/**",
      ],
    },
  },
});
