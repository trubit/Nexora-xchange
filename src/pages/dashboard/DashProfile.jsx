import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { requestWithRetry } from "../../api/client";
import DashNavbar from "../../Components/layout/DashNavbar";
import DashSidebar from "../../Components/dashboard/DashSidebar";
import "../../styles/dashboard.css";

// Backend requires: 8+ chars, upper, lower, digit, symbol
const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (d) => {
  try { return new Date(d).toLocaleDateString([], { dateStyle: "medium" }); }
  catch { return "—"; }
};

const initials = (email) => {
  if (!email) return "?";
  const parts = email.split("@")[0].split(/[._-]/);
  return parts
    .slice(0, 2)
    .map((p) => (p[0] || "").toUpperCase())
    .join("") || email[0].toUpperCase();
};

// ── Password Change Form ──────────────────────────────────────────────────────

const PasswordForm = () => {
  const [cur,    setCur]    = useState("");
  const [next,   setNext]   = useState("");
  const [conf,   setConf]   = useState("");
  const [busy,   setBusy]   = useState(false);
  const [status, setStatus] = useState(null);

  const validate = () => {
    if (!cur)            return "Enter your current password.";
    if (!next)           return "Enter a new password.";
    if (!PASSWORD_POLICY.test(next))
      return "New password must be 8+ characters and include uppercase, lowercase, a number, and a symbol.";
    if (next !== conf)   return "Passwords do not match.";
    if (next === cur)    return "New password must be different from current password.";
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus(null);

    const err = validate();
    if (err) return setStatus({ t: "err", msg: err });

    setBusy(true);
    try {
      await requestWithRetry({
        method: "post",
        url:    "/api/auth/change-password",
        data:   { currentPassword: cur, newPassword: next },
      });
      setStatus({ t: "ok", msg: "Password updated successfully." });
      setCur(""); setNext(""); setConf("");
    } catch (e) {
      setStatus({ t: "err", msg: e?.message || "Failed to change password." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      {status && (
        <div className={`dt-alert dt-alert--${status.t === "ok" ? "ok" : "err"}`} style={{ marginBottom: "1rem" }}>
          <i className={`bi bi-${status.t === "ok" ? "check-circle-fill" : "exclamation-circle-fill"}`} />
          {status.msg}
        </div>
      )}

      <div className="dp-field">
        <label htmlFor="pw-current">Current Password</label>
        <input id="pw-current" name="currentPassword" type="password" value={cur} onChange={(e) => setCur(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
      </div>
      <div className="dp-field">
        <label htmlFor="pw-new">New Password</label>
        <input id="pw-new" name="newPassword" type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="Min 8 characters" autoComplete="new-password" />
      </div>
      <div className="dp-field">
        <label htmlFor="pw-confirm">Confirm New Password</label>
        <input id="pw-confirm" name="confirmPassword" type="password" value={conf} onChange={(e) => setConf(e.target.value)} placeholder="Repeat new password" autoComplete="new-password" />
      </div>

      <button type="submit" className="dp-save-btn" disabled={busy}>
        {busy ? <><i className="bi bi-hourglass-split" /> Saving…</> : <><i className="bi bi-shield-lock" /> Update Password</>}
      </button>
    </form>
  );
};

// ── Main Profile Page ─────────────────────────────────────────────────────────

const DashProfile = () => {
  const navigate              = useNavigate();
  const { isAuthenticated, user } = useAuthStore();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Auth guard
  const tok = localStorage.getItem("token");
  let usr = null;
  try { const r = localStorage.getItem("user"); usr = r && r !== "null" ? JSON.parse(r) : null; } catch {}
  if (!isAuthenticated && !(tok && usr && typeof usr === "object")) {
    return <Navigate to="/login" replace />;
  }

  const u = user || usr;

  const kycColor = { verified: "#0ecb81", pending: "#f0b90b", unverified: "#848e9c" };
  const kycLabel = { verified: "Verified", pending: "Pending Review", unverified: "Not Verified" };
  const kycStatus = u?.kycStatus || "unverified";

  const roleLabel = (r) => {
    const map = { admin: "Administrator", user: "Standard User", vip: "VIP Trader" };
    return map[r] || (r ? r.charAt(0).toUpperCase() + r.slice(1) : "Standard User");
  };

  return (
    <div className="dash-root">
      <DashNavbar onMenuClick={() => setSidebarOpen((v) => !v)} />

      <div className="dash-body">
        <DashSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onLogout={() => { useAuthStore.getState().logout(); navigate("/login"); }}
        />

        <main className="dash-main dp-page">

          {/* ── Header ── */}
          <div className="nf-page-head">
            <div>
              <h1 className="dp-page-title">Profile</h1>
              <p className="dp-page-sub">Manage your account information and security settings.</p>
            </div>
          </div>

          {/* ── Account overview ── */}
          <div className="dp-card">
            <div className="dp-card-head">
              <span className="dp-card-title"><i className="bi bi-person-circle" style={{ marginRight: 6 }} />Account Overview</span>
              <div className="dp-badge-row">
                <span className="dp-status-badge" style={{
                  color: kycColor[kycStatus],
                  background: `${kycColor[kycStatus]}18`,
                  border: `1px solid ${kycColor[kycStatus]}40`,
                }}>
                  <i className={`bi bi-${kycStatus === "verified" ? "patch-check-fill" : kycStatus === "pending" ? "clock-fill" : "shield-exclamation"}`} />
                  KYC: {kycLabel[kycStatus]}
                </span>
              </div>
            </div>
            <div className="dp-card-body">
              <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
                <div className="dp-avatar">{initials(u?.email)}</div>
                <div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#eaecef" }}>
                    {u?.username || u?.name || u?.email?.split("@")[0] || "Trader"}
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "#848e9c", marginTop: 2 }}>{u?.email}</div>
                  <div style={{ fontSize: "0.76rem", color: "#636d77", marginTop: 4 }}>{roleLabel(u?.role)}</div>
                </div>
              </div>

              <div className="dp-info-grid">
                <div className="dp-info-item">
                  <span className="dp-info-label">Email</span>
                  <span className="dp-info-val">{u?.email || "—"}</span>
                </div>
                <div className="dp-info-item">
                  <span className="dp-info-label">UID</span>
                  <span className="dp-info-val" style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                    {u?._id?.slice(-10).toUpperCase() || "—"}
                  </span>
                </div>
                <div className="dp-info-item">
                  <span className="dp-info-label">Member Since</span>
                  <span className="dp-info-val">{fmtDate(u?.createdAt)}</span>
                </div>
                <div className="dp-info-item">
                  <span className="dp-info-label">Email Verified</span>
                  <span className="dp-info-val">
                    {u?.isEmailVerified
                      ? <span style={{ color: "#0ecb81" }}><i className="bi bi-check-circle-fill" /> Verified</span>
                      : <span style={{ color: "#f6465d" }}><i className="bi bi-x-circle-fill" /> Not Verified</span>}
                  </span>
                </div>
                <div className="dp-info-item">
                  <span className="dp-info-label">Account Status</span>
                  <span className="dp-info-val">
                    {u?.isActive !== false
                      ? <span style={{ color: "#0ecb81" }}><i className="bi bi-circle-fill" style={{ fontSize: "0.55rem" }} /> Active</span>
                      : <span style={{ color: "#f6465d" }}><i className="bi bi-circle-fill" style={{ fontSize: "0.55rem" }} /> Suspended</span>}
                  </span>
                </div>
                <div className="dp-info-item">
                  <span className="dp-info-label">Referral Code</span>
                  <span className="dp-info-val" style={{ fontFamily: "monospace" }}>
                    {u?.referralCode || u?._id?.slice(-6).toUpperCase() || "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Security ── */}
          <div className="dp-card">
            <div className="dp-card-head">
              <span className="dp-card-title"><i className="bi bi-shield-lock" style={{ marginRight: 6 }} />Security</span>
            </div>
            <div className="dp-card-body" style={{ maxWidth: 480 }}>
              <PasswordForm />
            </div>
          </div>

          {/* ── Session info ── */}
          <div className="dp-card">
            <div className="dp-card-head">
              <span className="dp-card-title"><i className="bi bi-laptop" style={{ marginRight: 6 }} />Active Session</span>
            </div>
            <div className="dp-card-body">
              <div className="dp-info-grid">
                <div className="dp-info-item">
                  <span className="dp-info-label">Session Token</span>
                  <span className="dp-info-val" style={{ fontFamily: "monospace", fontSize: "0.78rem", color: "#636d77" }}>
                    {tok ? `${tok.slice(0, 12)}…${tok.slice(-6)}` : "—"}
                  </span>
                </div>
                <div className="dp-info-item">
                  <span className="dp-info-label">Device</span>
                  <span className="dp-info-val">This Device</span>
                </div>
              </div>
              <button
                className="dp-save-btn"
                style={{ background: "#f6465d", marginTop: "1.1rem" }}
                onClick={() => { useAuthStore.getState().logout(); navigate("/login"); }}
              >
                <i className="bi bi-box-arrow-right" /> Sign Out
              </button>
            </div>
          </div>

        </main>
      </div>
    </div>
  );
};

export default DashProfile;
