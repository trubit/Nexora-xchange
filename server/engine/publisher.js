import { redisClients } from "../config/redis.js";

export const TRADE_CHANNEL     = process.env.REDIS_TRADE_CHANNEL     ?? "trade_events";
export const ORDERBOOK_CHANNEL = process.env.REDIS_ORDERBOOK_CHANNEL ?? "orderbook_events";

export const mePublisher = {
  async publishTrade(payload) {
    const pub = redisClients.pubSub;
    if (!pub) return;
    try {
      await pub.publish(TRADE_CHANNEL, JSON.stringify({ event: "TRADE_EXECUTED", ...payload }));
    } catch (err) {
      console.error("[ME] publishTrade failed:", err.message);
    }
  },

  async publishOrderBook(snapshot) {
    const pub = redisClients.pubSub;
    if (!pub) return;
    try {
      await pub.publish(ORDERBOOK_CHANNEL, JSON.stringify({ event: "ORDERBOOK_UPDATE", ...snapshot }));
    } catch (err) {
      console.error("[ME] publishOrderBook failed:", err.message);
    }
  },
};
