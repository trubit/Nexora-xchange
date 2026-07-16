import { globalSyncEngine }              from "../services/globalSyncEngine.js";
import { globalOrderBookSync }           from "../services/globalOrderBookSync.js";
import { crossRegionEventReplicator }    from "../services/crossRegionEventReplicator.js";
import { conflictResolutionEngine }      from "../services/conflictResolutionEngine.js";
import { distributedConsistencyManager } from "../services/distributedConsistencyManager.js";
import { globalTimestampAuthority }      from "../services/globalTimestampAuthority.js";

export async function getSyncStatus(req, res) {
  try {
    const status = await globalSyncEngine.getStatus();
    res.json({ success: true, data: status });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getOrderBook(req, res) {
  try {
    const { symbol } = req.params;
    const ob = await globalOrderBookSync.getOrderBook(decodeURIComponent(symbol));
    if (!ob) return res.status(404).json({ success: false, message: "Order book not found." });
    res.json({ success: true, data: ob });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getOrderBookSymbols(req, res) {
  try {
    const symbols = await globalOrderBookSync.getAllSymbols();
    res.json({ success: true, data: symbols });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getReplicationStats(req, res) {
  try {
    const stats = crossRegionEventReplicator.getStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getRecentEvents(req, res) {
  try {
    const { limit = 50 } = req.query;
    const events = await crossRegionEventReplicator.getRecentEvents(parseInt(limit, 10));
    res.json({ success: true, data: events, count: events.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getConflictStats(req, res) {
  try {
    res.json({ success: true, data: conflictResolutionEngine.getStats() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getTimestampStatus(req, res) {
  try {
    res.json({
      success: true,
      data: {
        ...globalTimestampAuthority.getStats(),
        currentEventId: globalTimestampAuthority.nextEventId(),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getConsistencyReport(req, res) {
  try {
    const stats = distributedConsistencyManager.getStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}
