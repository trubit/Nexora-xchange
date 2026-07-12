import { Container } from "react-bootstrap";
import "../styles/asset-list-policy.css";
import NewsletterSection from "../Components/home/NewsletterSection";
import NavigationSection from "../Components/layout/NavigationSection";
import BottomBar from "../Components/layout/BottomBar";

const AssetListingPolicy = () => {
  const contactEmail = "compliance@nexora.io";
  return (
    <>
      <section className="asset-list-policy-page">
        <Container className="asset-list-policy-wrap">
          <article className="asset-list-policy-card">
            <h1 className="asset-list-policy-title">
              Asset Listing Policy | Nexora - Secure Crypto Trading
              Exchange
            </h1>
            <p className="asset-list-policy-subtitle">
              Discover how Nexora evaluates, lists, and monitors digital
              assets to ensure security, compliance, and investor protection.
            </p>
            <p className="asset-list-policy-intro">
              This Asset Listing Policy outlines the standards and procedures
              for reviewing, listing, and monitoring digital assets on
              Nexora. Our approach is designed to protect users, ensure
              regulatory compliance, and maintain a secure trading environment.
            </p>

            <section className="asset-section">
              <h2>Introduction</h2>
              <p>
                Nexora is committed to listing only high-quality digital
                assets that meet our rigorous standards for security,
                compliance, and market integrity.
              </p>
            </section>

            <section className="asset-section">
              <h2>Asset Evaluation Process</h2>
              <p>
                All assets undergo a comprehensive evaluation process, including
                due diligence, regulatory review, and risk assessment.
              </p>
              <table className="asset-table">
                <thead>
                  <tr>
                    <th>Evaluation Stage</th>
                    <th>Key Criteria</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Initial Screening</td>
                    <td>Project legitimacy, documentation, compliance check</td>
                  </tr>
                  <tr>
                    <td>Due Diligence</td>
                    <td>Team background, legal structure, regulatory status</td>
                  </tr>
                  <tr>
                    <td>Technical Review</td>
                    <td>Smart contract audit, blockchain analysis, security</td>
                  </tr>
                  <tr>
                    <td>Market Assessment</td>
                    <td>Liquidity, trading volume, community strength</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section className="asset-section">
              <h2>Due Diligence Standards</h2>
              <ul>
                <li>Comprehensive background checks on project team</li>
                <li>Verification of legal entity and regulatory status</li>
                <li>Review of whitepaper, roadmap, and use case</li>
                <li>Assessment of tokenomics and distribution</li>
              </ul>
            </section>

            <section className="asset-section">
              <h2>Regulatory Compliance Review</h2>
              <p>
                All assets must comply with applicable laws and regulations. We
                review for AML, CFT, and sanctions compliance.
              </p>
            </section>

            <section className="asset-section">
              <h2>Security Assessment</h2>
              <ul>
                <li>Smart contract audits</li>
                <li>Penetration testing</li>
                <li>Ongoing vulnerability monitoring</li>
              </ul>
            </section>

            <section className="asset-section">
              <h2>Market Liquidity Review</h2>
              <p>
                We assess trading volume, order book depth, and market stability
                to ensure sufficient liquidity for users.
              </p>
            </section>

            <section className="asset-section">
              <h2>Team & Project Verification</h2>
              <ul>
                <li>Identity verification of founders and key team members</li>
                <li>Review of project history and reputation</li>
              </ul>
            </section>

            <section className="asset-section">
              <h2>Technology & Blockchain Review</h2>
              <ul>
                <li>Assessment of blockchain infrastructure</li>
                <li>Review of consensus mechanism and scalability</li>
                <li>Evaluation of interoperability and innovation</li>
              </ul>
            </section>

            <section className="asset-section">
              <h2>Risk Management</h2>
              <table className="asset-table">
                <thead>
                  <tr>
                    <th>Risk Category</th>
                    <th>Example</th>
                    <th>Mitigation</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Regulatory</td>
                    <td>Jurisdictional restrictions</td>
                    <td>Legal review, compliance controls</td>
                  </tr>
                  <tr>
                    <td>Technical</td>
                    <td>Smart contract bugs</td>
                    <td>Audits, bug bounties</td>
                  </tr>
                  <tr>
                    <td>Market</td>
                    <td>Low liquidity</td>
                    <td>Liquidity requirements, monitoring</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section className="asset-section">
              <h2>Community & Ecosystem Strength</h2>
              <p>
                We evaluate the size, engagement, and reputation of the asset’s
                community and ecosystem partners.
              </p>
            </section>

            <section className="asset-section">
              <h2>Delisting Criteria</h2>
              <ul>
                <li>Regulatory non-compliance</li>
                <li>Security vulnerabilities</li>
                <li>Insufficient liquidity or trading activity</li>
                <li>Fraudulent or unethical conduct</li>
              </ul>
            </section>

            <section className="asset-section">
              <h2>Ongoing Monitoring</h2>
              <p>
                All listed assets are subject to continuous monitoring for
                compliance, security, and market performance.
              </p>
            </section>

            <section className="asset-section">
              <h2>Compliance Obligations</h2>
              <p>
                Nexora complies with all applicable laws and
                regulations, including AML, CFT, and data protection
                requirements.
              </p>
            </section>

            <section className="asset-section">
              <h2>Risk Disclosure</h2>
              <p>
                Trading digital assets involves risk. Users should conduct their
                own research and understand the risks before trading.
              </p>
            </section>

            <section className="asset-section">
              <h2>User Responsibilities</h2>
              <ul>
                <li>Comply with platform terms and policies</li>
                <li>Maintain account security</li>
                <li>Report suspicious activity</li>
              </ul>
            </section>

            <section className="asset-section">
              <h2>Contact Information</h2>
              <p>
                For questions about this Asset Listing Policy, contact us at:{" "}
                <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
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

export default AssetListingPolicy;
