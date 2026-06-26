import { useThemeStore } from "../../store/themeStore";

// Inline theme toggle — delegates to the global themeStore.
// The toggle button in DashNavbar already uses this store directly;
// this component is kept for any other pages that still import it.
const ToggleTheme = () => {
  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      className="button-toggle"
      style={{
        background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.07)",
        color: isDark ? "#eaecef" : "#1e2329",
      }}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <i className={`bi bi-${isDark ? "sun" : "moon-stars"}`} style={{ fontSize: "1rem" }} />
    </button>
  );
};

export default ToggleTheme;
