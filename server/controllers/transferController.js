import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import Transaction from "../models/Transaction.js";
import { notificationService } from "../notifications/NotificationService.js";

const fmtAmt = (n) => {
  const s = Number(n || 0).toFixed(8);
  return s.replace(/\.?0+$/, "") || "0";
};

// Look up a user by UID — returns minimal public info to confirm recipient.
export const lookupByUid = async (req, res) => {
  const { uid } = req.params;
  if (!uid || !/^\d{8}$/.test(uid)) {
    return res.status(400).json({ message: "UID must be exactly 8 digits." });
  }
  const user = await User.findOne({ uid }).select("uid name email");
  if (!user) return res.status(404).json({ message: "No account found with that UID." });

  const displayName = user.name || user.email.split("@")[0];
  return res.json({ uid: user.uid, displayName });
};

// Internal transfer: deduct from sender, credit recipient atomically (no replica set needed).
export const internalTransfer = async (req, res) => {
  const senderId = req.user.id;
  const { recipientUid, asset, amount } = req.body;

  if (!recipientUid || !asset || !amount) {
    return res.status(400).json({ message: "recipientUid, asset, and amount are required." });
  }
  const numAmount = Number(amount);
  if (!Number.isFinite(numAmount) || numAmount <= 0) {
    return res.status(400).json({ message: "Amount must be a positive number." });
  }
  if (!/^\d{8}$/.test(String(recipientUid))) {
    return res.status(400).json({ message: "UID must be exactly 8 digits." });
  }

  const [sender, recipient] = await Promise.all([
    User.findById(senderId).select("uid name email"),
    User.findOne({ uid: recipientUid }).select("uid name email _id"),
  ]);

  if (!sender) return res.status(404).json({ message: "Sender not found." });
  if (!recipient) return res.status(404).json({ message: "No account found with that UID." });
  if (sender.uid === recipientUid) {
    return res.status(400).json({ message: "You cannot transfer to yourself." });
  }

  // Atomic deduct — $gte condition ensures we never go below zero.
  const senderWallet = await Wallet.findOneAndUpdate(
    { user: senderId, asset, available: { $gte: numAmount } },
    { $inc: { balance: -numAmount, available: -numAmount } },
    { new: false },
  );

  if (!senderWallet) {
    return res.status(400).json({ message: "Insufficient available balance." });
  }

  // Credit recipient (upsert creates wallet if first time holding this asset).
  let recipWallet;
  try {
    recipWallet = await Wallet.findOneAndUpdate(
      { user: recipient._id, asset },
      { $inc: { balance: numAmount, available: numAmount } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  } catch {
    // Roll back sender deduction so no funds are lost.
    await Wallet.findOneAndUpdate(
      { user: senderId, asset },
      { $inc: { balance: numAmount, available: numAmount } },
    );
    return res.status(500).json({ message: "Transfer failed. Please try again." });
  }

  const amt            = fmtAmt(numAmount);
  const senderName     = sender.name    || sender.email.split("@")[0];
  const recipientName  = recipient.name || recipient.email.split("@")[0];
  const balBefore      = senderWallet.balance;
  const recipBalBefore = (recipWallet.balance ?? 0) - numAmount;

  // Record both transaction legs and fire notifications — all best-effort.
  await Promise.allSettled([
    Transaction.insertMany([
      {
        user: senderId,
        type: "transfer",
        asset,
        amount: numAmount,
        status: "completed",
        direction: "out",
        counterpartyId: recipient._id,
        counterpartyUid: recipientUid,
        note: `Transfer to ${recipientName} (UID ${recipientUid})`,
        balanceBefore: balBefore,
        balanceAfter: balBefore - numAmount,
      },
      {
        user: recipient._id,
        type: "transfer",
        asset,
        amount: numAmount,
        status: "completed",
        direction: "in",
        counterpartyId: sender._id,
        counterpartyUid: sender.uid,
        note: `Transfer from ${senderName} (UID ${sender.uid})`,
        balanceBefore: recipBalBefore,
        balanceAfter: recipBalBefore + numAmount,
      },
    ]),

    // Sender notification
    notificationService._save({
      userId: senderId,
      type: "WALLET",
      title: `Transfer Sent — ${asset}`,
      message: `You sent ${amt} ${asset} to ${recipientName} (UID ${recipientUid}). Transfer was instant and free.`,
      meta: { asset, amount: numAmount, direction: "out", counterpartyUid: recipientUid },
    }),

    // Recipient notification
    notificationService._save({
      userId: recipient._id,
      type: "WALLET",
      title: `Transfer Received — ${asset}`,
      message: `You received ${amt} ${asset} from ${senderName} (UID ${sender.uid}). It has been credited to your wallet.`,
      meta: { asset, amount: numAmount, direction: "in", counterpartyUid: sender.uid },
    }),
  ]);

  return res.json({ message: "Transfer successful." });
};
