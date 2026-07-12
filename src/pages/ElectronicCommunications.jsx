import { Container } from "react-bootstrap";
import "../styles/electronic-communication.css";
import NewsletterSection from "../Components/home/NewsletterSection";
import NavigationSection from "../Components/layout/NavigationSection";
import BottomBar from "../Components/layout/BottomBar";

const ElectronicCommunications = () => {
  const contactEmail = "nexora@gmail.com";

  return (
    <>
      <section className="ec-page">
        <Container className="ec-wrap">
          <article className="ec-card">
            <h1 className="ec-title">
              Electronic Communications Policy | Nexora
            </h1>
            <p className="ec-subtitle">
              This policy explains how Nexora delivers electronic
              notices, security alerts, and legal communications to clients.
            </p>
            <p className="ec-intro">
              By creating or using a Nexora account, you consent to
              receiving required operational, compliance, and legal
              communications electronically. Electronic delivery supports
              secure, timely, and auditable communication for digital asset
              services.
            </p>

            <section className="ec-section">
              <h2>1. Introduction</h2>
              <p>
                Nexora communicates with clients through approved
                digital channels, including in-app notifications, registered
                email, and verified phone messaging for security events.
              </p>
            </section>

            <section className="ec-section">
              <h2>2. Electronic Consent</h2>
              <p>
                You agree that all notices, disclosures, statements, and
                updates delivered electronically satisfy legal communication
                requirements.
              </p>
            </section>

            <section className="ec-section">
              <h2>3. Email Communication</h2>
              <ul>
                <li>Account onboarding and verification updates</li>
                <li>Security alerts and suspicious activity notices</li>
                <li>Compliance and risk-related correspondence</li>
                <li>Material policy or terms updates</li>
              </ul>
            </section>

            <section className="ec-section">
              <h2>4. Account Notifications</h2>
              <ul>
                <li>One-time password (OTP) delivery and validation prompts</li>
                <li>Sign-in attempts and device access confirmations</li>
                <li>Trade confirmations and order status updates</li>
                <li>Deposit and withdrawal notifications</li>
                <li>Critical account restriction or recovery notices</li>
              </ul>
            </section>

            <section className="ec-section">
              <h2>5. Security Responsibilities</h2>
              <p>
                Clients must maintain secure access to their email and phone
                channels, safeguard credentials, and promptly report suspected
                account compromise.
              </p>
            </section>

            <section className="ec-section">
              <h2>6. Communication Preferences</h2>
              <p>
                Marketing preferences may be adjusted in account settings where
                available. Service, security, legal, and compliance
                communications remain mandatory and cannot be fully disabled.
              </p>
            </section>

            <section className="ec-section">
              <h2>7. Delivery Failures</h2>
              <p>
                Nexora is not liable for communication failures caused
                by incorrect, outdated, blocked, or inaccessible client contact
                details.
              </p>
            </section>

            <section className="ec-section">
              <h2>8. Electronic Signature Validity</h2>
              <p>
                Electronic acknowledgements, clicks, submissions, and consent
                actions performed through your authenticated account are legally
                valid and enforceable.
              </p>
            </section>

            <section className="ec-section">
              <h2>9. Client Responsibilities</h2>
              <ul>
                <li>Keep email and phone records accurate and current</li>
                <li>Review account communications regularly</li>
                <li>Maintain device and mailbox security controls</li>
                <li>Notify support immediately of unauthorized activity</li>
              </ul>
            </section>

            <section className="ec-section">
              <h2>10. Legal Acceptance</h2>
              <p>
                Continued use of Nexora constitutes acceptance of this
                electronic communications framework and any subsequent updates.
              </p>
            </section>

            <section className="ec-section">
              <h2>11. Contact Information</h2>
              <p className="ec-contact">
                Email: <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
              </p>
            </section>
          </article>
        </Container>
      </section>
      <NewsletterSection />
      <NavigationSection />
      <BottomBar />
    </>
  );
};

export default ElectronicCommunications;
