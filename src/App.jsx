import { Routes, Route, useLocation } from "react-router-dom";

import MainHeader from "./header-navigation/main-header";

import Home from "./pages/home";
import Login from "./pages/login";
import ForgotPassword from "./pages/forgot-password";
import Signup from "./pages/signup";
import VerifyEmail from "./pages/verify-email";

import Artbitrage from "./pages/arbitrage";
import Subscription from "./pages/subscription";
import Trade from "./pages/trade";
import Contact from "./pages/contact";

import Terms from "./pages/terms";

import Dashborad from "./pages/Dashboard";

import Blogs from "./Blogs-page/blogs";
import BlogUpdate from "./Components/BlogUpdate";
import FinCen from "./Blogs-page/Fincen";
import FreePackage from "./Blogs-page/FreePackage";
import GoldenBuySell from "./Blogs-page/GoldenBuySell";
import Xgolden from "./Blogs-page/X-golden";

import Spot from "./Crypto-Trade/Spot";
import Futures from "./Crypto-Trade/Futures";

import Support from "./Components/Support";

import "./App.css";

const App = () => {
  const location = useLocation();

  const hideHeader = [
    "/login",
    "/signup",
    "/verify-email",
    "/forgot-password",
    "/terms",
    "/Dashboard",
    "/trade",
    "/Blogs",
    "/BlogUpdate",
    "/FreePackage",
    "/FinCen",
    "/GoldenBuySell",
    "/Xgolden",
    "/Spot",
    "/Futures",
    "/Support",

    //add any other auth pages here
  ].includes(location.pathname);

  return (
    <>
      {!hideHeader && <MainHeader />} {/* this line hides it automatically*/}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/Dashboard" element={<Dashborad />} />
        <Route path="/arbitrage" element={<Artbitrage />} />
        <Route path="/subscription" element={<Subscription />} />
        <Route path="/trade" element={<Trade />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/Blogs" element={<Blogs />} />
        <Route path="/BlogUpdate" element={<BlogUpdate />} />
        <Route path="/FinCen" element={<FinCen />} />
        <Route path="/FreePackage" element={<FreePackage />} />
        <Route path="/GoldenBuySell" element={<GoldenBuySell />} />
        <Route path="/Xgolden" element={<Xgolden />} />
        <Route path="/Spot" element={<Spot />} />
        <Route path="/Futures" element={<Futures />} />
        <Route path="/Support" element={<Support />} />
      </Routes>
    </>
  );
};

export default App;
