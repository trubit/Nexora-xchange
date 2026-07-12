import { Container, Row, Col, Card } from "react-bootstrap";
import "../../styles/FeaturesSection.css";

import iconFunding from "../../assets/dallerss.png";
import iconExecution from "../../assets/exchange.png";
import iconWithdraw from "../../assets/withdrawing.png";

import imgFunding from "../../assets/orderForm1.webp";
import imgExecution from "../../assets/bestExOrder1.webp";
import imgWithdraw from "../../assets/orderHistory.webp";

const FeatureCard = ({ title, description, iconSrc, imageSrc }) => (
  <Card className="tx-feature-card h-100">
    <Card.Body className="tx-feature-body">
      <div className="tx-feature-top">
        <h3 className="tx-feature-title">{title}</h3>
        <div className="tx-feature-iconWrap" aria-hidden="true">
          <img
            className="tx-feature-icon"
            src={iconSrc}
            alt=""
            draggable="false"
          />
        </div>
      </div>
      <span className="tx-feature-divider" aria-hidden="true" />
      <div className="tx-feature-desc">{description}</div>
      <div className="tx-feature-imageFrame" aria-hidden="true">
        <img
          className="tx-feature-image"
          src={imageSrc}
          alt=""
          draggable="false"
        />
      </div>
    </Card.Body>
  </Card>
);

const FeaturesSection = () => (
  <section className="tx-features">
    <Container className="tx-features-container">
      <div className="tx-features-shell">
        <div className="tx-features-header">
          <div className="tx-features-label">
            EFFORTLESS TRANSACTIONS FROM DEPOSIT TO WITHDRAWAL
          </div>
          <h2 className="tx-features-heading">
            Effortless Arbitrage
            <br />
            Trading With Nexora
          </h2>
        </div>

        <Row className="g-3 g-md-4 tx-features-grid">
          <Col xs={12} sm={6} lg={4} className="tx-col">
            <FeatureCard
              title="Instant Funding"
              description="Deposit funds effortlessly using cards, bank transfers, or crypto wallets, ensuring seamless integration with Nexora."
              iconSrc={iconFunding}
              imageSrc={imgFunding}
            />
          </Col>
          <Col xs={12} sm={6} lg={4} className="tx-col">
            <FeatureCard
              title="Smart Execution"
              description="Trade on price discrepancies across exchanges, leveraging market insights, price trends, and execution tools."
              iconSrc={iconExecution}
              imageSrc={imgExecution}
            />
          </Col>
          <Col xs={12} sm={6} lg={4} className="tx-col">
            <FeatureCard
              title="Easy Withdrawals"
              description="Withdraw profits securely to your preferred wallet or account with instant processing and complete transparency."
              iconSrc={iconWithdraw}
              imageSrc={imgWithdraw}
            />
          </Col>
        </Row>
      </div>
    </Container>
  </section>
);

export default FeaturesSection;
