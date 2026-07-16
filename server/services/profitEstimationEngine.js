/**
 * Profit Estimation Engine
 *
 * Provides comprehensive profit estimation for arbitrage opportunities:
 *   - Gross profit from spread
 *   - Fee deduction (maker/taker, withdrawal, network)
 *   - Slippage cost
 *   - Capital cost (opportunity cost of locked capital)
 *   - Tax estimation (configurable)
 *   - Risk-adjusted expected value (EV)
 *   - Break-even analysis
 */

const DEFAULT_FEE_RATES = {
  trusonxchanger: { maker: 0.001,  taker: 0.001,  withdrawal: 0 },
  binance_sim:    { maker: 0.0010, taker: 0.0010, withdrawal: 0.0005 },
  coinbase_sim:   { maker: 0.0050, taker: 0.0060, withdrawal: 0.001  },
  kraken_sim:     { maker: 0.0016, taker: 0.0026, withdrawal: 0.0002 },
  okx_sim:        { maker: 0.0008, taker: 0.001,  withdrawal: 0.0003 },
};

const CAPITAL_COST_RATE_PER_YEAR = 0.05;  // 5% annualized opportunity cost
const SECS_PER_YEAR              = 31_536_000;
const DEFAULT_TAX_RATE           = Number(process.env.ARBI_TAX_RATE || 0);

export class ProfitEstimationEngine {
  // ── Main estimation ───────────────────────────────────────────────────────────

  /**
   * Full P&L estimation for a cross-exchange opportunity.
   *
   * @param {object} opp          Cross-exchange opportunity from SpreadAnalysisEngine
   * @param {object} opts
   * @param {number} opts.orderSizeUsd     Capital deployed (USD)
   * @param {number} opts.executionTimeMs  Estimated execution duration
   * @param {number} opts.slippage         Combined slippage (fraction)
   * @param {number} opts.fillRate         Expected fill rate 0-1
   * @param {number} opts.confidence       Opportunity confidence 0-1
   */
  estimate(opp, opts = {}) {
    const capital        = opts.orderSizeUsd    ?? 1000;
    const execTimeMs     = opts.executionTimeMs ?? 200;
    const slippage       = opts.slippage        ?? 0.0002;
    const fillRate       = opts.fillRate        ?? 0.95;
    const confidence     = opts.confidence      ?? 0.7;

    // ── Revenue & costs ────────────────────────────────────────────────────────
    const grossSpreadPct = opp.spreadPct || 0;
    const grossRevenue   = capital * fillRate * grossSpreadPct;

    // Exchange fees
    const buyFees        = this._computeFees(opp.buyExchange,  capital * fillRate, "taker");
    const sellFees       = this._computeFees(opp.sellExchange, capital * fillRate, "taker");
    const withdrawalFees = this._computeWithdrawalFees(opp.buyExchange, capital * fillRate);
    const totalFees      = buyFees + sellFees + withdrawalFees;

    // Slippage cost
    const slippageCost   = capital * fillRate * slippage;

    // Capital opportunity cost
    const holdingTimeSec   = execTimeMs / 1000;
    const capitalCost      = capital * CAPITAL_COST_RATE_PER_YEAR * (holdingTimeSec / SECS_PER_YEAR);

    // Net profit before tax
    const netBeforeTax   = grossRevenue - totalFees - slippageCost - capitalCost;

    // Tax
    const taxAmount      = netBeforeTax > 0 ? netBeforeTax * DEFAULT_TAX_RATE : 0;
    const netAfterTax    = netBeforeTax - taxAmount;

    // ── Derived metrics ────────────────────────────────────────────────────────
    const netProfitPct   = capital > 0 ? netAfterTax / capital : 0;
    const roi            = capital > 0 ? (netAfterTax / capital) * 100 : 0;
    const annualizedRoi  = roi * (SECS_PER_YEAR / holdingTimeSec) / 100;

    // Risk-adjusted EV = E[profit] × confidence − E[loss] × (1-confidence)
    const expectedLoss   = totalFees + slippageCost;
    const riskAdjustedEV = netAfterTax * confidence - expectedLoss * (1 - confidence);

    // Break-even spread
    const breakEvenSpreadPct = (totalFees + slippageCost) / (capital * fillRate);
    const marginOfSafety     = grossSpreadPct - breakEvenSpreadPct;

    return {
      capital:           +capital.toFixed(2),
      fillRate:          +fillRate.toFixed(4),
      grossRevenue:      +grossRevenue.toFixed(6),
      fees: {
        buy:        +buyFees.toFixed(6),
        sell:       +sellFees.toFixed(6),
        withdrawal: +withdrawalFees.toFixed(6),
        total:      +totalFees.toFixed(6),
      },
      slippageCost:       +slippageCost.toFixed(6),
      capitalCost:        +capitalCost.toFixed(6),
      netBeforeTax:       +netBeforeTax.toFixed(6),
      taxAmount:          +taxAmount.toFixed(6),
      netAfterTax:        +netAfterTax.toFixed(6),
      netProfitPct:       +netProfitPct.toFixed(6),
      roi:                +roi.toFixed(4),
      annualizedRoi:      +annualizedRoi.toFixed(4),
      riskAdjustedEV:     +riskAdjustedEV.toFixed(6),
      breakEvenSpreadPct: +breakEvenSpreadPct.toFixed(6),
      marginOfSafety:     +marginOfSafety.toFixed(6),
      isProfitable:        netAfterTax > 0,
      confidence:         +confidence.toFixed(4),
    };
  }

  // ── Triangular profit estimation ──────────────────────────────────────────────

  estimateTriangular(opp, opts = {}) {
    const capital    = opts.orderSizeUsd ?? 1000;
    const fillRate   = opts.fillRate     ?? Math.pow(0.95, opp.path?.length || 3);
    const legs       = opp.path?.length  || 3;

    const feeRate    = this._getExchangeFees(opp.exchange);
    const totalFees  = capital * feeRate.taker * legs;
    const slippage   = capital * 0.0002 * legs;

    const grossProfit = capital * (opp.profitPct || 0) * fillRate;
    const netProfit   = grossProfit - totalFees - slippage;

    return {
      capital:     +capital.toFixed(2),
      legs,
      fillRate:    +fillRate.toFixed(4),
      grossProfit: +grossProfit.toFixed(6),
      totalFees:   +totalFees.toFixed(6),
      slippage:    +slippage.toFixed(6),
      netProfit:   +netProfit.toFixed(6),
      netProfitPct:+(netProfit / capital).toFixed(6),
      isProfitable: netProfit > 0,
    };
  }

  // ── Break-even analysis ───────────────────────────────────────────────────────

  computeBreakEven(buyExchange, sellExchange, capitalUsd) {
    const buyFeeRate  = this._getExchangeFees(buyExchange).taker;
    const sellFeeRate = this._getExchangeFees(sellExchange).taker;
    const withdrawFee = this._getExchangeFees(buyExchange).withdrawal;

    const feePct      = buyFeeRate + sellFeeRate + withdrawFee;
    const slippagePct = 0.0004;  // conservative 4bps slippage

    return {
      minimumSpreadPct:    +(feePct + slippagePct).toFixed(6),
      minimumSpreadBps:    +((feePct + slippagePct) * 10_000).toFixed(2),
      feesUsd:             +(capitalUsd * feePct).toFixed(4),
      slippageUsd:         +(capitalUsd * slippagePct).toFixed(4),
    };
  }

  // ── Scale analysis ────────────────────────────────────────────────────────────

  /**
   * Show profit at multiple capital sizes for a given spread.
   */
  scaleAnalysis(opp, capitalSizes = [100, 500, 1000, 5000, 10000]) {
    return capitalSizes.map((size) => {
      const est = this.estimate(opp, { orderSizeUsd: size });
      return { capital: size, ...est };
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  _getExchangeFees(exchange) {
    return DEFAULT_FEE_RATES[exchange] ?? { maker: 0.002, taker: 0.002, withdrawal: 0.001 };
  }

  _computeFees(exchange, notional, side = "taker") {
    const fees    = this._getExchangeFees(exchange);
    const rate    = fees[side] ?? fees.taker ?? 0.002;
    return notional * rate;
  }

  _computeWithdrawalFees(exchange, notional) {
    const fees = this._getExchangeFees(exchange);
    return notional * (fees.withdrawal ?? 0);
  }

  // ── Portfolio-level metrics ───────────────────────────────────────────────────

  /**
   * Aggregate profit metrics across a set of estimated opportunities.
   */
  aggregatePortfolioMetrics(estimations) {
    if (!estimations || estimations.length === 0) return {};

    const profitable = estimations.filter((e) => e.isProfitable);
    const totalNet   = estimations.reduce((s, e) => s + (e.netAfterTax || 0), 0);
    const totalEV    = estimations.reduce((s, e) => s + (e.riskAdjustedEV || 0), 0);

    return {
      total:              estimations.length,
      profitable:         profitable.length,
      winRate:            +(profitable.length / estimations.length).toFixed(4),
      totalNetProfit:     +totalNet.toFixed(6),
      totalRiskAdjEV:     +totalEV.toFixed(6),
      avgNetProfitPct:    +(totalNet / estimations.length / (estimations[0]?.capital || 1000)).toFixed(6),
      bestOpportunity:    estimations.reduce((best, e) => e.netAfterTax > (best?.netAfterTax || -Infinity) ? e : best, null),
    };
  }
}

export const profitEstimationEngine = new ProfitEstimationEngine();
