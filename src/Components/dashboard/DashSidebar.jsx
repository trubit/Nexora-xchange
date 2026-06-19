import { Link, useLocation } from "react-router-dom";

const DashSidebar = ({ open, onClose, onLogout }) => {
  const { pathname } = useLocation();

  const active = (to) => (pathname === to ? " dash-sidebar-link--active" : "");

  return (
    <>
      {open && <div className="dash-overlay" onClick={onClose} />}
      <aside className={`dash-sidebar${open ? " dash-sidebar--open" : ""}`}>
        <div className="dash-sidebar-inner">

          <p className="dash-sidebar-section">Overview</p>
          <Link to="/Dashboard" className={`dash-sidebar-link${active("/Dashboard")}`} onClick={onClose}>
            <i className="bi bi-grid-1x2-fill" /> Dashboard
          </Link>

          <p className="dash-sidebar-section">Trading</p>
          <Link to="/Dashboard/trade" className={`dash-sidebar-link${active("/Dashboard/trade")}`} onClick={onClose}>
            <i className="bi bi-graph-up-arrow" /> Trade
          </Link>
          <Link to="/Dashboard/spot" className={`dash-sidebar-link${active("/Dashboard/spot")}`} onClick={onClose}>
            <i className="bi bi-currency-exchange" /> Spot
          </Link>
          <Link to="/Dashboard/futures" className={`dash-sidebar-link${active("/Dashboard/futures")}`} onClick={onClose}>
            <i className="bi bi-lightning-charge-fill" /> Futures
          </Link>
          <Link to="/Dashboard/arbitrage" className={`dash-sidebar-link${active("/Dashboard/arbitrage")}`} onClick={onClose}>
            <i className="bi bi-shuffle" /> Arbitrage
          </Link>

          <p className="dash-sidebar-section">Finance</p>
          <Link to="/wallet" className={`dash-sidebar-link${active("/wallet")}`} onClick={onClose}>
            <i className="bi bi-wallet2" /> Crypto Wallet
          </Link>
          <Link to="/Dashboard/fiat" className={`dash-sidebar-link${active("/Dashboard/fiat")}`} onClick={onClose}>
            <i className="bi bi-cash-stack" /> Fiat Wallet
          </Link>
          <Link to="/Dashboard/markets" className={`dash-sidebar-link${active("/Dashboard/markets")}`} onClick={onClose}>
            <i className="bi bi-bar-chart-line-fill" /> Markets
          </Link>

          <p className="dash-sidebar-section">Exchange</p>
          <Link to="/Dashboard/p2p" className={`dash-sidebar-link${active("/Dashboard/p2p")}`} onClick={onClose}>
            <i className="bi bi-people-fill" /> P2P
          </Link>

          <p className="dash-sidebar-section">Account</p>
          <Link to="/Dashboard/notifications" className={`dash-sidebar-link${active("/Dashboard/notifications")}`} onClick={onClose}>
            <i className="bi bi-bell-fill" /> Notifications
          </Link>
          <Link to="/Dashboard/profile" className={`dash-sidebar-link${active("/Dashboard/profile")}`} onClick={onClose}>
            <i className="bi bi-person-circle" /> Profile
          </Link>
          <Link to="/Dashboard/subscription" className={`dash-sidebar-link${active("/Dashboard/subscription")}`} onClick={onClose}>
            <i className="bi bi-star-fill" /> Subscription
          </Link>
          <Link to="/Support" className={`dash-sidebar-link${active("/Support")}`} onClick={onClose}>
            <i className="bi bi-headset" /> Support
          </Link>
          <Link to="/Dashboard/contact" className={`dash-sidebar-link${active("/Dashboard/contact")}`} onClick={onClose}>
            <i className="bi bi-envelope" /> Contact
          </Link>

          <button className="dash-sidebar-link dash-sidebar-logout" onClick={onLogout}>
            <i className="bi bi-box-arrow-right" /> Logout
          </button>
        </div>
      </aside>
    </>
  );
};

export default DashSidebar;
