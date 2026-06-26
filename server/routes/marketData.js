import { Router }         from "express";
import { PAIRS }          from "../config/supportedAssets.js";
import { getLiveTicker }  from "../services/tradeService.js";

const router = Router();

/**
 * Normalise a getLiveTicker() snapshot into the same shape
 * that PriceEngine._format() produces, so the frontend only
 * needs to handle one schema.
 */
const normaliseLiveTicker = (t) => ({
  symbol:         t.symbol,
  lastPrice:      t.lastPrice,
  openPrice24h:   t.lastPrice,           // approximate when no real 24h window
  high24h:        t.high24h,
  low24h:         t.low24h,
  volume24h:      t.volumeBase24h  ?? 0,
  quoteVolume24h: t.volumeQuote24h ?? 0,
  trades24h:      0,
  priceChange:    t.lastPrice * ((t.change24h ?? 0) / 100),
  priceChangePct: t.change24h      ?? 0,
  ts:             Date.now(),
  source:         "internal",
});

// GET /api/market-data/summary — all available tickers
router.get("/summary", (req, res) => {
  const svc = req.app.locals.marketDataService;

  // Collect whatever the PriceEngine already knows
  const priceEngineTickers = svc ? svc.getAllTickers() : [];
  const priceMap = new Map(priceEngineTickers.map((t) => [t.symbol, t]));

  // Fill in every supported pair that the PriceEngine hasn't seen yet
  for (const pair of PAIRS) {
    if (priceMap.has(pair.symbol)) continue;
    const t = getLiveTicker(pair.symbol);
    if (t) priceMap.set(pair.symbol, normaliseLiveTicker(t));
  }

  res.json({ tickers: [...priceMap.values()] });
});

// GET /api/market-data/ticker/:symbol — single pair ticker
router.get("/ticker/:symbol", (req, res) => {
  const sym = String(req.params.symbol).toUpperCase();
  const svc = req.app.locals.marketDataService;

  // Try PriceEngine first, fall back to tradeService
  const ticker =
    (svc ? svc.getTicker(sym) : null) ??
    (() => { const t = getLiveTicker(sym); return t ? normaliseLiveTicker(t) : null; })();

  if (!ticker) return res.status(404).json({ message: `No market data for ${sym}.` });
  res.json(ticker);
});

// GET /api/market-data/candles/:symbol?interval=1m&limit=200
router.get("/candles/:symbol", async (req, res) => {
  const svc = req.app.locals.marketDataService;
  if (!svc) return res.status(503).json({ message: "Market data service not ready." });

  const validIntervals = ["1m", "5m", "15m", "1h", "4h", "1d"];
  const sym      = String(req.params.symbol).toUpperCase();
  const interval = req.query.interval || "1m";
  const limit    = Math.min(500, Math.max(1, Number(req.query.limit) || 200));

  if (!validIntervals.includes(interval)) {
    return res.status(400).json({ message: `Invalid interval. Allowed: ${validIntervals.join(", ")}` });
  }

  const candles = await svc.getCandles(sym, interval, limit);
  res.json({ symbol: sym, interval, candles });
});

export default router;
