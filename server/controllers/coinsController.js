import path   from "path";
import multer from "multer";
import Coin   from "../models/Coin.js";
import axios  from "axios";
import { ASSETS } from "../config/supportedAssets.js";

// ── Multer — coin logo uploads ────────────────────────────────────────────────
import { COINS_DIR, deleteUploadedFile } from "../config/uploads.js";

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, COINS_DIR),
  filename:    (_req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase() || ".png";
    const name = `coin_${Date.now()}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (_req, file, cb) => {
  if (/^image\/(png|jpeg|jpg|webp|gif)$/.test(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed (png, jpg, webp, gif)."));
  }
};

export const uploadCoinLogo = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
}).single("logo");

const CG_BASE = "https://api.coingecko.com/api/v3";

// ── Public ────────────────────────────────────────────────────────────────────

// List all active DB coins.
export const listCoins = async (_req, res) => {
  const coins = await Coin.find({ isActive: true }).sort({ createdAt: -1 });
  res.json({ coins });
};

// Complete asset catalog: built-in ASSETS + active DB coins merged.
export const listAssets = async (_req, res) => {
  const map = {};
  for (const [symbol, meta] of Object.entries(ASSETS)) {
    map[symbol] = {
      symbol,
      name:     meta.name,
      network:  meta.network,
      decimals: meta.decimals,
      price:    meta.price ?? 0,
      source:   "built-in",
    };
  }
  const dbCoins = await Coin.find({ isActive: true }).lean();
  for (const c of dbCoins) {
    map[c.symbol] = {
      symbol:   c.symbol,
      name:     c.name,
      network:  c.network || "Ethereum",
      decimals: c.decimals || 8,
      price:    c.priceUsd || 0,
      logoUrl:  c.logoUrl,
      source:   "db",
    };
  }
  res.json({ assets: Object.values(map).sort((a, b) => a.symbol.localeCompare(b.symbol)) });
};

// ── Admin ─────────────────────────────────────────────────────────────────────

// Admin: create / add a new coin.
export const createCoin = async (req, res) => {
  const coin = await Coin.create(req.body);
  res.status(201).json({ coin });
};

// Admin: update coin metadata.
export const updateCoin = async (req, res) => {
  const coin = await Coin.findByIdAndUpdate(req.params.id, req.body, {
    new: true, runValidators: true,
  });
  if (!coin) return res.status(404).json({ message: "Coin not found." });
  return res.json({ coin });
};

// Admin: soft-delete (deactivate) or hard-delete a coin.
export const deleteCoin = async (req, res) => {
  const { hard } = req.query;
  if (hard === "true") {
    const coin = await Coin.findByIdAndDelete(req.params.id);
    if (coin?.logoUrl) deleteUploadedFile(coin.logoUrl);
    return res.json({ message: "Coin permanently deleted." });
  }
  const coin = await Coin.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!coin) return res.status(404).json({ message: "Coin not found." });
  return res.json({ coin });
};

// Admin: handle logo file upload, return the public URL.
// Pass ?coinId=<id> to automatically delete the coin's previous logo on replace.
export const handleLogoUpload = (req, res, next) => {
  uploadCoinLogo(req, res, async (err) => {
    if (err) {
      const msg = err.code === "LIMIT_FILE_SIZE"
        ? "Image too large — maximum 2 MB."
        : /^(ENOENT|EACCES|EPERM|ENOTDIR|EMFILE)/.test(err.code || "")
          ? "File storage unavailable. Please try again."
          : err.message || "Upload failed.";
      return res.status(400).json({ message: msg });
    }
    if (!req.file) return res.status(400).json({ message: "No file received." });
    try {
      const logoUrl = `/uploads/coins/${req.file.filename}`;
      // Delete old logo after writing the new file — coinId via route param or query string
      const coinId = req.params.id || req.query.coinId;
      if (coinId) {
        const existing = await Coin.findById(coinId).select("logoUrl").lean();
        if (existing?.logoUrl) deleteUploadedFile(existing.logoUrl);
      }
      res.json({ logoUrl });
    } catch (e) {
      next(e);
    }
  });
};

// Admin: search CoinGecko for a coin by name / symbol.
export const searchCoinGecko = async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.status(400).json({ message: "Query required." });
  try {
    const r = await axios.get(`${CG_BASE}/search`, {
      params: { query: q },
      timeout: 8000,
      headers: { Accept: "application/json" },
    });
    // Return only the coins array (top 10)
    const coins = (r.data.coins || []).slice(0, 10).map((c) => ({
      cgId:   c.id,
      symbol: c.symbol?.toUpperCase(),
      name:   c.name,
      thumb:  c.thumb,
      large:  c.large,
      rank:   c.market_cap_rank,
    }));
    res.json({ coins });
  } catch (err) {
    res.status(502).json({ message: "CoinGecko search failed.", detail: err.message });
  }
};

// Admin: fetch full details for a CoinGecko coin ID so the form can be pre-filled.
export const fetchCoinGeckoDetails = async (req, res) => {
  const id = String(req.params.cgId || "").trim();
  if (!id) return res.status(400).json({ message: "CoinGecko ID required." });
  try {
    const [detailRes, marketRes] = await Promise.all([
      axios.get(`${CG_BASE}/coins/${id}`, {
        params: {
          localization: false, tickers: false,
          market_data: true, community_data: false, developer_data: false,
        },
        timeout: 10_000,
        headers: { Accept: "application/json" },
      }),
      axios.get(`${CG_BASE}/coins/markets`, {
        params: { vs_currency: "usd", ids: id, per_page: 1, page: 1 },
        timeout: 8000,
        headers: { Accept: "application/json" },
      }),
    ]);

    const d   = detailRes.data;
    const mkt = marketRes.data?.[0] || {};

    res.json({
      cgId:        d.id,
      symbol:      (d.symbol || "").toUpperCase(),
      name:        d.name,
      description: d.description?.en?.split(".")[0] || "",
      logoUrl:     d.image?.large || mkt.image || "",
      website:     d.links?.homepage?.[0] || "",
      priceUsd:    mkt.current_price ?? d.market_data?.current_price?.usd ?? 0,
      change24h:   mkt.price_change_percentage_24h ?? d.market_data?.price_change_percentage_24h ?? 0,
      volume24h:   mkt.total_volume ?? d.market_data?.total_volume?.usd ?? 0,
      marketCap:   mkt.market_cap ?? d.market_data?.market_cap?.usd ?? 0,
      totalSupply: d.market_data?.total_supply ?? 0,
      network:     d.asset_platform_id
        ? d.asset_platform_id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        : "Ethereum",
      rank:        d.market_cap_rank,
    });
  } catch (err) {
    res.status(502).json({ message: "CoinGecko fetch failed.", detail: err.message });
  }
};
