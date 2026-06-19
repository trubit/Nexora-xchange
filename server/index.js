import "./env.js";
import http from "http";
import fs from "fs";
import path from "path";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import compression from "compression";
import hpp from "hpp";
import mongoSanitize from "express-mongo-sanitize";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import connectDb from "./config/db.js";
import logger from "./config/logger.js";
import { closeRedisConnections, redisEnabled } from "./config/redis.js";
import { closeQueues, queueEnabled } from "./queues/index.js";
import { metricsMiddleware, metricsRegistry } from "./monitoring/metrics.js";
import { attachRequestContext } from "./middleware/requestContext.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import authRoutes from "./routes/auth.js";
import blogsRoutes from "./routes/blogs.js";
import coinsRoutes from "./routes/coins.js";
import kycRoutes from "./routes/kyc.js";
import subscriptionsRoutes from "./routes/subscriptions.js";
import newsletterRoutes from "./routes/newsletter.js";
import supportRoutes from "./routes/support.js";
import tradesRoutes from "./routes/trades.js";
import ordersRoutes from "./routes/orders.js";
import transactionsRoutes from "./routes/transactions.js";
import usersRoutes from "./routes/users.js";
import walletsRoutes from "./routes/wallets.js";
import trusonCoinsRoutes from "./routes/trusonCoins.js";
import currencyRoutes from "./routes/currency.js";
import contactRoutes from "./routes/contactRoutes.js";
import marketRoutes from "./routes/market.js";
import dashboardRoutes from "./routes/dashboard.js";
import engineRoutes from "./routes/engine.js";
import marketDataRoutes from "./routes/marketData.js";
import notificationRoutes from "./routes/notifications.js";
import fiatRoutes from "./routes/fiat.js";
import liquidityRoutes from "./routes/liquidity.js";
import riskRoutes from "./routes/risk.js";
import { requireNotFrozen } from "./middleware/riskCheck.js";
import { startLiquidityEngine, stopLiquidityEngine } from "./services/liquidityService.js";
import { startConditionalProcessor, stopConditionalProcessor } from "./services/conditionalOrderService.js";
import { getLiveTicker } from "./services/tradeService.js";
import { setupTradeSocketServer } from "./socket/socketServer.js";
import { notificationService } from "./notifications/NotificationService.js";
import { MatchingEngine } from "./engine/MatchingEngine.js";
import { TradeExecutor } from "./engine/TradeExecutor.js";
import { mePublisher } from "./engine/publisher.js";
import { meBroadcaster } from "./socket/meEvents.js";
import { MarketDataService } from "./market/MarketDataService.js";
import { marketDataBroadcaster } from "./socket/marketDataEvents.js";
import Order from "./models/Order.js";
import Coin from "./models/Coin.js";
import { TRUSON_COIN_SEED } from "./config/supportedAssets.js";

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const UPLOADS_ROOT = path.join(process.cwd(), "server", "uploads");

const corsOrigins =
  CORS_ORIGIN === "*"
    ? "*"
    : CORS_ORIGIN.split(",").map((origin) => origin.trim());

const globalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.API_RATE_LIMIT_PER_MINUTE || 800),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please retry shortly." },
});

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(attachRequestContext);
app.use(metricsMiddleware);
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => req.requestId,
  }),
);

app.use(
  cors({
    origin: corsOrigins,
    credentials: corsOrigins !== "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-request-id",
      "x-client-timezone",
      "x-frontend-origin",
    ],
    maxAge: 86400,
  }),
);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(compression());
app.use(hpp());
// Patch: Only sanitize body, params, headers (not query) for Express 5 compatibility
app.use((req, res, next) => {
  ["body", "params", "headers"].forEach((key) => {
    if (req[key]) {
      req[key] = mongoSanitize.sanitize(req[key]);
    }
  });
  next();
});
app.use(express.json({ limit: "8mb" }));
app.use(express.urlencoded({ extended: false, limit: "8mb" }));
app.use("/api", globalApiLimiter);
fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
app.use("/uploads", express.static(UPLOADS_ROOT));

app.get("/health", (_req, res) => {
  const mongoStateMap = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };
  const mongoState = mongoStateMap[mongoose.connection.readyState] || "unknown";
  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    uptimeSec: Math.round(process.uptime()),
    services: {
      mongo: mongoState,
      redis: redisEnabled ? "enabled" : "disabled",
      queue: queueEnabled ? "enabled" : "disabled",
    },
  });
});

app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", metricsRegistry.contentType);
  res.end(await metricsRegistry.metrics());
});

app.use("/api/contact-us", contactRoutes);
app.use("/api/market", marketRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/coins", coinsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/trades", tradesRoutes);
app.use("/api/orders", requireNotFrozen, ordersRoutes);
app.use("/api/subscriptions", subscriptionsRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/wallets", walletsRoutes);
app.use("/api/kyc", kycRoutes);
app.use("/api/transactions", transactionsRoutes);
app.use("/api/blogs", blogsRoutes);
app.use("/api/trusonCoins", trusonCoinsRoutes);
app.use("/api/newsletter", newsletterRoutes);
app.use("/api/currency", currencyRoutes);
app.use("/api/engine", engineRoutes);
app.use("/api/market-data", marketDataRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/fiat",          fiatRoutes);
app.use("/api/liquidity",     liquidityRoutes);
app.use("/api/risk",          riskRoutes);

app.use(notFound);
app.use(errorHandler);

const closeHttpServer = (server) =>
  new Promise((resolve) => {
    server.close(() => resolve());
  });

const startServer = async () => {
  try {
    await connectDb(MONGODB_URI);
    const httpServer = http.createServer(app);
    const tradePublisher = setupTradeSocketServer(httpServer, {
      cors: {
        origin: corsOrigins,
        methods: ["GET", "POST"],
        credentials: corsOrigins !== "*",
      },
    });
    app.locals.tradePublisher = tradePublisher;
    app.locals.logger = logger;

    // Seed TrusonCoin in the coin catalog if not already present.
    try {
      await Coin.findOneAndUpdate(
        { symbol: TRUSON_COIN_SEED.symbol },
        { $setOnInsert: TRUSON_COIN_SEED },
        { upsert: true }
      );
    } catch (err) {
      logger.warn({ err: err.message }, "TrusonCoin seed skipped.");
    }

    // Promote super-admin emails to admin role if their accounts already exist.
    try {
      const superAdminEmails = (process.env.SUPER_ADMIN_EMAILS || "trustezika831@gmail.com")
        .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
      const result = await User.updateMany(
        { email: { $in: superAdminEmails }, role: { $ne: "admin" } },
        { $set: { role: "admin" } },
      );
      if (result.modifiedCount > 0) {
        logger.info(`[SEED] Promoted ${result.modifiedCount} account(s) to admin.`);
      }
    } catch (err) {
      logger.warn({ err: err.message }, "[SEED] Admin promotion skipped.");
    }

    // Initialize in-process matching engine (uses main DB + Redis + Socket.IO)
    try {
      const tradeExecutor = new TradeExecutor({ publisher: mePublisher });
      const matchingEngine = new MatchingEngine({ tradeExecutor, broadcaster: meBroadcaster });
      await matchingEngine.hydrate(Order);
      matchingEngine.start();
      app.locals.matchingEngine = matchingEngine;
      global.__matchingEngine   = matchingEngine; // accessible from tradeService OCO placement
    } catch (err) {
      logger.error({ err: err.message }, "[ME] Matching engine failed to start — trading continues without matching.");
    }

    // Start the liquidity engine (market-maker bot that keeps order books populated)
    try {
      await startLiquidityEngine();
    } catch (err) {
      logger.error({ err: err.message }, "[LIQUIDITY] Engine failed to start — markets will have no bot liquidity.");
    }

    // Start the conditional order processor (stop-loss, take-profit, trailing stops, OCO)
    try {
      const engine = app.locals.matchingEngine;
      startConditionalProcessor(getLiveTicker, engine);
    } catch (err) {
      logger.error({ err: err.message }, "[COND] Conditional processor failed to start.");
    }

    // Initialize market data service (subscribes to trade_events, builds price/candle state)
    try {
      const marketDataService = new MarketDataService({ broadcaster: marketDataBroadcaster });
      await marketDataService.start();
      app.locals.marketDataService = marketDataService;
    } catch (err) {
      logger.error({ err: err.message }, "[Market] Market data service failed to start.");
    }

    // Initialize notification service (Stage 6 — subscribes to Redis + persists + emits)
    try {
      await notificationService.start();
    } catch (err) {
      logger.error({ err: err.message }, "[Notif] Notification service failed to start.");
    }

    httpServer.listen(PORT, () => {
      logger.info(
        {
          port: PORT,
          smtp: Boolean(process.env.SMTP_HOST),
          googleClientId: Boolean(process.env.GOOGLE_CLIENT_ID),
          redisEnabled,
          queueEnabled,
        },
        "API listening.",
      );
    });

    let shuttingDown = false;
    const shutdown = async (signal) => {
      if (shuttingDown) return;
      shuttingDown = true;
      logger.warn({ signal }, "Graceful shutdown started.");

      const forceTimer = setTimeout(() => {
        logger.error("Shutdown timeout reached. Forcing exit.");
        process.exit(1);
      }, 20_000);
      forceTimer.unref();

      try {
        await closeHttpServer(httpServer);
        stopLiquidityEngine();
        stopConditionalProcessor();
        await Promise.allSettled([
          notificationService.stop(),
          closeQueues(),
          closeRedisConnections(),
          mongoose.connection.close(),
        ]);
        logger.info("Graceful shutdown completed.");
        process.exit(0);
      } catch (error) {
        logger.error({ error: error.message }, "Graceful shutdown failed.");
        process.exit(1);
      }
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("unhandledRejection", (reason) => {
      logger.error({ reason }, "Unhandled promise rejection.");
    });
    process.on("uncaughtException", (error) => {
      logger.fatal({ error: error.message }, "Uncaught exception.");
    });
  } catch (error) {
    logger.fatal({ error: error.message }, "Failed to start server.");
    process.exit(1);
  }
};

startServer();
