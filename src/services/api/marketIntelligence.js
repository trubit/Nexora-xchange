import { requestWithRetry } from "../../api/client.js";

export const marketIntelligenceApi = {
  signals:       (p = {}) => requestWithRetry({ method: "get", url: "/api/market-intelligence/signals",       params: p }),
  whaleActivity: (p = {}) => requestWithRetry({ method: "get", url: "/api/market-intelligence/whale-activity",params: p }),
  stats:         ()        => requestWithRetry({ method: "get", url: "/api/market-intelligence/stats"          }),
};
