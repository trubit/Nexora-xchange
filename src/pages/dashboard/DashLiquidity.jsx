import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery }    from "@tanstack/react-query";
import { useAuthStore } from "../../store/authStore";
import DashNavbar      from "../../Components/layout/DashNavbar";
import DashSidebar     from "../../Components/dashboard/DashSidebar";
import { liquidityAggregatorApi } from "../../services/api/liquidityAggregator.js";
import "../../styles/dashboard.css";
import "../../styles/enterprise.css";

const fmt  = (v, d = 2) => Number(v||0).toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d});
const fmtK = (v) => { const n=Math.abs(Number(v||0)); return n>=1e6?`$${(n/1e6).toFixed(2)}M`:n>=1e3?`$${(n/1e3).toFixed(1)}K`:`$${n.toFixed(2)}`; };

const TYPE_CLR = { cex:"#3b82f6", dex:"#a78bfa", internal:"#0ecb81", institutional:"#f0b90b" };

export default function DashLiquidity() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tab, setTab] = useState("overview");
  const [selectedPair, setSelectedPair] = useState("BTC-USD");

  const providersQ = useQuery({ queryKey:["liq-providers"], queryFn: liquidityAggregatorApi.providers, refetchInterval:30_000 });
  const statsQ     = useQuery({ queryKey:["liq-stats"],     queryFn: liquidityAggregatorApi.stats,     refetchInterval:15_000 });
  const bookQ      = useQuery({ queryKey:["liq-book", selectedPair], queryFn: () => liquidityAggregatorApi.book(selectedPair), refetchInterval:5_000, enabled: tab==="book" });

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const providers = providersQ.data?.data ?? providersQ.data ?? [];
  const stats     = statsQ.data?.data     ?? statsQ.data     ?? {};
  const book      = bookQ.data?.data      ?? bookQ.data      ?? {};

  const PAIRS = ["BTC-USD","ETH-USD","BNB-USD","SOL-USD","XRP-USD"];

  return (
    <div className="dash-root">
      <DashNavbar onMenuClick={() => setSidebarOpen(v=>!v)} />
      <div className="dash-body">
        <DashSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)}
          onLogout={() => { useAuthStore.getState().logout(); navigate("/login"); }} />
        <main className="dash-main">

          <div className="ent-page-head">
            <div>
              <h1 className="ent-page-title"><i className="bi bi-droplet-fill" /> Liquidity Aggregator</h1>
              <p className="ent-page-sub">Global liquidity network — aggregated order books from {providers.length} provider{providers.length!==1?"s":""}</p>
            </div>
            <button className="ent-refresh-btn" onClick={() => { providersQ.refetch(); statsQ.refetch(); }}>
              <i className="bi bi-arrow-clockwise" /> Refresh
            </button>
          </div>

          {/* KPIs */}
          <div className="ent-kpi-strip">
            {[
              { label:"Providers",    val: stats.providers    ?? providers.length ?? "—", icon:"bi-building"         },
              { label:"Healthy",      val: stats.healthy      ?? "—",                     icon:"bi-heart-pulse"      },
              { label:"Tracked Pairs",val: stats.pairs        ?? "—",                     icon:"bi-layers"           },
              { label:"Best Bid",     val: book.bestBid       ? "$"+fmt(book.bestBid):"—",icon:"bi-arrow-up-circle"  },
              { label:"Best Ask",     val: book.bestAsk       ? "$"+fmt(book.bestAsk):"—",icon:"bi-arrow-down-circle"},
              { label:"Spread",       val: book.spreadPct     ? fmt(book.spreadPct)+"%":"—",icon:"bi-arrows-expand"  },
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
              { id:"overview", icon:"bi-grid",            label:"Providers"    },
              { id:"book",     icon:"bi-list-ol",         label:"Order Book"   },
            ].map(t=>(
              <button key={t.id} className={`ent-tab${tab===t.id?" ent-tab--active":""}`} onClick={()=>setTab(t.id)}>
                <i className={`bi ${t.icon}`} /> {t.label}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <div className="ent-card">
              {providersQ.isLoading ? <div className="ent-loading"><div className="ent-spinner"/><span>Loading providers…</span></div>
              : !providers.length
                ? <div className="ent-empty"><i className="bi bi-droplet ent-empty-icon"/><p>No liquidity providers registered yet.</p></div>
                : <div className="ent-table-wrap"><table className="ent-table">
                    <thead><tr><th>Provider</th><th>Type</th><th>Priority</th><th>Pairs</th><th>Status</th><th>Health</th></tr></thead>
                    <tbody>{providers.map((p,i)=>(
                      <tr key={p._id||i}>
                        <td><strong>{p.name||"—"}</strong></td>
                        <td><span className="ent-badge" style={{background:TYPE_CLR[p.type]||"#474d57"}}>{p.type||"—"}</span></td>
                        <td>{p.priority??"—"}</td>
                        <td>{p.pairs?.length??0}</td>
                        <td><span className="ent-badge" style={{background:p.enabled?"#0ecb81":"#474d57"}}>{p.enabled?"Active":"Disabled"}</span></td>
                        <td><span className="ent-badge" style={{background:p.healthy?"#0ecb81":"#f6465d"}}>{p.healthy?"Healthy":"Unhealthy"}</span></td>
                      </tr>
                    ))}</tbody>
                  </table></div>}
            </div>
          )}

          {tab === "book" && (
            <div>
              <div className="ent-pair-selector">
                {PAIRS.map(p=>(
                  <button key={p} className={`ent-pair-btn${selectedPair===p?" ent-pair-btn--active":""}`} onClick={()=>setSelectedPair(p)}>{p}</button>
                ))}
              </div>
              {bookQ.isLoading ? <div className="ent-loading"><div className="ent-spinner"/></div>
              : <div className="ent-grid-2">
                  <div className="ent-card">
                    <div className="ent-card-title ent-green"><i className="bi bi-arrow-up-circle"/> Bids — Buy Orders</div>
                    {book.bids?.length ? <div className="ent-table-wrap"><table className="ent-table">
                      <thead><tr><th>Price</th><th>Quantity</th><th>Total</th><th>Providers</th></tr></thead>
                      <tbody>{book.bids.slice(0,10).map((b,i)=>(
                        <tr key={i}>
                          <td className="ent-green">${fmt(b.price,4)}</td>
                          <td>{fmt(b.quantity,6)}</td>
                          <td>{fmtK(b.price*b.quantity)}</td>
                          <td className="ent-muted">{b.providers?.join(", ")||"—"}</td>
                        </tr>
                      ))}</tbody>
                    </table></div> : <p className="ent-muted">No bids.</p>}
                  </div>
                  <div className="ent-card">
                    <div className="ent-card-title ent-red"><i className="bi bi-arrow-down-circle"/> Asks — Sell Orders</div>
                    {book.asks?.length ? <div className="ent-table-wrap"><table className="ent-table">
                      <thead><tr><th>Price</th><th>Quantity</th><th>Total</th><th>Providers</th></tr></thead>
                      <tbody>{book.asks.slice(0,10).map((a,i)=>(
                        <tr key={i}>
                          <td className="ent-red">${fmt(a.price,4)}</td>
                          <td>{fmt(a.quantity,6)}</td>
                          <td>{fmtK(a.price*a.quantity)}</td>
                          <td className="ent-muted">{a.providers?.join(", ")||"—"}</td>
                        </tr>
                      ))}</tbody>
                    </table></div> : <p className="ent-muted">No asks.</p>}
                  </div>
                </div>}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
