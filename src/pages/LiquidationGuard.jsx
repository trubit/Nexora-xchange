import { Container } from "react-bootstrap";
import "../styles/liquidation-guard.css";
import NewsletterSection from "../Components/home/NewsletterSection";
import NavigationSection from "../Components/layout/NavigationSection";
import BottomBar from "../Components/layout/BottomBar";

const LiquidationGuard = () => {
  return (
    <>
      <section className="lg-page">
        <Container className="lg-wrap">
          <article className="lg-card">
            <h1 className="lg-title">
              Liquidation Guard Framework | Nexora
            </h1>
            <p className="lg-subtitle">
              Margin risk controls, liquidation mechanics, and platform
              safeguards for leveraged trading products.
            </p>
            <p className="lg-intro">
              Liquidation Guard is Nexora&apos;s structured risk
              framework designed to reduce disorderly closeouts, protect market
              integrity, and provide transparent liquidation procedures.
            </p>

            <section className="lg-section">
              <h2>1. Overview</h2>
              <p>
                Leveraged positions are continuously assessed against initial and
                maintenance margin requirements by a real-time risk engine.
              </p>
            </section>

            <section className="lg-section">
              <h2>2. Margin Protection and Risk Engine</h2>
              <p>
                The engine evaluates mark price exposure, collateral quality,
                concentration, and market volatility before escalation actions
                are triggered.
              </p>
            </section>

            <section className="lg-section">
              <h2>3. Liquidation Thresholds</h2>
              <div className="lg-table-wrap">
                <table className="lg-table">
                  <thead>
                    <tr>
                      <th>Tier</th>
                      <th>Leverage Range</th>
                      <th>Maintenance Margin</th>
                      <th>Warning Trigger</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Tier 1</td>
                      <td>1x - 5x</td>
                      <td>2.0%</td>
                      <td>Margin Ratio &lt; 140%</td>
                    </tr>
                    <tr>
                      <td>Tier 2</td>
                      <td>5x - 15x</td>
                      <td>4.0%</td>
                      <td>Margin Ratio &lt; 125%</td>
                    </tr>
                    <tr>
                      <td>Tier 3</td>
                      <td>15x - 25x</td>
                      <td>6.5%</td>
                      <td>Margin Ratio &lt; 115%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="lg-section">
              <h2>4. Warning Notifications</h2>
              <ul>
                <li>In-app risk alerts</li>
                <li>Email notifications for critical thresholds</li>
                <li>Escalation notices before forced liquidation events</li>
              </ul>
            </section>

            <section className="lg-section">
              <h2>5. Partial Liquidation</h2>
              <p>
                Nexora may reduce position size in stages to restore
                margin compliance before full liquidation is required.
              </p>
            </section>

            <section className="lg-section">
              <h2>6. Forced Liquidation and Auto-Deleveraging</h2>
              <p>
                If margin remains insufficient, positions may be closed by the
                platform. Under extreme conditions, auto-deleveraging logic may
                apply to preserve market continuity.
              </p>
            </section>

            <section className="lg-section">
              <h2>7. Insurance Fund and Market Protection</h2>
              <p>
                An insurance fund may absorb residual losses that exceed closed
                collateral, reducing systemic spillover across counterparties.
              </p>
            </section>

            <section className="lg-section">
              <h2>8. Volatility Controls</h2>
              <p>
                Dynamic risk parameters, temporary leverage adjustments, and
                protective throttles may be activated in extreme volatility.
              </p>
            </section>

            <section className="lg-section">
              <h2>9. Example Liquidation Scenarios</h2>
              <div className="lg-table-wrap">
                <table className="lg-table">
                  <thead>
                    <tr>
                      <th>Scenario</th>
                      <th>Position</th>
                      <th>Entry Price</th>
                      <th>Liquidation Range</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Long BTC Perpetual</td>
                      <td>0.50 BTC at 10x</td>
                      <td>80,000</td>
                      <td>Approx. 72,800 - 73,400</td>
                    </tr>
                    <tr>
                      <td>Short ETH Perpetual</td>
                      <td>20 ETH at 8x</td>
                      <td>2,300</td>
                      <td>Approx. 2,520 - 2,580</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="lg-section">
              <h2>10. Margin Examples</h2>
              <p>
                Initial and maintenance requirements scale with leverage and
                exposure concentration. Clients should maintain collateral
                buffers above minimum thresholds to reduce liquidation risk.
              </p>
            </section>

            <section className="lg-section">
              <h2>11. User Responsibilities</h2>
              <ul>
                <li>Monitor margin ratio continuously</li>
                <li>Respond promptly to warning notifications</li>
                <li>Maintain prudent leverage discipline</li>
                <li>Understand instrument-specific risk parameters</li>
              </ul>
            </section>

            <section className="lg-section">
              <h2>12. Risk Disclosure and Platform Safeguards</h2>
              <p>
                Liquidation outcomes may vary with liquidity, slippage, and
                volatility conditions. Nexora provides layered controls,
                but losses may exceed expectations in stressed markets.
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

export default LiquidationGuard;
