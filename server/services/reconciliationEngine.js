/**
 * ReconciliationEngine — internal ledger vs external records reconciliation.
 *
 * Compares ImmutableLedgerEntry records against SettlementRecord (blockchain)
 * and Transaction (internal) records to detect discrepancies.
 *
 * Results are stored as ReconciliationSnapshot — never modified, never deleted.
 */

import { v4 as uuidv4 }         from "uuid";
import ReconciliationSnapshot    from "../models/ReconciliationSnapshot.js";
import ImmutableLedgerEntry      from "../models/ImmutableLedgerEntry.js";
import logger                    from "../config/logger.js";

export class ReconciliationEngine {
  /**
   * Run a reconciliation pass and save a ReconciliationSnapshot.
   *
   * @param {{ type, asOf }} options
   */
  async run({ type = "SPOT", asOf = new Date() } = {}) {
    const snapshotId = `RECON-${uuidv4().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
    asOf = new Date(asOf);

    logger.info({ snapshotId, type, asOf }, "[Reconciliation] Starting run.");

    // Create snapshot in pending state
    const snapshot = await ReconciliationSnapshot.create({
      snapshotId, type, asOf, status: "pending",
    });

    try {
      const { discrepancies, totalChecked, totalMatched, totalMismatch } =
        await this._reconcile(asOf);

      const status = discrepancies.length === 0 ? "clean" : "discrepant";

      await ReconciliationSnapshot.findByIdAndUpdate(snapshot._id, {
        status, discrepancies, totalChecked, totalMatched, totalMismatch,
      });

      logger.info(
        { snapshotId, status, totalChecked, totalMismatch },
        "[Reconciliation] Run complete."
      );

      return ReconciliationSnapshot.findById(snapshot._id).lean();
    } catch (err) {
      logger.error({ err: err.message, snapshotId }, "[Reconciliation] Run failed.");
      throw err;
    }
  }

  /**
   * Internal reconciliation logic.
   * Compares ledger entry amounts per (userId, asset) against any available
   * external sources (settlement records, transaction records).
   *
   * For now: cross-check ledger DEPOSIT/WITHDRAWAL entries vs SETTLEMENT entries
   * on the same relatedId to detect missing or mismatched amounts.
   */
  async _reconcile(asOf) {
    const discrepancies = [];

    // Load all ledger entries up to asOf
    const entries = await ImmutableLedgerEntry.find({
      createdAt: { $lte: asOf },
    }).lean();

    // Group by type for cross-checks
    const byRelatedId = new Map();
    for (const e of entries) {
      if (!e.relatedId) continue;
      const key = `${e.relatedId}::${e.asset}`;
      if (!byRelatedId.has(key)) byRelatedId.set(key, []);
      byRelatedId.get(key).push(e);
    }

    let totalChecked = entries.length;
    let totalMatched = 0;
    let totalMismatch = 0;

    // Cross-check: SETTLEMENT entries vs DEPOSIT entries sharing the same relatedId
    for (const [key, group] of byRelatedId) {
      const settlements = group.filter((e) => e.type === "SETTLEMENT");
      const deposits    = group.filter((e) => e.type === "DEPOSIT");

      if (settlements.length === 0 && deposits.length === 0) {
        totalMatched++;
        continue;
      }

      const settlementTotal = settlements.reduce((s, e) => s + e.amount, 0);
      const depositTotal    = deposits.reduce((s, e) => s + e.amount, 0);

      if (settlements.length > 0 && deposits.length > 0) {
        const diff = Math.abs(settlementTotal - depositTotal);
        const [relatedId, asset] = key.split("::");
        if (diff > 0.000001) {
          discrepancies.push({
            type:        "AMOUNT_MISMATCH",
            asset,
            expected:    settlementTotal,
            actual:      depositTotal,
            diff,
            relatedId,
            description: `Settlement total ${settlementTotal} != deposit total ${depositTotal} for relatedId ${relatedId}`,
          });
          totalMismatch++;
        } else {
          totalMatched++;
        }
      } else {
        totalMatched++;
      }
    }

    // Check for VOID entries referencing non-existent originals
    const voidEntries = entries.filter((e) => e.type === "VOID");
    for (const ve of voidEntries) {
      const originalId = Number(ve.relatedId);
      const original   = entries.find((e) => e.entryId === originalId);
      if (!original) {
        discrepancies.push({
          type:        "VOID_ORPHAN",
          asset:       ve.asset,
          expected:    originalId,
          actual:      null,
          diff:        1,
          relatedId:   String(ve.relatedId),
          description: `VOID entry #${ve.entryId} references missing original entry #${originalId}`,
        });
        totalMismatch++;
      }
    }

    return { discrepancies, totalChecked, totalMatched, totalMismatch };
  }

  async getSnapshot(snapshotId) {
    return ReconciliationSnapshot.findOne({ snapshotId }).lean();
  }

  async listSnapshots({ type, status, limit = 50, skip = 0 } = {}) {
    const q = {};
    if (type)   q.type   = type;
    if (status) q.status = status;
    return ReconciliationSnapshot.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
  }

  async resolveSnapshot(snapshotId) {
    const snap = await ReconciliationSnapshot.findOne({ snapshotId });
    if (!snap) throw new Error("Snapshot not found.");
    if (snap.status === "clean") return snap.toObject();
    snap.status     = "clean";
    snap.resolvedAt = new Date();
    await snap.save();
    return snap.toObject();
  }
}

export const reconciliationEngine = new ReconciliationEngine();
