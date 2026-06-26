import { useLocation } from "react-router-dom";
import MainHeader from "../Components/layout/main-header";

// Exact paths that suppress the public header
const HIDE_EXACT = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/terms",
  "/Dashboard",
  "/Blogs",
  "/blog",
  "/BlogUpdate",
  "/Support",
  "/wallet",
  "/Dashboard/trade",
  "/Dashboard/spot",
  "/Dashboard/futures",
  "/Dashboard/arbitrage",
  "/Dashboard/subscription",
  "/Dashboard/contact",
  "/Dashboard/markets",
  "/Dashboard/notifications",
  "/Dashboard/profile",
  "/Dashboard/p2p",
  "/Dashboard/fiat",
  "/admin",
]);

// Path prefixes that suppress the header for ALL sub-paths
const HIDE_PREFIXES = ["/Dashboard/", "/blogs/", "/admin"];

const MainLayout = ({ children }) => {
  const location = useLocation();
  // Normalize trailing slash so "/Dashboard/" matches "/Dashboard"
  const path = location.pathname.replace(/\/+$/, "") || "/";

  const hideHeader =
    HIDE_EXACT.has(path) ||
    HIDE_PREFIXES.some((prefix) => path.startsWith(prefix));

  return (
    <>
      {!hideHeader && <MainHeader />}
      {children}
    </>
  );
};

export default MainLayout;
