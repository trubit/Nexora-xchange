import { performanceCoreService } from "../services/performanceCoreService.js";
import { eventLoopOptimizer }     from "../services/eventLoopOptimizer.js";
import { inMemoryDataStore }      from "../services/inMemoryDataStore.js";
import { batchProcessor }         from "../services/batchProcessor.js";
import { redisPipelineOptimizer } from "../services/redisPipelineOptimizer.js";

export async function getPerformanceMetrics(req, res) {
  try {
    const metrics = performanceCoreService.getMetrics();
    res.json({ success: true, data: metrics });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getEventLoopMetrics(req, res) {
  try {
    res.json({
      success: true,
      data: {
        metrics: eventLoopOptimizer.getMetrics(),
        lagHistory: eventLoopOptimizer.getLagHistory().slice(-30),  // last 30 samples
        underPressure: eventLoopOptimizer.isUnderPressure(),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getCacheMetrics(req, res) {
  try {
    res.json({ success: true, data: inMemoryDataStore.getStats() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getBatchQueueMetrics(req, res) {
  try {
    res.json({ success: true, data: batchProcessor.getStats() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getRedisMetrics(req, res) {
  try {
    res.json({ success: true, data: redisPipelineOptimizer.getStats() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function flushBatchQueue(req, res) {
  try {
    const { queue } = req.params;
    if (queue === "all") {
      await batchProcessor.flushAll();
      return res.json({ success: true, message: "All queues flushed." });
    }
    await batchProcessor.flushNow(queue);
    res.json({ success: true, message: `Queue "${queue}" flushed.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function clearMemoryCache(req, res) {
  try {
    inMemoryDataStore.clearAll();
    res.json({ success: true, message: "In-memory cache cleared." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}
