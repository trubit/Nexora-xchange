/**
 * EVMAdapter — JSON-RPC 2.0 client for Ethereum-compatible chains.
 *
 * Uses axios (already in package.json) for HTTP JSON-RPC.
 * No ethers.js or web3.js required for read operations.
 * Signing (withdrawals) requires a signing module — see signTransaction().
 *
 * Implements the ChainAdapter interface:
 *   getLatestBlock()                       → number
 *   getBlock(number)                       → BlockInfo
 *   getTransactionReceipt(txHash)          → ReceiptInfo | null
 *   getBalance(address)                    → string  (wei, hex)
 *   getTokenBalance(address, contract)     → string  (raw units, hex)
 *   getLogs(filter)                        → Log[]
 *   broadcastRawTx(signedHex)              → txHash
 *   estimateGas(params)                    → BigInt
 *   getGasPrice()                          → BigInt
 */

import axios from "axios";
import { getTokenConfig } from "../config/chains.js";

// ERC-20 Transfer event topic
const ERC20_TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

let _rpcId = 0;
const rpcId = () => ++_rpcId;

export class EVMAdapter {
  /**
   * @param {object} chain  — chain config from CHAINS registry
   */
  constructor(chain) {
    this._chain   = chain;
    this._rpcUrl  = chain.rpcUrl;
    this._timeout = parseInt(process.env.BLOCKCHAIN_RPC_TIMEOUT_MS ?? "10000", 10);
  }

  // ── JSON-RPC transport ───────────────────────────────────────────────────────

  async _call(method, params = []) {
    const res = await axios.post(
      this._rpcUrl,
      { jsonrpc: "2.0", id: rpcId(), method, params },
      {
        timeout: this._timeout,
        headers: { "Content-Type": "application/json" },
        validateStatus: null,
      }
    );
    if (res.data?.error) {
      throw Object.assign(
        new Error(`[${this._chain.id}] RPC error ${res.data.error.code}: ${res.data.error.message}`),
        { rpcCode: res.data.error.code }
      );
    }
    return res.data?.result;
  }

  // ── ChainAdapter interface ───────────────────────────────────────────────────

  /** Returns the latest confirmed block number. */
  async getLatestBlock() {
    const hex = await this._call("eth_blockNumber");
    return parseInt(hex, 16);
  }

  /** Returns block header + full transaction list. */
  async getBlock(blockNumber) {
    const tag = typeof blockNumber === "number"
      ? `0x${blockNumber.toString(16)}`
      : blockNumber;
    return this._call("eth_getBlockByNumber", [tag, true]);
  }

  /** Returns null if tx not yet mined; receipt object if mined. */
  async getTransactionReceipt(txHash) {
    return this._call("eth_getTransactionReceipt", [txHash]);
  }

  /** Native balance in wei (hex string). */
  async getBalance(address) {
    return this._call("eth_getBalance", [address, "latest"]);
  }

  /** ERC-20 balance via eth_call to balanceOf(address). */
  async getTokenBalance(address, contractAddress) {
    // balanceOf(address) → bytes4 selector = 0x70a08231
    const paddedAddr = address.replace(/^0x/, "").padStart(64, "0");
    const data       = `0x70a08231${paddedAddr}`;
    return this._call("eth_call", [
      { to: contractAddress, data },
      "latest",
    ]);
  }

  /**
   * Get ERC-20 Transfer logs for a set of contract addresses and target address.
   * Used by the deposit detector to find incoming token transfers.
   */
  async getLogs({ fromBlock, toBlock, address, topics }) {
    const from = `0x${Number(fromBlock).toString(16)}`;
    const to   = typeof toBlock === "number"
      ? `0x${toBlock.toString(16)}`
      : toBlock;

    return this._call("eth_getLogs", [{
      fromBlock: from,
      toBlock:   to,
      address,
      topics,
    }]);
  }

  /** Returns current gas price in wei (BigInt). */
  async getGasPrice() {
    const hex = await this._call("eth_gasPrice");
    return BigInt(hex);
  }

  /** Estimate gas for a transaction. */
  async estimateGas({ from, to, data, value }) {
    const hex = await this._call("eth_estimateGas", [{ from, to, data, value }]);
    return BigInt(hex);
  }

  /**
   * Broadcast a signed raw transaction hex string.
   * Returns the transaction hash.
   */
  async broadcastRawTx(signedHex) {
    return this._call("eth_sendRawTransaction", [signedHex]);
  }

  /** Returns the current nonce for an address. */
  async getNonce(address) {
    const hex = await this._call("eth_getTransactionCount", [address, "latest"]);
    return parseInt(hex, 16);
  }

  // ── Deposit detection helpers ─────────────────────────────────────────────────

  /**
   * Scan a range of blocks for native ETH/BNB/MATIC transfers TO watched addresses.
   * @param {Set<string>} watchedAddresses  — lower-cased addresses to watch
   * @param {number}      fromBlock
   * @param {number}      toBlock
   */
  async scanNativeDeposits(watchedAddresses, fromBlock, toBlock) {
    const deposits = [];
    for (let n = fromBlock; n <= toBlock; n++) {
      const block = await this.getBlock(n);
      if (!block?.transactions) continue;

      for (const tx of block.transactions) {
        const to = (tx.to || "").toLowerCase();
        if (!watchedAddresses.has(to)) continue;
        if (!tx.value || tx.value === "0x0") continue;

        deposits.push({
          txHash:      tx.hash,
          blockNumber: parseInt(block.number, 16),
          fromAddress: tx.from,
          toAddress:   tx.to,
          asset:       this._chain.nativeAsset,
          amount:      Number(BigInt(tx.value)) / 1e18,
          raw:         tx,
        });
      }
    }
    return deposits;
  }

  /**
   * Scan ERC-20 Transfer events to watched addresses.
   * @param {string[]} contractAddresses  — token contract addresses
   * @param {Set<string>} watchedAddresses
   * @param {number} fromBlock
   * @param {number} toBlock
   */
  async scanTokenDeposits(contractAddresses, watchedAddresses, fromBlock, toBlock) {
    if (!contractAddresses.length) return [];

    const logs = await this.getLogs({
      fromBlock,
      toBlock,
      address:  contractAddresses,
      topics:   [ERC20_TRANSFER_TOPIC],
    });

    if (!logs?.length) return [];

    const deposits = [];
    for (const log of logs) {
      // topic[2] = to address (padded)
      const toAddr = "0x" + (log.topics?.[2] || "").slice(-40);
      if (!watchedAddresses.has(toAddr.toLowerCase())) continue;

      // Find which token config this contract belongs to
      const contractLower = (log.address || "").toLowerCase();
      const tokenEntry    = Object.entries(this._chain.tokens).find(
        ([, cfg]) => cfg.contractAddress.toLowerCase() === contractLower
      );
      if (!tokenEntry) continue;

      const [symbol, tokenCfg] = tokenEntry;
      const rawAmount = BigInt(log.data || "0x0");
      const amount    = Number(rawAmount) / 10 ** tokenCfg.decimals;

      deposits.push({
        txHash:      log.transactionHash,
        blockNumber: parseInt(log.blockNumber, 16),
        fromAddress: "0x" + (log.topics?.[1] || "").slice(-40),
        toAddress:   toAddr,
        asset:       symbol,
        amount,
        raw:         log,
      });
    }
    return deposits;
  }

  // ── Signing placeholder ───────────────────────────────────────────────────────

  /**
   * Signs a native transfer transaction.
   * In production, integrate with a KMS or HSM (e.g. AWS KMS, HashiCorp Vault).
   * This module never holds private keys directly — it delegates to a signing service.
   *
   * @param {object} params
   * @param {string} params.to
   * @param {bigint} params.value        wei
   * @param {bigint} params.gasPrice
   * @param {bigint} params.gasLimit
   * @param {number} params.nonce
   * @param {Function} params.signerFn  — async (txData) → signedHex
   */
  async signAndBroadcast({ to, value, gasPrice, gasLimit, nonce, data = "0x", signerFn }) {
    const txData = {
      chainId:  this._chain.chainId,
      nonce,
      gasPrice: `0x${gasPrice.toString(16)}`,
      gasLimit: `0x${gasLimit.toString(16)}`,
      to,
      value:    `0x${value.toString(16)}`,
      data,
    };
    const signedHex = await signerFn(txData);
    return this.broadcastRawTx(signedHex);
  }

  /** Healthcheck — returns true if RPC is reachable. */
  async ping() {
    try {
      await this.getLatestBlock();
      return true;
    } catch {
      return false;
    }
  }
}
