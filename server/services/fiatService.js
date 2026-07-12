import { randomBytes } from "crypto";
import FiatWallet from "../models/FiatWallet.js";
import FiatTransaction from "../models/FiatTransaction.js";
import BankAccount from "../models/BankAccount.js";

// ── Constants ─────────────────────────────────────────────────────────────────

export const SUPPORTED_CURRENCIES = ["USD", "EUR", "NGN"];

// Per-currency deposit/withdrawal rules
export const FIAT_CONFIG = {
  USD: {
    symbol: "$",
    name: "US Dollar",
    minDeposit: 10,
    minWithdrawal: 20,
    maxDeposit: 50_000,
    maxWithdrawal: 25_000,
    // Withdrawal fee: max(flat, pct * amount), capped at cap
    withdrawalFee: { flat: 2, pct: 0.005, cap: 200 },
    depositFee: 0,
    decimals: 2,
  },
  EUR: {
    symbol: "€",
    name: "Euro",
    minDeposit: 10,
    minWithdrawal: 20,
    maxDeposit: 50_000,
    maxWithdrawal: 25_000,
    withdrawalFee: { flat: 2, pct: 0.005, cap: 200 },
    depositFee: 0,
    decimals: 2,
  },
  NGN: {
    symbol: "₦",
    name: "Nigerian Naira",
    minDeposit: 2_000,
    minWithdrawal: 5_000,
    maxDeposit: 50_000_000,
    maxWithdrawal: 10_000_000,
    withdrawalFee: { flat: 500, pct: 0.005, cap: 50_000 },
    depositFee: 0,
    decimals: 2,
  },
};

// Max bank accounts a user can link
export const MAX_BANK_ACCOUNTS = 5;

// ── Helpers ───────────────────────────────────────────────────────────────────

export const genTxId = () =>
  `FT-${Date.now()}-${randomBytes(4).toString("hex").toUpperCase()}`;

export const calcWithdrawalFee = (currency, amount) => {
  const { flat, pct, cap } = FIAT_CONFIG[currency].withdrawalFee;
  return Math.min(Math.max(flat, pct * amount), cap);
};

const round2 = (n) => Math.round(n * 100) / 100;

// ── Wallet ─────────────────────────────────────────────────────────────────────

/**
 * Return existing fiat wallet or create one on first access.
 * Safe to call concurrently — findOneAndUpdate with upsert is atomic.
 */
export const getOrCreateWallet = async (userId) => {
  const wallet = await FiatWallet.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { user: userId, status: "active" } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return wallet;
};

// ── Atomic credit (money in) ──────────────────────────────────────────────────

/**
 * Credit a user's fiat wallet. Must be called inside a Mongoose session or
 * wrapped with the session param for atomicity with the ledger write.
 *
 * Returns the updated wallet and the created FiatTransaction.
 */
export const creditWallet = async (userId, currency, amount, txData, session = null) => {
  const opts = session ? { session } : {};

  // Snapshot balance before
  const before = await FiatWallet.findOne({ user: userId }, null, opts);
  const balanceBefore = round2(before?.balances?.[currency] ?? 0);
  const balanceAfter  = round2(balanceBefore + amount);

  // Increment wallet balance atomically
  const wallet = await FiatWallet.findOneAndUpdate(
    { user: userId, status: "active" },
    { $inc: { [`balances.${currency}`]: round2(amount) } },
    { new: true, ...opts },
  );
  if (!wallet) throw Object.assign(new Error("Fiat wallet not found or frozen."), { statusCode: 400 });

  // Write ledger entry
  const tx = await FiatTransaction.create(
    [
      {
        txId: txData.txId || genTxId(),
        user: userId,
        type: txData.type || "deposit",
        direction: "credit",
        currency,
        amount: round2(amount),
        fee: round2(txData.fee ?? 0),
        netAmount: round2(amount - (txData.fee ?? 0)),
        balanceBefore,
        balanceAfter,
        status: txData.status || "completed",
        reference: txData.reference || "",
        gatewayRef: txData.gatewayRef || "",
        description: txData.description || "",
        metadata: txData.metadata || {},
        completedAt: txData.status === "completed" ? new Date() : null,
      },
    ],
    opts,
  );

  return { wallet, tx: tx[0] };
};

// ── Atomic debit (money out) ──────────────────────────────────────────────────

/**
 * Debit a user's fiat wallet using a single atomic findOneAndUpdate.
 * The balance check is embedded in the query filter so no session is needed —
 * works on standalone MongoDB as well as replica sets.
 */
export const debitWallet = async (userId, currency, amount, fee, txData) => {
  const totalDeduct = round2(amount + fee);

  // Read balance before for the ledger snapshot
  const before = await FiatWallet.findOne({ user: userId, status: "active" });
  if (!before) throw Object.assign(new Error("Fiat wallet not found or frozen."), { statusCode: 400 });

  const balanceBefore = round2(before.balances?.[currency] ?? 0);

  if (balanceBefore < totalDeduct) {
    throw Object.assign(
      new Error(
        `Insufficient ${currency} balance. Available: ${FIAT_CONFIG[currency].symbol}${balanceBefore.toFixed(2)}`,
      ),
      { statusCode: 422 },
    );
  }

  const balanceAfter = round2(balanceBefore - totalDeduct);

  // Atomic deduction — the balance condition prevents overdraft even under concurrency
  const wallet = await FiatWallet.findOneAndUpdate(
    {
      user: userId,
      status: "active",
      [`balances.${currency}`]: { $gte: totalDeduct },
    },
    { $inc: { [`balances.${currency}`]: -totalDeduct } },
    { new: true },
  );

  // If null here, a concurrent withdrawal already consumed the balance
  if (!wallet) {
    throw Object.assign(
      new Error(`Insufficient ${currency} balance.`),
      { statusCode: 422 },
    );
  }

  // Write ledger entry
  const tx = await FiatTransaction.create({
    txId: txData.txId || genTxId(),
    user: userId,
    type: txData.type || "withdrawal",
    direction: "debit",
    currency,
    amount: round2(amount),
    fee: round2(fee),
    netAmount: round2(amount - fee),
    balanceBefore,
    balanceAfter,
    status: txData.status || "processing",
    bankAccount: txData.bankAccountId || null,
    reference: txData.reference || "",
    description: txData.description || "",
    metadata: txData.metadata || {},
  });

  return { tx };
};

// ── Deposit flow ──────────────────────────────────────────────────────────────

/**
 * Step 1: Initiate a deposit — creates a pending FiatTransaction.
 * In production this is where you'd call your payment gateway (Paystack, etc.)
 * and return their checkout URL. Here we return a simulated bank-transfer ref.
 */
export const initiateDeposit = async (userId, { currency, amount }) => {
  const cfg = FIAT_CONFIG[currency];
  if (!cfg) throw Object.assign(new Error("Unsupported currency."), { statusCode: 400 });

  if (amount < cfg.minDeposit)
    throw Object.assign(
      new Error(`Minimum deposit is ${cfg.symbol}${cfg.minDeposit.toLocaleString()}.`),
      { statusCode: 400 },
    );
  if (amount > cfg.maxDeposit)
    throw Object.assign(
      new Error(`Maximum deposit is ${cfg.symbol}${cfg.maxDeposit.toLocaleString()}.`),
      { statusCode: 400 },
    );

  await getOrCreateWallet(userId);

  const txId      = genTxId();
  const reference = `DEP-${txId}`;

  // Snapshot balance before (no mutation yet)
  const wallet        = await FiatWallet.findOne({ user: userId });
  const balanceBefore = round2(wallet?.balances?.[currency] ?? 0);

  const tx = await FiatTransaction.create({
    txId,
    user: userId,
    type: "deposit",
    direction: "credit",
    currency,
    amount: round2(amount),
    fee: 0,
    netAmount: round2(amount),
    balanceBefore,
    balanceAfter: balanceBefore, // filled in on confirm
    status: "pending",
    reference,
    description: `Fiat deposit — ${currency}`,
    metadata: {
      initiatedAt: new Date(),
      simulatedBankRef: reference,
      // Gateway integration point:
      // gatewayCheckoutUrl, gatewayOrderId, etc.
    },
  });

  // Simulated bank transfer instructions (replace with real gateway payload)
  const bankDetails = {
    USD: { bank: "Chase Bank", accountName: "Nexora Ltd", accountNumber: "6781234567", routingNumber: "021000021" },
    EUR: { bank: "Deutsche Bank", accountName: "Nexora Ltd", iban: "DE89 3704 0044 0532 0130 00", bic: "COBADEFFXXX" },
    NGN: { bank: "Guaranty Trust Bank", accountName: "Nexora Ltd", accountNumber: "0123456789" },
  }[currency];

  return {
    txId,
    reference,
    currency,
    amount: round2(amount),
    status: "pending",
    bankDetails,
    expiresInMinutes: 60,
    instruction: `Transfer exactly ${cfg.symbol}${round2(amount).toFixed(2)} to the account below and click "Confirm Deposit".`,
  };
};

/**
 * Step 2: Confirm a deposit (simulates receiving a bank webhook / payment callback).
 * In production this endpoint would be called by your payment gateway's webhook,
 * NOT by the user. The user-facing version just calls it for simulation.
 */
export const confirmDeposit = async (userId, txId) => {
  // Atomically flip status pending → completed. If another request already
  // confirmed this deposit, findOneAndUpdate returns null and we bail out.
  const tx = await FiatTransaction.findOneAndUpdate(
    { txId, user: userId, type: "deposit", status: "pending" },
    { $set: { status: "completed", completedAt: new Date(), gatewayRef: `SIM-${Date.now()}` } },
    { new: true },
  );

  if (!tx) {
    // Check whether it exists at all vs already processed
    const exists = await FiatTransaction.findOne({ txId, user: userId });
    if (!exists) throw Object.assign(new Error("Deposit transaction not found."), { statusCode: 404 });
    throw Object.assign(new Error(`Deposit is already ${exists.status}.`), { statusCode: 409 });
  }

  // Read balance snapshot then credit wallet
  const wallet      = await FiatWallet.findOne({ user: userId });
  const balanceBefore = round2(wallet?.balances?.[tx.currency] ?? 0);
  const balanceAfter  = round2(balanceBefore + tx.amount);

  await FiatWallet.findOneAndUpdate(
    { user: userId, status: "active" },
    { $inc: { [`balances.${tx.currency}`]: tx.amount } },
  );

  // Write final balance snapshot back to the ledger row
  const updatedTx = await FiatTransaction.findOneAndUpdate(
    { txId },
    { $set: { balanceBefore, balanceAfter, "metadata.confirmedAt": new Date() } },
    { new: true },
  );

  return updatedTx;
};

// ── Withdrawal flow ───────────────────────────────────────────────────────────

/**
 * Initiate a withdrawal — debit wallet immediately and put tx in "processing".
 * In production this triggers an outbound bank transfer via your gateway.
 */
export const requestWithdrawal = async (userId, { bankAccountId, currency, amount }) => {
  const cfg = FIAT_CONFIG[currency];
  if (!cfg) throw Object.assign(new Error("Unsupported currency."), { statusCode: 400 });

  if (amount < cfg.minWithdrawal)
    throw Object.assign(
      new Error(`Minimum withdrawal is ${cfg.symbol}${cfg.minWithdrawal.toLocaleString()}.`),
      { statusCode: 400 },
    );
  if (amount > cfg.maxWithdrawal)
    throw Object.assign(
      new Error(`Maximum withdrawal is ${cfg.symbol}${cfg.maxWithdrawal.toLocaleString()}.`),
      { statusCode: 400 },
    );

  // Verify bank account belongs to user and is verified
  const bankAccount = await BankAccount.findOne({ _id: bankAccountId, user: userId });
  if (!bankAccount)
    throw Object.assign(new Error("Bank account not found."), { statusCode: 404 });
  if (bankAccount.status !== "verified")
    throw Object.assign(
      new Error("Bank account is not verified yet. Please wait for verification."),
      { statusCode: 400 },
    );
  if (bankAccount.currency !== currency)
    throw Object.assign(
      new Error(`Bank account currency (${bankAccount.currency}) does not match withdrawal currency (${currency}).`),
      { statusCode: 400 },
    );

  const fee = round2(calcWithdrawalFee(currency, amount));
  const txId = genTxId();

  const { tx } = await debitWallet(userId, currency, amount, fee, {
    txId,
    type: "withdrawal",
    bankAccountId: bankAccount._id,
    description: `Withdrawal to ${bankAccount.bankName} ${bankAccount.accountNumber.slice(-4).padStart(bankAccount.accountNumber.length, "*")}`,
    metadata: {
      bankName: bankAccount.bankName,
      accountName: bankAccount.accountName,
      accountNumberMasked: bankAccount.accountNumberMasked,
    },
  });

  // In production: call gateway here, store gatewayRef, update status based on response.
  // For simulation: mark completed automatically.
  const completed = await FiatTransaction.findOneAndUpdate(
    { txId },
    { $set: { status: "completed", completedAt: new Date(), gatewayRef: `SIM-WD-${Date.now()}` } },
    { new: true },
  );

  return completed;
};

// ── Bank accounts ─────────────────────────────────────────────────────────────

export const listBankAccounts = async (userId) =>
  BankAccount.find({ user: userId }).sort({ isPrimary: -1, createdAt: -1 });

export const linkBankAccount = async (userId, payload) => {
  const count = await BankAccount.countDocuments({ user: userId });
  if (count >= MAX_BANK_ACCOUNTS)
    throw Object.assign(
      new Error(`You can link at most ${MAX_BANK_ACCOUNTS} bank accounts.`),
      { statusCode: 400 },
    );

  const { accountName, accountNumber, bankName, bankCode, routingReference, currency, country } = payload;

  if (!accountName || !accountNumber || !bankName || !currency)
    throw Object.assign(new Error("accountName, accountNumber, bankName, and currency are required."), { statusCode: 400 });

  if (!SUPPORTED_CURRENCIES.includes(currency))
    throw Object.assign(new Error("Unsupported currency."), { statusCode: 400 });

  const account = await BankAccount.create({
    user: userId,
    accountName: accountName.trim(),
    accountNumber: accountNumber.trim(),
    bankName: bankName.trim(),
    bankCode: bankCode?.trim() || "",
    routingReference: routingReference?.trim() || "",
    currency,
    country: country?.trim().toUpperCase() || "NG",
    isPrimary: count === 0, // first account is primary by default
    // Auto-verify for simulation; in production do micro-deposit verification
    status: "verified",
    verifiedAt: new Date(),
  });

  return account;
};

export const setPrimaryBankAccount = async (userId, accountId) => {
  const account = await BankAccount.findOne({ _id: accountId, user: userId });
  if (!account) throw Object.assign(new Error("Bank account not found."), { statusCode: 404 });

  // Unset all, then set target
  await BankAccount.updateMany({ user: userId }, { $set: { isPrimary: false } });
  account.isPrimary = true;
  await account.save();
  return account;
};

export const unlinkBankAccount = async (userId, accountId) => {
  const account = await BankAccount.findOneAndDelete({ _id: accountId, user: userId });
  if (!account) throw Object.assign(new Error("Bank account not found."), { statusCode: 404 });
  return account;
};

// ── Transactions ──────────────────────────────────────────────────────────────

export const listTransactions = async (userId, { page = 1, limit = 20, type, currency, status } = {}) => {
  const filter = { user: userId };
  if (type)     filter.type     = type;
  if (currency) filter.currency = currency;
  if (status)   filter.status   = status;

  const skip  = (Math.max(1, Number(page)) - 1) * Math.min(100, Math.max(1, Number(limit)));
  const total = await FiatTransaction.countDocuments(filter);
  const txns  = await FiatTransaction.find(filter)
    .populate("bankAccount", "bankName accountNumber accountName currency")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Math.min(100, Number(limit)));

  return {
    transactions: txns,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit)),
    },
  };
};

export const getTransaction = async (userId, txId) => {
  const tx = await FiatTransaction.findOne({ txId, user: userId }).populate(
    "bankAccount",
    "bankName accountNumber accountName currency",
  );
  if (!tx) throw Object.assign(new Error("Transaction not found."), { statusCode: 404 });
  return tx;
};
