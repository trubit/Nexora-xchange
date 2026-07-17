import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore }   from "../../store/authStore";
import DashNavbar         from "../../Components/layout/DashNavbar";
import DashSidebar        from "../../Components/dashboard/DashSidebar";
import { institutionalApi } from "../../services/api/institutional.js";
import "../../styles/dashboard.css";
import "../../styles/enterprise.css";

const TIER_CLR  = { bronze:"#cd7f32", silver:"#c0c0c0", gold:"#f0b90b", platinum:"#e5e4e2" };
const fmtK = (v) => { const n=Math.abs(Number(v||0)); return n>=1e6?`$${(n/1e6).toFixed(1)}M`:n>=1e3?`$${(n/1e3).toFixed(0)}K`:`$${n.toFixed(0)}`; };

function TierCard({ tier, config }) {
  return (
    <div className="ent-tier-card" style={{borderTop:`3px solid ${TIER_CLR[tier]||"#474d57"}`}}>
      <div className="ent-tier-name" style={{color:TIER_CLR[tier]||"#848e9c"}}>{tier.toUpperCase()}</div>
      <div className="ent-tier-rows">
        {[
          ["Rate Limit",   config.rateLimitRpm+" req/min"],
          ["Max Order",    fmtK(config.maxOrderUsd)],
          ["Max Position", fmtK(config.maxPositionUsd)],
          ["Sub-Accounts", config.maxSubAccounts],
        ].map(([l,v])=>(
          <div key={l} className="ent-row-item">
            <span className="ent-muted">{l}</span>
            <strong>{v}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashInstitutional() {
  const navigate   = useNavigate();
  const qc         = useQueryClient();
  const { isAuthenticated, user } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tab, setTab] = useState("tiers");
  const [newKeySecret, setNewKeySecret] = useState(null);
  const [keyName, setKeyName]           = useState("");

  const tiersQ   = useQuery({ queryKey:["inst-tiers"],   queryFn: institutionalApi.tiers   });
  const keysQ    = useQuery({ queryKey:["inst-keys"],    queryFn: institutionalApi.myKeys, enabled: tab==="keys" });
  const clientsQ = useQuery({ queryKey:["inst-clients"], queryFn: institutionalApi.clients, enabled: tab==="clients" && user?.role==="admin" });

  const issueKeyMut = useMutation({
    mutationFn: () => institutionalApi.issueKey({ name: keyName, permissions:["read","trade"] }),
    onSuccess: (data) => {
      setNewKeySecret(data?.secret ?? data?.data?.secret ?? null);
      setKeyName("");
      qc.invalidateQueries({ queryKey:["inst-keys"] });
    },
  });

  const revokeKeyMut = useMutation({
    mutationFn: (id) => institutionalApi.revokeKey(id),
    onSuccess: () => qc.invalidateQueries({ queryKey:["inst-keys"] }),
  });

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const tiers   = tiersQ.data?.data   ?? tiersQ.data   ?? {};
  const keys    = keysQ.data?.data    ?? keysQ.data    ?? [];
  const clients = clientsQ.data?.data ?? clientsQ.data ?? [];

  return (
    <div className="dash-root">
      <DashNavbar onMenuClick={() => setSidebarOpen(v=>!v)} />
      <div className="dash-body">
        <DashSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)}
          onLogout={() => { useAuthStore.getState().logout(); navigate("/login"); }} />
        <main className="dash-main">

          <div className="ent-page-head">
            <div>
              <h1 className="ent-page-title"><i className="bi bi-bank" /> Institutional</h1>
              <p className="ent-page-sub">Institutional API access · tier management · FIX protocol</p>
            </div>
          </div>

          <div className="ent-tabs">
            {[
              { id:"tiers",   icon:"bi-trophy",      label:"Tier Config" },
              { id:"keys",    icon:"bi-key-fill",    label:"API Keys"    },
              ...(user?.role==="admin" ? [{ id:"clients", icon:"bi-people-fill", label:"Clients" }] : []),
            ].map(t=>(
              <button key={t.id} className={`ent-tab${tab===t.id?" ent-tab--active":""}`} onClick={()=>setTab(t.id)}>
                <i className={`bi ${t.icon}`} /> {t.label}
              </button>
            ))}
          </div>

          {tab === "tiers" && (
            <div>
              <p className="ent-muted" style={{marginBottom:"1rem"}}>
                Institutional tier limits — upgrade by contacting your account manager.
              </p>
              {tiersQ.isLoading ? <div className="ent-loading"><div className="ent-spinner"/></div>
              : <div className="ent-tier-grid">
                  {Object.entries(tiers).map(([tier, config])=>(
                    <TierCard key={tier} tier={tier} config={config} />
                  ))}
                </div>}
            </div>
          )}

          {tab === "keys" && (
            <div>
              {/* Issue new key */}
              <div className="ent-card" style={{marginBottom:"1rem"}}>
                <div className="ent-card-title"><i className="bi bi-plus-circle ent-gold" /> Issue New API Key</div>
                <div className="ent-form-row">
                  <input className="ent-input" placeholder="Key name (e.g. Trading Bot)" value={keyName} onChange={e=>setKeyName(e.target.value)} />
                  <button className="ent-btn-primary" onClick={()=>issueKeyMut.mutate()} disabled={!keyName||issueKeyMut.isPending}>
                    {issueKeyMut.isPending ? <><div className="ent-spinner-sm"/>Issuing…</> : <><i className="bi bi-key"/> Issue Key</>}
                  </button>
                </div>
                {issueKeyMut.isError && <p className="ent-error-text">Failed: {issueKeyMut.error?.message}</p>}
                {newKeySecret && (
                  <div className="ent-secret-box">
                    <i className="bi bi-exclamation-triangle-fill" style={{color:"#f0b90b"}} />
                    <strong> Save your secret now — it will never be shown again.</strong>
                    <code className="ent-secret-val">{newKeySecret}</code>
                    <button className="ent-btn-sm" onClick={()=>setNewKeySecret(null)}>Dismiss</button>
                  </div>
                )}
              </div>

              {/* Keys list */}
              <div className="ent-card">
                <div className="ent-card-title"><i className="bi bi-key-fill ent-gold" /> Your API Keys</div>
                {keysQ.isLoading ? <div className="ent-loading"><div className="ent-spinner"/></div>
                : !keys.length ? (
                  <div className="ent-empty"><i className="bi bi-key ent-empty-icon"/><p>No API keys yet.</p></div>
                ) : (
                  <div className="ent-table-wrap"><table className="ent-table">
                    <thead><tr><th>Name</th><th>Key Prefix</th><th>Permissions</th><th>Status</th><th>Created</th><th>Action</th></tr></thead>
                    <tbody>{keys.map((k,i)=>(
                      <tr key={k._id||i}>
                        <td><strong>{k.name||"—"}</strong></td>
                        <td className="ent-mono">{k.key?k.key.slice(0,12)+"…":"—"}</td>
                        <td>{k.permissions?.join(", ")||"—"}</td>
                        <td><span className="ent-badge" style={{background:k.enabled?"#0ecb81":"#474d57"}}>{k.enabled?"Active":"Revoked"}</span></td>
                        <td className="ent-muted">{k.createdAt?new Date(k.createdAt).toLocaleDateString():"—"}</td>
                        <td>{k.enabled&&<button className="ent-btn-danger-sm" onClick={()=>revokeKeyMut.mutate(k._id)}>Revoke</button>}</td>
                      </tr>
                    ))}</tbody>
                  </table></div>
                )}
              </div>
            </div>
          )}

          {tab === "clients" && user?.role==="admin" && (
            <div className="ent-card">
              <div className="ent-card-title"><i className="bi bi-people-fill ent-gold" /> Institutional Clients</div>
              {clientsQ.isLoading ? <div className="ent-loading"><div className="ent-spinner"/></div>
              : !clients.length ? (
                <div className="ent-empty"><i className="bi bi-people ent-empty-icon"/><p>No institutional clients registered.</p></div>
              ) : (
                <div className="ent-table-wrap"><table className="ent-table">
                  <thead><tr><th>Name</th><th>Tier</th><th>KYC</th><th>AML</th><th>Status</th><th>Jurisdiction</th></tr></thead>
                  <tbody>{clients.map((c,i)=>(
                    <tr key={c._id||i}>
                      <td><strong>{c.name||"—"}</strong></td>
                      <td><span className="ent-badge" style={{background:TIER_CLR[c.tier]||"#474d57",color:"#000"}}>{c.tier?.toUpperCase()||"—"}</span></td>
                      <td><i className={`bi ${c.kycVerified?"bi-check-circle ent-green":"bi-x-circle ent-red"}`}/></td>
                      <td><i className={`bi ${c.amlCleared?"bi-check-circle ent-green":"bi-x-circle ent-red"}`}/></td>
                      <td><span className="ent-badge" style={{background:c.enabled?"#0ecb81":"#474d57"}}>{c.enabled?"Active":"Disabled"}</span></td>
                      <td className="ent-muted">{c.jurisdiction||"—"}</td>
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
