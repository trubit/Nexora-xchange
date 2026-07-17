import { requestWithRetry } from "../../api/client.js";

export const liquidityAggregatorApi = {
  providers: ()         => requestWithRetry({ method: "get", url: "/api/liquidity-aggregator/providers" }),
  stats:     ()         => requestWithRetry({ method: "get", url: "/api/liquidity-aggregator/stats"     }),
  book:      (pair)     => requestWithRetry({ method: "get", url: `/api/liquidity-aggregator/book/${pair}` }),
  allBooks:  (pair)     => requestWithRetry({ method: "get", url: "/api/liquidity-aggregator/all-books", params: { pair } }),
  slippage:  (pair, side, usd) =>
    requestWithRetry({ method: "get", url: `/api/liquidity-aggregator/slippage/${pair}`, params: { side, usdAmount: usd } }),
};
