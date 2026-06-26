import { requestWithRetry } from "../../api/client.js";

const get = (url) => requestWithRetry({ method: "get", url });

export const analyticsApi = {
  insights:         (refresh = false) =>
    get(`/api/analytics/insights${refresh ? "?refresh=true" : ""}`),
  portfolio:        ()       => get("/api/analytics/portfolio"),
  pnl:              ()       => get("/api/analytics/pnl"),
  activity:         ()       => get("/api/analytics/activity"),
  market:           ()       => get("/api/analytics/market"),
  patterns:         (symbol, interval = "1h") =>
    get(`/api/analytics/patterns/${symbol}?interval=${interval}`),
};
