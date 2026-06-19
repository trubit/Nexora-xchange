import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  freezeAccount,
  getHighRiskProfiles,
  getRecentRiskEvents,
  getRiskStats,
  getUserRiskEvents,
  getUserRiskProfile,
  unfreezeAccount,
} from "../services/riskService.js";

const router = Router();
router.use(requireAuth);

// ── User-facing ───────────────────────────────────────────────────────────────

// GET /api/risk/me — own risk profile (score, level, active flags, cooldown)
router.get("/me", async (req, res) => {
  const profile = await getUserRiskProfile(req.user._id);
  res.json({
    score:    profile.score,
    level:    profile.level,
    frozen:   profile.frozen,
    frozenReason: profile.frozen ? profile.frozenReason : undefined,
    withdrawalCooldownUntil:  profile.withdrawalCooldownUntil,
    withdrawalCooldownReason: profile.withdrawalCooldownUntil ? profile.withdrawalCooldownReason : undefined,
    flags: profile.flags
      .filter((f) => !f.expiresAt || new Date(f.expiresAt) > new Date())
      .map((f) => ({ type: f.type, setAt: f.setAt, expiresAt: f.expiresAt })),
  });
});

// GET /api/risk/events — own risk event history
router.get("/events", async (req, res) => {
  const events = await getUserRiskEvents(req.user._id, 30);
  res.json({ events });
});

// ── Admin ─────────────────────────────────────────────────────────────────────

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin access required." });
  }
  next();
};

// GET /api/risk/admin/stats
router.get("/admin/stats", requireAdmin, async (_req, res) => {
  const stats = await getRiskStats();
  res.json(stats);
});

// GET /api/risk/admin/users — high-risk and frozen accounts
router.get("/admin/users", requireAdmin, async (req, res) => {
  const limit    = Math.min(Number(req.query.limit) || 50, 200);
  const profiles = await getHighRiskProfiles(limit);
  res.json({ profiles });
});

// GET /api/risk/admin/users/:userId — full profile for one user
router.get("/admin/users/:userId", requireAdmin, async (req, res) => {
  const profile = await getUserRiskProfile(req.params.userId);
  const events  = await getUserRiskEvents(req.params.userId, 20);
  res.json({ profile, events });
});

// POST /api/risk/admin/freeze/:userId
router.post("/admin/freeze/:userId", requireAdmin, async (req, res) => {
  const { reason } = req.body;
  if (!reason?.trim()) return res.status(400).json({ message: "reason is required." });
  const profile = await freezeAccount(req.params.userId, reason.trim(), req.user._id);
  res.json({ message: "Account frozen.", score: profile.score, level: profile.level });
});

// POST /api/risk/admin/unfreeze/:userId
router.post("/admin/unfreeze/:userId", requireAdmin, async (req, res) => {
  const profile = await unfreezeAccount(req.params.userId, req.user._id);
  res.json({ message: "Account unfrozen.", score: profile.score, level: profile.level });
});

// GET /api/risk/admin/events — recent events across all users
router.get("/admin/events", requireAdmin, async (req, res) => {
  const limit  = Math.min(Number(req.query.limit) || 100, 500);
  const events = await getRecentRiskEvents(limit);
  res.json({ events });
});

export default router;
