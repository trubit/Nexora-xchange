/**
 * HFT layer configuration — all values sourced from env vars.
 * No hardcoded business constants: every knob is overridable at deploy time.
 *
 * Env vars (with safe defaults):
 *   HFT_ENABLED              = "false"   — opt-in switch
 *   HFT_BATCH_FLUSH_SIZE     = "50"      — max fills per DB flush
 *   HFT_BATCH_FLUSH_MS       = "10"      — max ms before flushing a partial batch
 *   HFT_QUEUE_DEPTH_LIMIT    = "10000"   — per-symbol queue back-pressure limit
 *   HFT_SNAPSHOT_DEPTH       = "20"      — order-book levels to publish
 *   HFT_METRICS_ENABLED      = "true"    — microsecond latency tracking overhead
 *   HFT_PUB_COALESCE_MS      = "5"       — Redis coalesce window per symbol
 *   HFT_PERSIST_TRADES       = "true"    — persist trades to DB (false = speed only)
 *   HFT_BATCH_WALLET_OPS     = "true"    — batch wallet bulkWrite vs individual ops
 *   HFT_MAX_PARALLEL_FLUSH   = "4"       — concurrent DB flush workers
 */

const int  = (key, fallback) => parseInt(process.env[key] ?? String(fallback), 10);
const bool = (key, fallback) => (process.env[key] ?? String(fallback)).toLowerCase() !== "false";

export const HFTConfig = Object.freeze({
  enabled:           bool("HFT_ENABLED",           false),
  batchFlushSize:    int ("HFT_BATCH_FLUSH_SIZE",   50),
  batchFlushMs:      int ("HFT_BATCH_FLUSH_MS",     10),
  queueDepthLimit:   int ("HFT_QUEUE_DEPTH_LIMIT",  10_000),
  snapshotDepth:     int ("HFT_SNAPSHOT_DEPTH",     20),
  metricsEnabled:    bool("HFT_METRICS_ENABLED",    true),
  pubCoalesceMs:     int ("HFT_PUB_COALESCE_MS",    5),
  persistTrades:     bool("HFT_PERSIST_TRADES",     true),
  batchWalletOps:    bool("HFT_BATCH_WALLET_OPS",   true),
  maxParallelFlush:  int ("HFT_MAX_PARALLEL_FLUSH",  4),
});
