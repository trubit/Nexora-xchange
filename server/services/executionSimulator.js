/**
 * Execution Simulation Layer
 *
 * Simulates what would happen if an arbitrage opportunity were executed:
 *   - Models market impact and slippage
 *   - Simulates partial fills based on available liquidity
 *   - Estimates execution latency
 *   - Computes realistic fill prices
 *
 * READ-ONLY — does NOT place real orders.
 * All executions are in-memory simulations only.
 */

import logger from "../config/logger.js";

// Exchange-level simulation profiles (latency, fill rates, slippage models)
const EXCHANGE_PROFILES = {
  trusonxchanger: { latencyMs: [2, 15],   fillRate: 0.97, slippageModel: "linear" },
  binance_sim:    { latencyMs: [50, 200],  fillRate: 0.95, slippageModel: "sqrt"   },
  coinbase_sim:   { latencyMs: [80, 300],  fillRate: 0.93, slippageModel: "sqrt"   },
  kraken_sim:     { latencyMs: [100, 400], fillRate: 0.91, slippageModel: "linear" },
  okx_sim:        { latencyMs: [60, 250],  fillRate: 0.94, slippageModel: "sqrt"   },
};

const DEFAULT_PROFILE    = { latencyMs: [100, 500], fillRate: 0.90, slippageModel: "linear" };
const DEFAULT_ORDER_SIZE = 1000; // USD
const MAX_SLIPPAGE_PCT   = 0.01; // 1% max slippage cap

export class ExecutionSimulator {
  constructor() {
    this._simulationCount = 0;
  }

  // ── Main simulation entry ─────────────────────────────────────────────────────

  /**
   * Simulate execution of an arbitrage opportunity.
   *
   * @param {object} opportunity  Opportunity from SpreadAnalysisEngine
   * @param {object} opts
   * @param {number} opts.orderSizeUsd    Notional order size in USD (default 1 000)
   * @param {object} opts.liquidityDepth  { exchange: { bid: depth, ask: depth } }
   */
  simulate(opportunity, opts = {}) {
    const orderSizeUsd = opts.orderSizeUsd ?? DEFAULT_ORDER_SIZE;

    this._simulationCount++;

    try {
      if (opportunity.type === "cross_exchange") {
        return this._simulateCrossExchange(opportunity, orderSizeUsd, opts.liquidityDepth);
      }
      if (opportunity.type === "triangular") {
        return this._simulateTriangular(opportunity, orderSizeUsd);
      }
      return this._simulateGeneric(opportunity, orderSizeUsd);
    } catch (err) {
      logger.warn({ err: err.message }, "[ExecSim] Simulation error.");
      return {
        status:         "failed",
        reason:         err.message,
        executionTimeMs: 0,
        fillRate:        0,
        actualProfit:    0,
        slippage:        0,
      };
    }
  }

  // ── Cross-exchange simulation ─────────────────────────────────────────────────

  _simulateCrossExchange(opp, orderSizeUsd, liquidityDepth) {
    const buyProfile  = this._getProfile(opp.buyExchange);
    const sellProfile = this._getProfile(opp.sellExchange);

    // Execution latency (worst-case leg determines total)
    const buyLatency  = this._sampleLatency(buyProfile);
    const sellLatency = this._sampleLatency(sellProfile);
    const totalLatency = buyLatency + sellLatency;

    // Check if price is still valid after simulated latency
    const latencyDecay = this._computeLatencyDecay(opp.spreadPct, totalLatency);
    const effectiveSpreadPct = opp.spreadPct * (1 - latencyDecay);

    if (effectiveSpreadPct <= opp.totalFeeRate) {
      return {
        status:          "loss",
        reason:          "Spread decayed below fees during simulated execution",
        executionTimeMs: totalLatency,
        fillRate:        0,
        actualProfit:    -(opp.totalFeeRate * orderSizeUsd),
        slippage:        latencyDecay,
      };
    }

    // Slippage on buy leg
    const buySlippage  = this._computeSlippage(buyProfile, orderSizeUsd, opp.buyPrice, liquidityDepth?.[opp.buyExchange]);
    const sellSlippage = this._computeSlippage(sellProfile, orderSizeUsd, opp.sellPrice, liquidityDepth?.[opp.sellExchange]);

    const effectiveBuyPrice  = opp.buyPrice  * (1 + buySlippage);
    const effectiveSellPrice = opp.sellPrice * (1 - sellSlippage);

    // Fill rates
    const buyFillRate  = Math.min(1, buyProfile.fillRate  + (Math.random() - 0.5) * 0.04);
    const sellFillRate = Math.min(1, sellProfile.fillRate + (Math.random() - 0.5) * 0.04);
    const combinedFillRate = buyFillRate * sellFillRate;

    // Actual profit
    const quantity     = (orderSizeUsd * combinedFillRate) / effectiveBuyPrice;
    const revenue      = quantity * effectiveSellPrice;
    const cost         = quantity * effectiveBuyPrice;
    const buyFee       = cost   * (opp.buyFeeRate  || 0.001);
    const sellFee      = revenue * (opp.sellFeeRate || 0.001);
    const actualProfit = revenue - cost - buyFee - sellFee;

    const status = actualProfit > 0 ? "profitable" : actualProfit === 0 ? "breakeven" : "loss";

    return {
      status,
      executionTimeMs:   Math.round(totalLatency),
      fillRate:          +combinedFillRate.toFixed(4),
      actualProfit:      +actualProfit.toFixed(6),
      slippage:          +(buySlippage + sellSlippage).toFixed(6),
      effectiveBuyPrice: +effectiveBuyPrice.toFixed(8),
      effectiveSellPrice:+effectiveSellPrice.toFixed(8),
      quantity:          +quantity.toFixed(8),
      latencyDecayPct:   +latencyDecay.toFixed(4),
    };
  }

  // ── Triangular simulation ─────────────────────────────────────────────────────

  _simulateTriangular(opp, orderSizeUsd) {
    const profile  = this._getProfile(opp.exchange);
    const latency  = opp.path.length * this._sampleLatency(profile);
    const fillRate = Math.pow(profile.fillRate, opp.path.length);

    const slippage     = opp.path.length * 0.0002;  // compound slippage per leg
    const effectiveNet = opp.profitPct - slippage - (opp.feeRate * opp.path.length * 2);

    const actualProfit  = effectiveNet * orderSizeUsd * fillRate;
    const status        = actualProfit > 0 ? "profitable" : "loss";

    return {
      status,
      executionTimeMs: Math.round(latency),
      fillRate:        +fillRate.toFixed(4),
      actualProfit:    +actualProfit.toFixed(6),
      slippage:        +slippage.toFixed(6),
      legsExecuted:    opp.path.length,
    };
  }

  // ── Generic simulation ────────────────────────────────────────────────────────

  _simulateGeneric(opp, orderSizeUsd) {
    const profile = this._getProfile("trusonxchanger");
    return {
      status:          opp.isProfitable ? "profitable" : "loss",
      executionTimeMs: this._sampleLatency(profile),
      fillRate:        profile.fillRate,
      actualProfit:    opp.isProfitable ? opp.netSpreadPct * orderSizeUsd * profile.fillRate : 0,
      slippage:        0.0002,
    };
  }

  // ── Helper utilities ──────────────────────────────────────────────────────────

  _getProfile(exchange) {
    return EXCHANGE_PROFILES[exchange] ?? DEFAULT_PROFILE;
  }

  _sampleLatency(profile) {
    const [min, max] = profile.latencyMs;
    return min + Math.random() * (max - min);
  }

  _computeSlippage(profile, orderSizeUsd, price, liquidityInfo) {
    if (!price || price <= 0) return 0;

    const depthUsd  = liquidityInfo?.depthUsd ?? orderSizeUsd * 10;
    const impactRaw = orderSizeUsd / depthUsd;

    let slippage;
    if (profile.slippageModel === "sqrt") {
      slippage = Math.sqrt(impactRaw) * 0.001;
    } else {
      slippage = impactRaw * 0.002;
    }

    return Math.min(slippage, MAX_SLIPPAGE_PCT);
  }

  /**
   * How much of the spread decays due to execution latency.
   * Higher volatility × latency → more decay.
   */
  _computeLatencyDecay(spreadPct, latencyMs) {
    const decayPerMs = spreadPct * 0.00002;  // spread volatility proxy
    return Math.min(0.9, latencyMs * decayPerMs);
  }

  // ── Batch simulation ──────────────────────────────────────────────────────────

  simulateBatch(opportunities, opts = {}) {
    return opportunities.map((opp) => ({
      opportunityId: opp.opportunityId,
      simulation:    this.simulate(opp, opts),
    }));
  }

  stats() {
    return { simulationsRun: this._simulationCount };
  }
}

export const executionSimulator = new ExecutionSimulator();
