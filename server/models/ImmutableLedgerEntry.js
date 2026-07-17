import mongoose from "mongoose";
import crypto    from "crypto";

/**
 * ImmutableLedgerEntry — append-only financial audit ledger.
 *
 * CRITICAL RULES:
 *   - NO document may ever be deleted or updated.
 *   - Each entry contains a SHA-256 hash of the previous entry
 *     (forming a cryptographic chain — any tampering breaks the chain).
 *   - entryId is a sequential counter (1, 2, 3, …).
 *   - A "void" record is created instead of deletion when an error occurs.
 */
const ImmutableLedgerEntrySchema = new mongoose.Schema(
  {
    entryId:      { type: Number, required: true, unique: true, index: true },
    prevHash:     { type: String, required: true },   // SHA-256 of previous entry
    hash:         { type: String, required: true },   // SHA-256 of this entry's canonical content
    type: {
      type: String,
      enum: [
        "DEPOSIT", "WITHDRAWAL", "TRADE", "FEE", "ADJUSTMENT",
        "TRANSFER", "SETTLEMENT", "COMPLIANCE", "VOID",
      ],
      required: true,
      index: true,
    },
    userId:       { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    relatedId:    { type: String, default: null },    // external ref (orderId, txHash, etc.)
    asset:        { type: String, required: true },
    amount:       { type: Number, required: true },
    balanceBefore:{ type: Number, default: null },
    balanceAfter: { type: Number, default: null },
    currency:     { type: String, default: "USD" },
    description:  { type: String, required: true },
    metadata:     { type: mongoose.Schema.Types.Mixed, default: {} },
    recordedBy:   { type: String, default: "system" }, // "system" | admin user ID
  },
  {
    timestamps: true,
    versionKey: false,
    // Prevent any update operations at the schema level
    // Actual enforcement is in the service layer
  }
);

ImmutableLedgerEntrySchema.index({ userId: 1, createdAt: -1 });
ImmutableLedgerEntrySchema.index({ type: 1, createdAt: -1 });
ImmutableLedgerEntrySchema.index({ relatedId: 1 });

/**
 * Compute the canonical hash for a ledger entry.
 * Deterministic: same inputs always produce same hash.
 */
ImmutableLedgerEntrySchema.statics.computeHash = function(prevHash, entryId, type, userId, relatedId, asset, amount, description, createdAt) {
  const canonical = JSON.stringify({ prevHash, entryId, type, userId: String(userId), relatedId, asset, amount, description, createdAt });
  return crypto.createHash("sha256").update(canonical).digest("hex");
};

export default mongoose.model("ImmutableLedgerEntry", ImmutableLedgerEntrySchema);
