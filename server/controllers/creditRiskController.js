import { creditRiskEngine }        from "../services/creditRiskEngine.js";
import { tradingBehaviorScoring }  from "../services/tradingBehaviorScoring.js";
import { riskExposureCalculator }  from "../services/riskExposureCalculator.js";
import { portfolioRiskHeatmap }    from "../services/portfolioRiskHeatmap.js";
import { liquidityRiskDetector }   from "../services/liquidityRiskDetector.js";
import RiskReport                  from "../models/RiskReport.js";
import CreditScore                 from "../models/CreditScore.js";
import logger                      from "../config/logger.js";

// ── Credit Scoring ────────────────────────────────────────────────────────────

export async function getMyCreditScore(req, res) {
  try {
    const score = await creditRiskEngine.computeScore(req.user._id);
    res.json({ success: true, data: score });
  } catch (err) {
    logger.error({ err: err.message }, "[CreditRisk] getMyCreditScore failed");
    res.status(500).json({ success: false, message: "Failed to compute credit score." });
  }
}

export async function getUserCreditScore(req, res) {
  try {
    const score = await creditRiskEngine.computeScore(req.params.userId);
    res.json({ success: true, data: score });
  } catch (err) {
    logger.error({ err: err.message }, "[CreditRisk] getUserCreditScore failed");
    res.status(500).json({ success: false, message: "Failed to compute credit score." });
  }
}

export async function getCreditDistribution(req, res) {
  try {
    const dist = await creditRiskEngine.getDistribution();
    res.json({ success: true, data: dist });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ── Trading Behavior ──────────────────────────────────────────────────────────

export async function getMyBehaviorScore(req, res) {
  try {
    const score = await tradingBehaviorScoring.computeScore(req.user._id);
    res.json({ success: true, data: score });
  } catch (err) {
    logger.error({ err: err.message }, "[CreditRisk] getMyBehaviorScore failed");
    res.status(500).json({ success: false, message: "Failed to compute behavior score." });
  }
}

export async function getUserBehaviorScore(req, res) {
  try {
    const score = await tradingBehaviorScoring.computeScore(req.params.userId);
    res.json({ success: true, data: score });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ── Risk Exposure ─────────────────────────────────────────────────────────────

export async function getMyRiskExposure(req, res) {
  try {
    const report = await riskExposureCalculator.computeUserRisk(req.user._id);
    res.json({ success: true, data: report });
  } catch (err) {
    logger.error({ err: err.message }, "[CreditRisk] getMyRiskExposure failed");
    res.status(500).json({ success: false, message: "Failed to compute risk exposure." });
  }
}

export async function getMarketRisk(req, res) {
  try {
    const { symbol } = req.params;
    const report = await riskExposureCalculator.computeMarketRisk(
      decodeURIComponent(symbol),
    );
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getSystemRisk(req, res) {
  try {
    const report = await riskExposureCalculator.computeSystemRisk();
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ── Portfolio Heatmap ─────────────────────────────────────────────────────────

export async function getMyPortfolioHeatmap(req, res) {
  try {
    const heatmap = await portfolioRiskHeatmap.generateForUser(req.user._id);
    res.json({ success: true, data: heatmap });
  } catch (err) {
    logger.error({ err: err.message }, "[CreditRisk] getMyPortfolioHeatmap failed");
    res.status(500).json({ success: false, message: "Failed to generate portfolio heatmap." });
  }
}

// ── Liquidity Risk ────────────────────────────────────────────────────────────

export async function getLiquidityRisk(req, res) {
  try {
    // Pull snapshots from the market feed aggregator if available
    let snapshots = [];
    try {
      const { marketFeedAggregator } = await import("../services/marketFeedAggregator.js");
      const snapshot = marketFeedAggregator.getSnapshot();
      snapshots = Object.entries(snapshot).map(([symbol, tickers]) => {
        const internal = Object.values(tickers)[0];
        if (!internal) return null;
        const mid   = (internal.bid + internal.ask) / 2;
        const half  = mid * 0.001;
        return {
          symbol,
          bids: [[internal.bid, (internal.volume || 1) * 0.5]],
          asks: [[internal.ask, (internal.volume || 1) * 0.5]],
        };
      }).filter(Boolean);
    } catch {
      // No live feed — return cached platform summary
    }

    if (snapshots.length === 0) {
      const cached = await liquidityRiskDetector.getPlatformSummary();
      if (cached) return res.json({ success: true, data: cached, fromCache: true });
      return res.json({ success: true, data: { message: "No liquidity data available yet." } });
    }

    const result = await liquidityRiskDetector.analyseAll(snapshots);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error({ err: err.message }, "[CreditRisk] getLiquidityRisk failed");
    res.status(500).json({ success: false, message: "Failed to compute liquidity risk." });
  }
}

export async function getSymbolLiquidity(req, res) {
  try {
    const { symbol } = req.params;
    const cached = await liquidityRiskDetector._getCached(`symbol:${symbol}`);
    if (cached) return res.json({ success: true, data: cached, fromCache: true });
    res.json({ success: true, data: { message: `No liquidity data for ${symbol} yet.` } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ── Full Risk Summary for current user ───────────────────────────────────────

export async function getMyRiskSummary(req, res) {
  try {
    const userId = req.user._id;

    const [creditScore, behaviorScore, riskExposure, heatmap] = await Promise.allSettled([
      creditRiskEngine.computeScore(userId),
      tradingBehaviorScoring.getScore(userId),
      riskExposureCalculator.computeUserRisk(userId),
      portfolioRiskHeatmap.generateForUser(userId),
    ]);

    res.json({
      success: true,
      data: {
        creditScore:   creditScore.status   === "fulfilled" ? creditScore.value   : null,
        behaviorScore: behaviorScore.status === "fulfilled" ? behaviorScore.value : null,
        riskExposure:  riskExposure.status  === "fulfilled" ? riskExposure.value  : null,
        heatmap:       heatmap.status       === "fulfilled" ? heatmap.value       : null,
      },
    });
  } catch (err) {
    logger.error({ err: err.message }, "[CreditRisk] getMyRiskSummary failed");
    res.status(500).json({ success: false, message: "Failed to compute risk summary." });
  }
}

// ── Historical Reports ────────────────────────────────────────────────────────

export async function getMyRiskHistory(req, res) {
  try {
    const { type = "user", limit = 10 } = req.query;
    const reports = await RiskReport.find({
      userId:     req.user._id,
      reportType: type,
    })
      .sort({ generatedAt: -1 })
      .limit(Math.min(parseInt(limit, 10), 50))
      .lean();

    res.json({ success: true, data: reports });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ── Admin: batch rescore ──────────────────────────────────────────────────────

export async function triggerBatchRescore(req, res) {
  try {
    const { limit = 20 } = req.body;
    const results = await creditRiskEngine.processStaleScores(parseInt(limit, 10));
    res.json({ success: true, rescored: results.length, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}
