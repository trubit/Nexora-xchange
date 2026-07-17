import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore }  from "../../store/authStore";
import DashNavbar        from "../../Components/layout/DashNavbar";
import DashSidebar       from "../../Components/dashboard/DashSidebar";
import { auditLedgerApi } from "../../services/api/auditLedger.js";
import "../../styles/dashboard.css";
import "../../styles/enterprise.css";

const fmtTs = (v) => v ? new Date(v).toLocaleString() : "—";
const TYPE_CLR = {
  DEPOSIT:"#0ecb81", WITHDRAWAL:"#f6465d", TRADE:"#3b82f6", FEE:"#f0b90b",
  ADJUSTMENT:"#a78bfa", TRANSFER:"#38bdf8", SETTLEMENT:"#fb923c", COMPLIANCE:"#848e9c", VOID:"#474d57",
};

export default function DashAuditLedger() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAuthenticated, user } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tab, setTab] = useState("stats");

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== "admin") return (
    <div className="dash-root">
      <DashNavbar onMenuClick={() => setSidebarOpen(v=>!v)} />
      <div className="dash-body">
        <DashSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)}
          onLogout={() => { useAuthStore.getState().logout(); navigate("/login"); }} />
        <main className="dash-main">
          <div className="ent-empty" style={{marginTop:"4rem"}}>
            <i className="bi bi-lock-fill ent-empty-icon" />
            <p>Admin access required.</p>
            <span className="ent-muted">The audit ledger is restricted to administrators.</span>
          </div>
        </main>
      </div>
    </div>
  );

  const statsQ  = useQuery({ queryKey:["al-stats"],   queryFn: auditLedgerApi.stats,         refetchInterval:30_000 });
  const entriesQ= useQuery({ queryKey:["al-entries"],  queryFn: () => auditLedgerApi.entries(), enabled: tab==="entries" });
  const chainQ  = useQuery({ queryKey:["al-chain"],    queryFn: auditLedgerApi.verifyChain,    enabled: tab==="integrity" });
  const reportsQ= useQuery({ queryKey:["al-reports"],  queryFn: auditLedgerApi.reports,        enabled: tab==="reports" });
  const reconQ  = useQuery({ queryKey:["al-recon"],    queryFn: auditLedgerApi.reconciliation, enabled: tab==="reconciliation" });

  const reconMut = useMutation({
    mutationFn: () => auditLedgerApi.runReconciliation({ type:"SPOT" }),
    onSuccess: () => qc.invalidateQueries({ queryKey:["al-recon"] }),
  });

  const reportMut = useMutation({
    mutationFn: () => auditLedgerApi.generateReport({
      type:"ON_DEMAND",
      periodStart: new Date(Date.now()-86400000*30).toISOString(),
      periodEnd:   new Date().toISOString(),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey:["al-reports"] }),
  });

  const stats    = statsQ.data?.data    ?? statsQ.data    ?? {};
  const entries  = entriesQ.data?.data  ?? entriesQ.data  ?? [];
  const chain    = chainQ.data?.data    ?? chainQ.data    ?? {};
  const reports  = reportsQ.data?.data  ?? reportsQ.data  ?? [];
  const recons   = reconQ.data?.data    ?? reconQ.data    ?? [];
  const byType   = stats.byType ?? {};

  return (
    <div className="dash-root">
      <DashNavbar onMenuClick={() => setSidebarOpen(v=>!v)} />
      <div className="dash-body">
        <DashSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)}
          onLogout={() => { useAuthStore.getState().logout(); navigate("/login"); }} />
        <main className="dash-main">

          <div className="ent-page-head">
            <div>
              <h1 className="ent-page-title"><i className="bi bi-journal-lock" /> Audit Ledger</h1>
              <p className="ent-page-sub">Immutable append-only financial ledger · SHA-256 chained · NO deletions ever</p>
            </div>
            <button className="ent-refresh-btn" onClick={() => statsQ.refetch()}>
              <i className="bi bi-arrow-clockwise" /> Refresh
            </button>
          </div>

          {/* KPIs */}
          <div className="ent-kpi-strip">
            {[
              { label:"Total Entries",   val: stats.total       ?? "—", icon:"bi-list-ol"      },
              { label:"Last Entry ID",   val: stats.lastEntryId ?? "—", icon:"bi-hash"         },
              { label:"Chain Valid",     val: chain.valid===true?"YES":chain.valid===false?"NO":"—",
                icon:chain.valid===false?"bi-x-circle":"bi-shield-check",
                clr: chain.valid===false?"#f6465d":chain.valid===true?"#0ecb81":undefined },
              { label:"Checked",         val: chain.checkedCount ?? "—", icon:"bi-check2-all" },
            ].map(k=>(
              <div key={k.label} className="ent-kpi-card">
                <i className={`bi ${k.icon} ent-kpi-icon`} style={k.clr?{color:k.clr}:{}} />
                <div className="ent-kpi-val" style={k.clr?{color:k.clr}:{}}>{k.val}</div>
                <div className="ent-kpi-label">{k.label}</div>
              </div>
            ))}
          </div>

          <div className="ent-tabs">
            {[
              { id:"stats",          icon:"bi-bar-chart",     label:"Stats"          },
              { id:"entries",        icon:"bi-list-columns",  label:"Entries"        },
              { id:"integrity",      icon:"bi-shield-check",  label:"Chain Integrity"},
              { id:"reports",        icon:"bi-file-earmark-text", label:"Reports"    },
              { id:"reconciliation", icon:"bi-check2-square", label:"Reconciliation" },
            ].map(t=>(
              <button key={t.id} className={`ent-tab${tab===t.id?" ent-tab--active":""}`} onClick={()=>setTab(t.id)}>
                <i className={`bi ${t.icon}`} /> {t.label}
              </button>
            ))}
          </div>

          {tab === "stats" && (
            <div className="ent-grid-2">
              <div className="ent-card">
                <div className="ent-card-title"><i className="bi bi-bar-chart-fill ent-gold" /> Entries by Type</div>
                {statsQ.isLoading ? <div className="ent-loading"><div className="ent-spinner"/></div>
                : !Object.keys(byType).length ? <p className="ent-muted">No entries yet.</p>
                : Object.entries(byType).map(([type, count])=>(
                  <div key={type} className="ent-strat-row">
                    <span className="ent-badge" style={{background:TYPE_CLR[type]||"#474d57",minWidth:90}}>{type}</span>
                    <div className="ent-strat-bar-wrap">
                      <div className="ent-strat-bar" style={{
                        width: `${(count/(stats.total||1))*100}%`,
                        background: TYPE_CLR[type]||"#474d57",
                      }}/>
                    </div>
                    <span>{count}</span>
                  </div>
                ))}
              </div>
              <div className="ent-card">
                <div className="ent-card-title"><i className="bi bi-link-45deg ent-gold" /> Chain Status</div>
                {[
                  { label:"Total Entries",  val: stats.total ?? "—"           },
                  { label:"Last Entry ID",  val: stats.lastEntryId ?? "—"     },
                  { label:"Last Hash",      val: stats.lastHash ? stats.lastHash.slice(0,16)+"…" : "—" },
                ].map(r=>(
                  <div key={r.label} className="ent-row-item">
                    <span className="ent-muted">{r.label}</span>
                    <span className="ent-mono"><strong>{String(r.val)}</strong></span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "entries" && (
            <div className="ent-card">
              {entriesQ.isLoading ? <div className="ent-loading"><div className="ent-spinner"/><span>Loading ledger…</span></div>
              : !entries.length ? <div className="ent-empty"><i className="bi bi-journal ent-empty-icon"/><p>No ledger entries yet.</p></div>
              : <div className="ent-table-wrap"><table className="ent-table">
                  <thead><tr><th>#</th><th>Type</th><th>Asset</th><th>Amount</th><th>Description</th><th>Hash</th><th>Time</th></tr></thead>
                  <tbody>{entries.map((e,i)=>(
                    <tr key={e._id||i}>
                      <td className="ent-muted">{e.entryId}</td>
                      <td><span className="ent-badge" style={{background:TYPE_CLR[e.type]||"#474d57"}}>{e.type||"—"}</span></td>
                      <td><strong>{e.asset||"—"}</strong></td>
                      <td className={e.amount>=0?"ent-green":"ent-red"}>{e.amount>=0?"+":""}{e.amount??0} {e.currency||""}</td>
                      <td className="ent-muted" style={{maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.description||"—"}</td>
                      <td className="ent-mono" style={{fontSize:"0.68rem"}}>{e.hash?.slice(0,10)+"…"||"—"}</td>
                      <td className="ent-muted">{fmtTs(e.createdAt)}</td>
                    </tr>
                  ))}</tbody>
                </table></div>}
            </div>
          )}

          {tab === "integrity" && (
            <div className="ent-card">
              <div className="ent-card-title"><i className="bi bi-shield-check ent-gold" /> Cryptographic Chain Verification</div>
              {chainQ.isLoading ? <div className="ent-loading"><div className="ent-spinner"/><span>Verifying chain…</span></div>
              : <div>
                  <div style={{textAlign:"center",padding:"2rem 0"}}>
                    <i className={`bi ${chain.valid===false?"bi-x-circle-fill":"bi-shield-fill-check"}`}
                      style={{fontSize:"3rem",color:chain.valid===false?"#f6465d":"#0ecb81"}} />
                    <div style={{fontSize:"1.4rem",fontWeight:800,marginTop:"0.75rem",
                      color:chain.valid===false?"#f6465d":"#0ecb81"}}>
                      {chain.valid===false?"CHAIN TAMPERED":"CHAIN INTACT"}
                    </div>
                    <div className="ent-muted" style={{marginTop:"0.4rem"}}>
                      {chain.checkedCount??0} entries verified
                      {chain.firstBadId ? ` — first bad entry: #${chain.firstBadId}` : ""}
                    </div>
                  </div>
                  <div className="ent-row-item"><span className="ent-muted">Valid</span><strong style={{color:chain.valid?"#0ecb81":"#f6465d"}}>{String(chain.valid??false)}</strong></div>
                  <div className="ent-row-item"><span className="ent-muted">Entries Checked</span><strong>{chain.checkedCount??0}</strong></div>
                  <div className="ent-row-item"><span className="ent-muted">First Bad ID</span><strong>{chain.firstBadId??"None"}</strong></div>
                </div>}
            </div>
          )}

          {tab === "reports" && (
            <div>
              <div style={{display:"flex",gap:"0.75rem",marginBottom:"1rem",alignItems:"center"}}>
                <button className="ent-btn-primary" onClick={()=>reportMut.mutate()} disabled={reportMut.isPending}>
                  {reportMut.isPending ? <><div className="ent-spinner-sm"/>Generating…</> : <><i className="bi bi-file-earmark-plus"/> Generate 30-day Report</>}
                </button>
                {reportMut.isError && <span className="ent-error-text">{reportMut.error?.message}</span>}
              </div>
              {reportsQ.isLoading ? <div className="ent-loading"><div className="ent-spinner"/></div>
              : !reports.length ? <div className="ent-empty"><i className="bi bi-file-earmark ent-empty-icon"/><p>No compliance reports yet.</p></div>
              : <div className="ent-card"><div className="ent-table-wrap"><table className="ent-table">
                  <thead><tr><th>Report ID</th><th>Type</th><th>Period</th><th>Entries</th><th>Users</th><th>Status</th></tr></thead>
                  <tbody>{reports.map((r,i)=>(
                    <tr key={r._id||i}>
                      <td className="ent-mono">{r.reportId||"—"}</td>
                      <td><span className="ent-badge">{r.type||"—"}</span></td>
                      <td className="ent-muted">{r.periodStart?new Date(r.periodStart).toLocaleDateString():""} – {r.periodEnd?new Date(r.periodEnd).toLocaleDateString():""}</td>
                      <td>{r.summary?.totalEntries??0}</td>
                      <td>{r.summary?.uniqueUsers??0}</td>
                      <td><span className="ent-badge" style={{background:r.status==="finalized"?"#0ecb81":r.status==="submitted"?"#3b82f6":"#f0b90b"}}>{r.status}</span></td>
                    </tr>
                  ))}</tbody>
                </table></div></div>}
            </div>
          )}

          {tab === "reconciliation" && (
            <div>
              <div style={{display:"flex",gap:"0.75rem",marginBottom:"1rem",alignItems:"center"}}>
                <button className="ent-btn-primary" onClick={()=>reconMut.mutate()} disabled={reconMut.isPending}>
                  {reconMut.isPending ? <><div className="ent-spinner-sm"/>Running…</> : <><i className="bi bi-check2-square"/> Run SPOT Reconciliation</>}
                </button>
                {reconMut.isError && <span className="ent-error-text">{reconMut.error?.message}</span>}
              </div>
              {reconQ.isLoading ? <div className="ent-loading"><div className="ent-spinner"/></div>
              : !recons.length ? <div className="ent-empty"><i className="bi bi-check2-square ent-empty-icon"/><p>No reconciliation snapshots yet.</p></div>
              : <div className="ent-card"><div className="ent-table-wrap"><table className="ent-table">
                  <thead><tr><th>Snapshot ID</th><th>Type</th><th>Checked</th><th>Matched</th><th>Mismatches</th><th>Status</th><th>As Of</th></tr></thead>
                  <tbody>{recons.map((r,i)=>(
                    <tr key={r._id||i}>
                      <td className="ent-mono">{r.snapshotId?.slice(0,14)||"—"}</td>
                      <td><span className="ent-badge">{r.type||"—"}</span></td>
                      <td>{r.totalChecked??0}</td>
                      <td className="ent-green">{r.totalMatched??0}</td>
                      <td className={r.totalMismatch>0?"ent-red":""}>{r.totalMismatch??0}</td>
                      <td><span className="ent-badge" style={{background:r.status==="clean"?"#0ecb81":r.status==="discrepant"?"#f6465d":"#f0b90b"}}>{r.status}</span></td>
                      <td className="ent-muted">{fmtTs(r.asOf)}</td>
                    </tr>
                  ))}</tbody>
                </table></div></div>}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
