import { Container } from "react-bootstrap";
import "../styles/cookie-policy.css";
import NewsletterSection from "../Components/home/NewsletterSection";
import NavigationSection from "../Components/layout/NavigationSection";
import BottomBar from "../Components/layout/BottomBar";

const CookiePolicy = () => {
  return (
    <>
      <section className="cookie-policy-page">
        <Container className="cookie-policy-wrap">
          <article className="cookie-policy-card">
            <h1 className="cookie-policy-title">
              Nexora Cookies Policy
            </h1>

            <section className="cookie-section">
              <h2>1. Introduction:</h2>
              <p>
                Nexora FZCO (&ldquo;we&rdquo;, &ldquo;us,&rdquo; or
                &ldquo;our&rdquo;) uses cookies and similar technologies
                (&ldquo;cookies&rdquo;) on our website and platform
                (collectively, the &ldquo;Site&rdquo;) to enhance your
                experience, understand usage patterns, and improve our services.
                This Cookies Policy explains what cookies are, how we use them,
                the types of cookies we employ, and how you can manage or
                disable them. By continuing to use Nexora, you consent
                to our use of cookies as described herein.
              </p>
            </section>

            <section className="cookie-section">
              <h2>2. What Are Cookies?</h2>
              <p>
                A cookie is a small text file placed on your device (computer,
                tablet, or mobile) when you visit a website. Cookies help us
                recognize your device on subsequent visits, distinguish you from
                other users, remember your preferences, and collect analytics
                data. Some cookies expire at the end of your browsing session
                (&ldquo;session cookies&rdquo;), while others remain on your
                device for a set period (&ldquo;persistent cookies&rdquo;).
              </p>
            </section>

            <section className="cookie-section">
              <h2>3. Why We Use Cookies</h2>
              <p>We use cookies to:</p>
              <h3>1. Enable Core Functionality</h3>
              <ul>
                <li>Authenticate users</li>
                <li>Maintain secure sessions</li>
                <li>Prevent fraudulent activity</li>
              </ul>
              <h3>2. Optimize and Personalize</h3>
              <ul>
                <li>Remember language, regional settings, and preferences</li>
                <li>Offer a tailored experience</li>
              </ul>
              <h3>3. Analyze and Improve</h3>
              <ul>
                <li>Monitor performance and load times</li>
                <li>Track visitor behaviour</li>
                <li>Identify popular features</li>
              </ul>
              <h3>4. Deliver Targeted Advertising (Where Applicable)</h3>
              <ul>
                <li>Provide relevant ads</li>
                <li>Work with advertising partners</li>
                <li>Measure campaign effectiveness</li>
              </ul>
            </section>

            <section className="cookie-section">
              <h2>4. Types Of Cookies We Use</h2>
              <div className="cookie-table-wrap">
                <table className="cookie-table">
                  <thead>
                    <tr>
                      <th>Cookie Category</th>
                      <th>Description &amp; Purpose</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Essential (Strictly Necessary)</td>
                      <td>
                        Required for the Site to function. These cookies
                        authenticate your session, enable secure logins, and
                        power core features. They cannot be disabled.
                      </td>
                    </tr>
                    <tr>
                      <td>Functional</td>
                      <td>
                        Remember your preferences (e.g., language or region) to
                        improve and customize your experience.
                      </td>
                    </tr>
                    <tr>
                      <td>Analytical/Performance</td>
                      <td>
                        Collect anonymous usage statistics (e.g., pages visited,
                        time spent) to help improve the Site.
                      </td>
                    </tr>
                    <tr>
                      <td>Tracking/Targeting</td>
                      <td>
                        Track browsing behaviour to deliver personalised ads and
                        measure effectiveness.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="cookie-section">
              <h2>5. Third-Party Cookies</h2>
              <p>
                Some cookies on Nexora are placed by trusted third-party
                service providers (e.g., Google Analytics, CDN partners,
                advertising networks). These third parties may recognize your
                device across websites and use that information for their own
                purposes. We do not control how these third parties use their
                cookies; please refer to their privacy policies.
              </p>
            </section>

            <section className="cookie-section">
              <h2>6. Managing And Disabling Cookies</h2>
              <h3>6.1 Browser Settings</h3>
              <p>You can manage or delete cookies via browser settings:</p>
              <ul>
                <li>
                  Chrome: Settings &rarr; Privacy and security &rarr; Cookies
                </li>
                <li>Firefox: Options &rarr; Privacy &amp; Security</li>
                <li>Safari: Preferences &rarr; Privacy</li>
                <li>Edge: Settings &rarr; Cookies and site permissions</li>
              </ul>

              <h3>6.2 Opt-Out Of Third-Party Tracking</h3>
              <ul>
                <li>Your Online Choices</li>
                <li>Network Advertising Initiative</li>
              </ul>

              <h3>6.3 Mobile Apps</h3>
              <p>
                Cookies function differently on mobile. Use device settings to
                manage tracking preferences.
              </p>

              <h3>6.4 Impact Of Disabling Cookies</h3>
              <ul>
                <li>Re-enter login credentials more often</li>
                <li>Some features may not function properly</li>
                <li>Reduced performance</li>
              </ul>
            </section>

            <section className="cookie-section">
              <h2>7. How Long Cookies Remain On Your Device</h2>
              <ul>
                <li>Session Cookies: Deleted when browser closes</li>
                <li>Persistent Cookies: Remain until expiry or deletion</li>
                <li>Third-Party Cookies: Based on provider timelines</li>
              </ul>
            </section>

            <section className="cookie-section">
              <h2>8. Updates To This Policy</h2>
              <p>
                We may update this Cookies Policy periodically. Updates will be
                reflected with a &ldquo;Last Updated&rdquo; date. Continued use
                of Nexora implies acceptance of changes.
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

export default CookiePolicy;
