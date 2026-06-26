/**
 * Cross-Region Event Bus
 *
 * Event-driven data replication across regional clusters.
 * Uses Redis Pub/Sub channels when available; falls back to in-process
 * EventEmitter for local-only / development mode.
 *
 * Channel naming: trusonx:<region>:<event-type>
 * Global fanout:  trusonx:global:<event-type>
 *
 * Guaranteed ordering per-region. No global ordering guarantee
 * (each region's matching engine is the authority for its markets).
 *
 * Replicated event types:
 *   - trade.executed      → all regions receive fills for price display
 *   - order.placed        → non-owning regions update order state cache
 *   - order.cancelled     → propagate cancellation globally
 *   - price.update        → ticker / candle fanout
 *   - user.balance        → wallet balance sync after fills
 *   - region.health       → heartbeat from each region
 */

import { EventEmitter } from "events";
import { redisClients } from "../config/redis.js";
import logger from "../config/logger.js";
import { DEFAULT_REGION } from "./regionRegistry.js";

const LOCAL_REGION = process.env.REGION_ID ?? DEFAULT_REGION;
const PREFIX       = "trusonx";

export class CrossRegionEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
    this._sub       = null; // Redis subscriber client
    this._pub       = null; // Redis publisher client
    this._handlers  = new Map(); // eventType → Set<handler>
    this._stats     = { published: 0, received: 0, errors: 0 };
  }

  async init() {
    const { pubSub: subClient, queue: pubClient } = redisClients;

    if (!subClient || !pubClient) {
      logger.warn("[EventBus] Redis unavailable — using in-process bus only.");
      return;
    }

    // Duplicate the pub-sub client so subscriber doesn't block publisher
    this._pub = pubClient;
    this._sub = subClient.duplicate();

    this._sub.on("message", (channel, message) => {
      this._stats.received++;
      try {
        const envelope = JSON.parse(message);
        // Skip events we published ourselves
        if (envelope.originRegion === LOCAL_REGION) return;
        this._dispatch(envelope);
      } catch (err) {
        this._stats.errors++;
        logger.error({ channel, err: err.message }, "[EventBus] Parse error.");
      }
    });

    // Subscribe to global channel and all region channels
    const globalChannel = `${PREFIX}:global:*`;
    await this._sub.psubscribe(globalChannel);
    logger.info({ channel: globalChannel }, "[EventBus] Subscribed to global channel.");
  }

  /**
   * Publish an event originating from this region.
   * @param {string} eventType   e.g. "trade.executed"
   * @param {object} payload
   * @param {object} opts
   * @param {'global'|'regional'} opts.scope  global → all regions; regional → only local
   * @param {string[]} opts.targetRegions      override: send to specific regions
   */
  async publish(eventType, payload, { scope = "global", targetRegions } = {}) {
    const envelope = {
      id:           crypto.randomUUID(),
      eventType,
      originRegion: LOCAL_REGION,
      ts:           Date.now(),
      payload,
    };

    // Always emit locally (for local listeners)
    this._dispatch(envelope);
    this._stats.published++;
    this._stats.received++;

    if (!this._pub) return; // No Redis — local only

    try {
      const json = JSON.stringify(envelope);

      if (targetRegions?.length) {
        await Promise.all(
          targetRegions.map((r) => this._pub.publish(`${PREFIX}:${r}:${eventType}`, json))
        );
      } else if (scope === "global") {
        await this._pub.publish(`${PREFIX}:global:${eventType}`, json);
      } else {
        await this._pub.publish(`${PREFIX}:${LOCAL_REGION}:${eventType}`, json);
      }

    } catch (err) {
      this._stats.errors++;
      logger.error({ eventType, err: err.message }, "[EventBus] Publish failed.");
    }
  }

  /**
   * Subscribe to an event type from any region.
   * @param {string} eventType
   * @param {function} handler  receives (payload, envelope)
   */
  on(eventType, handler) {
    if (!this._handlers.has(eventType)) this._handlers.set(eventType, new Set());
    this._handlers.get(eventType).add(handler);
    return this;
  }

  off(eventType, handler) {
    this._handlers.get(eventType)?.delete(handler);
    return this;
  }

  stats() {
    return { ...this._stats, region: LOCAL_REGION };
  }

  async close() {
    if (this._sub) await this._sub.quit().catch(() => {});
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  _dispatch(envelope) {
    const handlers = this._handlers.get(envelope.eventType);
    if (!handlers?.size) return;
    for (const h of handlers) {
      try {
        h(envelope.payload, envelope);
      } catch (err) {
        logger.error({ eventType: envelope.eventType, err: err.message }, "[EventBus] Handler error.");
      }
    }
  }
}

export const eventBus = new CrossRegionEventBus();

// ── Standard event publishers ─────────────────────────────────────────────────

export const publishTradeExecuted = (trade) =>
  eventBus.publish("trade.executed", trade, { scope: "global" });

export const publishOrderPlaced = (order) =>
  eventBus.publish("order.placed", order, { scope: "global" });

export const publishOrderCancelled = (orderId, symbol) =>
  eventBus.publish("order.cancelled", { orderId, symbol }, { scope: "global" });

export const publishPriceUpdate = (symbol, price, change24h) =>
  eventBus.publish("price.update", { symbol, price, change24h }, { scope: "global" });

export const publishUserBalance = (userId, walletDelta) =>
  eventBus.publish("user.balance", { userId, walletDelta }, { scope: "global" });

export const publishRegionHeartbeat = () =>
  eventBus.publish(
    "region.health",
    { region: LOCAL_REGION, ts: Date.now(), status: "ok" },
    { scope: "global" }
  );
