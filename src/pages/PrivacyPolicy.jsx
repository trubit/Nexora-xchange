import { Container } from "react-bootstrap";
import "../styles/privacy-policy.css";
import NewsletterSection from "../Components/home/NewsletterSection";
import NavigationSection from "../Components/layout/NavigationSection";
import BottomBar from "../Components/layout/BottomBar";

const PrivacyPolicy = () => {
  const contactEmail = "your@email.com";

  return (
    <>
      <section className="privacy-policy-page">
        <Container className="privacy-policy-wrap">
          <article className="privacy-policy-card">
            <h1 className="privacy-policy-title">
              Privacy Policy | Nexora - Secure Crypto Trading Exchange
            </h1>
            <p className="privacy-policy-subtitle">
              Read Nexora&apos;s Privacy Policy to learn how we protect
              your data. We prioritize security, privacy, and transparency for a
              safe crypto trading experience.
            </p>
            <p className="privacy-policy-intro">
              Welcome to Nexora Mobile App. Your privacy is important to
              us, and we are committed to protecting your personal data while
              providing a secure and seamless cryptocurrency trading experience.
              This Privacy Policy explains how we collect, use, store, and
              protect your information when you use our app. By using
              Nexora, you agree to the terms outlined below.
            </p>

            <section className="policy-section">
              <h2>1. Information We Collect</h2>
              <p>
                When you use the Nexora Mobile App, we may collect the
                following types of information:
              </p>
              <h3>A. Personal Information (Provided by You)</h3>
              <ul>
                <li>
                  Name, email address and other contact details when you sign
                  up.
                </li>
                <li>
                  Identity verification documents (e.g., government-issued ID,
                  proof of address) for KYC compliance.
                </li>
                <li>
                  Payment details (such as cryptocurrency wallet addresses) for
                  transactions.
                </li>
                <li>
                  Facial Data: During identity verification, you may be asked to
                  take a selfie or video for verification purposes. This data is
                  used solely to confirm your identity and prevent fraudulent
                  activity.
                </li>
                <li>User preferences, language, and communication choices.</li>
              </ul>
              <h3>B. Automatically Collected Information</h3>
              <ul>
                <li>
                  Device &amp; Usage Data: IP address, device model, operating
                  system, app version, and browsing activity.
                </li>
                <li>
                  Transaction Information: Deposits, withdrawals, and trades.
                </li>
                <li>
                  Cookies &amp; Tracking Technologies:
                  <ul>
                    <li>Necessary cookies (login, security)</li>
                    <li>Analytical cookies (optimization)</li>
                    <li>Marketing cookies (prospecting)</li>
                  </ul>
                </li>
              </ul>
            </section>

            <section className="policy-section">
              <h2>2. How We Use Your Information</h2>
              <ul>
                <li>Account Creation &amp; Verification</li>
                <li>Transaction Processing</li>
                <li>Security &amp; Fraud Prevention</li>
                <li>Customer Support</li>
                <li>App Optimization &amp; Analytics</li>
              </ul>
              <p>
                Additional:
                <br />
                Automated decisions (identity, fraud prevention, risk scoring)
                <br />
                Legal bases: consent, contract, legitimate interest, legal
                compliance
              </p>
            </section>

            <section className="policy-section">
              <h2>3. How We Protect Your Information</h2>
              <ul>
                <li>End-to-End Encryption</li>
                <li>Multi-Layer Security Protocols</li>
                <li>Two-Factor Authentication (2FA)</li>
                <li>Regular Security Audits</li>
                <li>RBAC access control</li>
                <li>IDS/IPS monitoring</li>
                <li>Data encryption at rest</li>
                <li>Secure backup and recovery</li>
                <li>Compliance with VARA, PDPL, and local laws</li>
                <li>Employee security training</li>
              </ul>
            </section>

            <section className="policy-section">
              <h2>4. Sharing of Information</h2>
              <p>We do not sell your data. We may share with:</p>
              <ul>
                <li>Regulatory Authorities</li>
                <li>Trusted Partners</li>
                <li>Service Providers</li>
              </ul>
            </section>

            <section className="policy-section">
              <h2>5. Your Privacy Choices &amp; Rights</h2>
              <ul>
                <li>Access &amp; Update Information</li>
                <li>Opt-Out of Marketing</li>
                <li>Request Data Deletion</li>
              </ul>
              <p>
                Additional:
                <br />
                Request process via email/form
                <br />
                Response time: 30 days
                <br />
                Right to contact Data Protection Authority
              </p>
            </section>

            <section className="policy-section">
              <h2>6. Data Retention Policy</h2>
              <p>We retain data (typically 5 years) to:</p>
              <ul>
                <li>Meet legal obligations</li>
                <li>Resolve disputes</li>
                <li>Maintain services</li>
              </ul>
              <p>Includes:</p>
              <ul>
                <li>Automatic deletion after retention period</li>
              </ul>
            </section>

            <section className="policy-section">
              <h2>7. Third-Party Links &amp; Services</h2>
              <p>
                Nexora may link to external platforms. We are not
                responsible for their privacy practices.
              </p>
            </section>

            <section className="policy-section">
              <h2>8. Children&apos;s Privacy</h2>
              <ul>
                <li>Not intended for users under 18</li>
                <li>No intentional data collection from minors</li>
              </ul>
            </section>

            <section className="policy-section">
              <h2>9. Data Breach and Incident</h2>
              <ul>
                <li>Users notified without delay</li>
                <li>Includes risk explanation and recommended actions</li>
              </ul>
            </section>

            <section className="policy-section">
              <h2>10. Updates to This Privacy Policy</h2>
              <ul>
                <li>Updates based on legal or system changes</li>
                <li>Notifications via email or in-app</li>
              </ul>
            </section>

            <section className="policy-section">
              <h2>11. Facial Data &amp; Identity Verification</h2>
              <p>Uses Veriff (or similar provider)</p>
              <p>Live selfie/video required</p>
              <p>Includes:</p>
              <ul>
                <li>Purpose: identity verification</li>
                <li>Retention: up to 30 days</li>
                <li>Sharing: only with verification provider</li>
                <li>Security: encrypted transmission</li>
                <li>User rights for deletion</li>
              </ul>
            </section>

            <section className="policy-section">
              <h2>12. Contact Us</h2>
              <p className="policy-contact">
                &#128231; Email:{" "}
                <a href={`mailto:${contactEmail}`}>mailto:{contactEmail}</a>
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

export default PrivacyPolicy;
