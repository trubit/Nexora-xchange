import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { useThemeStore } from "../../store/themeStore";
import NotificationBell from "./NotificationBell";
import EmailVerifyBanner from "../common/EmailVerifyBanner";
import NexoraLogo from "../common/NexoraLogo";
import "../../styles/dashboard.css";

const DashNavbar = ({ onMenuClick, connectionStatus }) => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === "dark";

  const [tradeOpen,   setTradeOpen]   = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const tradeRef   = useRef(null);
  const profileRef = useRef(null);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isAt = (path) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (tradeRef.current   && !tradeRef.current.contains(e.target))   setTradeOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const connCfg = {
    connected:    { color: "#0ecb81", label: "Live",    pulse: true  },
    connecting:   { color: "#f0b90b", label: "Sync…",   pulse: true  },
    disconnected: { color: "#f6465d", label: "Offline", pulse: false },
    idle:         { color: "#474d57", label: "Idle",    pulse: false },
  }[connectionStatus] || { color: "#474d57", label: "", pulse: false };

  const initials = (user) => {
    if (user?.name) return user.name.slice(0, 2).toUpperCase();
    if (user?.email) return user.email[0].toUpperCase();
    return "U";
  };

  return (
    <>
      <nav className="bnx-nav">
        <div className="bnx-nav-inner">

          {/* ── LEFT ── */}
          <div className="bnx-nav-left">
            {/* Mobile hamburger */}
            <button className="bnx-hamburger" onClick={onMenuClick} aria-label="Menu">
              <i className="bi bi-list" />
            </button>

            {/* Logo */}
            <Link to="/Dashboard" className="bnx-logo">
              <NexoraLogo size={28} />
            </Link>

            {/* Desktop nav links */}
            <div className="bnx-links">
              <Link
                to="/Dashboard"
                className={`bnx-link${isAt("/Dashboard") && location.pathname === "/Dashboard" ? " bnx-link--on" : ""}`}
              >
                Overview
              </Link>

              <Link
                to="/Dashboard/markets"
                className={`bnx-link${isAt("/Dashboard/markets") ? " bnx-link--on" : ""}`}
              >
                Markets
              </Link>

              {/* Trade dropdown */}
              <div className="bnx-dd-wrap" ref={tradeRef}>
                <button
                  className={`bnx-link bnx-link--btn${
                    isAt("/Dashboard/trade") || isAt("/Dashboard/spot") ||
                    isAt("/Dashboard/futures") || isAt("/Dashboard/arbitrage")
                      ? " bnx-link--on" : ""
                  }`}
                  onClick={() => setTradeOpen(v => !v)}
                >
                  Trade
                  <i className={`bi bi-chevron-${tradeOpen ? "up" : "down"} bnx-chevron`} />
                </button>
                {tradeOpen && (
                  <div className="bnx-dropdown">
                    <div className="bnx-dd-label">Spot Trading</div>
                    <Link to="/Dashboard/spot" className="bnx-dd-item"
                      onClick={() => setTradeOpen(false)}>
                      <span className="bnx-dd-ico bnx-dd-ico--blue"><i className="bi bi-currency-exchange" /></span>
                      <div>
                        <div className="bnx-dd-name">Spot</div>
                        <div className="bnx-dd-desc">Buy & sell crypto instantly</div>
                      </div>
                    </Link>
                    <Link to="/Dashboard/futures" className="bnx-dd-item"
                      onClick={() => setTradeOpen(false)}>
                      <span className="bnx-dd-ico bnx-dd-ico--purple"><i className="bi bi-lightning-charge-fill" /></span>
                      <div>
                        <div className="bnx-dd-name">Futures</div>
                        <div className="bnx-dd-desc">Trade with leverage up to 125x</div>
                      </div>
                    </Link>
                    <Link to="/Dashboard/trade" className="bnx-dd-item"
                      onClick={() => setTradeOpen(false)}>
                      <span className="bnx-dd-ico bnx-dd-ico--green"><i className="bi bi-graph-up-arrow" /></span>
                      <div>
                        <div className="bnx-dd-name">Advanced Trade</div>
                        <div className="bnx-dd-desc">Pro charts & order types</div>
                      </div>
                    </Link>
                    <div className="bnx-dd-divider" />
                    <div className="bnx-dd-label">More</div>
                    <Link to="/Dashboard/arbitrage" className="bnx-dd-item"
                      onClick={() => setTradeOpen(false)}>
                      <span className="bnx-dd-ico bnx-dd-ico--gold"><i className="bi bi-shuffle" /></span>
                      <div>
                        <div className="bnx-dd-name">Arbitrage</div>
                        <div className="bnx-dd-desc">Cross-exchange opportunities</div>
                      </div>
                    </Link>
                  </div>
                )}
              </div>

              <Link
                to="/Dashboard/p2p"
                className={`bnx-link${isAt("/Dashboard/p2p") ? " bnx-link--on" : ""}`}
              >
                P2P
              </Link>

              <Link
                to="/wallet"
                className={`bnx-link${isAt("/wallet") ? " bnx-link--on" : ""}`}
              >
                Wallet
              </Link>

              <Link
                to="/Dashboard/analytics"
                className={`bnx-link${isAt("/Dashboard/analytics") ? " bnx-link--on" : ""}`}
              >
                Analytics
              </Link>
            </div>
          </div>

          {/* ── RIGHT ── */}
          <div className="bnx-nav-right">

            {/* Live connection indicator */}
            {connectionStatus && connCfg.label && (
              <span className="bnx-conn">
                <span
                  className={`bnx-conn-dot${connCfg.pulse ? " bnx-conn-dot--pulse" : ""}`}
                  style={{ background: connCfg.color, boxShadow: `0 0 6px ${connCfg.color}88` }}
                />
                <span className="bnx-conn-label" style={{ color: connCfg.color }}>
                  {connCfg.label}
                </span>
              </span>
            )}

            {/* Theme toggle */}
            <button
              className="bnx-theme-toggle"
              onClick={toggleTheme}
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
              aria-label="Toggle theme"
            >
              <i className={`bi bi-${isDark ? "sun" : "moon-stars"}`} />
            </button>

            {/* Notification bell */}
            <NotificationBell />

            {/* KYC badge chip */}
            {user?.kycStatus === "approved" && (
              <span className="bnx-kyc-chip bnx-kyc-chip--ok" title="Identity Verified">
                <i className="bi bi-patch-check-fill" /> Verified
              </span>
            )}
            {user?.kycStatus === "pending" && (
              <span className="bnx-kyc-chip bnx-kyc-chip--pending" title="KYC Under Review">
                <i className="bi bi-clock-fill" /> Pending
              </span>
            )}

            {/* Profile dropdown */}
            <div className="bnx-profile-wrap" ref={profileRef}>
              <button
                className={`bnx-profile-btn${profileOpen ? " bnx-profile-btn--open" : ""}`}
                onClick={() => setProfileOpen(v => !v)}
              >
                {user?.avatarUrl
                  ? <img src={user.avatarUrl} alt="av" className="bnx-av-img"
                      onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextSibling.style.display = ""; }}
                    />
                  : null}
                <span className="bnx-av-initials" style={user?.avatarUrl ? { display: "none" } : {}}>{initials(user)}</span>
                <div className="bnx-av-info">
                  <span className="bnx-av-name">
                    {user?.name || user?.email?.split("@")[0] || "Trader"}
                  </span>
                  {user?.uid && <span className="bnx-av-uid">UID {user.uid}</span>}
                </div>
                <i className={`bi bi-chevron-${profileOpen ? "up" : "down"} bnx-chevron`} />
              </button>

              {profileOpen && (
                <div className="bnx-profile-menu">
                  <div className="bnx-pm-header">
                    <div className="bnx-pm-av">
                      {user?.avatarUrl
                        ? <img src={user.avatarUrl} alt="av" className="bnx-pm-av-img"
                            onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextSibling.style.display = ""; }}
                          />
                        : null}
                      <span className="bnx-pm-av-init" style={user?.avatarUrl ? { display: "none" } : {}}>{initials(user)}</span>
                    </div>
                    <div>
                      <div className="bnx-pm-name">
                        {user?.name || user?.email?.split("@")[0] || "Trader"}
                      </div>
                      <div className="bnx-pm-email">{user?.email}</div>
                      {user?.uid && <div className="bnx-pm-uid">UID: {user.uid}</div>}
                    </div>
                  </div>

                  <div className="bnx-pm-divider" />

                  <Link to="/Dashboard" className="bnx-pm-item" onClick={() => setProfileOpen(false)}>
                    <i className="bi bi-grid-1x2-fill" /> Dashboard
                  </Link>
                  <Link to="/Dashboard/profile" className="bnx-pm-item" onClick={() => setProfileOpen(false)}>
                    <i className="bi bi-person-circle" /> My Profile
                  </Link>
                  <Link to="/wallet" className="bnx-pm-item" onClick={() => setProfileOpen(false)}>
                    <i className="bi bi-wallet2" /> My Wallet
                  </Link>
                  <Link to="/Dashboard/security" className="bnx-pm-item" onClick={() => setProfileOpen(false)}>
                    <i className="bi bi-shield-fill-check" /> Security Center
                  </Link>
                  <Link to="/Dashboard/kyc" className="bnx-pm-item" onClick={() => setProfileOpen(false)}>
                    <i className="bi bi-patch-check-fill" /> Identification
                  </Link>
                  <Link to="/Dashboard/analytics" className="bnx-pm-item" onClick={() => setProfileOpen(false)}>
                    <i className="bi bi-stars" /> Analytics
                  </Link>

                  {user?.role === "admin" && (
                    <>
                      <div className="bnx-pm-divider" />
                      <Link to="/admin" className="bnx-pm-item bnx-pm-item--admin"
                        onClick={() => setProfileOpen(false)}>
                        <i className="bi bi-shield-fill-exclamation" /> Admin Panel
                      </Link>
                    </>
                  )}

                  <div className="bnx-pm-divider" />
                  <button className="bnx-pm-item bnx-pm-item--logout" onClick={handleLogout}>
                    <i className="bi bi-box-arrow-right" /> Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>
      <EmailVerifyBanner />
    </>
  );
};

export default DashNavbar;
