import { requestWithRetry } from "../../api/client.js";

export const settlementApi = {
  chains:   () => requestWithRetry({ method: "get", url: "/api/settlement/chains"   }),
  my:       (p = {}) => requestWithRetry({ method: "get", url: "/api/settlement/my", params: p }),
  stats:    () => requestWithRetry({ method: "get", url: "/api/settlement/stats"    }),
  pending:  () => requestWithRetry({ method: "get", url: "/api/settlement/pending"  }),
  indexer:  () => requestWithRetry({ method: "get", url: "/api/settlement/indexer"  }),
  verify:   (chain, txHash) => requestWithRetry({ method: "get", url: `/api/settlement/verify/${chain}/${txHash}` }),
};
