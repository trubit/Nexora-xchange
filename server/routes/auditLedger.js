import { Router }          from "express";
import { requireAuth }     from "../middleware/auth.js";
import { requireRole }     from "../middleware/auth.js";
import {
  getEntries,
  getEntry,
  appendEntry,
  voidEntry,
  verifyChain,
  getLedgerStats,
  generateReport,
  getReport,
  listReports,
  submitReport,
  runReconciliation,
  getSnapshot,
  listSnapshots,
  resolveSnapshot,
} from "../controllers/auditLedgerController.js";

const router = Router();

// ── Ledger (admin only — immutable records are sensitive) ─────────────────────
router.get   ("/entries",                  requireAuth, requireRole("admin"), getEntries);
router.get   ("/entries/:entryId",         requireAuth, requireRole("admin"), getEntry);
router.post  ("/entries",                  requireAuth, requireRole("admin"), appendEntry);
router.post  ("/entries/:entryId/void",    requireAuth, requireRole("admin"), voidEntry);
router.get   ("/verify-chain",             requireAuth, requireRole("admin"), verifyChain);
router.get   ("/stats",                    requireAuth, requireRole("admin"), getLedgerStats);

// ── Compliance Reports ────────────────────────────────────────────────────────
router.post  ("/reports",                  requireAuth, requireRole("admin"), generateReport);
router.get   ("/reports",                  requireAuth, requireRole("admin"), listReports);
router.get   ("/reports/:reportId",        requireAuth, requireRole("admin"), getReport);
router.post  ("/reports/:reportId/submit", requireAuth, requireRole("admin"), submitReport);

// ── Reconciliation ────────────────────────────────────────────────────────────
router.post  ("/reconciliation/run",       requireAuth, requireRole("admin"), runReconciliation);
router.get   ("/reconciliation",           requireAuth, requireRole("admin"), listSnapshots);
router.get   ("/reconciliation/:snapshotId",          requireAuth, requireRole("admin"), getSnapshot);
router.patch ("/reconciliation/:snapshotId/resolve",  requireAuth, requireRole("admin"), resolveSnapshot);

export default router;
