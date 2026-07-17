import { requestWithRetry } from "../../api/client.js";

export const creditRiskApi = {
  summary:  () => requestWithRetry({ method: "get", url: "/api/credit-risk/my/summary"  }),
  credit:   () => requestWithRetry({ method: "get", url: "/api/credit-risk/my/credit"   }),
  behavior: () => requestWithRetry({ method: "get", url: "/api/credit-risk/my/behavior" }),
  exposure: () => requestWithRetry({ method: "get", url: "/api/credit-risk/my/exposure" }),
  heatmap:  () => requestWithRetry({ method: "get", url: "/api/credit-risk/my/heatmap"  }),
  history:  () => requestWithRetry({ method: "get", url: "/api/credit-risk/my/history"  }),
  liquidity:() => requestWithRetry({ method: "get", url: "/api/credit-risk/liquidity"   }),
};
