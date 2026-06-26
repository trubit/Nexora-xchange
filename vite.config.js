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
