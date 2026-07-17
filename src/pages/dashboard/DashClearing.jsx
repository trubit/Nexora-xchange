import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../store/authStore";
import DashNavbar     from "../../Components/layout/DashNavbar";
import DashSidebar    from "../../Components/dashboard/DashSidebar";
import { clearingApi } from "../../services/api/clearing.js";
import "../../styles/dashboard.css";
import "../../styles/enterprise.css";

const STATUS_CLR = {
  pending:    "#f0b90b",
  validating: "#3b82f6",
  cleared:    "#22d3ee",
  settled:    "#0ecb81",
  failed:     "#f6465d",
  reversed:   "#fb923c",
};

const BATCH_CLR = {
  open:       "#f0b90b",
  processing: "#3b82f6",
  completed:  "#0ecb81",
  partial:    "#fb923c",
  failed:     "#f6465d",
};

const fmt = (n) => Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 });
const fmtUsd = (n) => "$" + Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

const TABS = [
  { id: "dashboard",      icon: "bi-speedometer2",       label: "Dashboard"     },
  { id: "details",        icon: "bi-list-ul",             label: "Settlements"   },
  { id: "reconciliation", icon: "bi-check2-all",          label: "Reconciliation"},
  { id: "batches",        icon: "bi-collection",          label: "Batches"       },
  { id: "audit",          icon: "bi-journal-text",        label: "Audit Viewer"  },
];

export default function DashClearing() {
  const navigate     = useNavigate();
  const qc           = useQueryClient();
  const { isAuthenticated, user } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tab,         setTab]         = useState("dashboard");
  const [recoForm,    setRecoForm]    = useState({ fromDate: "", toDate: "" });
  const [recoResult,  setRecoResult]  = useState(null);

  const statsQ   = useQuery({ queryKey: ["clearing-stats"],    queryFn: clearingApi.statistics,              staleTime: 15000 });
  const settleQ  = useQuery({ queryKey: ["clearing-settle"],   queryFn: () => clearingApi.settlements(),     staleTime: 15000 });
  const batchQ   = useQuery({ queryKey: ["clearing-batches"],  queryFn: () => clearingApi.batches(),         staleTime: 15000 });
  const auditQ   = useQuery({ queryKey: ["clearing-audit"],    queryFn: () => clearingApi.auditLogs(),       staleTime: 15000 });
  const historyQ = useQuery({ queryKey: ["clearing-history"],  queryFn: () => clearingApi.history(),         staleTime: 15000 });

  const reconcileMut = useMutation({
    mutationFn: clearingApi.reconcile,
    onSuccess: (data) => {
      setRecoResult(data?.reconciliation ?? data);
      qc.invalidateQueries({ queryKey: ["clearing-stats"] });
    },
  });

  const retryMut = useMutation({
    mutationFn: clearingApi.retry,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clearing-settle"] }),
  });

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== "admin") return (
    <div className="dash-root">
      <DashNavbar onMenuClick={() => setSidebarOpen(v => !v)} />
      <div className="dash-body">
        <DashSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)}
          onLogout={() => { useAuthStore.getState().logout(); navigate("/login"); }} />
        <main className="dash-main">
          <div className="ent-error"><i className="bi bi-shield-x" /> Clearing House requires Admin, Compliance Officer, or Finance Admin access.</div>
        </main>
      </div>
    </div>
  );

  const stats      = statsQ.data?.stats     ?? statsQ.data     ?? {};
  const settlements = settleQ.data?.records  ?? [];
  const batches     = batchQ.data?.batches   ?? [];
  const auditLogs   = auditQ.data?.logs      ?? [];
  const history     = historyQ.data?.records ?? [];

  const refresh = () => {
    statsQ.refetch(); settleQ.refetch(); batchQ.refetch(); auditQ.refetch(); historyQ.refetch();
  };

  return (
    <div className="dash-root">
      <DashNavbar onMenuClick={() => setSidebarOpen(v => !v)} />
      <div className="dash-body">
        <DashSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)}
          onLogout={() => { useAuthStore.getState().logout(); navigate("/login"); }} />
        <main className="dash-main">

          <div className="ent-page-head">
            <div>
              <h1 className="ent-page-title"><i className="bi bi-bank2" /> Clearing House</h1>
              <p className="ent-page-sub">Global clearing, settlement & reconciliation system</p>
            </div>
            <button className="ent-refresh-btn" onClick={refresh}>
              <i className="bi bi-arrow-clockwise" /> Refresh
            </button>
          </div>

          {/* KPI Strip */}
          <div className="ent-kpi-strip">
            {[
              { label: "Total",        val: fmt(stats.total),        icon: "bi-list-ol"          },
              { label: "Settled",      val: fmt(stats.settled),      icon: "bi-check-circle"     },
              { label: "Cleared",      val: fmt(stats.cleared),      icon: "bi-check2"           },
              { label: "Failed",       val: fmt(stats.failed),       icon: "bi-x-circle"         },
              { label: "Volume",       val: fmtUsd(stats.totalVolume), icon: "bi-currency-dollar" },
              { label: "Fees",         val: fmtUsd(stats.totalFees),  icon: "bi-percent"          },
              { label: "Success Rate", val: (stats.successRate ?? "0") + "%", icon: "bi-graph-up-arrow" },
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
              </button>
            ))}
          </div>

          {/* ── Dashboard Tab ── */}
          {tab === "dashboard" && (
            <div className="ent-grid-2">
              <div className="ent-card">
                <div className="ent-card-title"><i className="bi bi-activity" /> Live Status</div>
                <div className="ent-detail-grid">
                  {[
                    { label: "Pending",    val: fmt(stats.pending)    },
                    { label: "Validating", val: fmt(stats.clearing)   },
                    { label: "Cleared",    val: fmt(stats.cleared)    },
                    { label: "Settled",    val: fmt(stats.settled)    },
                    { label: "Failed",     val: fmt(stats.failed)     },
                    { label: "Total",      val: fmt(stats.total)      },
                  ].map(r => (
                    <div key={r.label} className="ent-detail-item">
                      <div className="ent-detail-label">{r.label}</div>
                      <div>{statsQ.isLoading ? "…" : r.val}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="ent-card">
                <div className="ent-card-title"><i className="bi bi-collection" /> Current Batch</div>
                <div className="ent-detail-grid">
                  <div className="ent-detail-item ent-span-2">
                    <div className="ent-detail-label">Batch ID</div>
                    <div className="ent-mono">{stats.currentBatchId ?? "—"}</div>
                  </div>
                  <div className="ent-detail-item">
                    <div className="ent-detail-label">Total Volume</div>
                    <div>{fmtUsd(stats.totalVolume)}</div>
                  </div>
                  <div className="ent-detail-item">
                    <div className="ent-detail-label">Total Fees</div>
                    <div>{fmtUsd(stats.totalFees)}</div>
                  </div>
                  <div className="ent-detail-item">
                    <div className="ent-detail-label">Success Rate</div>
                    <div>{stats.successRate ?? "0"}%</div>
                  </div>
                </div>
              </div>

              <div className="ent-card ent-span-2">
                <div className="ent-card-title"><i className="bi bi-clock-history" /> Recent Settlements</div>
                {settleQ.isLoading
                  ? <div className="ent-loading"><div className="ent-spinner" /><span>Loading…</span></div>
                  : !settlements.length
                    ? <div className="ent-empty"><i className="bi bi-inbox ent-empty-icon" /><p>No settlements yet.</p></div>
                    : <div className="ent-table-wrap"><table className="ent-table">
                        <thead><tr><th>Clearing ID</th><th>Symbol</th><th>Value</th><th>Status</th><th>Time</th></tr></thead>
                        <tbody>{settlements.slice(0, 10).map(s => (
                          <tr key={s.clearingId}>
                            <td className="ent-mono">{s.clearingId}</td>
                            <td><strong>{s.symbol}</strong></td>
                            <td>{fmtUsd(s.totalValue)}</td>
                            <td><span className="ent-badge" style={{ background: STATUS_CLR[s.status] || "#474d57" }}>{s.status}</span></td>
                            <td className="ent-muted">{s.createdAt ? new Date(s.createdAt).toLocaleString() : "—"}</td>
                          </tr>
                        ))}</tbody>
                      </table></div>
                }
              </div>
            </div>
          )}

          {/* ── Settlements Tab ── */}
          {tab === "details" && (
            <div className="ent-card">
              <div className="ent-card-title"><i className="bi bi-list-ul" /> All Settlement Records</div>
              {settleQ.isLoading
                ? <div className="ent-loading"><div className="ent-spinner" /><span>Loading…</span></div>
                : settleQ.isError
                  ? <div className="ent-error"><i className="bi bi-exclamation-triangle" /> Failed to load. <button onClick={() => settleQ.refetch()}>Retry</button></div>
                  : !settlements.length
                    ? <div className="ent-empty"><i className="bi bi-inbox ent-empty-icon" /><p>No records found.</p></div>
                    : <div className="ent-table-wrap"><table className="ent-table">
                        <thead><tr><th>Clearing ID</th><th>Trade ID</th><th>Symbol</th><th>Qty</th><th>Price</th><th>Value</th><th>Buyer Fee</th><th>Status</th><th>Actions</th><th>Time</th></tr></thead>
                        <tbody>{settlements.map(s => (
                          <tr key={s.clearingId}>
                            <td className="ent-mono">{s.clearingId.slice(-8)}</td>
                            <td className="ent-mono">{s.tradeId?.slice(-8) ?? "—"}</td>
                            <td><strong>{s.symbol}</strong></td>
                            <td>{fmt(s.quantity)}</td>
                            <td>{fmtUsd(s.price)}</td>
                            <td>{fmtUsd(s.totalValue)}</td>
                            <td className="ent-muted">{fmtUsd(s.buyerFee)}</td>
                            <td><span className="ent-badge" style={{ background: STATUS_CLR[s.status] || "#474d57" }}>{s.status}</span></td>
                            <td>
                              {s.status === "failed" && (
                                <button className="ent-action-btn"
                                  onClick={() => retryMut.mutate(s.clearingId)}
                                  disabled={retryMut.isPending}>
                                  <i className="bi bi-arrow-clockwise" /> Retry
                                </button>
                              )}
                            </td>
                            <td className="ent-muted">{s.createdAt ? new Date(s.createdAt).toLocaleString() : "—"}</td>
                          </tr>
                        ))}</tbody>
                      </table></div>
              }
            </div>
          )}

          {/* ── Reconciliation Tab ── */}
          {tab === "reconciliation" && (
            <div className="ent-grid-2">
              <div className="ent-card">
                <div className="ent-card-title"><i className="bi bi-check2-all" /> Run Reconciliation</div>
                <div className="ent-form-group">
                  <label className="ent-form-label">From Date (optional)</label>
                  <input type="date" className="ent-input"
                    value={recoForm.fromDate}
                    onChange={e => setRecoForm(f => ({ ...f, fromDate: e.target.value }))} />
                </div>
                <div className="ent-form-group">
                  <label className="ent-form-label">To Date (optional)</label>
                  <input type="date" className="ent-input"
                    value={recoForm.toDate}
                    onChange={e => setRecoForm(f => ({ ...f, toDate: e.target.value }))} />
                </div>
                <button className="ent-primary-btn"
                  onClick={() => reconcileMut.mutate(recoForm)}
                  disabled={reconcileMut.isPending}>
                  {reconcileMut.isPending ? <><div className="ent-spinner ent-spinner--sm" /> Running…</> : <><i className="bi bi-play-circle" /> Run Reconciliation</>}
                </button>
                {reconcileMut.isError && (
                  <div className="ent-error" style={{ marginTop: "1rem" }}>
                    <i className="bi bi-exclamation-triangle" /> {reconcileMut.error?.message ?? "Reconciliation failed."}
                  </div>
                )}
              </div>

              {recoResult && (
                <div className="ent-card">
                  <div className="ent-card-title">
                    <i className={`bi ${recoResult.clean ? "bi-check-circle text-success" : "bi-exclamation-triangle"}`} /> Results
                  </div>
                  <div className="ent-detail-grid">
                    <div className="ent-detail-item">
                      <div className="ent-detail-label">Records Checked</div>
                      <div>{recoResult.checked ?? 0}</div>
                    </div>
                    <div className="ent-detail-item">
                      <div className="ent-detail-label">Discrepancies</div>
                      <div style={{ color: recoResult.discrepancies > 0 ? "#f6465d" : "#0ecb81" }}>
                        {recoResult.discrepancies ?? 0}
                      </div>
                    </div>
                    <div className="ent-detail-item ent-span-2">
                      <div className="ent-detail-label">Status</div>
                      <div>
                        <span className="ent-badge" style={{ background: recoResult.clean ? "#0ecb81" : "#f6465d" }}>
                          {recoResult.clean ? "CLEAN" : "DISCREPANCIES FOUND"}
                        </span>
                      </div>
                    </div>
                  </div>
                  {recoResult.items?.length > 0 && (
                    <div className="ent-table-wrap" style={{ marginTop: "1rem" }}>
                      <table className="ent-table">
                        <thead><tr><th>Clearing ID</th><th>Expected</th><th>Actual</th><th>Drift</th></tr></thead>
                        <tbody>{recoResult.items.map((d, i) => (
                          <tr key={i}>
                            <td className="ent-mono">{d.clearingId}</td>
                            <td>{fmtUsd(d.expected)}</td>
                            <td>{fmtUsd(d.actual)}</td>
                            <td style={{ color: "#f6465d" }}>{d.drift?.toFixed(6)}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              <div className="ent-card ent-span-2">
                <div className="ent-card-title"><i className="bi bi-clock-history" /> Settlement History</div>
                {historyQ.isLoading
                  ? <div className="ent-loading"><div className="ent-spinner" /></div>
                  : !history.length
                    ? <div className="ent-empty"><i className="bi bi-inbox ent-empty-icon" /><p>No settled records yet.</p></div>
                    : <div className="ent-table-wrap"><table className="ent-table">
                        <thead><tr><th>Clearing ID</th><th>Symbol</th><th>Value</th><th>Settled At</th></tr></thead>
                        <tbody>{history.map(s => (
                          <tr key={s.clearingId}>
                            <td className="ent-mono">{s.clearingId.slice(-10)}</td>
                            <td><strong>{s.symbol}</strong></td>
                            <td>{fmtUsd(s.totalValue)}</td>
                            <td className="ent-muted">{s.settledAt ? new Date(s.settledAt).toLocaleString() : "—"}</td>
                          </tr>
                        ))}</tbody>
                      </table></div>
                }
              </div>
            </div>
          )}

          {/* ── Batches Tab ── */}
          {tab === "batches" && (
            <div className="ent-card">
              <div className="ent-card-title"><i className="bi bi-collection" /> Settlement Batches</div>
              {batchQ.isLoading
                ? <div className="ent-loading"><div className="ent-spinner" /><span>Loading…</span></div>
                : batchQ.isError
                  ? <div className="ent-error"><i className="bi bi-exclamation-triangle" /> Failed to load batches. <button onClick={() => batchQ.refetch()}>Retry</button></div>
                  : !batches.length
                    ? <div className="ent-empty"><i className="bi bi-inbox ent-empty-icon" /><p>No batches yet.</p></div>
                    : <div className="ent-table-wrap"><table className="ent-table">
                        <thead><tr><th>Batch ID</th><th>Status</th><th>Records</th><th>Settled</th><th>Failed</th><th>Volume</th><th>Fees</th><th>Opened At</th></tr></thead>
                        <tbody>{batches.map(b => (
                          <tr key={b.batchId}>
                            <td className="ent-mono">{b.batchId.slice(-10)}</td>
                            <td><span className="ent-badge" style={{ background: BATCH_CLR[b.status] || "#474d57" }}>{b.status}</span></td>
                            <td>{b.recordCount}</td>
                            <td style={{ color: "#0ecb81" }}>{b.settled ?? 0}</td>
                            <td style={{ color: b.failed > 0 ? "#f6465d" : "inherit" }}>{b.failed ?? 0}</td>
                            <td>{fmtUsd(b.totalVolume)}</td>
                            <td>{fmtUsd(b.totalFees)}</td>
                            <td className="ent-muted">{b.openedAt ? new Date(b.openedAt).toLocaleString() : "—"}</td>
                          </tr>
                        ))}</tbody>
                      </table></div>
              }
            </div>
          )}

          {/* ── Audit Viewer Tab ── */}
          {tab === "audit" && (
            <div className="ent-card">
              <div className="ent-card-title"><i className="bi bi-journal-text" /> Clearing Audit Log</div>
              {auditQ.isLoading
                ? <div className="ent-loading"><div className="ent-spinner" /><span>Loading…</span></div>
                : auditQ.isError
                  ? <div className="ent-error"><i className="bi bi-exclamation-triangle" /> Failed to load audit logs. <button onClick={() => auditQ.refetch()}>Retry</button></div>
                  : !auditLogs.length
                    ? <div className="ent-empty"><i className="bi bi-journal ent-empty-icon" /><p>No audit entries yet.</p><span className="ent-muted">Events appear here when trades are cleared and settled.</span></div>
                    : <div className="ent-table-wrap"><table className="ent-table">
                        <thead><tr><th>Event</th><th>Clearing ID</th><th>Batch ID</th><th>Actor</th><th>Description</th><th>Time</th></tr></thead>
                        <tbody>{auditLogs.map((l, i) => (
                          <tr key={l._id ?? i}>
                            <td><span className="ent-badge" style={{ background: "#2b2f36", color: "#f0b90b", border: "1px solid #f0b90b22" }}>{l.eventType}</span></td>
                            <td className="ent-mono">{l.clearingId ? l.clearingId.slice(-8) : "—"}</td>
                            <td className="ent-mono">{l.batchId ? l.batchId.slice(-8) : "—"}</td>
                            <td className="ent-muted">{l.actor || "system"}</td>
                            <td style={{ maxWidth: "320px", whiteSpace: "normal" }}>{l.description}</td>
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
