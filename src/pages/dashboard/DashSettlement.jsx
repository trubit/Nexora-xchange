import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery }    from "@tanstack/react-query";
import { useAuthStore } from "../../store/authStore";
import DashNavbar      from "../../Components/layout/DashNavbar";
import DashSidebar     from "../../Components/dashboard/DashSidebar";
import { settlementApi } from "../../services/api/settlement.js";
import "../../styles/dashboard.css";
import "../../styles/enterprise.css";

const STATUS_CLR = { detected:"#f0b90b", confirming:"#3b82f6", finalized:"#0ecb81", failed:"#f6465d", reorged:"#fb923c" };
const CHAIN_ICON = { ethereum:"Ξ", bsc:"BNB", polygon:"MATIC", arbitrum:"ARB", optimism:"OP", bitcoin:"₿" };

export default function DashSettlement() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tab, setTab] = useState("my");

  const myQ     = useQuery({ queryKey:["settle-my"],    queryFn: () => settlementApi.my()     });
  const chainsQ = useQuery({ queryKey:["settle-chains"],queryFn: settlementApi.chains          });
  const statsQ  = useQuery({ queryKey:["settle-stats"], queryFn: settlementApi.stats, enabled: user?.role==="admin" });

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const mySettlements = myQ.data?.data    ?? myQ.data    ?? [];
  const chains        = chainsQ.data?.chains ?? chainsQ.data?.data ?? [];
  const stats         = statsQ.data?.data    ?? {};

  return (
    <div className="dash-root">
      <DashNavbar onMenuClick={() => setSidebarOpen(v=>!v)} />
      <div className="dash-body">
        <DashSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)}
          onLogout={() => { useAuthStore.getState().logout(); navigate("/login"); }} />
        <main className="dash-main">

          <div className="ent-page-head">
            <div>
              <h1 className="ent-page-title"><i className="bi bi-link-45deg" /> Settlement</h1>
              <p className="ent-page-sub">Multi-chain native on-chain settlement &amp; deposit tracking</p>
            </div>
            <button className="ent-refresh-btn" onClick={() => { myQ.refetch(); chainsQ.refetch(); }}>
              <i className="bi bi-arrow-clockwise" /> Refresh
            </button>
          </div>

          {/* Chain status row */}
          <div className="ent-chain-row">
            {chains.map(c => (
              <div key={c.id} className="ent-chain-card">
                <div className="ent-chain-sym">{CHAIN_ICON[c.id]||"⬡"}</div>
                <div className="ent-chain-name">{c.label||c.id}</div>
                <span className="ent-badge" style={{background:c.enabled?"#0ecb81":"#474d57"}}>
                  {c.enabled?"Active":"Disabled"}
                </span>
                <div className="ent-chain-conf">{c.confirmations} confs</div>
              </div>
            ))}
          </div>

          {/* Admin KPIs */}
          {user?.role==="admin" && stats && (
            <div className="ent-kpi-strip">
              {[
                { label:"Total",      val: stats.total     ?? "—", icon:"bi-list-ol"       },
                { label:"Pending",    val: stats.pending   ?? "—", icon:"bi-hourglass-split"},
                { label:"Finalized",  val: stats.finalized ?? "—", icon:"bi-check-circle"  },
                { label:"Failed",     val: stats.failed    ?? "—", icon:"bi-x-circle"      },
              ].map(k => (
                <div key={k.label} className="ent-kpi-card">
                  <i className={`bi ${k.icon} ent-kpi-icon`} />
                  <div className="ent-kpi-val">{k.val}</div>
                  <div className="ent-kpi-label">{k.label}</div>
                </div>
              ))}
            </div>
          )}

          <div className="ent-tabs">
            {[
              { id:"my",    icon:"bi-person",          label:"My Settlements" },
              { id:"chains",icon:"bi-hdd-network",     label:"Chain Status"   },
            ].map(t => (
              <button key={t.id} className={`ent-tab${tab===t.id?" ent-tab--active":""}`} onClick={()=>setTab(t.id)}>
                <i className={`bi ${t.icon}`} /> {t.label}
              </button>
            ))}
          </div>

          {tab === "my" && (
            <div className="ent-card">
              {myQ.isLoading ? <div className="ent-loading"><div className="ent-spinner"/><span>Loading settlements…</span></div>
              : myQ.isError  ? <div className="ent-error"><i className="bi bi-exclamation-triangle"/> Failed to load. <button onClick={()=>myQ.refetch()}>Retry</button></div>
              : !mySettlements.length
                ? <div className="ent-empty"><i className="bi bi-inbox ent-empty-icon"/><p>No settlement records yet.</p><span className="ent-muted">Deposits you make on-chain will appear here.</span></div>
                : <div className="ent-table-wrap"><table className="ent-table">
                    <thead><tr><th>Chain</th><th>Asset</th><th>Amount</th><th>Confirmations</th><th>Status</th><th>Tx Hash</th><th>Time</th></tr></thead>
                    <tbody>{mySettlements.map((s,i)=>(
                      <tr key={s._id||i}>
                        <td>{CHAIN_ICON[s.chain]||s.chain||"—"} <span className="ent-muted">{s.chain}</span></td>
                        <td><strong>{s.asset||"—"}</strong></td>
                        <td>{s.amount||"—"}</td>
                        <td>{s.confirmations??0} / {s.requiredConfirmations??s.confirmationsRequired??"—"}</td>
                        <td><span className="ent-badge" style={{background:STATUS_CLR[s.status]||"#474d57"}}>{s.status||"—"}</span></td>
                        <td className="ent-mono">{s.txHash?s.txHash.slice(0,10)+"…":"—"}</td>
                        <td className="ent-muted">{s.createdAt?new Date(s.createdAt).toLocaleString():"—"}</td>
                      </tr>
                    ))}</tbody>
                  </table></div>}
            </div>
          )}

          {tab === "chains" && (
            <div className="ent-grid-2">
              {chains.map(c => (
                <div key={c.id} className="ent-card">
                  <div className="ent-card-title">
                    <span style={{fontSize:"1.4rem"}}>{CHAIN_ICON[c.id]||"⬡"}</span> {c.label||c.id}
                  </div>
                  <div className="ent-detail-grid">
                    <div className="ent-detail-item"><div className="ent-detail-label">Status</div>
                      <div><span className="ent-badge" style={{background:c.enabled?"#0ecb81":"#474d57"}}>{c.enabled?"Active":"Disabled"}</span></div>
                    </div>
                    <div className="ent-detail-item"><div className="ent-detail-label">Type</div><div>{c.type||"—"}</div></div>
                    <div className="ent-detail-item"><div className="ent-detail-label">Native Asset</div><div>{c.nativeAsset||"—"}</div></div>
                    <div className="ent-detail-item"><div className="ent-detail-label">Confirmations</div><div>{c.confirmations||"—"}</div></div>
                    {c.explorerUrl && <div className="ent-detail-item ent-span-2">
                      <div className="ent-detail-label">Explorer</div>
                      <div><a href={c.explorerUrl} target="_blank" rel="noreferrer" className="ent-link">{c.explorerUrl}</a></div>
                    </div>}
                  </div>
                </div>
              ))}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
