import { defineConfig, createLogger } from "vite";
import react from "@vitejs/plugin-react";

// ECONNABORTED / ECONNRESET / EPIPE mean "client disconnected" —
// expected whenever the browser navigates away while a socket is open.
const IGNORED = ["ECONNABORTED", "ECONNRESET", "EPIPE"];

const isHarmless = (msg) =>
  IGNORED.some((code) => typeof msg === "string" && msg.includes(code));

// Vite logs WebSocket socket errors through its own logger before the
// http-proxy "error" event fires, so we need to filter at the logger level.
const logger = createLogger();
const _error = logger.error.bind(logger);
logger.error = (msg, opts) => {
  if (isHarmless(msg) || isHarmless(opts?.error?.message)) return;
  _error(msg, opts);
};

const silentProxyError = (err) => {
  if (!isHarmless(err.code) && !isHarmless(err.message)) {
    console.error("[vite proxy]", err.message);
  }
};

export default defineConfig({
  customLogger: logger,
  plugins: [react()],

  build: {
    // Split vendor code into separate chunks so the browser can cache them
    // independently from your app code — vendor libs rarely change.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          // React core — loaded on every page
          if (id.includes("/react-dom/") || id.includes("/react/")) return "vendor-react";
          // Router
          if (id.includes("react-router")) return "vendor-router";
          // Data-fetching
          if (id.includes("@tanstack")) return "vendor-query";
          // Charts — large, only used on analytics/market pages
          if (
            id.includes("recharts") ||
            id.includes("/d3-") ||
            id.includes("victory")
          ) return "vendor-charts";
          // TradingView widgets — very large, trade pages only
          if (id.includes("tradingview")) return "vendor-trading";
          // UI framework
          if (id.includes("react-bootstrap") || id.includes("/bootstrap/")) return "vendor-ui";
          // Real-time layer — dashboard only
          if (id.includes("socket.io")) return "vendor-socket";
          // Utilities
          if (id.includes("axios") || id.includes("zustand")) return "vendor-utils";
          // Everything else (qrcode, icons, etc.)
          return "vendor-misc";
        },
      },
    },
    // Warn on chunks > 800 kB (default 500 kB is too noisy with trading widgets)
    chunkSizeWarningLimit: 800,
  },

  server: {
    proxy: {
      "/api": {
        target: "http://localhost:5001",
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("error", silentProxyError);
        },
      },
      "/socket.io": {
        target: "http://localhost:5001",
        changeOrigin: true,
        ws: true,
        configure: (proxy) => {
          proxy.on("error", silentProxyError);
        },
      },
      "/uploads": {
        target: "http://localhost:5001",
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("error", silentProxyError);
        },
      },
    },
  },
});
