import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../store/authStore";
import { hadrApi } from "../../services/api/hadr";
import "../../styles/dashboard.css";
import "../../styles/enterprise.css";

const TABS = ["Dashboard", "Health Checks", "Failover", "Backups", "DR Plans"];

const statusBadge = (s) => {
  const map = {
    healthy: "#0ecb81", degraded: "#f0b90b", unhealthy: "#f6465d",
    completed: "#0ecb81", failed: "#f6465d", running: "#f0b90b",
    triggered: "#f0b90b", in_progress: "#f0b90b", rolled_back: "#aaa",
    active: "#0ecb81", draft: "#aaa", testing: "#f0b90b", deprecated: "#555",
    pending: "#aaa",
  };
  return (
    <span style={{ color: map[s] || "#eaecef", fontWeight: 600, textTransform: "capitalize" }}>
      {s?.replace(/_/g, " ")}
    </span>
  );
};

const fmt = (n) => (typeof n === "number" ? n.toLocaleString() : n ?? "—");

export default function DashHADR() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);

  // Failover form
  const [foForm, setFoForm] = useState({ fromNode: "", toNode: "", reason: "" });

  // Backup form
  const [bkType, setBkType] = useState("full");

  // DR plan form
  const [drForm, setDrForm] = useState({
    name: "", scenario: "", rtoMinutes: "", rpoMinutes: "", description: "",
  });

  // DR test form
  const [testForm, setTestForm] = useState({ planId: "", outcome: "pass", notes: "" });

  if (!user || user.role !== "admin") {
    return (
      <div className="ent-access-denied">
        <h2>Access Denied</h2>
        <p>High Availability & DR requires Administrator role.</p>
      </div>
    );
  }

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["hadr-stats"],
    queryFn: () => hadrApi.statistics().then((r) => r.data.stats),
    refetchInterval: 30000,
  });

  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ["hadr-health"],
    queryFn: () => hadrApi.getHealthChecks().then((r) => r.data),
    enabled: tab === 1,
    refetchInterval: 15000,
  });

  const { data: foData, isLoading: foLoading } = useQuery({
    queryKey: ["hadr-failover"],
    queryFn: () => hadrApi.getFailoverEvents().then((r) => r.data),
    enabled: tab === 2,
  });

  const { data: bkData, isLoading: bkLoading } = useQuery({
    queryKey: ["hadr-backups"],
    queryFn: () => hadrApi.getBackups().then((r) => r.data),
    enabled: tab === 3,
  });

  const { data: drData, isLoading: drLoading } = useQuery({
    queryKey: ["hadr-dr-plans"],
    queryFn: () => hadrApi.getDrPlans().then((r) => r.data),
    enabled: tab === 4,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const foMut = useMutation({
    mutationFn: (body) => hadrApi.triggerFailover(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hadr-failover"] });
      qc.invalidateQueries({ queryKey: ["hadr-stats"] });
      setFoForm({ fromNode: "", toNode: "", reason: "" });
    },
  });

  const bkMut = useMutation({
    mutationFn: (body) => hadrApi.triggerBackup(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hadr-backups"] });
      qc.invalidateQueries({ queryKey: ["hadr-stats"] });
    },
  });

  const drMut = useMutation({
    mutationFn: (body) => hadrApi.createDrPlan(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hadr-dr-plans"] });
      qc.invalidateQueries({ queryKey: ["hadr-stats"] });
      setDrForm({ name: "", scenario: "", rtoMinutes: "", rpoMinutes: "", description: "" });
    },
  });

  const testMut = useMutation({
    mutationFn: ({ planId, ...body }) => hadrApi.recordDrTest(planId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hadr-dr-plans"] });
      setTestForm({ planId: "", outcome: "pass", notes: "" });
    },
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="ent-page">
      <div className="ent-header">
        <h1 className="ent-title">
          <i className="bi bi-shield-shaded" /> High Availability & DR
        </h1>
        <p className="ent-subtitle">Phase 34 — Health · Failover · Backups · DR Plans</p>
      </div>

      <div className="ent-tabs">
        {TABS.map((t, i) => (
          <button key={t} className={`ent-tab${tab === i ? " ent-tab--active" : ""}`} onClick={() => setTab(i)}>
            {t}
          </button>
        ))}
      </div>

      {/* ── Dashboard ──────────────────────────────────────────────────────── */}
      {tab === 0 && (
        <div>
          {statsLoading ? <p className="ent-loading">Loading…</p> : stats ? (
            <div className="ent-stat-grid">
              <div className="ent-stat-card">
                <div className="ent-stat-label">Health Checks Total</div>
                <div className="ent-stat-value">{fmt(stats.health?.total)}</div>
              </div>
              <div className="ent-stat-card">
                <div className="ent-stat-label">Healthy</div>
                <div className="ent-stat-value" style={{ color: "#0ecb81" }}>{fmt(stats.health?.healthy)}</div>
              </div>
              <div className="ent-stat-card">
                <div className="ent-stat-label">Degraded</div>
                <div className="ent-stat-value" style={{ color: "#f0b90b" }}>{fmt(stats.health?.degraded)}</div>
              </div>
              <div className="ent-stat-card">
                <div className="ent-stat-label">Failovers Total</div>
                <div className="ent-stat-value">{fmt(stats.failover?.total)}</div>
              </div>
              <div className="ent-stat-card">
                <div className="ent-stat-label">Failovers Completed</div>
                <div className="ent-stat-value" style={{ color: "#0ecb81" }}>{fmt(stats.failover?.completed)}</div>
              </div>
              <div className="ent-stat-card">
                <div className="ent-stat-label">Backups Total</div>
                <div className="ent-stat-value">{fmt(stats.backup?.total)}</div>
              </div>
              <div className="ent-stat-card">
                <div className="ent-stat-label">Backups Completed</div>
                <div className="ent-stat-value" style={{ color: "#0ecb81" }}>{fmt(stats.backup?.completed)}</div>
              </div>
              <div className="ent-stat-card">
                <div className="ent-stat-label">DR Plans Active</div>
                <div className="ent-stat-value">{fmt(stats.dr?.active)}</div>
              </div>
            </div>
          ) : <p className="ent-empty">No statistics available.</p>}
        </div>
      )}

      {/* ── Health Checks ──────────────────────────────────────────────────── */}
      {tab === 1 && (
        <div>
          {healthLoading ? <p className="ent-loading">Loading health checks…</p> : (
            <div className="ent-table-wrap">
              <table className="ent-table">
                <thead>
                  <tr>
                    <th>Check ID</th><th>Node</th><th>Region</th>
                    <th>Status</th><th>CPU%</th><th>Memory%</th><th>Uptime</th><th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {healthData?.checks?.length === 0 && (
                    <tr><td colSpan={8} style={{ textAlign: "center" }}>No health check records.</td></tr>
                  )}
                  {healthData?.checks?.map((c) => (
                    <tr key={c.checkId}>
                      <td className="ent-mono">{c.checkId}</td>
                      <td>{c.nodeId}</td>
                      <td>{c.region}</td>
                      <td>{statusBadge(c.overallStatus)}</td>
                      <td>{c.cpuPct != null ? `${c.cpuPct}%` : "—"}</td>
                      <td>{c.memPct != null ? `${c.memPct}%` : "—"}</td>
                      <td>{c.uptimeSec ? `${Math.round(c.uptimeSec / 60)}m` : "—"}</td>
                      <td>{new Date(c.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Failover ───────────────────────────────────────────────────────── */}
      {tab === 2 && (
        <div>
          <div className="ent-section">
            <h3 className="ent-section-title">Trigger Manual Failover</h3>
            <form className="ent-form" onSubmit={(e) => { e.preventDefault(); foMut.mutate(foForm); }}>
              <div className="ent-form-row">
                <input className="ent-input" placeholder="From Node" value={foForm.fromNode}
                  onChange={(e) => setFoForm((p) => ({ ...p, fromNode: e.target.value }))} required />
                <input className="ent-input" placeholder="To Node" value={foForm.toNode}
                  onChange={(e) => setFoForm((p) => ({ ...p, toNode: e.target.value }))} required />
                <input className="ent-input" placeholder="Reason" value={foForm.reason}
                  onChange={(e) => setFoForm((p) => ({ ...p, reason: e.target.value }))} required />
                <button className="ent-btn" type="submit" disabled={foMut.isPending}>
                  {foMut.isPending ? "Triggering…" : "Trigger Failover"}
                </button>
              </div>
              {foMut.isError && <p className="ent-error">{foMut.error?.response?.data?.error || "Failed."}</p>}
              {foMut.isSuccess && <p className="ent-success">Failover triggered.</p>}
            </form>
          </div>

          {foLoading ? <p className="ent-loading">Loading events…</p> : (
            <div className="ent-table-wrap">
              <table className="ent-table">
                <thead>
                  <tr>
                    <th>Event ID</th><th>From</th><th>To</th><th>Reason</th>
                    <th>Status</th><th>Duration</th><th>Initiated By</th><th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {foData?.events?.length === 0 && (
                    <tr><td colSpan={8} style={{ textAlign: "center" }}>No failover events.</td></tr>
                  )}
                  {foData?.events?.map((e) => (
                    <tr key={e.eventId}>
                      <td className="ent-mono">{e.eventId}</td>
                      <td>{e.fromNode}</td>
                      <td>{e.toNode}</td>
                      <td>{e.reason}</td>
                      <td>{statusBadge(e.status)}</td>
                      <td>{e.duration ? `${e.duration}ms` : "—"}</td>
                      <td>{e.initiatedBy}</td>
                      <td>{new Date(e.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Backups ─────────────────────────────────────────────────────────── */}
      {tab === 3 && (
        <div>
          <div className="ent-section">
            <h3 className="ent-section-title">Trigger Manual Backup</h3>
            <div className="ent-form-row">
              <select className="ent-select" value={bkType} onChange={(e) => setBkType(e.target.value)}>
                <option value="full">Full</option>
                <option value="incremental">Incremental</option>
                <option value="differential">Differential</option>
              </select>
              <button className="ent-btn" onClick={() => bkMut.mutate({ type: bkType })} disabled={bkMut.isPending}>
                {bkMut.isPending ? "Starting…" : "Start Backup"}
              </button>
            </div>
            {bkMut.isError && <p className="ent-error">{bkMut.error?.response?.data?.error || "Failed."}</p>}
            {bkMut.isSuccess && <p className="ent-success">Backup started.</p>}
          </div>

          {bkLoading ? <p className="ent-loading">Loading backups…</p> : (
            <div className="ent-table-wrap">
              <table className="ent-table">
                <thead>
                  <tr>
                    <th>Snapshot ID</th><th>Type</th><th>Region</th>
                    <th>Status</th><th>Size</th><th>Expires</th><th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {bkData?.snapshots?.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: "center" }}>No backups found.</td></tr>
                  )}
                  {bkData?.snapshots?.map((s) => (
                    <tr key={s.snapshotId}>
                      <td className="ent-mono">{s.snapshotId}</td>
                      <td>{s.type}</td>
                      <td>{s.region}</td>
                      <td>{statusBadge(s.status)}</td>
                      <td>{s.sizeBytes ? `${(s.sizeBytes / 1_000_000).toFixed(1)} MB` : "—"}</td>
                      <td>{s.expiresAt ? new Date(s.expiresAt).toLocaleDateString() : "—"}</td>
                      <td>{new Date(s.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── DR Plans ────────────────────────────────────────────────────────── */}
      {tab === 4 && (
        <div>
          <div className="ent-section">
            <h3 className="ent-section-title">Create DR Plan</h3>
            <form className="ent-form" onSubmit={(e) => {
              e.preventDefault();
              drMut.mutate({ ...drForm, rtoMinutes: parseInt(drForm.rtoMinutes, 10), rpoMinutes: parseInt(drForm.rpoMinutes, 10) });
            }}>
              <div className="ent-form-row">
                <input className="ent-input" placeholder="Plan Name" value={drForm.name}
                  onChange={(e) => setDrForm((p) => ({ ...p, name: e.target.value }))} required />
                <input className="ent-input" placeholder="Scenario (e.g. Region Outage)" value={drForm.scenario}
                  onChange={(e) => setDrForm((p) => ({ ...p, scenario: e.target.value }))} required />
                <input className="ent-input" placeholder="RTO (minutes)" type="number" value={drForm.rtoMinutes}
                  onChange={(e) => setDrForm((p) => ({ ...p, rtoMinutes: e.target.value }))} required />
                <input className="ent-input" placeholder="RPO (minutes)" type="number" value={drForm.rpoMinutes}
                  onChange={(e) => setDrForm((p) => ({ ...p, rpoMinutes: e.target.value }))} required />
              </div>
              <input className="ent-input" placeholder="Description" value={drForm.description}
                onChange={(e) => setDrForm((p) => ({ ...p, description: e.target.value }))} />
              <button className="ent-btn" type="submit" disabled={drMut.isPending}>
                {drMut.isPending ? "Creating…" : "Create Plan"}
              </button>
              {drMut.isError && <p className="ent-error">{drMut.error?.response?.data?.error || "Failed."}</p>}
              {drMut.isSuccess && <p className="ent-success">DR plan created.</p>}
            </form>
          </div>

          <div className="ent-section">
            <h3 className="ent-section-title">Record DR Test</h3>
            <form className="ent-form" onSubmit={(e) => { e.preventDefault(); testMut.mutate(testForm); }}>
              <div className="ent-form-row">
                <input className="ent-input" placeholder="Plan ID (DRP-…)" value={testForm.planId}
                  onChange={(e) => setTestForm((p) => ({ ...p, planId: e.target.value }))} required />
                <select className="ent-select" value={testForm.outcome}
                  onChange={(e) => setTestForm((p) => ({ ...p, outcome: e.target.value }))}>
                  <option value="pass">Pass</option>
                  <option value="fail">Fail</option>
                  <option value="partial">Partial</option>
                </select>
                <input className="ent-input" placeholder="Notes" value={testForm.notes}
                  onChange={(e) => setTestForm((p) => ({ ...p, notes: e.target.value }))} />
                <button className="ent-btn" type="submit" disabled={testMut.isPending}>
                  {testMut.isPending ? "Saving…" : "Record Test"}
                </button>
              </div>
              {testMut.isError && <p className="ent-error">{testMut.error?.response?.data?.error || "Failed."}</p>}
              {testMut.isSuccess && <p className="ent-success">Test recorded.</p>}
            </form>
          </div>

          {drLoading ? <p className="ent-loading">Loading plans…</p> : (
            <div className="ent-table-wrap">
              <table className="ent-table">
                <thead>
                  <tr>
                    <th>Plan ID</th><th>Name</th><th>Scenario</th>
                    <th>RTO</th><th>RPO</th><th>Status</th><th>Tests</th><th>Last Tested</th>
                  </tr>
                </thead>
                <tbody>
                  {drData?.plans?.length === 0 && (
                    <tr><td colSpan={8} style={{ textAlign: "center" }}>No DR plans.</td></tr>
                  )}
                  {drData?.plans?.map((p) => (
                    <tr key={p.planId}>
                      <td className="ent-mono">{p.planId}</td>
                      <td>{p.name}</td>
                      <td>{p.scenario}</td>
                      <td>{p.rtoMinutes}m</td>
                      <td>{p.rpoMinutes}m</td>
                      <td>{statusBadge(p.status)}</td>
                      <td>{p.testResults?.length || 0}</td>
                      <td>{p.lastTestedAt ? new Date(p.lastTestedAt).toLocaleDateString() : "Never"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
