import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery }    from "@tanstack/react-query";
import { useAuthStore } from "../../store/authStore";
import DashNavbar      from "../../Components/layout/DashNavbar";
import DashSidebar     from "../../Components/dashboard/DashSidebar";
import { executionRouterApi } from "../../services/api/executionRouter.js";
import "../../styles/dashboard.css";
import "../../styles/enterprise.css";

const fmt   = (v, d = 2) => Number(v||0).toFixed(d);
const fmtTs = (v) => v ? new Date(v).toLocaleString() : "—";

const STATUS_CLR   = { planned:"#f0b90b", executing:"#3b82f6", completed:"#0ecb81", failed:"#f6465d", partial:"#fb923c" };
const STRATEGY_CLR = { single:"#474d57", split:"#3b82f6", twap:"#a78bfa", iceberg:"#38bdf8" };
const STRATEGY_ICON= { single:"bi-arrow-right", split:"bi-diagram-3", twap:"bi-clock-history", iceberg:"bi-layers-half" };

export default function DashExecutionRouter() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tab, setTab] = useState("stats");

  const statsQ   = useQuery({ queryKey:["er-stats"],   queryFn: executionRouterApi.stats,   refetchInterval:15_000 });
  const latencyQ = useQuery({ queryKey:["er-latency"], queryFn: executionRouterApi.latency, refetchInterval:20_000, enabled: tab==="latency" });
  const historyQ = useQuery({ queryKey:["er-history"], queryFn: executionRouterApi.history, enabled: tab==="history" });

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const stats   = statsQ.data?.data   ?? statsQ.data   ?? {};
  const latency = latencyQ.data?.data ?? latencyQ.data ?? {};
  const history = historyQ.data?.data ?? historyQ.data ?? [];

  const byStrategy = stats.byStrategy ?? {};
  const strategies = Object.entries(byStrategy);

  return (
    <div className="dash-root">
      <DashNavbar onMenuClick={() => setSidebarOpen(v=>!v)} />
      <div className="dash-body">
        <DashSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)}
          onLogout={() => { useAuthStore.getState().logout(); navigate("/login"); }} />
        <main className="dash-main">

          <div className="ent-page-head">
            <div>
              <h1 className="ent-page-title"><i className="bi bi-diagram-3-fill" /> Execution Router</h1>
              <p className="ent-page-sub">Smart order routing · TWAP · Iceberg · Slippage optimization</p>
            </div>
            <button className="ent-refresh-btn" onClick={() => { statsQ.refetch(); latencyQ.refetch(); }}>
              <i className="bi bi-arrow-clockwise" /> Refresh
            </button>
          </div>

          {/* KPIs */}
          <div className="ent-kpi-strip">
            {[
              { label:"Total Routes",     val: stats.totalRoutes    ?? "—", icon:"bi-arrow-right-circle" },
              { label:"Completed",        val: stats.completed      ?? "—", icon:"bi-check-circle", green:true },
              { label:"Avg Slippage",     val: stats.avgSlippagePct != null ? fmt(stats.avgSlippagePct)+"%" : "—", icon:"bi-arrows-expand" },
              { label:"Avg Latency",      val: stats.avgRoutingMs   != null ? fmt(stats.avgRoutingMs,0)+"ms" : "—", icon:"bi-speedometer" },
            ].map(k=>(
              <div key={k.label} className="ent-kpi-card">
                <i className={`bi ${k.icon} ent-kpi-icon`} style={k.green?{color:"#0ecb81"}:{}} />
                <div className="ent-kpi-val">{k.val}</div>
                <div className="ent-kpi-label">{k.label}</div>
              </div>
            ))}
          </div>

          <div className="ent-tabs">
            {[
              { id:"stats",   icon:"bi-bar-chart-line",  label:"Stats"    },
              { id:"latency", icon:"bi-speedometer",     label:"Latency"  },
              { id:"history", icon:"bi-clock-history",   label:"History"  },
            ].map(t=>(
              <button key={t.id} className={`ent-tab${tab===t.id?" ent-tab--active":""}`} onClick={()=>setTab(t.id)}>
                <i className={`bi ${t.icon}`} /> {t.label}
              </button>
            ))}
          </div>

          {tab === "stats" && (
            <div className="ent-grid-2">
              {/* Strategy breakdown */}
              <div className="ent-card">
                <div className="ent-card-title"><i className="bi bi-diagram-3 ent-gold" /> Strategy Usage</div>
                {statsQ.isLoading ? <div className="ent-loading"><div className="ent-spinner"/></div>
                : !strategies.length ? <p className="ent-muted">No routes executed yet.</p>
                : strategies.map(([strategy, count])=>(
                  <div key={strategy} className="ent-strat-row">
                    <div className="ent-strat-left">
                      <i className={`bi ${STRATEGY_ICON[strategy]||"bi-arrow-right"}`} style={{color:STRATEGY_CLR[strategy]||"#848e9c"}} />
                      <span style={{textTransform:"capitalize"}}>{strategy}</span>
                    </div>
                    <div className="ent-strat-bar-wrap">
                      <div className="ent-strat-bar" style={{
                        width: strategies.length ? `${(count/(Math.max(...Object.values(byStrategy))||1))*100}%` : "0%",
                        background: STRATEGY_CLR[strategy]||"#2b2f36",
                      }} />
                    </div>
                    <span className="ent-kpi-val" style={{fontSize:"1rem",minWidth:30}}>{count}</span>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="ent-card">
                <div className="ent-card-title"><i className="bi bi-info-circle ent-gold" /> Summary</div>
                {[
                  { label:"Total Routes",      val: stats.totalRoutes   ?? "—" },
                  { label:"Completed",         val: stats.completed     ?? "—" },
                  { label:"Failed",            val: stats.failed        ?? "—" },
                  { label:"Avg Fill Rate",     val: stats.avgFillRate   != null ? fmt(stats.avgFillRate*100)+"%" : "—" },
                  { label:"Avg Slippage",      val: stats.avgSlippagePct!= null ? fmt(stats.avgSlippagePct)+"%" : "—" },
                  { label:"Avg Routing Ms",    val: stats.avgRoutingMs  != null ? fmt(stats.avgRoutingMs,0)+"ms" : "—" },
                ].map(r=>(
                  <div key={r.label} className="ent-row-item">
                    <span className="ent-muted">{r.label}</span>
                    <strong>{String(r.val)}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "latency" && (
            <div className="ent-card">
              <div className="ent-card-title"><i className="bi bi-speedometer ent-gold" /> Venue Latency Report</div>
              {latencyQ.isLoading ? <div className="ent-loading"><div className="ent-spinner"/></div>
              : !Object.keys(latency).length ? (
                <div className="ent-empty"><i className="bi bi-speedometer ent-empty-icon"/><p>No latency data yet.</p></div>
              ) : (
                <div className="ent-table-wrap"><table className="ent-table">
                  <thead><tr><th>Venue</th><th>Avg Latency</th><th>Samples</th><th>Status</th></tr></thead>
                  <tbody>{Object.entries(latency).map(([venue, info])=>{
                    const avg = typeof info==="number" ? info : info?.avg ?? 0;
                    const slow = avg > 500;
                    return (
                      <tr key={venue}>
                        <td><strong>{venue}</strong></td>
                        <td style={{color:slow?"#f6465d":avg>200?"#f0b90b":"#0ecb81"}}>{fmt(avg,0)} ms</td>
                        <td className="ent-muted">{info?.samples ?? "—"}</td>
                        <td><span className="ent-badge" style={{background:slow?"#f6465d":"#0ecb81"}}>{slow?"SLOW":"FAST"}</span></td>
                      </tr>
                    );
                  })}</tbody>
                </table></div>
              )}
            </div>
          )}

          {tab === "history" && (
            <div className="ent-card">
              {historyQ.isLoading ? <div className="ent-loading"><div className="ent-spinner"/><span>Loading routes…</span></div>
              : !history.length ? (
                <div className="ent-empty"><i className="bi bi-clock-history ent-empty-icon"/><p>No route history yet.</p></div>
              ) : (
                <div className="ent-table-wrap"><table className="ent-table">
                  <thead><tr><th>Pair</th><th>Strategy</th><th>Side</th><th>Qty</th><th>Slippage</th><th>Status</th><th>Time</th></tr></thead>
                  <tbody>{history.map((r,i)=>(
                    <tr key={r._id||i}>
                      <td><strong>{r.pair||"—"}</strong></td>
                      <td><span className="ent-badge" style={{background:STRATEGY_CLR[r.strategy]||"#474d57"}}>{r.strategy||"—"}</span></td>
                      <td><span className="ent-badge" style={{background:r.side==="buy"?"#0ecb81":"#f6465d"}}>{r.side||"—"}</span></td>
                      <td>{r.totalQuantity!=null?fmt(r.totalQuantity,4):"—"}</td>
                      <td>{r.actualSlippagePct!=null?fmt(r.actualSlippagePct)+"%":r.estimatedSlippagePct!=null?fmt(r.estimatedSlippagePct)+"% est":"—"}</td>
                      <td><span className="ent-badge" style={{background:STATUS_CLR[r.status]||"#474d57"}}>{r.status||"—"}</span></td>
                      <td className="ent-muted">{fmtTs(r.createdAt)}</td>
                    </tr>
                  ))}</tbody>
                </table></div>
              )}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
