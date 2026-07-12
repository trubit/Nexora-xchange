import { Container, Row, Col } from "react-bootstrap";
import NewsletterSection from "../Components/home/NewsletterSection";
import NavigationSection from "../Components/layout/NavigationSection";
import BottomBar from "../Components/layout/BottomBar";
import "../styles/AntiBriberyPolicy.css";

const AntiBriberyPolicy = () => {
  return (
    <>
      <section className="anti-bribery-policy-page">
        <Container className="anti-bribery-policy-container">
          <Row className="justify-content-center">
            <Col xs={12}>
              <article className="anti-bribery-policy-card">
                <header className="anti-bribery-policy-header">
                  <h1 className="anti-bribery-policy-title">
                    Anti-Bribery &amp; Anti-Corruption Policy
                  </h1>
                </header>

                <div className="anti-bribery-policy-content">
                <section className="anti-bribery-section">
                  <h2>1. Introduction</h2>
                  <p>
                    Nexora FZCO (the &ldquo;Company&rdquo; or
                    &ldquo;Nexora&rdquo;) is committed to conducting its
                    business with the highest standards of integrity,
                    transparency, and accountability. In accordance with the
                    Virtual Assets and Related Activities Regulations (2023)
                    (&ldquo;VARA Regulations&rdquo;) and the VARA Company
                    Rulebook (Part IV) and Market Conduct Rulebook (Part II),
                    the Company maintains a zero-tolerance approach to bribery
                    and corruption. All employees, officers, directors, agents,
                    and third-party intermediaries acting on behalf of
                    Nexora must comply fully with applicable
                    anti-bribery and anti-corruption laws, including UAE Federal
                    Law No. 3 of 1987 (as amended), and any other relevant
                    statutes of jurisdictions in which Nexora operates.
                  </p>
                </section>

                <section className="anti-bribery-section">
                  <h2>2. Purpose</h2>
                  <p>
                    This Anti-Bribery &amp; Anti-Corruption Policy (the
                    &ldquo;Policy&rdquo;) establishes clear standards and
                    procedures to:
                  </p>
                  <ul>
                    <li>
                      Prevent and detect bribery, corruption, and any form of
                      improper inducement in all Company dealings;
                    </li>
                    <li>
                      Ensure that Nexora&rsquo;s employees and
                      representatives avoid conflicts of interest that could
                      compromise regulatory compliance or client interests;
                    </li>
                    <li>
                      Safeguard Nexora&rsquo;s reputation by fostering a
                      culture of ethical conduct; and
                    </li>
                    <li>
                      Fulfil VARA&rsquo;s requirement that a VASP maintain robust
                      controls to mitigate bribery and corruption risk (VARA
                      Company Rulebook Part II).
                    </li>
                  </ul>
                </section>

                <section className="anti-bribery-section">
                  <h2>3. Scope</h2>
                  <p>This Policy applies to:</p>
                  <ul>
                    <li>
                      All Nexora employees, officers, directors, and
                      members of the Board (&ldquo;Employees&rdquo;);
                    </li>
                    <li>
                      All contractors, consultants, agents, and intermediaries
                      engaged to act for or on behalf of Nexora;
                    </li>
                    <li>
                      All business activities and transactions conducted in
                      connection with Nexora&rsquo;s Virtual Asset
                      Exchange Services, whether in the Emirate of Dubai or any
                      other jurisdiction.
                    </li>
                  </ul>
                </section>

                <section className="anti-bribery-section">
                  <h2>4. Definitions</h2>
                  <ul>
                    <li>
                      Bribery: Offering, giving, receiving, or soliciting
                      anything of value (monetary or non-monetary) to influence
                      an individual in a position of trust to act improperly.
                    </li>
                    <li>Corruption: Abuse of entrusted power for private gain.</li>
                    <li>
                      Facilitation Payment: A payment made to expedite or secure
                      the performance of a routine governmental action.
                    </li>
                    <li>
                      Gift: Anything of value (cash, cash equivalent, goods,
                      services, or entertainment) provided to or received from
                      any third party.
                    </li>
                    <li>
                      Hospitality: Meals, travel, lodging, event tickets, or
                      any form of entertainment extended to or received from
                      third parties.
                    </li>
                    <li>
                      Conflict of Interest: Any situation where personal
                      interests, or those of a related party, could influence or
                      appear to influence an Employee&rsquo;s objectivity in
                      performing Nexora duties.
                    </li>
                  </ul>
                </section>

                <section className="anti-bribery-section">
                  <h2>5. General Prohibitions</h2>
                  <ul>
                    <li>
                      Offer, promise, or give any gift, hospitality, or payment
                      intended to influence decisions
                    </li>
                    <li>
                      Accept inducements that reward improper conduct
                    </li>
                    <li>
                      Make facilitation payments except in extreme emergencies
                    </li>
                    <li>
                      Use donations or sponsorships improperly
                    </li>
                    <li>Act as intermediary for bribery</li>
                    <li>
                      Engagement in bribery results in disciplinary action and
                      possible legal referral.
                    </li>
                  </ul>
                </section>

                <section className="anti-bribery-section">
                  <h2>6. Gifts, Hospitality &amp; Entertainment</h2>
                  <p className="anti-bribery-subheading">Permitted:</p>
                  <ul>
                    <li>Reasonable, infrequent, market-aligned</li>
                    <li>Under USD 400</li>
                    <li>No influence intent</li>
                  </ul>
                  <p className="anti-bribery-subheading">Requirements:</p>
                  <ul>
                    <li>Approval above USD 400</li>
                    <li>Recorded within 5 days</li>
                  </ul>
                  <p className="anti-bribery-subheading">Prohibited:</p>
                  <ul>
                    <li>Cash equivalents</li>
                    <li>Conflict-inducing items</li>
                    <li>Government influence attempts</li>
                  </ul>
                </section>

                <section className="anti-bribery-section">
                  <h2>7. Facilitation Payments &amp; Kickbacks</h2>
                  <ul>
                    <li>Strictly prohibited except emergencies</li>
                    <li>Must be reported</li>
                    <li>Kickbacks are forbidden.</li>
                  </ul>
                </section>

                <section className="anti-bribery-section">
                  <h2>8. Conflicts of Interest</h2>
                  <ul>
                    <li>Must be avoided and disclosed</li>
                    <li>Reviewed under company policy</li>
                  </ul>
                </section>

                <section className="anti-bribery-section">
                  <h2>9. Register of Gifts &amp; Hospitality</h2>
                  <p>Must include:</p>
                  <ul>
                    <li>Date</li>
                    <li>Recipient</li>
                    <li>Giver</li>
                    <li>Description</li>
                    <li>Value</li>
                    <li>Approval</li>
                  </ul>
                  <p>Reviewed monthly.</p>
                </section>

                <section className="anti-bribery-section">
                  <h2>10. Donations &amp; Charitable Contributions</h2>
                  <p>Allowed only if:</p>
                  <ul>
                    <li>Not influencing decisions</li>
                    <li>Not political</li>
                    <li>Approved and recorded</li>
                  </ul>
                </section>

                <section className="anti-bribery-section">
                  <h2>11. Third-Party Intermediaries &amp; Agents</h2>
                  <ul>
                    <li>Due diligence required</li>
                    <li>Transparent payments</li>
                    <li>No indirect bribery</li>
                  </ul>
                </section>

                <section className="anti-bribery-section">
                  <h2>12. Reporting, Investigations &amp; Whistleblower Protection</h2>
                  <p>Report to:</p>
                  <ul>
                    <li>compliance@nexora.com</li>
                    <li>report@nexora.com</li>
                  </ul>
                  <p>Includes:</p>
                  <ul>
                    <li>Investigation process</li>
                    <li>Confidential handling</li>
                    <li>Board reporting</li>
                    <li>No retaliation allowed.</li>
                  </ul>
                </section>

                <section className="anti-bribery-section">
                  <h2>13. Training &amp; Communication</h2>
                  <ul>
                    <li>Annual training</li>
                    <li>Third-party acknowledgement</li>
                    <li>Policy updates shared</li>
                  </ul>
                </section>

                <section className="anti-bribery-section">
                  <h2>14. Monitoring, Audit &amp; Recordkeeping</h2>
                  <ul>
                    <li>Annual monitoring</li>
                    <li>Internal audits</li>
                    <li>8-year record retention</li>
                  </ul>
                </section>

                <section className="anti-bribery-section">
                  <h2>15. Non-Compliance &amp; Disciplinary Measures</h2>
                  <ul>
                    <li>Employee termination possible</li>
                    <li>Third-party contracts terminated</li>
                  </ul>
                </section>

                <section className="anti-bribery-section">
                  <h2>16. Reporting to VARA</h2>
                  <p>
                    Nexora must report relevant incidents with
                    corrective actions and regulatory disclosures.
                  </p>
                </section>
                </div>
              </article>
            </Col>
          </Row>
        </Container>
      </section>
      <NewsletterSection />
      <NavigationSection />
      <BottomBar />
    </>
  );
};

export default AntiBriberyPolicy;
