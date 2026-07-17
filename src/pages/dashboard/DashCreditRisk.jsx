import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery }    from "@tanstack/react-query";
import { useAuthStore } from "../../store/authStore";
import DashNavbar      from "../../Components/layout/DashNavbar";
import DashSidebar     from "../../Components/dashboard/DashSidebar";
import { creditRiskApi } from "../../services/api/creditRisk.js";
import "../../styles/dashboard.css";
import "../../styles/enterprise.css";

const fmt = (v, d = 2) => Number(v || 0).toFixed(d);

const TIER_CLR = {
  EXCELLENT:"#0ecb81", GOOD:"#3b82f6", FAIR:"#f0b90b",
  POOR:"#fb923c",      BAD:"#f6465d",  UNRATED:"#474d57",
};
const RISK_CLR = {
  CONSERVATIVE:"#0ecb81", MODERATE:"#3b82f6", AGGRESSIVE:"#f0b90b",
  SPECULATIVE:"#fb923c",  EXTREME:"#f6465d",
};

function ScoreGauge({ score, max=100, color="#f0b90b" }) {
  const r = 52, cx = 64, cy = 64, sw = 10;
  const circ = 2*Math.PI*r, pct = Math.min(Math.max(score/max,0),1);
  const dash = pct*circ;
  return (
    <svg width="128" height="128" viewBox="0 0 128 128">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#2b2f36" strokeWidth={sw} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={sw}
        strokeDasharray={`${dash} ${circ-dash}`} strokeDashoffset={-circ*0.25}
        strokeLinecap="round" style={{transition:"stroke-dasharray .5s"}} />
      <text x={cx} y={cy-4}  textAnchor="middle" fontSize="26" fontWeight="800" fill="#eaecef">{Math.round(score)}</text>
      <text x={cx} y={cy+14} textAnchor="middle" fontSize="10" fill="#848e9c">/ {max}</text>
    </svg>
  );
}

export default function DashCreditRisk() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tab, setTab] = useState("overview");

  const summaryQ  = useQuery({ queryKey:["cr-summary"],  queryFn: creditRiskApi.summary  });
  const creditQ   = useQuery({ queryKey:["cr-credit"],   queryFn: creditRiskApi.credit,  enabled: tab==="credit"   });
  const behaviorQ = useQuery({ queryKey:["cr-behavior"], queryFn: creditRiskApi.behavior, enabled: tab==="behavior" });
  const exposureQ = useQuery({ queryKey:["cr-exposure"], queryFn: creditRiskApi.exposure, enabled: tab==="exposure" });
  const heatmapQ  = useQuery({ queryKey:["cr-heatmap"],  queryFn: creditRiskApi.heatmap,  enabled: tab==="heatmap"  });

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const s   = summaryQ.data?.data ?? summaryQ.data ?? {};
  const cr  = creditQ.data?.data  ?? creditQ.data  ?? {};
  const beh = behaviorQ.data?.data?? behaviorQ.data?? {};
  const exp = exposureQ.data?.data?? exposureQ.data?? {};
  const hm  = heatmapQ.data?.data ?? heatmapQ.data ?? {};

  const creditScore   = s.creditScore   ?? cr.score   ?? 0;
  const behaviorScore = s.behaviorScore ?? beh.score  ?? 0;
  const creditTier    = s.creditTier    ?? cr.tier    ?? "UNRATED";
  const riskTier      = s.riskTier      ?? beh.tier   ?? "UNRATED";
  const riskScore     = s.riskScore     ?? 0;

  return (
    <div className="dash-root">
      <DashNavbar onMenuClick={() => setSidebarOpen(v=>!v)} />
      <div className="dash-body">
        <DashSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)}
          onLogout={() => { useAuthStore.getState().logout(); navigate("/login"); }} />
        <main className="dash-main">

          <div className="ent-page-head">
            <div>
              <h1 className="ent-page-title"><i className="bi bi-shield-fill-check" /> Financial Risk Intelligence</h1>
              <p className="ent-page-sub">Your credit score, trading behavior, and risk exposure</p>
            </div>
            <button className="ent-refresh-btn" onClick={() => summaryQ.refetch()}>
              <i className="bi bi-arrow-clockwise" /> Refresh
            </button>
          </div>

          {/* Score gauges */}
          {summaryQ.isLoading
            ? <div className="ent-loading"><div className="ent-spinner"/><span>Calculating your risk profile…</span></div>
            : (
              <div className="ent-gauge-row">
                <div className="ent-gauge-card">
                  <ScoreGauge score={creditScore} color={TIER_CLR[creditTier]||"#f0b90b"} />
                  <div className="ent-gauge-label">Credit Score</div>
                  <span className="ent-badge" style={{background:TIER_CLR[creditTier]||"#474d57"}}>{creditTier}</span>
                </div>
                <div className="ent-gauge-card">
                  <ScoreGauge score={behaviorScore} color={RISK_CLR[riskTier]||"#f0b90b"} />
                  <div className="ent-gauge-label">Behavior Score</div>
                  <span className="ent-badge" style={{background:RISK_CLR[riskTier]||"#474d57"}}>{riskTier}</span>
                </div>
                <div className="ent-gauge-card">
                  <ScoreGauge score={riskScore} color={riskScore>70?"#f6465d":riskScore>40?"#fb923c":"#0ecb81"} />
                  <div className="ent-gauge-label">Risk Score</div>
                  <span className="ent-badge" style={{background:riskScore>70?"#f6465d":riskScore>40?"#fb923c":"#0ecb81"}}>
                    {riskScore>70?"HIGH":riskScore>40?"MEDIUM":"LOW"}
                  </span>
                </div>
              </div>
            )}

          <div className="ent-tabs">
            {[
              { id:"overview",  icon:"bi-grid",              label:"Overview"   },
              { id:"credit",    icon:"bi-credit-card",       label:"Credit"     },
              { id:"behavior",  icon:"bi-activity",          label:"Behavior"   },
              { id:"exposure",  icon:"bi-exclamation-circle",label:"Exposure"   },
              { id:"heatmap",   icon:"bi-grid-3x3-gap",      label:"Heatmap"    },
            ].map(t => (
              <button key={t.id} className={`ent-tab${tab===t.id?" ent-tab--active":""}`} onClick={() => setTab(t.id)}>
                <i className={`bi ${t.icon}`} /> {t.label}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <div className="ent-grid-2">
              <div className="ent-card">
                <div className="ent-card-title"><i className="bi bi-person-fill-check ent-gold" /> Risk Profile Summary</div>
                {[
                  { label:"Credit Tier",      val: creditTier,    clr: TIER_CLR[creditTier] },
                  { label:"Behavior Tier",    val: riskTier,      clr: RISK_CLR[riskTier]  },
                  { label:"Active Positions", val: exp.positions?.length ?? s.openPositions ?? 0 },
                  { label:"Total Exposure",   val: exp.totalExposureUsd ? "$"+fmt(exp.totalExposureUsd) : "$0" },
                  { label:"Anomalies",        val: beh.anomalies?.length ?? 0 },
                ].map(row => (
                  <div key={row.label} className="ent-row-item">
                    <span className="ent-muted">{row.label}</span>
                    <span style={row.clr?{color:row.clr}:{}}><strong>{String(row.val)}</strong></span>
                  </div>
                ))}
              </div>
              <div className="ent-card">
                <div className="ent-card-title"><i className="bi bi-exclamation-triangle ent-gold" /> Risk Alerts</div>
                {(s.alerts||beh.anomalies||[]).length ? (
                  (s.alerts||beh.anomalies).map((a,i)=>(
                    <div key={i} className="ent-alert-row">
                      <i className="bi bi-dot" style={{color:"#f6465d"}} />
                      <span>{typeof a==="string"?a:a.type||a.message||JSON.stringify(a)}</span>
                    </div>
                  ))
                ) : <div className="ent-empty-sm"><i className="bi bi-check-circle ent-green"/> No active risk alerts.</div>}
              </div>
            </div>
          )}

          {tab === "credit" && (
            <div className="ent-card">
              {creditQ.isLoading ? <div className="ent-loading"><div className="ent-spinner"/></div>
              : <div className="ent-detail-grid">
                  {[
                    { label:"Score",           val: creditScore },
                    { label:"Tier",            val: creditTier  },
                    { label:"Payment History", val: cr.paymentHistory ?? "—" },
                    { label:"Account Age",     val: cr.accountAgeDays ? cr.accountAgeDays+" days" : "—" },
                    { label:"Trade Volume",    val: cr.tradeVolumeUsd  ? "$"+fmt(cr.tradeVolumeUsd) : "—" },
                    { label:"Default Risk",    val: cr.defaultRisk     ? fmt(cr.defaultRisk*100)+"%": "—" },
                  ].map(r=>(
                    <div key={r.label} className="ent-detail-item">
                      <div className="ent-detail-label">{r.label}</div>
                      <div className="ent-detail-val">{String(r.val)}</div>
                    </div>
                  ))}
                </div>}
            </div>
          )}

          {tab === "behavior" && (
            <div className="ent-card">
              {behaviorQ.isLoading ? <div className="ent-loading"><div className="ent-spinner"/></div>
              : <div className="ent-detail-grid">
                  {[
                    { label:"Score",          val: behaviorScore },
                    { label:"Risk Tier",      val: riskTier },
                    { label:"Win Rate",       val: beh.winRate      ? fmt(beh.winRate*100)+"%" : "—" },
                    { label:"Avg Hold Time",  val: beh.avgHoldTime  ? beh.avgHoldTime+" min"   : "—" },
                    { label:"Order Count",    val: beh.orderCount   ?? "—" },
                    { label:"Anomalies",      val: beh.anomalies?.length ?? 0 },
                    { label:"Discipline",     val: beh.scores?.discipline ?? "—" },
                    { label:"Consistency",    val: beh.scores?.consistency?? "—" },
                  ].map(r=>(
                    <div key={r.label} className="ent-detail-item">
                      <div className="ent-detail-label">{r.label}</div>
                      <div className="ent-detail-val">{String(r.val)}</div>
                    </div>
                  ))}
                </div>}
            </div>
          )}

          {tab === "exposure" && (
            <div className="ent-card">
              {exposureQ.isLoading ? <div className="ent-loading"><div className="ent-spinner"/></div>
              : !exp.positions?.length
                ? <div className="ent-empty"><i className="bi bi-shield-check ent-empty-icon"/><p>No open exposure positions.</p></div>
                : <div className="ent-table-wrap"><table className="ent-table">
                    <thead><tr><th>Symbol</th><th>Side</th><th>Size</th><th>Entry</th><th>PnL</th><th>Risk</th></tr></thead>
                    <tbody>{exp.positions.map((p,i)=>(
                      <tr key={i}>
                        <td><strong>{p.symbol||"—"}</strong></td>
                        <td><span className="ent-badge" style={{background:p.side==="buy"?"#0ecb81":"#f6465d"}}>{p.side||"—"}</span></td>
                        <td>${fmt(p.sizeUsd)}</td>
                        <td>${fmt(p.entryPrice,4)}</td>
                        <td className={p.unrealizedPnl>=0?"ent-green":"ent-red"}>{p.unrealizedPnl>=0?"+":""}{fmt(p.unrealizedPnl)}</td>
                        <td>{p.riskScore ? <span className="ent-badge" style={{background:p.riskScore>70?"#f6465d":"#f0b90b"}}>{fmt(p.riskScore)}</span> : "—"}</td>
                      </tr>
                    ))}</tbody>
                  </table></div>}
            </div>
          )}

          {tab === "heatmap" && (
            <div className="ent-card">
              {heatmapQ.isLoading ? <div className="ent-loading"><div className="ent-spinner"/></div>
              : <div className="ent-heatmap">
                  {(hm.assets||hm.cells||[]).map((cell,i)=>{
                    const risk = cell.riskScore ?? cell.risk ?? 0;
                    const bg = risk>70?"#f6465d":risk>40?"#fb923c":risk>20?"#f0b90b":"#0ecb81";
                    return (
                      <div key={i} className="ent-heatmap-cell" style={{background:bg+"22",border:`1px solid ${bg}55`}}>
                        <div className="ent-heatmap-sym">{cell.symbol||cell.asset||"?"}</div>
                        <div className="ent-heatmap-score" style={{color:bg}}>{fmt(risk)}</div>
                        <div className="ent-heatmap-val">{cell.value?"$"+fmt(cell.value):""}</div>
                      </div>
                    );
                  })}
                  {!hm.assets?.length && !hm.cells?.length &&
                    <div className="ent-empty"><i className="bi bi-grid-3x3-gap ent-empty-icon"/><p>No heatmap data yet.</p></div>}
                </div>}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
