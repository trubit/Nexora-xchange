import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import DashNavbar from "../layout/DashNavbar";
import DashSidebar from "./DashSidebar";
import "../../styles/dashboard.css";

const DashPagePlaceholder = ({ title, icon = "bi-tools", subtitle }) => {
  const navigate            = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Auth guard (same localStorage fallback pattern used across all dash pages)
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

        <main className="dash-main" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
          <div style={{ textAlign: "center", padding: "2rem" }}>
            <i
              className={`bi ${icon}`}
              style={{ fontSize: "3.5rem", color: "#f0b90b", display: "block", marginBottom: "1.25rem" }}
            />
            <h2 style={{ color: "#eaecef", marginBottom: "0.5rem", fontWeight: 700 }}>{title}</h2>
            <p style={{ color: "#848e9c", maxWidth: "400px", margin: "0 auto 1.5rem", lineHeight: 1.6 }}>
              {subtitle || "This feature is under development and will be available in an upcoming release."}
            </p>
            <button
              onClick={() => navigate("/Dashboard")}
              style={{
                background: "rgba(240,185,11,0.12)", border: "1px solid rgba(240,185,11,0.3)",
                color: "#f0b90b", borderRadius: 8, padding: "0.5rem 1.25rem",
                fontSize: "0.85rem", fontWeight: 600, cursor: "pointer",
              }}
            >
              <i className="bi bi-arrow-left" style={{ marginRight: 6 }} />Back to Dashboard
            </button>
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashPagePlaceholder;
