import { requestWithRetry } from "../../api/client.js";

export const executionRouterApi = {
  stats:   ()       => requestWithRetry({ method: "get", url: "/api/execution-router/stats"   }),
  latency: ()       => requestWithRetry({ method: "get", url: "/api/execution-router/latency" }),
  history: (p = {}) => requestWithRetry({ method: "get", url: "/api/execution-router/history",params: p }),
};
