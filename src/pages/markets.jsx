import { useEffect, useState, useMemo, useCallback } from "react";
import { Navigate, useNavigate }        from "react-router-dom";
import { useAuthStore }                 from "../store/authStore";
import { useMarketSummary }             from "../hooks/useMarketData.js";
import { useMarketSocket }              from "../hooks/useMarketSocket.js";
import { useLiveMarketStore }           from "../store/liveMarketStore.js";
import DashNavbar                       from "../Components/layout/DashNavbar";
import DashSidebar                      from "../Components/dashboard/DashSidebar";
import CoinLogo                         from "../Components/common/CoinLogo";
import "../styles/dashboard.css";
import "../styles/markets.css";

// ── Favorites persistence ──────────────────────────────────────────────────────
const FAV_KEY = "bnx_market_favs";
const loadFavs  = () => { try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || "[]")); } catch { return new Set(); } };
const saveFavs  = (s) => localStorage.setItem(FAV_KEY, JSON.stringify([...s]));

// ── Formatters ─────────────────────────────────────────────────────────────────

const fmtPrice = (n) => {
  if (n == null || isNaN(n)) return "—";
  if (n >= 1000)  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1)     return Number(n).toFixed(4);
  if (n >= 0.001) return Number(n).toFixed(6);
  return Number(n).toFixed(8);
};

const fmtPct = (n) => {
  if (n == null || isNaN(n)) return "—";
  return `${Number(n) >= 0 ? "+" : ""}${Number(n).toFixed(2)}%`;
};

const fmtVol = (n) => {
  if (n == null || isNaN(n) || n === 0) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return Number(n).toFixed(2);
};

// ── Ticker row ─────────────────────────────────────────────────────────────────

const QUOTE_RE = /(USDT|USDC|BTC|ETH)$/;

const TickerRow = ({ ticker, onTrade, isFav, onToggleFav }) => {
  const isUp = (ticker.priceChangePct ?? 0) >= 0;
  const [flash, setFlash] = useState(null);

  useEffect(() => {
    setFlash(isUp ? "mk-flash-green" : "mk-flash-red");
    const t = setTimeout(() => setFlash(null), 600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker.lastPrice]);

  const m          = ticker.symbol.match(QUOTE_RE);
  const quoteAsset = m ? m[1] : "";
  const baseAsset  = quoteAsset ? ticker.symbol.slice(0, -quoteAsset.length) : ticker.symbol;
  const isStable   = quoteAsset === "USDT" || quoteAsset === "USDC";

  // Mini bar chart using change pct
  const chgAbs = Math.min(Math.abs(ticker.priceChangePct ?? 0), 20);
  const barW   = Math.max(4, (chgAbs / 20) * 100);

  return (
    <tr className={flash ? `mk-row ${flash}` : "mk-row"}>
      {/* Star / favorite */}
      <td className="mk-td-star">
        <button
          className={`mk-star-btn${isFav ? " mk-star-btn--on" : ""}`}
          onClick={(e) => { e.stopPropagation(); onToggleFav(ticker.symbol); }}
          title={isFav ? "Remove from favorites" : "Add to favorites"}
        >
          <i className={`bi bi-star${isFav ? "-fill" : ""}`} />
        </button>
      </td>

      {/* Asset */}
      <td>
        <div className="mk-asset-cell">
          <CoinLogo symbol={baseAsset} size={32} />
          <div>
            <div className="mk-base">{baseAsset}<span className="mk-quote">/{quoteAsset}</span></div>
            <div className="mk-pair-vol mk-hide-sm">
              Vol {fmtVol(ticker.volume24h)}
            </div>
          </div>
        </div>
      </td>

      {/* Price */}
      <td className="mk-td-right mk-price">
        {isStable ? "$" : ""}{fmtPrice(ticker.lastPrice)}
      </td>

      {/* 24h Change — with mini bar */}
      <td className={`mk-td-right mk-chg ${isUp ? "mk-up" : "mk-down"}`}>
        <div className="mk-chg-wrap">
          <span className="mk-chg-pill" style={{
            background: isUp ? "rgba(14,203,129,0.12)" : "rgba(246,70,93,0.12)",
            color: isUp ? "#0ecb81" : "#f6465d",
          }}>
            {isUp ? "▲" : "▼"} {fmtPct(ticker.priceChangePct)}
          </span>
        </div>
      </td>

      {/* 24h High */}
      <td className="mk-td-right mk-muted mk-hide-sm">
        {fmtPrice(ticker.high24h)}
      </td>

      {/* 24h Low */}
      <td className="mk-td-right mk-muted mk-hide-sm">
        {fmtPrice(ticker.low24h)}
      </td>

      {/* 24h Volume */}
      <td className="mk-td-right mk-muted mk-hide-md">
        <span>{fmtVol(ticker.quoteVolume24h ?? ticker.volume24h)}</span>
        <span style={{ color: "#474d57", fontSize: "0.7rem", marginLeft: 3 }}>
          {isStable ? "USDT" : quoteAsset}
        </span>
      </td>

      {/* Market cap indicator bar */}
      <td className="mk-td-right mk-hide-md">
        <div className="mk-bar-wrap">
          <div
            className="mk-bar"
            style={{
              width: `${barW}%`,
              background: isUp ? "#0ecb81" : "#f6465d",
            }}
          />
        </div>
      </td>

      {/* Action */}
      <td className="mk-td-right">
        <button className="mk-trade-btn" onClick={() => onTrade(ticker.symbol)}>
          Trade
        </button>
      </td>
    </tr>
  );
};

// ── Main page ──────────────────────────────────────────────────────────────────

const QUOTE_TABS = ["★ Favorites", "USDT", "BTC", "ETH", "ALL"];

const Markets = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search,      setSearch]      = useState("");
  const [quoteTab,    setQuoteTab]    = useState("USDT");
  const [sortKey,     setSortKey]     = useState("quoteVolume24h");
  const [sortDir,     setSortDir]     = useState(-1);
  const [favs,        setFavs]        = useState(() => loadFavs());

  const toggleFav = useCallback((sym) => {
    setFavs(prev => {
      const next = new Set(prev);
      next.has(sym) ? next.delete(sym) : next.add(sym);
      saveFavs(next);
      return next;
    });
  }, []);

  useMarketSocket();

  const { tickers: liveTickers, connected } = useLiveMarketStore();
  const { data, isLoading }   = useMarketSummary();
  const setAllTickers = useLiveMarketStore((s) => s.setAllTickers);

  // Seed store from REST on first load
  useEffect(() => {
    if (data?.tickers?.length) setAllTickers(data.tickers);
  }, [data, setAllTickers]);

  // Auth guard
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Filter + sort
  const rows = useMemo(() => {
    const all  = Object.values(liveTickers);
    const term = search.trim().toLowerCase();
    const isFavTab = quoteTab === "★ Favorites";

    const filtered = all.filter((t) => {
      const m     = t.symbol.match(QUOTE_RE);
      const quote = m ? m[1] : "";
      const base  = quote ? t.symbol.slice(0, -quote.length) : t.symbol;

      if (isFavTab && !favs.has(t.symbol)) return false;
      if (!isFavTab && quoteTab !== "ALL" && quote !== quoteTab) return false;
      if (term && !base.toLowerCase().includes(term) && !t.symbol.toLowerCase().includes(term)) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      return sortDir * (bv - av);
    });
  }, [liveTickers, search, quoteTab, sortKey, sortDir, favs]);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => -d);
    else { setSortKey(key); setSortDir(-1); }
  };

  const SortIcon = ({ col }) => (
    <span className="mk-sort-icon">
      {sortKey !== col ? "⇅" : sortDir === -1 ? "↓" : "↑"}
    </span>
  );

  const totalPairs   = Object.values(liveTickers).length;
  const gainers      = Object.values(liveTickers).filter((t) => (t.priceChangePct ?? 0) > 0).length;

  return (
    <div className="dash-root">
      <DashNavbar onMenuClick={() => setSidebarOpen((v) => !v)} />

      <div className="dash-body">
        <DashSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onLogout={() => { useAuthStore.getState().logout(); navigate("/login"); }}
        />

        <main className="dash-main mk-page">

          {/* ── Page header ── */}
          <div className="mk-header">
            <div>
              <h1 className="mk-title">Markets</h1>
              <p className="mk-subtitle">
                Live prices across all trading pairs &nbsp;·&nbsp;
                {isLoading ? "Loading…" : `${totalPairs} pairs · ${gainers} gainers`}
              </p>
            </div>
            <div className="mk-live-pill" data-connected={connected}>
              <span className="mk-live-dot" />
              {connected ? "LIVE" : "Connecting…"}
            </div>
          </div>

          {/* ── Top stats strip ── */}
          {!isLoading && totalPairs > 0 && (() => {
            const all   = Object.values(liveTickers);
            const top   = [...all].sort((a, b) => (b.priceChangePct ?? 0) - (a.priceChangePct ?? 0));
            const gainer = top[0];
            const loser  = top[top.length - 1];
            const byVol  = [...all].sort((a, b) => (b.quoteVolume24h ?? 0) - (a.quoteVolume24h ?? 0))[0];
            return (
              <div className="mk-stat-strip">
                <div className="mk-stat">
                  <span className="mk-stat-lbl">Top Gainer</span>
                  <span className="mk-stat-val mk-up">{gainer?.symbol} {fmtPct(gainer?.priceChangePct)}</span>
                </div>
                <div className="mk-stat">
                  <span className="mk-stat-lbl">Top Loser</span>
                  <span className="mk-stat-val mk-down">{loser?.symbol} {fmtPct(loser?.priceChangePct)}</span>
                </div>
                <div className="mk-stat">
                  <span className="mk-stat-lbl">Most Active</span>
                  <span className="mk-stat-val">{byVol?.symbol} ${fmtVol(byVol?.quoteVolume24h)}</span>
                </div>
                <div className="mk-stat">
                  <span className="mk-stat-lbl">Market Mood</span>
                  <span className={`mk-stat-val ${gainers > totalPairs / 2 ? "mk-up" : "mk-down"}`}>
                    {gainers > totalPairs / 2 ? "Bullish" : "Bearish"} &nbsp;
                    <span style={{ color: "#848e9c", fontWeight: 400 }}>{gainers}/{totalPairs} up</span>
                  </span>
                </div>
              </div>
            );
          })()}

          {/* ── Quote asset tabs + search ── */}
          <div className="mk-toolbar">
            <div className="mk-tabs">
              {QUOTE_TABS.map((q) => (
                <button
                  key={q}
                  className={`mk-tab${quoteTab === q ? " mk-tab--active" : ""}`}
                  onClick={() => { setQuoteTab(q); setSearch(""); }}
                >
                  {q}
                </button>
              ))}
            </div>

            <div className="mk-search-wrap">
              <i className="bi bi-search mk-search-icon" />
              <input
                className="mk-search"
                placeholder="Search pair…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button className="mk-search-clear" onClick={() => setSearch("")}>✕</button>
              )}
            </div>
          </div>

          {/* ── Loading ── */}
          {isLoading && !rows.length && (
            <div className="mk-loading">
              <div className="mk-spinner" />
              <span>Loading market data…</span>
            </div>
          )}

          {/* ── Empty ── */}
          {!isLoading && !rows.length && (
            <div className="dash-empty" style={{ minHeight: "35vh" }}>
              <i className="bi bi-bar-chart-line dash-empty-icon" />
              <p className="dash-empty-text">
                {search ? `No pairs matching "${search}"` : "No pairs in this market yet."}
              </p>
              {search && (
                <button className="dash-btn dash-btn--primary" style={{ marginTop: "0.75rem" }} onClick={() => setSearch("")}>
                  Clear search
                </button>
              )}
            </div>
          )}

          {/* ── Table ── */}
          {rows.length > 0 && (
            <div className="mk-table-wrap">
              <table className="mk-table">
                <thead>
                  <tr>
                    <th className="mk-th-star" />
                    <th className="mk-th-sort" onClick={() => handleSort("symbol")}>
                      Pair <SortIcon col="symbol" />
                    </th>
                    <th className="mk-td-right mk-th-sort" onClick={() => handleSort("lastPrice")}>
                      Price <SortIcon col="lastPrice" />
                    </th>
                    <th className="mk-td-right mk-th-sort" onClick={() => handleSort("priceChangePct")}>
                      24h Change <SortIcon col="priceChangePct" />
                    </th>
                    <th className="mk-td-right mk-hide-sm">24h High</th>
                    <th className="mk-td-right mk-hide-sm">24h Low</th>
                    <th className="mk-td-right mk-hide-md mk-th-sort" onClick={() => handleSort("quoteVolume24h")}>
                      Volume <SortIcon col="quoteVolume24h" />
                    </th>
                    <th className="mk-td-right mk-hide-md">Trend</th>
                    <th className="mk-td-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((ticker) => (
                    <TickerRow
                      key={ticker.symbol}
                      ticker={ticker}
                      isFav={favs.has(ticker.symbol)}
                      onToggleFav={toggleFav}
                      onTrade={(sym) => navigate(`/Dashboard/trade?pair=${sym}`)}
                    />
                  ))}
                </tbody>
              </table>
              <p className="mk-footnote">
                Real-time prices from matched trades &nbsp;·&nbsp;
                {rows.length} pair{rows.length !== 1 ? "s" : ""} shown
                {favs.size > 0 && ` · ${favs.size} favorited`}
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Markets;
