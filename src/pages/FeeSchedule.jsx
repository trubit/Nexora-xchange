import { Container } from "react-bootstrap";
import "../styles/fee-schedule.css";
import NewsletterSection from "../Components/home/NewsletterSection";
import NavigationSection from "../Components/layout/NavigationSection";
import BottomBar from "../Components/layout/BottomBar";

const FeeSchedule = () => {
  return (
    <>
      <section className="fee-page">
        <Container className="fee-wrap">
          <article className="fee-card">
            <h1 className="fee-title">
              Fee Schedule | Nexora
            </h1>
            <p className="fee-subtitle">
              Transparent pricing for spot, futures, conversion, and transfer
              activities across Nexora services.
            </p>
            <p className="fee-intro">
              Nexora applies a clear fee framework designed for retail,
              professional, and institutional clients. Charges are disclosed
              before execution where technically possible. No hidden platform
              fees are applied outside published schedules.
            </p>

            <section className="fee-section">
              <h2>1. Trading Fees</h2>
              <p>
                Trading fees are calculated per filled order value and vary by
                market type, volume tier, and programme eligibility.
              </p>
            </section>

            <section className="fee-section">
              <h2>2. Spot Fees (Maker/Taker)</h2>
              <div className="fee-table-wrap">
                <table className="fee-table">
                  <thead>
                    <tr>
                      <th>Tier</th>
                      <th>30d Volume (USD)</th>
                      <th>Maker Fee</th>
                      <th>Taker Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Standard</td>
                      <td>0 - 99,999</td>
                      <td>0.10%</td>
                      <td>0.10%</td>
                    </tr>
                    <tr>
                      <td>VIP 1</td>
                      <td>100,000 - 999,999</td>
                      <td>0.08%</td>
                      <td>0.09%</td>
                    </tr>
                    <tr>
                      <td>VIP 2</td>
                      <td>1,000,000+</td>
                      <td>0.05%</td>
                      <td>0.07%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="fee-section">
              <h2>3. Futures Fees</h2>
              <p>
                Futures fees follow maker/taker logic and may include funding
                rate settlement depending on position and interval.
              </p>
            </section>

            <section className="fee-section">
              <h2>4. Deposit Fees</h2>
              <p>
                Nexora does not charge platform fees for standard crypto
                deposits. External providers may apply third-party costs.
              </p>
            </section>

            <section className="fee-section">
              <h2>5. Withdrawal Fees</h2>
              <p>
                Withdrawal fees reflect blockchain network conditions and asset
                type. Charges are displayed before final confirmation.
              </p>
              <div className="fee-table-wrap">
                <table className="fee-table">
                  <thead>
                    <tr>
                      <th>Asset</th>
                      <th>Network</th>
                      <th>Typical Fee</th>
                      <th>Example Withdrawal</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>BTC</td>
                      <td>Bitcoin</td>
                      <td>0.00035 BTC</td>
                      <td>0.05000 BTC - Fee 0.00035 BTC</td>
                    </tr>
                    <tr>
                      <td>ETH</td>
                      <td>Ethereum</td>
                      <td>0.0030 ETH</td>
                      <td>1.2000 ETH - Fee 0.0030 ETH</td>
                    </tr>
                    <tr>
                      <td>USDT</td>
                      <td>TRON (TRC20)</td>
                      <td>1.00 USDT</td>
                      <td>500.00 USDT - Fee 1.00 USDT</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="fee-section">
              <h2>6. Blockchain Network Fees</h2>
              <p>
                Network fees are dynamic and can increase during congestion.
                Nexora updates fee estimates in near real time to
                reflect settlement costs.
              </p>
            </section>

            <section className="fee-section">
              <h2>7. Conversion Fees</h2>
              <p>
                Conversion transactions may include spread and execution costs
                depending on liquidity and trade size.
              </p>
            </section>

            <section className="fee-section">
              <h2>8. VIP Discounts and Market Maker Programmes</h2>
              <p>
                Eligible clients may receive reduced fees through volume tiers,
                market maker agreements, or strategic liquidity programmes.
              </p>
            </section>

            <section className="fee-section">
              <h2>9. Institutional Accounts</h2>
              <p>
                Institutional clients may receive tailored commercial schedules
                subject to onboarding, compliance status, and documented trading
                activity.
              </p>
            </section>

            <section className="fee-section">
              <h2>10. Dynamic Fee Adjustments</h2>
              <p>
                Fee parameters may be updated based on market structure,
                liquidity profile, risk events, and regulatory requirements.
                Material updates are communicated through official channels.
              </p>
            </section>

            <section className="fee-section">
              <h2>11. Risk Notice</h2>
              <p>
                Trading digital assets involves market and liquidity risk.
                Clients should consider all applicable fees when evaluating net
                strategy performance.
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

export default FeeSchedule;
