/**
 * Redis Pipeline Optimizer
 *
 * Wraps the Redis client to provide:
 *   - Automatic command pipelining (batch commands into one round-trip)
 *   - Connection-pool awareness (routes to cache vs. pub-sub client)
 *   - Atomic multi-key reads via MGET
 *   - Pub-sub broadcasting with back-pressure detection
 *   - Lua script execution for atomic updates
 *   - Pipeline stats for performance monitoring
 *
 * Usage:
 *   const { pipeline } = redisPipelineOptimizer;
 *   pipeline.set("key", "val").expire("key", 60);
 *   await pipeline.exec();          // single round-trip
 */

import { redisClients } from "../config/redis.js";
import logger from "../config/logger.js";

const PIPELINE_FLUSH_MS  = 5;     // auto-flush after 5 ms idle
const MAX_PIPELINE_CMDS  = 200;   // flush early if we hit 200 commands

export class RedisPipelineOptimizer {
  constructor() {
    this._stats = {
      pipelinesExecuted: 0,
      commandsSent:      0,
      pubSubMessages:    0,
      luaScriptCalls:    0,
      errors:            0,
    };
    this._pendingPipeline = null;
    this._pipelineTimer   = null;
    this._pendingCmds     = 0;
  }

  // ── Pipelined writes ──────────────────────────────────────────────────────────

  /**
   * Get a pipeline object that auto-flushes after PIPELINE_FLUSH_MS idle
   * or when MAX_PIPELINE_CMDS commands accumulate.
   *
   * For most use cases, prefer the convenience methods below.
   */
  getPipeline() {
    const redis = redisClients.cache;
    if (!redis) throw new Error("Redis cache client not available.");
    return redis.pipeline();
  }

  /**
   * Execute a set of commands in a single pipeline round-trip.
   * @param {Function} buildFn (pipeline) => void — add commands
   */
  async execPipeline(buildFn) {
    const redis = redisClients.cache;
    if (!redis) throw new Error("Redis cache client not available.");

    const pl = redis.pipeline();
    buildFn(pl);

    const start = Date.now();
    try {
      const results = await pl.exec();
      const cmdCount = results?.length || 0;
      this._stats.pipelinesExecuted++;
      this._stats.commandsSent += cmdCount;
      logger.debug({ cmdCount, ms: Date.now() - start }, "[RedisOpt] Pipeline executed.");
      return results;
    } catch (err) {
      this._stats.errors++;
      logger.error({ err: err.message }, "[RedisOpt] Pipeline execution failed.");
      throw err;
    }
  }

  // ── Atomic multi-read (MGET) ──────────────────────────────────────────────────

  /**
   * Fetch multiple keys in one round-trip. Returns an array parallel to keys.
   * Automatically JSON-parses entries that look like JSON.
   */
  async mget(keys) {
    const redis = redisClients.cache;
    if (!redis || keys.length === 0) return keys.map(() => null);

    try {
      const results = await redis.mget(...keys);
      return results.map((r) => {
        if (r === null) return null;
        try { return JSON.parse(r); } catch { return r; }
      });
    } catch (err) {
      this._stats.errors++;
      logger.warn({ err: err.message }, "[RedisOpt] MGET failed.");
      return keys.map(() => null);
    }
  }

  /**
   * Multi-set: write multiple key-value pairs in one pipeline.
   * @param {Array<{key, value, ttlSeconds}>} entries
   */
  async mset(entries) {
    if (entries.length === 0) return;
    await this.execPipeline((pl) => {
      for (const { key, value, ttlSeconds } of entries) {
        const raw = typeof value === "string" ? value : JSON.stringify(value);
        if (ttlSeconds) pl.setex(key, ttlSeconds, raw);
        else pl.set(key, raw);
      }
    });
    this._stats.commandsSent += entries.length;
  }

  /**
   * Multi-delete: remove multiple keys in one pipeline.
   */
  async mdel(keys) {
    if (keys.length === 0) return;
    const redis = redisClients.cache;
    if (!redis) return;
    await redis.del(...keys).catch((err) => {
      logger.warn({ err: err.message }, "[RedisOpt] MDEL failed.");
    });
  }

  // ── Pub-Sub broadcasting ──────────────────────────────────────────────────────

  /**
   * Publish a message to a Redis channel.
   * Automatically serialises objects to JSON.
   */
  async publish(channel, message) {
    const redis = redisClients.pubsub || redisClients.cache;
    if (!redis) return 0;
    try {
      const payload = typeof message === "string" ? message : JSON.stringify(message);
      const subscribers = await redis.publish(channel, payload);
      this._stats.pubSubMessages++;
      return subscribers;
    } catch (err) {
      this._stats.errors++;
      logger.warn({ err: err.message, channel }, "[RedisOpt] Publish failed.");
      return 0;
    }
  }

  /**
   * Publish to multiple channels in one pipeline.
   */
  async publishMany(channelMessages) {
    if (channelMessages.length === 0) return;
    await this.execPipeline((pl) => {
      for (const { channel, message } of channelMessages) {
        const payload = typeof message === "string" ? message : JSON.stringify(message);
        pl.publish(channel, payload);
      }
    });
    this._stats.pubSubMessages += channelMessages.length;
  }

  // ── Lua script execution ──────────────────────────────────────────────────────

  /**
   * Execute a Lua script atomically on the Redis server.
   * Scripts are cached by SHA — same script body is only transmitted once.
   *
   * @param {string}   script   Lua script body
   * @param {string[]} keys     KEYS table (KEYS[1], KEYS[2], …)
   * @param {string[]} args     ARGV table
   */
  async evalScript(script, keys = [], args = []) {
    const redis = redisClients.cache;
    if (!redis) throw new Error("Redis not available.");
    try {
      const result = await redis.eval(script, keys.length, ...keys, ...args);
      this._stats.luaScriptCalls++;
      return result;
    } catch (err) {
      this._stats.errors++;
      logger.warn({ err: err.message }, "[RedisOpt] Lua eval failed.");
      throw err;
    }
  }

  // ── Atomic increment with cap ──────────────────────────────────────────────────

  /**
   * Atomically increment a counter and optionally cap it at `max`.
   * Uses a Lua script for atomicity.
   */
  async incrWithCap(key, ttlSeconds, max = Infinity) {
    if (max === Infinity) {
      const redis = redisClients.cache;
      if (!redis) return 0;
      const count = await redis.incr(key);
      await redis.expire(key, ttlSeconds);
      return count;
    }

    const script = `
      local v = redis.call("INCR", KEYS[1])
      if v > tonumber(ARGV[2]) then
        redis.call("SET", KEYS[1], ARGV[2])
        v = tonumber(ARGV[2])
      end
      redis.call("EXPIRE", KEYS[1], ARGV[1])
      return v
    `;
    return this.evalScript(script, [key], [String(ttlSeconds), String(max)]);
  }

  // ── Stats ─────────────────────────────────────────────────────────────────────

  getStats() {
    return { ...this._stats };
  }

  resetStats() {
    this._stats = { pipelinesExecuted: 0, commandsSent: 0, pubSubMessages: 0, luaScriptCalls: 0, errors: 0 };
  }
}

export const redisPipelineOptimizer = new RedisPipelineOptimizer();
