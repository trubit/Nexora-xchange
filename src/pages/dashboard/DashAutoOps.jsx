import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../store/authStore";
import { autonomousOpsApi } from "../../services/api/autonomousOps";
import "../../styles/dashboard.css";
import "../../styles/enterprise.css";

const TABS = ["Dashboard", "Auto-Scaling", "Incidents", "Deployments"];

const statusBadge = (s) => {
  const map = {
    open: "#f6465d", investigating: "#f0b90b", mitigating: "#17a2b8",
    resolved: "#0ecb81", closed: "#555",
    triggered: "#f0b90b", in_progress: "#f0b90b", completed: "#0ecb81", failed: "#f6465d",
    pending: "#aaa", running: "#f0b90b", rolled_back: "#aaa",
    critical: "#f6465d", high: "#f0b90b", medium: "#17a2b8", low: "#aaa",
  };
  return (
    <span style={{ color: map[s] || "#eaecef", fontWeight: 600, textTransform: "capitalize" }}>
      {s?.replace(/_/g, " ")}
    </span>
  );
};

const fmt = (n) => (typeof n === "number" ? n.toLocaleString() : n ?? "—");

export default function DashAutoOps() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);

  // Scaling form
  const [scaleForm, setScaleForm] = useState({ direction: "scale_out", service: "api", toReplicas: "" });

  // Incident form
  const [incForm, setIncForm] = useState({ title: "", description: "", severity: "medium", service: "" });
  const [updateForm, setUpdateForm] = useState({ incidentId: "", status: "investigating", message: "" });

  // Deployment form
  const [depForm, setDepForm] = useState({ service: "", version: "", previousVersion: "", type: "rolling", notes: "" });

  if (!user || user.role !== "admin") {
    return (
      <div className="ent-access-denied">
        <h2>Access Denied</h2>
        <p>Autonomous Operations requires Administrator role.</p>
      </div>
    );
  }

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["auto-ops-stats"],
    queryFn: () => autonomousOpsApi.statistics().then((r) => r.data.stats),
    refetchInterval: 30000,
  });

  const { data: scaleData, isLoading: scaleLoading } = useQuery({
    queryKey: ["auto-ops-scaling"],
    queryFn: () => autonomousOpsApi.getScalingEvents().then((r) => r.data),
    enabled: tab === 1,
  });

  const { data: incData, isLoading: incLoading } = useQuery({
    queryKey: ["auto-ops-incidents"],
    queryFn: () => autonomousOpsApi.getIncidents().then((r) => r.data),
    enabled: tab === 2,
    refetchInterval: 15000,
  });

  const { data: depData, isLoading: depLoading } = useQuery({
    queryKey: ["auto-ops-deployments"],
    queryFn: () => autonomousOpsApi.getDeployments().then((r) => r.data),
    enabled: tab === 3,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const scaleMut = useMutation({
    mutationFn: (body) => autonomousOpsApi.triggerScale(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auto-ops-scaling"] });
      qc.invalidateQueries({ queryKey: ["auto-ops-stats"] });
    },
  });

  const incMut = useMutation({
    mutationFn: (body) => autonomousOpsApi.createIncident(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auto-ops-incidents"] });
      qc.invalidateQueries({ queryKey: ["auto-ops-stats"] });
      setIncForm({ title: "", description: "", severity: "medium", service: "" });
    },
  });

  const updateIncMut = useMutation({
    mutationFn: ({ incidentId, ...body }) => autonomousOpsApi.updateIncident(incidentId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auto-ops-incidents"] });
      setUpdateForm({ incidentId: "", status: "investigating", message: "" });
    },
  });

  const depMut = useMutation({
    mutationFn: (body) => autonomousOpsApi.recordDeployment(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auto-ops-deployments"] });
      qc.invalidateQueries({ queryKey: ["auto-ops-stats"] });
      setDepForm({ service: "", version: "", previousVersion: "", type: "rolling", notes: "" });
    },
  });

  const rollbackMut = useMutation({
    mutationFn: (id) => autonomousOpsApi.rollback(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["auto-ops-deployments"] }),
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="ent-page">
      <div className="ent-header">
        <h1 className="ent-title">
          <i className="bi bi-cpu" /> Autonomous Operations
        </h1>
        <p className="ent-subtitle">Phase 35 — Auto-Scaling · Incidents · Deployments</p>
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
                <div className="ent-stat-label">Scale Events Total</div>
                <div className="ent-stat-value">{fmt(stats.scaling?.total)}</div>
              </div>
              <div className="ent-stat-card">
                <div className="ent-stat-label">Scale Out</div>
                <div className="ent-stat-value" style={{ color: "#f0b90b" }}>{fmt(stats.scaling?.scaleOut)}</div>
              </div>
              <div className="ent-stat-card">
                <div className="ent-stat-label">Scale In</div>
                <div className="ent-stat-value">{fmt(stats.scaling?.scaleIn)}</div>
              </div>
              <div className="ent-stat-card">
                <div className="ent-stat-label">Open Incidents</div>
                <div className="ent-stat-value" style={{ color: "#f6465d" }}>{fmt(stats.incidents?.open)}</div>
              </div>
              <div className="ent-stat-card">
                <div className="ent-stat-label">Critical Incidents</div>
                <div className="ent-stat-value" style={{ color: "#f6465d" }}>{fmt(stats.incidents?.critical)}</div>
              </div>
              <div className="ent-stat-card">
                <div className="ent-stat-label">Resolved</div>
                <div className="ent-stat-value" style={{ color: "#0ecb81" }}>{fmt(stats.incidents?.resolved)}</div>
              </div>
              <div className="ent-stat-card">
                <div className="ent-stat-label">Deployments Total</div>
                <div className="ent-stat-value">{fmt(stats.deployments?.total)}</div>
              </div>
              <div className="ent-stat-card">
                <div className="ent-stat-label">Deployments Completed</div>
                <div className="ent-stat-value" style={{ color: "#0ecb81" }}>{fmt(stats.deployments?.completed)}</div>
              </div>
            </div>
          ) : <p className="ent-empty">No statistics available.</p>}
        </div>
      )}

      {/* ── Auto-Scaling ───────────────────────────────────────────────────── */}
      {tab === 1 && (
        <div>
          <div className="ent-section">
            <h3 className="ent-section-title">Trigger Manual Scale</h3>
            <form className="ent-form" onSubmit={(e) => {
              e.preventDefault();
              scaleMut.mutate({ ...scaleForm, toReplicas: parseInt(scaleForm.toReplicas || "2", 10) });
            }}>
              <div className="ent-form-row">
                <select className="ent-select" value={scaleForm.direction}
                  onChange={(e) => setScaleForm((p) => ({ ...p, direction: e.target.value }))}>
                  <option value="scale_out">Scale Out</option>
                  <option value="scale_in">Scale In</option>
                </select>
                <input className="ent-input" placeholder="Service (e.g. api)" value={scaleForm.service}
                  onChange={(e) => setScaleForm((p) => ({ ...p, service: e.target.value }))} required />
                <input className="ent-input" placeholder="Target Replicas" type="number"
                  value={scaleForm.toReplicas}
                  onChange={(e) => setScaleForm((p) => ({ ...p, toReplicas: e.target.value }))} />
                <button className="ent-btn" type="submit" disabled={scaleMut.isPending}>
                  {scaleMut.isPending ? "Scaling…" : "Trigger Scale"}
                </button>
              </div>
              {scaleMut.isError && <p className="ent-error">{scaleMut.error?.response?.data?.error || "Failed."}</p>}
              {scaleMut.isSuccess && <p className="ent-success">Scale event triggered.</p>}
            </form>
          </div>

          {scaleLoading ? <p className="ent-loading">Loading events…</p> : (
            <div className="ent-table-wrap">
              <table className="ent-table">
                <thead>
                  <tr>
                    <th>Event ID</th><th>Direction</th><th>Service</th>
                    <th>From</th><th>To</th><th>Trigger</th><th>Status</th><th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {scaleData?.events?.length === 0 && (
                    <tr><td colSpan={8} style={{ textAlign: "center" }}>No scaling events.</td></tr>
                  )}
                  {scaleData?.events?.map((e) => (
                    <tr key={e.eventId}>
                      <td className="ent-mono">{e.eventId}</td>
                      <td>{statusBadge(e.direction)}</td>
                      <td>{e.service}</td>
                      <td>{e.fromReplicas}</td>
                      <td>{e.toReplicas}</td>
                      <td>{e.triggerMetric}{e.triggerValue != null ? ` (${e.triggerValue}%)` : ""}</td>
                      <td>{statusBadge(e.status)}</td>
                      <td>{new Date(e.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Incidents ──────────────────────────────────────────────────────── */}
      {tab === 2 && (
        <div>
          <div className="ent-section">
            <h3 className="ent-section-title">Create Incident</h3>
            <form className="ent-form" onSubmit={(e) => { e.preventDefault(); incMut.mutate(incForm); }}>
              <div className="ent-form-row">
                <input className="ent-input" placeholder="Title" value={incForm.title}
                  onChange={(e) => setIncForm((p) => ({ ...p, title: e.target.value }))} required />
                <input className="ent-input" placeholder="Service" value={incForm.service}
                  onChange={(e) => setIncForm((p) => ({ ...p, service: e.target.value }))} required />
                <select className="ent-select" value={incForm.severity}
                  onChange={(e) => setIncForm((p) => ({ ...p, severity: e.target.value }))}>
                  {["critical","high","medium","low"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <button className="ent-btn" type="submit" disabled={incMut.isPending}>
                  {incMut.isPending ? "Creating…" : "Create"}
                </button>
              </div>
              <input className="ent-input" placeholder="Description" value={incForm.description}
                onChange={(e) => setIncForm((p) => ({ ...p, description: e.target.value }))} />
              {incMut.isError && <p className="ent-error">{incMut.error?.response?.data?.error || "Failed."}</p>}
              {incMut.isSuccess && <p className="ent-success">Incident created.</p>}
            </form>
          </div>

          <div className="ent-section">
            <h3 className="ent-section-title">Update Incident Status</h3>
            <form className="ent-form" onSubmit={(e) => { e.preventDefault(); updateIncMut.mutate(updateForm); }}>
              <div className="ent-form-row">
                <input className="ent-input" placeholder="Incident ID (INC-…)" value={updateForm.incidentId}
                  onChange={(e) => setUpdateForm((p) => ({ ...p, incidentId: e.target.value }))} required />
                <select className="ent-select" value={updateForm.status}
                  onChange={(e) => setUpdateForm((p) => ({ ...p, status: e.target.value }))}>
                  {["investigating","mitigating","resolved","closed"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <input className="ent-input" placeholder="Message" value={updateForm.message}
                  onChange={(e) => setUpdateForm((p) => ({ ...p, message: e.target.value }))} />
                <button className="ent-btn" type="submit" disabled={updateIncMut.isPending}>
                  {updateIncMut.isPending ? "Updating…" : "Update"}
                </button>
              </div>
              {updateIncMut.isError && <p className="ent-error">{updateIncMut.error?.response?.data?.error || "Failed."}</p>}
              {updateIncMut.isSuccess && <p className="ent-success">Incident updated.</p>}
            </form>
          </div>

          {incLoading ? <p className="ent-loading">Loading incidents…</p> : (
            <div className="ent-table-wrap">
              <table className="ent-table">
                <thead>
                  <tr>
                    <th>ID</th><th>Title</th><th>Service</th>
                    <th>Severity</th><th>Status</th><th>Timeline</th><th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {incData?.incidents?.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: "center" }}>No incidents.</td></tr>
                  )}
                  {incData?.incidents?.map((i) => (
                    <tr key={i.incidentId}>
                      <td className="ent-mono">{i.incidentId}</td>
                      <td>{i.title}</td>
                      <td>{i.service}</td>
                      <td>{statusBadge(i.severity)}</td>
                      <td>{statusBadge(i.status)}</td>
                      <td>{i.timeline?.length || 0} entries</td>
                      <td>{new Date(i.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Deployments ─────────────────────────────────────────────────────── */}
      {tab === 3 && (
        <div>
          <div className="ent-section">
            <h3 className="ent-section-title">Record Deployment</h3>
            <form className="ent-form" onSubmit={(e) => { e.preventDefault(); depMut.mutate(depForm); }}>
              <div className="ent-form-row">
                <input className="ent-input" placeholder="Service" value={depForm.service}
                  onChange={(e) => setDepForm((p) => ({ ...p, service: e.target.value }))} required />
                <input className="ent-input" placeholder="Version (e.g. v2.1.0)" value={depForm.version}
                  onChange={(e) => setDepForm((p) => ({ ...p, version: e.target.value }))} required />
                <input className="ent-input" placeholder="Previous Version" value={depForm.previousVersion}
                  onChange={(e) => setDepForm((p) => ({ ...p, previousVersion: e.target.value }))} />
                <select className="ent-select" value={depForm.type}
                  onChange={(e) => setDepForm((p) => ({ ...p, type: e.target.value }))}>
                  {["rolling","blue_green","canary","rollback"].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="ent-form-row">
                <input className="ent-input" placeholder="Notes" value={depForm.notes}
                  onChange={(e) => setDepForm((p) => ({ ...p, notes: e.target.value }))} />
                <button className="ent-btn" type="submit" disabled={depMut.isPending}>
                  {depMut.isPending ? "Recording…" : "Record Deployment"}
                </button>
              </div>
              {depMut.isError && <p className="ent-error">{depMut.error?.response?.data?.error || "Failed."}</p>}
              {depMut.isSuccess && <p className="ent-success">Deployment recorded.</p>}
            </form>
          </div>

          {depLoading ? <p className="ent-loading">Loading deployments…</p> : (
            <div className="ent-table-wrap">
              <table className="ent-table">
                <thead>
                  <tr>
                    <th>Deployment ID</th><th>Service</th><th>Version</th>
                    <th>Type</th><th>Status</th><th>Duration</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {depData?.deployments?.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: "center" }}>No deployments.</td></tr>
                  )}
                  {depData?.deployments?.map((d) => (
                    <tr key={d.deploymentId}>
                      <td className="ent-mono">{d.deploymentId}</td>
                      <td>{d.service}</td>
                      <td>{d.version}</td>
                      <td>{d.type}</td>
                      <td>{statusBadge(d.status)}</td>
                      <td>{d.duration ? `${(d.duration / 1000).toFixed(1)}s` : "—"}</td>
                      <td>
                        {d.status === "completed" && d.previousVersion && (
                          <button
                            className="ent-btn ent-btn--sm"
                            onClick={() => rollbackMut.mutate(d.deploymentId)}
                            disabled={rollbackMut.isPending}
                          >
                            Rollback
                          </button>
                        )}
                      </td>
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
