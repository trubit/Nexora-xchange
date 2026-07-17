import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../store/authStore";
import { globalEcosystemApi } from "../../services/api/globalEcosystem";
import "../../styles/dashboard.css";
import "../../styles/enterprise.css";

const TABS = ["Dashboard", "Partners", "Payments", "Integrations"];

const statusBadge = (s) => {
  const map = {
    active: "#0ecb81", pending: "#f0b90b", suspended: "#f6465d", terminated: "#555",
    completed: "#0ecb81", processing: "#f0b90b", failed: "#f6465d",
    initiated: "#aaa", refunded: "#17a2b8",
    configured: "#f0b90b", failing: "#f6465d", paused: "#aaa", deprecated: "#555",
  };
  return (
    <span style={{ color: map[s] || "#eaecef", fontWeight: 600, textTransform: "capitalize" }}>
      {s?.replace(/_/g, " ")}
    </span>
  );
};

const fmt = (n) => (typeof n === "number" ? n.toLocaleString() : n ?? "—");

export default function DashEcosystem() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);

  // Partner form
  const [pForm, setPForm] = useState({ name: "", type: "exchange", region: "global", apiEndpoint: "" });
  const [ratingForm, setRatingForm] = useState({ partnerId: "", score: "" });

  // Payment form
  const [payForm, setPayForm] = useState({
    sourceCurrency: "USD", targetCurrency: "EUR", sourceAmount: "",
    fromPartnerId: "", toPartnerId: "", rail: "internal",
  });

  // Integration form
  const [intForm, setIntForm] = useState({ partnerId: "", type: "rest_pull", direction: "bidirectional" });

  if (!user || user.role !== "admin") {
    return (
      <div className="ent-access-denied">
        <h2>Access Denied</h2>
        <p>Global Ecosystem requires Administrator role.</p>
      </div>
    );
  }

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["ecosystem-stats"],
    queryFn: () => globalEcosystemApi.statistics().then((r) => r.data.stats),
    refetchInterval: 30000,
  });

  const { data: partnerData, isLoading: partnerLoading } = useQuery({
    queryKey: ["ecosystem-partners"],
    queryFn: () => globalEcosystemApi.getPartners().then((r) => r.data),
    enabled: tab === 1,
  });

  const { data: payData, isLoading: payLoading } = useQuery({
    queryKey: ["ecosystem-payments"],
    queryFn: () => globalEcosystemApi.getPayments().then((r) => r.data),
    enabled: tab === 2,
  });

  const { data: intData, isLoading: intLoading } = useQuery({
    queryKey: ["ecosystem-integrations"],
    queryFn: () => globalEcosystemApi.getIntegrations().then((r) => r.data),
    enabled: tab === 3,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const onboardMut = useMutation({
    mutationFn: (body) => globalEcosystemApi.onboardPartner(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ecosystem-partners"] });
      qc.invalidateQueries({ queryKey: ["ecosystem-stats"] });
      setPForm({ name: "", type: "exchange", region: "global", apiEndpoint: "" });
    },
  });

  const activateMut = useMutation({
    mutationFn: (id) => globalEcosystemApi.activatePartner(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ecosystem-partners"] }),
  });

  const ratingMut = useMutation({
    mutationFn: ({ partnerId, score }) => globalEcosystemApi.ratePartner(partnerId, parseFloat(score)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ecosystem-partners"] });
      setRatingForm({ partnerId: "", score: "" });
    },
  });

  const payMut = useMutation({
    mutationFn: (body) => globalEcosystemApi.initiatePayment(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ecosystem-payments"] });
      qc.invalidateQueries({ queryKey: ["ecosystem-stats"] });
      setPayForm({ sourceCurrency: "USD", targetCurrency: "EUR", sourceAmount: "", fromPartnerId: "", toPartnerId: "", rail: "internal" });
    },
  });

  const intMut = useMutation({
    mutationFn: (body) => globalEcosystemApi.createIntegration(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ecosystem-integrations"] });
      setIntForm({ partnerId: "", type: "rest_pull", direction: "bidirectional" });
    },
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="ent-page">
      <div className="ent-header">
        <h1 className="ent-title">
          <i className="bi bi-globe2" /> Global Ecosystem
        </h1>
        <p className="ent-subtitle">Phase 36 — Partners · Payments · Integrations</p>
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
                <div className="ent-stat-label">Total Partners</div>
                <div className="ent-stat-value">{fmt(stats.partners?.total)}</div>
              </div>
              <div className="ent-stat-card">
                <div className="ent-stat-label">Active Partners</div>
                <div className="ent-stat-value" style={{ color: "#0ecb81" }}>{fmt(stats.partners?.active)}</div>
              </div>
              <div className="ent-stat-card">
                <div className="ent-stat-label">Payments Total</div>
                <div className="ent-stat-value">{fmt(stats.payments?.total)}</div>
              </div>
              <div className="ent-stat-card">
                <div className="ent-stat-label">Payments Completed</div>
                <div className="ent-stat-value" style={{ color: "#0ecb81" }}>{fmt(stats.payments?.completed)}</div>
              </div>
              <div className="ent-stat-card">
                <div className="ent-stat-label">Integrations Total</div>
                <div className="ent-stat-value">{fmt(stats.integrations?.total)}</div>
              </div>
              <div className="ent-stat-card">
                <div className="ent-stat-label">Active Integrations</div>
                <div className="ent-stat-value" style={{ color: "#0ecb81" }}>{fmt(stats.integrations?.active)}</div>
              </div>
              <div className="ent-stat-card">
                <div className="ent-stat-label">Failing Integrations</div>
                <div className="ent-stat-value" style={{ color: "#f6465d" }}>{fmt(stats.integrations?.failing)}</div>
              </div>
            </div>
          ) : <p className="ent-empty">No statistics available.</p>}
        </div>
      )}

      {/* ── Partners ───────────────────────────────────────────────────────── */}
      {tab === 1 && (
        <div>
          <div className="ent-section">
            <h3 className="ent-section-title">Onboard Partner</h3>
            <form className="ent-form" onSubmit={(e) => { e.preventDefault(); onboardMut.mutate(pForm); }}>
              <div className="ent-form-row">
                <input className="ent-input" placeholder="Partner Name" value={pForm.name}
                  onChange={(e) => setPForm((p) => ({ ...p, name: e.target.value }))} required />
                <select className="ent-select" value={pForm.type}
                  onChange={(e) => setPForm((p) => ({ ...p, type: e.target.value }))}>
                  {["exchange","bank","payment_processor","defi_protocol","custodian","data_provider"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <input className="ent-input" placeholder="Region" value={pForm.region}
                  onChange={(e) => setPForm((p) => ({ ...p, region: e.target.value }))} />
                <button className="ent-btn" type="submit" disabled={onboardMut.isPending}>
                  {onboardMut.isPending ? "Onboarding…" : "Onboard"}
                </button>
              </div>
              {onboardMut.isError && <p className="ent-error">{onboardMut.error?.response?.data?.error || "Failed."}</p>}
              {onboardMut.isSuccess && <p className="ent-success">Partner onboarded.</p>}
            </form>
          </div>

          <div className="ent-section">
            <h3 className="ent-section-title">Update Rating</h3>
            <form className="ent-form" onSubmit={(e) => { e.preventDefault(); ratingMut.mutate(ratingForm); }}>
              <div className="ent-form-row">
                <input className="ent-input" placeholder="Partner ID (PRT-…)" value={ratingForm.partnerId}
                  onChange={(e) => setRatingForm((p) => ({ ...p, partnerId: e.target.value }))} required />
                <input className="ent-input" placeholder="Score (0–100)" type="number" min="0" max="100"
                  value={ratingForm.score}
                  onChange={(e) => setRatingForm((p) => ({ ...p, score: e.target.value }))} required />
                <button className="ent-btn" type="submit" disabled={ratingMut.isPending}>
                  {ratingMut.isPending ? "Saving…" : "Update Rating"}
                </button>
              </div>
              {ratingMut.isError && <p className="ent-error">{ratingMut.error?.response?.data?.error || "Failed."}</p>}
              {ratingMut.isSuccess && <p className="ent-success">Rating updated.</p>}
            </form>
          </div>

          {partnerLoading ? <p className="ent-loading">Loading partners…</p> : (
            <div className="ent-table-wrap">
              <table className="ent-table">
                <thead>
                  <tr>
                    <th>Partner ID</th><th>Name</th><th>Type</th>
                    <th>Region</th><th>Status</th><th>Rating</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {partnerData?.partners?.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: "center" }}>No partners.</td></tr>
                  )}
                  {partnerData?.partners?.map((p) => (
                    <tr key={p.partnerId}>
                      <td className="ent-mono">{p.partnerId}</td>
                      <td>{p.name}</td>
                      <td>{p.type}</td>
                      <td>{p.region}</td>
                      <td>{statusBadge(p.status)}</td>
                      <td>{p.ratingScore ?? "—"}</td>
                      <td>
                        {p.status === "pending" && (
                          <button className="ent-btn ent-btn--sm"
                            onClick={() => activateMut.mutate(p.partnerId)}
                            disabled={activateMut.isPending}>
                            Activate
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

      {/* ── Payments ───────────────────────────────────────────────────────── */}
      {tab === 2 && (
        <div>
          <div className="ent-section">
            <h3 className="ent-section-title">Initiate Cross-Border Payment</h3>
            <form className="ent-form" onSubmit={(e) => {
              e.preventDefault();
              payMut.mutate({ ...payForm, sourceAmount: parseFloat(payForm.sourceAmount) });
            }}>
              <div className="ent-form-row">
                <input className="ent-input" placeholder="Source Currency (USD)" value={payForm.sourceCurrency}
                  onChange={(e) => setPayForm((p) => ({ ...p, sourceCurrency: e.target.value }))} required />
                <input className="ent-input" placeholder="Target Currency (EUR)" value={payForm.targetCurrency}
                  onChange={(e) => setPayForm((p) => ({ ...p, targetCurrency: e.target.value }))} required />
                <input className="ent-input" placeholder="Amount" type="number" value={payForm.sourceAmount}
                  onChange={(e) => setPayForm((p) => ({ ...p, sourceAmount: e.target.value }))} required />
                <select className="ent-select" value={payForm.rail}
                  onChange={(e) => setPayForm((p) => ({ ...p, rail: e.target.value }))}>
                  {["SWIFT","SEPA","RippleNet","Stellar","CIPS","ACH","internal"].map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <button className="ent-btn" type="submit" disabled={payMut.isPending}>
                  {payMut.isPending ? "Sending…" : "Initiate"}
                </button>
              </div>
              {payMut.isError && <p className="ent-error">{payMut.error?.response?.data?.error || "Failed."}</p>}
              {payMut.isSuccess && <p className="ent-success">Payment initiated.</p>}
            </form>
          </div>

          {payLoading ? <p className="ent-loading">Loading payments…</p> : (
            <div className="ent-table-wrap">
              <table className="ent-table">
                <thead>
                  <tr>
                    <th>Payment ID</th><th>From</th><th>To</th><th>Rail</th>
                    <th>Source</th><th>Target</th><th>Rate</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payData?.payments?.length === 0 && (
                    <tr><td colSpan={8} style={{ textAlign: "center" }}>No payments.</td></tr>
                  )}
                  {payData?.payments?.map((p) => (
                    <tr key={p.paymentId}>
                      <td className="ent-mono">{p.paymentId}</td>
                      <td>{p.fromPartnerId || "—"}</td>
                      <td>{p.toPartnerId || "—"}</td>
                      <td>{p.rail}</td>
                      <td>{p.sourceAmount} {p.sourceCurrency}</td>
                      <td>{p.targetAmount} {p.targetCurrency}</td>
                      <td>{p.exchangeRate?.toFixed(4)}</td>
                      <td>{statusBadge(p.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Integrations ────────────────────────────────────────────────────── */}
      {tab === 3 && (
        <div>
          <div className="ent-section">
            <h3 className="ent-section-title">Create Integration</h3>
            <form className="ent-form" onSubmit={(e) => { e.preventDefault(); intMut.mutate(intForm); }}>
              <div className="ent-form-row">
                <input className="ent-input" placeholder="Partner ID (PRT-…)" value={intForm.partnerId}
                  onChange={(e) => setIntForm((p) => ({ ...p, partnerId: e.target.value }))} required />
                <select className="ent-select" value={intForm.type}
                  onChange={(e) => setIntForm((p) => ({ ...p, type: e.target.value }))}>
                  {["webhook","rest_pull","websocket","sftp","batch"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <select className="ent-select" value={intForm.direction}
                  onChange={(e) => setIntForm((p) => ({ ...p, direction: e.target.value }))}>
                  <option value="bidirectional">Bidirectional</option>
                  <option value="inbound">Inbound</option>
                  <option value="outbound">Outbound</option>
                </select>
                <button className="ent-btn" type="submit" disabled={intMut.isPending}>
                  {intMut.isPending ? "Creating…" : "Create"}
                </button>
              </div>
              {intMut.isError && <p className="ent-error">{intMut.error?.response?.data?.error || "Failed."}</p>}
              {intMut.isSuccess && <p className="ent-success">Integration created.</p>}
            </form>
          </div>

          {intLoading ? <p className="ent-loading">Loading integrations…</p> : (
            <div className="ent-table-wrap">
              <table className="ent-table">
                <thead>
                  <tr>
                    <th>Integration ID</th><th>Partner ID</th><th>Type</th>
                    <th>Direction</th><th>Status</th><th>Calls</th><th>Errors</th><th>Last Success</th>
                  </tr>
                </thead>
                <tbody>
                  {intData?.integrations?.length === 0 && (
                    <tr><td colSpan={8} style={{ textAlign: "center" }}>No integrations.</td></tr>
                  )}
                  {intData?.integrations?.map((i) => (
                    <tr key={i.integrationId}>
                      <td className="ent-mono">{i.integrationId}</td>
                      <td className="ent-mono">{i.partnerId}</td>
                      <td>{i.type}</td>
                      <td>{i.direction}</td>
                      <td>{statusBadge(i.status)}</td>
                      <td>{fmt(i.callCount)}</td>
                      <td style={{ color: i.errorCount > 0 ? "#f6465d" : "inherit" }}>{fmt(i.errorCount)}</td>
                      <td>{i.lastSuccessAt ? new Date(i.lastSuccessAt).toLocaleString() : "Never"}</td>
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
