/**
 * AuditLedgerService — immutable, append-only financial audit ledger.
 *
 * HARD RULES (enforced here and in the model):
 *   1. NO deletion EVER — not for any reason, not by any user.
 *   2. NO modification of existing entries.
 *   3. Entries are chained by SHA-256 (each references prev hash).
 *   4. Entry IDs are monotonically increasing integers.
 *   5. Chain integrity can be verified at any time.
 *
 * To "reverse" an entry, create a VOID entry that references the original.
 */

import ImmutableLedgerEntry from "../models/ImmutableLedgerEntry.js";
import logger               from "../config/logger.js";

// ── Genesis hash ──────────────────────────────────────────────────────────────

const GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

// ── Service ───────────────────────────────────────────────────────────────────

export class AuditLedgerService {
  constructor() {
    this._lastEntryId   = 0;
    this._lastHash      = GENESIS_HASH;
    this._initialized   = false;
    this._lock          = Promise.resolve();   // simple serialisation lock
  }

  /**
   * Load last entry to continue the chain from the correct state.
   */
  async initialize() {
    const last = await ImmutableLedgerEntry.findOne().sort({ entryId: -1 }).lean();
    if (last) {
      this._lastEntryId = last.entryId;
      this._lastHash    = last.hash;
    }
    this._initialized = true;
    logger.info({ lastEntryId: this._lastEntryId }, "[AuditLedger] Initialized.");
  }

  /**
   * Append a new entry to the immutable ledger.
   * Serialised via promise chain to prevent race conditions on entryId.
   *
   * @param {{ type, userId, relatedId, asset, amount, balanceBefore, balanceAfter, description, metadata, recordedBy }} entry
   */
  async append(entry) {
    this._lock = this._lock.then(() => this._doAppend(entry));
    return this._lock;
  }

  async _doAppend({ type, userId = null, relatedId = null, asset, amount,
    balanceBefore = null, balanceAfter = null, currency = "USD",
    description, metadata = {}, recordedBy = "system" }) {
    const entryId   = this._lastEntryId + 1;
    const prevHash  = this._lastHash;
    const createdAt = new Date();

    const hash = ImmutableLedgerEntry.computeHash(
      prevHash, entryId, type, userId, relatedId, asset, amount, description, createdAt.toISOString()
    );

    const doc = await ImmutableLedgerEntry.create({
      entryId, prevHash, hash, type, userId, relatedId,
      asset, amount, balanceBefore, balanceAfter, currency,
      description, metadata, recordedBy, createdAt,
    });

    this._lastEntryId = entryId;
    this._lastHash    = hash;

    logger.debug({ entryId, type, asset, amount }, "[AuditLedger] Entry appended.");
    return doc.toObject();
  }

  /**
   * Create a VOID entry that logically reverses a previous entry.
   * The original entry is NEVER modified or deleted.
   */
  async voidEntry(originalEntryId, { reason, recordedBy = "system" } = {}) {
    const original = await ImmutableLedgerEntry.findOne({ entryId: originalEntryId }).lean();
    if (!original) throw new Error(`Entry ${originalEntryId} not found.`);
    if (original.type === "VOID") throw new Error("Cannot void a VOID entry.");

    return this.append({
      type:         "VOID",
      userId:       original.userId,
      relatedId:    String(original.entryId),
      asset:        original.asset,
      amount:       -original.amount,   // negation
      balanceBefore:original.balanceAfter,
      balanceAfter: original.balanceBefore,
      currency:     original.currency,
      description:  `VOID of entry #${originalEntryId}: ${reason ?? "admin_override"}`,
      metadata:     { voidedEntryId: originalEntryId, reason },
      recordedBy,
    });
  }

  /**
   * Verify chain integrity from startId to endId.
   * @returns {{ valid, checkedCount, firstBadId }}
   */
  async verifyChain({ startId = 1, endId = null } = {}) {
    const q = { entryId: { $gte: startId } };
    if (endId != null) q.entryId.$lte = endId;

    const entries = await ImmutableLedgerEntry.find(q).sort({ entryId: 1 }).lean();
    if (!entries.length) return { valid: true, checkedCount: 0, firstBadId: null };

    let expectedPrevHash = entries[0].prevHash;
    let checkedCount     = 0;

    for (const entry of entries) {
      const expected = ImmutableLedgerEntry.computeHash(
        entry.prevHash, entry.entryId, entry.type, entry.userId,
        entry.relatedId, entry.asset, entry.amount, entry.description,
        new Date(entry.createdAt).toISOString()
      );

      if (entry.hash !== expected || entry.prevHash !== expectedPrevHash) {
        return { valid: false, checkedCount, firstBadId: entry.entryId };
      }
      expectedPrevHash = entry.hash;
      checkedCount++;
    }

    return { valid: true, checkedCount, firstBadId: null };
  }

  // ── Queries (read-only) ──────────────────────────────────────────────────────

  async getEntries({ userId, type, asset, limit = 50, skip = 0 } = {}) {
    const q = {};
    if (userId) q.userId = userId;
    if (type)   q.type   = type;
    if (asset)  q.asset  = asset;
    return ImmutableLedgerEntry.find(q).sort({ entryId: -1 }).skip(skip).limit(limit).lean();
  }

  async getEntry(entryId) {
    return ImmutableLedgerEntry.findOne({ entryId }).lean();
  }

  async getStats() {
    const [total, byType, lastEntry] = await Promise.all([
      ImmutableLedgerEntry.countDocuments(),
      ImmutableLedgerEntry.aggregate([{ $group: { _id: "$type", count: { $sum: 1 } } }]),
      ImmutableLedgerEntry.findOne().sort({ entryId: -1 }).lean(),
    ]);
    return {
      total,
      lastEntryId: lastEntry?.entryId ?? 0,
      lastHash:    lastEntry?.hash    ?? GENESIS_HASH,
      byType:      Object.fromEntries(byType.map((t) => [t._id, t.count])),
    };
  }
}

export const auditLedgerService = new AuditLedgerService();
