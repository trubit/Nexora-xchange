/**
 * Microsecond-resolution latency tracker using process.hrtime.bigint().
 *
 * All durations stored as nanoseconds (BigInt) internally;
 * the summary API converts to microseconds for readability.
 *
 * Design: rolling fixed-size circular buffer per metric name.
 * No heap growth over time — once full, oldest sample is overwritten.
 */

import { HFTConfig } from "./HFTConfig.js";

const NS_PER_US = 1_000n;    // nanoseconds per microsecond

class CircularBuffer {
  constructor(capacity) {
    this._buf  = new Array(capacity).fill(0n);
    this._cap  = capacity;
    this._head = 0;
    this._size = 0;
  }

  push(ns) {
    this._buf[this._head] = ns;
    this._head = (this._head + 1) % this._cap;
    if (this._size < this._cap) this._size++;
  }

  /** Returns a sorted copy of stored values for percentile math. */
  sorted() {
    const filled = this._size === this._cap
      ? this._buf.slice()
      : this._buf.slice(0, this._size);
    return filled.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }

  get size() { return this._size; }
}

class LatencyTracker {
  constructor(windowSize = 1_000) {
    this._window  = windowSize;
    this._buckets = new Map(); // name → CircularBuffer
  }

  /** Call before an operation to get a timer handle. */
  start() {
    return process.hrtime.bigint();
  }

  /**
   * Record elapsed ns from a prior start() call.
   * @param {string} name  — metric label (e.g. "match", "db_flush", "publish")
   * @param {bigint} t0    — value returned by start()
   */
  record(name, t0) {
    if (!HFTConfig.metricsEnabled) return;
    const elapsed = process.hrtime.bigint() - t0;
    if (!this._buckets.has(name)) {
      this._buckets.set(name, new CircularBuffer(this._window));
    }
    this._buckets.get(name).push(elapsed);
  }

  _pct(sorted, p) {
    if (!sorted.length) return null;
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }

  /** Returns latency summary in microseconds per metric name. */
  summary() {
    const out = {};
    for (const [name, buf] of this._buckets) {
      const s = buf.sorted();
      if (!s.length) continue;
      const toUs = (ns) => (ns !== null ? Number(ns / NS_PER_US) : null);
      out[name] = {
        samples: buf.size,
        p50_us:  toUs(this._pct(s, 50)),
        p95_us:  toUs(this._pct(s, 95)),
        p99_us:  toUs(this._pct(s, 99)),
        min_us:  toUs(s[0]),
        max_us:  toUs(s[s.length - 1]),
      };
    }
    return out;
  }

  reset(name) {
    if (name) {
      this._buckets.delete(name);
    } else {
      this._buckets.clear();
    }
  }
}

export const hftMetrics = new LatencyTracker(
  parseInt(process.env.HFT_METRICS_WINDOW ?? "1000", 10)
);
