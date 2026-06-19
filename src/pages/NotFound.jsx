import { Link } from "react-router-dom";

const NotFound = () => (
  <div style={{
    minHeight: "80vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "1rem",
    textAlign: "center",
    padding: "2rem",
    background: "#0b0e11",
    color: "#eaecef",
  }}>
    <span style={{ fontSize: "4.5rem", fontWeight: 800, color: "#f0b90b", lineHeight: 1 }}>404</span>
    <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>Page Not Found</h1>
    <p style={{ color: "#848e9c", maxWidth: 380, margin: 0, lineHeight: 1.6 }}>
      The page you are looking for doesn&apos;t exist or has been moved.
    </p>
    <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}>
      <Link
        to="/"
        style={{
          background: "#f0b90b", color: "#1e2026", borderRadius: 8,
          padding: "0.55rem 1.25rem", fontWeight: 700, fontSize: "0.88rem",
          textDecoration: "none",
        }}
      >
        Go Home
      </Link>
      <Link
        to="/Dashboard"
        style={{
          background: "rgba(240,185,11,0.12)", color: "#f0b90b", borderRadius: 8,
          padding: "0.55rem 1.25rem", fontWeight: 700, fontSize: "0.88rem",
          textDecoration: "none", border: "1px solid rgba(240,185,11,0.3)",
        }}
      >
        Dashboard
      </Link>
    </div>
  </div>
);

export default NotFound;
