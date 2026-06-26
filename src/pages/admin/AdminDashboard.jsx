import { useState, useMemo }      from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore }    from "../../store/authStore";
import { requestWithRetry } from "../../api/client.js";
import DashNavbar  from "../../Components/layout/DashNavbar";
import CoinLogo    from "../../Components/common/CoinLogo";
import "../../styles/dashboard.css";
import "../../styles/admin.css";

// ── API helpers ───────────────────────────────────────────────────────────────

const api = {
  users:       () => requestWithRetry({ method: "get", url: "/api/users" }),
  kyc:         () => requestWithRetry({ method: "get", url: "/api/kyc" }),
  tickets:     () => requestWithRetry({ method: "get", url: "/api/support/admin/all" }),
  riskStats:   () => requestWithRetry({ method: "get", url: "/api/risk/admin/stats" }),
  riskUsers:   () => requestWithRetry({ method: "get", url: "/api/risk/admin/users" }),
  riskEvents:  () => requestWithRetry({ method: "get", url: "/api/risk/admin/events" }),
  reviewKyc:   (id, body) => requestWithRetry({ method: "put",  url: `/api/kyc/${id}`,              data: body }),
  updateUser:  (id, body) => requestWithRetry({ method: "put",  url: `/api/users/${id}`,            data: body }),
  freezeUser:  (id)       => requestWithRetry({ method: "post", url: `/api/risk/admin/freeze/${id}` }),
  unfreezeUser:(id)       => requestWithRetry({ method: "post", url: `/api/risk/admin/unfreeze/${id}` }),
  updateTicket:(id, body) => requestWithRetry({ method: "put",  url: `/api/support/${id}`,          data: body }),
  // Coins
  listCoins:   ()         => requestWithRetry({ method: "get",    url: "/api/coins" }),
  createCoin:  (body)     => requestWithRetry({ method: "post",   url: "/api/coins",             data: body }),
  updateCoin:  (id, body) => requestWithRetry({ method: "put",    url: `/api/coins/${id}`,       data: body }),
  deleteCoin:  (id, hard) => requestWithRetry({ method: "delete", url: `/api/coins/${id}${hard ? "?hard=true" : ""}` }),
  uploadLogo:  (file)     => {
    const fd = new FormData();
    fd.append("logo", file);
    return requestWithRetry({ method: "post", url: "/api/coins/upload-logo", data: fd,
      headers: { "Content-Type": "multipart/form-data" } });
  },
  cgSearch:    (q)        => requestWithRetry({ method: "get",    url: `/api/coins/cg/search?q=${encodeURIComponent(q)}` }),
  cgDetails:   (cgId)     => requestWithRetry({ method: "get",    url: `/api/coins/cg/details/${encodeURIComponent(cgId)}` }),
  // Security / Audit
  auditLogs:   (p = 1, uid = "") => requestWithRetry({ method: "get", url: `/api/audit/?page=${p}&limit=40${uid ? `&userId=${uid}` : ""}` }),
  auditStats:  ()         => requestWithRetry({ method: "get",    url: "/api/audit/stats" }),
  amlAlerts:   (status = "open") => requestWithRetry({ method: "get", url: `/api/security/aml/alerts?status=${status}` }),
  reviewAlert: (id, body) => requestWithRetry({ method: "put",   url: `/api/security/aml/alerts/${id}/review`, data: body }),
  secFreeze:   (id)       => requestWithRetry({ method: "post",  url: `/api/security/users/${id}/freeze` }),
  secUnfreeze: (id)       => requestWithRetry({ method: "post",  url: `/api/security/users/${id}/unfreeze` }),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const pill = (val) => {
  const map = {
    active:     "adm-pill--green",
    approved:   "adm-pill--green",
    open:       "adm-pill--green",
    closed:     "adm-pill--gray",
    resolved:   "adm-pill--gray",
    suspended:  "adm-pill--red",
    frozen:     "adm-pill--red",
    rejected:   "adm-pill--red",
    pending:    "adm-pill--gold",
    admin:      "adm-pill--gold",
    user:       "adm-pill--gray",
    high:       "adm-pill--red",
    medium:     "adm-pill--gold",
    low:        "adm-pill--green",
    unverified: "adm-pill--gray",
  };
  return map[val] || "adm-pill--gray";
};

// ── Sub-panels ────────────────────────────────────────────────────────────────

const OverviewPanel = () => {
  const { data: uData } = useQuery({ queryKey: ["adm-users"],  queryFn: api.users,      staleTime: 60_000 });
  const { data: kData } = useQuery({ queryKey: ["adm-kyc"],    queryFn: api.kyc,        staleTime: 60_000 });
  const { data: tData } = useQuery({ queryKey: ["adm-tickets"],queryFn: api.tickets,    staleTime: 60_000 });
  const { data: rData } = useQuery({ queryKey: ["adm-risk"],   queryFn: api.riskStats,  staleTime: 60_000 });
  const { data: eData } = useQuery({ queryKey: ["adm-events"], queryFn: api.riskEvents, staleTime: 60_000 });

  const users   = uData?.users   || [];
  const kyc     = kData?.profiles|| [];
  const tickets = tData?.tickets || [];
  const events  = eData?.events  || [];

  const pendingKyc     = kyc.filter((k) => k.status === "pending").length;
  const openTickets    = tickets.filter((t) => t.status === "open").length;
  const activeUsers    = users.filter((u) => u.status === "active").length;
  const frozenAccounts = rData?.frozen || 0;

  return (
    <>
      <div className="adm-kpi-strip">
        <div className="adm-kpi-card">
          <div className="adm-kpi-label">Total Users</div>
          <div className="adm-kpi-value adm-kpi-value--green">{users.length}</div>
          <div className="adm-kpi-sub">{activeUsers} active</div>
        </div>
        <div className="adm-kpi-card">
          <div className="adm-kpi-label">Pending KYC</div>
          <div className={`adm-kpi-value ${pendingKyc > 0 ? "adm-kpi-value--gold" : ""}`}>{pendingKyc}</div>
          <div className="adm-kpi-sub">{kyc.length} total submissions</div>
        </div>
        <div className="adm-kpi-card">
          <div className="adm-kpi-label">Open Tickets</div>
          <div className={`adm-kpi-value ${openTickets > 0 ? "adm-kpi-value--red" : ""}`}>{openTickets}</div>
          <div className="adm-kpi-sub">{tickets.length} total</div>
        </div>
        <div className="adm-kpi-card">
          <div className="adm-kpi-label">Frozen Accounts</div>
          <div className={`adm-kpi-value ${frozenAccounts > 0 ? "adm-kpi-value--red" : ""}`}>{frozenAccounts}</div>
          <div className="adm-kpi-sub">Risk management</div>
        </div>
      </div>

      {/* Recent sign-ups */}
      <div className="dash-section" style={{ marginBottom: "1rem" }}>
        <div className="dash-section-head">
          <span className="dash-section-title">
            <i className="bi bi-people-fill" style={{ marginRight: 7, color: "#f0b90b" }} />
            Recent Sign-ups
          </span>
          <span style={{ fontSize: "0.75rem", color: "#848e9c" }}>{users.slice(0, 5).length} of {users.length}</span>
        </div>
        {users.slice(0, 5).length ? (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.slice(0, 5).map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.name || "—"}</td>
                    <td className="adm-td-muted">{u.email}</td>
                    <td><span className={`adm-pill ${pill(u.role)}`}>{u.role}</span></td>
                    <td><span className={`adm-pill ${pill(u.status)}`}>{u.status}</span></td>
                    <td className="adm-td-muted">{fmtDate(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="adm-loading"><div className="adm-spinner" /></div>
        )}
      </div>

      {/* Recent risk events */}
      {events.length > 0 && (
        <div className="dash-section">
          <div className="dash-section-head">
            <span className="dash-section-title">
              <i className="bi bi-shield-exclamation" style={{ marginRight: 7, color: "#f6465d" }} />
              Recent Risk Events
            </span>
          </div>
          {events.slice(0, 8).map((e, i) => (
            <div key={i} className="adm-event">
              <span className="adm-event-tag">
                <span className={`adm-pill ${pill(e.severity || "medium")}`}>{e.type}</span>
              </span>
              <span className="adm-event-text">{e.description || e.userId}</span>
              <span className="adm-event-time">{fmtDate(e.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

// ── Users panel ───────────────────────────────────────────────────────────────

const UsersPanel = () => {
  const qc = useQueryClient();
  const [search, setSearch]     = useState("");
  const [roleFilter, setRole]   = useState("all");
  const [statusFilter, setStatus] = useState("all");
  const [saving, setSaving]     = useState(null);

  const { data, isLoading } = useQuery({ queryKey: ["adm-users"], queryFn: api.users, staleTime: 60_000 });
  const users = data?.users || [];

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter((u) => {
      if (q && !u.email.toLowerCase().includes(q) && !(u.name || "").toLowerCase().includes(q)) return false;
      if (roleFilter   !== "all" && u.role   !== roleFilter)   return false;
      if (statusFilter !== "all" && u.status !== statusFilter) return false;
      return true;
    });
  }, [users, search, roleFilter, statusFilter]);

  const toggle = async (u, field, val) => {
    setSaving(u.id + field);
    try {
      await api.updateUser(u.id, { [field]: val });
      qc.invalidateQueries({ queryKey: ["adm-users"] });
    } finally {
      setSaving(null);
    }
  };

  return (
    <>
      <div className="adm-toolbar">
        <input
          className="adm-search"
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="adm-filter" value={roleFilter} onChange={(e) => setRole(e.target.value)}>
          <option value="all">All roles</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
        <select className="adm-filter" value={statusFilter} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <span style={{ fontSize: "0.75rem", color: "#848e9c" }}>{filtered.length} user{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="dash-section">
        {isLoading ? (
          <div className="adm-loading"><div className="adm-spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="adm-empty"><i className="bi bi-people" /><p>No users match your filter.</p></div>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>KYC</th>
                  <th>Provider</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.name || <span style={{ color: "#474d57" }}>—</span>}</td>
                    <td className="adm-td-muted">{u.email}</td>
                    <td><span className={`adm-pill ${pill(u.role)}`}>{u.role}</span></td>
                    <td><span className={`adm-pill ${pill(u.status)}`}>{u.status}</span></td>
                    <td><span className={`adm-pill ${pill(u.kycStatus)}`}>{u.kycStatus || "—"}</span></td>
                    <td className="adm-td-muted">{u.authProvider}</td>
                    <td className="adm-td-muted">{fmtDate(u.createdAt)}</td>
                    <td>
                      <div className="adm-action-row">
                        {u.status === "active" ? (
                          <button
                            className="adm-btn adm-btn--red"
                            disabled={saving === u.id + "status"}
                            onClick={() => toggle(u, "status", "suspended")}
                          >
                            <i className="bi bi-slash-circle" /> Suspend
                          </button>
                        ) : (
                          <button
                            className="adm-btn adm-btn--green"
                            disabled={saving === u.id + "status"}
                            onClick={() => toggle(u, "status", "active")}
                          >
                            <i className="bi bi-check-circle" /> Activate
                          </button>
                        )}
                        {u.role !== "admin" && (
                          <button
                            className="adm-btn adm-btn--gold"
                            disabled={saving === u.id + "role"}
                            onClick={() => toggle(u, "role", "admin")}
                          >
                            <i className="bi bi-shield-fill" /> Make Admin
                          </button>
                        )}
                        {u.role === "admin" && u.email !== (import.meta.env.VITE_SUPER_ADMIN_EMAIL || "") && (
                          <button
                            className="adm-btn adm-btn--gray"
                            disabled={saving === u.id + "role"}
                            onClick={() => toggle(u, "role", "user")}
                          >
                            <i className="bi bi-person" /> Remove Admin
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
};

// ── KYC panel ─────────────────────────────────────────────────────────────────

const DOC_TYPE_LABEL = { passport: "Passport", national_id: "National ID", drivers_license: "Driver's License" };
const KYC_STATUS_COLOR = { pending: "#f59e0b", approved: "#0ecb81", rejected: "#f6465d" };

const KycPanel = () => {
  const qc = useQueryClient();
  const [filter, setFilter]   = useState("pending");
  const [expanded, setExpanded] = useState(null);
  const [note, setNote]        = useState({});
  const [saving, setSaving]    = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [reviewErr, setReviewErr] = useState({});

  const { data, isLoading } = useQuery({ queryKey: ["adm-kyc"], queryFn: api.kyc, staleTime: 30_000 });
  const profiles = data?.profiles || [];
  const filtered  = filter === "all" ? profiles : profiles.filter((p) => p.status === filter);

  const counts = {
    pending:  profiles.filter((p) => p.status === "pending").length,
    approved: profiles.filter((p) => p.status === "approved").length,
    rejected: profiles.filter((p) => p.status === "rejected").length,
  };

  const review = async (id, status) => {
    setSaving(id + status);
    setReviewErr((e) => { const n = { ...e }; delete n[id]; return n; });
    try {
      await api.reviewKyc(id, { status, reviewerNote: note[id] || "" });
      qc.invalidateQueries({ queryKey: ["adm-kyc"] });
      setExpanded(null);
    } catch (e) {
      setReviewErr((prev) => ({ ...prev, [id]: e?.message || "Review failed." }));
    } finally {
      setSaving(null);
    }
  };

  return (
    <>
      {/* Lightbox */}
      {lightbox && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="document"
            style={{ maxWidth: "90vw", maxHeight: "88vh", borderRadius: 10, boxShadow: "0 8px 48px rgba(0,0,0,0.7)" }} />
          <button onClick={() => setLightbox(null)}
            style={{ position: "absolute", top: 18, right: 24, background: "none", border: "none",
              color: "#fff", fontSize: "1.8rem", cursor: "pointer", lineHeight: 1 }}>✕</button>
        </div>
      )}

      {/* KPI strip */}
      <div className="adm-kpi-strip" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
        {[
          { label: "Pending",  val: counts.pending,  cls: counts.pending  > 0 ? "adm-kpi-value--gold"  : "" },
          { label: "Approved", val: counts.approved, cls: "adm-kpi-value--green" },
          { label: "Rejected", val: counts.rejected, cls: counts.rejected > 0 ? "adm-kpi-value--red"   : "" },
        ].map((k) => (
          <div key={k.label} className="adm-kpi-card">
            <div className="adm-kpi-label">{k.label}</div>
            <div className={`adm-kpi-value ${k.cls}`}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="adm-toolbar">
        {["pending", "approved", "rejected", "all"].map((s) => (
          <button key={s} className={`adm-btn ${filter === s ? "adm-btn--gold" : "adm-btn--gray"}`}
            onClick={() => setFilter(s)}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
            {s === "pending" && counts.pending > 0 && (
              <span className="adm-badge-count" style={{ marginLeft: 4 }}>{counts.pending}</span>
            )}
          </button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "#848e9c" }}>
          {filtered.length} submission{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {isLoading ? (
        <div className="adm-loading"><div className="adm-spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="adm-empty"><i className="bi bi-person-check" /><p>No {filter} KYC submissions.</p></div>
      ) : filtered.map((p) => {
        const pi    = p.personalInfo || {};
        const color = KYC_STATUS_COLOR[p.status] || "#848e9c";
        const isOpen = expanded === (p._id || p.id);

        return (
          <div key={p._id || p.id} className="adm-card" style={{ marginBottom: "0.85rem" }}>
            {/* Card header — always visible */}
            <div className="adm-card-head" style={{ cursor: "pointer" }}
              onClick={() => setExpanded(isOpen ? null : (p._id || p.id))}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: "50%",
                  background: `${color}18`, border: `2px solid ${color}40`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color, fontSize: "1.1rem", flexShrink: 0,
                }}>
                  <i className="bi bi-person-vcard-fill" />
                </div>
                <div>
                  <div className="adm-card-title">
                    {pi.firstName && pi.lastName ? `${pi.firstName} ${pi.lastName}` : (p.user?.name || p.user?.email || "Unknown")}
                    <span className={`adm-pill ${pill(p.status)}`}>{p.status}</span>
                  </div>
                  <p className="adm-card-meta" style={{ margin: 0 }}>
                    {p.user?.email || "—"} ·{" "}
                    {DOC_TYPE_LABEL[p.documentType] || p.documentType || "Document"} ·{" "}
                    Submitted {fmtDate(p.submittedAt || p.createdAt)}
                  </p>
                </div>
              </div>
              <i className={`bi bi-chevron-${isOpen ? "up" : "down"}`}
                style={{ color: "#848e9c", fontSize: "0.9rem", flexShrink: 0 }} />
            </div>

            {/* Expanded detail */}
            {isOpen && (
              <div style={{ borderTop: "1px solid #2b2f36", paddingTop: "1.25rem", marginTop: "0.5rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", marginBottom: "1.25rem" }}>

                  {/* Personal info */}
                  <div style={{ background: "#0b0e11", border: "1px solid #2b2f36", borderRadius: 10, padding: "1rem" }}>
                    <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#f0b90b", textTransform: "uppercase",
                      letterSpacing: "0.05em", marginBottom: "0.85rem" }}>
                      <i className="bi bi-person-fill" style={{ marginRight: 4 }} /> Personal Info
                    </div>
                    {[
                      ["Full Name",    `${pi.firstName || ""} ${pi.lastName || ""}`.trim() || "—"],
                      ["Date of Birth", pi.dateOfBirth || "—"],
                      ["Nationality",  pi.nationality || "—"],
                      ["Country",      pi.country     || "—"],
                      ["Address",      pi.address     || "—"],
                      ["City",         pi.city        || "—"],
                      ["Postal Code",  pi.postalCode  || "—"],
                      ["Phone",        pi.phone       || "—"],
                    ].map(([k, v]) => (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem",
                        padding: "0.3rem 0", borderBottom: "1px solid rgba(43,47,54,0.5)", fontSize: "0.82rem" }}>
                        <span style={{ color: "#848e9c", flexShrink: 0 }}>{k}</span>
                        <span style={{ color: "#eaecef", textAlign: "right" }}>{v}</span>
                      </div>
                    ))}
                  </div>

                  {/* Documents */}
                  <div style={{ background: "#0b0e11", border: "1px solid #2b2f36", borderRadius: 10, padding: "1rem" }}>
                    <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#f0b90b", textTransform: "uppercase",
                      letterSpacing: "0.05em", marginBottom: "0.85rem" }}>
                      <i className="bi bi-card-image" style={{ marginRight: 4 }} /> Documents
                    </div>
                    <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
                      {(p.documents || []).length === 0 ? (
                        <span style={{ color: "#848e9c", fontSize: "0.82rem" }}>No documents uploaded.</span>
                      ) : (p.documents || []).map((doc) => (
                        <div key={doc.side} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3rem" }}>
                          <img
                            src={doc.url}
                            alt={doc.side}
                            onClick={() => setLightbox(doc.url)}
                            style={{
                              width: 100, height: 78, objectFit: "cover", borderRadius: 8,
                              border: "1.5px solid #2b2f36", cursor: "zoom-in",
                              transition: "border-color 0.15s",
                            }}
                            onMouseOver={(e) => e.currentTarget.style.borderColor = "#f0b90b"}
                            onMouseOut={(e)  => e.currentTarget.style.borderColor = "#2b2f36"}
                          />
                          <span style={{ fontSize: "0.7rem", color: "#848e9c", textTransform: "uppercase",
                            fontWeight: 600, letterSpacing: "0.04em" }}>{doc.side}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Review note + actions */}
                {p.reviewerNote && (
                  <div style={{ background: "rgba(246,70,93,0.08)", border: "1px solid rgba(246,70,93,0.2)",
                    borderRadius: 8, padding: "0.7rem 0.9rem", marginBottom: "1rem",
                    fontSize: "0.82rem", color: "#eaecef" }}>
                    <i className="bi bi-chat-left-text" style={{ marginRight: 6, color: "#f6465d" }} />
                    <strong>Previous note:</strong> {p.reviewerNote}
                  </div>
                )}

                {reviewErr[p._id || p.id] && (
                  <div style={{ background: "rgba(246,70,93,0.1)", border: "1px solid rgba(246,70,93,0.3)",
                    borderRadius: 8, padding: "0.55rem 0.8rem", marginBottom: "0.85rem",
                    color: "#f6465d", fontSize: "0.82rem" }}>
                    <i className="bi bi-exclamation-triangle" style={{ marginRight: 5 }} />
                    {reviewErr[p._id || p.id]}
                  </div>
                )}

                {p.status === "pending" && (
                  <div style={{ display: "flex", gap: "0.65rem", alignItems: "center", flexWrap: "wrap" }}>
                    <textarea
                      rows={2}
                      style={{
                        flex: 1, minWidth: 200, background: "#131722", border: "1px solid #2b2f36",
                        borderRadius: 8, padding: "0.5rem 0.75rem", color: "#eaecef",
                        fontSize: "0.82rem", fontFamily: "inherit", outline: "none", resize: "vertical",
                      }}
                      placeholder="Reviewer note (optional — shown to user if rejected)…"
                      value={note[p._id || p.id] || ""}
                      onChange={(e) => setNote((prev) => ({ ...prev, [p._id || p.id]: e.target.value }))}
                    />
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      <button
                        className="adm-btn adm-btn--green"
                        disabled={saving === (p._id || p.id) + "approved"}
                        onClick={() => review(p._id || p.id, "approved")}
                      >
                        <i className="bi bi-check-circle-fill" />
                        {saving === (p._id || p.id) + "approved" ? "Approving…" : "Approve"}
                      </button>
                      <button
                        className="adm-btn adm-btn--red"
                        disabled={saving === (p._id || p.id) + "rejected"}
                        onClick={() => review(p._id || p.id, "rejected")}
                      >
                        <i className="bi bi-x-circle-fill" />
                        {saving === (p._id || p.id) + "rejected" ? "Rejecting…" : "Reject"}
                      </button>
                    </div>
                  </div>
                )}

                {p.status !== "pending" && (
                  <div style={{ fontSize: "0.82rem", color: "#848e9c" }}>
                    Reviewed on {fmtDate(p.reviewedAt)} ·{" "}
                    <span style={{ color }}>
                      {p.status === "approved" ? "Identity verified ✓" : "Submission rejected ✗"}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
};

// ── Support panel ─────────────────────────────────────────────────────────────

const SupportPanel = () => {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("open");
  const [saving, setSaving] = useState(null);

  const { data, isLoading } = useQuery({ queryKey: ["adm-tickets"], queryFn: api.tickets, staleTime: 60_000 });
  const tickets = data?.tickets || [];

  const filtered = filter === "all" ? tickets : tickets.filter((t) => t.status === filter);

  const counts = {
    open:     tickets.filter((t) => t.status === "open").length,
    resolved: tickets.filter((t) => t.status === "resolved").length,
    closed:   tickets.filter((t) => t.status === "closed").length,
  };

  const setStatus = async (id, status) => {
    setSaving(id);
    try {
      await api.updateTicket(id, { status });
      qc.invalidateQueries({ queryKey: ["adm-tickets"] });
    } finally {
      setSaving(null);
    }
  };

  return (
    <>
      <div className="adm-toolbar">
        {["open", "resolved", "closed", "all"].map((s) => (
          <button
            key={s}
            className={`adm-btn ${filter === s ? "adm-btn--gold" : "adm-btn--gray"}`}
            onClick={() => setFilter(s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
            {s === "open" && counts.open > 0 && (
              <span className="adm-badge-count" style={{ marginLeft: 4 }}>{counts.open}</span>
            )}
          </button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "#848e9c" }}>
          {filtered.length} ticket{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {isLoading ? (
        <div className="adm-loading"><div className="adm-spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="adm-empty"><i className="bi bi-headset" /><p>No {filter} support tickets.</p></div>
      ) : (
        filtered.map((t) => (
          <div key={t._id} className="adm-card">
            <div className="adm-card-head">
              <div>
                <div className="adm-card-title">
                  <i className="bi bi-chat-dots-fill" style={{ color: "#f0b90b" }} />
                  {t.subject}
                  <span className={`adm-pill ${pill(t.status)}`}>{t.status}</span>
                  {t.priority && <span className={`adm-pill ${pill(t.priority)}`}>{t.priority}</span>}
                </div>
                <p className="adm-card-meta">
                  {t.user?.email || t.user || "Anonymous"} · {fmtDate(t.createdAt)}
                </p>
              </div>
            </div>
            <p className="adm-card-body">{t.message}</p>
            {t.replies?.length > 0 && (
              <div style={{ borderTop: "1px solid #2b2f36", paddingTop: "0.6rem", marginBottom: "0.6rem" }}>
                <p style={{ fontSize: "0.72rem", color: "#474d57", margin: "0 0 0.4rem", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                  {t.replies.length} {t.replies.length === 1 ? "reply" : "replies"}
                </p>
                {t.replies.slice(-2).map((r, i) => (
                  <div key={i} style={{ fontSize: "0.8rem", color: "#c8d3e8", marginBottom: "0.3rem" }}>
                    <span style={{ color: "#848e9c", fontSize: "0.72rem" }}>{fmtDate(r.createdAt)} · </span>
                    {r.message}
                  </div>
                ))}
              </div>
            )}
            <div className="adm-action-row">
              {t.status === "open" && (
                <>
                  <button className="adm-btn adm-btn--green" disabled={saving === t._id} onClick={() => setStatus(t._id, "resolved")}>
                    <i className="bi bi-check-circle" /> Resolve
                  </button>
                  <button className="adm-btn adm-btn--gray" disabled={saving === t._id} onClick={() => setStatus(t._id, "closed")}>
                    <i className="bi bi-x-circle" /> Close
                  </button>
                </>
              )}
              {t.status === "resolved" && (
                <button className="adm-btn adm-btn--gray" disabled={saving === t._id} onClick={() => setStatus(t._id, "closed")}>
                  <i className="bi bi-archive" /> Archive
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </>
  );
};

// ── Risk panel ────────────────────────────────────────────────────────────────

const RiskPanel = () => {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(null);

  const { data: sData } = useQuery({ queryKey: ["adm-risk"],       queryFn: api.riskStats,  staleTime: 60_000 });
  const { data: uData } = useQuery({ queryKey: ["adm-risk-users"], queryFn: api.riskUsers,  staleTime: 60_000 });
  const { data: eData } = useQuery({ queryKey: ["adm-events"],     queryFn: api.riskEvents, staleTime: 60_000 });

  const stats    = sData || {};
  const riskUsers = uData?.users || [];
  const events   = eData?.events || [];

  const freeze = async (id, action) => {
    setSaving(id);
    try {
      if (action === "freeze")   await api.freezeUser(id);
      if (action === "unfreeze") await api.unfreezeUser(id);
      qc.invalidateQueries({ queryKey: ["adm-risk-users"] });
      qc.invalidateQueries({ queryKey: ["adm-risk"] });
    } finally {
      setSaving(null);
    }
  };

  return (
    <>
      <div className="adm-kpi-strip">
        {[
          { label: "Frozen Accounts",   v: stats.frozen     ?? 0, cls: "adm-kpi-value--red"   },
          { label: "High-Risk Users",   v: stats.highRisk   ?? 0, cls: "adm-kpi-value--red"   },
          { label: "Events (24h)",      v: stats.events24h  ?? 0, cls: "adm-kpi-value--gold"  },
          { label: "Suspicious Trades", v: stats.suspicious ?? 0, cls: ""                     },
        ].map((k) => (
          <div key={k.label} className="adm-kpi-card">
            <div className="adm-kpi-label">{k.label}</div>
            <div className={`adm-kpi-value ${k.cls}`}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Flagged users */}
      <div className="dash-section" style={{ marginBottom: "1rem" }}>
        <div className="dash-section-head">
          <span className="dash-section-title">
            <i className="bi bi-exclamation-triangle-fill" style={{ marginRight: 7, color: "#f6465d" }} />
            Flagged Accounts
          </span>
        </div>
        {riskUsers.length === 0 ? (
          <div className="adm-empty"><i className="bi bi-shield-check" /><p>No flagged accounts.</p></div>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr><th>Email</th><th>Risk Level</th><th>Status</th><th>Events</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {riskUsers.map((u) => (
                  <tr key={u.id || u._id}>
                    <td style={{ fontWeight: 600 }}>{u.email}</td>
                    <td><span className={`adm-pill ${pill(u.riskLevel || "medium")}`}>{u.riskLevel || "—"}</span></td>
                    <td><span className={`adm-pill ${u.frozen ? "adm-pill--red" : "adm-pill--green"}`}>{u.frozen ? "Frozen" : "Active"}</span></td>
                    <td className="adm-td-muted">{u.eventCount ?? 0}</td>
                    <td>
                      {u.frozen ? (
                        <button className="adm-btn adm-btn--green" disabled={saving === (u.id || u._id)} onClick={() => freeze(u.id || u._id, "unfreeze")}>
                          <i className="bi bi-unlock-fill" /> Unfreeze
                        </button>
                      ) : (
                        <button className="adm-btn adm-btn--red" disabled={saving === (u.id || u._id)} onClick={() => freeze(u.id || u._id, "freeze")}>
                          <i className="bi bi-lock-fill" /> Freeze
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

      {/* Risk events */}
      {events.length > 0 && (
        <div className="dash-section">
          <div className="dash-section-head">
            <span className="dash-section-title">
              <i className="bi bi-journal-text" style={{ marginRight: 7, color: "#f0b90b" }} />
              Risk Event Log
            </span>
          </div>
          {events.slice(0, 20).map((e, i) => (
            <div key={i} className="adm-event">
              <span className="adm-event-tag">
                <span className={`adm-pill ${pill(e.severity || e.level || "medium")}`}>{e.type || e.event}</span>
              </span>
              <span className="adm-event-text">{e.description || e.userId}</span>
              <span className="adm-event-time">{fmtDate(e.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

// ── Coins panel ───────────────────────────────────────────────────────────────

// Convert any stored absolute localhost URL to a relative path so Vite proxy
// serves it correctly regardless of which port the backend is running on.
const resolveLogoUrl = (url) => {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      return parsed.pathname + parsed.search;
    }
  } catch {
    // already a relative URL — fine as-is
  }
  return url;
};

const EMPTY_FORM = {
  symbol: "", name: "", network: "Ethereum", decimals: 8,
  priceUsd: 0, description: "", logoUrl: "", website: "", cgId: "",
};

const CoinsPanel = () => {
  const qc = useQueryClient();
  const [cgQuery,   setCgQuery]   = useState("");
  const [cgResults, setCgResults] = useState([]);
  const [cgLoading, setCgLoading] = useState(false);
  const [cgError,   setCgError]   = useState("");
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [formOpen,  setFormOpen]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const [editId,    setEditId]    = useState(null);
  const [deleting,  setDeleting]  = useState(null);
  const [tab,       setTab]       = useState("catalog");  // "catalog" | "add"

  const { data, isLoading } = useQuery({
    queryKey: ["adm-coins"],
    queryFn:  api.listCoins,
    staleTime: 30_000,
  });
  const coins = data?.coins || [];

  // ── CoinGecko search ────────────────────────────────────────────────────────

  const searchCG = async () => {
    if (!cgQuery.trim()) return;
    setCgLoading(true); setCgError(""); setCgResults([]);
    try {
      const res = await api.cgSearch(cgQuery);
      setCgResults(res.coins || []);
      if (!(res.coins?.length)) setCgError("No coins found for that search.");
    } catch {
      setCgError("CoinGecko search failed. Check your server connection.");
    } finally {
      setCgLoading(false);
    }
  };

  const prefillFromCG = async (cgId) => {
    setCgLoading(true); setCgError("");
    try {
      const d = await api.cgDetails(cgId);
      setForm({
        symbol:      d.symbol     || "",
        name:        d.name       || "",
        network:     d.network    || "Ethereum",
        decimals:    8,
        priceUsd:    d.priceUsd   || 0,
        change24h:   d.change24h  || 0,
        volume24h:   d.volume24h  || 0,
        marketCap:   d.marketCap  || 0,
        totalSupply: d.totalSupply|| 0,
        description: d.description|| "",
        logoUrl:     resolveLogoUrl(d.logoUrl || ""),
        website:     d.website    || "",
        cgId:        d.cgId       || cgId,
      });
      setEditId(null);
      setTab("add");
      setFormOpen(true);
      setCgResults([]);
      setCgQuery("");
    } catch {
      setCgError("Could not fetch coin details from CoinGecko.");
    } finally {
      setCgLoading(false);
    }
  };

  // ── Save form ────────────────────────────────────────────────────────────────

  const saveForm = async () => {
    if (!form.symbol || !form.name) return;
    setSaving(true);
    try {
      if (editId) {
        await api.updateCoin(editId, form);
      } else {
        await api.createCoin({ ...form, symbol: form.symbol.toUpperCase() });
      }
      qc.invalidateQueries({ queryKey: ["adm-coins"] });
      setForm(EMPTY_FORM); setEditId(null); setFormOpen(false); setTab("catalog");
    } catch (e) {
      alert(e?.response?.data?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (c) => {
    setForm({
      symbol:      c.symbol      || "",
      name:        c.name        || "",
      network:     c.network     || "Ethereum",
      decimals:    c.decimals    ?? 8,
      priceUsd:    c.priceUsd    ?? 0,
      change24h:   c.change24h   ?? 0,
      volume24h:   c.volume24h   ?? 0,
      marketCap:   c.marketCap   ?? 0,
      totalSupply: c.totalSupply ?? 0,
      description: c.description || "",
      logoUrl:     resolveLogoUrl(c.logoUrl || ""),
      website:     c.website     || "",
      cgId:        c.cgId        || "",
    });
    setEditId(c.id);
    setTab("add");
    setFormOpen(true);
  };

  // Auto-resize any image to 256×256 PNG before upload so there's no size limit
  const compressImage = (file) =>
    new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const SIZE = 256;
        const canvas = document.createElement("canvas");
        canvas.width = SIZE; canvas.height = SIZE;
        const ctx = canvas.getContext("2d");
        // fill transparent background white for JPEG safety
        ctx.fillStyle = "#ffffff00";
        ctx.fillRect(0, 0, SIZE, SIZE);
        // center-crop to square
        const min = Math.min(img.width, img.height);
        const sx = (img.width  - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, SIZE, SIZE);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => {
          resolve(new File([blob], "logo.png", { type: "image/png" }));
        }, "image/png", 0.92);
      };
      img.src = url;
    });

  const handleLogoFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadErr("Please pick an image file (PNG, JPG, SVG, WebP…)");
      return;
    }
    setUploadErr(""); setUploading(true);
    try {
      const compressed = await compressImage(file);
      const res = await api.uploadLogo(compressed);
      const fullUrl = res.logoUrl;
      setForm((f) => ({ ...f, logoUrl: fullUrl }));
    } catch (e) {
      setUploadErr(e?.response?.data?.message || "Upload failed — check server connection.");
    } finally {
      setUploading(false);
    }
  };

  const toggleActive = async (c) => {
    await api.updateCoin(c.id, { isActive: !c.isActive });
    qc.invalidateQueries({ queryKey: ["adm-coins"] });
  };

  const removeCoin = async (id) => {
    if (!window.confirm("Permanently delete this coin?")) return;
    setDeleting(id);
    try {
      await api.deleteCoin(id, true);
      qc.invalidateQueries({ queryKey: ["adm-coins"] });
    } finally {
      setDeleting(null);
    }
  };

  const field = (key, label, type = "text", extra = {}) => (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", flex: extra.flex || 1, minWidth: extra.minWidth || 140 }}>
      <label style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#474d57" }}>
        {label}
      </label>
      <input
        type={type}
        value={form[key] ?? ""}
        onChange={(e) => setForm((f) => ({ ...f, [key]: type === "number" ? Number(e.target.value) : e.target.value }))}
        style={{
          background: "#131722", border: "1px solid #2b2f36", borderRadius: 7,
          padding: "0.45rem 0.7rem", color: "#eaecef", fontSize: "0.84rem",
          fontFamily: "inherit", outline: "none", width: "100%",
        }}
        {...extra.inputProps}
      />
    </div>
  );

  return (
    <>
      {/* ── Tab bar ── */}
      <div style={{ display: "flex", gap: 0, marginBottom: "1.1rem", borderBottom: "1px solid #2b2f36" }}>
        {[
          { id: "catalog", label: `Coin Catalog (${coins.length})` },
          { id: "add",     label: editId ? "Edit Coin" : "Add New Coin" },
        ].map((t) => (
          <button key={t.id}
            onClick={() => { setTab(t.id); if (t.id === "catalog") { setEditId(null); setForm(EMPTY_FORM); } }}
            style={{
              background: "none", border: "none", borderBottom: tab === t.id ? "2px solid #f0b90b" : "2px solid transparent",
              color: tab === t.id ? "#f0b90b" : "#848e9c", padding: "0.6rem 1.1rem",
              fontWeight: tab === t.id ? 800 : 500, fontSize: "0.84rem", cursor: "pointer",
              fontFamily: "inherit", transition: "color .15s", whiteSpace: "nowrap",
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* ══ CATALOG TAB ══ */}
      {tab === "catalog" && (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.85rem" }}>
            <button className="adm-btn adm-btn--gold" onClick={() => { setTab("add"); setEditId(null); setForm(EMPTY_FORM); }}>
              <i className="bi bi-plus-circle-fill" /> Add New Coin
            </button>
          </div>

          {isLoading ? (
            <div className="adm-loading"><div className="adm-spinner" /></div>
          ) : coins.length === 0 ? (
            <div className="adm-empty">
              <i className="bi bi-coin" />
              <p>No custom coins added yet. Search CoinGecko or fill in the form manually.</p>
            </div>
          ) : (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Logo</th>
                    <th>Symbol</th>
                    <th>Name</th>
                    <th>Network</th>
                    <th>Price (USD)</th>
                    <th>Status</th>
                    <th>Source</th>
                    <th>Added</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {coins.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <CoinLogo symbol={c.symbol} size={28} fontSize="0.65rem" />
                      </td>
                      <td style={{ fontWeight: 800, color: "#f0b90b" }}>{c.symbol}</td>
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td className="adm-td-muted">{c.network || "—"}</td>
                      <td className="adm-td-muted">${Number(c.priceUsd || 0).toLocaleString("en-US", { maximumFractionDigits: 8 })}</td>
                      <td>
                        <span className={`adm-pill ${c.isActive ? "adm-pill--green" : "adm-pill--gray"}`}>
                          {c.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="adm-td-muted">
                        {c.cgId
                          ? <a href={`https://www.coingecko.com/en/coins/${c.cgId}`} target="_blank" rel="noreferrer" style={{ color: "#3b82f6", fontSize: "0.75rem" }}>
                              <i className="bi bi-box-arrow-up-right" /> CoinGecko
                            </a>
                          : <span style={{ color: "#474d57" }}>Manual</span>
                        }
                      </td>
                      <td className="adm-td-muted">{fmtDate(c.createdAt)}</td>
                      <td>
                        <div className="adm-action-row">
                          <button className="adm-btn adm-btn--gold" onClick={() => startEdit(c)}>
                            <i className="bi bi-pencil-fill" /> Edit
                          </button>
                          <button className="adm-btn adm-btn--gray" onClick={() => toggleActive(c)}>
                            {c.isActive ? <><i className="bi bi-pause-fill" /> Deactivate</> : <><i className="bi bi-play-fill" /> Activate</>}
                          </button>
                          <button className="adm-btn adm-btn--red" disabled={deleting === c.id} onClick={() => removeCoin(c.id)}>
                            <i className="bi bi-trash3-fill" /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ══ ADD / EDIT TAB ══ */}
      {tab === "add" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {/* CoinGecko search */}
          {!editId && (
            <div className="adm-card" style={{ borderColor: "rgba(59,130,246,0.3)", background: "rgba(59,130,246,0.04)" }}>
              <div className="adm-card-title" style={{ marginBottom: "0.75rem" }}>
                <img src="https://static.coingecko.com/s/coingecko-logo-d13d6bcceddbb003f146b33c2f7e8193d72b93bb2f238e4b8df25393a20c688.png"
                  alt="CoinGecko" style={{ height: 18, objectFit: "contain" }} />
                &nbsp; Search CoinGecko
                <span style={{ marginLeft: 8, fontSize: "0.67rem", background: "rgba(14,203,129,0.1)", color: "#0ecb81", border: "1px solid rgba(14,203,129,0.25)", borderRadius: 4, padding: "1px 7px", fontWeight: 800, letterSpacing: "0.04em" }}>
                  VERIFIED
                </span>
              </div>
              <p style={{ fontSize: "0.78rem", color: "#848e9c", margin: "0 0 0.75rem" }}>
                Search CoinGecko's verified coin database. Click a result to auto-fill the form below with live data.
              </p>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  className="adm-search" style={{ flex: 1, backgroundImage: "none", paddingLeft: "0.8rem" }}
                  placeholder="e.g.  Chainlink,  PEPE,  Sui…"
                  value={cgQuery}
                  onChange={(e) => setCgQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchCG()}
                />
                <button className="adm-btn adm-btn--blue" onClick={searchCG} disabled={cgLoading}
                  style={{ background: "rgba(59,130,246,0.12)", color: "#60a5fa", borderColor: "rgba(59,130,246,0.3)", padding: "0.45rem 1rem", borderRadius: 8 }}>
                  {cgLoading ? <><i className="bi bi-hourglass-split" /> Searching…</> : <><i className="bi bi-search" /> Search</>}
                </button>
              </div>
              {cgError && <p style={{ color: "#f6465d", fontSize: "0.78rem", marginTop: "0.5rem" }}>{cgError}</p>}
              {cgResults.length > 0 && (
                <div style={{ marginTop: "0.75rem", border: "1px solid #2b2f36", borderRadius: 8, overflow: "hidden" }}>
                  {cgResults.map((c) => (
                    <div key={c.cgId}
                      onClick={() => prefillFromCG(c.cgId)}
                      style={{
                        display: "flex", alignItems: "center", gap: "0.65rem",
                        padding: "0.6rem 0.85rem", borderBottom: "1px solid rgba(43,47,54,0.6)",
                        cursor: "pointer", transition: "background 0.12s",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = ""}
                    >
                      {c.thumb && <img src={c.thumb} alt={c.symbol} style={{ width: 26, height: 26, borderRadius: "50%" }} />}
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 700, color: "#eaecef", fontSize: "0.88rem" }}>{c.name}</span>
                        <span style={{ marginLeft: 8, fontSize: "0.73rem", color: "#848e9c" }}>{c.symbol}</span>
                      </div>
                      {c.rank && <span style={{ fontSize: "0.7rem", color: "#474d57" }}>#{c.rank}</span>}
                      <span className="adm-pill adm-pill--blue" style={{ fontSize: "0.65rem" }}>
                        <i className="bi bi-arrow-right" /> Auto-fill
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Manual / pre-filled form */}
          <div className="adm-card">
            <div className="adm-card-title" style={{ marginBottom: "1rem" }}>
              <i className="bi bi-coin" style={{ color: "#f0b90b" }} />
              {editId ? "Edit Coin" : "Coin Details"}
              {form.logoUrl && (
                <img src={form.logoUrl} alt="" style={{ width: 28, height: 28, borderRadius: "50%", marginLeft: 8, objectFit: "cover" }} />
              )}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "0.75rem" }}>
              {field("symbol",  "Symbol *",     "text",   { inputProps: { placeholder: "BTC", style: { textTransform: "uppercase" } } })}
              {field("name",    "Name *",        "text",   { inputProps: { placeholder: "Bitcoin" }, flex: 2 })}
              {field("network", "Network",       "text",   { inputProps: { placeholder: "Ethereum" } })}
              {field("decimals","Decimals",      "number")}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "0.75rem" }}>
              {field("priceUsd",    "Price (USD)",    "number")}
              {field("marketCap",   "Market Cap",     "number")}
              {field("volume24h",   "Volume 24h",     "number")}
              {field("totalSupply", "Total Supply",   "number")}
            </div>

            {/* ── Logo upload ── */}
            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#474d57", display: "block", marginBottom: "0.75rem" }}>
                Coin Logo
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "1.25rem", alignItems: "flex-start" }}>

                {/* ── Drop zone ── */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.6rem" }}>
                  <label
                    htmlFor="coin-logo-input"
                    className="coin-logo-dropzone"
                    style={{
                      "--dz-border": uploadErr ? "#f6465d" : form.logoUrl ? "#f0b90b" : "#2b2f36",
                      "--dz-glow":   uploadErr ? "rgba(246,70,93,0.18)" : form.logoUrl ? "rgba(240,185,11,0.12)" : "transparent",
                      cursor: uploading ? "wait" : "pointer",
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.currentTarget.style.setProperty("--dz-border", "#f0b90b");
                      e.currentTarget.style.setProperty("--dz-glow", "rgba(240,185,11,0.18)");
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.style.setProperty("--dz-border", form.logoUrl ? "#f0b90b" : "#2b2f36");
                      e.currentTarget.style.setProperty("--dz-glow", form.logoUrl ? "rgba(240,185,11,0.12)" : "transparent");
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleLogoFile(e.dataTransfer.files?.[0]);
                    }}
                  >
                    {/* Spinner overlay */}
                    {uploading && (
                      <div className="coin-logo-overlay">
                        <div className="coin-logo-ring" />
                        <span className="coin-logo-uploading-text">Processing…</span>
                      </div>
                    )}

                    {form.logoUrl && !uploading ? (
                      <>
                        <img src={form.logoUrl} alt="coin logo" className="coin-logo-preview-img" />
                        <div className="coin-logo-preview-hover">
                          <i className="bi bi-arrow-repeat" style={{ fontSize: "1.3rem" }} />
                          <span style={{ fontSize: "0.72rem", fontWeight: 700 }}>Change</span>
                        </div>
                      </>
                    ) : !uploading ? (
                      <div className="coin-logo-idle">
                        <div className="coin-logo-icon-wrap">
                          <i className="bi bi-image-fill" />
                        </div>
                        <span className="coin-logo-label1">Click or drag &amp; drop</span>
                        <span className="coin-logo-label2">Any image — auto-resized</span>
                      </div>
                    ) : null}
                  </label>
                  <input
                    id="coin-logo-input"
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => { handleLogoFile(e.target.files?.[0]); e.target.value = ""; }}
                  />

                  {form.logoUrl && !uploading && (
                    <button
                      className="adm-btn adm-btn--red"
                      style={{ fontSize: "0.7rem", padding: "3px 12px", borderRadius: 6 }}
                      onClick={() => setForm((f) => ({ ...f, logoUrl: "" }))}
                    >
                      <i className="bi bi-trash3" /> Remove logo
                    </button>
                  )}
                  {uploadErr && (
                    <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#f6465d", fontSize: "0.73rem", maxWidth: 160, textAlign: "center", lineHeight: 1.4 }}>
                      <i className="bi bi-exclamation-triangle-fill" style={{ flexShrink: 0 }} />
                      {uploadErr}
                    </div>
                  )}
                </div>

                {/* ── Right side fields ── */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.75rem", minWidth: 220 }}>
                  {/* Preview badge */}
                  {form.logoUrl && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: "0.65rem",
                      background: "rgba(14,203,129,0.06)", border: "1px solid rgba(14,203,129,0.2)",
                      borderRadius: 10, padding: "0.55rem 0.85rem",
                    }}>
                      <img src={form.logoUrl} alt="" style={{ width: 36, height: 36, borderRadius: "50%", border: "2px solid rgba(240,185,11,0.35)", objectFit: "cover" }} />
                      <div>
                        <p style={{ margin: 0, fontSize: "0.75rem", fontWeight: 700, color: "#0ecb81" }}>
                          <i className="bi bi-check-circle-fill" style={{ marginRight: 5 }} />Logo uploaded
                        </p>
                        <p style={{ margin: 0, fontSize: "0.68rem", color: "#848e9c", marginTop: 2 }}>Auto-resized to 256×256 PNG</p>
                      </div>
                    </div>
                  )}
                  {field("logoUrl", "Or paste image URL", "text", { flex: 1, inputProps: { placeholder: "https://assets.coingecko.com/…" } })}
                  {field("website", "Website",            "text", { flex: 1, inputProps: { placeholder: "https://bitcoin.org" } })}
                  {field("cgId",    "CoinGecko ID",       "text", { flex: 1, inputProps: { placeholder: "bitcoin" } })}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#474d57", display: "block", marginBottom: "0.3rem" }}>
                Description
              </label>
              <textarea
                rows={3}
                value={form.description || ""}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                style={{
                  width: "100%", background: "#131722", border: "1px solid #2b2f36", borderRadius: 7,
                  padding: "0.45rem 0.7rem", color: "#eaecef", fontSize: "0.84rem",
                  fontFamily: "inherit", outline: "none", resize: "vertical",
                }}
                placeholder="Short description of the coin…"
              />
            </div>

            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
              <button
                className="adm-btn adm-btn--gold"
                style={{ padding: "0.5rem 1.4rem", fontSize: "0.84rem", borderRadius: 8 }}
                disabled={saving || !form.symbol || !form.name}
                onClick={saveForm}
              >
                {saving
                  ? <><i className="bi bi-hourglass-split" /> Saving…</>
                  : editId
                    ? <><i className="bi bi-check2-circle" /> Save Changes</>
                    : <><i className="bi bi-plus-circle-fill" /> Add to Platform</>
                }
              </button>
              <button className="adm-btn adm-btn--gray" onClick={() => { setForm(EMPTY_FORM); setEditId(null); setTab("catalog"); }}>
                Cancel
              </button>
              {form.cgId && (
                <a
                  href={`https://www.coingecko.com/en/coins/${form.cgId}`}
                  target="_blank" rel="noreferrer"
                  style={{ fontSize: "0.75rem", color: "#3b82f6", marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}
                >
                  <i className="bi bi-box-arrow-up-right" /> View on CoinGecko
                </a>
              )}
            </div>
          </div>

          {/* Info note */}
          <div style={{ background: "rgba(240,185,11,0.05)", border: "1px solid rgba(240,185,11,0.15)", borderRadius: 10, padding: "0.85rem 1rem", fontSize: "0.78rem", color: "#848e9c" }}>
            <i className="bi bi-info-circle-fill" style={{ color: "#f0b90b", marginRight: 6 }} />
            Coins added here are stored in the database and immediately available across the platform: wallets, the trading page, markets, and analytics.
            Built-in coins (from <code style={{ background: "#2b2f36", padding: "1px 5px", borderRadius: 3, color: "#f0b90b" }}>supportedAssets.js</code>) are managed in the server config file.
          </div>
        </div>
      )}
    </>
  );
};

// ── Nav items ─────────────────────────────────────────────────────────────────

// ── SecurityPanel ─────────────────────────────────────────────────────────────

const SEC_SEVERITY_COLOR = { info:"#848e9c", warning:"#f59e0b", critical:"#f6465d" };
const SEC_SEVERITY_BG    = { info:"rgba(132,142,156,0.1)", warning:"rgba(245,158,11,0.1)", critical:"rgba(246,70,93,0.1)" };

const fmtDateSec = (d) => d ? new Date(d).toLocaleString([], { dateStyle:"medium", timeStyle:"short" }) : "—";
const fmtRelSec  = (d) => {
  if (!d) return "Never";
  const diff = Date.now() - new Date(d);
  if (diff < 60_000)    return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff/60_000)}m ago`;
  if (diff < 86_400_000)return `${Math.floor(diff/3_600_000)}h ago`;
  return `${Math.floor(diff/86_400_000)}d ago`;
};

const SecurityPanel = () => {
  const qc = useQueryClient();
  const [secTab,     setSecTab]     = useState("alerts");
  const [alertStatus,setAlertStatus]= useState("open");
  const [auditPage,  setAuditPage]  = useState(1);
  const [auditUid,   setAuditUid]   = useState("");
  const [uidInput,   setUidInput]   = useState("");

  const { data: stats }  = useQuery({ queryKey:["adm-audit-stats"], queryFn: api.auditStats, staleTime:60_000 });
  const { data: alerts, isLoading: alertsLoading } = useQuery({
    queryKey: ["adm-aml-alerts", alertStatus],
    queryFn:  () => api.amlAlerts(alertStatus),
    staleTime: 30_000,
  });
  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ["adm-audit-logs", auditPage, auditUid],
    queryFn:  () => api.auditLogs(auditPage, auditUid),
    staleTime: 30_000,
    enabled:   secTab === "audit",
  });

  const reviewAlert = useMutation({
    mutationFn: ({ id, body }) => api.reviewAlert(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey:["adm-aml-alerts"] }),
  });

  const freezeMut = useMutation({
    mutationFn: (id) => api.secFreeze(id),
    onSuccess: () => qc.invalidateQueries({ queryKey:["adm-aml-alerts"] }),
  });

  const unfreezeMut = useMutation({
    mutationFn: (id) => api.secUnfreeze(id),
    onSuccess: () => qc.invalidateQueries({ queryKey:["adm-aml-alerts"] }),
  });

  const ALERT_TYPE_LABELS = {
    large_transaction: "Large Txn",
    velocity_breach:   "Velocity",
    rapid_trading:     "Rapid Trading",
    structuring:       "Structuring",
    unusual_pattern:   "Unusual Pattern",
    sanctioned_address:"Sanctioned",
  };

  const SEC_TABS = [
    { id:"alerts", label:"AML Alerts",  icon:"bi-exclamation-triangle-fill" },
    { id:"audit",  label:"Audit Log",   icon:"bi-journal-text"              },
    { id:"stats",  label:"Stats",       icon:"bi-bar-chart-line-fill"       },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"1.25rem" }}>

      {/* Sub-tab bar */}
      <div style={{ display:"flex", gap:0, borderBottom:"1px solid #2b2f36", marginBottom:"0.25rem" }}>
        {SEC_TABS.map(t => (
          <button key={t.id}
            style={{
              display:"flex", alignItems:"center", gap:"0.4rem",
              background:"none", border:"none",
              borderBottom: secTab===t.id ? "2px solid #f0b90b" : "2px solid transparent",
              padding:"0.6rem 1.1rem", color: secTab===t.id ? "#f0b90b" : "#848e9c",
              fontWeight: secTab===t.id ? 700 : 500, fontSize:"0.82rem",
              cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap",
              transition:"color .15s",
            }}
            onClick={() => { setSecTab(t.id); if (t.id !== "audit") setAuditPage(1); }}>
            <i className={`bi ${t.icon}`} /> {t.label}
          </button>
        ))}
      </div>

      {/* ── AML ALERTS ── */}
      {secTab === "alerts" && (
        <>
          <div style={{ display:"flex", gap:"0.5rem", flexWrap:"wrap", alignItems:"center" }}>
            {["open","reviewing","resolved","escalated"].map(s => (
              <button key={s}
                className={`adm-btn${alertStatus===s ? " adm-btn--primary" : ""}`}
                style={{ padding:"0.3rem 0.8rem", fontSize:"0.76rem", textTransform:"capitalize" }}
                onClick={() => setAlertStatus(s)}>
                {s}
              </button>
            ))}
          </div>

          {reviewAlert.error && (
            <div style={{ background:"rgba(246,70,93,0.08)", border:"1px solid rgba(246,70,93,0.25)", borderRadius:8,
              padding:"0.55rem 0.8rem", fontSize:"0.78rem", color:"#f6465d", display:"flex", gap:"0.4rem", alignItems:"center" }}>
              <i className="bi bi-exclamation-triangle-fill" />
              {reviewAlert.error?.response?.data?.message || "Failed to update alert. Please try again."}
            </div>
          )}
          {(unfreezeMut.error || freezeMut.error) && (
            <div style={{ background:"rgba(246,70,93,0.08)", border:"1px solid rgba(246,70,93,0.25)", borderRadius:8,
              padding:"0.55rem 0.8rem", fontSize:"0.78rem", color:"#f6465d", display:"flex", gap:"0.4rem", alignItems:"center" }}>
              <i className="bi bi-exclamation-triangle-fill" />
              {(unfreezeMut.error || freezeMut.error)?.response?.data?.message || "Failed to update account status."}
            </div>
          )}

          {alertsLoading ? (
            <div className="adm-empty">Loading alerts…</div>
          ) : (alerts?.alerts || []).length === 0 ? (
            <div className="adm-empty"><i className="bi bi-check-circle" style={{ color:"#0ecb81" }} /><p>No {alertStatus} alerts.</p></div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:"0.6rem" }}>
              {(alerts.alerts).map(a => (
                <div key={String(a._id)} className="adm-card" style={{
                  borderLeft: `3px solid ${a.riskScore >= 80 ? "#f6465d" : a.riskScore >= 50 ? "#f59e0b" : "#848e9c"}`,
                  padding:"0.9rem 1rem",
                }}>
                  <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:"0.75rem", flexWrap:"wrap" }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", marginBottom:"0.3rem", flexWrap:"wrap" }}>
                        <span style={{
                          background: a.riskScore >= 80 ? "rgba(246,70,93,0.12)" : "rgba(245,158,11,0.1)",
                          color:      a.riskScore >= 80 ? "#f6465d" : "#f59e0b",
                          border:`1px solid ${a.riskScore >= 80 ? "rgba(246,70,93,0.3)" : "rgba(245,158,11,0.25)"}`,
                          padding:"1px 7px", borderRadius:4, fontSize:"0.7rem", fontWeight:800,
                        }}>
                          {ALERT_TYPE_LABELS[a.alertType] || a.alertType}
                        </span>
                        <span style={{ fontSize:"0.7rem", color:"#848e9c", fontFamily:"monospace" }}>
                          Risk score: <strong style={{ color: a.riskScore >= 80 ? "#f6465d" : a.riskScore >= 50 ? "#f59e0b" : "#0ecb81" }}>{a.riskScore}</strong>
                        </span>
                        <span style={{
                          padding:"1px 7px", borderRadius:4, fontSize:"0.68rem", fontWeight:700,
                          background:"rgba(255,255,255,0.05)", color:"#848e9c",
                          border:"1px solid #2b2f36", textTransform:"capitalize",
                        }}>{a.status}</span>
                      </div>
                      <div style={{ fontSize:"0.8rem", color:"#c8d3e8", marginBottom:"0.2rem" }}>{a.description}</div>
                      <div style={{ fontSize:"0.71rem", color:"#474d57" }}>
                        User: <span style={{ color:"#848e9c", fontFamily:"monospace" }}>{a.userId || "—"}</span>
                        {a.amount ? <> · Amount: <strong style={{ color:"#eaecef" }}>${Number(a.amount).toLocaleString()}</strong></> : null}
                        {a.currency ? <> {a.currency}</> : null}
                        {" · "}{fmtDateSec(a.createdAt)}
                      </div>
                      {a.autoFrozen && (
                        <div style={{ marginTop:"0.3rem", fontSize:"0.7rem", color:"#f6465d", display:"flex", alignItems:"center", gap:"0.3rem" }}>
                          <i className="bi bi-lock-fill" /> Account auto-frozen by AML
                        </div>
                      )}
                    </div>
                    <div style={{ display:"flex", gap:"0.4rem", flexShrink:0, flexWrap:"wrap" }}>
                      {a.status === "open" && (
                        <>
                          <button className="adm-btn adm-btn--blue" style={{ fontSize:"0.73rem", padding:"0.3rem 0.65rem" }}
                            disabled={reviewAlert.isPending}
                            onClick={() => reviewAlert.mutate({ id: String(a._id), body: { action:"reviewing", notes:"Under review" } })}>
                            <i className="bi bi-eye" /> Review
                          </button>
                          <button className="adm-btn" style={{ fontSize:"0.73rem", padding:"0.3rem 0.65rem", background:"rgba(14,203,129,0.1)", color:"#0ecb81", border:"1px solid rgba(14,203,129,0.25)" }}
                            disabled={reviewAlert.isPending}
                            onClick={() => reviewAlert.mutate({ id: String(a._id), body: { action:"resolved", notes:"Cleared by admin" } })}>
                            <i className="bi bi-check2-circle" /> Clear
                          </button>
                          <button className="adm-btn" style={{ fontSize:"0.73rem", padding:"0.3rem 0.65rem", background:"rgba(246,70,93,0.1)", color:"#f6465d", border:"1px solid rgba(246,70,93,0.25)" }}
                            disabled={reviewAlert.isPending}
                            onClick={() => reviewAlert.mutate({ id: String(a._id), body: { action:"escalated", notes:"Escalated for review" } })}>
                            <i className="bi bi-exclamation-octagon" /> Escalate
                          </button>
                        </>
                      )}
                      {a.autoFrozen && a.userId && (
                        <button className="adm-btn" style={{ fontSize:"0.73rem", padding:"0.3rem 0.65rem", background:"rgba(14,203,129,0.08)", color:"#0ecb81", border:"1px solid rgba(14,203,129,0.2)" }}
                          disabled={unfreezeMut.isPending}
                          onClick={() => { if(window.confirm("Unfreeze this account?")) unfreezeMut.mutate(String(a.userId)); }}>
                          <i className="bi bi-unlock-fill" /> Unfreeze
                        </button>
                      )}
                    </div>
                  </div>
                  {a.reviewedBy && (
                    <div style={{ marginTop:"0.5rem", paddingTop:"0.5rem", borderTop:"1px solid #2b2f36", fontSize:"0.7rem", color:"#474d57" }}>
                      Reviewed by {a.reviewedBy} at {fmtDateSec(a.reviewedAt)}
                      {a.notes ? ` — "${a.notes}"` : ""}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── AUDIT LOG ── */}
      {secTab === "audit" && (
        <>
          <div style={{ display:"flex", gap:"0.5rem", flexWrap:"wrap", alignItems:"center" }}>
            <input
              style={{ flex:1, minWidth:200, background:"#131722", border:"1px solid #2b2f36", borderRadius:7,
                       padding:"0.42rem 0.75rem", color:"#eaecef", fontFamily:"monospace", fontSize:"0.78rem", outline:"none" }}
              placeholder="Filter by User ID (leave blank for all)"
              value={uidInput}
              onChange={e => setUidInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && (setAuditUid(uidInput.trim()), setAuditPage(1))}
            />
            <button className="adm-btn adm-btn--primary" style={{ fontSize:"0.76rem" }}
              onClick={() => { setAuditUid(uidInput.trim()); setAuditPage(1); }}>
              <i className="bi bi-search" /> Filter
            </button>
            {auditUid && (
              <button className="adm-btn" style={{ fontSize:"0.76rem" }}
                onClick={() => { setAuditUid(""); setUidInput(""); setAuditPage(1); }}>
                <i className="bi bi-x" /> Clear
              </button>
            )}
          </div>

          <div style={{ background:"rgba(240,185,11,0.05)", border:"1px solid rgba(240,185,11,0.15)", borderRadius:8, padding:"0.55rem 0.9rem", fontSize:"0.75rem", color:"#848e9c", display:"flex", gap:"0.5rem", alignItems:"center" }}>
            <i className="bi bi-lock-fill" style={{ color:"#f0b90b" }} />
            SHA-256 chained records — any modification to an entry is mathematically detectable via chain verification.
          </div>

          {auditLoading ? (
            <div className="adm-empty">Loading…</div>
          ) : (
            <>
              <div style={{ overflowX:"auto", borderRadius:10, border:"1px solid #2b2f36" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.78rem" }}>
                  <thead>
                    <tr>
                      {["Severity","Action","Category","User","IP","Time"].map(h => (
                        <th key={h} style={{ textAlign:"left", padding:"0.5rem 0.75rem",
                          fontSize:"0.64rem", fontWeight:700, textTransform:"uppercase",
                          letterSpacing:"0.06em", color:"#474d57", borderBottom:"1px solid #2b2f36",
                          background:"#1e2026", whiteSpace:"nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(auditData?.logs || []).map((l, i) => {
                      const sevColor = SEC_SEVERITY_COLOR[l.severity] || "#848e9c";
                      const sevBg    = SEC_SEVERITY_BG[l.severity]    || "rgba(132,142,156,0.1)";
                      return (
                      <tr key={String(l._id || i)} style={{ borderBottom:"1px solid rgba(43,47,54,0.6)" }}>
                        <td style={{ padding:"0.55rem 0.75rem" }}>
                          <span style={{
                            padding:"1px 6px", borderRadius:4, fontSize:"0.62rem", fontWeight:800,
                            textTransform:"uppercase",
                            background: sevBg,
                            color:      sevColor,
                            border:`1px solid ${sevColor}30`,
                          }}>{l.severity}</span>
                        </td>
                        <td style={{ padding:"0.55rem 0.75rem", fontFamily:"monospace", fontSize:"0.75rem", color:"#c8d3e8" }}>{l.action}</td>
                        <td style={{ padding:"0.55rem 0.75rem" }}>
                          <span style={{ background:"rgba(255,255,255,0.05)", color:"#848e9c", border:"1px solid #2b2f36",
                            padding:"1px 6px", borderRadius:4, fontSize:"0.62rem", fontWeight:700 }}>{l.category}</span>
                        </td>
                        <td style={{ padding:"0.55rem 0.75rem", fontFamily:"monospace", fontSize:"0.68rem", color:"#474d57" }}>
                          {String(l.userId || "—").slice(-8)}
                        </td>
                        <td style={{ padding:"0.55rem 0.75rem", fontSize:"0.71rem", color:"#848e9c" }}>{l.ip || "—"}</td>
                        <td style={{ padding:"0.55rem 0.75rem", fontSize:"0.71rem", color:"#474d57", whiteSpace:"nowrap" }}>{fmtDateSec(l.createdAt)}</td>
                      </tr>
                    );})}

                    {!(auditData?.logs?.length) && (
                      <tr><td colSpan={6} style={{ textAlign:"center", padding:"2rem", color:"#474d57" }}>No audit entries found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {auditData?.pages > 1 && (
                <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"0.75rem", paddingTop:"0.5rem" }}>
                  <button className="adm-btn" disabled={auditPage<=1} onClick={()=>setAuditPage(p=>p-1)}>← Prev</button>
                  <span style={{ fontSize:"0.78rem", color:"#848e9c" }}>Page {auditPage} of {auditData.pages}</span>
                  <button className="adm-btn" disabled={auditPage>=auditData.pages} onClick={()=>setAuditPage(p=>p+1)}>Next →</button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── STATS ── */}
      {secTab === "stats" && (
        <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:"0.75rem" }}>
            {[
              { label:"Total Audit Events",  val: stats?.total?.toLocaleString() ?? "—",      color:"#60a5fa", icon:"bi-journal-text"                },
              { label:"Critical Events",     val: stats?.bySeverity?.critical ?? "—",          color:"#f6465d", icon:"bi-exclamation-octagon-fill"     },
              { label:"Warning Events",      val: stats?.bySeverity?.warning  ?? "—",          color:"#f59e0b", icon:"bi-exclamation-triangle-fill"    },
              { label:"Failed Logins",       val: stats?.byAction?.LOGIN_FAILED ?? "—",        color:"#f6465d", icon:"bi-door-closed-fill"             },
              { label:"Successful Logins",   val: stats?.byAction?.LOGIN_SUCCESS ?? "—",       color:"#0ecb81", icon:"bi-door-open-fill"               },
              { label:"Trades Logged",       val: stats?.byCategory?.trade ?? "—",             color:"#f0b90b", icon:"bi-graph-up"                     },
              { label:"Security Events",     val: stats?.byCategory?.security ?? "—",          color:"#a78bfa", icon:"bi-shield-fill"                  },
              { label:"Accounts Frozen",     val: stats?.byAction?.ACCOUNT_FREEZE ?? "—",      color:"#f6465d", icon:"bi-lock-fill"                    },
            ].map((s,i) => (
              <div key={i} className="adm-card" style={{ padding:"1rem", display:"flex", flexDirection:"column", gap:"0.4rem" }}>
                <div style={{ width:34, height:34, borderRadius:9, background:`${s.color}18`, border:`1px solid ${s.color}22`,
                  display:"flex", alignItems:"center", justifyContent:"center", color:s.color, fontSize:"0.95rem" }}>
                  <i className={`bi ${s.icon}`} />
                </div>
                <div style={{ fontSize:"1.5rem", fontWeight:900, color:"#eaecef", lineHeight:1 }}>{s.val}</div>
                <div style={{ fontSize:"0.66rem", color:"#848e9c", textTransform:"uppercase", fontWeight:700, letterSpacing:"0.05em" }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div className="adm-card" style={{ padding:"1rem" }}>
            <h4 style={{ margin:"0 0 0.75rem", fontSize:"0.82rem", color:"#eaecef", fontWeight:800 }}>
              <i className="bi bi-shield-check" style={{ color:"#f0b90b", marginRight:"0.4rem" }} />
              Chain Integrity
            </h4>
            <p style={{ fontSize:"0.77rem", color:"#848e9c", margin:"0 0 0.75rem" }}>
              Each audit entry is SHA-256 chained with the previous one.
              Run verification to confirm no records have been tampered with.
            </p>
            <p style={{ fontSize:"0.72rem", color:"#474d57", margin:0 }}>
              To verify a specific user's chain, use the API: <code style={{ background:"rgba(255,255,255,0.06)", padding:"1px 5px", borderRadius:4, color:"#f0b90b" }}>GET /api/audit/verify/:userId</code>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// ── NAV ───────────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: "overview", label: "Overview",  icon: "bi-grid-1x2-fill"         },
  { id: "users",    label: "Users",     icon: "bi-people-fill"           },
  { id: "kyc",      label: "KYC Queue", icon: "bi-person-vcard-fill"     },
  { id: "support",  label: "Support",   icon: "bi-headset"               },
  { id: "risk",     label: "Risk",      icon: "bi-shield-exclamation"    },
  { id: "coins",    label: "Coins",     icon: "bi-coin"                  },
  { id: "security", label: "Security",  icon: "bi-shield-fill-check"     },
];

// ── Main page ─────────────────────────────────────────────────────────────────

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const [active, setActive] = useState("overview");

  const { data: kData } = useQuery({ queryKey: ["adm-kyc"], queryFn: api.kyc, staleTime: 60_000 });
  const { data: tData } = useQuery({ queryKey: ["adm-tickets"], queryFn: api.tickets, staleTime: 60_000 });
  const pendingKyc   = (kData?.profiles || []).filter((p) => p.status === "pending").length;
  const openTickets  = (tData?.tickets  || []).filter((t) => t.status === "open").length;

  if (!isAuthenticated)           return <Navigate to="/login" replace />;
  if (user?.role !== "admin")     return <Navigate to="/Dashboard" replace />;

  const headings = {
    overview: { title: "Admin Overview",    sub: "Platform health at a glance" },
    users:    { title: "User Management",   sub: "Manage accounts, roles and status" },
    kyc:      { title: "KYC Review Queue",  sub: "Approve or reject identity verifications" },
    support:  { title: "Support Tickets",   sub: "Handle user support requests" },
    risk:     { title: "Risk Management",   sub: "Monitor and act on flagged accounts" },
    coins:    { title: "Coin Management",   sub: "Add verified coins from CoinGecko or manually" },
    security: { title: "Security Center",  sub: "AML alerts, immutable audit log, and account controls" },
  };

  return (
    <div className="dash-root">
      <DashNavbar onMenuClick={() => {}} />

      <div className="dash-body" style={{ overflow: "hidden" }}>
        {/* Admin sidebar */}
        <aside className="adm-sidebar">
          <p className="adm-sidebar-label">Admin Panel</p>
          {NAV_ITEMS.map((n) => (
            <button
              key={n.id}
              className={`adm-nav-btn${active === n.id ? " adm-nav-btn--active" : ""}`}
              onClick={() => setActive(n.id)}
            >
              <i className={`bi ${n.icon}`} />
              {n.label}
              {n.id === "kyc"     && pendingKyc  > 0 && <span className="adm-badge-count">{pendingKyc}</span>}
              {n.id === "support" && openTickets  > 0 && <span className="adm-badge-count">{openTickets}</span>}
            </button>
          ))}

          <div style={{ marginTop: "auto", paddingTop: "1.5rem" }}>
            <p className="adm-sidebar-label">Navigation</p>
            <button
              className="adm-nav-btn"
              onClick={() => navigate("/Dashboard")}
            >
              <i className="bi bi-arrow-left-circle" /> Dashboard
            </button>
            <button
              className="adm-nav-btn"
              onClick={() => { useAuthStore.getState().logout(); navigate("/login"); }}
            >
              <i className="bi bi-box-arrow-right" style={{ color: "#f6465d" }} />
              <span style={{ color: "#f6465d" }}>Logout</span>
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="adm-content">
          <div className="adm-head">
            <h1 className="adm-head-title">{headings[active].title}</h1>
            <p className="adm-head-sub">{headings[active].sub}</p>
          </div>

          {active === "overview" && <OverviewPanel />}
          {active === "users"    && <UsersPanel />}
          {active === "kyc"      && <KycPanel />}
          {active === "support"  && <SupportPanel />}
          {active === "risk"     && <RiskPanel />}
          {active === "coins"    && <CoinsPanel />}
          {active === "security" && <SecurityPanel />}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
