import { regulatoryComplianceService } from "../services/regulatoryComplianceService.js";

const hasAccess = (user) =>
  user && ["admin", "compliance_officer", "finance_admin"].includes(user.role);

// ── Sanctions ─────────────────────────────────────────────────────────────────

export async function screenEntity(req, res) {
  try {
    if (!hasAccess(req.user)) return res.status(403).json({ error: "Forbidden." });
    const hits = await regulatoryComplianceService.screenEntity(req.body);
    res.json({ hits });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

export async function getSanctionHits(req, res) {
  try {
    if (!hasAccess(req.user)) return res.status(403).json({ error: "Forbidden." });
    const { status, userId, page, limit } = req.query;
    const result = await regulatoryComplianceService.getSanctionHits({
      status, userId,
      page: parseInt(page || "1", 10),
      limit: parseInt(limit || "50", 10),
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function reviewSanctionHit(req, res) {
  try {
    if (!hasAccess(req.user)) return res.status(403).json({ error: "Forbidden." });
    const hit = await regulatoryComplianceService.reviewSanctionHit(
      req.params.hitId,
      { ...req.body, reviewedBy: req.user._id }
    );
    res.json({ hit });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// ── Travel Rule ───────────────────────────────────────────────────────────────

export async function getTravelRuleRecords(req, res) {
  try {
    if (!hasAccess(req.user)) return res.status(403).json({ error: "Forbidden." });
    const { status, page, limit } = req.query;
    const result = await regulatoryComplianceService.getTravelRuleRecords({
      status,
      page:  parseInt(page  || "1",  10),
      limit: parseInt(limit || "50", 10),
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function createTravelRuleRecord(req, res) {
  try {
    if (!hasAccess(req.user)) return res.status(403).json({ error: "Forbidden." });
    const record = await regulatoryComplianceService.createTravelRuleRecord(req.body);
    if (!record) return res.json({ message: "Below Travel Rule threshold — no record created.", record: null });
    res.status(201).json({ record });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// ── SARs ──────────────────────────────────────────────────────────────────────

export async function getSars(req, res) {
  try {
    if (!hasAccess(req.user)) return res.status(403).json({ error: "Forbidden." });
    const { status, userId, page, limit } = req.query;
    const result = await regulatoryComplianceService.getSars({
      status, userId,
      page:  parseInt(page  || "1",  10),
      limit: parseInt(limit || "50", 10),
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function createSar(req, res) {
  try {
    if (!hasAccess(req.user)) return res.status(403).json({ error: "Forbidden." });
    const sar = await regulatoryComplianceService.createSar({
      ...req.body,
      preparedBy: req.user._id,
    });
    res.status(201).json({ sar });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

export async function submitSar(req, res) {
  try {
    if (!hasAccess(req.user)) return res.status(403).json({ error: "Forbidden." });
    const sar = await regulatoryComplianceService.submitSar(req.params.sarId, {
      approvedBy: req.user._id,
      filedWith:  req.body.filedWith,
    });
    res.json({ sar });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// ── Regulatory reports ────────────────────────────────────────────────────────

export async function getReports(req, res) {
  try {
    if (!hasAccess(req.user)) return res.status(403).json({ error: "Forbidden." });
    const { status, type, page, limit } = req.query;
    const result = await regulatoryComplianceService.getReports({
      status, type,
      page:  parseInt(page  || "1",  10),
      limit: parseInt(limit || "20", 10),
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function generateReport(req, res) {
  try {
    if (!hasAccess(req.user)) return res.status(403).json({ error: "Forbidden." });
    const report = await regulatoryComplianceService.generateReport({
      ...req.body,
      generatedBy: req.user._id || "admin",
    });
    res.status(201).json({ report });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// ── Statistics ────────────────────────────────────────────────────────────────

export async function getStatistics(req, res) {
  try {
    if (!hasAccess(req.user)) return res.status(403).json({ error: "Forbidden." });
    const stats = await regulatoryComplianceService.getStatistics();
    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
