/**
 * Global Timestamp Authority (GTA)
 *
 * Provides monotonically increasing timestamps for event ordering across the
 * system. Prevents clock skew between services from producing out-of-order
 * events in audit logs, order book updates, and replication streams.
 *
 * Implementation:
 *   - Logical clock: logical_ts = max(local_wall_clock, last_issued + 1)
 *   - Stored in Redis so all nodes share the same counter (single-region)
 *   - Falls back to local clock on Redis unavailability
 *   - Produces Hybrid Logical Clocks (HLC) with wall-clock + counter component
 *   - Issues globally unique event IDs: {ts_ms}-{counter}-{node_id}
 *
 * When to use:
 *   - Trade execution timestamps
 *   - Order book delta timestamps
 *   - Replication event sequencing
 *   - Audit log ordering
 */

import crypto        from "crypto";
import { redisClients } from "../config/redis.js";
import logger        from "../config/logger.js";

const TS_KEY           = "gta:hlc";
const NODE_ID          = crypto.randomBytes(4).toString("hex");  // unique per process
const SYNC_INTERVAL_MS = 10_000;  // drift correction every 10 s
const MAX_DRIFT_MS     = 1_000;   // alert if local clock drifts > 1 s from Redis TS

export class GlobalTimestampAuthority {
  constructor() {
    this._localTs   = 0;  // last issued logical ms
    this._counter   = 0;  // sub-ms counter
    this._syncHandle = null;
    this._stats = {
      issued:       0,
      fallbacks:    0,  // issued from local clock (Redis unavailable)
      driftAlerts:  0,
    };
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  start() {
    this._syncHandle = setInterval(() => this._syncWithRedis(), SYNC_INTERVAL_MS);
    logger.info({ nodeId: NODE_ID }, "[GTA] Global Timestamp Authority started.");
  }

  stop() {
    if (this._syncHandle) clearInterval(this._syncHandle);
    logger.info("[GTA] Global Timestamp Authority stopped.");
  }

  // ── Timestamp issuance ────────────────────────────────────────────────────────

  /**
   * Issue the next monotonic timestamp in milliseconds.
   * Always >= the previously issued timestamp.
   */
  now() {
    const wallMs = Date.now();
    // Hybrid logical clock: ensure ts never goes backwards
    if (wallMs > this._localTs) {
      this._localTs = wallMs;
      this._counter = 0;
    } else {
      this._counter++;
    }
    this._stats.issued++;
    return this._localTs;
  }

  /**
   * Issue a globally unique event ID: "{ts_ms}-{counter:04d}-{nodeId}"
   * Usable as a monotonic sort key across all events.
   */
  nextEventId() {
    const ts  = this.now();
    const ctr = String(this._counter).padStart(4, "0");
    return `${ts}-${ctr}-${NODE_ID}`;
  }

  /**
   * Parse an event ID back to its components.
   */
  parseEventId(id) {
    const parts = id.split("-");
    if (parts.length < 3) return null;
    return {
      ts:      parseInt(parts[0], 10),
      counter: parseInt(parts[1], 10),
      nodeId:  parts[2],
    };
  }

  /**
   * Compare two event IDs lexicographically.
   * Returns negative if a < b, 0 if equal, positive if a > b.
   */
  compare(a, b) {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  }

  /**
   * Receive a remote timestamp (from another node or a replicated event) and
   * advance the local clock if the remote is ahead.
   */
  receive(remoteTs) {
    if (remoteTs > this._localTs) {
      this._localTs = remoteTs;
      this._counter = 0;
    } else if (remoteTs === this._localTs) {
      this._counter++;
    }
  }

  // ── Redis sync ────────────────────────────────────────────────────────────────

  async _syncWithRedis() {
    const redis = redisClients.cache;
    if (!redis) return;

    try {
      // Read current global TS from Redis
      const script = `
        local current = tonumber(redis.call("GET", KEYS[1])) or 0
        local local_ts = tonumber(ARGV[1])
        local new_ts = math.max(current, local_ts)
        redis.call("SET", KEYS[1], new_ts)
        return new_ts
      `;
      const globalTs = await redis.eval(script, 1, TS_KEY, String(this._localTs));
      const parsedTs = parseInt(globalTs, 10);

      // Check drift
      const wallNow = Date.now();
      const drift   = Math.abs(wallNow - parsedTs);
      if (drift > MAX_DRIFT_MS) {
        this._stats.driftAlerts++;
        logger.warn({ drift, local: wallNow, global: parsedTs }, "[GTA] Clock drift detected.");
      }

      // Advance local if Redis is ahead
      if (parsedTs > this._localTs) {
        this._localTs = parsedTs;
        this._counter = 0;
      }
    } catch (err) {
      this._stats.fallbacks++;
      logger.warn({ err: err.message }, "[GTA] Redis sync failed — using local clock.");
    }
  }

  // ── Utility ───────────────────────────────────────────────────────────────────

  /**
   * Convert a GTA timestamp to a JavaScript Date object.
   */
  toDate(ts) {
    return new Date(ts);
  }

  /**
   * Return the age of an event in milliseconds.
   */
  age(eventTs) {
    return Date.now() - eventTs;
  }

  getStats() {
    return {
      ...this._stats,
      nodeId:     NODE_ID,
      localTs:    this._localTs,
      counter:    this._counter,
      uptimeMs:   process.uptime() * 1000,
    };
  }
}

export const globalTimestampAuthority = new GlobalTimestampAuthority();
