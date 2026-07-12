import { Container, Table } from "react-bootstrap";
import "../styles/whistleblowing-policy.css";
import NewsletterSection from "../Components/home/NewsletterSection";
import NavigationSection from "../Components/layout/NavigationSection";
import BottomBar from "../Components/layout/BottomBar";

const WhistleblowingPolicy = () => {
  return (
    <>
      <section className="whistleblowing-policy-page">
        <Container className="whistleblowing-policy-wrap">
          <div className="whistleblowing-policy-card">
            <h1 className="whistleblowing-policy-title">
              Whistleblowing Policy
            </h1>

            <section className="whistleblowing-policy-section">
              <h2>1. Policy Statement</h2>
              <p>
                Nexora FZCO ("Nexora" or the “Company”) is
                committed to integrity, transparency and full compliance with
                UAE law and Virtual Assets Regulatory Authority (VARA)
                requirements. This Policy provides a confidential, secure path
                for employees and stakeholders to raise concerns about
                wrongdoing without fear of retaliation.
              </p>
            </section>

            <section className="whistleblowing-policy-section">
              <h2>2. Purpose</h2>
              <ul>
                <li>
                  Encourage good-faith disclosure of misconduct that could harm
                  clients, markets or Nexora.
                </li>
                <li>
                  Ensure reports are assessed promptly, impartially and
                  confidentially.
                </li>
                <li>
                  Protect whistleblowers from reprisals, thereby reinforcing our
                  culture of accountability.
                </li>
              </ul>
            </section>

            <section className="whistleblowing-policy-section">
              <h2>3. Scope</h2>
              <p>Applies to:</p>
              <ol>
                <li>
                  All employees (permanent, contract, temporary, interns),
                  officers and directors.
                </li>
                <li>
                  Consultants, vendors, influencers, volunteers and any person
                  acting for, or on behalf of, Nexora, and it covers the
                  following concerns (non-exhaustive):
                  <ul>
                    <li>Fraud, bribery, corruption or ABC breaches</li>
                    <li>Money-laundering / terrorist-financing</li>
                    <li>
                      Violations of VARA regulations or licence conditions
                    </li>
                    <li>
                      Serious ethical, fiduciary or market-conduct breaches
                    </li>
                    <li>Misuse of client assets or confidential data</li>
                    <li>Health, safety or environmental hazards</li>
                    <li>Attempts to conceal any of the above</li>
                  </ul>
                </li>
              </ol>
            </section>

            <section className="whistleblowing-policy-section">
              <h2>4. Governance &amp; Responsibilities</h2>
              <div className="whistleblowing-policy-table-wrap">
                <Table
                  responsive
                  borderless
                  className="whistleblowing-policy-table"
                >
                  <thead>
                    <tr>
                      <th>Function</th>
                      <th>Responsibility</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Board of Directors</td>
                      <td>
                        Owns this Policy; approves changes; receives quarterly
                        whistleblowing dashboard; signs annual VARA attestation.
                      </td>
                    </tr>
                    <tr>
                      <td>
                        Chief Compliance Officer/MLRO (Whistleblowing Officer)
                      </td>
                      <td>
                        Receives &amp; logs reports; safeguards confidentiality;
                        appoints Investigating Officer; updates Board &amp;
                        VARA; maintains Policy &amp; training.
                      </td>
                    </tr>
                    <tr>
                      <td>Investigating Officer / Committee</td>
                      <td>
                        Conducts objective investigation; gathers evidence;
                        issues findings &amp; recommendations.
                      </td>
                    </tr>
                    <tr>
                      <td>All Personnel &amp; Stakeholders</td>
                      <td>
                        Must report genuine concerns; must not obstruct
                        investigations or retaliate.
                      </td>
                    </tr>
                  </tbody>
                </Table>
              </div>
            </section>

            <section className="whistleblowing-policy-section">
              <h2>5. Protection &amp; Safeguards</h2>
              <ul>
                <li>
                  Non-Retaliation: Any good-faith whistleblower is protected
                  from dismissal, demotion, harassment or blacklisting.
                </li>
                <li>
                  Good-Faith Standard: Reports must be honest and reasonable;
                  malicious reporting may face discipline.
                </li>
                <li>
                  Confidentiality: Identity disclosed strictly on
                  “need-to-know”; anonymous reports accepted.
                </li>
                <li>
                  Support: Alleged retaliation can be escalated directly to the
                  Board Chair or VARA.
                </li>
              </ul>
            </section>

            <section className="whistleblowing-policy-section">
              <h2>6. Reporting Channels</h2>
              <ul>
                <li>Line Manager: first point, unless implicated.</li>
                <li>
                  Whistleblowing Officer/MLRO
                  <ol>
                    <li>Email: report@nexora.io</li>
                  </ol>
                </li>
                <li>
                  Board Chair: Compliance@nexora.io (if Officer
                  implicated).
                </li>
                <li>
                  External: VARA or law enforcement, if internal channels are
                  exhausted
                </li>
              </ul>
            </section>

            <section className="whistleblowing-policy-section">
              <h2>7. Investigation Process</h2>
              <div className="whistleblowing-policy-table-wrap">
                <Table
                  responsive
                  borderless
                  className="whistleblowing-policy-table"
                >
                  <thead>
                    <tr>
                      <th>Step</th>
                      <th>SLA</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Acknowledgement</td>
                      <td>Within 5 BD of receipt.</td>
                    </tr>
                    <tr>
                      <td>Preliminary Assessment</td>
                      <td>Within 10 BD to confirm scope &amp; materiality</td>
                    </tr>
                    <tr>
                      <td>Full Investigation</td>
                      <td>
                        Evidence gathering, interviews, report; target 30BD
                        (extendable).
                      </td>
                    </tr>
                    <tr>
                      <td>Decision &amp; Remediation</td>
                      <td>
                        Board/ARC approve actions; VARA notified if material.
                      </td>
                    </tr>
                    <tr>
                      <td>Feedback</td>
                      <td>
                        Outcome shared with whistleblower where permissible.
                      </td>
                    </tr>
                  </tbody>
                </Table>
              </div>
            </section>

            <section className="whistleblowing-policy-section">
              <h2>8. Record-Keeping &amp; Confidentiality</h2>
              <p>
                All whistleblowing files stored in encrypted SharePoint vault,
                access limited to Whistleblowing Officer, Investigators and
                Board Chair.
              </p>
              <p>Records retained 8 years in line with VARA Rulebooks.</p>
            </section>

            <section className="whistleblowing-policy-section">
              <h2>9. Training &amp; Awareness</h2>
              <ul>
                <li>
                  Mandatory onboarding + annual refresher e-learning (≥95%
                  completion KPI).
                </li>
                <li>
                  Policy hosted on intranet &amp; public website; posters in
                  common areas.
                </li>
              </ul>
            </section>
          </div>
        </Container>
      </section>
      <NewsletterSection />
      <NavigationSection />
      <BottomBar />
    </>
  );
};

export default WhistleblowingPolicy;
