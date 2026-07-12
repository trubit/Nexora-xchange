import { useState } from "react";
import { Container } from "react-bootstrap";
import NewsletterSection from "../Components/home/NewsletterSection";
import NavigationSection from "../Components/layout/NavigationSection";
import BottomBar from "../Components/layout/BottomBar";
import { httpClient } from "../services/httpClient";
import "../styles/subscription.css";

const subscriptionFeatures = [
  {
    title: "VIP Trading Access",
    description:
      "Priority access channels and premium participation lanes are being prepared for high-performance traders and strategic clients.",
  },
  {
    title: "Institutional Analytics",
    description:
      "Advanced analytics modules are in development to deliver deeper execution, market behaviour, and performance intelligence.",
  },
  {
    title: "Priority Infrastructure",
    description:
      "Membership tiers will include enhanced platform prioritisation designed for reliable order flow and faster operational response.",
  },
  {
    title: "Premium Liquidity Access",
    description:
      "Expanded routing and curated liquidity access are being built to support execution quality for professional trading workflows.",
  },
  {
    title: "Advanced Portfolio Insights",
    description:
      "Subscribers will gain tools for portfolio-level attribution, risk tracking, and strategic monitoring across active positions.",
  },
  {
    title: "Dedicated Client Support",
    description:
      "Members will receive priority service channels with dedicated support pathways for institutional and high-value client needs.",
  },
];

const Subscription = () => {
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
          waitlistType: "subscription",
        });
      } catch (error) {
        if (error.status === 404) {
          response = await httpClient.post("/api/contact-us", {
            fullName: "Subscription Waitlist User",
            email: sanitizedEmail,
            subject: "Subscription Waitlist Request",
            message: "Please add this email to the Nexora Subscription waitlist.",
          });
        } else {
          throw error;
        }
      }
      if (response.data?.success) {
        setSubmitStatus("success");
        setStatusMessage("Thank you. You have been added to the Nexora Subscription waitlist.");
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
      <main className="sub-page" aria-labelledby="sub-page-title">
        <Container className="sub-container">
          <section className="sub-hero-card" aria-label="Subscription services coming soon">
            <p className="sub-kicker">Enterprise Membership Infrastructure</p>
            <h1 id="sub-page-title" className="sub-title">
              Premium Subscription Services
            </h1>
            <p className="sub-coming-soon">COMING SOON</p>
            <p className="sub-intro">
              Nexora is preparing premium membership infrastructure to
              support professional traders and institutions. Subscription
              services will unlock advanced platform capabilities, including
              reduced trading fees, VIP trading access, advanced analytics,
              priority withdrawals, and dedicated support.
            </p>
            <p className="sub-intro">
              Upcoming membership tiers are being designed to provide
              institutional insights, premium API limits, and exclusive market
              intelligence tailored to high-performance digital asset trading.
            </p>
          </section>

          <section className="sub-feature-section" aria-label="Membership features">
            <h2 className="sub-section-title">Planned Membership Capabilities</h2>
            <div className="sub-feature-grid">
              {subscriptionFeatures.map((feature) => (
                <article key={feature.title} className="sub-feature-card">
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="sub-waitlist" aria-label="Join early access">
            <h2 className="sub-section-title">Join Early Access</h2>
            <p>
              Join the waitlist to receive updates on subscription release
              phases and membership availability.
            </p>
            <form className="sub-form" onSubmit={handleSubmit}>
              <label htmlFor="subscription-email" className="sub-sr-only">Email address</label>
              <input
                id="subscription-email"
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
                {isSubmitting ? "Sending..." : "Join Waitlist"}
              </button>
            </form>
            {submitStatus && (
              <p
                className={`sub-form-feedback ${submitStatus === "success" ? "sub-success" : "sub-error"}`}
                role="status"
                aria-live="polite"
              >
                {statusMessage}
              </p>
            )}
          </section>

          <p className="sub-footer-note">
            Nexora Subscription Services are currently in development
            and will become available in an upcoming release.
          </p>
        </Container>
      </main>
      <NewsletterSection />
      <NavigationSection />
      <BottomBar />
    </>
  );
};

export default Subscription;
