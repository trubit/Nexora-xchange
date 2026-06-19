export const queryKeys = {
  blogs: {
    all: ["blogs"],
    list: (params = {}) => ["blogs", "list", params],
    detail: (id) => ["blogs", "detail", id],
    related: (id) => ["blogs", "related", id],
  },
  market: {
    mainCoin: ["market", "main-coin"],
    globalStats: ["market", "global-stats"],
    topCoins: ["market", "top-coins"],
    trusonCoin: ["market", "truson-coin"],
  },
  currency: {
    rates: (base = "USD") => ["currency", "rates", base],
  },
  trade: {
    pairs: ["trade", "pairs"],
    marketState: (symbol) => ["trade", "market-state", symbol],
    myMarketState: (symbol) => ["trade", "my-market-state", symbol],
  },
  dashboard: {
    summary: ["dashboard", "summary"],
  },
  wallet: {
    myWallets:       ["wallet", "my-wallets"],
    allTransactions: ["wallet", "transactions"],
    transactions:    (params = {}) => ["wallet", "transactions", params],
  },
  orders: {
    open:    (params = {}) => ["orders", "open",    params],
    history: (params = {}) => ["orders", "history", params],
  },
  assets: {
    all: ["assets", "supported"],
  },
  notifications: {
    list:        (params = {}) => ["notifications", "list", params],
    unreadCount: ["notifications", "unread-count"],
  },
  fiat: {
    wallet:       ["fiat", "wallet"],
    bankAccounts: ["fiat", "bank-accounts"],
    transactions: (params = {}) => ["fiat", "transactions", params],
    transaction:  (txId)         => ["fiat", "transaction", txId],
    feePreview:   (currency, amount) => ["fiat", "fee-preview", currency, amount],
  },
};

