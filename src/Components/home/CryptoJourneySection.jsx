import { Container, Row, Col } from "react-bootstrap";
import "../../styles/CryptoJourneySection.css";

import mainLogo from "../../assets/mainLogo.png";

import imgHuman from "../../assets/human.png";
import imgWithdrawing from "../../assets/withdrawing.png";
import imgExchange from "../../assets/exchange.png";
import imgTrading from "../../assets/trading 1.png";

import binanceLogo from "../../assets/binance-logo.png";
import krakenLogo from "../../assets/kraken-logo.png";
import kucoinLogo from "../../assets/kucoin-logo.png";
import bitfinexLogo from "../../assets/bitfinex-logo.png";
import coinbaseLogo from "../../assets/coinbase-coin-logo.png";

const journeyCards = [
  {
    title: "Register with Email",
    description: "Secure your account with just your email",
    iconSrc: imgHuman,
  },
  {
    title: "Buy crypto with fiat",
    description:
      "Convert traditional currency into digital assets effortlessly",
    iconSrc: imgWithdrawing,
  },
  {
    title: "Buy crypto on the platform",
    description: "Explore and purchase cryptocurrencies hassle-free",
    iconSrc: imgExchange,
  },
  {
    title: "Enjoy stress-free trading",
    description:
      "Dive into the crypto world and embrace its potential for growth and innovation",
    iconSrc: imgTrading,
  },
];

const exchangeLogos = [
  binanceLogo,
  krakenLogo,
  kucoinLogo,
  bitfinexLogo,
  coinbaseLogo,
];

const BarIndicator = ({ height, variant }) => (
  <div
    className={`cj-bar cj-bar-${variant}`}
    style={{ height }}
    aria-hidden="true"
  />
);

const LightCard = ({ title, description, iconSrc }) => (
  <div className="cj-card">
    <div className="cj-icon-wrap">
      <img src={iconSrc} alt="" draggable="false" />
    </div>
    <div className="cj-card-title">{title}</div>
    <div className="cj-card-desc">{description}</div>
  </div>
);

const DarkSideCard = ({ title, description, bars }) => (
  <div className="cj-dark-card">
    <div className="cj-dark-card-title">{title}</div>
    <div className="cj-dark-card-desc">{description}</div>
    <div className="cj-bar-row">
      {bars.map((bar, i) => (
        <BarIndicator key={i} height={bar.height} variant={bar.variant} />
      ))}
    </div>
    <div className="cj-logos-row">
      {exchangeLogos.map((logo, i) => (
        <img key={i} src={logo} alt="" draggable="false" />
      ))}
    </div>
  </div>
);

const CryptoJourneySection = () => {
  const leftBars = [
    { height: 40, variant: "green" },
    { height: 56, variant: "yellow" },
    { height: 32, variant: "blue" },
    { height: 72, variant: "red" },
    { height: 48, variant: "green" },
  ];

  const rightBars = [
    { height: 48, variant: "yellow" },
    { height: 64, variant: "green" },
    { height: 36, variant: "blue" },
    { height: 80, variant: "red" },
    { height: 52, variant: "green" },
  ];

  return (
    <section>
      {/* Light Block */}
      <div className="cj-light">
        <Container className="cj-container">
          <div className="cj-shell">
            <div className="cj-header">
              <div className="cj-label">SEAMLESS CRYPTO MANAGEMENT</div>
              <h2 className="cj-heading">Start Your Crypto Journey</h2>
            </div>
            <Row className="g-4">
              {journeyCards.map((card, idx) => (
                <Col key={idx} xs={12} sm={6} lg={3}>
                  <LightCard
                    title={card.title}
                    description={card.description}
                    iconSrc={card.iconSrc}
                  />
                </Col>
              ))}
            </Row>
          </div>
        </Container>
      </div>

      {/* Dark Block */}
      <div className="cj-dark">
        <Container className="cj-container">
          <div className="cj-shell">
            <div className="cj-header">
              <div className="cj-label">MAXIMIZE MARKET MOVES</div>
              <h2 className="cj-heading">
                Earn from every crypto
                <br />
                trading opportunity.
              </h2>
            </div>
            <Row className="align-items-center g-4">
              <Col xs={12} lg={4}>
                <DarkSideCard
                  title="Low Trading Charges"
                  description="Innovative trading solution with extensive support at lower order and withdrawal fees"
                  bars={leftBars}
                />
              </Col>
              <Col xs={12} lg={4}>
                <div className="cj-logo-wrap">
                  <img
                    className="cj-logo"
                    src={mainLogo}
                    alt="Nexora"
                    draggable="false"
                  />
                </div>
              </Col>
              <Col xs={12} lg={4}>
                <DarkSideCard
                  title="Fast trading servers"
                  description="Quickly measure price differences across various exchanges for accelerated deal execution."
                  bars={rightBars}
                />
              </Col>
            </Row>
          </div>
        </Container>
      </div>
    </section>
  );
};

export default CryptoJourneySection;
