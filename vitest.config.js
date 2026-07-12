import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
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
});
