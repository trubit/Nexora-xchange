import { checkWithdrawalAllowed, recordDeposit, recordWithdrawal } from "../services/riskService.js";
import {
  FIAT_CONFIG,
  calcWithdrawalFee,
  confirmDeposit,
  getOrCreateWallet,
  getTransaction,
  initiateDeposit,
  linkBankAccount,
  listBankAccounts,
  listTransactions,
  requestWithdrawal,
  setPrimaryBankAccount,
  unlinkBankAccount,
} from "../services/fiatService.js";

// ── Wallet ────────────────────────────────────────────────────────────────────

export const getWallet = async (req, res) => {
  const wallet = await getOrCreateWallet(req.user._id);
  return res.json({
    wallet: {
      id: wallet.id,
      status: wallet.status,
      balances: wallet.balances,
      updatedAt: wallet.updatedAt,
    },
    config: Object.fromEntries(
      Object.entries(FIAT_CONFIG).map(([cur, cfg]) => [
        cur,
        {
          symbol: cfg.symbol,
          name: cfg.name,
          minDeposit: cfg.minDeposit,
          minWithdrawal: cfg.minWithdrawal,
          maxDeposit: cfg.maxDeposit,
          maxWithdrawal: cfg.maxWithdrawal,
          depositFee: cfg.depositFee,
          withdrawalFee: cfg.withdrawalFee,
          decimals: cfg.decimals,
        },
      ]),
    ),
  });
};

// ── Deposit ───────────────────────────────────────────────────────────────────

export const depositInitiate = async (req, res) => {
  const { currency, amount } = req.body;

  if (!currency || amount == null)
    return res.status(400).json({ message: "currency and amount are required." });

  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0)
    return res.status(400).json({ message: "amount must be a positive number." });

  const result = await initiateDeposit(req.user._id, { currency, amount: parsedAmount });
  return res.status(201).json(result);
};

export const depositConfirm = async (req, res) => {
  const { txId } = req.body;
  if (!txId) return res.status(400).json({ message: "txId is required." });

  const tx = await confirmDeposit(req.user._id, txId);
  // Fire-and-forget: stamp the deposit timestamp used by rapid-withdrawal detection
  recordDeposit(req.user._id).catch(() => {});
  return res.json({ message: "Deposit confirmed and credited to your wallet.", transaction: tx });
};

// ── Withdrawal ────────────────────────────────────────────────────────────────

export const withdraw = async (req, res) => {
  const { bankAccountId, currency, amount } = req.body;

  if (!bankAccountId || !currency || amount == null)
    return res.status(400).json({ message: "bankAccountId, currency, and amount are required." });

  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0)
    return res.status(400).json({ message: "amount must be a positive number." });

  // Risk gate: throws if account frozen or within a cooldown window
  await checkWithdrawalAllowed(req.user._id);

  const tx = await requestWithdrawal(req.user._id, {
    bankAccountId,
    currency,
    amount: parsedAmount,
  });

  // Fire-and-forget: apply rapid-withdrawal or large-withdrawal flags
  recordWithdrawal(req.user._id, parsedAmount, currency).catch(() => {});

  return res.status(201).json({ message: "Withdrawal processed successfully.", transaction: tx });
};

// Preview fee before the user submits
export const withdrawalFeePreview = async (req, res) => {
  const { currency, amount } = req.query;
  if (!currency || !amount)
    return res.status(400).json({ message: "currency and amount are required." });

  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0)
    return res.status(400).json({ message: "amount must be a positive number." });

  const cfg = FIAT_CONFIG[currency];
  if (!cfg) return res.status(400).json({ message: "Unsupported currency." });

  const fee    = calcWithdrawalFee(currency, parsedAmount);
  const net    = Math.max(0, parsedAmount - fee);
  return res.json({ currency, amount: parsedAmount, fee, netAmount: net });
};

// ── Bank accounts ─────────────────────────────────────────────────────────────

export const getBankAccounts = async (req, res) => {
  const accounts = await listBankAccounts(req.user._id);
  return res.json({ bankAccounts: accounts });
};

export const addBankAccount = async (req, res) => {
  const account = await linkBankAccount(req.user._id, req.body);
  return res.status(201).json({ message: "Bank account linked successfully.", bankAccount: account });
};

export const makePrimaryBankAccount = async (req, res) => {
  const account = await setPrimaryBankAccount(req.user._id, req.params.id);
  return res.json({ message: "Primary bank account updated.", bankAccount: account });
};

export const deleteBankAccount = async (req, res) => {
  await unlinkBankAccount(req.user._id, req.params.id);
  return res.json({ message: "Bank account removed." });
};

// ── Transactions ──────────────────────────────────────────────────────────────

export const getTransactions = async (req, res) => {
  const { page, limit, type, currency, status } = req.query;
  const result = await listTransactions(req.user._id, { page, limit, type, currency, status });
  return res.json(result);
};

export const getSingleTransaction = async (req, res) => {
  const tx = await getTransaction(req.user._id, req.params.txId);
  return res.json({ transaction: tx });
};
