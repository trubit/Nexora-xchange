import { useState } from "react";
import { Container } from "react-bootstrap";
import NewsletterSection from "../home/NewsletterSection";
import NavigationSection from "../layout/NavigationSection";
import BottomBar from "../layout/BottomBar";
import { httpClient } from "../../services/httpClient";
import "../../styles/future.css";

const futuresHighlights = [
  {
    title: "Advanced Trading Infrastructure",
    description:
      "Professional-grade execution systems designed for fast and reliable trading performance.",
  },
  {
    title: "Risk Management",
    description:
      "Integrated risk controls and protection systems designed to enhance trading security.",
  },
  {
    title: "High-Speed Execution",
    description:
      "Low-latency infrastructure designed to deliver fast market response times.",
  },
  {
    title: "Market Intelligence",
    description:
      "Advanced tools and market insights designed to improve trading decisions.",
  },
];

const futuresExpectations = [
  "Professional trading environment",
  "Advanced charting tools",
  "Margin trading support",
  "Market analytics",
  "Portfolio management",
  "Real-time trading data",
  "Secure infrastructure",
  "Institutional-grade performance",
];

const Futures = () => {
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
      const response = await httpClient.post("/api/contact-us", {
        fullName: "Futures Waitlist User",
        email: sanitizedEmail,
        subject: "Futures Waitlist Request",
        message: "Please add this email to the Nexora Futures waitlist.",
      });
      if (response.data?.success) {
        setSubmitStatus("success");
        setStatusMessage("Thank you. You have been added to the Nexora Futures waitlist.");
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
      <main className="future-page" aria-labelledby="future-page-title">
        <Container className="future-container">
          <section className="future-hero-card" aria-label="Futures launching soon">
            <p className="future-kicker">Institutional Trading Infrastructure</p>
            <h1 id="future-page-title" className="future-title">
              Crypto Futures Trading
            </h1>
            <p className="future-coming-soon">Launching Soon</p>
            <p className="future-intro">
              Nexora is building an advanced futures trading ecosystem
              designed for professional traders and institutions. Our upcoming
              infrastructure will provide powerful market tools, intelligent
              execution systems, and advanced risk management capabilities for
              a secure and efficient trading experience.
            </p>
          </section>

          <section className="future-highlights-section" aria-label="Futures capability highlights">
            <h2 className="future-section-title">Core Capabilities In Development</h2>
            <div className="future-highlights-grid">
              {futuresHighlights.map((item) => (
                <article key={item.title} className="future-highlight-card">
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="future-expectation-section" aria-label="What to expect">
            <h2 className="future-section-title">What to Expect</h2>
            <ul className="future-expectation-grid">
              {futuresExpectations.map((item) => (
                <li key={item} className="future-expectation-item">{item}</li>
              ))}
            </ul>
          </section>

          <section className="future-waitlist" aria-label="Futures waitlist">
            <h2 className="future-section-title">Stay Updated</h2>
            <p>Receive launch updates when Nexora Futures becomes available.</p>
            <form className="future-form" onSubmit={handleSubmit}>
              <label htmlFor="future-email" className="future-sr-only">Email address</label>
              <input
                id="future-email"
                type="email"
                name="email"
                autoComplete="email"
                placeholder="Enter your email"
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
                className={`future-form-feedback ${submitStatus === "success" ? "future-success" : "future-error"}`}
                role="status"
                aria-live="polite"
              >
                {statusMessage}
              </p>
            )}
          </section>

          <p className="future-footer-note">
            Nexora Futures infrastructure is currently under development
            and will be introduced in a future release.
          </p>
        </Container>
      </main>
      <NewsletterSection />
      <NavigationSection />
      <BottomBar />
    </>
  );
};

export default Futures;
