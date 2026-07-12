import { Container } from "react-bootstrap";
import "../styles/trading-rules.css";
import NewsletterSection from "../Components/home/NewsletterSection";
import NavigationSection from "../Components/layout/NavigationSection";
import BottomBar from "../Components/layout/BottomBar";

const TradingRules = () => {
  return (
    <>
      <section className="tr-page">
        <Container className="tr-wrap">
          <article className="tr-card">
            <h1 className="tr-title">
              Trading Rules | Nexora
            </h1>
            <p className="tr-subtitle">
              Formal trading conduct and market integrity standards for all
              participants on Nexora.
            </p>
            <p className="tr-intro">
              Nexora operates a fairness-first trading environment. All
              clients, professional participants, and institutional users must
              follow these rules to maintain transparent execution and orderly
              digital asset markets.
            </p>

            <section className="tr-section">
              <h2>1. Market Conduct</h2>
              <p>
                Users must trade honestly, maintain lawful account usage, and
                avoid actions that distort pricing, execution quality, or market
                confidence.
              </p>
            </section>

            <section className="tr-section">
              <h2>2. Prohibited Activities</h2>
              <ul>
                <li>Market manipulation or deceptive order placement</li>
                <li>Use of unauthorized automation or abusive API behaviour</li>
                <li>Coordination to create artificial demand or supply</li>
                <li>Any activity breaching applicable law or sanctions</li>
              </ul>
            </section>

            <section className="tr-section">
              <h2>3. Manipulation Prevention</h2>
              <p>
                Nexora monitors account and order patterns for anomalous
                behaviour, including layered quotes, self-directed flow, and
                event-driven exploitation.
              </p>
            </section>

            <section className="tr-section">
              <h2>4. Wash Trading</h2>
              <p>
                Trades that intentionally generate artificial volume without real
                market risk transfer are prohibited and subject to enforcement.
              </p>
            </section>

            <section className="tr-section">
              <h2>5. Spoofing and Layering</h2>
              <p>
                Entering or cancelling orders with intent to mislead market
                participants is prohibited.
              </p>
            </section>

            <section className="tr-section">
              <h2>6. Front Running</h2>
              <p>
                Trading ahead of known client flow, confidential execution
                intent, or privileged order information is strictly forbidden.
              </p>
            </section>

            <section className="tr-section">
              <h2>7. Fair Trading Principles</h2>
              <ul>
                <li>Equal access to publicly displayed market data</li>
                <li>Objective matching logic based on price-time priority</li>
                <li>Consistent enforcement of risk controls</li>
              </ul>
            </section>

            <section className="tr-section">
              <h2>8. Margin Rules and Leverage Limits</h2>
              <p>
                Margin-enabled products are subject to collateral requirements,
                maintenance thresholds, and leverage caps defined by product and
                market conditions.
              </p>
            </section>

            <section className="tr-section">
              <h2>9. Order Execution</h2>
              <p>
                Orders execute based on available liquidity and exchange rules.
                Partial fills, slippage, and queue priority may occur during
                fast markets.
              </p>
            </section>

            <section className="tr-section">
              <h2>10. Market Volatility and Suspension</h2>
              <p>
                Nexora may apply temporary controls, instrument pauses,
                or matching restrictions during extraordinary volatility or
                infrastructure risk events.
              </p>
            </section>

            <section className="tr-section">
              <h2>11. Compliance Monitoring</h2>
              <p>
                Automated and manual surveillance reviews are performed to detect
                abuse, policy breaches, and suspicious trading patterns.
              </p>
            </section>

            <section className="tr-section">
              <h2>12. Penalties and Enforcement</h2>
              <ul>
                <li>Order cancellation and trade invalidation where applicable</li>
                <li>Account restrictions or suspension</li>
                <li>Withdrawal of incentives and programme access</li>
                <li>Escalation to competent regulatory authorities</li>
              </ul>
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

export default TradingRules;
