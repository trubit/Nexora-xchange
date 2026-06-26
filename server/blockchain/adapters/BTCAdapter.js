/**
 * BTCAdapter — Bitcoin Core JSON-RPC client.
 *
 * Implements the same ChainAdapter interface as EVMAdapter (where applicable).
 * Bitcoin Core must be running with JSON-RPC enabled.
 *
 * RPC auth: provide via CHAIN_BTC_RPC_URL with credentials embedded,
 * e.g. http://user:password@localhost:8332
 *
 * Implements:
 *   getLatestBlock()                   → block height (number)
 *   getBlock(height)                   → BlockInfo
 *   getTransactionReceipt(txid)        → TxInfo | null
 *   scanNativeDeposits(addresses, from, to)  → DepositInfo[]
 *   broadcastRawTx(hexTx)              → txid
 *   ping()                             → boolean
 */

import axios from "axios";

let _rpcId = 0;
const rpcId = () => ++_rpcId;

export class BTCAdapter {
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
        new Error(`[btc] RPC error ${res.data.error.code}: ${res.data.error.message}`),
        { rpcCode: res.data.error.code }
      );
    }
    return res.data?.result;
  }

  // ── ChainAdapter interface ───────────────────────────────────────────────────

  /** Returns current best block height. */
  async getLatestBlock() {
    return this._call("getblockcount");
  }

  /** Returns block by height (verbose = full tx objects). */
  async getBlock(height) {
    const hash = await this._call("getblockhash", [height]);
    return this._call("getblock", [hash, 2]); // verbosity=2 includes full txs
  }

  /** Returns raw transaction details (decoded). Returns null if not found. */
  async getTransactionReceipt(txid) {
    try {
      return await this._call("getrawtransaction", [txid, true]);
    } catch (err) {
      if (err.rpcCode === -5) return null; // "No such mempool or blockchain transaction"
      throw err;
    }
  }

  /** Returns BTC balance for an address (via scantxoutset — Bitcoin Core 0.17+). */
  async getBalance(address) {
    const result = await this._call("scantxoutset", [
      "start",
      [{ desc: `addr(${address})` }],
    ]);
    return result?.total_amount ?? 0;
  }

  /**
   * Scan blocks fromBlock..toBlock for outputs to any of the watched addresses.
   * Uses getblock(height, 2) which returns full decoded transactions.
   */
  async scanNativeDeposits(watchedAddresses, fromBlock, toBlock) {
    const deposits = [];

    for (let h = fromBlock; h <= toBlock; h++) {
      let block;
      try {
        block = await this.getBlock(h);
      } catch {
        continue;
      }
      if (!block?.tx) continue;

      for (const tx of block.tx) {
        for (const vout of tx.vout ?? []) {
          // Parenthesise explicitly: ?? binds tighter than ?:, so without parens
          // `(addresses ?? address) ? [address] : []` discards the addresses array.
          const addrs = vout.scriptPubKey?.addresses
            ?? (vout.scriptPubKey?.address ? [vout.scriptPubKey.address] : []);

          for (const addr of addrs) {
            if (!watchedAddresses.has(addr.toLowerCase())) continue;
            const amount = parseFloat(vout.value ?? 0);
            if (amount <= 0) continue;

            deposits.push({
              txHash:      tx.txid,
              blockNumber: h,
              fromAddress: "",     // BTC UTXOs have no single sender
              toAddress:   addr,
              asset:       this._chain.nativeAsset,
              amount,
              raw:         { tx, vout },
            });
          }
        }
      }
    }

    return deposits;
  }

  /** Broadcasts a signed raw transaction hex. Returns txid. */
  async broadcastRawTx(hexTx) {
    return this._call("sendrawtransaction", [hexTx]);
  }

  /** Returns minimal fee rate (sat/vByte). */
  async estimateFee(targetBlocks = 6) {
    const result = await this._call("estimatesmartfee", [targetBlocks]);
    // feerate is BTC/kB; convert to sat/vByte
    const btcPerKb  = result?.feerate ?? 0.0001;
    return Math.ceil((btcPerKb * 1e8) / 1000); // sat/vByte
  }

  /** Healthcheck. */
  async ping() {
    try {
      await this.getLatestBlock();
      return true;
    } catch {
      return false;
    }
  }
}
