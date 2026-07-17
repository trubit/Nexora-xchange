import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../store/authStore";
import { regulatoryComplianceApi } from "../../services/api/regulatoryCompliance";
import "../../styles/dashboard.css";
import "../../styles/enterprise.css";

const TABS = ["Dashboard", "Sanctions", "Travel Rule", "SARs", "Reports"];

const statusBadge = (s) => {
  const map = {
    pending_review: "#f0b90b", confirmed: "#f6465d", false_positive: "#0ecb81",
    escalated: "#e83e8c", pending: "#f0b90b", sent: "#0ecb81", received: "#17a2b8",
    verified: "#0ecb81", rejected: "#f6465d", failed: "#f6465d",
    draft: "#aaa", under_review: "#f0b90b", approved: "#17a2b8", filed: "#0ecb81",
    generating: "#f0b90b", finalized: "#0ecb81", submitted: "#17a2b8",
  };
  return (
    <span style={{ color: map[s] || "#eaecef", fontWeight: 600, textTransform: "capitalize" }}>
      {s?.replace(/_/g, " ")}
    </span>
  );
};

const fmt = (n) => (typeof n === "number" ? n.toLocaleString() : n ?? "—");

export default function DashCompliance() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);

  // Sanctions form
  const [screenForm, setScreenForm] = useState({ name: "", address: "" });
  const [reviewForm, setReviewForm] = useState({ hitId: "", status: "false_positive", notes: "" });

  // Travel Rule form
  const [trForm, setTrForm] = useState({
    transactionId: "", asset: "BTC", amount: "", amountUsd: "",
    originatorVasp: "", originatorName: "", originatorWallet: "",
    beneficiaryVasp: "", beneficiaryName: "", beneficiaryWallet: "",
  });

  // SAR form
  const [sarForm, setSarForm] = useState({
    activityType: "STRUCTURING", description: "",
    totalAmountUsd: "", periodStart: "", periodEnd: "",
  });

  // Report form
  const [rptForm, setRptForm] = useState({
    type: "DAILY", periodStart: "", periodEnd: "",
  });

  if (!user || user.role !== "admin") {
    return (
      <div className="ent-access-denied">
        <h2>Access Denied</h2>
        <p>Regulatory Compliance requires Administrator role.</p>
      </div>
    );
  }

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["reg-compliance-stats"],
    queryFn: () => regulatoryComplianceApi.statistics().then((r) => r.data.stats),
    refetchInterval: 30000,
  });

  const { data: sanctionsData, isLoading: sanctionsLoading } = useQuery({
    queryKey: ["reg-compliance-sanctions"],
    queryFn: () => regulatoryComplianceApi.getSanctionHits().then((r) => r.data),
    enabled: tab === 1,
  });

  const { data: trData, isLoading: trLoading } = useQuery({
    queryKey: ["reg-compliance-travel-rule"],
    queryFn: () => regulatoryComplianceApi.getTravelRuleRecords().then((r) => r.data),
    enabled: tab === 2,
  });

  const { data: sarData, isLoading: sarLoading } = useQuery({
    queryKey: ["reg-compliance-sars"],
    queryFn: () => regulatoryComplianceApi.getSars().then((r) => r.data),
    enabled: tab === 3,
  });

  const { data: rptData, isLoading: rptLoading } = useQuery({
    queryKey: ["reg-compliance-reports"],
    queryFn: () => regulatoryComplianceApi.getReports().then((r) => r.data),
    enabled: tab === 4,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const screenMut = useMutation({
    mutationFn: (body) => regulatoryComplianceApi.screenEntity(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reg-compliance-sanctions"] });
      qc.invalidateQueries({ queryKey: ["reg-compliance-stats"] });
      setScreenForm({ name: "", address: "" });
    },
  });

  const reviewMut = useMutation({
    mutationFn: ({ hitId, ...body }) => regulatoryComplianceApi.reviewSanctionHit(hitId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reg-compliance-sanctions"] });
      qc.invalidateQueries({ queryKey: ["reg-compliance-stats"] });
      setReviewForm({ hitId: "", status: "false_positive", notes: "" });
    },
  });

  const trMut = useMutation({
    mutationFn: (body) => regulatoryComplianceApi.createTravelRuleRecord(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reg-compliance-travel-rule"] });
      qc.invalidateQueries({ queryKey: ["reg-compliance-stats"] });
      setTrForm({
        transactionId: "", asset: "BTC", amount: "", amountUsd: "",
        originatorVasp: "", originatorName: "", originatorWallet: "",
        beneficiaryVasp: "", beneficiaryName: "", beneficiaryWallet: "",
      });
    },
  });

  const sarMut = useMutation({
    mutationFn: (body) => regulatoryComplianceApi.createSar(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reg-compliance-sars"] });
      qc.invalidateQueries({ queryKey: ["reg-compliance-stats"] });
      setSarForm({ activityType: "STRUCTURING", description: "", totalAmountUsd: "", periodStart: "", periodEnd: "" });
    },
  });

  const submitSarMut = useMutation({
    mutationFn: ({ sarId, filedWith }) => regulatoryComplianceApi.submitSar(sarId, { filedWith }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reg-compliance-sars"] }),
  });

  const rptMut = useMutation({
    mutationFn: (body) => regulatoryComplianceApi.generateReport(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reg-compliance-reports"] });
      setRptForm({ type: "DAILY", periodStart: "", periodEnd: "" });
    },
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="ent-page">
      <div className="ent-header">
        <h1 className="ent-title">
          <i className="bi bi-shield-check" /> Regulatory Compliance
        </h1>
        <p className="ent-subtitle">Phase 33 — Sanctions · Travel Rule · SARs · Reports</p>
      </div>

      {/* Tabs */}
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
          {statsLoading ? <p className="ent-loading">Loading statistics…</p> : stats ? (
            <div className="ent-stat-grid">
              <div className="ent-stat-card">
                <div className="ent-stat-label">Total Sanction Hits</div>
                <div className="ent-stat-value">{fmt(stats.sanctions?.total)}</div>
              </div>
              <div className="ent-stat-card">
                <div className="ent-stat-label">Pending Review</div>
                <div className="ent-stat-value" style={{ color: "#f0b90b" }}>{fmt(stats.sanctions?.pending)}</div>
              </div>
              <div className="ent-stat-card">
                <div className="ent-stat-label">Confirmed Hits</div>
                <div className="ent-stat-value" style={{ color: "#f6465d" }}>{fmt(stats.sanctions?.confirmed)}</div>
              </div>
              <div className="ent-stat-card">
                <div className="ent-stat-label">Travel Rule Records</div>
                <div className="ent-stat-value">{fmt(stats.travelRule?.total)}</div>
              </div>
              <div className="ent-stat-card">
                <div className="ent-stat-label">SARs — Draft</div>
                <div className="ent-stat-value" style={{ color: "#aaa" }}>{fmt(stats.sar?.draft)}</div>
              </div>
              <div className="ent-stat-card">
                <div className="ent-stat-label">SARs — Filed</div>
                <div className="ent-stat-value" style={{ color: "#0ecb81" }}>{fmt(stats.sar?.filed)}</div>
              </div>
              <div className="ent-stat-card">
                <div className="ent-stat-label">Compliance Reports</div>
                <div className="ent-stat-value">{fmt(stats.reports?.total)}</div>
              </div>
              <div className="ent-stat-card">
                <div className="ent-stat-label">Screenings (session)</div>
                <div className="ent-stat-value">{fmt(stats.inMemory?.sanctionScreenings)}</div>
              </div>
            </div>
          ) : <p className="ent-empty">No statistics available.</p>}
        </div>
      )}

      {/* ── Sanctions ──────────────────────────────────────────────────────── */}
      {tab === 1 && (
        <div>
          <div className="ent-section">
            <h3 className="ent-section-title">Screen Entity</h3>
            <form
              className="ent-form"
              onSubmit={(e) => {
                e.preventDefault();
                const body = {};
                if (screenForm.name.trim())    body.name    = screenForm.name.trim();
                if (screenForm.address.trim()) body.address = screenForm.address.trim();
                screenMut.mutate(body);
              }}
            >
              <div className="ent-form-row">
                <input
                  className="ent-input"
                  placeholder="Name (e.g. John Doe)"
                  value={screenForm.name}
                  onChange={(e) => setScreenForm((p) => ({ ...p, name: e.target.value }))}
                />
                <input
                  className="ent-input"
                  placeholder="Wallet address"
                  value={screenForm.address}
                  onChange={(e) => setScreenForm((p) => ({ ...p, address: e.target.value }))}
                />
                <button className="ent-btn" type="submit" disabled={screenMut.isPending}>
                  {screenMut.isPending ? "Screening…" : "Screen"}
                </button>
              </div>
              {screenMut.isError && <p className="ent-error">{screenMut.error?.response?.data?.error || "Screen failed."}</p>}
              {screenMut.isSuccess && (
                <p className="ent-success">
                  Screening complete — {screenMut.data?.data?.hits?.length || 0} hit(s) found.
                </p>
              )}
            </form>
          </div>

          <div className="ent-section">
            <h3 className="ent-section-title">Review Hit</h3>
            <form
              className="ent-form"
              onSubmit={(e) => {
                e.preventDefault();
                reviewMut.mutate(reviewForm);
              }}
            >
              <div className="ent-form-row">
                <input
                  className="ent-input"
                  placeholder="Hit ID (SHT-…)"
                  value={reviewForm.hitId}
                  onChange={(e) => setReviewForm((p) => ({ ...p, hitId: e.target.value }))}
                  required
                />
                <select
                  className="ent-select"
                  value={reviewForm.status}
                  onChange={(e) => setReviewForm((p) => ({ ...p, status: e.target.value }))}
                >
                  <option value="false_positive">False Positive</option>
                  <option value="confirmed">Confirm Hit</option>
                  <option value="escalated">Escalate</option>
                </select>
                <input
                  className="ent-input"
                  placeholder="Review notes"
                  value={reviewForm.notes}
                  onChange={(e) => setReviewForm((p) => ({ ...p, notes: e.target.value }))}
                />
                <button className="ent-btn" type="submit" disabled={reviewMut.isPending}>
                  {reviewMut.isPending ? "Saving…" : "Save Review"}
                </button>
              </div>
              {reviewMut.isError && <p className="ent-error">{reviewMut.error?.response?.data?.error || "Review failed."}</p>}
              {reviewMut.isSuccess && <p className="ent-success">Hit reviewed successfully.</p>}
            </form>
          </div>

          {sanctionsLoading ? <p className="ent-loading">Loading hits…</p> : (
            <div className="ent-table-wrap">
              <table className="ent-table">
                <thead>
                  <tr>
                    <th>Hit ID</th><th>List</th><th>Matched Value</th>
                    <th>Type</th><th>Score</th><th>Status</th><th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {sanctionsData?.hits?.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: "center" }}>No sanction hits.</td></tr>
                  )}
                  {sanctionsData?.hits?.map((h) => (
                    <tr key={h.hitId}>
                      <td className="ent-mono">{h.hitId}</td>
                      <td>{h.listName}</td>
                      <td>{h.matchedValue}</td>
                      <td>{h.matchType}</td>
                      <td>{h.matchScore}</td>
                      <td>{statusBadge(h.status)}</td>
                      <td>{new Date(h.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Travel Rule ─────────────────────────────────────────────────────── */}
      {tab === 2 && (
        <div>
          <div className="ent-section">
            <h3 className="ent-section-title">Create Travel Rule Record</h3>
            <form
              className="ent-form"
              onSubmit={(e) => {
                e.preventDefault();
                trMut.mutate({
                  ...trForm,
                  amount: parseFloat(trForm.amount),
                  amountUsd: parseFloat(trForm.amountUsd),
                });
              }}
            >
              <div className="ent-form-row">
                <input className="ent-input" placeholder="Transaction ID" value={trForm.transactionId}
                  onChange={(e) => setTrForm((p) => ({ ...p, transactionId: e.target.value }))} required />
                <input className="ent-input" placeholder="Asset (BTC)" value={trForm.asset}
                  onChange={(e) => setTrForm((p) => ({ ...p, asset: e.target.value }))} required />
                <input className="ent-input" placeholder="Amount" type="number" value={trForm.amount}
                  onChange={(e) => setTrForm((p) => ({ ...p, amount: e.target.value }))} required />
                <input className="ent-input" placeholder="Amount USD" type="number" value={trForm.amountUsd}
                  onChange={(e) => setTrForm((p) => ({ ...p, amountUsd: e.target.value }))} required />
              </div>
              <div className="ent-form-row">
                <input className="ent-input" placeholder="Originator VASP" value={trForm.originatorVasp}
                  onChange={(e) => setTrForm((p) => ({ ...p, originatorVasp: e.target.value }))} required />
                <input className="ent-input" placeholder="Originator Name" value={trForm.originatorName}
                  onChange={(e) => setTrForm((p) => ({ ...p, originatorName: e.target.value }))} required />
                <input className="ent-input" placeholder="Originator Wallet" value={trForm.originatorWallet}
                  onChange={(e) => setTrForm((p) => ({ ...p, originatorWallet: e.target.value }))} required />
              </div>
              <div className="ent-form-row">
                <input className="ent-input" placeholder="Beneficiary VASP" value={trForm.beneficiaryVasp}
                  onChange={(e) => setTrForm((p) => ({ ...p, beneficiaryVasp: e.target.value }))} required />
                <input className="ent-input" placeholder="Beneficiary Name" value={trForm.beneficiaryName}
                  onChange={(e) => setTrForm((p) => ({ ...p, beneficiaryName: e.target.value }))} required />
                <input className="ent-input" placeholder="Beneficiary Wallet" value={trForm.beneficiaryWallet}
                  onChange={(e) => setTrForm((p) => ({ ...p, beneficiaryWallet: e.target.value }))} required />
              </div>
              <button className="ent-btn" type="submit" disabled={trMut.isPending}>
                {trMut.isPending ? "Creating…" : "Create Record"}
              </button>
              {trMut.isError && <p className="ent-error">{trMut.error?.response?.data?.error || "Failed."}</p>}
              {trMut.isSuccess && <p className="ent-success">Travel Rule record created.</p>}
            </form>
          </div>

          {trLoading ? <p className="ent-loading">Loading records…</p> : (
            <div className="ent-table-wrap">
              <table className="ent-table">
                <thead>
                  <tr>
                    <th>Record ID</th><th>Tx ID</th><th>Asset</th><th>Amount USD</th>
                    <th>Originator</th><th>Beneficiary</th><th>Status</th><th>Protocol</th>
                  </tr>
                </thead>
                <tbody>
                  {trData?.records?.length === 0 && (
                    <tr><td colSpan={8} style={{ textAlign: "center" }}>No travel rule records.</td></tr>
                  )}
                  {trData?.records?.map((r) => (
                    <tr key={r.recordId}>
                      <td className="ent-mono">{r.recordId}</td>
                      <td className="ent-mono">{r.transactionId}</td>
                      <td>{r.asset}</td>
                      <td>${fmt(r.amountUsd)}</td>
                      <td>{r.originatorName} ({r.originatorVasp})</td>
                      <td>{r.beneficiaryName} ({r.beneficiaryVasp})</td>
                      <td>{statusBadge(r.status)}</td>
                      <td>{r.protocol}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── SARs ────────────────────────────────────────────────────────────── */}
      {tab === 3 && (
        <div>
          <div className="ent-section">
            <h3 className="ent-section-title">Create SAR</h3>
            <form
              className="ent-form"
              onSubmit={(e) => {
                e.preventDefault();
                sarMut.mutate({
                  ...sarForm,
                  totalAmountUsd: parseFloat(sarForm.totalAmountUsd || "0"),
                });
              }}
            >
              <div className="ent-form-row">
                <select className="ent-select" value={sarForm.activityType}
                  onChange={(e) => setSarForm((p) => ({ ...p, activityType: e.target.value }))}>
                  {["STRUCTURING","RAPID_TRADING","LARGE_TRANSACTION","SANCTIONS_HIT","VELOCITY_BREACH","OTHER"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <input className="ent-input" placeholder="Total Amount USD" type="number"
                  value={sarForm.totalAmountUsd}
                  onChange={(e) => setSarForm((p) => ({ ...p, totalAmountUsd: e.target.value }))} />
              </div>
              <div className="ent-form-row">
                <input className="ent-input" placeholder="Period Start" type="date"
                  value={sarForm.periodStart}
                  onChange={(e) => setSarForm((p) => ({ ...p, periodStart: e.target.value }))} required />
                <input className="ent-input" placeholder="Period End" type="date"
                  value={sarForm.periodEnd}
                  onChange={(e) => setSarForm((p) => ({ ...p, periodEnd: e.target.value }))} required />
              </div>
              <textarea
                className="ent-textarea"
                placeholder="Description of suspicious activity…"
                rows={3}
                value={sarForm.description}
                onChange={(e) => setSarForm((p) => ({ ...p, description: e.target.value }))}
                required
              />
              <button className="ent-btn" type="submit" disabled={sarMut.isPending}>
                {sarMut.isPending ? "Creating…" : "Create SAR"}
              </button>
              {sarMut.isError && <p className="ent-error">{sarMut.error?.response?.data?.error || "Failed."}</p>}
              {sarMut.isSuccess && <p className="ent-success">SAR created in draft.</p>}
            </form>
          </div>

          {sarLoading ? <p className="ent-loading">Loading SARs…</p> : (
            <div className="ent-table-wrap">
              <table className="ent-table">
                <thead>
                  <tr>
                    <th>SAR ID</th><th>Activity Type</th><th>Amount USD</th>
                    <th>Period</th><th>Status</th><th>Filed With</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sarData?.sars?.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: "center" }}>No SARs.</td></tr>
                  )}
                  {sarData?.sars?.map((s) => (
                    <tr key={s.sarId}>
                      <td className="ent-mono">{s.sarId}</td>
                      <td>{s.activityType}</td>
                      <td>${fmt(s.totalAmountUsd)}</td>
                      <td>{new Date(s.periodStart).toLocaleDateString()} – {new Date(s.periodEnd).toLocaleDateString()}</td>
                      <td>{statusBadge(s.status)}</td>
                      <td>{s.filedWith || "—"}</td>
                      <td>
                        {["draft","under_review","approved"].includes(s.status) && (
                          <button
                            className="ent-btn ent-btn--sm"
                            onClick={() => submitSarMut.mutate({ sarId: s.sarId, filedWith: "FinCEN" })}
                            disabled={submitSarMut.isPending}
                          >
                            File
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

      {/* ── Reports ─────────────────────────────────────────────────────────── */}
      {tab === 4 && (
        <div>
          <div className="ent-section">
            <h3 className="ent-section-title">Generate Report</h3>
            <form
              className="ent-form"
              onSubmit={(e) => {
                e.preventDefault();
                rptMut.mutate(rptForm);
              }}
            >
              <div className="ent-form-row">
                <select className="ent-select" value={rptForm.type}
                  onChange={(e) => setRptForm((p) => ({ ...p, type: e.target.value }))}>
                  {["DAILY","WEEKLY","MONTHLY","ON_DEMAND","AUDIT"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <input className="ent-input" type="date" placeholder="Period Start"
                  value={rptForm.periodStart}
                  onChange={(e) => setRptForm((p) => ({ ...p, periodStart: e.target.value }))} required />
                <input className="ent-input" type="date" placeholder="Period End"
                  value={rptForm.periodEnd}
                  onChange={(e) => setRptForm((p) => ({ ...p, periodEnd: e.target.value }))} required />
                <button className="ent-btn" type="submit" disabled={rptMut.isPending}>
                  {rptMut.isPending ? "Generating…" : "Generate"}
                </button>
              </div>
              {rptMut.isError && <p className="ent-error">{rptMut.error?.response?.data?.error || "Failed."}</p>}
              {rptMut.isSuccess && <p className="ent-success">Report generation started.</p>}
            </form>
          </div>

          {rptLoading ? <p className="ent-loading">Loading reports…</p> : (
            <div className="ent-table-wrap">
              <table className="ent-table">
                <thead>
                  <tr>
                    <th>Report ID</th><th>Type</th><th>Period</th>
                    <th>Status</th><th>Generated By</th><th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {rptData?.reports?.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: "center" }}>No reports generated.</td></tr>
                  )}
                  {rptData?.reports?.map((r) => (
                    <tr key={r.reportId}>
                      <td className="ent-mono">{r.reportId}</td>
                      <td>{r.type}</td>
                      <td>{new Date(r.periodStart).toLocaleDateString()} – {new Date(r.periodEnd).toLocaleDateString()}</td>
                      <td>{statusBadge(r.status)}</td>
                      <td>{r.generatedBy}</td>
                      <td>{new Date(r.createdAt).toLocaleString()}</td>
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
