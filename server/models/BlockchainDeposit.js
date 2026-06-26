import mongoose from "mongoose";

/**
 * Maps a user → asset → chain to a specific blockchain deposit address.
 * When the NodeListener detects a transaction to this address,
 * the DepositDetector credits the user's internal ledger.
 *
 * Address assignment strategies (set by source field):
 *   "hd"     — derived from exchange HD public key (requires ethers/bip32 library)
 *   "manual" — admin-assigned address (useful for chains without HD support)
 *   "shared" — shared hot-wallet with a unique deposit tag/memo
 */
const BlockchainDepositSchema = new mongoose.Schema(
  {
    user:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    asset:   { type: String, required: true },
    chain:   { type: String, required: true },
    network: { type: String, required: true },

    address:       { type: String, required: true },
    depositTag:    { type: String, default: "" },      // memo/tag for shared-address chains
    derivationPath:{ type: String, default: "" },      // BIP-44 path if hd-derived

    source:  { type: String, enum: ["hd", "manual", "shared"], default: "shared" },
    active:  { type: Boolean, default: true },

    // Cumulative stats (informational — ledger is authoritative)
    totalDeposited: { type: Number, default: 0 },
    depositCount:   { type: Number, default: 0 },
    lastDepositAt:  { type: Date, default: null },
  },
  { timestamps: true }
);

BlockchainDepositSchema.index({ user: 1, asset: 1, chain: 1 }, { unique: true });
BlockchainDepositSchema.index({ address: 1, chain: 1 });
BlockchainDepositSchema.index({ active: 1, chain: 1 });

BlockchainDepositSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => { ret.id = ret._id?.toString(); delete ret._id; },
});

export default mongoose.model("BlockchainDeposit", BlockchainDepositSchema);
