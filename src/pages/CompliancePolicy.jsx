import { Container } from "react-bootstrap";
import "../styles/compliance-policy.css";
import NewsletterSection from "../Components/home/NewsletterSection";
import NavigationSection from "../Components/layout/NavigationSection";
import BottomBar from "../Components/layout/BottomBar";

const CompliancePolicy = () => {
  return (
    <>
      <section className="compliance-policy-page">
        <Container className="compliance-policy-wrap">
          <article className="compliance-policy-card">
            <h1 className="compliance-policy-title">Compliance Policy</h1>
            <p className="compliance-policy-intro">
              Nexora FZCO (&quot;Nexora,&quot; &quot;we,&quot;
              &quot;us,&quot; or &quot;our&quot;) is committed to addressing and
              resolving client concerns in a fair, transparent, and timely
              manner. This policy outlines how you may submit complaints and how
              we will handle them. We review this policy periodically and will
              publish any updates on our Platform at least thirty (30) calendar
              days before they take effect.
            </p>

            <section className="compliance-section">
              <h2>1. Definition Of A Complaint</h2>
              <p>
                A complaint is any expression of dissatisfaction or
                disappointment regarding:
              </p>
              <ul>
                <li>
                  The quality or delivery of Nexora&apos;s services or
                  processes
                </li>
                <li>
                  Conduct of an employee or representative of Nexora
                </li>
                <li>Our complaints handling process itself</li>
              </ul>
            </section>

            <section className="compliance-section">
              <h2>2. Submitting A Complaint</h2>
              <p>
                To file a complaint, please use one of the following methods:
              </p>
              <ul>
                <li>
                  Email: Send a detailed description to
                  support@nexora.io
                </li>
                <li>
                  Support Portal: Please raise a ticket through our support
                  portal to submit your complaint
                </li>
              </ul>
            </section>

            <section className="compliance-section">
              <h2>3. Required Information</h2>
              <p>When submitting a complaint, please include:</p>
              <ol>
                <li>Your full name and Nexora user ID;</li>
                <li>Subject, department and priority;</li>
                <li>Contact details (email and/or phone number);</li>
                <li>A clear description of your concern;</li>
                <li>Any supporting documentation, if applicable.</li>
              </ol>
              <p>
                You may also refer to the Complaint Form on our Platform for
                guidance.
              </p>
            </section>

            <section className="compliance-section">
              <h2>4. Acknowledgment And Initial Response</h2>
              <ol>
                <li>
                  We will acknowledge receipt of your complaint within 1&ndash;2
                  business days for high priority and 3&ndash;5 days for low
                  priority ticket submission.
                </li>
                <li>
                  Our acknowledgment will include:
                  <ul>
                    <li>
                      The name and contact details of the person assigned to
                      handle your complaint;
                    </li>
                    <li>A summary of our complaints resolution procedure;</li>
                    <li>
                      A statement that you may request a copy of this policy at
                      no charge.
                    </li>
                  </ul>
                </li>
              </ol>
            </section>

            <section className="compliance-section">
              <h2>5. Investigation And Resolution</h2>
              <ol>
                <li>
                  Assessment: We will evaluate your complaint, assign a risk
                  rating, and initiate an internal investigation.
                </li>
                <li>
                  Corrective Actions: Where appropriate, we will implement
                  remedial measures to address any identified issue.
                </li>
                <li>
                  Final Response: Once the investigation is complete, we will
                  provide you with a written summary of our findings and, if
                  applicable, any remediation or compensation. If we reject your
                  complaint, we will explain our reasons in detail.
                </li>
                <li>
                  Unresolved Complaints: If you remain dissatisfied, you may
                  escalate your complaint to:
                  <ul>
                    <li>
                      VARA: The Virtual Assets Regulatory Authority in Dubai
                    </li>
                    <li>
                      External Dispute Resolution: Any arbitration body or court
                      of competent jurisdiction in the Emirate of Dubai
                    </li>
                  </ul>
                </li>
              </ol>
            </section>

            <section className="compliance-section">
              <h2>6. Third-Party And VASP-Related Complaints</h2>
              <ul>
                <li>
                  Third-Party Services: If your complaint concerns services
                  provided by a third-party provider, we will forward your
                  concern to the relevant provider and continue to monitor
                  resolution in accordance with this policy.
                </li>
                <li>
                  Other VASPs: If another Virtual Asset Service Provider
                  (&quot;VASP&quot;) is partially or fully responsible for your
                  complaint, we will:
                  <ul>
                    <li>
                      Request your written consent to forward the complaint or
                      relevant parts to that VASP,
                    </li>
                    <li>Inform you promptly,</li>
                    <li>Provide contact details of the recipient VASP, and</li>
                    <li>
                      Continue to manage any portions of the complaint that
                      remain with Nexora.
                    </li>
                  </ul>
                </li>
              </ul>
            </section>

            <section className="compliance-section">
              <h2>7. Record Retention</h2>
              <p>
                Nexora will retain all records related to your
                complaint&mdash;documentation, correspondence, and
                resolution&mdash;for at least eight (8) years, in compliance
                with regulatory and internal recordkeeping requirements.
              </p>
            </section>

            <section className="compliance-section">
              <h2>8. Resolution Timeline</h2>
              <ul>
                <li>
                  Standard Cases: We aim to resolve complaints within four (4)
                  weeks from the date we receive them.
                </li>
                <li>
                  Extended Cases: In exceptional circumstances where more time
                  is needed, we will:
                  <ul>
                    <li>Notify you within four (4) weeks of receipt,</li>
                    <li>Explain the delay, and</li>
                    <li>
                      Complete resolution no later than eight (8) weeks from
                      initial submission.
                    </li>
                  </ul>
                </li>
                <li>
                  Escalation to VARA: If a complaint remains unresolved beyond
                  eight (8) weeks, you have the right to refer it to VARA.
                </li>
              </ul>
            </section>

            <section className="compliance-section">
              <h2>9. No Fees Or Charges</h2>
              <p>
                There are no fees or charges for submitting or processing your
                complaint.
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

export default CompliancePolicy;
