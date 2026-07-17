import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../store/authStore";
import DashNavbar      from "../../Components/layout/DashNavbar";
import DashSidebar     from "../../Components/dashboard/DashSidebar";
import { custodyVaultApi } from "../../services/api/custodyVault.js";
import "../../styles/dashboard.css";
import "../../styles/enterprise.css";

const TIER_CLR = { cold: "#3b82f6", warm: "#f0b90b", hot: "#f6465d" };
const TIER_ICON = { cold: "bi-snow2", warm: "bi-thermometer-half", hot: "bi-fire" };

const STATUS_CLR = {
  active: "#0ecb81", locked: "#f0b90b", suspended: "#f6465d", archived: "#474d57",
  pending_approval: "#f0b90b", approved: "#22d3ee", rejected: "#f6465d",
  executing: "#3b82f6", completed: "#0ecb81", failed: "#f6465d", cancelled: "#474d57",
};

const fmt    = (n) => Number(n ?? 0).toLocaleString();

const TABS = [
  { id: "overview",  icon: "bi-speedometer2", label: "Overview"       },
  { id: "vaults",    icon: "bi-safe2",         label: "Vault Accounts" },
  { id: "txns",      icon: "bi-arrow-left-right", label: "Transactions"  },
  { id: "approvals", icon: "bi-check2-square",  label: "Approval Queue" },
  { id: "policies",  icon: "bi-shield-check",   label: "Policies"       },
  { id: "audit",     icon: "bi-journal-text",   label: "Audit Log"      },
];

export default function DashCustody() {
  const navigate = useNavigate();
  const qc       = useQueryClient();
  const { isAuthenticated, user } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tab,         setTab]         = useState("overview");
  const [newVault,    setNewVault]    = useState({ name: "", tier: "cold", custodian: "internal", requiredApprovals: 2 });
  const [newPolicy,   setNewPolicy]   = useState({ name: "", tier: "cold", requiredApprovals: 3, timeLockHours: 24 });
  const [newTx,       setNewTx]       = useState({ fromVaultId: "", asset: "BTC", amount: "", type: "internal_transfer", description: "" });

  const statsQ    = useQuery({ queryKey: ["vault-stats"],    queryFn: custodyVaultApi.statistics,     staleTime: 15000 });
  const vaultsQ   = useQuery({ queryKey: ["vault-vaults"],   queryFn: () => custodyVaultApi.vaults(), staleTime: 15000 });
  const txnsQ     = useQuery({ queryKey: ["vault-txns"],     queryFn: () => custodyVaultApi.transactions(), staleTime: 15000 });
  const pendingQ  = useQuery({ queryKey: ["vault-pending"],  queryFn: custodyVaultApi.pendingApprovals, staleTime: 10000 });
  const policiesQ = useQuery({ queryKey: ["vault-policies"], queryFn: custodyVaultApi.policies,       staleTime: 30000 });
  const auditQ    = useQuery({ queryKey: ["vault-audit"],    queryFn: () => custodyVaultApi.auditLog(), staleTime: 15000 });

  const createVaultMut = useMutation({
    mutationFn: custodyVaultApi.createVault,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vault-vaults"] }); qc.invalidateQueries({ queryKey: ["vault-stats"] }); },
  });

  const lockMut    = useMutation({ mutationFn: ({ id }) => custodyVaultApi.lockVault(id, {}), onSuccess: () => qc.invalidateQueries({ queryKey: ["vault-vaults"] }) });
  const unlockMut  = useMutation({ mutationFn: ({ id }) => custodyVaultApi.unlockVault(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["vault-vaults"] }) });

  const initTxMut = useMutation({
    mutationFn: custodyVaultApi.initiateTransaction,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vault-txns"] }); qc.invalidateQueries({ queryKey: ["vault-pending"] }); },
  });

  const approveMut = useMutation({
    mutationFn: ({ txId }) => custodyVaultApi.approveTransaction(txId, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vault-pending"] }); qc.invalidateQueries({ queryKey: ["vault-txns"] }); },
  });

  const rejectMut = useMutation({
    mutationFn: ({ txId, reason }) => custodyVaultApi.rejectTransaction(txId, { reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vault-pending"] }); qc.invalidateQueries({ queryKey: ["vault-txns"] }); },
  });

  const createPolicyMut = useMutation({
    mutationFn: custodyVaultApi.createPolicy,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vault-policies"] }),
  });

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== "admin") return (
    <div className="dash-root">
      <DashNavbar onMenuClick={() => setSidebarOpen(v => !v)} />
      <div className="dash-body">
        <DashSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)}
          onLogout={() => { useAuthStore.getState().logout(); navigate("/login"); }} />
        <main className="dash-main">
          <div className="ent-error"><i className="bi bi-shield-x" /> Custody Vault requires Admin access.</div>
        </main>
      </div>
    </div>
  );

  const stats   = statsQ.data?.stats ?? {};
  const vaults  = vaultsQ.data?.vaults ?? [];
  const txns    = txnsQ.data?.transactions ?? [];
  const pending = pendingQ.data?.transactions ?? [];
  const policies= policiesQ.data?.policies ?? [];
  const auditLogs = auditQ.data?.logs ?? [];

  const refresh = () => [statsQ, vaultsQ, txnsQ, pendingQ, policiesQ, auditQ].forEach(q => q.refetch());

  return (
    <div className="dash-root">
      <DashNavbar onMenuClick={() => setSidebarOpen(v => !v)} />
      <div className="dash-body">
        <DashSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)}
          onLogout={() => { useAuthStore.getState().logout(); navigate("/login"); }} />
        <main className="dash-main">

          <div className="ent-page-head">
            <div>
              <h1 className="ent-page-title"><i className="bi bi-safe2" /> Digital Asset Custody</h1>
              <p className="ent-page-sub">Multi-tier cold/warm/hot vault management with multi-signature approvals</p>
            </div>
            <button className="ent-refresh-btn" onClick={refresh}>
              <i className="bi bi-arrow-clockwise" /> Refresh
            </button>
          </div>

          {/* KPI Strip */}
          <div className="ent-kpi-strip">
            {[
              { label: "Total Vaults",    val: fmt(stats.totalVaults),       icon: "bi-safe2"           },
              { label: "Cold",            val: fmt(stats.coldVaults),        icon: "bi-snow2"           },
              { label: "Warm",            val: fmt(stats.warmVaults),        icon: "bi-thermometer-half"},
              { label: "Hot",             val: fmt(stats.hotVaults),         icon: "bi-fire"            },
              { label: "Pending Approvals", val: fmt(stats.pendingApprovals), icon: "bi-hourglass-split" },
              { label: "Completed Tx",    val: fmt(stats.completedTx),       icon: "bi-check-circle"    },
              { label: "Success Rate",    val: (stats.successRate ?? "0") + "%", icon: "bi-graph-up"    },
            ].map(k => (
              <div key={k.label} className="ent-kpi-card">
                <i className={`bi ${k.icon} ent-kpi-icon`} />
                <div className="ent-kpi-val">{statsQ.isLoading ? "…" : k.val}</div>
                <div className="ent-kpi-label">{k.label}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="ent-tabs">
            {TABS.map(t => (
              <button key={t.id}
                className={`ent-tab${tab === t.id ? " ent-tab--active" : ""}`}
                onClick={() => setTab(t.id)}>
                <i className={`bi ${t.icon}`} /> {t.label}
                {t.id === "approvals" && pending.length > 0 && (
                  <span className="ent-badge" style={{ background: "#f6465d", marginLeft: "0.4rem" }}>{pending.length}</span>
                )}
              </button>
            ))}
          </div>

          {/* ── Overview Tab ── */}
          {tab === "overview" && (
            <div className="ent-grid-2">
              {[
                { tier: "cold", label: "Cold Storage", desc: "Offline vaults, max security, 3-of-N approval" },
                { tier: "warm", label: "Warm Storage", desc: "Semi-offline, 2-of-N approval, medium liquidity" },
                { tier: "hot",  label: "Hot Storage",  desc: "Online, instant access, 1-of-N approval" },
              ].map(t => {
                const tierVaults = vaults.filter(v => v.tier === t.tier);
                return (
                  <div key={t.tier} className="ent-card">
                    <div className="ent-card-title" style={{ color: TIER_CLR[t.tier] }}>
                      <i className={`bi ${TIER_ICON[t.tier]}`} /> {t.label}
                    </div>
                    <p className="ent-muted" style={{ marginBottom: "1rem" }}>{t.desc}</p>
                    <div className="ent-detail-grid">
                      <div className="ent-detail-item">
                        <div className="ent-detail-label">Vaults</div>
                        <div>{tierVaults.length}</div>
                      </div>
                      <div className="ent-detail-item">
                        <div className="ent-detail-label">Active</div>
                        <div>{tierVaults.filter(v => v.status === "active").length}</div>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="ent-card">
                <div className="ent-card-title"><i className="bi bi-clock-history" /> Recent Transactions</div>
                {txnsQ.isLoading
                  ? <div className="ent-loading"><div className="ent-spinner" /></div>
                  : !txns.length
                    ? <div className="ent-empty"><i className="bi bi-inbox ent-empty-icon" /><p>No transactions.</p></div>
                    : <div className="ent-table-wrap"><table className="ent-table">
                        <thead><tr><th>TX ID</th><th>Type</th><th>Asset</th><th>Amount</th><th>Status</th></tr></thead>
                        <tbody>{txns.slice(0, 8).map(tx => (
                          <tr key={tx.txId}>
                            <td className="ent-mono">{tx.txId.slice(-8)}</td>
                            <td>{tx.type}</td>
                            <td><strong>{tx.asset}</strong></td>
                            <td>{tx.amount}</td>
                            <td><span className="ent-badge" style={{ background: STATUS_CLR[tx.status] || "#474d57" }}>{tx.status}</span></td>
                          </tr>
                        ))}</tbody>
                      </table></div>
                }
              </div>
            </div>
          )}

          {/* ── Vault Accounts Tab ── */}
          {tab === "vaults" && (
            <div className="ent-grid-2">
              <div className="ent-card">
                <div className="ent-card-title"><i className="bi bi-plus-circle" /> Create Vault</div>
                {(["name", "custodian"] ).map(f => (
                  <div key={f} className="ent-form-group">
                    <label className="ent-form-label">{f.charAt(0).toUpperCase() + f.slice(1)}</label>
                    <input className="ent-input" value={newVault[f]} onChange={e => setNewVault(v => ({ ...v, [f]: e.target.value }))} />
                  </div>
                ))}
                <div className="ent-form-group">
                  <label className="ent-form-label">Tier</label>
                  <select className="ent-input" value={newVault.tier} onChange={e => setNewVault(v => ({ ...v, tier: e.target.value }))}>
                    <option value="cold">Cold</option>
                    <option value="warm">Warm</option>
                    <option value="hot">Hot</option>
                  </select>
                </div>
                <div className="ent-form-group">
                  <label className="ent-form-label">Required Approvals</label>
                  <input type="number" min="1" max="10" className="ent-input" value={newVault.requiredApprovals}
                    onChange={e => setNewVault(v => ({ ...v, requiredApprovals: +e.target.value }))} />
                </div>
                <button className="ent-primary-btn" onClick={() => createVaultMut.mutate(newVault)} disabled={createVaultMut.isPending || !newVault.name}>
                  {createVaultMut.isPending ? <><div className="ent-spinner ent-spinner--sm" /> Creating…</> : <><i className="bi bi-safe2" /> Create Vault</>}
                </button>
                {createVaultMut.isError && <div className="ent-error" style={{ marginTop: "0.8rem" }}>{createVaultMut.error?.message}</div>}
              </div>

              <div className="ent-card ent-span-2">
                <div className="ent-card-title"><i className="bi bi-safe2" /> Vault Accounts</div>
                {vaultsQ.isLoading
                  ? <div className="ent-loading"><div className="ent-spinner" /></div>
                  : !vaults.length
                    ? <div className="ent-empty"><i className="bi bi-safe ent-empty-icon" /><p>No vault accounts yet.</p></div>
                    : <div className="ent-table-wrap"><table className="ent-table">
                        <thead><tr><th>Vault ID</th><th>Name</th><th>Tier</th><th>Status</th><th>Custodian</th><th>Approvals</th><th>Actions</th></tr></thead>
                        <tbody>{vaults.map(v => (
                          <tr key={v.vaultId}>
                            <td className="ent-mono">{v.vaultId.slice(-10)}</td>
                            <td><strong>{v.name}</strong></td>
                            <td><span className="ent-badge" style={{ background: TIER_CLR[v.tier] || "#474d57" }}>{v.tier}</span></td>
                            <td><span className="ent-badge" style={{ background: STATUS_CLR[v.status] || "#474d57" }}>{v.status}</span></td>
                            <td className="ent-muted">{v.custodian}</td>
                            <td>{v.requiredApprovals}-of-N</td>
                            <td>
                              {v.status === "active" && <button className="ent-action-btn" onClick={() => lockMut.mutate({ id: v.vaultId })}><i className="bi bi-lock" /> Lock</button>}
                              {v.status === "locked" && <button className="ent-action-btn" onClick={() => unlockMut.mutate({ id: v.vaultId })}><i className="bi bi-unlock" /> Unlock</button>}
                            </td>
                          </tr>
                        ))}</tbody>
                      </table></div>
                }
              </div>
            </div>
          )}

          {/* ── Transactions Tab ── */}
          {tab === "txns" && (
            <div className="ent-grid-2">
              <div className="ent-card">
                <div className="ent-card-title"><i className="bi bi-send" /> Initiate Transfer</div>
                <div className="ent-form-group">
                  <label className="ent-form-label">From Vault ID</label>
                  <input className="ent-input" placeholder="VAULT-..." value={newTx.fromVaultId}
                    onChange={e => setNewTx(v => ({ ...v, fromVaultId: e.target.value }))} />
                </div>
                <div className="ent-form-group">
                  <label className="ent-form-label">Asset</label>
                  <select className="ent-input" value={newTx.asset} onChange={e => setNewTx(v => ({ ...v, asset: e.target.value }))}>
                    {["BTC", "ETH", "USDT", "BNB", "USDC"].map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div className="ent-form-group">
                  <label className="ent-form-label">Amount</label>
                  <input type="number" className="ent-input" value={newTx.amount}
                    onChange={e => setNewTx(v => ({ ...v, amount: e.target.value }))} />
                </div>
                <div className="ent-form-group">
                  <label className="ent-form-label">Type</label>
                  <select className="ent-input" value={newTx.type} onChange={e => setNewTx(v => ({ ...v, type: e.target.value }))}>
                    <option value="internal_transfer">Internal Transfer</option>
                    <option value="withdrawal">Withdrawal</option>
                    <option value="rebalance">Rebalance</option>
                  </select>
                </div>
                <div className="ent-form-group">
                  <label className="ent-form-label">Description</label>
                  <input className="ent-input" value={newTx.description}
                    onChange={e => setNewTx(v => ({ ...v, description: e.target.value }))} />
                </div>
                <button className="ent-primary-btn" onClick={() => initTxMut.mutate(newTx)}
                  disabled={initTxMut.isPending || !newTx.fromVaultId || !newTx.amount}>
                  {initTxMut.isPending ? <><div className="ent-spinner ent-spinner--sm" /> Initiating…</> : <><i className="bi bi-send" /> Initiate</>}
                </button>
                {initTxMut.isError && <div className="ent-error" style={{ marginTop: "0.8rem" }}>{initTxMut.error?.message}</div>}
              </div>

              <div className="ent-card ent-span-2">
                <div className="ent-card-title"><i className="bi bi-arrow-left-right" /> Transaction History</div>
                {txnsQ.isLoading
                  ? <div className="ent-loading"><div className="ent-spinner" /></div>
                  : !txns.length
                    ? <div className="ent-empty"><i className="bi bi-inbox ent-empty-icon" /><p>No transactions.</p></div>
                    : <div className="ent-table-wrap"><table className="ent-table">
                        <thead><tr><th>TX ID</th><th>From Vault</th><th>Type</th><th>Asset</th><th>Amount</th><th>Approvals</th><th>Status</th><th>Time</th></tr></thead>
                        <tbody>{txns.map(tx => (
                          <tr key={tx.txId}>
                            <td className="ent-mono">{tx.txId.slice(-8)}</td>
                            <td className="ent-mono">{tx.fromVaultId.slice(-8)}</td>
                            <td>{tx.type}</td>
                            <td><strong>{tx.asset}</strong></td>
                            <td>{tx.amount}</td>
                            <td>{tx.approvals?.length ?? 0}/{tx.requiredApprovals}</td>
                            <td><span className="ent-badge" style={{ background: STATUS_CLR[tx.status] || "#474d57" }}>{tx.status}</span></td>
                            <td className="ent-muted">{tx.createdAt ? new Date(tx.createdAt).toLocaleString() : "—"}</td>
                          </tr>
                        ))}</tbody>
                      </table></div>
                }
              </div>
            </div>
          )}

          {/* ── Approval Queue Tab ── */}
          {tab === "approvals" && (
            <div className="ent-card">
              <div className="ent-card-title"><i className="bi bi-check2-square" /> Pending Approvals
                {pending.length > 0 && <span className="ent-badge" style={{ background: "#f6465d", marginLeft: "0.5rem" }}>{pending.length}</span>}
              </div>
              {pendingQ.isLoading
                ? <div className="ent-loading"><div className="ent-spinner" /></div>
                : !pending.length
                  ? <div className="ent-empty"><i className="bi bi-check-circle ent-empty-icon" /><p>No pending approvals.</p></div>
                  : <div className="ent-table-wrap"><table className="ent-table">
                      <thead><tr><th>TX ID</th><th>From Vault</th><th>Type</th><th>Asset</th><th>Amount</th><th>Approvals</th><th>Time-lock</th><th>Actions</th></tr></thead>
                      <tbody>{pending.map(tx => (
                        <tr key={tx.txId}>
                          <td className="ent-mono">{tx.txId.slice(-8)}</td>
                          <td className="ent-mono">{tx.fromVaultId.slice(-8)}</td>
                          <td>{tx.type}</td>
                          <td><strong>{tx.asset}</strong></td>
                          <td>{tx.amount}</td>
                          <td>{tx.approvals?.length ?? 0}/{tx.requiredApprovals}</td>
                          <td className="ent-muted">{tx.timeLockUntil ? new Date(tx.timeLockUntil).toLocaleString() : "None"}</td>
                          <td style={{ display: "flex", gap: "0.4rem" }}>
                            <button className="ent-action-btn" style={{ background: "#0ecb8120" }}
                              onClick={() => approveMut.mutate({ txId: tx.txId })} disabled={approveMut.isPending}>
                              <i className="bi bi-check2" /> Approve
                            </button>
                            <button className="ent-action-btn" style={{ background: "#f6465d20" }}
                              onClick={() => rejectMut.mutate({ txId: tx.txId, reason: "manual reject" })} disabled={rejectMut.isPending}>
                              <i className="bi bi-x" /> Reject
                            </button>
                          </td>
                        </tr>
                      ))}</tbody>
                    </table></div>
              }
            </div>
          )}

          {/* ── Policies Tab ── */}
          {tab === "policies" && (
            <div className="ent-grid-2">
              <div className="ent-card">
                <div className="ent-card-title"><i className="bi bi-plus-circle" /> Create Policy</div>
                <div className="ent-form-group">
                  <label className="ent-form-label">Policy Name</label>
                  <input className="ent-input" value={newPolicy.name} onChange={e => setNewPolicy(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="ent-form-group">
                  <label className="ent-form-label">Tier</label>
                  <select className="ent-input" value={newPolicy.tier} onChange={e => setNewPolicy(p => ({ ...p, tier: e.target.value }))}>
                    <option value="cold">Cold</option>
                    <option value="warm">Warm</option>
                    <option value="hot">Hot</option>
                  </select>
                </div>
                <div className="ent-form-group">
                  <label className="ent-form-label">Required Approvals</label>
                  <input type="number" min="1" max="10" className="ent-input" value={newPolicy.requiredApprovals}
                    onChange={e => setNewPolicy(p => ({ ...p, requiredApprovals: +e.target.value }))} />
                </div>
                <div className="ent-form-group">
                  <label className="ent-form-label">Time Lock (hours)</label>
                  <input type="number" min="0" className="ent-input" value={newPolicy.timeLockHours}
                    onChange={e => setNewPolicy(p => ({ ...p, timeLockHours: +e.target.value }))} />
                </div>
                <button className="ent-primary-btn" onClick={() => createPolicyMut.mutate(newPolicy)}
                  disabled={createPolicyMut.isPending || !newPolicy.name}>
                  {createPolicyMut.isPending ? <><div className="ent-spinner ent-spinner--sm" /> Creating…</> : <><i className="bi bi-shield-check" /> Create Policy</>}
                </button>
              </div>

              <div className="ent-card">
                <div className="ent-card-title"><i className="bi bi-shield-check" /> Active Policies</div>
                {policiesQ.isLoading
                  ? <div className="ent-loading"><div className="ent-spinner" /></div>
                  : !policies.length
                    ? <div className="ent-empty"><i className="bi bi-shield ent-empty-icon" /><p>No policies yet.</p></div>
                    : policies.map(p => (
                        <div key={p.policyId} className="ent-detail-grid" style={{ marginBottom: "1rem", padding: "0.8rem", background: "#161a1f", borderRadius: "6px" }}>
                          <div className="ent-detail-item ent-span-2">
                            <div className="ent-detail-label">Name</div>
                            <div><strong>{p.name}</strong></div>
                          </div>
                          <div className="ent-detail-item">
                            <div className="ent-detail-label">Tier</div>
                            <div><span className="ent-badge" style={{ background: TIER_CLR[p.tier] }}>{p.tier}</span></div>
                          </div>
                          <div className="ent-detail-item">
                            <div className="ent-detail-label">Approvals</div>
                            <div>{p.requiredApprovals}-of-N</div>
                          </div>
                          <div className="ent-detail-item">
                            <div className="ent-detail-label">Time Lock</div>
                            <div>{p.timeLockHours}h</div>
                          </div>
                        </div>
                      ))
                }
              </div>
            </div>
          )}

          {/* ── Audit Log Tab ── */}
          {tab === "audit" && (
            <div className="ent-card">
              <div className="ent-card-title"><i className="bi bi-journal-text" /> Vault Audit Log</div>
              {auditQ.isLoading
                ? <div className="ent-loading"><div className="ent-spinner" /></div>
                : !auditLogs.length
                  ? <div className="ent-empty"><i className="bi bi-journal ent-empty-icon" /><p>No audit entries yet.</p></div>
                  : <div className="ent-table-wrap"><table className="ent-table">
                      <thead><tr><th>Event</th><th>Vault ID</th><th>TX ID</th><th>Actor</th><th>Description</th><th>Time</th></tr></thead>
                      <tbody>{auditLogs.map((l, i) => (
                        <tr key={l._id ?? i}>
                          <td><span className="ent-badge" style={{ background: "#2b2f36", color: "#f0b90b", border: "1px solid #f0b90b22" }}>{l.eventType}</span></td>
                          <td className="ent-mono">{l.vaultId ? l.vaultId.slice(-8) : "—"}</td>
                          <td className="ent-mono">{l.txId ? l.txId.slice(-8) : "—"}</td>
                          <td className="ent-muted">{l.actor || "system"}</td>
                          <td style={{ maxWidth: "300px", whiteSpace: "normal" }}>{l.description}</td>
                          <td className="ent-muted">{l.createdAt ? new Date(l.createdAt).toLocaleString() : "—"}</td>
                        </tr>
                      ))}</tbody>
                    </table></div>
              }
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
