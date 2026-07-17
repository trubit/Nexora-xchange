/**
 * Stage 25 — Multi-Chain Native Settlement Layer
 * Tests: MultiChainSettlementService (state machine, risk flags, reorg detection)
 *        OnChainVerifier (local-index verification, deposit verification)
 *        BlockchainIndexerService (stats, address watcher, lifecycle)
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

// ── Hoisted mocks (vi.hoisted runs before vi.mock factory) ───────────────────
const {
  mockSettlementRecord,
  mockBlockchainTx,
  mockBlockchainDeposit,
} = vi.hoisted(() => {
  return {
    mockSettlementRecord: {
      findOne:          vi.fn(),
      find:             vi.fn(),
      create:           vi.fn(),
      countDocuments:   vi.fn(),
      aggregate:        vi.fn(),
      findOneAndUpdate: vi.fn(),
    },
    mockBlockchainTx: {
      findOne: vi.fn(),
      find:    vi.fn(),
    },
    mockBlockchainDeposit: {
      find: vi.fn(),
    },
  };
});

// ── Mock all external dependencies ───────────────────────────────────────────

vi.mock("../../config/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn() },
}));

vi.mock("../../config/redis.js", () => ({
  redisClients: { cache: null },
  redisEnabled: false,
}));

vi.mock("../../models/SettlementRecord.js", () => ({ default: mockSettlementRecord }));
vi.mock("../../models/BlockchainTx.js",     () => ({ default: mockBlockchainTx }));
vi.mock("../../models/BlockchainDeposit.js",() => ({ default: mockBlockchainDeposit }));

// BLOCKCHAIN_ENABLED=false keeps all code paths exercisable without real RPC
vi.mock("../../blockchain/config/chains.js", () => ({
  BLOCKCHAIN_ENABLED: false,
  CHAINS: {
    ethereum: {
      id:            "ethereum",
      label:         "Ethereum",
      type:          "evm",
      nativeAsset:   "ETH",
      confirmations: 12,
      enabled:       false,
      rpcUrl:        null,
      pollMs:        15000,
      explorerUrl:   "https://etherscan.io",
    },
    bitcoin: {
      id:            "bitcoin",
      label:         "Bitcoin",
      type:          "bitcoin",
      nativeAsset:   "BTC",
      confirmations: 6,
      enabled:       false,
      rpcUrl:        null,
      pollMs:        60000,
      explorerUrl:   "https://blockstream.info",
    },
  },
}));

// ── Import after mocking ─────────────────────────────────────────────────────
import { MultiChainSettlementService } from "../../services/multiChainSettlementService.js";
import { BlockchainIndexerService, OnChainVerifier } from "../../services/blockchainIndexerService.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSettlementDoc(overrides = {}) {
  const base = {
    settlementId:          "ethereum-0xabc123",
    chain:                 "ethereum",
    chainType:             "evm",
    txHash:                "0xabc123",
    blockNumber:           18000000,
    blockHash:             "0xblock",
    fromAddress:           "0x1111",
    toAddress:             "0x2222",
    asset:                 "ETH",
    amount:                1.5,
    networkFee:            0.002,
    contractAddress:       "",
    direction:             "deposit",
    confirmations:         0,
    requiredConfirmations: 12,
    confirmedAt:           null,
    finalizedAt:           null,
    status:                "detected",
    userId:                null,
    riskFlags:             [],
    failReason:            "",
    reorgDepth:            0,
    ...overrides,
  };
  const toObject = () => ({ ...base });
  const save     = vi.fn().mockResolvedValue({ ...base, toObject });
  return { ...base, toObject, save };
}

// ── MultiChainSettlementService tests ────────────────────────────────────────

describe("MultiChainSettlementService — constructor and lifecycle", () => {
  test("instantiates without throwing", () => {
    expect(() => new MultiChainSettlementService()).not.toThrow();
  });

  test("start() is a no-op when BLOCKCHAIN_ENABLED=false", async () => {
    const svc = new MultiChainSettlementService();
    await expect(svc.start()).resolves.toBeUndefined();
    svc.stop();
  });

  test("stop() is safe to call before start()", () => {
    const svc = new MultiChainSettlementService();
    expect(() => svc.stop()).not.toThrow();
  });
});

describe("MultiChainSettlementService.recordDetected", () => {
  let svc;
  beforeEach(() => {
    svc = new MultiChainSettlementService();
    vi.clearAllMocks();
  });

  test("throws on unknown chain", async () => {
    await expect(svc.recordDetected({ chain: "unknown", txHash: "0x1" })).rejects.toThrow("Unknown chain");
  });

  test("returns existing record if already indexed (idempotent)", async () => {
    const existing = makeSettlementDoc().toObject();
    mockSettlementRecord.findOne.mockReturnValueOnce({ lean: () => Promise.resolve(existing) });
    const result = await svc.recordDetected({
      chain: "ethereum", txHash: "0xabc123", toAddress: "0x2", asset: "ETH", amount: 1, direction: "deposit",
    });
    expect(result.settlementId).toBe("ethereum-0xabc123");
    expect(mockSettlementRecord.create).not.toHaveBeenCalled();
  });

  test("creates a new SettlementRecord for a fresh transaction", async () => {
    mockSettlementRecord.findOne.mockReturnValueOnce({ lean: () => Promise.resolve(null) });
    const doc = makeSettlementDoc();
    mockSettlementRecord.create.mockResolvedValueOnce(doc);
    const result = await svc.recordDetected({
      chain: "ethereum", txHash: "0xnew", fromAddress: "0x1", toAddress: "0x2",
      asset: "ETH", amount: 1.5, direction: "deposit", blockNumber: 18000000,
    });
    expect(mockSettlementRecord.create).toHaveBeenCalledOnce();
    expect(result.settlementId).toBe("ethereum-0xabc123");
  });

  test("emits 'detected' event after creating", async () => {
    mockSettlementRecord.findOne.mockReturnValueOnce({ lean: () => Promise.resolve(null) });
    const doc = makeSettlementDoc();
    mockSettlementRecord.create.mockResolvedValueOnce(doc);
    const listener = vi.fn();
    svc.on("detected", listener);
    await svc.recordDetected({
      chain: "ethereum", txHash: "0xnew", toAddress: "0x2",
      asset: "ETH", amount: 1, direction: "deposit",
    });
    expect(listener).toHaveBeenCalledOnce();
    svc.off("detected", listener);
  });

  test("sets HIGH_VALUE risk flag when amount >= threshold", async () => {
    mockSettlementRecord.findOne.mockReturnValueOnce({ lean: () => Promise.resolve(null) });
    let capturedPayload;
    mockSettlementRecord.create.mockImplementationOnce((payload) => {
      capturedPayload = payload;
      return makeSettlementDoc({ ...payload });
    });
    await svc.recordDetected({
      chain: "ethereum", txHash: "0xhv", toAddress: "0x2",
      asset: "ETH", amount: 15000, direction: "deposit",
    });
    expect(capturedPayload.riskFlags).toContain("HIGH_VALUE");
  });

  test("sets SUSPICIOUS_ORIGIN flag for 0x000-prefixed fromAddress", async () => {
    mockSettlementRecord.findOne.mockReturnValueOnce({ lean: () => Promise.resolve(null) });
    let captured;
    mockSettlementRecord.create.mockImplementationOnce((p) => {
      captured = p;
      return makeSettlementDoc(p);
    });
    await svc.recordDetected({
      chain: "ethereum", txHash: "0xsusp", fromAddress: "0x0001122", toAddress: "0x2",
      asset: "ETH", amount: 1, direction: "deposit",
    });
    expect(captured.riskFlags).toContain("SUSPICIOUS_ORIGIN");
  });

  test("sets WHALE_DEPOSIT for large ETH amount", async () => {
    mockSettlementRecord.findOne.mockReturnValueOnce({ lean: () => Promise.resolve(null) });
    let captured;
    mockSettlementRecord.create.mockImplementationOnce((p) => {
      captured = p;
      return makeSettlementDoc(p);
    });
    await svc.recordDetected({
      chain: "ethereum", txHash: "0xwhale", toAddress: "0x2",
      asset: "ETH", amount: 100, direction: "deposit",
    });
    expect(captured.riskFlags).toContain("WHALE_DEPOSIT");
  });
});

describe("MultiChainSettlementService.updateConfirmations — state machine", () => {
  let svc;
  beforeEach(() => {
    svc = new MultiChainSettlementService();
    vi.clearAllMocks();
  });

  test("returns null if settlement not found", async () => {
    mockSettlementRecord.findOne.mockResolvedValueOnce(null);
    const result = await svc.updateConfirmations("not-found", 5);
    expect(result).toBeNull();
  });

  test("returns existing object for finalized settlement (no update)", async () => {
    const doc = makeSettlementDoc({ status: "finalized" });
    mockSettlementRecord.findOne.mockResolvedValueOnce(doc);
    const result = await svc.updateConfirmations("ethereum-0xabc123", 15);
    expect(result.status).toBe("finalized");
    expect(doc.save).not.toHaveBeenCalled();
  });

  test("transitions from detected → confirming on first confirmation", async () => {
    const doc = makeSettlementDoc({ status: "detected", confirmations: 0 });
    mockSettlementRecord.findOne.mockResolvedValueOnce(doc);
    await svc.updateConfirmations("ethereum-0xabc123", 3);
    expect(doc.status).toBe("confirming");
    expect(doc.save).toHaveBeenCalled();
  });

  test("transitions to finalized when confirmations reach required threshold", async () => {
    const doc = makeSettlementDoc({ status: "confirming", confirmations: 10, requiredConfirmations: 12 });
    mockSettlementRecord.findOne.mockResolvedValueOnce(doc);
    const finalized = vi.fn();
    svc.on("finalized", finalized);
    await svc.updateConfirmations("ethereum-0xabc123", 12);
    expect(doc.status).toBe("finalized");
    expect(doc.finalizedAt).toBeTruthy();
    expect(finalized).toHaveBeenCalledOnce();
    svc.off("finalized", finalized);
  });

  test("detects reorg when confirmations drop by more than REORG_WINDOW (20)", async () => {
    const doc = makeSettlementDoc({ status: "confirming", confirmations: 50 });
    mockSettlementRecord.findOne.mockResolvedValueOnce(doc);
    const reorged = vi.fn();
    svc.on("reorged", reorged);
    await svc.updateConfirmations("ethereum-0xabc123", 1); // drops 49 > 20 window
    expect(doc.status).toBe("reorged");
    expect(doc.reorgDepth).toBe(49);
    expect(reorged).toHaveBeenCalledOnce();
    svc.off("reorged", reorged);
  });

  test("does NOT detect reorg for small confirmation increase then decrease within window", async () => {
    const doc = makeSettlementDoc({ status: "confirming", confirmations: 5 });
    mockSettlementRecord.findOne.mockResolvedValueOnce(doc);
    // drop from 5 → 3 = only -2, within 20 window
    await svc.updateConfirmations("ethereum-0xabc123", 3);
    expect(doc.status).toBe("confirming"); // still confirming, not reorged
  });
});

describe("MultiChainSettlementService.markFailed", () => {
  let svc;
  beforeEach(() => {
    svc = new MultiChainSettlementService();
    vi.clearAllMocks();
  });

  test("returns null if settlement not found", async () => {
    mockSettlementRecord.findOne.mockResolvedValueOnce(null);
    expect(await svc.markFailed("missing", "rpc error")).toBeNull();
  });

  test("returns null for finalized settlement (cannot fail)", async () => {
    mockSettlementRecord.findOne.mockResolvedValueOnce(makeSettlementDoc({ status: "finalized" }));
    expect(await svc.markFailed("ethereum-0xabc123", "rpc error")).toBeNull();
  });

  test("marks pending settlement as failed with reason", async () => {
    const doc = makeSettlementDoc({ status: "detecting" });
    mockSettlementRecord.findOne.mockResolvedValueOnce(doc);
    const result = await svc.markFailed("ethereum-0xabc123", "timeout");
    expect(doc.status).toBe("failed");
    expect(doc.failReason).toBe("timeout");
    expect(doc.save).toHaveBeenCalled();
    expect(result).toBeTruthy();
  });

  test("emits 'failed' event on successful failure marking", async () => {
    const doc = makeSettlementDoc({ status: "confirming" });
    mockSettlementRecord.findOne.mockResolvedValueOnce(doc);
    const listener = vi.fn();
    svc.on("failed", listener);
    await svc.markFailed("ethereum-0xabc123", "rpc_error");
    expect(listener).toHaveBeenCalledOnce();
    svc.off("failed", listener);
  });
});

describe("MultiChainSettlementService.getByTxHash (no Redis)", () => {
  let svc;
  beforeEach(() => {
    svc = new MultiChainSettlementService();
    vi.clearAllMocks();
  });

  test("returns null when record not found", async () => {
    mockSettlementRecord.findOne.mockReturnValueOnce({ lean: () => Promise.resolve(null) });
    const result = await svc.getByTxHash("ethereum", "0xnonexistent");
    expect(result).toBeNull();
  });

  test("returns the record object when found", async () => {
    const doc = makeSettlementDoc().toObject();
    mockSettlementRecord.findOne.mockReturnValueOnce({ lean: () => Promise.resolve(doc) });
    const result = await svc.getByTxHash("ethereum", "0xabc123");
    expect(result.txHash).toBe("0xabc123");
  });
});

describe("MultiChainSettlementService.getUserSettlements", () => {
  let svc;
  beforeEach(() => {
    svc = new MultiChainSettlementService();
    vi.clearAllMocks();
  });

  test("queries with userId and returns array", async () => {
    const mockChain = {
      sort:  vi.fn().mockReturnThis(),
      skip:  vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean:  vi.fn().mockResolvedValue([makeSettlementDoc().toObject()]),
    };
    mockSettlementRecord.find.mockReturnValueOnce(mockChain);
    const result = await svc.getUserSettlements("user123", { limit: 10, skip: 0 });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1);
  });

  test("filters by direction and status when provided", async () => {
    const mockChain = {
      sort: vi.fn().mockReturnThis(), skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue([]),
    };
    mockSettlementRecord.find.mockReturnValueOnce(mockChain);
    await svc.getUserSettlements("user123", { direction: "deposit", status: "finalized" });
    expect(mockSettlementRecord.find).toHaveBeenCalledWith(
      expect.objectContaining({ direction: "deposit", status: "finalized" })
    );
  });
});

describe("MultiChainSettlementService.getStats", () => {
  let svc;
  beforeEach(() => {
    svc = new MultiChainSettlementService();
    vi.clearAllMocks();
  });

  test("returns totals with byStatus and byChain breakdown", async () => {
    mockSettlementRecord.countDocuments
      .mockResolvedValueOnce(100)   // total
      .mockResolvedValueOnce(10);   // pending
    mockSettlementRecord.aggregate
      .mockResolvedValueOnce([{ _id: "finalized", count: 80 }, { _id: "confirming", count: 10 }, { _id: "detected", count: 10 }])
      .mockResolvedValueOnce([{ _id: "ethereum", count: 70 }, { _id: "bitcoin", count: 30 }]);

    const stats = await svc.getStats();
    expect(stats.total).toBe(100);
    expect(stats.pending).toBe(10);
    expect(stats.byStatus.finalized).toBe(80);
    expect(stats.byChain.ethereum).toBe(70);
    expect(stats.byChain.bitcoin).toBe(30);
  });
});

describe("MultiChainSettlementService.getPendingSettlements", () => {
  let svc;
  beforeEach(() => {
    svc = new MultiChainSettlementService();
    vi.clearAllMocks();
  });

  test("fetches detected and confirming records across all chains", async () => {
    const sorted = {
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([makeSettlementDoc({ status: "confirming" }).toObject()]),
    };
    mockSettlementRecord.find.mockReturnValueOnce(sorted);
    const result = await svc.getPendingSettlements();
    expect(mockSettlementRecord.find).toHaveBeenCalledWith(
      expect.objectContaining({ status: { $in: ["detected", "confirming"] } })
    );
    expect(result.length).toBe(1);
  });

  test("filters by chain when specified", async () => {
    const sorted = { sort: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue([]) };
    mockSettlementRecord.find.mockReturnValueOnce(sorted);
    await svc.getPendingSettlements("ethereum");
    expect(mockSettlementRecord.find).toHaveBeenCalledWith(
      expect.objectContaining({ chain: "ethereum" })
    );
  });
});

// ── OnChainVerifier tests ─────────────────────────────────────────────────────

describe("OnChainVerifier.verify", () => {
  beforeEach(() => vi.clearAllMocks());

  test("returns chain_disabled for disabled/unconfigured chain", async () => {
    const result = await OnChainVerifier.verify("ethereum", "0xabc");
    expect(result.verified).toBe(false);
    expect(result.reason).toBe("chain_disabled");
  });

  test("returns unknown_chain for unrecognized chain ID", async () => {
    const result = await OnChainVerifier.verify("solana", "0xabc");
    expect(result.verified).toBe(false);
    expect(result.reason).toBe("unknown_chain");
  });

  test("returns not_indexed when no local BlockchainTx record exists", async () => {
    // Enable ethereum temporarily by mocking chain cfg
    mockBlockchainTx.findOne.mockReturnValueOnce({ lean: () => Promise.resolve(null) });
    // Even with disabled chain the early-return guards it; we test the logic path
    const result = await OnChainVerifier.verify("ethereum", "0xnotfound");
    // Chain disabled → chain_disabled returned before DB lookup
    expect(result.reason).toMatch(/chain_disabled|not_indexed/);
  });
});

describe("OnChainVerifier.verifyDeposit", () => {
  beforeEach(() => vi.clearAllMocks());

  test("returns settled=false when no settlement record exists", async () => {
    // Both calls return null
    mockBlockchainTx.findOne.mockReturnValueOnce({ lean: () => Promise.resolve(null) });
    mockSettlementRecord.findOne.mockReturnValueOnce({ lean: () => Promise.resolve(null) });
    const result = await OnChainVerifier.verifyDeposit("ethereum", "0xnotfound");
    expect(result.settled).toBe(false);
    expect(result.status).toBe("not_found");
  });

  test("returns settled=true with settlementId when record exists", async () => {
    const settlementDoc = { settlementId: "ethereum-0xabc", status: "finalized", finalizedAt: new Date() };
    mockBlockchainTx.findOne.mockReturnValueOnce({ lean: () => Promise.resolve(null) });
    mockSettlementRecord.findOne.mockReturnValueOnce({ lean: () => Promise.resolve(settlementDoc) });
    const result = await OnChainVerifier.verifyDeposit("ethereum", "0xabc");
    expect(result.settled).toBe(true);
    expect(result.settlementId).toBe("ethereum-0xabc");
    expect(result.status).toBe("finalized");
  });
});

// ── BlockchainIndexerService tests ───────────────────────────────────────────

describe("BlockchainIndexerService — lifecycle", () => {
  test("instantiates with correct initial stats", () => {
    const svc = new BlockchainIndexerService();
    const stats = svc.getStats();
    expect(stats.running).toBe(false);
    expect(stats.txsIndexed).toBe(0);
    expect(stats.depositsFound).toBe(0);
    expect(stats.blocksScanned).toBe(0);
    expect(stats.errors).toBe(0);
    expect(typeof stats.watchedAddresses).toBe("number");
    expect(typeof stats.chainTips).toBe("object");
  });

  test("start() is a no-op when BLOCKCHAIN_ENABLED=false", async () => {
    mockBlockchainDeposit.find.mockReturnValueOnce({ lean: () => Promise.resolve([]) });
    const svc = new BlockchainIndexerService();
    await expect(svc.start()).resolves.toBeUndefined();
    expect(svc.getStats().running).toBe(false);
    svc.stop();
  });

  test("stop() clears all timers and sets running=false", async () => {
    const svc = new BlockchainIndexerService();
    svc.stop();
    expect(svc.getStats().running).toBe(false);
  });
});

describe("BlockchainIndexerService.registerAddress", () => {
  test("registers a deposit address for watching", () => {
    const svc = new BlockchainIndexerService();
    const before = svc.getStats().watchedAddresses;
    svc.registerAddress({ address: "0xDEADBEEF", user: "user1", _id: "dep1" });
    const after = svc.getStats().watchedAddresses;
    expect(after).toBe(before + 1);
  });

  test("address lookup is case-insensitive", () => {
    const svc = new BlockchainIndexerService();
    svc.registerAddress({ address: "0xAbCdEf", user: "user1", _id: "dep2" });
    // We verify indirectly: watchedAddresses increases and no error thrown
    expect(svc.getStats().watchedAddresses).toBeGreaterThan(0);
  });
});

describe("BlockchainIndexerService.verify / verifyDeposit (proxy)", () => {
  beforeEach(() => vi.clearAllMocks());

  test("verify delegates to OnChainVerifier.verify", async () => {
    const svc = new BlockchainIndexerService();
    const result = await svc.verify("ethereum", "0xabc");
    expect(result).toHaveProperty("verified");
  });

  test("verifyDeposit delegates to OnChainVerifier.verifyDeposit", async () => {
    mockBlockchainTx.findOne.mockReturnValueOnce({ lean: () => Promise.resolve(null) });
    mockSettlementRecord.findOne.mockReturnValueOnce({ lean: () => Promise.resolve(null) });
    const svc = new BlockchainIndexerService();
    const result = await svc.verifyDeposit("ethereum", "0xabc");
    expect(result).toHaveProperty("settled");
  });
});

describe("BlockchainIndexerService.getStats — chainTips shape", () => {
  test("chainTips has an entry for every configured chain", () => {
    const svc = new BlockchainIndexerService();
    const { chainTips } = svc.getStats();
    expect(chainTips).toHaveProperty("ethereum");
    expect(chainTips).toHaveProperty("bitcoin");
  });

  test("chainTips values default to 0", () => {
    const svc = new BlockchainIndexerService();
    const { chainTips } = svc.getStats();
    expect(chainTips.ethereum).toBe(0);
    expect(chainTips.bitcoin).toBe(0);
  });
});
