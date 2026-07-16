import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  getPerformanceMetrics,
  getEventLoopMetrics,
  getCacheMetrics,
  getBatchQueueMetrics,
  getRedisMetrics,
  flushBatchQueue,
  clearMemoryCache,
} from "../controllers/performanceController.js";

const router = express.Router();

// All performance endpoints are admin-only
router.use(requireAuth, requireRole("admin"));

router.get("/",             getPerformanceMetrics);
router.get("/event-loop",   getEventLoopMetrics);
router.get("/cache",        getCacheMetrics);
router.get("/batch",        getBatchQueueMetrics);
router.get("/redis",        getRedisMetrics);
router.post("/batch/:queue/flush", flushBatchQueue);
router.delete("/cache",     clearMemoryCache);

export default router;
