import express from "express";
import axios from "axios";
import { cacheGet, cacheSet } from "../utils/cache.js";

const router = express.Router();

router.get("/latest", async (req, res) => {
  try {
    const { from = "USD" } = req.query;
    const cacheKey = `currency:latest:${String(from).toUpperCase()}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const url = `https://api.frankfurter.dev/v1/latest?from=${encodeURIComponent(from)}`;
    const response = await axios.get(url, { timeout: 10000 });
    await cacheSet(cacheKey, response.data, 300);
    return res.json(response.data);
  } catch (err) {
    console.error("Currency conversion error:", err.message);
    const statusCode = err.response?.status || 500;
    const errorMessage =
      err.response?.data?.message || err.message || "Failed to fetch currency rates.";
    return res.status(statusCode).json({ message: errorMessage });
  }
});

export default router;
