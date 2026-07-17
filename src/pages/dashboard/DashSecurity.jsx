import { useState, useRef, useEffect } from "react";
import { Navigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore }  from "../../store/authStore";
import DashNavbar        from "../../Components/layout/DashNavbar";
import DashSidebar       from "../../Components/dashboard/DashSidebar";
import { requestWithRetry } from "../../api/client";
import "../../styles/dashboard.css";
import "../../styles/security.css";

// ── API helpers ────────────────────────────────────────────────────────────────
const api = {
  summary:      ()         => requestWithRetry({ method: "get",    url: "/api/security/summary" }),
  auditLog:     (p = 1)   => requestWithRetry({ method: "get",    url: `/api/audit/me?page=${p}&limit=30` }),
  createKey:    (body)    => requestWithRetry({ method: "post",   url: "/api/security/api-keys", data: body }),
  revokeKey:    (id)      => requestWithRetry({ method: "delete", url: `/api/security/api-keys/${id}` }),
  revokeSession:(sid)     => requestWithRetry({ method: "delete", url: `/api/security/sessions/${sid}` }),
  revokeAll:    ()        => requestWithRetry({ method: "delete", url: "/api/security/sessions/all" }),
};

// ── Formatters ─────────────────────────────────────────────────────────────────
const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
};
const fmtRelative = (d) => {
  if (!d) return "Never";
  const diff = Date.now() - new Date(d);
  if (diff < 60_000)        return "Just now";
  if (diff < 3_600_000)     return `${Math.floor(diff/60_000)}m ago`;
  if (diff < 86_400_000)    return `${Math.floor(diff/3_600_000)}h ago`;
  return `${Math.floor(diff/86_400_000)}d ago`;
};

const SEVERITY_COLOR = { info: "#848e9c", warning: "#f59e0b", critical: "#f6465d" };
const SEVERITY_BG    = { info: "rgba(132,142,156,0.1)", warning: "rgba(245,158,11,0.1)", critical: "rgba(246,70,93,0.1)" };
const KYC_COLOR      = { unverified:"#848e9c", pending:"#f59e0b", approved:"#0ecb81", rejected:"#f6465d" };
const KYC_ICON       = { unverified:"bi-person-x", pending:"bi-hourglass-split", approved:"bi-patch-check-fill", rejected:"bi-x-octagon-fill" };

// ── Sub-components ─────────────────────────────────────────────────────────────

const SectionHeader = ({ icon, title, subtitle }) => (
  <div className="sec-section-head">
    <div className="sec-section-icon"><i className={`bi ${icon}`} /></div>
    <div>
      <h3 className="sec-section-title">{title}</h3>
      {subtitle && <p className="sec-section-sub">{subtitle}</p>}
    </div>
  </div>
);

const KycBanner = ({ status, onStartKyc }) => {
  const color = KYC_COLOR[status] || "#848e9c";
  const icon  = KYC_ICON[status]  || "bi-person-x";
  const label = { unverified:"Not Verified", pending:"Under Review", approved:"Verified", rejected:"Rejected" }[status] || status;
  const desc  = {
    unverified: "Complete KYC to unlock higher limits and all platform features.",
    pending:    "Your documents are being reviewed. This usually takes 1–2 business days.",
    approved:   "Your identity has been verified. You have full platform access.",
    rejected:   "Your KYC was rejected. Please re-submit with valid documents.",
  }[status] || "";
  return (
    <div className="sec-kyc-banner" style={{ borderColor: `${color}40`, background: `${color}0d` }}>
      <div className="sec-kyc-icon" style={{ background: `${color}18`, color }}>
        <i className={`bi ${icon}`} />
      </div>
      <div style={{ flex: 1 }}>
        <div className="sec-kyc-label" style={{ color }}>{label}</div>
        <div className="sec-kyc-desc">{desc}</div>
      </div>
      {(status === "unverified" || status === "rejected") ? (
        onStartKyc
          ? <button type="button" onClick={onStartKyc} className="sec-btn sec-btn--gold">
              <i className="bi bi-arrow-up-right-circle" /> {status === "rejected" ? "Re-submit" : "Start KYC"}
            </button>
          : <Link to="/Dashboard/kyc" className="sec-btn sec-btn--gold">
              <i className="bi bi-arrow-up-right-circle" /> {status === "rejected" ? "Re-submit" : "Start KYC"}
            </Link>
      ) : null}
    </div>
  );
};

const SessionCard = ({ session, onRevoke, current }) => (
  <div className={`sec-card${current ? " sec-card--current" : ""}`}>
    <div className="sec-card-left">
      <div className="sec-device-icon">
        <i className={`bi bi-${session.deviceType === "mobile" ? "phone" : session.deviceType === "tablet" ? "tablet" : "laptop"}`} />
      </div>
      <div>
        <div className="sec-card-name">
          {session.browser} on {session.os}
          {current && <span className="sec-pill sec-pill--green">Current</span>}
        </div>
        <div className="sec-card-meta">
          {session.ipAddress} · Last seen {fmtRelative(session.lastSeenAt)}
        </div>
        <div className="sec-card-meta" style={{ marginTop: 2 }}>
          Started {fmtDate(session.createdAt)}
        </div>
      </div>
    </div>
    {!current && (
      <button className="sec-btn sec-btn--red" onClick={() => onRevoke(session.sessionId)}>
        <i className="bi bi-x-circle" /> Revoke
      </button>
    )}
  </div>
);

const ApiKeyCard = ({ apiKey, onRevoke }) => (
  <div className="sec-card">
    <div className="sec-card-left">
      <div className="sec-key-icon"><i className="bi bi-key-fill" /></div>
      <div>
        <div className="sec-card-name">
          {apiKey.label}
          <span className="sec-key-prefix">{apiKey.prefix}…</span>
        </div>
        <div className="sec-card-meta">
          Scopes: {(apiKey.scopes || []).map(s => (
            <span key={s} className="sec-pill sec-pill--blue">{s}</span>
          ))}
        </div>
        <div className="sec-card-meta" style={{ marginTop: 4 }}>
          Created {fmtDate(apiKey.createdAt)} ·
          Last used {fmtRelative(apiKey.lastUsedAt)} ·
          {(apiKey.usageCount ?? 0).toLocaleString()} calls
        </div>
        {apiKey.expiresAt && (
          <div className="sec-card-meta" style={{ color: new Date(apiKey.expiresAt) < new Date() ? "#f6465d" : "#f59e0b" }}>
            Expires {fmtDate(apiKey.expiresAt)}
          </div>
        )}
        {apiKey.ipWhitelist?.length > 0 && (
          <div className="sec-card-meta">IP whitelist: {apiKey.ipWhitelist.join(", ")}</div>
        )}
      </div>
    </div>
    <button className="sec-btn sec-btn--red" onClick={() => onRevoke(String(apiKey._id || apiKey.id))}>
      <i className="bi bi-trash3" /> Revoke
    </button>
  </div>
);

const AuditRow = ({ log }) => (
  <tr className="sec-audit-row">
    <td>
      <span className="sec-pill" style={{
        background: SEVERITY_BG[log.severity],
        color: SEVERITY_COLOR[log.severity],
        border: `1px solid ${SEVERITY_COLOR[log.severity]}30`,
      }}>
        {log.severity}
      </span>
    </td>
    <td><span className="sec-audit-action">{log.action}</span></td>
    <td><span className="sec-pill sec-pill--gray">{log.category}</span></td>
    <td className="sec-audit-meta">{log.ip}</td>
    <td className="sec-audit-meta">{fmtDate(log.createdAt)}</td>
  </tr>
);

// ── Create API Key form ────────────────────────────────────────────────────────

const SCOPES = ["read", "trade", "withdraw"];

const CreateKeyForm = ({ onClose, onCreated }) => {
  const [label, setLabel] = useState("");
  const [scopes, setScopes] = useState(["read"]);
  const [ipWhitelist, setIpWhitelist] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("");
  const qc = useQueryClient();

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => api.createKey({
      label, scopes,
      ipWhitelist: ipWhitelist ? ipWhitelist.split(",").map(s => s.trim()).filter(Boolean) : [],
      expiresInDays: expiresInDays ? Number(expiresInDays) : null,
    }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["security-summary"] });
      onCreated(data.rawKey, data.apiKey);
    },
  });

  const toggleScope = (s) => setScopes(prev =>
    prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
  );

  return (
    <div className="sec-modal-backdrop" onClick={onClose}>
      <div className="sec-modal" onClick={e => e.stopPropagation()}>
        <div className="sec-modal-head">
          <h4><i className="bi bi-key-fill" style={{ color:"#f0b90b" }} /> New API Key</h4>
          <button className="sec-modal-close" onClick={onClose}><i className="bi bi-x-lg" /></button>
        </div>

        <div className="sec-form-group">
          <label className="sec-label">Label *</label>
          <input className="sec-input" value={label} onChange={e=>setLabel(e.target.value)} placeholder="e.g. My Trading Bot" />
        </div>

        <div className="sec-form-group">
          <label className="sec-label">Permissions</label>
          <div className="sec-scope-row">
            {SCOPES.map(s => (
              <label key={s} className={`sec-scope-chip${scopes.includes(s) ? " sec-scope-chip--on" : ""}`}>
                <input type="checkbox" hidden checked={scopes.includes(s)} onChange={()=>toggleScope(s)} />
                <i className={`bi bi-${s==="read"?"eye":s==="trade"?"graph-up":"send"}`} /> {s}
              </label>
            ))}
          </div>
          <p className="sec-hint">
            <i className="bi bi-info-circle" />
            <strong>read</strong> — view balances/trades &nbsp;|&nbsp;
            <strong>trade</strong> — place/cancel orders &nbsp;|&nbsp;
            <strong>withdraw</strong> — initiate withdrawals
          </p>
        </div>

        <div className="sec-form-group">
          <label className="sec-label">IP Whitelist <span className="sec-optional">(optional)</span></label>
          <input className="sec-input" value={ipWhitelist} onChange={e=>setIpWhitelist(e.target.value)}
            placeholder="192.168.1.1, 10.0.0.0/8 — leave blank to allow all" />
        </div>

        <div className="sec-form-group">
          <label className="sec-label">Expires in days <span className="sec-optional">(optional)</span></label>
          <input className="sec-input" type="number" min={1} value={expiresInDays}
            onChange={e=>setExpiresInDays(e.target.value)} placeholder="30, 90, 365 — leave blank = no expiry" />
        </div>

        {error && <div className="sec-error"><i className="bi bi-exclamation-triangle-fill" /> {error?.response?.data?.message || "Failed to create key."}</div>}

        <div className="sec-modal-footer">
          <button className="sec-btn sec-btn--gray" onClick={onClose}>Cancel</button>
          <button className="sec-btn sec-btn--gold" disabled={isPending || !label.trim()} onClick={() => mutate()}>
            {isPending ? <><i className="bi bi-hourglass-split" /> Creating…</> : <><i className="bi bi-plus-circle-fill" /> Generate Key</>}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Key reveal modal ───────────────────────────────────────────────────────────

const KeyRevealModal = ({ rawKey, keyMeta, onClose }) => {
  const [copied,  setCopied]  = useState(false);
  const [copyErr, setCopyErr] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(rawKey);
      setCopied(true);
      setCopyErr(false);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyErr(true);
    }
  };
  return (
    <div className="sec-modal-backdrop">
      <div className="sec-modal">
        <div className="sec-modal-head">
          <h4 style={{ color:"#0ecb81" }}><i className="bi bi-check-circle-fill" /> Key Created</h4>
        </div>
        <div className="sec-key-reveal-warn">
          <i className="bi bi-exclamation-triangle-fill" />
          <span>This key will only be shown <strong>once</strong>. Copy and store it securely — it cannot be retrieved again.</span>
        </div>
        <div className="sec-key-reveal-box">
          <code className="sec-key-reveal-value">{rawKey}</code>
          <button className="sec-btn sec-btn--gold" onClick={copy}>
            {copied  ? <><i className="bi bi-check2" /> Copied!</>
             : copyErr ? <><i className="bi bi-exclamation-triangle" /> Failed</>
             : <><i className="bi bi-clipboard" /> Copy</>}
          </button>
        </div>
        {copyErr && (
          <p style={{ fontSize:"0.73rem", color:"#f6465d", margin:"0.35rem 0 0", display:"flex", alignItems:"center", gap:"0.3rem" }}>
            <i className="bi bi-info-circle" /> Clipboard access denied — select the key above and copy manually.
          </p>
        )}
        <p style={{ fontSize:"0.78rem", color:"#848e9c", margin:"0.5rem 0 0" }}>
          Label: <strong style={{ color:"#eaecef" }}>{keyMeta?.label}</strong> ·
          Scopes: {keyMeta?.scopes?.join(", ")} ·
          Prefix: {keyMeta?.prefix}…
        </p>
        <div className="sec-modal-footer">
          <button className="sec-btn sec-btn--gold" onClick={onClose}>
            <i className="bi bi-check2-circle" /> I've saved it, close
          </button>
        </div>
      </div>
    </div>
  );
};

// ══ MAIN PAGE ══════════════════════════════════════════════════════════════════

const DashSecurity = () => {
  const { isAuthenticated, user, logout, refreshUser } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab]     = useState("overview");
  useEffect(() => { refreshUser(); }, [refreshUser]);
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [revealedKey,  setRevealedKey]    = useState(null);
  const [revealedMeta, setRevealedMeta]   = useState(null);
  const [auditPage, setAuditPage] = useState(1);
  const qc = useQueryClient();

  // All hooks must run before early returns
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["security-summary"],
    queryFn:  api.summary,
    staleTime: 60_000,
  });

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ["security-audit", auditPage],
    queryFn:  () => api.auditLog(auditPage),
    staleTime: 30_000,
    enabled:  activeTab === "audit",
  });

  const revokeSession = useMutation({
    mutationFn: api.revokeSession,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["security-summary"] }),
  });

  const revokeAll = useMutation({
    mutationFn: api.revokeAll,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["security-summary"] }),
  });

  const revokeKey = useMutation({
    mutationFn: api.revokeKey,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["security-summary"] }),
  });

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const handleLogout = () => { logout(); };
  const toggleSidebar = () => setSidebarOpen(v => !v);

  const sessions         = summary?.sessions || [];
  const apiKeys          = summary?.apiKeys  || [];
  const currentSessionId = summary?.currentSessionId || null;
  const kycStatus        = summary?.kycStatus || user?.kycStatus || "unverified";

  const TABS = [
    { id: "overview",  label: "Overview",  icon: "bi-shield-check"      },
    { id: "sessions",  label: "Sessions",  icon: "bi-laptop"            },
    { id: "api-keys",  label: "API Keys",  icon: "bi-key"               },
    { id: "kyc",       label: "KYC",       icon: "bi-person-vcard"      },
    { id: "audit",     label: "Audit Log", icon: "bi-journal-text"      },
  ];

  return (
    <div className="dash-root">
      <DashNavbar onMenuClick={toggleSidebar} />
      <div className="dash-body">
        <DashSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onLogout={handleLogout} />
        <main className="dash-main">
          <div className="sec-page-head">
            <div>
              <h1 className="sec-page-title">
                <i className="bi bi-shield-fill-check" style={{ color:"#f0b90b" }} /> Security Center
              </h1>
              <p className="sec-page-sub">Manage your account security, sessions, API keys, and compliance status.</p>
            </div>
            <div className="sec-status-chip" style={{
              background: user?.status === "active" ? "rgba(14,203,129,0.1)" : "rgba(246,70,93,0.1)",
              color: user?.status === "active" ? "#0ecb81" : "#f6465d",
              border: `1px solid ${user?.status === "active" ? "rgba(14,203,129,0.25)" : "rgba(246,70,93,0.25)"}`,
            }}>
              <i className={`bi bi-${user?.status === "active" ? "check-circle-fill" : "x-octagon-fill"}`} />
              Account {user?.status === "active" ? "Active" : "Suspended"}
            </div>
          </div>

          {/* Tab bar */}
          <div className="sec-tabs">
            {TABS.map(t => (
              <button key={t.id} className={`sec-tab${activeTab === t.id ? " sec-tab--active" : ""}`}
                onClick={() => { setActiveTab(t.id); if (t.id !== "audit") setAuditPage(1); }}>
                <i className={`bi ${t.icon}`} /> {t.label}
              </button>
            ))}
          </div>

          {/* ── OVERVIEW ── */}
          {activeTab === "overview" && (
            <div className="sec-content">
              {/* KYC banner */}
              <KycBanner status={kycStatus} onStartKyc={() => setActiveTab("kyc")} />

              {/* Security stats strip */}
              <div className="sec-stats-strip">
                {[
                  { icon:"bi-laptop",    label:"Active Sessions",   val: sessions.filter(s=>s.isActive).length,  color:"#60a5fa" },
                  { icon:"bi-key-fill",  label:"API Keys",          val: apiKeys.length,                          color:"#f0b90b" },
                  { icon:"bi-exclamation-triangle-fill", label:"AML Alerts", val: summary?.compliance?.openAlerts || 0, color: (summary?.compliance?.openAlerts||0) > 0 ? "#f6465d" : "#0ecb81" },
                  { icon:"bi-clock-history", label:"Last Login",    val: "Session active",                        color:"#848e9c" },
                ].map((s, i) => (
                  <div key={i} className="sec-stat-card">
                    <div className="sec-stat-icon" style={{ background:`${s.color}18`, color:s.color }}>
                      <i className={`bi ${s.icon}`} />
                    </div>
                    <div className="sec-stat-val">{s.val}</div>
                    <div className="sec-stat-label">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Recent security events */}
              {(summary?.compliance?.recentAlerts?.length ?? 0) > 0 && (
                <div className="sec-card-block">
                  <SectionHeader icon="bi-exclamation-triangle" title="Recent Compliance Alerts" subtitle="AML and transaction monitoring events" />
                  {summary.compliance.recentAlerts.map((a, i) => (
                    <div key={i} className="sec-alert-row">
                      <span className="sec-pill sec-pill--red">{a.alertType?.replace(/_/g," ")}</span>
                      <span style={{ flex:1, fontSize:"0.8rem", color:"#848e9c" }}>{a.description}</span>
                      <span style={{ fontSize:"0.72rem", color:"#474d57" }}>{fmtDate(a.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Security tips */}
              <div className="sec-tips">
                {[
                  { icon:"bi-shield-lock", text:"Enable KYC verification to access all trading features and higher withdrawal limits." },
                  { icon:"bi-key",         text:"Use API keys with the minimum required scopes. Never share keys publicly." },
                  { icon:"bi-phone-vibrate",text:"Revoke sessions from devices you no longer use or recognize." },
                  { icon:"bi-eye-slash",   text:"Your audit log records every action taken on this account and cannot be modified." },
                ].map((t, i) => (
                  <div key={i} className="sec-tip">
                    <i className={`bi ${t.icon}`} style={{ color:"#f0b90b", fontSize:"1rem" }} />
                    <span>{t.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── SESSIONS ── */}
          {activeTab === "sessions" && (
            <div className="sec-content">
              <SectionHeader icon="bi-laptop" title="Active Sessions"
                subtitle="Devices and browsers currently signed into your account." />

              <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:"0.75rem" }}>
                <button className="sec-btn sec-btn--red" disabled={revokeAll.isPending}
                  onClick={() => { if(window.confirm("Revoke all other sessions?")) revokeAll.mutate(); }}>
                  <i className="bi bi-x-circle-fill" /> Revoke All Others
                </button>
              </div>

              {revokeAll.error && (
                <div className="sec-error" style={{ marginBottom:"0.75rem" }}>
                  <i className="bi bi-exclamation-triangle-fill" />
                  {revokeAll.error?.response?.data?.message || "Failed to revoke sessions. Please try again."}
                </div>
              )}
              {revokeSession.error && (
                <div className="sec-error" style={{ marginBottom:"0.75rem" }}>
                  <i className="bi bi-exclamation-triangle-fill" />
                  {revokeSession.error?.response?.data?.message || "Failed to revoke session. Please try again."}
                </div>
              )}

              {summaryLoading ? (
                <div className="sec-loading"><div className="sec-spinner" /></div>
              ) : sessions.length === 0 ? (
                <div className="sec-empty"><i className="bi bi-laptop" /><p>No active sessions found.</p></div>
              ) : (
                sessions.map((s, i) => (
                  <SessionCard key={s.sessionId || i} session={s}
                    current={currentSessionId ? s.sessionId === currentSessionId : i === 0}
                    onRevoke={(sid) => revokeSession.mutate(sid)} />
                ))
              )}
            </div>
          )}

          {/* ── API KEYS ── */}
          {activeTab === "api-keys" && (
            <div className="sec-content">
              <SectionHeader icon="bi-key" title="API Keys"
                subtitle="Generate keys to access the Nexora API programmatically." />

              <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:"0.75rem" }}>
                <button className="sec-btn sec-btn--gold" onClick={() => setShowCreateKey(true)}>
                  <i className="bi bi-plus-circle-fill" /> New API Key
                </button>
              </div>

              <div className="sec-api-info">
                <i className="bi bi-info-circle-fill" style={{ color:"#60a5fa" }} />
                <div>
                  <strong style={{ color:"#eaecef" }}>Authentication</strong>
                  <span style={{ color:"#848e9c" }}> — pass your key in the <code>X-API-Key</code> header.
                  Keys starting with <code>txk_</code> are valid. All key usage is audited.</span>
                </div>
              </div>

              {revokeKey.error && (
                <div className="sec-error" style={{ marginBottom:"0.75rem" }}>
                  <i className="bi bi-exclamation-triangle-fill" />
                  {revokeKey.error?.response?.data?.message || "Failed to revoke API key. Please try again."}
                </div>
              )}

              {summaryLoading ? (
                <div className="sec-loading"><div className="sec-spinner" /></div>
              ) : apiKeys.length === 0 ? (
                <div className="sec-empty"><i className="bi bi-key" /><p>No API keys yet. Generate one above.</p></div>
              ) : (
                apiKeys.map((k) => (
                  <ApiKeyCard key={String(k._id || k.id)} apiKey={k}
                    onRevoke={(id) => { if(window.confirm(`Revoke key "${k.label}"?`)) revokeKey.mutate(id); }} />
                ))
              )}
            </div>
          )}

          {/* ── KYC ── */}
          {activeTab === "kyc" && (
            <div className="sec-content">
              <SectionHeader icon="bi-person-vcard" title="Identity Verification (KYC)"
                subtitle="Required for full platform access and institutional-grade limits." />

              <KycBanner status={kycStatus} />

              <div className="sec-kyc-steps">
                {[
                  { step:1, icon:"bi-person-fill",  label:"Personal Information", done: kycStatus !== "unverified" },
                  { step:2, icon:"bi-card-image",   label:"Government ID",        done: kycStatus === "approved" || kycStatus === "pending" },
                  { step:3, icon:"bi-camera-video", label:"Selfie Verification",  done: kycStatus === "approved" },
                  { step:4, icon:"bi-patch-check",  label:"Review & Approval",    done: kycStatus === "approved" },
                ].map((s) => (
                  <div key={s.step} className={`sec-kyc-step${s.done ? " sec-kyc-step--done" : ""}`}>
                    <div className="sec-kyc-step-num">{s.done ? <i className="bi bi-check2" /> : s.step}</div>
                    <div className="sec-kyc-step-icon"><i className={`bi ${s.icon}`} /></div>
                    <div className="sec-kyc-step-label">{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="sec-kyc-limits">
                <h4 style={{ margin:"0 0 0.75rem", fontSize:"0.85rem", color:"#eaecef", fontWeight:700 }}>Verification Tiers</h4>
                {[
                  { tier:"Unverified", withdraw:"$500/day",  trade:"$2,000/day",  color:"#848e9c", active: kycStatus==="unverified" },
                  { tier:"KYC Pending",withdraw:"On hold",   trade:"$2,000/day",  color:"#f59e0b", active: kycStatus==="pending"    },
                  { tier:"Verified",   withdraw:"$50,000/day",trade:"Unlimited",  color:"#0ecb81", active: kycStatus==="approved"   },
                ].map((t) => (
                  <div key={t.tier} className={`sec-tier-row${t.active ? " sec-tier-row--active" : ""}`}>
                    <div style={{ display:"flex", alignItems:"center", gap:"0.5rem" }}>
                      {t.active && <i className="bi bi-arrow-right" style={{ color:t.color }} />}
                      <span style={{ fontWeight:t.active?700:500, color:t.active?t.color:"#848e9c", fontSize:"0.83rem" }}>{t.tier}</span>
                    </div>
                    <span style={{ fontSize:"0.78rem", color:"#848e9c" }}>Withdraw: {t.withdraw}</span>
                    <span style={{ fontSize:"0.78rem", color:"#848e9c" }}>Trade: {t.trade}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── AUDIT LOG ── */}
          {activeTab === "audit" && (
            <div className="sec-content">
              <SectionHeader icon="bi-journal-text" title="Audit Log"
                subtitle="Immutable, tamper-evident record of every action on your account." />

              <div className="sec-audit-notice">
                <i className="bi bi-lock-fill" style={{ color:"#f0b90b" }} />
                <span>Every entry is chained with SHA-256 hashes. Any modification to the record is mathematically detectable.</span>
              </div>

              {auditLoading ? (
                <div className="sec-loading"><div className="sec-spinner" /></div>
              ) : (
                <>
                  <div className="sec-table-wrap">
                    <table className="sec-audit-table">
                      <thead>
                        <tr>
                          <th>Severity</th>
                          <th>Action</th>
                          <th>Category</th>
                          <th>IP Address</th>
                          <th>Timestamp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(auditData?.logs || []).map((l) => <AuditRow key={String(l._id || l.id)} log={l} />)}
                        {(auditData?.logs || []).length === 0 && (
                          <tr><td colSpan={5}>
                            <div className="sec-empty"><i className="bi bi-journal-x" /><p>No audit entries yet.</p></div>
                          </td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {auditData?.pages > 1 && (
                    <div className="sec-pagination">
                      <button className="sec-btn sec-btn--gray" disabled={auditPage<=1} onClick={()=>setAuditPage(p=>p-1)}>← Prev</button>
                      <span style={{ color:"#848e9c", fontSize:"0.8rem" }}>Page {auditPage} of {auditData.pages}</span>
                      <button className="sec-btn sec-btn--gray" disabled={auditPage>=auditData.pages} onClick={()=>setAuditPage(p=>p+1)}>Next →</button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      {showCreateKey && (
        <CreateKeyForm
          onClose={() => setShowCreateKey(false)}
          onCreated={(rawKey, meta) => { setShowCreateKey(false); setRevealedKey(rawKey); setRevealedMeta(meta); }}
        />
      )}
      {revealedKey && (
        <KeyRevealModal rawKey={revealedKey} keyMeta={revealedMeta}
          onClose={() => { setRevealedKey(null); setRevealedMeta(null); }} />
      )}
    </div>
  );
};

export default DashSecurity;
