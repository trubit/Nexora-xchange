import { useState } from "react";
import { Container } from "react-bootstrap";
import NewsletterSection from "../home/NewsletterSection";
import NavigationSection from "../layout/NavigationSection";
import BottomBar from "../layout/BottomBar";
import { httpClient } from "../../services/httpClient";
import "../../styles/sport.css";

const sportHighlights = [
  {
    title: "Live Event Intelligence",
    description: "Access real-time event information and market activity.",
  },
  {
    title: "Smart Market Insights",
    description: "Advanced prediction tools and intelligent data analysis.",
  },
  {
    title: "Secure Trading Environment",
    description: "Institutional-grade infrastructure focused on transparency and security.",
  },
  {
    title: "Real-Time Data",
    description: "Instant market updates and event tracking systems.",
  },
];

const upcomingFeatures = [
  "Live event tracking",
  "Prediction systems",
  "Real-time statistics",
  "Premium market analysis",
  "Event intelligence",
  "Performance insights",
  "Secure trading environment",
  "Mobile accessibility",
];

const Spot = () => {
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
        fullName: "Sports Waitlist User",
        email: sanitizedEmail,
        subject: "Sports Trading Early Access Request",
        message: "Please add this email to the Nexora Sports early access list.",
      });
      if (response.data?.success) {
        setSubmitStatus("success");
        setStatusMessage("Thank you. You have joined the Nexora Sports early access list.");
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
      <main className="sport-page" aria-labelledby="sport-page-title">
        <Container className="sport-container">
          <section className="sport-hero-card" aria-label="Sports trading launching soon">
            <p className="sport-kicker">Market Intelligence Infrastructure</p>
            <h1 id="sport-page-title" className="sport-title">
              Sports Trading &amp; Prediction Hub
            </h1>
            <p className="sport-coming-soon">Launching Soon</p>
            <p className="sport-intro">
              Nexora is preparing an innovative sports prediction and
              trading environment designed to combine market intelligence with
              engaging trading experiences. Users will gain access to a secure
              ecosystem offering real-time market opportunities and data-driven
              insights.
            </p>
          </section>

          <section className="sport-highlights-section" aria-label="Sports trading capability highlights">
            <h2 className="sport-section-title">Core Capabilities In Development</h2>
            <div className="sport-highlights-grid">
              {sportHighlights.map((item) => (
                <article key={item.title} className="sport-highlight-card">
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="sport-features-section" aria-label="Upcoming features">
            <h2 className="sport-section-title">Upcoming Features</h2>
            <ul className="sport-features-grid">
              {upcomingFeatures.map((item) => (
                <li key={item} className="sport-feature-item">{item}</li>
              ))}
            </ul>
          </section>

          <section className="sport-waitlist" aria-label="Sports early access">
            <h2 className="sport-section-title">Stay Updated</h2>
            <p>Receive launch updates as Nexora Sports progresses towards release.</p>
            <form className="sport-form" onSubmit={handleSubmit}>
              <label htmlFor="sport-email" className="sport-sr-only">Email address</label>
              <input
                id="sport-email"
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
                {isSubmitting ? "Sending..." : "Join Early Access"}
              </button>
            </form>
            {submitStatus && (
              <p
                className={`sport-form-feedback ${submitStatus === "success" ? "sport-success" : "sport-error"}`}
                role="status"
                aria-live="polite"
              >
                {statusMessage}
              </p>
            )}
          </section>

          <p className="sport-footer-note">
            Nexora Sports ecosystem is currently in development and
            will become available in an upcoming release.
          </p>
        </Container>
      </main>
      <NewsletterSection />
      <NavigationSection />
      <BottomBar />
    </>
  );
};

export default Spot;
