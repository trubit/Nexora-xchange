import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery }    from "@tanstack/react-query";
import { useAuthStore } from "../../store/authStore";
import DashNavbar      from "../../Components/layout/DashNavbar";
import DashSidebar     from "../../Components/dashboard/DashSidebar";
import { marketIntelligenceApi } from "../../services/api/marketIntelligence.js";
import "../../styles/dashboard.css";
import "../../styles/enterprise.css";

const fmtK  = (v) => { const n=Math.abs(Number(v||0)); return n>=1e6?`$${(n/1e6).toFixed(2)}M`:n>=1e3?`$${(n/1e3).toFixed(1)}K`:`$${n.toFixed(2)}`; };
const fmtTs = (v) => v ? new Date(v).toLocaleString() : "—";

const SEV_CLR = { CRITICAL:"#f6465d", HIGH:"#fb923c", MEDIUM:"#f0b90b", LOW:"#3b82f6" };
const TYPE_CLR= {
  ANOMALY:"#f6465d", WHALE_MOVE:"#a78bfa", LIQUIDITY_IMBALANCE:"#3b82f6",
  MANIPULATION:"#fb923c", VOLATILITY_SPIKE:"#f0b90b", TREND_REVERSAL:"#38bdf8", CIRCUIT_BREAKER:"#f6465d",
};
const TYPE_ICON = {
  ANOMALY:"bi-exclamation-octagon", WHALE_MOVE:"bi-water", LIQUIDITY_IMBALANCE:"bi-droplet",
  MANIPULATION:"bi-shield-exclamation", VOLATILITY_SPIKE:"bi-lightning", TREND_REVERSAL:"bi-arrow-left-right",
  CIRCUIT_BREAKER:"bi-stop-circle",
};

export default function DashMarketIntelligence() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tab, setTab] = useState("signals");
  const [severityFilter, setSeverityFilter] = useState("");

  const signalsQ = useQuery({ queryKey:["mi-signals", severityFilter], queryFn: () => marketIntelligenceApi.signals({ severity: severityFilter||undefined }), refetchInterval:15_000 });
  const whalesQ  = useQuery({ queryKey:["mi-whales"],  queryFn: marketIntelligenceApi.whaleActivity, refetchInterval:20_000, enabled: tab==="whales" });
  const statsQ   = useQuery({ queryKey:["mi-stats"],   queryFn: marketIntelligenceApi.stats,         refetchInterval:30_000 });

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const signals = signalsQ.data?.data ?? signalsQ.data ?? [];
  const whales  = whalesQ.data?.data  ?? whalesQ.data  ?? [];
  const stats   = statsQ.data?.data   ?? statsQ.data   ?? {};

  return (
    <div className="dash-root">
      <DashNavbar onMenuClick={() => setSidebarOpen(v=>!v)} />
      <div className="dash-body">
        <DashSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)}
          onLogout={() => { useAuthStore.getState().logout(); navigate("/login"); }} />
        <main className="dash-main">

          <div className="ent-page-head">
            <div>
              <h1 className="ent-page-title"><i className="bi bi-radar" /> Market Intelligence</h1>
              <p className="ent-page-sub">Autonomous anomaly detection · whale tracking · manipulation alerts</p>
            </div>
            <div style={{display:"flex",gap:"0.5rem",alignItems:"center"}}>
              <span className="ent-live-dot" />
              <span className="ent-muted" style={{fontSize:"0.75rem"}}>
                {stats.running?"LIVE":"Offline"} · {stats.trackedPairs??0} pairs · {stats.scans??0} scans
              </span>
              <button className="ent-refresh-btn" onClick={() => { signalsQ.refetch(); statsQ.refetch(); }}>
                <i className="bi bi-arrow-clockwise" />
              </button>
            </div>
          </div>

          {/* KPIs */}
          <div className="ent-kpi-strip">
            {[
              { label:"Total Signals", val: stats.signals    ?? "—", icon:"bi-bell"           },
              { label:"Whale Events",  val: stats.whales     ?? "—", icon:"bi-water"          },
              { label:"Tracked Pairs", val: stats.trackedPairs??"—", icon:"bi-layers"         },
              { label:"Errors",        val: stats.errors     ?? 0,   icon:"bi-exclamation-triangle", red: true },
            ].map(k=>(
              <div key={k.label} className="ent-kpi-card">
                <i className={`bi ${k.icon} ent-kpi-icon`} style={k.red&&Number(k.val)>0?{color:"#f6465d"}:{}} />
                <div className="ent-kpi-val" style={k.red&&Number(k.val)>0?{color:"#f6465d"}:{}}>{k.val}</div>
                <div className="ent-kpi-label">{k.label}</div>
              </div>
            ))}
          </div>

          <div className="ent-tabs">
            {[
              { id:"signals", icon:"bi-bell-fill",  label:"Signals" },
              { id:"whales",  icon:"bi-water",      label:"Whale Activity" },
            ].map(t=>(
              <button key={t.id} className={`ent-tab${tab===t.id?" ent-tab--active":""}`} onClick={()=>setTab(t.id)}>
                <i className={`bi ${t.icon}`} /> {t.label}
                {t.id==="signals"&&Array.isArray(signals)&&signals.filter(s=>s.severity==="CRITICAL"||s.severity==="HIGH").length>0 &&
                  <span className="ent-badge ent-badge--red" style={{marginLeft:6}}>!</span>}
              </button>
            ))}
          </div>

          {tab === "signals" && (
            <div>
              <div className="ent-filter-row">
                <span className="ent-muted">Filter by severity:</span>
                {["","CRITICAL","HIGH","MEDIUM","LOW"].map(sv=>(
                  <button key={sv} className={`ent-filter-btn${severityFilter===sv?" ent-filter-btn--active":""}`} onClick={()=>setSeverityFilter(sv)}>
                    {sv||"All"}
                  </button>
                ))}
              </div>
              {signalsQ.isLoading ? <div className="ent-loading"><div className="ent-spinner"/><span>Loading signals…</span></div>
              : !signals.length ? (
                <div className="ent-empty">
                  <i className="bi bi-bell ent-empty-icon" />
                  <p>No market signals detected{severityFilter?` at ${severityFilter} severity`:""}.</p>
                  <span className="ent-muted">Scanner running — anomalies will appear here in real time.</span>
                </div>
              ) : (
                <div className="ent-signal-list">
                  {signals.map((s,i)=>(
                    <div key={s._id||i} className="ent-signal-card" style={{borderLeftColor:SEV_CLR[s.severity]||"#2b2f36"}}>
                      <div className="ent-signal-head">
                        <i className={`bi ${TYPE_ICON[s.type]||"bi-bell"}`} style={{color:TYPE_CLR[s.type]||"#848e9c"}} />
                        <span className="ent-signal-type">{s.type?.replace(/_/g," ")||"—"}</span>
                        <span className="ent-badge" style={{background:SEV_CLR[s.severity]||"#474d57"}}>{s.severity||"—"}</span>
                        {s.pair && <span className="ent-tag">{s.pair}</span>}
                        <span className="ent-muted" style={{marginLeft:"auto",fontSize:"0.72rem"}}>{fmtTs(s.createdAt)}</span>
                      </div>
                      <p className="ent-signal-desc">{s.description||"—"}</p>
                      <div className="ent-signal-meta">
                        {s.price    &&<span>Price: <strong>${Number(s.price).toFixed(4)}</strong></span>}
                        {s.volume   &&<span>Volume: <strong>{fmtK(s.volume)}</strong></span>}
                        {s.confidence!=null&&<span>Confidence: <strong>{(s.confidence*100).toFixed(0)}%</strong></span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "whales" && (
            <div className="ent-card">
              {whalesQ.isLoading ? <div className="ent-loading"><div className="ent-spinner"/><span>Loading whale activity…</span></div>
              : !whales.length ? (
                <div className="ent-empty">
                  <i className="bi bi-water ent-empty-icon" />
                  <p>No whale activity recorded yet.</p>
                </div>
              ) : (
                <div className="ent-table-wrap"><table className="ent-table">
                  <thead><tr><th>Pair</th><th>Side</th><th>Amount (USD)</th><th>Source</th><th>Impact</th><th>Time</th></tr></thead>
                  <tbody>{whales.map((w,i)=>(
                    <tr key={w._id||i}>
                      <td><strong>{w.pair||"—"}</strong></td>
                      <td><span className="ent-badge" style={{background:w.side==="buy"?"#0ecb81":"#f6465d"}}>{w.side||"—"}</span></td>
                      <td className={w.side==="buy"?"ent-green":"ent-red"}>{fmtK(w.amountUsd)}</td>
                      <td className="ent-muted">{w.source||"—"} {w.exchange?`/ ${w.exchange}`:""}</td>
                      <td>{w.impactPct!=null?<span>{Number(w.impactPct).toFixed(2)}%</span>:"—"}</td>
                      <td className="ent-muted">{fmtTs(w.createdAt)}</td>
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
