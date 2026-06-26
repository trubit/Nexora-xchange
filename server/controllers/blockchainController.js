import { SettlementService }          from "../blockchain/SettlementService.js";
import { enabledChains, BLOCKCHAIN_ENABLED } from "../blockchain/config/chains.js";

// GET /api/blockchain/chains — public list of enabled chains and their supported assets.
// Frontend uses this to build the asset→network map dynamically (no hardcoding).
export const getChains = (_req, res) => {
  if (!BLOCKCHAIN_ENABLED) {
    return res.json({ success: true, data: [] });
  }
  const data = enabledChains().map((c) => ({
    id:            c.id,
    label:         c.label,
    nativeAsset:   c.nativeAsset,
    confirmations: c.confirmations,
    explorerUrl:   c.explorerUrl || null,
    tokens:        Object.fromEntries(
      Object.entries(c.tokens).map(([sym, t]) => [sym, { decimals: t.decimals }])
    ),
  }));
  res.json({ success: true, data });
};

// GET /api/blockchain/status
export const getStatus = async (_req, res, next) => {
  try {
    const data = await SettlementService.status();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// GET /api/blockchain/deposit-address?asset=ETH&network=ethereum
export const getDepositAddress = async (req, res, next) => {
  try {
    const { asset, network } = req.query;
    if (!asset || !network) {
      return res.status(400).json({ success: false, message: "asset and network are required." });
    }
    const doc = await SettlementService.getOrAssignDepositAddress(
      String(req.user._id),
      asset,
      network
    );
    res.json({
      success: true,
      data: {
        address:    doc.address,
        depositTag: doc.depositTag || null,
        asset:      doc.asset,
        chain:      doc.chain,
        network:    doc.network,
      },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/blockchain/withdraw
// Body: { asset, amount, address, network }
export const submitWithdrawal = async (req, res, next) => {
  try {
    const { asset, amount, address, network } = req.body;
    if (!asset || !amount || !address || !network) {
      return res.status(400).json({
        success: false,
        message: "asset, amount, address, and network are required.",
      });
    }
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: "amount must be a positive number." });
    }

    const queueEntry = await SettlementService.queueWithdrawal(
      String(req.user._id),
      { asset, amount: Number(amount), address, network }
    );

    res.json({
      success: true,
      message: "Withdrawal queued for on-chain execution.",
      data: {
        id:      queueEntry._id,
        status:  queueEntry.status,
        asset:   queueEntry.asset,
        amount:  queueEntry.amount,
        address: queueEntry.toAddress,
      },
    });
  } catch (err) {
    next(err);
  }
};
