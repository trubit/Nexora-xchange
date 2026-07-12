import { Container } from "react-bootstrap";
import "../styles/cookie-banner.css";
import NewsletterSection from "../Components/home/NewsletterSection";
import NavigationSection from "../Components/layout/NavigationSection";
import BottomBar from "../Components/layout/BottomBar";

const CookieBanner = () => {
  const contactEmail = "support@nexora.io";
  return (
    <>
      <section className="cookie-banner-page">
        <Container className="cookie-banner-wrap">
          <article className="cookie-banner-card">
            <h1 className="cookie-banner-title">
              Cookie Policy | Nexora - Secure Crypto Trading Exchange
            </h1>
            <p className="cookie-banner-subtitle">
              Learn how Nexora uses cookies to enhance your experience,
              protect your privacy, and ensure compliance with global standards.
            </p>
            <p className="cookie-banner-intro">
              This Cookie Policy explains how Nexora uses cookies and
              similar technologies on our platform. By using Nexora, you
              consent to the use of cookies as described below.
            </p>

            <section className="cookie-section">
              <h2>Introduction</h2>
              <p>
                Nexora uses cookies to provide a secure, efficient, and
                personalized experience. Cookies help us remember your
                preferences, analyze site usage, and deliver relevant content.
              </p>
            </section>

            <section className="cookie-section">
              <h2>What Cookies Are</h2>
              <p>
                Cookies are small text files stored on your device by your
                browser. They allow websites to recognize your device, remember
                your actions, and enhance your browsing experience.
              </p>
            </section>

            <section className="cookie-section">
              <h2>Types of Cookies</h2>
              <ul>
                <li>Essential Cookies</li>
                <li>Functional Cookies</li>
                <li>Analytical Cookies</li>
                <li>Marketing & Tracking Cookies</li>
                <li>Third-Party Cookies</li>
              </ul>
            </section>

            <section className="cookie-section">
              <h2>Essential Cookies</h2>
              <p>
                These cookies are necessary for the platform to function and
                cannot be switched off. They enable core features such as
                security, account login, and transaction processing.
              </p>
              <table className="cookie-table">
                <thead>
                  <tr>
                    <th>Cookie Name</th>
                    <th>Purpose</th>
                    <th>Retention</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>session_id</td>
                    <td>User authentication, session management</td>
                    <td>Session</td>
                  </tr>
                  <tr>
                    <td>csrf_token</td>
                    <td>Security, CSRF protection</td>
                    <td>Session</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section className="cookie-section">
              <h2>Functional Cookies</h2>
              <p>
                Functional cookies remember your preferences and settings, such
                as language and region, to provide a customized experience.
              </p>
              <table className="cookie-table">
                <thead>
                  <tr>
                    <th>Cookie Name</th>
                    <th>Purpose</th>
                    <th>Retention</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>user_lang</td>
                    <td>Stores language preference</td>
                    <td>1 year</td>
                  </tr>
                  <tr>
                    <td>theme_mode</td>
                    <td>Stores dark/light mode preference</td>
                    <td>1 year</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section className="cookie-section">
              <h2>Analytical Cookies</h2>
              <p>
                Analytical cookies help us understand how users interact with
                Nexora, allowing us to improve performance and user
                experience.
              </p>
              <table className="cookie-table">
                <thead>
                  <tr>
                    <th>Cookie Name</th>
                    <th>Purpose</th>
                    <th>Retention</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>_ga</td>
                    <td>Google Analytics user tracking</td>
                    <td>2 years</td>
                  </tr>
                  <tr>
                    <td>_gid</td>
                    <td>Google Analytics session tracking</td>
                    <td>24 hours</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section className="cookie-section">
              <h2>Marketing & Tracking Cookies</h2>
              <p>
                These cookies are used to deliver relevant ads and track the
                effectiveness of marketing campaigns.
              </p>
              <table className="cookie-table">
                <thead>
                  <tr>
                    <th>Cookie Name</th>
                    <th>Purpose</th>
                    <th>Retention</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>_fbp</td>
                    <td>Facebook marketing/retargeting</td>
                    <td>3 months</td>
                  </tr>
                  <tr>
                    <td>_gcl_au</td>
                    <td>Google Ads conversion tracking</td>
                    <td>3 months</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section className="cookie-section">
              <h2>Third-Party Cookies</h2>
              <p>
                Third-party cookies are set by external services integrated into
                Nexora, such as analytics providers and social media
                platforms. These cookies are subject to the privacy policies of
                the respective providers.
              </p>
            </section>

            <section className="cookie-section">
              <h2>User Consent</h2>
              <p>
                By using Nexora, you consent to the use of cookies as
                described in this policy. You can manage your preferences at any
                time.
              </p>
            </section>

            <section className="cookie-section">
              <h2>Managing Cookie Preferences</h2>
              <p>
                You can manage or withdraw your cookie consent using the cookie
                settings panel or by adjusting your browser settings.
              </p>
            </section>

            <section className="cookie-section">
              <h2>Browser Cookie Controls</h2>
              <p>
                Most browsers allow you to control cookies through their
                settings. Refer to your browser’s help section for instructions
                on managing cookies.
              </p>
            </section>

            <section className="cookie-section">
              <h2>Data Protection</h2>
              <p>
                Nexora implements robust security measures to protect
                your data, including encryption, access controls, and regular
                security audits.
              </p>
            </section>

            <section className="cookie-section">
              <h2>Cookie Retention</h2>
              <p>
                Cookies are retained for varying periods depending on their type
                and purpose. See the tables above for specific retention
                periods.
              </p>
            </section>

            <section className="cookie-section">
              <h2>Updates to Cookie Policy</h2>
              <p>
                We may update this Cookie Policy to reflect changes in
                technology, law, or our practices. Updates will be posted on
                this page.
              </p>
            </section>

            <section className="cookie-section">
              <h2>Contact Information</h2>
              <p>
                For questions about this Cookie Policy, contact us at:{" "}
                <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
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

export default CookieBanner;
