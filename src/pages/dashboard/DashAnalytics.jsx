import { useState } from "react";
import { Navigate, Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore }   from "../../store/authStore";
import DashNavbar         from "../../Components/layout/DashNavbar";
import DashSidebar        from "../../Components/dashboard/DashSidebar";
import CoinLogo           from "../../Components/common/CoinLogo";
import {
  useInsightsQuery,
  usePatternsQuery,
} from "../../hooks/queries/useAnalyticsQueries.js";
import { analyticsApi }   from "../../services/api/analytics.js";
import { queryKeys }      from "../../api/queryKeys.js";
import "../../styles/dashboard.css";
import "../../styles/analytics.css";

// ── Formatters ────────────────────────────────────────────────────────────────

const fmt = (v, d = 2) =>
  Number(v || 0).toLocaleString("en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });

const fmtCompact = (v) => {
  const n = Math.abs(Number(v || 0));
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000)     return "$" + (n / 1_000).toFixed(2) + "K";
  return "$" + n.toFixed(2);
};

const pct = (v) => {
  const n = Number(v || 0);
  return (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
};

const sign = (v) => (Number(v) >= 0 ? "+" : "");

const pnlCls = (v) =>
  Number(v) > 0 ? "da-green" : Number(v) < 0 ? "da-red" : "";

const Arrow = ({ v }) =>
  Number(v) > 0 ? (
    <i className="bi bi-caret-up-fill" style={{ fontSize: "0.65em" }} />
  ) : Number(v) < 0 ? (
    <i className="bi bi-caret-down-fill" style={{ fontSize: "0.65em" }} />
  ) : null;

// ── Donut palette — same Binance-style accent colours ─────────────────────────

const PALETTE = [
  "#f0b90b","#3b82f6","#0ecb81","#f6465d","#a78bfa","#38bdf8","#fb923c",
];

// ── Allocation Donut (pure SVG, no external library) ─────────────────────────

const AllocationDonut = ({ holdings }) => {
  const [hovered, setHovered] = useState(null);
  if (!holdings?.length)
    return (
      <div className="dash-empty">
        <i className="bi bi-pie-chart dash-empty-icon" />
        <p className="dash-empty-text">No holdings to display yet.</p>
      </div>
    );

  const size = 168, cx = 84, cy = 84, r = 62, stroke = 24;
  const circ  = 2 * Math.PI * r;
  let   offset = 0;

  const slices = holdings.slice(0, 7).map((h, i) => {
    const pv   = Math.max(h.allocation, 0.5);
    const dash = (pv / 100) * circ;
    const s    = { ...h, dash, gap: circ - dash, offset, color: PALETTE[i % PALETTE.length] };
    offset    += dash;
    return s;
  });

  const total  = holdings.reduce((s, h) => s + h.valueUSDT, 0);
  const active = hovered !== null ? slices[hovered] : null;

  return (
    <div className="da-donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#2b2f36" strokeWidth={stroke} />
        {/* slices */}
        {slices.map((s, i) => (
          <circle
            key={s.asset}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={hovered === i ? stroke + 5 : stroke}
            strokeDasharray={`${s.dash} ${s.gap}`}
            strokeDashoffset={-s.offset}
            strokeLinecap="round"
            style={{
              transform: "rotate(-90deg)",
              transformOrigin: "50% 50%",
              cursor: "pointer",
              opacity: hovered === null || hovered === i ? 1 : 0.3,
              transition: "opacity 0.18s, stroke-width 0.18s",
            }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
        {/* centre label */}
        <text x={cx} y={cy - 9} textAnchor="middle" fontSize="10" fill="#474d57" fontWeight="700" letterSpacing="0.06em">
          {active ? active.asset : "TOTAL"}
        </text>
        <text x={cx} y={cy + 8} textAnchor="middle" fontSize="13" fontWeight="800" fill="#eaecef">
          {active ? `${active.allocation}%` : fmtCompact(total)}
        </text>
        {active && (
          <text x={cx} y={cy + 22} textAnchor="middle" fontSize="9.5" fill="#848e9c">
            ${fmt(active.valueUSDT)}
          </text>
        )}
      </svg>

      <div className="da-donut-legend">
        {slices.map((s, i) => (
          <div
            key={s.asset}
            className={`da-legend-row${hovered === i ? " da-legend-row--active" : ""}`}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className="da-legend-dot" style={{ background: s.color }} />
            <span className="da-legend-name">{s.asset}</span>
            <span className="da-legend-val">${fmt(s.valueUSDT)}</span>
            <span className="da-legend-pct">{s.allocation}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Technical signal card ─────────────────────────────────────────────────────

const SignalCard = ({ symbol }) => {
  const { data, isLoading } = usePatternsQuery(symbol);

  if (isLoading)
    return <div className="da-skeleton da-signal-card" style={{ minHeight: 90 }} />;

  if (!data || data.trend === "insufficient_data")
    return (
      <div className="da-signal-card">
        <div className="da-signal-head">
          <span className="da-signal-sym">{symbol}</span>
          <span className="da-badge da-badge--neutral">No candle data</span>
        </div>
      </div>
    );

  const trendCls =
    data.trend === "uptrend"   ? "da-badge--bull"  :
    data.trend === "downtrend" ? "da-badge--bear"  : "da-badge--neutral";

  const rsiCls =
    data.rsi !== null
      ? data.rsi < 30 ? "da-badge--bull" : data.rsi > 70 ? "da-badge--bear" : "da-badge--neutral"
      : "";

  return (
    <div className="da-signal-card">
      <div className="da-signal-head">
        <span className="da-signal-sym">{data.symbol}</span>
        <span className={`da-badge ${trendCls}`}>
          {data.trend === "uptrend" ? "▲ " : data.trend === "downtrend" ? "▼ " : ""}
          {data.trend}
        </span>
        {data.rsi !== null && (
          <span className={`da-badge ${rsiCls}`}>RSI {data.rsi}</span>
        )}
      </div>
      <div className="da-signal-metrics">
        {data.currentPrice && <span>Price <b>${fmt(data.currentPrice, 4)}</b></span>}
        {data.sma20        && <span>SMA20 <b>${fmt(data.sma20, 4)}</b></span>}
        {data.sma50        && <span>SMA50 <b>${fmt(data.sma50, 4)}</b></span>}
        {data.support      && <span>Support <b>${fmt(data.support, 4)}</b></span>}
        {data.resistance   && <span>Resist <b>${fmt(data.resistance, 4)}</b></span>}
        {data.volumeMultiplier > 1 && <span>Vol <b>×{data.volumeMultiplier}</b></span>}
      </div>
      {data.patterns.length > 0 && (
        <div className="da-signal-tags">
          {data.patterns.map((p, i) => (
            <span
              key={i}
              className={`da-badge ${p.severity === "bullish" ? "da-badge--bull" : p.severity === "bearish" ? "da-badge--bear" : "da-badge--neutral"}`}
            >
              {p.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

const DashAnalytics = () => {
  const navigate          = useNavigate();
  const qc                = useQueryClient();
  const { isAuthenticated } = useAuthStore();
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [activeTab, setActiveTab]       = useState("overview");
  const [generating, setGenerating]     = useState(false);
  const { data, isLoading, isError, refetch } = useInsightsQuery();

  const generateAI = async () => {
    setGenerating(true);
    try {
      const fresh = await analyticsApi.insights(true);
      qc.setQueryData(queryKeys.analytics.insights, fresh);
    } catch {
      refetch();
    } finally {
      setGenerating(false);
    }
  };

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const {
    portfolio      = { totalValueUSDT: 0, holdings: [], assetCount: 0 },
    pnl            = { realizedPnL: 0, unrealizedPnL: 0, totalPnL: 0, periods: {}, holdings: [], tradeCount: 0 },
    marketOverview = { topGainers: [], topLosers: [], byVolume: [], bullishCount: 0, bearishCount: 0, total: 0, sentiment: "neutral" },
    volumeAlerts   = [],
    patterns       = [],
    suggestions    = [],
    aiSummary,
    aiAvailable,
  } = data || {};

  const tabs = [
    { id: "overview",    label: "Overview",    icon: "bi-grid-1x2" },
    { id: "pnl",         label: "P&L",         icon: "bi-graph-up-arrow" },
    { id: "market",      label: "Market",      icon: "bi-bar-chart-line" },
    { id: "signals",     label: "Signals",     icon: "bi-activity" },
    { id: "ai",          label: "AI Insights", icon: "bi-stars" },
  ];

  return (
    <div className="dash-root">
      {/* ── Navbar ────────────────────────────────────────────────── */}
      <DashNavbar onMenuClick={() => setSidebarOpen((v) => !v)} />

      <div className="dash-body">
        {/* ── Sidebar ───────────────────────────────────────────── */}
        <DashSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onLogout={() => {
            useAuthStore.getState().logout();
            navigate("/login");
          }}
        />

        {/* ── Main content ──────────────────────────────────────── */}
        <main className="dash-main">

          {/* Page heading */}
          <div className="da-page-head">
            <div>
              <h1 className="da-page-title">Analytics &amp; Insights</h1>
              <p className="da-page-sub">
                Real-time portfolio intelligence
                {aiAvailable ? (
                  <span className="da-ai-badge">
                    <i className="bi bi-stars" /> AI Active
                  </span>
                ) : (
                  <span className="da-ai-badge da-ai-badge--off">
                    <i className="bi bi-slash-circle" /> AI Offline
                  </span>
                )}
              </p>
            </div>
            <button
              className="dash-refresh-btn"
              onClick={() => refetch()}
              title="Refresh analytics"
            >
              <i className="bi bi-arrow-clockwise" /> Refresh
            </button>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="da-loading">
              <div className="da-spinner" />
              <p style={{ fontSize: "0.85rem" }}>Analysing your portfolio…</p>
            </div>
          )}

          {/* Error */}
          {!isLoading && isError && (
            <div className="dash-error-banner">
              <i className="bi bi-exclamation-triangle-fill" />
              Failed to load analytics. Please restart the server if this keeps happening.
              <button className="dash-error-retry" onClick={() => refetch()}>
                <i className="bi bi-arrow-clockwise" /> Retry
              </button>
            </div>
          )}

          {/* ── KPI strip (always visible when data loaded) ──────── */}
          {!isLoading && data && (
            <>
              <div className="da-kpi-strip">
                <div className="dash-stat-card">
                  <div className="dash-stat-label">Portfolio Value</div>
                  <div className="dash-stat-value">${fmtCompact(portfolio.totalValueUSDT).replace("$","")}</div>
                  <div className="dash-stat-sub">${fmt(portfolio.totalValueUSDT)} USDT</div>
                </div>
                <div className="dash-stat-card">
                  <div className="dash-stat-label">Total P&L</div>
                  <div className={`dash-stat-value ${pnlCls(pnl.totalPnL)}`}>
                    {sign(pnl.totalPnL)}${fmt(Math.abs(pnl.totalPnL))}
                  </div>
                  <div className="dash-stat-sub">
                    <span className={pnlCls(pnl.unrealizedPnL)}>
                      Unrealized {sign(pnl.unrealizedPnL)}${fmt(Math.abs(pnl.unrealizedPnL))}
                    </span>
                  </div>
                </div>
                <div className="dash-stat-card">
                  <div className="dash-stat-label">Today's P&L</div>
                  <div className={`dash-stat-value ${pnlCls(pnl.periods?.today)}`}>
                    {sign(pnl.periods?.today || 0)}${fmt(Math.abs(pnl.periods?.today || 0))}
                  </div>
                  <div className="dash-stat-sub">
                    Week: <span className={pnlCls(pnl.periods?.week)}>
                      {sign(pnl.periods?.week || 0)}${fmt(Math.abs(pnl.periods?.week || 0))}
                    </span>
                  </div>
                </div>
                <div className="dash-stat-card">
                  <div className="dash-stat-label">Market Sentiment</div>
                  <div className={`dash-stat-value ${marketOverview.sentiment === "bullish" ? "da-green" : "da-red"}`}>
                    {marketOverview.sentiment === "bullish" ? "BULLISH" : "BEARISH"}
                  </div>
                  <div className="dash-stat-sub">
                    {marketOverview.bullishCount} / {marketOverview.total} pairs up
                  </div>
                </div>
              </div>

              {/* ── Tabs ────────────────────────────────────────────── */}
              <div className="da-tabs">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    className={`da-tab${activeTab === t.id ? " da-tab--active" : ""}`}
                    onClick={() => setActiveTab(t.id)}
                  >
                    <i className={`bi ${t.icon}`} />{t.label}
                  </button>
                ))}
              </div>

              {/* ══ OVERVIEW ═══════════════════════════════════════════ */}
              {activeTab === "overview" && (
                <div className="da-grid">

                  {/* Allocation donut */}
                  <div className="dash-section">
                    <div className="dash-section-head">
                      <span className="dash-section-title">
                        <i className="bi bi-pie-chart-fill da-gold" style={{ marginRight: 7 }} />
                        Allocation
                      </span>
                      <span className="dash-stat-sub">{portfolio.assetCount} assets</span>
                    </div>
                    <AllocationDonut holdings={portfolio.holdings} />
                  </div>

                  {/* Holdings table */}
                  <div className="dash-section da-col-wide">
                    <div className="dash-section-head">
                      <span className="dash-section-title">
                        <i className="bi bi-list-columns-reverse da-gold" style={{ marginRight: 7 }} />
                        Holdings
                      </span>
                      <Link to="/Dashboard/trade" className="dash-section-link">
                        Trade <i className="bi bi-arrow-right" />
                      </Link>
                    </div>

                    {portfolio.holdings?.length ? (
                      <div className="dash-asset-table-wrap">
                        <table className="dash-asset-table">
                          <thead>
                            <tr>
                              <th>Asset</th>
                              <th>Amount</th>
                              <th>Price</th>
                              <th>Value (USDT)</th>
                              <th className="da-alloc-cell">Allocation</th>
                            </tr>
                          </thead>
                          <tbody>
                            {portfolio.holdings.map((h) => (
                              <tr key={h.asset}>
                                <td>
                                  <div className="dash-asset-coin">
                                    <CoinLogo symbol={h.asset} size={36} />
                                    <div>
                                      <div className="dash-asset-name">{h.asset}</div>
                                      <div className="dash-asset-full">
                                        Avail: {fmt(h.available, 6)}
                                        {h.locked > 0 && <> · Locked: {fmt(h.locked, 6)}</>}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="dash-asset-bal">{fmt(h.amount, 6)}</td>
                                <td className="dash-asset-muted">${fmt(h.priceUSDT, 4)}</td>
                                <td className="dash-asset-usd"><strong>${fmt(h.valueUSDT)}</strong></td>
                                <td className="da-alloc-cell">
                                  <div className="da-bar-wrap">
                                    <div className="da-bar-track">
                                      <div className="da-bar-fill" style={{ width: `${Math.min(h.allocation, 100)}%` }} />
                                    </div>
                                    <span className="da-bar-pct">{h.allocation}%</span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="dash-empty">
                        <i className="bi bi-wallet2 dash-empty-icon" />
                        <p className="dash-empty-text">No holdings yet. <Link to="/Dashboard/trade">Start trading</Link>.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ══ P&L ════════════════════════════════════════════════ */}
              {activeTab === "pnl" && (
                <div className="da-grid">

                  <div className="dash-section">
                    <div className="dash-section-head">
                      <span className="dash-section-title">
                        <i className="bi bi-calendar3 da-gold" style={{ marginRight: 7 }} />
                        Realized P&L by Period
                      </span>
                    </div>
                    {[
                      { label: "Today",      icon: "bi-sun",           v: pnl.periods?.today  },
                      { label: "This Week",  icon: "bi-calendar-week", v: pnl.periods?.week   },
                      { label: "This Month", icon: "bi-calendar-month",v: pnl.periods?.month  },
                      { label: "All Time",   icon: "bi-infinity",      v: pnl.realizedPnL     },
                    ].map((r) => (
                      <div key={r.label} className="da-pnl-row">
                        <span className="da-pnl-label">
                          <i className={`bi ${r.icon}`} />{r.label}
                        </span>
                        <span className={`da-pnl-val ${pnlCls(r.v)}`}>
                          <Arrow v={r.v} />
                          {sign(r.v || 0)}${fmt(Math.abs(r.v || 0))}
                        </span>
                      </div>
                    ))}

                    <div className="da-kpi-row">
                      <div className="da-kpi">
                        <span className="da-kpi-lbl">Closed Trades</span>
                        <span className="da-kpi-val">{pnl.tradeCount}</span>
                      </div>
                      <div className="da-kpi">
                        <span className="da-kpi-lbl">Total P&L</span>
                        <span className={`da-kpi-val ${pnlCls(pnl.totalPnL)}`}>
                          <Arrow v={pnl.totalPnL} />
                          {sign(pnl.totalPnL)}${fmt(Math.abs(pnl.totalPnL))}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="dash-section">
                    <div className="dash-section-head">
                      <span className="dash-section-title">
                        <i className="bi bi-hourglass-split da-gold" style={{ marginRight: 7 }} />
                        Unrealized P&L
                      </span>
                    </div>
                    {pnl.holdings?.length ? (
                      pnl.holdings.map((h) => (
                        <div key={h.asset} className="da-ur-row">
                          <div className="da-ur-asset">{h.asset}</div>
                          <div className="da-ur-detail">
                            <span>Avg <strong>${fmt(h.avgCost, 4)}</strong></span>
                            <span>Now <strong>${fmt(h.currentPrice, 4)}</strong></span>
                            <span className={pnlCls(h.pnlPct)}>{pct(h.pnlPct)}</span>
                          </div>
                          <div className={`da-ur-pnl ${pnlCls(h.unrealizedPnL)}`}>
                            <Arrow v={h.unrealizedPnL} />
                            {sign(h.unrealizedPnL)}${fmt(Math.abs(h.unrealizedPnL))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="dash-empty">
                        <i className="bi bi-bar-chart dash-empty-icon" />
                        <p className="dash-empty-text">No positions with trade history found.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ══ MARKET ═════════════════════════════════════════════ */}
              {activeTab === "market" && (
                <div className="da-grid">

                  {/* Sentiment */}
                  <div className="dash-section da-col-wide">
                    <div className="dash-section-head">
                      <span className="dash-section-title">
                        <i className="bi bi-thermometer-half da-gold" style={{ marginRight: 7 }} />
                        Market Sentiment
                      </span>
                      <span className="dash-stat-sub">{marketOverview.total} pairs</span>
                    </div>
                    <div className="da-sentiment">
                      <span className="da-sentiment-lbl-l">
                        <i className="bi bi-caret-up-fill" /> {marketOverview.bullishCount} Bullish
                      </span>
                      <div className="da-sentiment-track">
                        <div
                          className="da-sentiment-fill"
                          style={{
                            width: marketOverview.total > 0
                              ? `${(marketOverview.bullishCount / marketOverview.total) * 100}%`
                              : "50%",
                          }}
                        />
                      </div>
                      <span className="da-sentiment-lbl-r">
                        {marketOverview.bearishCount} Bearish <i className="bi bi-caret-down-fill" />
                      </span>
                    </div>
                    <p className="da-sentiment-note">
                      Overall:&nbsp;
                      <strong className={marketOverview.sentiment === "bullish" ? "da-green" : "da-red"}>
                        {marketOverview.sentiment?.toUpperCase()}
                      </strong>
                    </p>
                  </div>

                  {/* Top Gainers */}
                  <div className="dash-section">
                    <div className="dash-section-head">
                      <span className="dash-section-title">
                        <i className="bi bi-rocket-takeoff-fill da-green" style={{ marginRight: 7 }} />
                        Top Gainers
                      </span>
                    </div>
                    {marketOverview.topGainers?.length ? marketOverview.topGainers.map((t, i) => (
                      <div key={t.symbol} className="da-ticker-row">
                        <span className="da-ticker-rank">{i + 1}</span>
                        <span className="da-ticker-sym">{t.symbol}</span>
                        <span className="da-ticker-price">${fmt(t.price, 4)}</span>
                        <span className="da-ticker-chg da-green">
                          <i className="bi bi-caret-up-fill" style={{ fontSize: "0.65em" }} />
                          {pct(t.change24h)}
                        </span>
                      </div>
                    )) : <div className="dash-empty"><p className="dash-empty-text">No market data yet.</p></div>}
                  </div>

                  {/* Top Losers */}
                  <div className="dash-section">
                    <div className="dash-section-head">
                      <span className="dash-section-title">
                        <i className="bi bi-arrow-down-circle-fill da-red" style={{ marginRight: 7 }} />
                        Top Losers
                      </span>
                    </div>
                    {marketOverview.topLosers?.length ? marketOverview.topLosers.map((t, i) => (
                      <div key={t.symbol} className="da-ticker-row">
                        <span className="da-ticker-rank">{i + 1}</span>
                        <span className="da-ticker-sym">{t.symbol}</span>
                        <span className="da-ticker-price">${fmt(t.price, 4)}</span>
                        <span className="da-ticker-chg da-red">
                          <i className="bi bi-caret-down-fill" style={{ fontSize: "0.65em" }} />
                          {pct(t.change24h)}
                        </span>
                      </div>
                    )) : <div className="dash-empty"><p className="dash-empty-text">No market data yet.</p></div>}
                  </div>

                  {/* Volume Leaders */}
                  <div className="dash-section">
                    <div className="dash-section-head">
                      <span className="dash-section-title">
                        <i className="bi bi-water da-gold" style={{ marginRight: 7 }} />
                        Volume Leaders
                      </span>
                    </div>
                    {marketOverview.byVolume?.map((t, i) => (
                      <div key={t.symbol} className="da-ticker-row">
                        <span className="da-ticker-rank">{i + 1}</span>
                        <span className="da-ticker-sym">{t.symbol}</span>
                        <span className="da-ticker-vol">{fmtCompact(t.volumeUSDT)}</span>
                        <span className={`da-ticker-chg ${pnlCls(t.change24h)}`}>
                          <Arrow v={t.change24h} />{pct(t.change24h)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Volume spike alerts */}
                  {volumeAlerts?.length > 0 && (
                    <div className="dash-section da-col-wide">
                      <div className="dash-section-head">
                        <span className="dash-section-title">
                          <i className="bi bi-lightning-charge-fill da-gold" style={{ marginRight: 7 }} />
                          Volume Spike Alerts
                        </span>
                        <span className="dash-stat-sub">{volumeAlerts.length} detected</span>
                      </div>
                      {volumeAlerts.map((a) => (
                        <div key={a.symbol} className={`da-alert da-alert--${a.severity}`}>
                          <span className="da-alert-sym">{a.symbol}</span>
                          <span className="da-alert-txt">
                            Volume <strong>×{a.multiplier}</strong> above the 24-hour average
                          </span>
                          <span className={`da-ticker-chg ${pnlCls(a.change24h)}`} style={{ minWidth: "4.5rem", justifyContent: "flex-end", fontSize: "0.82rem", fontWeight: 700 }}>
                            <Arrow v={a.change24h} />{pct(a.change24h)}
                          </span>
                          <span className={`da-badge da-badge--${a.severity}`}>{a.severity}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ══ SIGNALS ════════════════════════════════════════════ */}
              {activeTab === "signals" && (
                <div className="da-grid">
                  {patterns?.length > 0 && (
                    <div className="dash-section da-col-wide">
                      <div className="dash-section-head">
                        <span className="dash-section-title">
                          <i className="bi bi-person-fill da-gold" style={{ marginRight: 7 }} />
                          Your Holdings — Technical Analysis
                        </span>
                      </div>
                      {patterns.map((p) => (
                        <SignalCard key={p.symbol} symbol={p.symbol} />
                      ))}
                    </div>
                  )}

                  <div className="dash-section da-col-wide">
                    <div className="dash-section-head">
                      <span className="dash-section-title">
                        <i className="bi bi-broadcast da-gold" style={{ marginRight: 7 }} />
                        Live Pair Signals
                      </span>
                    </div>
                    {["BTCUSDT", "ETHUSDT", "BNBUSDT"].map((sym) => (
                      <SignalCard key={sym} symbol={sym} />
                    ))}
                  </div>
                </div>
              )}

              {/* ══ AI INSIGHTS ════════════════════════════════════════ */}
              {activeTab === "ai" && (
                <div className="da-grid">

                  {/* Claude narrative */}
                  <div className="dash-section da-col-wide">
                    <div className="dash-section-head">
                      <span className="dash-section-title">
                        <i className="bi bi-stars da-gold" style={{ marginRight: 7 }} />
                        AI Portfolio Analysis
                      </span>
                      {!aiAvailable && (
                        <span className="da-ai-badge da-ai-badge--off">
                          Add ANTHROPIC_API_KEY to .env to activate
                        </span>
                      )}
                    </div>

                    {aiSummary ? (
                      <>
                        <div className="da-ai-panel">
                          {aiSummary.split("\n").filter(Boolean).map((line, i) => (
                            <p key={i} className={line.startsWith("•") ? "da-ai-bullet" : ""}>{line}</p>
                          ))}
                        </div>
                        <div style={{ marginTop: "0.85rem", display: "flex", justifyContent: "flex-end" }}>
                          <button
                            className="dash-refresh-btn"
                            onClick={generateAI}
                            disabled={generating}
                          >
                            {generating
                              ? <><span className="da-spinner" style={{ width: 14, height: 14, borderWidth: 2, display: "inline-block", marginRight: 6 }} />Generating…</>
                              : <><i className="bi bi-arrow-clockwise" /> Regenerate</>
                            }
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="da-ai-empty">
                        <i className="bi bi-stars" />
                        {aiAvailable ? (
                          <>
                            <p>
                              AI is ready. Click the button below to generate your personalised portfolio analysis.
                              {!generating && " This may take up to 10 seconds."}
                            </p>
                            <button
                              className="dash-btn dash-btn--primary"
                              style={{ marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.4rem" }}
                              onClick={generateAI}
                              disabled={generating}
                            >
                              {generating ? (
                                <><span className="da-spinner" style={{ width: 14, height: 14, borderWidth: 2, display: "inline-block" }} /> Generating…</>
                              ) : (
                                <><i className="bi bi-stars" /> Generate AI Analysis</>
                              )}
                            </button>
                          </>
                        ) : (
                          <p>
                            To enable AI analysis, open your <code>.env</code> file and add your key:<br />
                            <code>ANTHROPIC_API_KEY=sk-ant-api03-…</code><br />
                            Get a free key at <strong>console.anthropic.com</strong>, then restart the server.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Smart suggestions */}
                  {suggestions?.length > 0 && (
                    <div className="dash-section da-col-wide">
                      <div className="dash-section-head">
                        <span className="dash-section-title">
                          <i className="bi bi-lightbulb-fill da-gold" style={{ marginRight: 7 }} />
                          Smart Suggestions
                        </span>
                        <span className="dash-stat-sub">{suggestions.length} recommendations</span>
                      </div>
                      <div className="da-sugg-list">
                        {suggestions.map((s, i) => (
                          <div key={i} className={`da-sugg da-sugg--${s.priority}`}>
                            <div className="da-sugg-icon">
                              <i className={`bi ${s.icon}`} />
                            </div>
                            <div className="da-sugg-body">
                              <div className="da-sugg-title">
                                {s.title}
                                <span className={`da-badge da-badge--${s.priority}`}>
                                  {s.priority}
                                </span>
                              </div>
                              <p className="da-sugg-desc">{s.description}</p>
                            </div>
                            <Link to={s.link} className="dash-trade-link" style={{ flexShrink: 0 }}>
                              {s.action}
                            </Link>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!suggestions?.length && !aiSummary && (
                    <div className="dash-section da-col-wide">
                      <div className="dash-empty">
                        <i className="bi bi-bar-chart-steps dash-empty-icon" />
                        <p className="dash-empty-text">
                          Trade more to unlock personalised AI suggestions and portfolio analysis.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default DashAnalytics;
