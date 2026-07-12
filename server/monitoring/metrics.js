import client from "prom-client";

const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: "nexora_" });

const httpRequestDurationMs = new client.Histogram({
  name: "nexora_http_request_duration_ms",
  help: "HTTP request duration in milliseconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [50, 100, 200, 400, 800, 1600, 3200],
});

register.registerMetric(httpRequestDurationMs);

export const metricsRegistry = register;

export const metricsMiddleware = (req, res, next) => {
  const stop = httpRequestDurationMs.startTimer({
    method: req.method,
    route: req.route?.path || req.path,
  });

  res.on("finish", () => {
    stop({ status_code: res.statusCode });
  });

  next();
};

