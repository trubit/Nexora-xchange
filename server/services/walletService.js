import Wallet from "../models/Wallet.js";
import Transaction from "../models/Transaction.js";
import { emitWalletUpdated, emitTransactionCreated } from "../socket/walletEvents.js";
import { isSupported, getMeta, ASSETS } from "../config/supportedAssets.js";
import { notificationService } from "../notifications/NotificationService.js";
import {
  checkFrozen,
  checkWithdrawalAllowed,
  recordDeposit,
  recordWithdrawal,
} from "./riskService.js";

// Default wallets created for every new user (starters — other assets auto-create on first deposit).
const DEFAULT_ASSETS = ["USDT", "BTC", "ETH"];

const genRef = (prefix) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

// Create default wallets if the user has none.
export const ensureUserWallets = async (userId) => {
  const existing = await Wallet.find({ user: userId }).select("asset").lean();
  const existingAssets = new Set(existing.map((w) => w.asset));

  const missing = DEFAULT_ASSETS.filter((a) => !existingAssets.has(a));
  if (!missing.length) return;

  await Wallet.insertMany(
    missing.map((asset) => ({
      user:      userId,
      asset,
      balance:   0,
      available: 0,
      locked:    0,
      network:   ASSETS[asset]?.network || "",
      address:   "",
    })),
    { ordered: false }
  );
};

export const getWallets = async (userId) => {
  await ensureUserWallets(userId);

  const all = await Wallet.find({ user: userId }).sort({ updatedAt: -1 }).lean();

  // Deduplicate by asset — keep only the most-recently-updated wallet per asset.
  // This handles legacy duplicate documents created before the unique index was added.
  const seen = new Map();
  for (const w of all) {
    if (!seen.has(w.asset)) seen.set(w.asset, w);
  }

  return [...seen.values()].sort((a, b) => a.asset.localeCompare(b.asset));
};

export const deposit = async (userId, { asset, amount }) => {
  asset  = String(asset  || "").toUpperCase();
  amount = Number(amount);

  await checkFrozen(userId);

  if (!isSupported(asset))
    throw Object.assign(new Error(`Unsupported asset: ${asset}`), { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0)
    throw Object.assign(new Error("Amount must be a positive number."), { status: 400 });
  if (amount > 1_000_000)
    throw Object.assign(new Error("Deposit amount exceeds the maximum limit."), { status: 400 });

  const meta = getMeta(asset) || {};

  // Ensure wallet exists (atomic upsert — auto-creates for any supported asset).
  await Wallet.findOneAndUpdate(
    { user: userId, asset },
    {
      $setOnInsert: {
        user: userId, asset,
        balance: 0, available: 0, locked: 0,
        network: meta.network || "", address: "",
      },
    },
    { upsert: true, new: false }
  );

  const before = await Wallet.findOne({ user: userId, asset }).lean();
  const balanceBefore = before?.available ?? 0;

  // Atomic balance update.
  const updated = await Wallet.findOneAndUpdate(
    { user: userId, asset },
    { $inc: { balance: amount, available: amount } },
    { new: true }
  ).lean();

  const tx = await Transaction.create({
    user:          userId,
    type:          "deposit",
    asset,
    amount,
    fee:           0,
    status:        "completed",
    network:       meta.network || "",
    reference:     genRef("DEP"),
    note:          `Simulated deposit — ${amount} ${asset}`,
    balanceBefore,
    balanceAfter:  updated.available,
  });

  emitWalletUpdated(userId, { wallets: [updated] });
  emitTransactionCreated(userId, { transaction: tx });

  notificationService.notifyWallet(userId, { type: "deposit", asset, amount, status: "completed" }).catch(() => {});
  recordDeposit(userId).catch(() => {});

  return { wallet: updated, transaction: tx };
};

export const requestWithdrawal = async (userId, { asset, amount, address, network }) => {
  asset  = String(asset  || "").toUpperCase();
  amount = Number(amount);

  await checkFrozen(userId);
  await checkWithdrawalAllowed(userId);

  if (!isSupported(asset))
    throw Object.assign(new Error(`Unsupported asset: ${asset}`), { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0)
    throw Object.assign(new Error("Amount must be a positive number."), { status: 400 });
  if (!address || String(address).trim().length < 10)
    throw Object.assign(new Error("A valid withdrawal address is required."), { status: 400 });

  const wallet = await Wallet.findOne({ user: userId, asset }).lean();
  if (!wallet)
    throw Object.assign(new Error(`No ${asset} wallet found.`), { status: 404 });
  if (wallet.available < amount)
    throw Object.assign(
      new Error(`Insufficient ${asset} balance.`),
      { status: 400 }
    );

  const balanceBefore = wallet.available;

  // Lock funds atomically (conditional update guards against double-spend).
  const updated = await Wallet.findOneAndUpdate(
    { user: userId, asset, available: { $gte: amount } },
    { $inc: { available: -amount, locked: amount } },
    { new: true }
  ).lean();

  if (!updated)
    throw Object.assign(
      new Error("Insufficient balance — please try again."),
      { status: 400 }
    );

  const tx = await Transaction.create({
    user:          userId,
    type:          "withdrawal",
    asset,
    amount,
    fee:           0,
    status:        "pending",
    network:       network || getMeta(asset)?.network || "",
    address:       String(address).trim(),
    reference:     genRef("WIT"),
    note:          `Withdrawal request — ${amount} ${asset}`,
    balanceBefore,
    balanceAfter:  updated.available,
  });

  emitWalletUpdated(userId, { wallets: [updated] });
  emitTransactionCreated(userId, { transaction: tx });

  notificationService.notifyWallet(userId, { type: "withdrawal", asset, amount, status: "pending" }).catch(() => {});
  recordWithdrawal(userId, amount, asset).catch(() => {});

  return { wallet: updated, transaction: tx };
};

export const getTransactions = async (userId, { page = 1, limit = 20, type, asset } = {}) => {
  const filter = { user: userId };
  if (type)  filter.type  = type;
  if (asset) filter.asset = String(asset).toUpperCase();

  page  = Math.max(1,   Number(page)  || 1);
  limit = Math.min(100, Number(limit) || 20);
  const skip = (page - 1) * limit;

  const [transactions, total] = await Promise.all([
    Transaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Transaction.countDocuments(filter),
  ]);

  return { transactions, total, page, limit, pages: Math.ceil(total / limit) };
};
