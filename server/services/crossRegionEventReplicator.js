/**
 * Cross-Region Event Replicator
 *
 * Publishes critical market and user events to Redis pub-sub channels so
 * that any future secondary region / replica node can subscribe and stay
 * in sync without polling the primary database.
 *
 * Current single-region deployment:
 *   - Events are published to dedicated Redis channels
 *   - Downstream consumers (analytics, risk, arbitrage) subscribe via Redis
 *   - When a second region is added, it subscribes to the same channels
 *
 * Event types replicated:
 *   - TRADE_EXECUTED    → arbitrage detector, risk engine, analytics
 *   - ORDER_PLACED      → order book sync, risk engine
 *   - ORDER_CANCELLED   → order book sync
 *   - PRICE_UPDATE      → market feed aggregator, analytics
 *   - USER_DEPOSIT      → credit risk engine
 *   - USER_WITHDRAWAL   → credit risk engine, compliance
 *
 * Each event carries a global timestamp (ms since epoch) and a monotonic
 * sequence number for ordering verification.
 */

import { EventEmitter }           from "events";
import { redisPipelineOptimizer } from "./redisPipelineOptimizer.js";
import { redisClients }           from "../config/redis.js";
import logger                     from "../config/logger.js";

const CHANNEL_PREFIX  = "global:event:";
const HISTORY_KEY     = "global:events:recent";
const HISTORY_MAX     = 1_000;  // keep last 1000 events in Redis list

export class CrossRegionEventReplicator extends EventEmitter {
  constructor() {
    super();
    this._seq     = 0;
    this._running = false;
    this._stats   = { published: 0, errors: 0, subscribers: {} };
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  start() {
    this._running = true;
    logger.info("[EventRepl] Cross-region event replicator started.");
  }

  stop() {
    this._running = false;
    logger.info("[EventRepl] Cross-region event replicator stopped.");
  }

  // ── Publish ───────────────────────────────────────────────────────────────────

  /**
   * Publish a single event to its type-specific channel and to the global history.
   */
  async publish(type, payload) {
    if (!this._running) return;

    const event = {
      type,
      seq:   ++this._seq,
      ts:    Date.now(),
      payload,
    };

    const channel = `${CHANNEL_PREFIX}${type}`;

    try {
      await redisPipelineOptimizer.publish(channel, event);
      this._appendToHistory(event).catch(() => {});
      this._stats.published++;
      this.emit("published", event);
    } catch (err) {
      this._stats.errors++;
      logger.warn({ err: err.message, type }, "[EventRepl] Publish failed.");
    }
  }

  /**
   * Publish multiple events in one pipeline.
   */
  async publishBatch(events) {
    if (!this._running || events.length === 0) return;
    const enriched = events.map((e) => ({
      type:    e.type,
      seq:     ++this._seq,
      ts:      Date.now(),
      payload: e.payload,
    }));

    const channelMessages = enriched.map((e) => ({
      channel: `${CHANNEL_PREFIX}${e.type}`,
      message: e,
    }));

    try {
      await redisPipelineOptimizer.publishMany(channelMessages);
      this._stats.published += enriched.length;
    } catch (err) {
      this._stats.errors++;
      logger.warn({ err: err.message }, "[EventRepl] Batch publish failed.");
    }
  }

  // ── Subscribe ─────────────────────────────────────────────────────────────────

  /**
   * Subscribe to one or more event types.
   * Requires a dedicated Redis client (subscribing locks the connection).
   *
   * @param {string|string[]} types  Event type(s) to subscribe to
   * @param {Function}        handler  (event) => void
   */
  async subscribe(types, handler) {
    const redis = redisClients.subscriber;
    if (!redis) {
      logger.warn("[EventRepl] No subscriber Redis client configured.");
      return;
    }

    const channels = (Array.isArray(types) ? types : [types]).map((t) => `${CHANNEL_PREFIX}${t}`);

    await redis.subscribe(...channels, (message, channel) => {
      try {
        const event = JSON.parse(message);
        handler(event);
        const type = channel.replace(CHANNEL_PREFIX, "");
        this._stats.subscribers[type] = (this._stats.subscribers[type] || 0) + 1;
      } catch (err) {
        logger.warn({ err: err.message }, "[EventRepl] Message parse error.");
      }
    });
  }

  // ── History replay ────────────────────────────────────────────────────────────

  /**
   * Return the N most recent published events (for catch-up on reconnect).
   */
  async getRecentEvents(limit = 100) {
    const redis = redisClients.cache;
    if (!redis) return [];
    try {
      const raw = await redis.lrange(HISTORY_KEY, 0, Math.min(limit, HISTORY_MAX) - 1);
      return raw.map((r) => JSON.parse(r)).filter(Boolean);
    } catch { return []; }
  }

  // ── Convenience emitters ──────────────────────────────────────────────────────

  emitTradeExecuted(trade)       { return this.publish("TRADE_EXECUTED",   trade); }
  emitOrderPlaced(order)         { return this.publish("ORDER_PLACED",      order); }
  emitOrderCancelled(order)      { return this.publish("ORDER_CANCELLED",   order); }
  emitPriceUpdate(symbol, price) { return this.publish("PRICE_UPDATE",      { symbol, price, ts: Date.now() }); }
  emitUserDeposit(userId, amount){ return this.publish("USER_DEPOSIT",      { userId, amount, ts: Date.now() }); }
  emitUserWithdrawal(userId, amt){ return this.publish("USER_WITHDRAWAL",   { userId, amount: amt, ts: Date.now() }); }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  async _appendToHistory(event) {
    const redis = redisClients.cache;
    if (!redis) return;
    await redis.lpush(HISTORY_KEY, JSON.stringify(event));
    await redis.ltrim(HISTORY_KEY, 0, HISTORY_MAX - 1);
  }

  getStats() {
    return { ...this._stats };
  }

  getSequence() {
    return this._seq;
  }
}

export const crossRegionEventReplicator = new CrossRegionEventReplicator();
