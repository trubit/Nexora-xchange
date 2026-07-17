import { useState, useMemo, useEffect } from "react";
import { Navigate, useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useDashboardQuery } from "../hooks/queries/useDashboardQuery";
import { useDashboardSocket } from "../hooks/useDashboardSocket";
import { useLiveMarketStore } from "../store/liveMarketStore";
import { useMarketSocket } from "../hooks/useMarketSocket";
import DashNavbar from "../Components/layout/DashNavbar";
import DashSidebar from "../Components/dashboard/DashSidebar";
import { KycBadge } from "../Components/dashboard/DashShared";
import CoinLogo from "../Components/common/CoinLogo";
import "../styles/dashboard.css";

// ── Live price ticker bar ─────────────────────────────────────────────────────

const TICKER_COINS = ["BTC","ETH","BNB","SOL","XRP","ADA","DOGE","AVAX","LINK","DOT","MATIC","UNI","ATOM","NEAR","TRUSON"];

const TickerBar = ({ tickers }) => {
  const fmtPx = (n) => {
    if (!n) return "—";
    if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
    if (n >= 1)    return Number(n).toFixed(4);
    return Number(n).toFixed(6);
  };

  const items = TICKER_COINS.map(sym => {
    const t = tickers?.[`${sym}USDT`] || {};
    return { sym, price: t.lastPrice, chg: t.priceChangePct };
  }).filter(i => i.price);

  if (!items.length) return null;

  const doubled = [...items, ...items]; // duplicate for seamless loop

  return (
    <div className="bnx-ticker" title="Hover to pause">
      <div className="bnx-ticker-track">
        {doubled.map((item, idx) => {
          const isUp = (item.chg ?? 0) >= 0;
          return (
            <span key={idx} className="bnx-ticker-item">
              <CoinLogo symbol={item.sym} size={18} />
              <span className="bnx-ticker-sym">{item.sym}</span>
              <span className="bnx-ticker-px">${fmtPx(item.price)}</span>
              <span className={`bnx-ticker-chg ${isUp ? "bnx-ticker-up" : "bnx-ticker-dn"}`}>
                {isUp ? "▲" : "▼"}{Math.abs(item.chg ?? 0).toFixed(2)}%
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const USD = new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD",
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const fmtUSD    = (n) => USD.format(n ?? 0);
const fmtCrypto = (n, dec = 6) => Number.isFinite(+n) ? (+n).toFixed(Math.min(dec, 8)) : "—";
const fmtDate   = (d) => {
  try { return new Date(d).toLocaleString([], { dateStyle: "short", timeStyle: "short" }); }
  catch { return "—"; }
};
const greeting  = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
};

// CoinBadge → now delegates to CoinLogo (shows real logo when available)
const CoinBadge = ({ symbol, size = 36 }) => <CoinLogo symbol={symbol} size={size} />;

// ── Shimmer skeleton ──────────────────────────────────────────────────────────

const Shimmer = ({ h = 14, w = "100%", r = 5, mb = 0 }) => (
  <span className="db-shimmer" style={{ height: h, width: w, borderRadius: r, marginBottom: mb, display: "block" }} />
);

// ── Connection badge ──────────────────────────────────────────────────────────

const ConnBadge = ({ status }) => {
  const cfg = {
    connected:    { color: "#0ecb81", label: "Live",         pulse: true },
    connecting:   { color: "#f0b90b", label: "Connecting…",  pulse: true },
    disconnected: { color: "#f6465d", label: "Disconnected", pulse: false },
    idle:         { color: "#474d57", label: "Offline",      pulse: false },
  }[status] || { color: "#474d57", label: "—", pulse: false };
  return (
    <span className="db-conn">
      <span className={`db-conn-dot${cfg.pulse ? " db-conn-dot--pulse" : ""}`}
        style={{ background: cfg.color, boxShadow: `0 0 6px ${cfg.color}88` }} />
      <span className="db-conn-label" style={{ color: cfg.color }}>{cfg.label}</span>
    </span>
  );
};

// ── UID copy chip ─────────────────────────────────────────────────────────────

const UidChip = ({ uid }) => {
  const [copied, setCopied] = useState(false);
  if (!uid) return null;
  const copy = () => {
    navigator.clipboard.writeText(uid).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button className="db-uid-chip" onClick={copy} title="Copy UID">
      <i className="bi bi-fingerprint" />
      <span>UID&nbsp;<b>{uid}</b></span>
      <i className={`bi bi-${copied ? "check2" : "copy"}`} style={{ opacity: 0.7 }} />
    </button>
  );
};

// ── Welcome bar ───────────────────────────────────────────────────────────────

const WelcomeBar = ({ user, socketStatus, isLoading }) => {
  const name = user?.firstName || user?.name || user?.email?.split("@")[0] || "Trader";
  const since = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : null;

  return (
    <div className="db-welcome">
      <div className="db-welcome-left">
        {isLoading ? (
          <>
            <Shimmer h={22} w={240} mb={6} />
            <Shimmer h={13} w={180} />
          </>
        ) : (
          <>
            <h1 className="db-welcome-h">{greeting()}, {name} 👋</h1>
            <div className="db-welcome-meta">
              <KycBadge status={user?.kycStatus} />
              {since && <span className="db-since">Member since {since}</span>}
              <UidChip uid={user?.uid} />
            </div>
          </>
        )}
      </div>
      <div className="db-welcome-right">
        <ConnBadge status={socketStatus} />
        <Link to="/Dashboard/markets" className="db-welcome-link">
          <i className="bi bi-bar-chart-line-fill" /> Markets
        </Link>
      </div>
    </div>
  );
};

// ── Portfolio hero card ───────────────────────────────────────────────────────

const PortfolioHero = ({ portfolio, wallets, isLoading, tickers }) => {
  const [hidden, setHidden] = useState(false);
  const total   = portfolio?.totalBalanceUsdt ?? 0;
  const wCount  = portfolio?.walletCount      ?? wallets.length;
  const orders  = portfolio?.openOrdersCount  ?? 0;

  // BTC equivalent
  const btcPrice = tickers?.["BTCUSDT"]?.lastPrice ?? 0;
  const btcEquiv = btcPrice > 0 ? (total / btcPrice).toFixed(6) : null;

  return (
    <div className="db-hero">
      <div className="db-hero-glow" />
      <div className="db-hero-inner">
        {/* Left — balance */}
        <div className="db-hero-left">
          <div className="db-hero-label">
            <span>Total Portfolio Balance</span>
            <button className="db-icon-btn" onClick={() => setHidden(v => !v)}
              title={hidden ? "Show balance" : "Hide balance"}>
              <i className={`bi bi-eye${hidden ? "" : "-slash"}`} />
            </button>
          </div>

          {isLoading ? (
            <Shimmer h={52} w={280} mb={12} r={8} />
          ) : (
            <div className="db-hero-value">
              {hidden ? <span className="db-blur">$••••••.••</span> : fmtUSD(total)}
            </div>
          )}

          <div className="db-hero-sub">
            {isLoading ? <Shimmer h={14} w={220} /> : (
              <span>
                {btcEquiv ? `≈ ${btcEquiv} BTC` : "Estimated value across all assets"}
                {btcEquiv && <span style={{ color: "#474d57", marginLeft: 8 }}>· across all assets</span>}
              </span>
            )}
          </div>

          <div className="db-hero-actions">
            <Link to="/wallet" className="db-ha db-ha--primary">
              <i className="bi bi-arrow-down-circle-fill" />Deposit
            </Link>
            <Link to="/wallet" className="db-ha">
              <i className="bi bi-arrow-up-circle-fill" />Withdraw
            </Link>
            <Link to="/wallet" className="db-ha">
              <i className="bi bi-arrow-left-right" />Transfer
            </Link>
            <Link to="/Dashboard/trade" className="db-ha">
              <i className="bi bi-bar-chart-line-fill" />Trade
            </Link>
            <Link to="/Dashboard/markets" className="db-ha">
              <i className="bi bi-grid-1x2-fill" />Markets
            </Link>
          </div>
        </div>

        {/* Right — key metrics */}
        <div className="db-hero-metrics">
          {[
            { label: "Total Assets",  val: wCount,            unit: "wallets",    color: "#eaecef", icon: "bi-wallet2" },
            { label: "Open Orders",   val: orders,            unit: "active",     color: orders > 0 ? "#f0b90b" : "#474d57", icon: "bi-clock-fill" },
          ].map(m => (
            <div key={m.label} className="db-hmetric">
              <div className="db-hmetric-label">
                <i className={`bi ${m.icon}`} style={{ marginRight: 4, opacity: 0.5 }} />
                {m.label}
              </div>
              {isLoading
                ? <Shimmer h={32} w={80} mb={4} />
                : <div className="db-hmetric-val" style={{ color: m.color }}>{m.val}</div>}
              <div className="db-hmetric-unit">{m.unit}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Stat cards ────────────────────────────────────────────────────────────────

const StatGrid = ({ portfolio, user, wallets, isLoading }) => {
  const total = portfolio?.totalBalanceUsdt ?? 0;

  // compute available USD from wallet data
  const { availUSD, lockedUSD } = useMemo(() => {
    let a = 0, l = 0;
    for (const w of wallets) {
      const usd = w.balanceUsdt ?? 0;
      const bal = w.balance ?? 0;
      if (bal <= 0) { a += usd; continue; }
      a += usd * ((w.available ?? 0) / bal);
      l += usd * ((w.locked   ?? 0) / bal);
    }
    return { availUSD: a, lockedUSD: l };
  }, [wallets]);

  const cards = [
    {
      icon: "bi-graph-up-arrow",
      accent: "#f0b90b",
      label: "Portfolio Value",
      value: fmtUSD(total),
      sub: "Across all wallets",
    },
    {
      icon: "bi-check-circle-fill",
      accent: "#0ecb81",
      label: "Available",
      value: fmtUSD(availUSD),
      sub: "Free to trade or withdraw",
    },
    {
      icon: "bi-lock-fill",
      accent: "#60a5fa",
      label: "In Orders",
      value: fmtUSD(lockedUSD),
      sub: "Locked in open orders",
    },
    {
      icon: "bi-shield-fill-check",
      accent: user?.kycStatus === "approved" ? "#0ecb81" : "#f0b90b",
      label: "Account Status",
      value: <KycBadge status={user?.kycStatus} />,
      sub: user?.kycStatus === "approved" ? "Identity verified" : "Complete KYC to unlock",
    },
  ];

  return (
    <div className="db-stat-grid">
      {cards.map((c, i) => (
        <div key={i} className="db-stat-card">
          <div className="db-stat-icon-wrap" style={{ background: `${c.accent}18`, color: c.accent }}>
            <i className={`bi ${c.icon}`} />
          </div>
          <div className="db-stat-body">
            <div className="db-stat-label">{c.label}</div>
            {isLoading
              ? <Shimmer h={22} w={100} mb={4} />
              : <div className="db-stat-value">{c.value}</div>}
            <div className="db-stat-sub">{c.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Asset balances table ──────────────────────────────────────────────────────

const AssetTable = ({ wallets, isLoading }) => {
  const [q, setQ] = useState("");
  const visible = useMemo(() => {
    const lq = q.toLowerCase();
    return wallets.filter(w =>
      !lq || w.asset?.toLowerCase().includes(lq) || (w.assetName || "").toLowerCase().includes(lq)
    );
  }, [wallets, q]);

  return (
    <div className="db-section">
      <div className="db-section-head">
        <div className="db-section-title">
          Asset Balances
          <span className="db-badge">{visible.length}</span>
        </div>
        <div className="db-section-actions">
          <div className="db-search">
            <i className="bi bi-search db-search-ico" />
            <input
              className="db-search-inp"
              placeholder="Search asset…"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
            {q && <button className="db-search-clr" onClick={() => setQ("")}><i className="bi bi-x" /></button>}
          </div>
          <Link to="/wallet" className="db-view-link">
            Manage Wallet <i className="bi bi-arrow-right" />
          </Link>
        </div>
      </div>

      <div className="db-table-wrap">
        <table className="db-table">
          <thead>
            <tr>
              <th className="db-th db-th--coin">Asset</th>
              <th className="db-th db-th--r">Total</th>
              <th className="db-th db-th--r">Available</th>
              <th className="db-th db-th--r">In Orders</th>
              <th className="db-th db-th--r">USD Value</th>
              <th className="db-th db-th--r db-th--act">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(4)].map((_, i) => (
                <tr key={i} className="db-row">
                  <td className="db-td db-td--coin">
                    <div className="db-coin-info">
                      <Shimmer h={36} w={36} r={50} />
                      <div><Shimmer h={13} w={70} mb={5} /><Shimmer h={10} w={45} /></div>
                    </div>
                  </td>
                  {[1,2,3,4,5].map(j=><td key={j} className="db-td db-td--r"><Shimmer h={13} w={70}/></td>)}
                </tr>
              ))
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="db-empty">
                    <i className="bi bi-wallet2" />
                    <div className="db-empty-h">{q ? "No matching assets" : "No assets yet"}</div>
                    <div className="db-empty-sub">
                      {q ? "Try a different search term." : "Make your first deposit to get started."}
                    </div>
                    {!q && (
                      <Link to="/wallet" className="db-ha db-ha--primary db-mt">
                        <i className="bi bi-arrow-down-circle-fill" /> Deposit Now
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              visible.map(w => (
                <tr key={w._id || w.asset} className="db-row">
                  <td className="db-td db-td--coin">
                    <div className="db-coin-info">
                      <CoinBadge symbol={w.asset} size={36} />
                      <div>
                        <div className="db-coin-name">{w.assetName || w.asset}</div>
                        <div className="db-coin-sym">{w.asset}</div>
                      </div>
                    </div>
                  </td>
                  <td className="db-td db-td--r db-td--bold">{fmtCrypto(w.balance)}</td>
                  <td className="db-td db-td--r">{fmtCrypto(w.available)}</td>
                  <td className="db-td db-td--r">
                    <span className={(w.locked ?? 0) > 0 ? "db-locked" : "db-dim"}>
                      {fmtCrypto(w.locked)}
                    </span>
                  </td>
                  <td className="db-td db-td--r db-td--usd">{fmtUSD(w.balanceUsdt)}</td>
                  <td className="db-td db-td--r db-td--act">
                    <div className="db-row-acts">
                      <Link to="/wallet" className="db-rbtn db-rbtn--dep">Deposit</Link>
                      <Link to="/wallet" className="db-rbtn db-rbtn--wd">Withdraw</Link>
                      <Link to="/Dashboard/trade"  className="db-rbtn">Trade</Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Recent trades ─────────────────────────────────────────────────────────────

const RecentTrades = ({ trades, isLoading }) => (
  <div className="db-section db-section--trades">
    <div className="db-section-head">
      <div className="db-section-title">Recent Trades</div>
      <Link to="/Dashboard/trade" className="db-view-link">View all <i className="bi bi-arrow-right" /></Link>
    </div>

    {isLoading ? (
      <div className="db-skel-list">
        {[1,2,3].map(i=><Shimmer key={i} h={46} w="100%" r={6} mb={8} />)}
      </div>
    ) : trades.length === 0 ? (
      <div className="db-empty db-empty--sm">
        <i className="bi bi-graph-up" />
        <div className="db-empty-h">No trades yet</div>
        <div className="db-empty-sub">Place your first order to get started.</div>
      </div>
    ) : (
      <div className="db-table-wrap">
        <table className="db-table">
          <thead>
            <tr>
              <th className="db-th">Pair</th>
              <th className="db-th">Side</th>
              <th className="db-th db-th--r">Amount</th>
              <th className="db-th db-th--r">Price</th>
              <th className="db-th db-th--r">Date</th>
            </tr>
          </thead>
          <tbody>
            {trades.map(t => (
              <tr key={t._id} className="db-row">
                <td className="db-td db-td--pair">{t.symbol}</td>
                <td className="db-td">
                  <span className={`db-side db-side--${(t.side||"").toLowerCase()}`}>
                    {(t.side || "—").toUpperCase()}
                  </span>
                </td>
                <td className="db-td db-td--r db-td--num">{fmtCrypto(t.amount, 4)}</td>
                <td className="db-td db-td--r db-td--num">{fmtUSD(t.price)}</td>
                <td className="db-td db-td--r db-td--date">{fmtDate(t.executedAt || t.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

// ── Recent transactions ───────────────────────────────────────────────────────

const RecentTransactions = ({ transactions, isLoading }) => (
  <div className="db-section db-section--txs">
    <div className="db-section-head">
      <div className="db-section-title">Recent Transactions</div>
      <Link to="/wallet" className="db-view-link">View all <i className="bi bi-arrow-right" /></Link>
    </div>

    {isLoading ? (
      <div className="db-skel-list">
        {[1,2,3,4].map(i=>(
          <div key={i} className="db-tx-item">
            <Shimmer h={36} w={36} r={50} />
            <div style={{ flex:1 }}><Shimmer h={13} w="60%" mb={5} /><Shimmer h={10} w="40%" /></div>
            <div><Shimmer h={13} w={80} mb={5} /><Shimmer h={10} w={50} /></div>
          </div>
        ))}
      </div>
    ) : transactions.length === 0 ? (
      <div className="db-empty db-empty--sm">
        <i className="bi bi-clock-history" />
        <div className="db-empty-h">No transactions yet</div>
        <div className="db-empty-sub">Your activity will appear here.</div>
      </div>
    ) : (
      <div className="db-tx-list">
        {transactions.map(tx => {
          const isTransfer = tx.type === "transfer";
          const isIn       = isTransfer ? tx.direction === "in" : tx.type === "deposit" || tx.type === "trade_buy";
          const isCredit   = isIn;

          const iconCfg = isTransfer
            ? isIn
              ? { icon: "bi-send-fill",            bg: "rgba(240,185,11,0.12)",  color: "#f0b90b", label: "Received" }
              : { icon: "bi-send-fill",            bg: "rgba(240,185,11,0.12)",  color: "#f0b90b", label: "Sent" }
            : {
                deposit:    { icon: "bi-arrow-down-circle-fill", bg: "rgba(14,203,129,0.12)", color: "#0ecb81", label: "Deposit"    },
                withdrawal: { icon: "bi-arrow-up-circle-fill",   bg: "rgba(246,70,93,0.12)",  color: "#f6465d", label: "Withdrawal" },
                trade:      { icon: "bi-bar-chart-line-fill",    bg: "rgba(96,165,250,0.12)", color: "#60a5fa", label: "Trade"      },
              }[tx.type] || { icon: "bi-arrow-left-right", bg: "rgba(132,142,156,0.12)", color: "#848e9c", label: tx.type || "—" };

          return (
            <div key={tx._id} className="db-tx-item">
              <div className="db-tx-ico" style={{ background: iconCfg.bg, color: iconCfg.color }}>
                <i className={`bi ${iconCfg.icon}`} style={isTransfer && !isIn ? { transform: "scaleX(-1)" } : {}} />
              </div>
              <div className="db-tx-info">
                <div className="db-tx-type">{iconCfg.label}</div>
                <div className="db-tx-date">{fmtDate(tx.createdAt)}</div>
              </div>
              <div className="db-tx-right">
                <div className="db-tx-amt" style={{ color: isCredit ? "#0ecb81" : "#f6465d" }}>
                  {isCredit ? "+" : "−"}{fmtCrypto(tx.amount, 4)} {tx.asset}
                </div>
                <span className={`db-tx-status db-tx-status--${tx.status}`}>{tx.status}</span>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
);

// ── Main Dashboard ────────────────────────────────────────────────────────────

const Dashboard = () => {
  const navigate = useNavigate();
  const { user: authUser, logout, isAuthenticated, refreshUser } = useAuthStore();
  useEffect(() => { refreshUser(); }, [refreshUser]);

  // ── All hooks before any conditional return ───────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data, isLoading, isError, error, refetch } = useDashboardQuery();
  const socketStatus = useDashboardSocket({ enabled: isAuthenticated });
  const tickers      = useLiveMarketStore(s => s.tickers);
  useMarketSocket();

  // ── Auth guard ────────────────────────────────────────────────────────────
  const tok = localStorage.getItem("token");
  let usr = null;
  try { const r = localStorage.getItem("user"); usr = r && r !== "null" ? JSON.parse(r) : null; } catch {}
  if (!isAuthenticated && !(tok && usr && typeof usr === "object")) {
    return <Navigate to="/login" replace />;
  }

  const user         = data?.user               || authUser || {};
  const portfolio    = data?.portfolio          || {};
  const wallets      = data?.wallets            || [];
  const trades       = data?.recentTrades       || [];
  const transactions = data?.recentTransactions || [];

  return (
    <div className="dash-root">
      <DashNavbar
        onMenuClick={() => setSidebarOpen(v => !v)}
        connectionStatus={socketStatus}
      />

      {/* Live price ticker */}
      <TickerBar tickers={tickers} />

      <div className="dash-body">
        <DashSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onLogout={() => { logout(); navigate("/login"); }}
        />

        <main className="dash-main db-page">

          {/* Error */}
          {isError && (
            <div className="dash-error-banner">
              <i className="bi bi-exclamation-triangle-fill" />
              <span>{error?.message || "Failed to load dashboard data."}</span>
              <button className="dash-error-retry" onClick={() => refetch()}>Retry</button>
            </div>
          )}

          {/* Welcome */}
          <WelcomeBar user={user} socketStatus={socketStatus} isLoading={isLoading} />

          {/* Portfolio hero */}
          <PortfolioHero
            portfolio={portfolio}
            wallets={wallets}
            isLoading={isLoading}
            onNavigate={navigate}
            tickers={tickers}
          />

          {/* Stat cards */}
          <StatGrid
            portfolio={portfolio}
            user={user}
            tickers={tickers}
            wallets={wallets}
            isLoading={isLoading}
          />

          {/* Asset table */}
          <AssetTable wallets={wallets} isLoading={isLoading} onNavigate={navigate} />

          {/* Activity row */}
          <div className="db-activity-row">
            <RecentTrades    trades={trades}           isLoading={isLoading} />
            <RecentTransactions transactions={transactions} isLoading={isLoading} />
          </div>

        </main>
      </div>
    </div>
  );
};

export default Dashboard;
