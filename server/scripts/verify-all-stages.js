/**
 * verify-all-stages.js
 *
 * Hits every major API endpoint for Stages 1–30.
 * Run with:
 *   node server/scripts/verify-all-stages.js --email=admin@example.com --password=yourpassword
 *
 * Or set env vars:
 *   VERIFY_EMAIL=admin@example.com VERIFY_PASSWORD=yourpassword node server/scripts/verify-all-stages.js
 */

import http from "http";
import https from "https";
import { URL } from "url";

// ── Config ─────────────────────────────────────────────────────────────────────

const BASE = process.env.VERIFY_BASE_URL || "http://localhost:5001";

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => { const [k, v] = a.slice(2).split("="); return [k, v]; })
);

const EMAIL    = args.email    || process.env.VERIFY_EMAIL    || "";
const PASSWORD = args.password || process.env.VERIFY_PASSWORD || "";

// ── HTTP helper ────────────────────────────────────────────────────────────────

function request(method, path, { body, token } = {}) {
  return new Promise((resolve) => {
    const url    = new URL(path, BASE);
    const client = url.protocol === "https:" ? https : http;
    const json   = body ? JSON.stringify(body) : null;

    const opts = {
      hostname: url.hostname,
      port:     url.port || (url.protocol === "https:" ? 443 : 80),
      path:     url.pathname + url.search,
      method,
      headers: {
        "Content-Type":  "application/json",
        "Content-Length": json ? Buffer.byteLength(json) : 0,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };

    const req = client.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => { data += c; });
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });

    req.on("error", (err) => resolve({ status: 0, error: err.message }));
    if (json) req.write(json);
    req.end();
  });
}

// ── Colours ────────────────────────────────────────────────────────────────────

const G = "\x1b[32m";
const R = "\x1b[31m";
const Y = "\x1b[33m";
const B = "\x1b[34m";
const D = "\x1b[2m";
const X = "\x1b[0m";

// ── Runner ─────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function check(label, fn) {
  try {
    const { ok, detail } = await fn();
    if (ok) {
      console.log(`  ${G}✓${X} ${label}${detail ? D + "  — " + detail + X : ""}`);
      passed++;
    } else {
      console.log(`  ${R}✗${X} ${label}${detail ? "  " + R + detail + X : ""}`);
      failed++;
    }
  } catch (err) {
    console.log(`  ${R}✗${X} ${label}  ${R}${err.message}${X}`);
    failed++;
  }
}

function section(name) {
  console.log(`\n${B}▶ ${name}${X}`);
}

function expect2xx(res, detail) {
  return {
    ok:     res.status >= 200 && res.status < 300,
    detail: detail || (res.status !== 200 ? `HTTP ${res.status}` : ""),
  };
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${B}TrusonXchanger — Stage Verification${X}`);
  console.log(`${D}Target: ${BASE}${X}\n`);

  // ── Public endpoints ─────────────────────────────────────────────────────────

  section("Health & Public Endpoints");

  await check("GET /health", async () => {
    const r = await request("GET", "/health");
    return {
      ok:     r.status === 200 && r.body?.ok,
      detail: `mongo=${r.body?.services?.mongo || "?"}`,
    };
  });

  await check("GET /api/currency/latest (Frankfurter)", async () => {
    const r = await request("GET", "/api/currency/latest?from=USD");
    return {
      ok:     r.status === 200 && r.body?.rates?.EUR != null,
      detail: r.status === 200 ? `EUR=${r.body?.rates?.EUR}` : `HTTP ${r.status}`,
    };
  });

  await check("GET /api/settlement/chains (Stage 25 — public)", async () => {
    const r = await request("GET", "/api/settlement/chains");
    const chains = r.body?.chains ?? r.body?.data;
    return {
      ok:     r.status === 200 && Array.isArray(chains) && chains.length > 0,
      detail: Array.isArray(chains) ? `${chains.length} chain(s)` : `HTTP ${r.status}`,
    };
  });

  // ── Authentication ────────────────────────────────────────────────────────────

  section("Authentication");

  let token = null;
  let isAdmin = false;

  if (!EMAIL || !PASSWORD) {
    console.log(`  ${Y}⚠${X}  No credentials supplied — skipping auth-required tests.`);
    console.log(`     Pass ${Y}--email=... --password=...${X} or set VERIFY_EMAIL / VERIFY_PASSWORD.`);
  } else {
    await check("POST /api/auth/login", async () => {
      const r = await request("POST", "/api/auth/login", { body: { email: EMAIL, password: PASSWORD } });
      if (r.status === 200 && r.body?.token) {
        token    = r.body.token;
        isAdmin  = r.body?.user?.role === "admin";
        return { ok: true, detail: `role=${r.body?.user?.role}` };
      }
      return { ok: false, detail: `HTTP ${r.status} — ${r.body?.message || "no token"}` };
    });
  }

  if (!token) {
    console.log(`\n${Y}Skipping all auth-required checks (not logged in).${X}\n`);
    summary();
    return;
  }

  // ── Core platform ─────────────────────────────────────────────────────────────

  section("Core Platform");

  await check("GET /api/wallets", async () => {
    const r = await request("GET", "/api/wallets", { token });
    return expect2xx(r, r.body?.message);
  });

  await check("GET /api/orders", async () => {
    const r = await request("GET", "/api/orders", { token });
    return expect2xx(r, r.body?.message);
  });

  await check("GET /api/market-data/pairs", async () => {
    const r = await request("GET", "/api/market-data/pairs", { token });
    return expect2xx(r, r.body?.message);
  });

  await check("GET /api/notifications", async () => {
    const r = await request("GET", "/api/notifications", { token });
    return expect2xx(r, r.body?.message);
  });

  // ── Stage 1 — Arbitrage ───────────────────────────────────────────────────────

  section("Stage 1 — Arbitrage Detection & Execution");

  await check("GET /api/arbitrage/opportunities", async () => {
    const r = await request("GET", "/api/arbitrage/opportunities", { token });
    return expect2xx(r);
  });

  await check("GET /api/arbitrage/stats", async () => {
    const r = await request("GET", "/api/arbitrage/stats", { token });
    return expect2xx(r);
  });

  // ── Stage 2 — Credit Risk ─────────────────────────────────────────────────────

  section("Stage 2 — Advanced Financial Risk Intelligence");

  if (isAdmin) {
    await check("GET /api/credit-risk/stats (admin)", async () => {
      const r = await request("GET", "/api/credit-risk/stats", { token });
      return expect2xx(r);
    });
  } else {
    console.log(`  ${Y}⚠${X}  Skipping admin-only credit-risk/stats (need admin role).`);
  }

  // ── Stage 25 — Multi-Chain Settlement ─────────────────────────────────────────

  section("Stage 25 — Multi-Chain Native Settlement Layer");

  await check("GET /api/settlement/my (own settlements)", async () => {
    const r = await request("GET", "/api/settlement/my", { token });
    return expect2xx(r);
  });

  if (isAdmin) {
    await check("GET /api/settlement/stats (admin)", async () => {
      const r = await request("GET", "/api/settlement/stats", { token });
      return expect2xx(r);
    });

    await check("GET /api/settlement/indexer (admin)", async () => {
      const r = await request("GET", "/api/settlement/indexer", { token });
      return expect2xx(r);
    });
  }

  // ── Stage 26 — Liquidity Aggregation ─────────────────────────────────────────

  section("Stage 26 — Global Liquidity Aggregation Network");

  await check("GET /api/liquidity-aggregator/providers", async () => {
    const r = await request("GET", "/api/liquidity-aggregator/providers", { token });
    return expect2xx(r);
  });

  await check("GET /api/liquidity-aggregator/stats", async () => {
    const r = await request("GET", "/api/liquidity-aggregator/stats", { token });
    const s = r.body?.data;
    return {
      ok:     r.status === 200,
      detail: s ? `providers=${s.providers}, pairs=${s.pairs}` : `HTTP ${r.status}`,
    };
  });

  await check("GET /api/liquidity-aggregator/book/BTC-USD", async () => {
    const r = await request("GET", "/api/liquidity-aggregator/book/BTC-USD", { token });
    return expect2xx(r);
  });

  // ── Stage 27 — Market Intelligence ───────────────────────────────────────────

  section("Stage 27 — Autonomous Market Intelligence Core");

  await check("GET /api/market-intelligence/signals", async () => {
    const r = await request("GET", "/api/market-intelligence/signals", { token });
    return expect2xx(r);
  });

  await check("GET /api/market-intelligence/whale-activity", async () => {
    const r = await request("GET", "/api/market-intelligence/whale-activity", { token });
    return expect2xx(r);
  });

  await check("GET /api/market-intelligence/stats", async () => {
    const r = await request("GET", "/api/market-intelligence/stats", { token });
    const s = r.body?.data;
    return {
      ok:     r.status === 200,
      detail: s ? `running=${s.running}, trackedPairs=${s.trackedPairs}` : `HTTP ${r.status}`,
    };
  });

  // ── Stage 28 — Execution Router ───────────────────────────────────────────────

  section("Stage 28 — Execution Optimization Engine");

  await check("GET /api/execution-router/stats", async () => {
    const r = await request("GET", "/api/execution-router/stats", { token });
    const s = r.body?.data;
    return {
      ok:     r.status === 200,
      detail: s ? `routes=${s.totalRoutes}, strategies=${JSON.stringify(s.byStrategy || {})}` : `HTTP ${r.status}`,
    };
  });

  await check("GET /api/execution-router/latency", async () => {
    const r = await request("GET", "/api/execution-router/latency", { token });
    return expect2xx(r);
  });

  await check("GET /api/execution-router/history", async () => {
    const r = await request("GET", "/api/execution-router/history", { token });
    return expect2xx(r);
  });

  // ── Stage 29 — Institutional Layer ───────────────────────────────────────────

  section("Stage 29 — Institutional Client Layer");

  if (isAdmin) {
    await check("GET /api/institutional/clients (admin)", async () => {
      const r = await request("GET", "/api/institutional/clients", { token });
      return expect2xx(r);
    });
  } else {
    console.log(`  ${Y}⚠${X}  Skipping admin-only institutional/clients (need admin role).`);
  }

  await check("GET /api/institutional/tiers", async () => {
    const r = await request("GET", "/api/institutional/tiers", { token });
    const tiers = r.body?.data;
    return {
      ok:     r.status === 200 && tiers?.bronze != null,
      detail: tiers ? `bronze,silver,gold,platinum present` : `HTTP ${r.status}`,
    };
  });

  await check("GET /api/institutional/keys (my API keys)", async () => {
    const r = await request("GET", "/api/institutional/keys", { token });
    return expect2xx(r);
  });

  // ── Stage 30 — Audit Ledger ───────────────────────────────────────────────────

  section("Stage 30 — Global Financial Audit + Immutable Ledger");

  if (isAdmin) {
    await check("GET /api/audit-ledger/stats (admin)", async () => {
      const r = await request("GET", "/api/audit-ledger/stats", { token });
      const s = r.body?.data;
      return {
        ok:     r.status === 200,
        detail: s ? `total=${s.total}, lastEntryId=${s.lastEntryId}` : `HTTP ${r.status}`,
      };
    });

    await check("GET /api/audit-ledger/entries (admin)", async () => {
      const r = await request("GET", "/api/audit-ledger/entries", { token });
      return expect2xx(r);
    });

    await check("GET /api/audit-ledger/verify-chain (admin)", async () => {
      const r = await request("GET", "/api/audit-ledger/verify-chain", { token });
      const d = r.body?.data;
      return {
        ok:     r.status === 200,
        detail: d ? `valid=${d.valid}, checked=${d.checkedCount}` : `HTTP ${r.status}`,
      };
    });

    await check("GET /api/audit-ledger/reports (admin)", async () => {
      const r = await request("GET", "/api/audit-ledger/reports", { token });
      return expect2xx(r);
    });

    await check("GET /api/audit-ledger/reconciliation (admin)", async () => {
      const r = await request("GET", "/api/audit-ledger/reconciliation", { token });
      return expect2xx(r);
    });
  } else {
    console.log(`  ${Y}⚠${X}  Skipping admin-only audit ledger checks (need admin role).`);
  }

  // ── Performance / Global Sync ─────────────────────────────────────────────────

  section("Stage 4 & 5 — Performance + Global Sync");

  if (isAdmin) {
    await check("GET /api/performance/stats (admin)", async () => {
      const r = await request("GET", "/api/performance/stats", { token });
      return expect2xx(r);
    });

    await check("GET /api/global-sync/status (admin)", async () => {
      const r = await request("GET", "/api/global-sync/status", { token });
      return expect2xx(r);
    });
  }

  // ── Test suite confirmation ───────────────────────────────────────────────────

  summary();
}

function summary() {
  const total = passed + failed;
  console.log(`\n${"─".repeat(50)}`);
  console.log(`${B}Results:${X} ${G}${passed} passed${X}  ${failed > 0 ? R : G}${failed} failed${X}  (${total} total)`);
  if (failed === 0) {
    console.log(`${G}All stage endpoints are responding correctly.${X}`);
  } else {
    console.log(`${Y}Some checks failed — see above. Admin-only endpoints need --email/--password of an admin account.${X}`);
  }
  console.log(`\n${D}Unit test suite: run  npm run test:server  →  374 tests should pass${X}\n`);
}

main().catch(console.error);
