import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import DashNavbar from "../../Components/layout/DashNavbar";
import DashSidebar from "../../Components/dashboard/DashSidebar";
import "../../styles/dashboard.css";

const FEATURES = [
  { icon: "bi-person-check-fill",        text: "Verified peer-to-peer traders"         },
  { icon: "bi-shield-fill-check",        text: "Escrow protection on every trade"      },
  { icon: "bi-currency-exchange",        text: "Multi-currency payment support"        },
  { icon: "bi-chat-dots-fill",           text: "In-app encrypted trade chat"           },
  { icon: "bi-clock-history",            text: "Dispute resolution within 24 hours"   },
  { icon: "bi-graph-up-arrow",           text: "Zero maker fees for liquidity"         },
];

const DashP2P = () => {
  const navigate                  = useNavigate();
  const { isAuthenticated }       = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const tok = localStorage.getItem("token");
  let usr = null;
  try { const r = localStorage.getItem("user"); usr = r && r !== "null" ? JSON.parse(r) : null; } catch {}
  if (!isAuthenticated && !(tok && usr && typeof usr === "object")) {
    return <Navigate to="/login" replace />;
  }

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
          <div>
            <h1 className="dp-page-title">P2P Trading</h1>
            <p className="dp-page-sub">Peer-to-peer crypto exchange with escrow protection.</p>
          </div>

          <div className="dp-card">
            <div className="dp-card-body">
              <div className="dp-soon-wrap">
                <i className="bi bi-people-fill dp-soon-icon" />
                <span className="dp-soon-badge">Coming Soon</span>
                <h2 className="dp-soon-title">P2P Trading is Under Construction</h2>
                <p className="dp-soon-sub">
                  Trade directly with other users using local payment methods.
                  Our secure escrow system will protect every transaction.
                </p>

                <div className="dp-feature-grid">
                  {FEATURES.map((f) => (
                    <div key={f.text} className="dp-feature-item">
                      <i className={`bi ${f.icon}`} />
                      <span>{f.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashP2P;
