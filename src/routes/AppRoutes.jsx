import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import NotFound from "../pages/NotFound";
import MainLayout from "../layouts/MainLayout";

const BlogDetail = lazy(() => import("../pages/blogs/blog-detail"));

const Home = lazy(() => import("../pages/home"));
const Login = lazy(() => import("../pages/login"));
const ForgotPassword = lazy(() => import("../pages/forgot-password"));
const Signup = lazy(() => import("../pages/signup"));
const ResetPassword = lazy(() => import("../pages/reset-password"));
const Artbitrage = lazy(() => import("../pages/arbitrage"));
const Subscription = lazy(() => import("../pages/subscription"));
const Trade = lazy(() => import("../pages/trade"));
const Contact = lazy(() => import("../pages/contact"));
const About = lazy(() => import("../pages/About"));
const PrivacyPolicy = lazy(() => import("../pages/PrivacyPolicy"));
const CookiePolicy = lazy(() => import("../pages/CookiePolicy"));
const CompliancePolicy = lazy(() => import("../pages/CompliancePolicy"));
const WhistleblowingPolicy = lazy(() => import("../pages/WhistleblowingPolicy"));
const AntiBriberyPolicy = lazy(() => import("../pages/AntiBriberyPolicy"));
const UserAgreement = lazy(() => import("../pages/UserAgreement"));
const CookieBanner = lazy(() => import("../pages/CookieBanner"));
const ElectronicCommunications = lazy(() => import("../pages/ElectronicCommunications"));
const AssetListingPolicy = lazy(() => import("../pages/AssetListingPolicy"));
const TradingRules = lazy(() => import("../pages/TradingRules"));
const LiquidationGuard = lazy(() => import("../pages/LiquidationGuard"));
const FeeSchedule = lazy(() => import("../pages/FeeSchedule"));
const Terms = lazy(() => import("../pages/terms"));
const Dashborad = lazy(() => import("../pages/Dashboard"));
const Blogs = lazy(() => import("../pages/blogs/blogs"));
const BlogUpdate = lazy(() => import("../Components/common/BlogUpdate"));
const Spot = lazy(() => import("../Components/trade/Spot"));
const Futures = lazy(() => import("../Components/trade/Futures"));
const Support = lazy(() => import("../Components/common/Support"));
const VerifyEmail = lazy(() => import("../pages/verify-email"));
const DashTrade = lazy(() => import("../pages/dashboard/DashTrade"));
const DashSpot = lazy(() => import("../pages/dashboard/DashSpot"));
const DashFutures = lazy(() => import("../pages/dashboard/DashFutures"));
const DashArbitrage = lazy(() => import("../pages/dashboard/DashArbitrage"));
const DashSubscription = lazy(() => import("../pages/dashboard/DashSubscription"));
const DashContact = lazy(() => import("../pages/dashboard/DashContact"));
const Wallet = lazy(() => import("../pages/wallet"));
const Markets           = lazy(() => import("../pages/markets"));
const DashNotifications = lazy(() => import("../pages/dashboard/DashNotifications"));
const DashProfile       = lazy(() => import("../pages/dashboard/DashProfile"));
const DashP2P           = lazy(() => import("../pages/dashboard/DashP2P"));
const DashFiatWallet    = lazy(() => import("../pages/dashboard/DashFiatWallet"));

const RouteLoader = () => (
  <div className="container py-4 text-center">Loading page...</div>
);

const AppRoutes = () => (
  <MainLayout>
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/Dashboard" element={<Dashborad />} />
        <Route path="/arbitrage" element={<Artbitrage />} />
        <Route path="/subscription" element={<Subscription />} />
        <Route path="/subscriptin" element={<Subscription />} />
        <Route path="/trade" element={<Trade />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/about" element={<About />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/cookie-policy" element={<CookiePolicy />} />
        <Route path="/compliance-policy" element={<CompliancePolicy />} />
        <Route path="/whistleblowing-policy" element={<WhistleblowingPolicy />} />
        <Route path="/anti-bribery-policy" element={<AntiBriberyPolicy />} />
        <Route path="/user-agreement" element={<UserAgreement />} />
        <Route path="/cookie-banner" element={<CookieBanner />} />
        <Route
          path="/electronic-communications"
          element={<ElectronicCommunications />}
        />
        <Route path="/asset-listing-policy" element={<AssetListingPolicy />} />
        <Route path="/trading-rules" element={<TradingRules />} />
        <Route path="/liquidation-guard" element={<LiquidationGuard />} />
        <Route path="/fee-schedule" element={<FeeSchedule />} />
        <Route path="/blog" element={<Blogs />} />
        <Route path="/Blogs" element={<Blogs />} />
        <Route path="/BlogUpdate" element={<BlogUpdate />} />
<Route path="/blogs/:id" element={<BlogDetail />} />
        <Route path="/Spot" element={<Spot />} />
        <Route path="/Futures" element={<Futures />} />
        <Route path="/Support" element={<Support />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/Dashboard/trade" element={<DashTrade />} />
        <Route path="/Dashboard/spot" element={<DashSpot />} />
        <Route path="/Dashboard/futures" element={<DashFutures />} />
        <Route path="/Dashboard/arbitrage" element={<DashArbitrage />} />
        <Route path="/Dashboard/subscription" element={<DashSubscription />} />
        <Route path="/Dashboard/contact" element={<DashContact />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/markets" element={<Navigate to="/Dashboard/markets" replace />} />
        <Route path="/Dashboard/markets" element={<Markets />} />
        <Route path="/Dashboard/notifications" element={<DashNotifications />} />
        <Route path="/Dashboard/profile"       element={<DashProfile />} />
        <Route path="/Dashboard/p2p"           element={<DashP2P />} />
        <Route path="/Dashboard/fiat"          element={<DashFiatWallet />} />
        {/* Catch-all: 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  </MainLayout>
);

export default AppRoutes;
