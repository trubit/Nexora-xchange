import { Col, Container, Row } from "react-bootstrap";
import { Link } from "react-router-dom";
import "bootstrap-icons/font/bootstrap-icons.css";
import NexoraLogo from "../common/NexoraLogo";
import "../../styles/NavigationSection.css";

const companyAndLegalLinks = [
  { label: "About Us", path: "/about" },
  { label: "Blog", path: "/blog" },
  { label: "Privacy Policy", path: "/privacy-policy" },
  { label: "Cookie Policy", path: "/cookie-policy" },
  { label: "Compliance Policy", path: "/compliance-policy" },
  { label: "Whistleblowing Policy", path: "/whistleblowing-policy" },
  { label: "Anti-Bribery Policy", path: "/anti-bribery-policy" },
  { label: "User Agreement Disclaimer", path: "/user-agreement" },
  { label: "Cookie Banner Content", path: "/cookie-banner" },
  {
    label: "Electronic Communications Policy",
    path: "/electronic-communications",
  },
];

const tradingLinks = [
  { label: "Virtual Asset Listing Policy", path: "/asset-listing-policy" },
  { label: "Trading Rules", path: "/trading-rules" },
  { label: "Liquidation Guard Terms", path: "/liquidation-guard" },
  { label: "Fee Schedule", path: "/fee-schedule" },
];

const supportLinks = [
  { label: "Contact", path: "/contact" },
  { label: "FAQs", path: "/#faqs" },
];

const communityLinks = [
  { label: "Facebook", href: "https://facebook.com", icon: "bi-facebook" },
  { label: "Instagram", href: "https://instagram.com", icon: "bi-instagram" },
  {
    label: "CoinMarketCap",
    href: "https://coinmarketcap.com",
    icon: "bi-c-circle",
  },
  { label: "Twitter", href: "https://twitter.com", icon: "bi-twitter-x" },
  { label: "Telegram", href: "https://telegram.org", icon: "bi-telegram" },
  { label: "Discord", href: "https://discord.com", icon: "bi-discord" },
  { label: "Medium", href: "https://medium.com", icon: "bi-medium" },
];

const NavigationSection = ({ workEmail = "support@nexora.io" }) => {
  const mailToEmail = "nexora@gmail.com";
  const emailComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(mailToEmail)}`;
  return (
    <footer className="nav-section">
      <div className="nav-glow-top" />
      <Container className="nav-container">
        <Row className="nav-grid">
          <Col xs={12} lg={4} className="nav-brand-col">
            <div className="nav-brand-column">
              <Link to="/" className="nav-logo-link">
                <NexoraLogo size={36} />
              </Link>
              <p className="nav-brand-copy">
                Experience the next generation of digital asset trading with our
                advanced, secure, and user-centric interface. Engineered for
                precision and speed.
              </p>
              <div className="nav-badge-wrapper">
                <span className="nav-badge">
                  A Project By Nexora S.R.O
                </span>
              </div>
              <div className="nav-email-block">
                <h3 className="nav-column-title nav-email-title">
                  Global Support
                </h3>
                <a
                  className="nav-email-link"
                  href={emailComposeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <i className="bi bi-envelope-at me-2"></i>
                  {workEmail}
                </a>
              </div>
            </div>
          </Col>

          <Col xs={12} sm={6} md={4} lg={3}>
            <div className="nav-links-column">
              <h3 className="nav-column-title">Company &amp; Legal</h3>
              <nav aria-label="Company and legal links">
                {companyAndLegalLinks.map((item) => (
                  <Link
                    key={item.path}
                    className="nav-link-item"
                    to={item.path}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </Col>

          <Col xs={12} sm={6} md={4} lg={3}>
            <div className="nav-links-column">
              <h3 className="nav-column-title">Trading Policies</h3>
              <nav aria-label="Trading and exchange links" className="mb-4">
                {tradingLinks.map((item) => (
                  <Link
                    key={item.path}
                    className="nav-link-item"
                    to={item.path}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>

              <h3 className="nav-column-title nav-support-title">
                Support Resources
              </h3>
              <nav aria-label="Support links">
                {supportLinks.map((item) =>
                  item.path.startsWith("/#") ? (
                    <a
                      key={item.path}
                      className="nav-link-item"
                      href={item.path}
                    >
                      {item.label}
                    </a>
                  ) : (
                    <Link
                      key={item.path}
                      className="nav-link-item"
                      to={item.path}
                    >
                      {item.label}
                    </Link>
                  ),
                )}
              </nav>
            </div>
          </Col>

          <Col xs={12} md={4} lg={2}>
            <div className="nav-links-column community-col">
              <h3 className="nav-column-title">Join Community</h3>
              <div className="nav-community-grid">
                {communityLinks.map((item) => (
                  <a
                    key={item.label}
                    className="nav-community-box"
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={item.label}
                  >
                    <i
                      className={`nav-community-icon bi ${item.icon}`}
                      aria-hidden
                    />
                  </a>
                ))}
              </div>
            </div>
          </Col>
        </Row>

        <div className="nav-divider" />

        <Row className="nav-footer-bottom">
          <Col xs={12} className="text-center">
            <p className="nav-tagline">Empowering the future of finance.</p>
          </Col>
        </Row>
      </Container>
    </footer>
  );
};

export default NavigationSection;
