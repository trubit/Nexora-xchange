import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Unified workspace: one `vitest` command runs both frontend (jsdom) and
// server (node) suites, each in their own isolated environment.
export default defineConfig({
  test: {
    // Root-level coverage applies when --coverage is passed via CLI.
    // Per-project coverage configs are used for `npm run test:client:coverage`
    // and `npm run test:server:coverage` (individual runs).
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary", "html"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{js,jsx}", "server/**/*.js"],
      exclude: [
        // Frontend exclusions
        "src/test/**",
        "src/main.jsx",
        "src/**/*.spec.*",
        "src/**/*.test.*",
        "src/styles/**",
        "src/assets/**",
        // Server exclusions
        "server/test/**",
        "server/index.js",
        "server/**/*.spec.*",
        "server/**/*.test.*",
        "server/scripts/**",
      ],
    },

    projects: [
      // ── Frontend ───────────────────────────────────────────────────
      {
        plugins: [react()],
        test: {
          name: "frontend",
          environment: "jsdom",
          globals: true,
          pool: "vmThreads",
          singleThread: true,
          setupFiles: ["./src/test/setup.js"],
          include: ["src/**/*.{test,spec}.{js,jsx}"],
          exclude: ["node_modules", "dist", "e2e"],
          coverage: {
            provider: "v8",
            reporter: ["text", "json", "json-summary", "html"],
            reportsDirectory: "./coverage/client",
            include: ["src/**/*.{js,jsx}"],
            exclude: [
              "src/test/**",
              "src/main.jsx",
              "src/**/*.spec.*",
              "src/**/*.test.*",
              "src/styles/**",
              "src/assets/**",
            ],
          },
        },
      },

      // ── Server ────────────────────────────────────────────────────
      {
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
      },
    ],
  },
});
