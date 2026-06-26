import { useState, useEffect, useRef } from "react";
import { Navigate, useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { requestWithRetry, apiClientInstance } from "../../api/client";
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

// ── UID Display with copy ─────────────────────────────────────────────────────

const UidDisplay = ({ uid }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (!uid) return;
    navigator.clipboard.writeText(uid).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <span className="dp-uid-wrap">
      <span className="dp-uid-value">{uid || "—"}</span>
      {uid && (
        <button
          type="button"
          className="dp-uid-copy"
          onClick={copy}
          title="Copy UID"
        >
          <i className={`bi bi-${copied ? "check2" : "copy"}`} />
          {copied ? "Copied" : "Copy"}
        </button>
      )}
    </span>
  );
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
  const { isAuthenticated, user, refreshUser } = useAuthStore();
  const avatarInputRef = useRef(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPreview, setAvatarPreview]     = useState(null);
  const [avatarErr, setAvatarErr]             = useState("");

  useEffect(() => { refreshUser(); }, []);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Auth guard
  const tok = localStorage.getItem("token");
  let usr = null;
  try { const r = localStorage.getItem("user"); usr = r && r !== "null" ? JSON.parse(r) : null; } catch {}
  if (!isAuthenticated && !(tok && usr && typeof usr === "object")) {
    return <Navigate to="/login" replace />;
  }

  const u = user || usr;

  const kycColor = { approved: "#0ecb81", pending: "#f0b90b", rejected: "#f6465d", unverified: "#848e9c" };
  const kycLabel = { approved: "Verified", pending: "Pending Review", rejected: "Rejected", unverified: "Not Verified" };
  const kycStatus = u?.kycStatus || "unverified";

  const roleLabel = (r) => {
    const map = { admin: "Administrator", user: "Standard User", vip: "VIP Trader" };
    return map[r] || (r ? r.charAt(0).toUpperCase() + r.slice(1) : "Standard User");
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { setAvatarErr("Image must be under 3 MB."); return; }
    setAvatarErr("");
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      await apiClientInstance.post("/api/auth/avatar", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await refreshUser();
    } catch (err) {
      setAvatarErr(err?.response?.data?.message || err?.message || "Upload failed.");
      setAvatarPreview(null);
    } finally {
      setAvatarUploading(false);
      e.target.value = "";
    }
  };

  const avatarSrc = avatarPreview || u?.avatarUrl || null;

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
                  <i className={`bi bi-${kycStatus === "approved" ? "patch-check-fill" : kycStatus === "pending" ? "clock-fill" : kycStatus === "rejected" ? "x-circle-fill" : "shield-exclamation"}`} />
                  KYC: {kycLabel[kycStatus] || kycStatus}
                </span>
              </div>
            </div>
            <div className="dp-card-body">
              <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
                {/* Clickable avatar with upload overlay */}
                <div
                  className="dp-avatar-wrap"
                  onClick={() => !avatarUploading && avatarInputRef.current?.click()}
                  title="Click to change photo"
                >
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    style={{ display: "none" }}
                    onChange={handleAvatarChange}
                  />
                  <div className="dp-avatar">
                    {avatarSrc
                      ? <img src={avatarSrc} alt="avatar"
                          style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                          onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextSibling.style.display = ""; }}
                        />
                      : null}
                    <span style={avatarSrc ? { display: "none" } : {}}>{initials(u?.email)}</span>
                    {avatarUploading && (
                      <div className="dp-avatar-uploading">
                        <span className="dp-avatar-spinner" />
                      </div>
                    )}
                  </div>
                  <div className="dp-avatar-overlay">
                    <i className="bi bi-camera-fill" />
                    <span>Change</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#eaecef" }}>
                    {u?.username || u?.name || u?.email?.split("@")[0] || "Trader"}
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "#848e9c", marginTop: 2 }}>{u?.email}</div>
                  <div style={{ fontSize: "0.76rem", color: "#636d77", marginTop: 4 }}>{roleLabel(u?.role)}</div>
                  <div style={{ fontSize: "0.74rem", color: "#636d77", marginTop: 4 }}>
                    <i className="bi bi-camera" style={{ marginRight: 4 }} />
                    Click photo to change
                  </div>
                  {avatarErr && (
                    <div style={{ fontSize: "0.77rem", color: "#f6465d", marginTop: 4 }}>
                      <i className="bi bi-exclamation-circle" style={{ marginRight: 4 }} />
                      {avatarErr}
                    </div>
                  )}
                </div>
              </div>

              <div className="dp-info-grid">
                <div className="dp-info-item">
                  <span className="dp-info-label">Email</span>
                  <span className="dp-info-val">{u?.email || "—"}</span>
                </div>
                <div className="dp-info-item">
                  <span className="dp-info-label">UID</span>
                  <UidDisplay uid={u?.uid} />
                </div>
                <div className="dp-info-item">
                  <span className="dp-info-label">Member Since</span>
                  <span className="dp-info-val">{fmtDate(u?.createdAt)}</span>
                </div>
                <div className="dp-info-item">
                  <span className="dp-info-label">Email Verified</span>
                  <span className="dp-info-val">
                    {u?.emailVerified
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

          {/* ── KYC Verification ── */}
          <div className="dp-card">
            <div className="dp-card-head">
              <span className="dp-card-title"><i className="bi bi-person-vcard-fill" style={{ marginRight: 6 }} />Identity Verification (KYC)</span>
              <span className="dp-status-badge" style={{
                color: kycColor[kycStatus],
                background: `${kycColor[kycStatus]}18`,
                border: `1px solid ${kycColor[kycStatus]}40`,
              }}>
                <i className={`bi bi-${kycStatus === "approved" ? "patch-check-fill" : kycStatus === "pending" ? "clock-fill" : kycStatus === "rejected" ? "x-circle-fill" : "shield-exclamation"}`} />
                {kycLabel[kycStatus] || kycStatus}
              </span>
            </div>
            <div className="dp-card-body">
              {kycStatus === "approved" && (
                <div style={{
                  display: "flex", alignItems: "center", gap: "0.85rem",
                  background: "rgba(14,203,129,0.08)", border: "1px solid rgba(14,203,129,0.2)",
                  borderRadius: 10, padding: "1rem 1.25rem",
                }}>
                  <i className="bi bi-patch-check-fill" style={{ color: "#0ecb81", fontSize: "2rem", flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700, color: "#0ecb81", marginBottom: 2 }}>Identity Verified</div>
                    <div style={{ fontSize: "0.82rem", color: "#848e9c" }}>
                      Your identity has been verified. You have access to the highest withdrawal limits and all platform features.
                    </div>
                  </div>
                </div>
              )}

              {kycStatus === "pending" && (
                <div style={{
                  display: "flex", alignItems: "center", gap: "0.85rem",
                  background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)",
                  borderRadius: 10, padding: "1rem 1.25rem",
                }}>
                  <i className="bi bi-clock-fill" style={{ color: "#f59e0b", fontSize: "2rem", flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700, color: "#f59e0b", marginBottom: 2 }}>Verification Under Review</div>
                    <div style={{ fontSize: "0.82rem", color: "#848e9c" }}>
                      Your KYC submission is being reviewed by our team. This usually takes 1–3 business days. You will be notified once approved.
                    </div>
                  </div>
                </div>
              )}

              {kycStatus === "rejected" && (
                <div style={{
                  background: "rgba(246,70,93,0.08)", border: "1px solid rgba(246,70,93,0.2)",
                  borderRadius: 10, padding: "1rem 1.25rem", marginBottom: "1rem",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", marginBottom: "0.5rem" }}>
                    <i className="bi bi-x-circle-fill" style={{ color: "#f6465d", fontSize: "1.3rem" }} />
                    <span style={{ fontWeight: 700, color: "#f6465d" }}>Verification Rejected</span>
                  </div>
                  <p style={{ fontSize: "0.82rem", color: "#848e9c", margin: "0 0 0.85rem" }}>
                    Your submission was not approved. Please re-submit with clearer documents.
                  </p>
                  <Link to="/Dashboard/kyc"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      background: "rgba(246,70,93,0.15)", border: "1px solid rgba(246,70,93,0.35)",
                      color: "#f6465d", borderRadius: 8, padding: "0.45rem 1rem",
                      fontSize: "0.83rem", fontWeight: 600, textDecoration: "none",
                    }}>
                    <i className="bi bi-arrow-repeat" /> Re-submit KYC
                  </Link>
                </div>
              )}

              {kycStatus === "unverified" && (
                <div style={{
                  background: "rgba(240,185,11,0.06)", border: "1px solid rgba(240,185,11,0.18)",
                  borderRadius: 10, padding: "1rem 1.25rem",
                }}>
                  <div style={{ fontSize: "0.85rem", color: "#eaecef", marginBottom: "0.75rem" }}>
                    Complete identity verification to unlock higher withdrawal limits and full platform access.
                  </div>
                  <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "0.85rem" }}>
                    {[
                      { icon: "bi-arrow-up-circle", text: "$500/day → $50,000/day withdrawals" },
                      { icon: "bi-infinity",         text: "Unlimited trading" },
                      { icon: "bi-shield-fill-check",text: "Regulatory compliance" },
                    ].map((f) => (
                      <span key={f.text} style={{ display: "flex", alignItems: "center", gap: 5,
                        fontSize: "0.78rem", color: "#848e9c" }}>
                        <i className={`bi ${f.icon}`} style={{ color: "#f0b90b" }} /> {f.text}
                      </span>
                    ))}
                  </div>
                  <Link to="/Dashboard/kyc"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      background: "linear-gradient(135deg,#f0b90b,#f8d247)",
                      color: "#0b0e11", borderRadius: 8, padding: "0.5rem 1.25rem",
                      fontSize: "0.85rem", fontWeight: 700, textDecoration: "none",
                    }}>
                    <i className="bi bi-arrow-up-right-circle" /> Start Verification
                  </Link>
                </div>
              )}
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
