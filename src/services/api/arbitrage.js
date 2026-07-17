import { requestWithRetry } from "../../api/client.js";

export const arbitrageApi = {
  live:     (p = {}) => requestWithRetry({ method: "get", url: "/api/arbitrage/live",     params: p }),
  history:  (p = {}) => requestWithRetry({ method: "get", url: "/api/arbitrage/history",  params: p }),
  snapshot: ()       => requestWithRetry({ method: "get", url: "/api/arbitrage/snapshot" }),
  exchanges:()       => requestWithRetry({ method: "get", url: "/api/arbitrage/exchanges"}),
  symbols:  ()       => requestWithRetry({ method: "get", url: "/api/arbitrage/symbols"  }),
  stats:    ()       => requestWithRetry({ method: "get", url: "/api/arbitrage/admin/stats" }),
  simulate: (body)   => requestWithRetry({ method: "post",url: "/api/arbitrage/simulate", data: body }),
};
