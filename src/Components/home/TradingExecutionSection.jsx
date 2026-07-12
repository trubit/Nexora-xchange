import { Button, Col, Container, Row } from "react-bootstrap";
import { Link } from "react-router-dom";
import tradingToolsVideo from "../../assets/trading-tools.mp4";
import orderDetailsVideo from "../../assets/order-details.mp4";
import "../../styles/TradingExecutionSection.css";

const topFeatures = [
  "Advanced charting tools",
  "Smart order routing",
  "Stop-loss and take-profit features",
  "Custom trading dashboard",
];

const bottomFeatures = [
  "Instantly monitor returns",
  "Asset diversification",
  "Risk mitigation features",
  "Quick trade adjustments",
];

const TradingExecutionSection = () => {
  return (
    <section className="txe-section">
      <Container fluid="xxl" className="txe-container">
        <header className="txe-header">
          <p className="txe-label">ORDER TYPES</p>
          <h2 className="txe-main-title">
            Optimal Trade Execution with Nexora
          </h2>
        </header>

        <div className="txe-block-card txe-block-card-top">
          <Row className="txe-block align-items-center g-4 g-xl-5">
            <Col lg={5}>
              <div className="txe-copy">
                <p className="txe-label">COMPREHENSIVE</p>
                <h3 className="txe-title">Cutting-edge Trading Tools</h3>
                <p className="txe-text">
                  Nexora provides robust strategies, technical analysis,
                  real-time data, and customisable alerts to help you stay ahead
                  in fast-moving markets.
                </p>
                <p className="txe-text">
                  Trade seamlessly across 15+ exchanges with fast execution and
                  real-time performance tracking that keeps every move visible.
                </p>
                <ul className="txe-feature-list">
                  {topFeatures.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <Button as={Link} to="/signup" className="txe-cta">
                  Sign up for free
                  <span aria-hidden="true">{"\u2192"}</span>
                </Button>
              </div>
            </Col>

            <Col lg={7}>
              <div className="txe-video-frame txe-video-frame-top">
                <video
                  className="txe-video"
                  src={tradingToolsVideo}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="auto"
                  disablePictureInPicture
                />
              </div>
            </Col>
          </Row>
        </div>

        <div className="txe-block-card txe-block-card-bottom">
          <Row className="txe-block align-items-center g-4 g-xl-5">
            <Col lg={5}>
              <div className="txe-video-frame txe-video-frame-bottom">
                <video
                  className="txe-video"
                  src={orderDetailsVideo}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="auto"
                  disablePictureInPicture
                />
              </div>
            </Col>

            <Col lg={7}>
              <div className="txe-copy txe-copy-right">
                <p className="txe-label">SMART TRACKING</p>
                <h3 className="txe-title">
                  Industry-leading Portfolio Management Tools
                </h3>
                <p className="txe-text">
                  Track your portfolio in real time, access detailed order
                  history, monitor funds, and view ROI insights from a single
                  streamlined dashboard.
                </p>
                <p className="txe-text">
                  Get customised recommendations that refine your approach,
                  improve strategy decisions, and minimise risk across trades.
                </p>
                <ul className="txe-feature-list">
                  {bottomFeatures.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <Button as={Link} to="/signup" className="txe-cta">
                  Sign up for free
                  <span aria-hidden="true">{"\u2192"}</span>
                </Button>
              </div>
            </Col>
          </Row>
        </div>
      </Container>
    </section>
  );
};

export default TradingExecutionSection;
