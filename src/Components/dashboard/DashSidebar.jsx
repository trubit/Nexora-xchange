import { Link, useLocation } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import NexoraLogo from "../common/NexoraLogo";

const NAV = [
  {
    section: "Overview",
    items: [
      { to: "/Dashboard",           icon: "bi-grid-1x2-fill",        label: "Dashboard" },
    ],
  },
  {
    section: "Trading",
    items: [
      { to: "/Dashboard/trade",            icon: "bi-graph-up-arrow",        label: "Trade" },
      { to: "/Dashboard/spot",             icon: "bi-currency-exchange",     label: "Spot" },
      { to: "/Dashboard/futures",          icon: "bi-lightning-charge-fill", label: "Futures" },
      { to: "/Dashboard/arbitrage",        icon: "bi-shuffle",               label: "Arbitrage" },
      { to: "/Dashboard/execution-router", icon: "bi-diagram-3-fill",        label: "Execution Router" },
    ],
  },
  {
    section: "Finance",
    items: [
      { to: "/wallet",               icon: "bi-wallet2",             label: "Crypto Wallet" },
      { to: "/Dashboard/fiat",       icon: "bi-cash-stack",          label: "Fiat Wallet" },
      { to: "/Dashboard/markets",    icon: "bi-bar-chart-line-fill", label: "Markets" },
      { to: "/Dashboard/settlement", icon: "bi-link-45deg",          label: "Settlement" },
      { to: "/Dashboard/liquidity",  icon: "bi-droplet-fill",        label: "Liquidity" },
      { to: "/Dashboard/clearing",       icon: "bi-bank2",               label: "Clearing House" },
      { to: "/Dashboard/custody",        icon: "bi-safe2",               label: "Custody Vault"  },
      { to: "/Dashboard/reg-compliance", icon: "bi-shield-check",         label: "Reg Compliance" },
      { to: "/Dashboard/hadr",           icon: "bi-shield-shaded",         label: "HA & DR" },
      { to: "/Dashboard/auto-ops",       icon: "bi-cpu",                    label: "Auto Ops" },
      { to: "/Dashboard/ecosystem",      icon: "bi-globe2",                 label: "Ecosystem" },
    ],
  },
  {
    section: "Insights",
    items: [
      { to: "/Dashboard/analytics",           icon: "bi-stars",             label: "Analytics"          },
      { to: "/Dashboard/security",            icon: "bi-shield-fill-check", label: "Security Center"    },
      { to: "/Dashboard/market-intelligence", icon: "bi-radar",             label: "Market Intelligence"},
      { to: "/Dashboard/credit-risk",         icon: "bi-person-badge-fill", label: "Credit Risk"        },
    ],
  },
  {
    section: "Exchange",
    items: [
      { to: "/Dashboard/p2p",          icon: "bi-people-fill", label: "P2P"         },
      { to: "/Dashboard/institutional", icon: "bi-bank",        label: "Institutional"},
    ],
  },
  {
    section: "Account",
    items: [
      { to: "/Dashboard/notifications", icon: "bi-bell-fill",        label: "Notifications" },
      { to: "/Dashboard/profile",   icon: "bi-person-circle",        label: "Profile" },
      { to: "/Dashboard/subscription", icon: "bi-star-fill",         label: "Subscription" },
      { to: "/Support",             icon: "bi-headset",              label: "Support" },
      { to: "/Dashboard/contact",   icon: "bi-envelope",             label: "Contact" },
    ],
  },
];

const DashSidebar = ({ open, onClose, onLogout }) => {
  const { pathname } = useLocation();
  const user = useAuthStore((s) => s.user);

  const isActive = (to) => pathname === to;

  const initials = (email) => {
    if (!email) return "U";
    const parts = email.split("@")[0].split(/[._-]/);
    return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("") || "U";
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={`dsb-overlay${open ? " dsb-overlay--visible" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar panel */}
      <aside className={`dsb-panel${open ? " dsb-panel--open" : ""}`} aria-label="Navigation">

        {/* Gold top accent bar */}
        <div className="dsb-accent-bar" />

        {/* Header — user info */}
        <div className="dsb-header">
          <div className="dsb-avatar">
            {user?.avatarUrl
              ? <img src={user.avatarUrl} alt="avatar"
                  style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                  onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextSibling.style.display = ""; }}
                />
              : null}
            <span style={user?.avatarUrl ? { display: "none" } : {}}>{initials(user?.email)}</span>
          </div>
          <div className="dsb-header-info">
            <span className="dsb-header-name">
              {user?.name || user?.email?.split("@")[0] || "Trader"}
            </span>
            <span className="dsb-header-email">{user?.email || "—"}</span>
            {user?.uid && (
              <span className="dsb-header-uid">
                <i className="bi bi-fingerprint" /> UID: {user.uid}
              </span>
            )}
          </div>
          <button className="dsb-close-btn" onClick={onClose} aria-label="Close menu">
            <i className="bi bi-x-lg" />
          </button>
        </div>

        {/* Brand strip */}
        <div className="dsb-brand-strip">
          <NexoraLogo size={26} />
          <span className="dsb-brand-dot" />
        </div>

        {/* Nav groups */}
        <nav className="dsb-nav">
          {NAV.map((group) => (
            <div key={group.section} className="dsb-group">
              <p className="dsb-section-label">{group.section}</p>
              {group.items.map(({ to, icon, label }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={onClose}
                  className={`dsb-link${isActive(to) ? " dsb-link--active" : ""}`}
                >
                  <span className="dsb-link-icon">
                    <i className={`bi ${icon}`} />
                  </span>
                  <span className="dsb-link-label">{label}</span>
                  {isActive(to) && <span className="dsb-link-pip" />}
                </Link>
              ))}
            </div>
          ))}

          {/* Admin section — only for admin users */}
          {user?.role === "admin" && (
            <div className="dsb-group dsb-group--admin">
              <p className="dsb-section-label" style={{ color: "rgba(240,185,11,0.55)" }}>Admin</p>
              <Link
                to="/admin"
                onClick={onClose}
                className={`dsb-link dsb-link--gold${isActive("/admin") ? " dsb-link--active" : ""}`}
              >
                <span className="dsb-link-icon">
                  <i className="bi bi-shield-fill-check" />
                </span>
                <span className="dsb-link-label">Admin Panel</span>
                <span className="dsb-admin-badge">ADMIN</span>
              </Link>
              <Link
                to="/Dashboard/audit-ledger"
                onClick={onClose}
                className={`dsb-link dsb-link--gold${isActive("/Dashboard/audit-ledger") ? " dsb-link--active" : ""}`}
              >
                <span className="dsb-link-icon">
                  <i className="bi bi-journal-lock" />
                </span>
                <span className="dsb-link-label">Audit Ledger</span>
                <span className="dsb-admin-badge">ADMIN</span>
              </Link>
            </div>
          )}
        </nav>

        {/* Footer — logout */}
        <div className="dsb-footer">
          <div className="dsb-footer-divider" />
          <button className="dsb-logout" onClick={onLogout}>
            <span className="dsb-link-icon">
              <i className="bi bi-box-arrow-right" />
            </span>
            <span className="dsb-link-label">Sign Out</span>
          </button>
          <p className="dsb-footer-copy">Nexora © {new Date().getFullYear()}</p>
        </div>
      </aside>
    </>
  );
};

export default DashSidebar;
