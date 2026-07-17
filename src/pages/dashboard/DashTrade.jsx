import { useState, useMemo, Suspense, lazy } from "react";
import { Navigate, useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import {
  useCancelOrderMutation,
  useCreateOCOOrderMutation,
  useCreateOrderMutation,
  useOpenOrdersQuery,
  useOrderHistoryQuery,
} from "../../hooks/queries/useOrderQueries";
import { useOrderSocket } from "../../hooks/useOrderSocket";
import { useMyWalletsQuery } from "../../hooks/queries/useWalletQueries";
import { useSupportedAssets } from "../../hooks/queries/useAssetsQuery";
import { useLiveMarketStore } from "../../store/liveMarketStore";
import { useMarketSocket } from "../../hooks/useMarketSocket";
import { useTradeMarketStateQuery, useTradingPairsQuery } from "../../hooks/queries/useTradeQueries";
import { useTradeSocket } from "../../hooks/useTradeSocket";
import DashNavbar from "../../Components/layout/DashNavbar";
import DashSidebar from "../../Components/dashboard/DashSidebar";
import "../../styles/dashboard.css";

const AdvancedRealTimeChart = lazy(() =>
  import("react-ts-tradingview-widgets").then((m) => ({ default: m.AdvancedRealTimeChart }))
);

// ── Helpers ───────────────────────────────────────────────────────────────────

const USD = new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD",
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const fmtN    = (n, d = 6) => Number.isFinite(+n) ? (+n).toFixed(d) : "—";
const fmtPct  = (n) => { const v = Number(n ?? 0); return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`; };
const fmtDate = (d) => {
  try { return new Date(d).toLocaleString([], { dateStyle: "short", timeStyle: "short" }); }
  catch { return "—"; }
};

const QUOTE_ASSETS = ["USDT", "BTC", "ETH"];
const STABLES      = new Set(["USDT", "USDC"]);

const STATUS_CFG = {
  open:             { color: "#0ecb81", bg: "rgba(14,203,129,0.12)",   label: "OPEN"             },
  partially_filled: { color: "#f0b90b", bg: "rgba(240,185,11,0.12)",   label: "PARTIAL"          },
  filled:           { color: "#636d77", bg: "rgba(99,109,119,0.12)",   label: "FILLED"           },
  cancelled:        { color: "#f6465d", bg: "rgba(246,70,93,0.12)",    label: "CANCELLED"        },
};

// ── Shared small components ───────────────────────────────────────────────────

const Shimmer = ({ h = 14, w = "100%", r = 5 }) => (
  <span className="db-shimmer" style={{ height: h, width: w, borderRadius: r, display: "block" }} />
);

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CFG[status] || STATUS_CFG.cancelled;
  return (
    <span className="dt-status" style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30` }}>
      {cfg.label}
    </span>
  );
};

const SideBadge = ({ side }) => (
  <span className={`dt-side dt-side--${side}`}>{(side || "—").toUpperCase()}</span>
);

// ── Pair Selector ─────────────────────────────────────────────────────────────

const PairSelector = ({ pairs, activeSymbol, onSelect }) => {
  const [q, setQ] = useState("");
  const [quoteFilter, setQuoteFilter] = useState("USDT");

  const filtered = useMemo(() => {
    const byQuote = pairs.filter(p => p.quote === quoteFilter);
    if (!q.trim()) return byQuote;
    const lq = q.toLowerCase();
    return byQuote.filter(p =>
      p.symbol.toLowerCase().includes(lq) || p.baseName?.toLowerCase().includes(lq)
    );
  }, [pairs, quoteFilter, q]);

  return (
    <div className="dt-pairs-panel">
      <div className="dt-pairs-head">
        <div className="dt-pairs-search">
          <i className="bi bi-search dt-pairs-ico" />
          <input
            className="dt-pairs-inp"
            placeholder="Search pair…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
        <div className="dt-quote-tabs">
          {QUOTE_ASSETS.map(qa => (
            <button
              key={qa}
              className={`dt-qtab${quoteFilter === qa ? " dt-qtab--on" : ""}`}
              onClick={() => setQuoteFilter(qa)}
            >{qa}</button>
          ))}
        </div>
      </div>
      <div className="dt-pairs-list">
        {filtered.length === 0
          ? <div className="dt-pairs-empty">No pairs found</div>
          : filtered.map(p => (
            <button
              key={p.symbol}
              className={`dt-pair-item${activeSymbol === p.symbol ? " dt-pair-item--on" : ""}`}
              onClick={() => onSelect(p.symbol)}
            >
              <span className="dt-pair-sym">{p.base}<span className="dt-pair-q">/{p.quote}</span></span>
            </button>
          ))
        }
      </div>
    </div>
  );
};

// ── Ticker Bar ────────────────────────────────────────────────────────────────

const QUOTE_RE = new RegExp(`^(.+?)(${QUOTE_ASSETS.join("|")})$`);

const TickerBar = ({ symbol, tickers, assets }) => {
  const pair   = symbol.match(QUOTE_RE) || [];
  const base   = pair[1] || symbol;
  const quote  = pair[2] || "";
  const ticker = tickers?.[symbol] || {};
  const meta   = assets?.find?.(a => a.symbol === base) || {};

  const price     = ticker.lastPrice    || meta.price || 0;
  const change    = ticker.priceChangePct || 0;
  const high      = ticker.high24h      || 0;
  const low       = ticker.low24h       || 0;
  const vol       = ticker.volume24h    || ticker.quoteVolume24h || 0;
  const isUp      = Number(change) >= 0;

  return (
    <div className="dt-ticker">
      <div className="dt-ticker-pair">
        <span className="dt-ticker-sym">{base}</span>
        <span className="dt-ticker-q">/{quote}</span>
      </div>
      <div className="dt-ticker-price" style={{ color: isUp ? "#0ecb81" : "#f6465d" }}>
        {price ? fmtN(price, 2) : "—"}
      </div>
      <div className="dt-ticker-stat">
        <span className="dt-ticker-stat-label">24h Change</span>
        <span className={`dt-ticker-stat-val ${isUp ? "dt-up" : "dt-dn"}`}>{fmtPct(change)}</span>
      </div>
      <div className="dt-ticker-stat">
        <span className="dt-ticker-stat-label">24h High</span>
        <span className="dt-ticker-stat-val">{high ? fmtN(high, 2) : "—"}</span>
      </div>
      <div className="dt-ticker-stat">
        <span className="dt-ticker-stat-label">24h Low</span>
        <span className="dt-ticker-stat-val">{low ? fmtN(low, 2) : "—"}</span>
      </div>
      <div className="dt-ticker-stat dt-ticker-stat--hide-sm">
        <span className="dt-ticker-stat-label">24h Volume</span>
        <span className="dt-ticker-stat-val">{vol ? fmtN(vol, 2) : "—"} {quote}</span>
      </div>
    </div>
  );
};

// ── Order Form ────────────────────────────────────────────────────────────────

// ── Order type configuration ───────────────────────────────────────────────────

const ORDER_TYPES = [
  { id: "limit",        label: "Limit",    icon: "bi-list-check"      },
  { id: "market",       label: "Market",   icon: "bi-lightning-charge" },
  { id: "stop_limit",   label: "Stop",     icon: "bi-shield-exclamation" },
  { id: "oco",          label: "OCO",      icon: "bi-arrows-collapse"  },
  { id: "trailing_stop",label: "Trailing", icon: "bi-arrow-repeat"     },
];

// ── Number input helper ────────────────────────────────────────────────────────

const NumInput = ({ label, unit, value, onChange, placeholder = "0.00" }) => (
  <div className="dt-field">
    <div className="dt-flabel-row">
      <label className="dt-flabel">{label}</label>
      <span className="dt-flabel-unit">{unit}</span>
    </div>
    <input
      type="number" className="dt-inp"
      placeholder={placeholder} min="0" step="any"
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  </div>
);

// ── Advanced OrderForm ─────────────────────────────────────────────────────────

const OrderForm = ({ wallets, activeSymbol }) => {
  const pair = useMemo(() => {
    const m = activeSymbol.match(/^(.+?)(USDT|BTC|ETH)$/);
    return m ? { base: m[1], quote: m[2] } : { base: activeSymbol.slice(0, -4), quote: activeSymbol.slice(-4) };
  }, [activeSymbol]);

  const quoteWallet = wallets.find(w => w.asset === pair.quote);
  const baseWallet  = wallets.find(w => w.asset === pair.base);

  const [side,           setSide]          = useState("buy");
  const [orderType,      setOrderType]     = useState("limit");
  const [price,          setPrice]         = useState("");
  const [amount,         setAmount]        = useState("");
  const [stopPrice,      setStopPrice]     = useState("");
  const [stopLimitPrice, setStopLimitPrice]= useState("");
  const [trailPct,       setTrailPct]      = useState("");
  const [feedback,       setFeedback]      = useState(null);

  const mutation    = useCreateOrderMutation();
  const ocoMutation = useCreateOCOOrderMutation();

  const availableQuote = quoteWallet?.available ?? 0;
  const availableBase  = baseWallet?.available  ?? 0;
  const available      = side === "buy" ? availableQuote : availableBase;
  const availAsset     = side === "buy" ? pair.quote     : pair.base;

  const numPrice  = parseFloat(price)  || 0;
  const numAmount = parseFloat(amount) || 0;
  const total     = orderType === "market" ? 0 : numPrice * numAmount;

  const resetFields = () => {
    setPrice(""); setAmount(""); setStopPrice(""); setStopLimitPrice(""); setTrailPct("");
    setFeedback(null);
  };

  const applyPct = (pct) => {
    if (side === "buy") {
      // Market orders have no price to divide by — disable % shortcut for buys
      if (orderType === "market") return;
      const refPrice = numPrice || parseFloat(stopPrice) || 0;
      if (!refPrice) return;
      setAmount(fmtN((availableQuote * pct) / refPrice, 6));
    } else {
      setAmount(fmtN(availableBase * pct, 6));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback(null);

    const numStop      = parseFloat(stopPrice)      || 0;
    const numStopLimit = parseFloat(stopLimitPrice) || 0;
    const numTrail     = parseFloat(trailPct)       || 0;

    // Client-side validation
    if (!numAmount || numAmount <= 0) {
      setFeedback({ t: "err", msg: "Enter a valid amount." }); return;
    }
    if (orderType === "limit" && (!numPrice || numPrice <= 0)) {
      setFeedback({ t: "err", msg: "Enter a valid limit price." }); return;
    }
    if (orderType === "stop_limit") {
      if (!numStop || numStop <= 0)      { setFeedback({ t: "err", msg: "Enter a stop price." });       return; }
      if (!numPrice || numPrice <= 0)    { setFeedback({ t: "err", msg: "Enter a limit price." });      return; }
    }
    if (orderType === "oco") {
      if (!numPrice || numPrice <= 0)    { setFeedback({ t: "err", msg: "Enter the limit price." });     return; }
      if (!numStop  || numStop  <= 0)    { setFeedback({ t: "err", msg: "Enter the stop price." });      return; }
      if (!numStopLimit || numStopLimit <= 0) { setFeedback({ t: "err", msg: "Enter the stop-limit price." }); return; }
    }
    if (orderType === "trailing_stop") {
      if (!numTrail || numTrail <= 0)    { setFeedback({ t: "err", msg: "Enter a trailing percentage." }); return; }
    }

    const payload = {
      symbol:    activeSymbol,
      side,
      orderType,
      amount:    numAmount,
      ...(orderType !== "market" && orderType !== "trailing_stop" && { price: numPrice }),
      ...((orderType === "stop_limit" || orderType === "oco") && { stopPrice: numStop }),
      ...(orderType === "oco"          && { stopLimitPrice: numStopLimit }),
      ...(orderType === "trailing_stop" && { trailPercent: numTrail }),
    };

    try {
      if (orderType === "oco") {
        await ocoMutation.mutateAsync(payload);
      } else {
        await mutation.mutateAsync(payload);
      }
      setFeedback({ t: "ok", msg: `${orderType.replace("_", "-").toUpperCase()} ${side.toUpperCase()} order placed.` });
      resetFields();
    } catch (err) {
      setFeedback({ t: "err", msg: err?.message || "Order failed. Please try again." });
    }
  };

  const isBuy = side === "buy";

  return (
    <div className="dt-form-card">
      {/* BUY / SELL tabs */}
      <div className="dt-side-tabs">
        <button
          className={`dt-side-tab${isBuy ? " dt-side-tab--buy" : ""}`}
          onClick={() => { setSide("buy"); resetFields(); }}
        >BUY</button>
        <button
          className={`dt-side-tab${!isBuy ? " dt-side-tab--sell" : ""}`}
          onClick={() => { setSide("sell"); resetFields(); }}
        >SELL</button>
      </div>

      {/* Order type selector */}
      <div className="dt-order-types">
        {ORDER_TYPES.map(ot => (
          <button
            key={ot.id}
            type="button"
            className={`dt-ot-btn${orderType === ot.id ? " dt-ot-btn--active" : ""}`}
            onClick={() => { setOrderType(ot.id); resetFields(); }}
            title={ot.label}
          >
            <i className={`bi ${ot.icon}`} />
            <span>{ot.label}</span>
          </button>
        ))}
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`dt-alert dt-alert--${feedback.t === "ok" ? "ok" : "err"}`}>
          <i className={`bi bi-${feedback.t === "ok" ? "check-circle-fill" : "exclamation-circle-fill"}`} />
          {feedback.msg}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>

        {/* ── LIMIT ── */}
        {orderType === "limit" && <>
          <NumInput label="Price" unit={pair.quote} value={price} onChange={v => { setPrice(v); setFeedback(null); }} />
          <NumInput label="Amount" unit={pair.base} value={amount} onChange={v => { setAmount(v); setFeedback(null); }} placeholder="0.00000000" />
        </>}

        {/* ── MARKET ── */}
        {orderType === "market" && <>
          <div className="dt-market-note">
            <i className="bi bi-info-circle" /> Order fills at the best available price.
          </div>
          <NumInput label="Amount" unit={pair.base} value={amount} onChange={v => { setAmount(v); setFeedback(null); }} placeholder="0.00000000" />
        </>}

        {/* ── STOP-LIMIT ── */}
        {orderType === "stop_limit" && <>
          <div className="dt-order-hint">
            When the market hits the <b>Stop Price</b>, a limit order is placed at the <b>Limit Price</b>.
          </div>
          <NumInput label="Stop Price" unit={pair.quote} value={stopPrice} onChange={v => { setStopPrice(v); setFeedback(null); }} />
          <NumInput label="Limit Price" unit={pair.quote} value={price} onChange={v => { setPrice(v); setFeedback(null); }} />
          <NumInput label="Amount" unit={pair.base} value={amount} onChange={v => { setAmount(v); setFeedback(null); }} placeholder="0.00000000" />
        </>}

        {/* ── OCO ── */}
        {orderType === "oco" && <>
          <div className="dt-order-hint">
            Places two orders simultaneously. When one fills, the other is automatically cancelled.
          </div>
          <NumInput
            label={side === "sell" ? "Take-Profit Price" : "Limit Price"}
            unit={pair.quote} value={price}
            onChange={v => { setPrice(v); setFeedback(null); }}
          />
          <NumInput label="Stop Price" unit={pair.quote} value={stopPrice} onChange={v => { setStopPrice(v); setFeedback(null); }} />
          <NumInput label="Stop-Limit Price" unit={pair.quote} value={stopLimitPrice} onChange={v => { setStopLimitPrice(v); setFeedback(null); }} />
          <NumInput label="Amount" unit={pair.base} value={amount} onChange={v => { setAmount(v); setFeedback(null); }} placeholder="0.00000000" />
        </>}

        {/* ── TRAILING STOP ── */}
        {orderType === "trailing_stop" && <>
          <div className="dt-order-hint">
            The stop price automatically follows the market by the trail %. Order triggers when price reverses by that amount.
          </div>
          <div className="dt-field">
            <div className="dt-flabel-row">
              <label className="dt-flabel">Trail %</label>
              <span className="dt-flabel-unit">%</span>
            </div>
            <div className="dt-trail-row">
              <input
                type="number" className="dt-inp dt-inp--trail"
                placeholder="e.g. 1.5" min="0.01" max="20" step="0.01"
                value={trailPct} onChange={e => { setTrailPct(e.target.value); setFeedback(null); }}
              />
              <div className="dt-trail-presets">
                {[0.5, 1, 2, 5].map(p => (
                  <button key={p} type="button" className="dt-pct-btn" onClick={() => setTrailPct(String(p))}>
                    {p}%
                  </button>
                ))}
              </div>
            </div>
          </div>
          <NumInput label="Amount" unit={pair.base} value={amount} onChange={v => { setAmount(v); setFeedback(null); }} placeholder="0.00000000" />
        </>}

        {/* Percentage buttons (shared, except trailing has its own) */}
        {orderType !== "trailing_stop" && (
          <div className="dt-pct-row">
            {[0.25, 0.5, 0.75, 1].map((p, i) => (
              <button key={i} type="button" className="dt-pct-btn" onClick={() => applyPct(p)}>
                {p === 1 ? "MAX" : `${p * 100}%`}
              </button>
            ))}
          </div>
        )}

        {/* Available + Total */}
        <div className="dt-form-info">
          <div className="dt-form-info-row">
            <span className="dt-form-info-label">Available</span>
            <span className="dt-form-info-val"><b>{fmtN(available, 4)}</b> {availAsset}</span>
          </div>
          {total > 0 && (
            <div className="dt-form-info-row">
              <span className="dt-form-info-label">Est. Total</span>
              <span className="dt-form-info-val"><b>{fmtN(total, 4)}</b> {pair.quote}</span>
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          className={`dt-submit dt-submit--${side}`}
          disabled={mutation.isPending || ocoMutation.isPending}
        >
          {(mutation.isPending || ocoMutation.isPending)
            ? <><i className="bi bi-hourglass-split" /> Placing…</>
            : <>{isBuy ? "BUY" : "SELL"} {pair.base}</>}
        </button>
      </form>
    </div>
  );
};

// ── Open Orders ───────────────────────────────────────────────────────────────

const OpenOrders = ({ symbol }) => {
  const { data: orders = [], isLoading } = useOpenOrdersQuery(symbol ? { symbol } : {}, true);
  const cancelMutation = useCancelOrderMutation();
  const [cancellingId, setCancellingId] = useState(null);

  const handleCancel = async (id) => {
    setCancellingId(id);
    try { await cancelMutation.mutateAsync(id); } catch {}
    finally { setCancellingId(null); }
  };

  return (
    <div className="dt-section">
      <div className="dt-section-head">
        <div className="dt-section-title">
          Open Orders
          {orders.length > 0 && <span className="dt-badge">{orders.length}</span>}
        </div>
      </div>

      {isLoading ? (
        <div className="dt-skel-list">
          {[1,2].map(i => <Shimmer key={i} h={44} r={6} />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="dt-empty">
          <i className="bi bi-inbox" />
          <div className="dt-empty-h">No open orders</div>
          <div className="dt-empty-sub">Your active orders will appear here.</div>
        </div>
      ) : (
        <div className="dt-table-wrap">
          <table className="dt-table">
            <thead>
              <tr>
                <th className="dt-th">Pair</th>
                <th className="dt-th">Side</th>
                <th className="dt-th">Type</th>
                <th className="dt-th dt-th--r">Price</th>
                <th className="dt-th dt-th--r">Amount</th>
                <th className="dt-th dt-th--r">Filled</th>
                <th className="dt-th">Status</th>
                <th className="dt-th">Date</th>
                <th className="dt-th dt-th--r">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o._id || o.id} className="dt-row">
                  <td className="dt-td dt-td--pair">{o.symbol}</td>
                  <td className="dt-td"><SideBadge side={o.side} /></td>
                  <td className="dt-td dt-td--type">{o.orderType?.toUpperCase()}</td>
                  <td className="dt-td dt-td--r dt-td--num">{fmtN(o.price, 2)}</td>
                  <td className="dt-td dt-td--r dt-td--num">{fmtN(o.amount, 6)}</td>
                  <td className="dt-td dt-td--r dt-td--muted">{fmtN(o.filledAmount, 6)}</td>
                  <td className="dt-td"><StatusBadge status={o.status} /></td>
                  <td className="dt-td dt-td--date">{fmtDate(o.createdAt)}</td>
                  <td className="dt-td dt-td--r">
                    <button
                      className="dt-cancel-btn"
                      onClick={() => handleCancel(o._id || o.id)}
                      disabled={cancellingId === (o._id || o.id)}
                    >
                      {cancellingId === (o._id || o.id) ? "…" : "Cancel"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ── Order History ─────────────────────────────────────────────────────────────

const OrderHistory = ({ symbol }) => {
  const [page,       setPage]       = useState(1);
  const [sideFilter, setSideFilter] = useState("");
  const params = { page, limit: 10, ...(symbol ? { symbol } : {}), ...(sideFilter ? { side: sideFilter } : {}) };
  const { data, isLoading } = useOrderHistoryQuery(params, true);

  const orders = data?.orders ?? [];
  const pages  = data?.pages  ?? 1;

  return (
    <div className="dt-section">
      <div className="dt-section-head">
        <div className="dt-section-title">Order History</div>
        <div className="dt-filter-row">
          {["", "buy", "sell"].map(s => (
            <button
              key={s || "all"}
              className={`dt-ftab${sideFilter === s ? " dt-ftab--on" : ""}`}
              onClick={() => { setSideFilter(s); setPage(1); }}
            >
              {s ? s.charAt(0).toUpperCase() + s.slice(1) : "All"}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="dt-skel-list">
          {[1,2,3].map(i => <Shimmer key={i} h={44} r={6} />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="dt-empty">
          <i className="bi bi-clock-history" />
          <div className="dt-empty-h">No order history yet</div>
          <div className="dt-empty-sub">Completed and cancelled orders will appear here.</div>
        </div>
      ) : (
        <>
          <div className="dt-table-wrap">
            <table className="dt-table">
              <thead>
                <tr>
                  <th className="dt-th">Pair</th>
                  <th className="dt-th">Side</th>
                  <th className="dt-th">Type</th>
                  <th className="dt-th dt-th--r">Price</th>
                  <th className="dt-th dt-th--r">Amount</th>
                  <th className="dt-th dt-th--r">Avg Fill</th>
                  <th className="dt-th">Status</th>
                  <th className="dt-th">Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o._id || o.id} className="dt-row">
                    <td className="dt-td dt-td--pair">{o.symbol}</td>
                    <td className="dt-td"><SideBadge side={o.side} /></td>
                    <td className="dt-td dt-td--type">{o.orderType?.toUpperCase()}</td>
                    <td className="dt-td dt-td--r dt-td--num">{fmtN(o.price, 2)}</td>
                    <td className="dt-td dt-td--r dt-td--num">{fmtN(o.amount, 6)}</td>
                    <td className="dt-td dt-td--r dt-td--muted">
                      {o.averagePrice > 0 ? fmtN(o.averagePrice, 2) : "—"}
                    </td>
                    <td className="dt-td"><StatusBadge status={o.status} /></td>
                    <td className="dt-td dt-td--date">{fmtDate(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="dt-pager">
              <button className="dt-pg-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <i className="bi bi-chevron-left" />
              </button>
              <span className="dt-pg-info">{page} / {pages}</span>
              <button className="dt-pg-btn" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>
                <i className="bi bi-chevron-right" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ── Chart ─────────────────────────────────────────────────────────────────────

const DtChart = ({ symbol }) => (
  <div className="dt-chart-wrap">
    <div className="dt-chart-inner">
      <Suspense fallback={
        <div className="dt-chart-loading">
          <i className="bi bi-graph-up-arrow" />
          <span>Loading chart…</span>
        </div>
      }>
        <AdvancedRealTimeChart
          symbol={symbol}
          theme="dark"
          autosize
          interval="15"
          timezone="Etc/UTC"
          style="1"
          locale="en"
          enable_publishing={false}
          hide_side_toolbar={true}
          allow_symbol_change={false}
          container_id={`dtchart_${symbol}`}
        />
      </Suspense>
    </div>
  </div>
);

// ── Order Book ────────────────────────────────────────────────────────────────

const DtOrderBook = ({ marketState, symbol }) => {
  const bids = useMemo(() => marketState?.orderBook?.bids ?? [], [marketState]);
  const asks = useMemo(() => marketState?.orderBook?.asks ?? [], [marketState]);
  const ticker = marketState?.ticker || {};
  const lastPrice = ticker.lastPrice ?? ticker.price ?? 0;

  const maxTotal = useMemo(() => {
    const all = [...bids.slice(0, 12), ...asks.slice(0, 12)];
    return Math.max(...all.map(l => {
      const p = Array.isArray(l) ? Number(l[0]) : Number(l.price);
      const a = Array.isArray(l) ? Number(l[1]) : Number(l.amount);
      return p * a;
    }), 1);
  }, [bids, asks]);

  const renderLevel = (level, side, idx) => {
    const price  = Array.isArray(level) ? Number(level[0]) : Number(level.price);
    const amount = Array.isArray(level) ? Number(level[1]) : Number(level.amount);
    const total  = price * amount;
    const barPct = Math.min(100, (total / maxTotal) * 100);

    return (
      <div key={`${side}-${idx}`} className={`dt-book-row dt-book-row--${side}`}>
        <div className="dt-book-bar" style={{
          width: `${barPct}%`,
          background: side === "ask" ? "rgba(246,70,93,0.08)" : "rgba(14,203,129,0.08)",
        }} />
        <span className={`dt-book-price ${side === "ask" ? "dt-dn" : "dt-up"}`}>
          {fmtN(price, 4)}
        </span>
        <span className="dt-book-amount">{fmtN(amount, 4)}</span>
        <span className="dt-book-total">{fmtN(total, 2)}</span>
      </div>
    );
  };

  const pair = symbol.match(QUOTE_RE) || [];
  const quote = pair[2] || "USDT";

  return (
    <div className="dt-book-panel">
      <div className="dt-panel-head">Order Book</div>
      <div className="dt-book-cols">
        <span className={`dt-book-col-hd ${""}`}>Price ({quote})</span>
        <span className="dt-book-col-hd">Amount</span>
        <span className="dt-book-col-hd">Total</span>
      </div>

      <div className="dt-book-asks">
        {asks.length === 0
          ? <div className="dt-book-empty">No asks</div>
          : asks.slice(0, 10).reverse().map((l, i) => renderLevel(l, "ask", i))}
      </div>

      <div className="dt-book-spread">
        <span className="dt-book-last" style={{ color: Number(ticker.priceChangePct ?? 0) >= 0 ? "#0ecb81" : "#f6465d" }}>
          {lastPrice ? fmtN(lastPrice, 4) : "—"}
        </span>
        <span className="dt-book-spread-label">Last Price</span>
      </div>

      <div className="dt-book-bids">
        {bids.length === 0
          ? <div className="dt-book-empty">No bids</div>
          : bids.slice(0, 10).map((l, i) => renderLevel(l, "bid", i))}
      </div>
    </div>
  );
};

// ── Market Trades ─────────────────────────────────────────────────────────────

const DtMarketTrades = ({ marketState }) => {
  const trades = marketState?.recentTrades ?? [];

  const fmtTime = (ts) => {
    try { return new Date(ts).toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
    catch { return "—"; }
  };

  return (
    <div className="dt-mtrades-panel">
      <div className="dt-panel-head">Market Trades</div>
      <div className="dt-mtrades-cols">
        <span className="dt-mtrades-col-hd">Price</span>
        <span className="dt-mtrades-col-hd">Amount</span>
        <span className="dt-mtrades-col-hd">Time</span>
      </div>
      <div className="dt-mtrades-list">
        {trades.length === 0 ? (
          <div className="dt-book-empty">No trades yet</div>
        ) : trades.slice(0, 20).map((t, i) => {
          const isBuy = (t.side || t.takerSide) === "buy";
          return (
            <div key={i} className="dt-mtrade-row">
              <span className={isBuy ? "dt-up" : "dt-dn"}>{fmtN(t.price, 4)}</span>
              <span className="dt-mtrade-amount">{fmtN(t.amount ?? t.quantity, 4)}</span>
              <span className="dt-mtrade-time">{fmtTime(t.timestamp ?? t.executedAt ?? t.createdAt)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Main DashTrade Page ───────────────────────────────────────────────────────

const DashTrade = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  // ── ALL HOOKS BEFORE CONDITIONAL RETURN ──────────────────────────────────
  const [searchParams] = useSearchParams();
  const [sidebarOpen,   setSidebarOpen]   = useState(false);
  const [activeSymbol,  setActiveSymbol]  = useState(
    searchParams.get("pair") || "BTCUSDT"
  );

  const { data: wallets    = [] } = useMyWalletsQuery(true);
  const { data: assets     = [] } = useSupportedAssets();
  const { data: rawPairs   = [] } = useTradingPairsQuery();
  const tickers = useLiveMarketStore(s => s.tickers);

  const { data: marketState } = useTradeMarketStateQuery(activeSymbol);

  useOrderSocket({ enabled: isAuthenticated });
  useMarketSocket();
  useTradeSocket({ symbol: activeSymbol, isAuthenticated });

  // Build trading pairs from the backend's authoritative pairs list.
  // Using rawPairs (from /api/trades/pairs) ensures the frontend only
  // shows symbols that validateOrderInput will accept.
  const pairs = useMemo(() => {
    const assetMap = Object.fromEntries(assets.map(a => [a.symbol, a]));
    return rawPairs.map(p => ({
      symbol:   p.symbol,
      base:     p.baseAsset,
      quote:    p.quoteAsset,
      baseName: assetMap[p.baseAsset]?.name ?? p.baseAsset,
    }));
  }, [rawPairs, assets]);

  // ── Auth guard ────────────────────────────────────────────────────────────
  const tok = localStorage.getItem("token");
  let usr = null;
  try { const r = localStorage.getItem("user"); usr = r && r !== "null" ? JSON.parse(r) : null; } catch {}
  if (!isAuthenticated && !(tok && usr && typeof usr === "object")) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="dash-root">
      <DashNavbar onMenuClick={() => setSidebarOpen(v => !v)} />

      <div className="dash-body">
        <DashSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onLogout={() => { useAuthStore.getState().logout(); navigate("/login"); }}
        />

        <main className="dash-main dt-page">

          {/* Page header */}
          <div className="dt-page-head">
            <div className="dt-page-head-left">
              <h1 className="dt-page-title">Spot Trading</h1>
              <p className="dt-page-sub">Limit orders — funds are locked until the order fills or is cancelled.</p>
            </div>
            <div className="dt-page-head-right">
              <Link to="/trade" className="dt-adv-link">
                <i className="bi bi-graph-up-arrow" /> Advanced Chart
              </Link>
            </div>
          </div>

          {/* Ticker bar */}
          <TickerBar symbol={activeSymbol} tickers={tickers} assets={assets} />

          {/* ── 3-column Binance-style trading grid ── */}
          <div className="dt-trading-grid">

            {/* Column 1 — pairs list */}
            <div className="dt-col-pairs">
              <PairSelector
                pairs={pairs}
                activeSymbol={activeSymbol}
                onSelect={setActiveSymbol}
              />
            </div>

            {/* Column 2 — chart + order tables */}
            <div className="dt-col-center">
              <DtChart symbol={activeSymbol} />
              <div className="dt-bottom-panels">
                <OpenOrders  symbol={activeSymbol} />
                <OrderHistory symbol={activeSymbol} />
              </div>
            </div>

            {/* Column 3 — order book + market trades + order form */}
            <div className="dt-col-right">
              <DtOrderBook marketState={marketState} symbol={activeSymbol} />
              <DtMarketTrades marketState={marketState} />
              <OrderForm wallets={wallets} activeSymbol={activeSymbol} />
            </div>

          </div>
        </main>
      </div>
    </div>
  );
};

export default DashTrade;
