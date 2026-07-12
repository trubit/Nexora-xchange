import { useState } from "react";
import { Container } from "react-bootstrap";
import NewsletterSection from "../Components/home/NewsletterSection";
import NavigationSection from "../Components/layout/NavigationSection";
import BottomBar from "../Components/layout/BottomBar";
import { httpClient } from "../services/httpClient";
import "../styles/arbitrage.css";

const arbitrageHighlights = [
  {
    title: "Advanced Market Scanning",
    description:
      "Our upcoming infrastructure continuously evaluates market depth, pricing asymmetries, and liquidity shifts across connected venues to identify high-quality arbitrage windows.",
  },
  {
    title: "Real-Time Opportunity Detection",
    description:
      "Institutional-grade signal pipelines are being engineered to detect, score, and prioritise cross-market opportunities with millisecond-level responsiveness.",
  },
  {
    title: "Institutional Execution Engine",
    description:
      "Execution services are in development for low-latency order placement, smart venue selection, and robust lifecycle controls to support professional strategy deployment.",
  },
  {
    title: "Risk Protection Infrastructure",
    description:
      "A layered risk framework is being built to manage slippage, latency exposure, and execution certainty through pre-trade checks, dynamic thresholds, and controlled routing logic.",
  },
  {
    title: "Multi-Exchange Liquidity Access",
    description:
      "Nexora is expanding cross-venue connectivity to provide broad liquidity access, resilient order fulfilment, and improved execution quality across market conditions.",
  },
];

const Artbitrage = () => {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    const sanitizedEmail = email.trim().toLowerCase();
    if (!sanitizedEmail) {
      setSubmitStatus("error");
      setStatusMessage("Please enter a valid email address.");
      return;
    }
    setIsSubmitting(true);
    setSubmitStatus(null);
    setStatusMessage("");
    try {
      let response;
      try {
        response = await httpClient.post("/api/contact-us/waitlist", {
          email: sanitizedEmail,
          waitlistType: "arbitrage",
        });
      } catch (error) {
        if (error.status === 404) {
          response = await httpClient.post("/api/contact-us", {
            fullName: "Arbitrage Waitlist User",
            email: sanitizedEmail,
            subject: "Arbitrage Waitlist Request",
            message: "Please add this email to the Nexora Arbitrage waitlist.",
          });
        } else {
          throw error;
        }
      }
      if (response.data?.success) {
        setSubmitStatus("success");
        setStatusMessage("Thank you. You have been added to the Nexora Arbitrage waitlist.");
        setEmail("");
      } else {
        setSubmitStatus("error");
        setStatusMessage("Unable to submit your request. Please try again.");
      }
    } catch (error) {
      setSubmitStatus("error");
      setStatusMessage(error.message || "Unable to submit your request right now. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <main className="arb-page" aria-labelledby="arb-page-title">
        <Container className="arb-container">
          <section className="arb-hero-card" aria-label="Arbitrage coming soon">
            <p className="arb-kicker">Institutional Trading Infrastructure</p>
            <h1 id="arb-page-title" className="arb-title">
              Crypto Arbitrage Trading
            </h1>
            <p className="arb-coming-soon">COMING SOON</p>
            <p className="arb-intro">
              Nexora is building a next-generation arbitrage trading
              infrastructure designed for professional market participants.
              Users will soon be able to access advanced cross-market
              opportunities through a secure execution environment backed by
              low-latency execution, intelligent market scanning,
              enterprise-grade risk management, and real-time market
              synchronisation.
            </p>
            <p className="arb-intro">
              The upcoming arbitrage suite is being engineered to support
              automated opportunity detection, institutional-grade trading
              tools, and advanced liquidity routing across multiple exchanges.
            </p>
          </section>

          <section className="arb-highlights-section" aria-label="Arbitrage capability highlights">
            <h2 className="arb-section-title">Core Capabilities In Development</h2>
            <div className="arb-highlights-grid">
              {arbitrageHighlights.map((item) => (
                <article key={item.title} className="arb-highlight-card">
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="arb-waitlist" aria-label="Stay updated">
            <h2 className="arb-section-title">Stay Updated</h2>
            <p>
              Receive launch updates when the Nexora Arbitrage Suite
              becomes available.
            </p>
            <form className="arb-form" onSubmit={handleSubmit}>
              <label htmlFor="arbitrage-email" className="arb-sr-only">Email address</label>
              <input
                id="arbitrage-email"
                type="email"
                name="email"
                autoComplete="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isSubmitting}
                required
              />
              <button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Sending..." : "Notify Me"}
              </button>
            </form>
            {submitStatus && (
              <p
                className={`arb-form-feedback ${submitStatus === "success" ? "arb-success" : "arb-error"}`}
                role="status"
                aria-live="polite"
              >
                {statusMessage}
              </p>
            )}
          </section>

          <p className="arb-footer-note">
            Nexora Arbitrage Suite is currently under active
            development and will launch in a future platform release.
          </p>
        </Container>
      </main>
      <NewsletterSection />
      <NavigationSection />
      <BottomBar />
    </>
  );
};

export default Artbitrage;
