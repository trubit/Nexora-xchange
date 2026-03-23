import LiveCryptoHomePage from "../Components/LiveCryptoHomePage";
import LogoRotatingSection from "../Components/logoRotationSection";
import "../styles/FirstSectionHome.css";
import { Card, Button, Container } from "react-bootstrap";
import { Link } from "react-router-dom";

// Homepage hero + live crypto section.
const FirstSectionHome = () => {
  return (
    <Card className="home-page bg-dark text-white min-vh-100 d-flex flex-column">
      <section className="hero-section">
        <Container fluid="xxl" className="hero-grid">
          <div className="hero-copy">
            <p className="hero-eyebrow">Trusted arbitrage infrastructure</p>
            <h1 className="display-4 fw-bold mb-3">
              First CEX to feature{" "}
              <span className="arbitrage-headline">arbitrage trading</span>
            </h1>

            <p className="fs-5 hero-subtitle">
              Trade cryptocurrencies across different exchanges through the
              TrusonXchanger Arbitrage Trading feature and capture price
              differentials with confidence.
            </p>

            <div className="hero-actions">
              <Button
                as={Link}
                to="/signup"
                variant="success"
                size="lg"
                className="hero-cta"
              >
                Trade Now
              </Button>
              <Button
                as={Link}
                to="/arbitrage"
                variant="outline-light"
                size="lg"
                className="hero-secondary"
              >
                Learn More
              </Button>
            </div>
          </div>

          <div className="hero-visual">
            <LogoRotatingSection />
          </div>
        </Container>
      </section>

      {/* LiveCryptoHomePage Integrated Below (in same background) */}
      <div className="live-crypto-section bg-dark py-5">
        <LiveCryptoHomePage />
      </div>
    </Card>
  );
};

export default FirstSectionHome;
