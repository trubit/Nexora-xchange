import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  getSyncStatus,
  getOrderBook,
  getOrderBookSymbols,
  getReplicationStats,
  getRecentEvents,
  getConflictStats,
  getTimestampStatus,
  getConsistencyReport,
} from "../controllers/globalSyncController.js";

const router = express.Router();

// Admin-only access for global sync operations
router.use(requireAuth, requireRole("admin"));

// Sync engine status
router.get("/status",             getSyncStatus);

// Order book
router.get("/order-book/symbols", getOrderBookSymbols);
router.get("/order-book/:symbol", getOrderBook);

// Event replication
router.get("/replication/stats",  getReplicationStats);
router.get("/replication/events", getRecentEvents);

// Conflict resolution
router.get("/conflicts",          getConflictStats);

// Timestamp authority
router.get("/timestamp",          getTimestampStatus);

// Consistency
router.get("/consistency",        getConsistencyReport);

export default router;
