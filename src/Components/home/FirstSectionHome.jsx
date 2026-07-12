import LiveCryptoHomePage from "../common/LiveCryptoHomePage";
import LogoRotatingSection from "../common/logoRotationSection";
import "../../styles/FirstSectionHome.css";
import { Button, Container } from "react-bootstrap";
import { Link } from "react-router-dom";

// Homepage hero + live crypto section.
const FirstSectionHome = () => {
  return (
    <section className="home-page bg-dark text-white min-vh-100 d-flex flex-column">
      <section className="hero-section">
        <Container fluid="xxl">
          <div className="hero-shell">
            <div className="hero-grid">
              <div className="hero-copy">
                <p className="hero-eyebrow">Trusted arbitrage infrastructure</p>
                <h1 className="hero-title">
                  First CEX to feature{" "}
                  <span className="arbitrage-headline">arbitrage trading</span>
                </h1>

                <p className="hero-subtitle">
                  Trade cryptocurrencies across different exchanges through the
                  Nexora Arbitrage Trading feature and capture price
                  differentials with confidence.
                </p>

                <div className="hero-highlights">
                  <span>30+ exchanges connected</span>
                  <span>Real-time execution</span>
                  <span>Institution-grade tooling</span>
                </div>

                <div className="hero-actions">
                  <Button
                    as={Link}
                    to="/signup"
                    variant="success"
                    size="lg"
                    className="hero-cta"
                  >
                    Trade now
                  </Button>
                  <Button
                    as={Link}
                    to="/arbitrage"
                    variant="outline-light"
                    size="lg"
                    className="hero-secondary"
                  >
                    Learn more
                  </Button>
                </div>
              </div>

              <div className="hero-visual">
                <div className="hero-visual-frame">
                  <LogoRotatingSection />
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* LiveCryptoHomePage Integrated Below (in same background) */}
      <div className="live-crypto-section bg-dark">
        <Container fluid="xxl" className="live-crypto-shell">
          <LiveCryptoHomePage />
        </Container>
      </div>
    </section>
  );
};

export default FirstSectionHome;
