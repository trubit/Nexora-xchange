import { auditLedgerService }          from "../services/auditLedgerService.js";
import { complianceReportingEngine }   from "../services/complianceReportingEngine.js";
import { reconciliationEngine }        from "../services/reconciliationEngine.js";

// ── Ledger ────────────────────────────────────────────────────────────────────

export async function getEntries(req, res, next) {
  try {
    const { userId, type, asset, limit = 50, skip = 0 } = req.query;
    const entries = await auditLedgerService.getEntries({
      userId, type, asset,
      limit: Math.min(Number(limit), 200),
      skip:  Number(skip),
    });
    res.json({ ok: true, data: entries });
  } catch (err) { next(err); }
}

export async function getEntry(req, res, next) {
  try {
    const entry = await auditLedgerService.getEntry(Number(req.params.entryId));
    if (!entry) return res.status(404).json({ ok: false, error: "Entry not found." });
    res.json({ ok: true, data: entry });
  } catch (err) { next(err); }
}

export async function appendEntry(req, res, next) {
  try {
    const { type, userId, relatedId, asset, amount, balanceBefore, balanceAfter,
            currency, description, metadata } = req.body;
    if (!type || !asset || amount == null || !description) {
      return res.status(400).json({ ok: false, error: "type, asset, amount, description required." });
    }
    const entry = await auditLedgerService.append({
      type, userId: userId ?? null, relatedId: relatedId ?? null,
      asset, amount: Number(amount),
      balanceBefore: balanceBefore ?? null, balanceAfter: balanceAfter ?? null,
      currency: currency ?? "USD",
      description, metadata: metadata ?? {},
      recordedBy: req.user?._id ?? "system",
    });
    res.status(201).json({ ok: true, data: entry });
  } catch (err) { next(err); }
}

export async function voidEntry(req, res, next) {
  try {
    const { reason } = req.body;
    const entry = await auditLedgerService.voidEntry(
      Number(req.params.entryId),
      { reason, recordedBy: String(req.user._id) }
    );
    res.status(201).json({ ok: true, data: entry });
  } catch (err) { next(err); }
}

export async function verifyChain(req, res, next) {
  try {
    const { startId, endId } = req.query;
    const result = await auditLedgerService.verifyChain({
      startId: startId ? Number(startId) : 1,
      endId:   endId   ? Number(endId)   : null,
    });
    res.json({ ok: true, data: result });
  } catch (err) { next(err); }
}

export async function getLedgerStats(req, res, next) {
  try {
    const stats = await auditLedgerService.getStats();
    res.json({ ok: true, data: stats });
  } catch (err) { next(err); }
}

// ── Compliance Reports ────────────────────────────────────────────────────────

export async function generateReport(req, res, next) {
  try {
    const { type = "ON_DEMAND", periodStart, periodEnd } = req.body;
    if (!periodStart || !periodEnd) {
      return res.status(400).json({ ok: false, error: "periodStart and periodEnd required." });
    }
    const report = await complianceReportingEngine.generateReport({
      type, periodStart, periodEnd,
      generatedBy: String(req.user._id),
    });
    res.status(201).json({ ok: true, data: report });
  } catch (err) { next(err); }
}

export async function getReport(req, res, next) {
  try {
    const report = await complianceReportingEngine.getReport(req.params.reportId);
    if (!report) return res.status(404).json({ ok: false, error: "Report not found." });
    res.json({ ok: true, data: report });
  } catch (err) { next(err); }
}

export async function listReports(req, res, next) {
  try {
    const { type, status, limit = 50, skip = 0 } = req.query;
    const reports = await complianceReportingEngine.listReports({
      type, status,
      limit: Math.min(Number(limit), 200),
      skip:  Number(skip),
    });
    res.json({ ok: true, data: reports });
  } catch (err) { next(err); }
}

export async function submitReport(req, res, next) {
  try {
    const { signature } = req.body;
    const report = await complianceReportingEngine.submitReport(req.params.reportId, {
      signature,
      submittedBy: String(req.user._id),
    });
    res.json({ ok: true, data: report });
  } catch (err) { next(err); }
}

// ── Reconciliation ────────────────────────────────────────────────────────────

export async function runReconciliation(req, res, next) {
  try {
    const { type = "SPOT", asOf } = req.body;
    const snapshot = await reconciliationEngine.run({
      type, asOf: asOf ? new Date(asOf) : new Date(),
    });
    res.status(201).json({ ok: true, data: snapshot });
  } catch (err) { next(err); }
}

export async function getSnapshot(req, res, next) {
  try {
    const snapshot = await reconciliationEngine.getSnapshot(req.params.snapshotId);
    if (!snapshot) return res.status(404).json({ ok: false, error: "Snapshot not found." });
    res.json({ ok: true, data: snapshot });
  } catch (err) { next(err); }
}

export async function listSnapshots(req, res, next) {
  try {
    const { type, status, limit = 50, skip = 0 } = req.query;
    const snapshots = await reconciliationEngine.listSnapshots({
      type, status,
      limit: Math.min(Number(limit), 200),
      skip:  Number(skip),
    });
    res.json({ ok: true, data: snapshots });
  } catch (err) { next(err); }
}

export async function resolveSnapshot(req, res, next) {
  try {
    const snapshot = await reconciliationEngine.resolveSnapshot(req.params.snapshotId);
    res.json({ ok: true, data: snapshot });
  } catch (err) { next(err); }
}
