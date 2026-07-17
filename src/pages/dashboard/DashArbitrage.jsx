import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery }   from "@tanstack/react-query";
import { useAuthStore } from "../../store/authStore";
import DashNavbar     from "../../Components/layout/DashNavbar";
import DashSidebar    from "../../Components/dashboard/DashSidebar";
import { arbitrageApi } from "../../services/api/arbitrage.js";
import "../../styles/dashboard.css";
import "../../styles/enterprise.css";

const fmt  = (v, d = 2) => Number(v || 0).toFixed(d);
const fmtK = (v) => { const n = Math.abs(Number(v||0)); return n>=1e6?`$${(n/1e6).toFixed(2)}M`:n>=1e3?`$${(n/1e3).toFixed(1)}K`:`$${n.toFixed(2)}`; };

const STATUS_CLR = { detected:"#f0b90b", executing:"#3b82f6", completed:"#0ecb81", failed:"#f6465d", expired:"#474d57" };
const TYPE_CLR   = { triangular:"#a78bfa", cross_exchange:"#38bdf8", statistical:"#fb923c" };

export default function DashArbitrage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tab, setTab] = useState("live");

  const liveQ    = useQuery({ queryKey: ["arb-live"],    queryFn: arbitrageApi.live,    refetchInterval: 10_000 });
  const historyQ = useQuery({ queryKey: ["arb-history"], queryFn: arbitrageApi.history, enabled: tab === "history" });
  const snapQ    = useQuery({ queryKey: ["arb-snap"],    queryFn: arbitrageApi.snapshot,refetchInterval: 15_000 });

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const live    = liveQ.data?.data    ?? liveQ.data    ?? [];
  const history = historyQ.data?.data ?? historyQ.data ?? [];
  const snap    = snapQ.data?.data    ?? snapQ.data    ?? {};

  return (
    <div className="dash-root">
      <DashNavbar onMenuClick={() => setSidebarOpen(v => !v)} />
      <div className="dash-body">
        <DashSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)}
          onLogout={() => { useAuthStore.getState().logout(); navigate("/login"); }} />
        <main className="dash-main">

          <div className="ent-page-head">
            <div>
              <h1 className="ent-page-title"><i className="bi bi-shuffle" /> Arbitrage</h1>
              <p className="ent-page-sub">Cross-exchange &amp; triangular opportunity detection</p>
            </div>
            <button className="ent-refresh-btn" onClick={() => { liveQ.refetch(); snapQ.refetch(); }}>
              <i className="bi bi-arrow-clockwise" /> Refresh
            </button>
          </div>

          {/* KPI strip */}
          <div className="ent-kpi-strip">
            {[
              { label:"Live Opportunities", val: Array.isArray(live) ? live.length : "—",  icon:"bi-lightning-charge-fill" },
              { label:"Exchanges",          val: snap.exchangeList?.length ?? snap.exchanges ?? "—", icon:"bi-building" },
              { label:"Tracked Pairs",      val: snap.symbolList?.length   ?? snap.activePairs ?? "—", icon:"bi-layers" },
              { label:"Avg Spread",         val: snap.avgSpreadPct != null ? fmt(snap.avgSpreadPct)+"%" : "—", icon:"bi-arrows-expand" },
            ].map(k => (
              <div key={k.label} className="ent-kpi-card">
                <i className={`bi ${k.icon} ent-kpi-icon`} />
                <div className="ent-kpi-val">{k.val}</div>
                <div className="ent-kpi-label">{k.label}</div>
              </div>
            ))}
          </div>

          <div className="ent-tabs">
            {[
              { id:"live",    icon:"bi-lightning-charge-fill", label:"Live"    },
              { id:"history", icon:"bi-clock-history",         label:"History" },
              { id:"market",  icon:"bi-bar-chart-line",        label:"Market Snapshot" },
            ].map(t => (
              <button key={t.id} className={`ent-tab${tab===t.id?" ent-tab--active":""}`} onClick={() => setTab(t.id)}>
                <i className={`bi ${t.icon}`} /> {t.label}
              </button>
            ))}
          </div>

          {tab === "live" && (
            <div className="ent-card">
              {liveQ.isLoading ? <EntLoading text="Scanning markets…" />
              : liveQ.isError  ? <EntError onRetry={() => liveQ.refetch()} />
              : !live.length   ? <EntEmpty icon="bi-search" text="No live opportunities right now — scanner is active." />
              : <EntTable
                  heads={["Pair","Type","Buy On","Sell On","Spread","Est. Profit","Status"]}
                  rows={live.map(o => [
                    <strong>{o.symbol||o.pair||"—"}</strong>,
                    <TypeBadge type={o.type} />,
                    o.buyExchange||o.lowExchange||"—",
                    o.sellExchange||o.highExchange||"—",
                    <span className="ent-green">{o.spreadPct!=null?fmt(o.spreadPct)+"%":o.netSpreadPct!=null?fmt(o.netSpreadPct)+"%":"—"}</span>,
                    <span className="ent-green">{o.estimatedNetProfit!=null?fmtK(o.estimatedNetProfit):o.estimatedProfit!=null?fmtK(o.estimatedProfit):"—"}</span>,
                    <StatusBadge status={o.status} />,
                  ])}
                />}
            </div>
          )}

          {tab === "history" && (
            <div className="ent-card">
              {historyQ.isLoading ? <EntLoading text="Loading history…" />
              : !history.length   ? <EntEmpty icon="bi-clock-history" text="No arbitrage history yet." />
              : <EntTable
                  heads={["Pair","Type","Spread","Net Profit","Status","Detected"]}
                  rows={history.map(o => [
                    <strong>{o.symbol||o.pair||"—"}</strong>,
                    <TypeBadge type={o.type} />,
                    (o.spreadPct!=null?fmt(o.spreadPct)+"%":"—"),
                    <span className={o.estimatedNetProfit>0?"ent-green":"ent-red"}>{o.estimatedNetProfit!=null?fmtK(o.estimatedNetProfit):"—"}</span>,
                    <StatusBadge status={o.status} />,
                    o.detectedAt?new Date(o.detectedAt).toLocaleString():"—",
                  ])}
                />}
            </div>
          )}

          {tab === "market" && (
            <div className="ent-grid-2">
              <div className="ent-card">
                <div className="ent-card-title"><i className="bi bi-building ent-gold" /> Active Exchanges</div>
                {snap.exchangeList?.length ? snap.exchangeList.map((e,i)=>(
                  <div key={i} className="ent-row-item">
                    <span>{typeof e==="string"?e:e.name||e}</span>
                    <span className="ent-badge ent-badge--green">Live</span>
                  </div>
                )) : <p className="ent-muted">No exchange data.</p>}
              </div>
              <div className="ent-card">
                <div className="ent-card-title"><i className="bi bi-layers ent-gold" /> Tracked Pairs</div>
                {snap.symbolList?.length ? (
                  <div className="ent-tag-cloud">
                    {snap.symbolList.slice(0,24).map((s,i)=><span key={i} className="ent-tag">{typeof s==="string"?s:s.symbol||s}</span>)}
                    {snap.symbolList.length>24&&<span className="ent-muted">+{snap.symbolList.length-24} more</span>}
                  </div>
                ) : <p className="ent-muted">Fetching pairs…</p>}
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

/* ── Shared sub-components ────────────────────────────────────────────────── */
function StatusBadge({ status }) {
  return <span className="ent-badge" style={{background:STATUS_CLR[status]||"#474d57",color:"#fff"}}>{status||"—"}</span>;
}
function TypeBadge({ type }) {
  return <span className="ent-badge" style={{background:TYPE_CLR[type]||"#2b2f36",color:"#fff"}}>{type?.replace(/_/g," ")||"—"}</span>;
}
function EntLoading({ text }) {
  return <div className="ent-loading"><div className="ent-spinner" /><span>{text}</span></div>;
}
function EntError({ onRetry }) {
  return <div className="ent-error"><i className="bi bi-exclamation-triangle" /> Failed to load. <button onClick={onRetry}>Retry</button></div>;
}
function EntEmpty({ icon, text }) {
  return <div className="ent-empty"><i className={`bi ${icon} ent-empty-icon`} /><p>{text}</p></div>;
}
function EntTable({ heads, rows }) {
  return (
    <div className="ent-table-wrap">
      <table className="ent-table">
        <thead><tr>{heads.map(h=><th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
