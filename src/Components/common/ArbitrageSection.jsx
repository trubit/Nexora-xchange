import React from "react";
import { Container, Row, Col, Card } from "react-bootstrap";
import "../../styles/ArbitrageSection.css";
import arbitrageIllustration from "../../assets/trading-logo.png";
import filterIcon from "../../assets/seamless-trading.webp";
import instantIcon from "../../assets/liquidity-accessibility-dark.webp";

const ArbitrageSection = () => (
  <section
    className="arbitrage-section-bg py-5"
    style={{ fontSize: "1.15rem" }}
  >
    <Container fluid>
      <Row
        className="align-items-center flex-column-reverse flex-md-row"
        style={{ minHeight: "70vh" }}
      >
        <Col md={7} className="arbitrage-content mb-5 mb-md-0">
          <div className="arbitrage-label mb-2">ARBITRAGE TRADING</div>
          <h2 className="arbitrage-title mb-3">
            Maximize Gains with Smart Arbitrage
          </h2>
          <p className="arbitrage-desc mb-4">
            Nexora empowers you to maximize your crypto gains by
            leveraging intelligent arbitrage strategies. Seamlessly identify and
            act on profitable opportunities across multiple exchanges and market
            conditionsâ€”all in one platform.
          </p>
          <Row className="g-4">
            <Col xs={12} sm={6} lg={5}>
              <Card className="arbitrage-feature-card h-100">
                <Card.Body className="d-flex flex-column align-items-start">
                  <img
                    src={instantIcon}
                    alt="Filtered Pairs"
                    className="arbitrage-feature-icon mb-3"
                  />
                  <Card.Title className="arbitrage-feature-title mb-2">
                    Filtered Pairs with Profit Margins
                  </Card.Title>
                  <Card.Text className="arbitrage-feature-desc">
                    Nexora identifies profitable crypto pairs across
                    exchanges using price differences and smart filtering.
                  </Card.Text>
                </Card.Body>
              </Card>
            </Col>
            <Col xs={12} sm={6} lg={5}>
              <Card className="arbitrage-feature-card h-100">
                <Card.Body className="d-flex flex-column align-items-start">
                  <img
                    src={filterIcon}
                    alt="Instant Order Execution"
                    className="arbitrage-feature-icon mb-3"
                  />
                  <Card.Title className="arbitrage-feature-title mb-2">
                    Instant Order Execution
                  </Card.Title>
                  <Card.Text className="arbitrage-feature-desc">
                    Users can buy from one exchange and sell on another
                    instantly with minimal delay, reducing missed opportunities
                    on Nexora.
                  </Card.Text>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Col>
        <Col
          md={5}
          className="d-flex justify-content-center align-items-center"
        >
          <img
            src={arbitrageIllustration}
            alt="Nexora Arbitrage Illustration"
            className="arbitrage-illustration"
            style={{ maxWidth: "600px", width: "100%" }}
          />
        </Col>
      </Row>
    </Container>
  </section>
);

export default ArbitrageSection;
