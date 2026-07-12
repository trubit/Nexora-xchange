import { Link } from "react-router-dom";
import MiniHeader from "../Components/layout/mini-header";

// Terms and Conditions page.
const Terms = ({ showBreadcrumb = false }) => {
  return (
    <>
      <MiniHeader showBreadcrumb={showBreadcrumb} />
      <div className="container py-5">
        <div className="mx-auto" style={{ maxWidth: "920px" }}>
          <h1 className="fw-bold mb-3">Nexora Terms and Conditions</h1>
          <p className="text-muted mb-4">Effective date: March 7, 2026</p>

          <p>
            These Terms and Conditions ("Terms") govern your access to and use
            of Nexora, including our websites, mobile applications, and
            related services (collectively, the "Service"). By accessing or
            using the Service, you agree to be bound by these Terms.
          </p>

          <h2 className="fw-semibold mt-4">1. Eligibility</h2>
          <p>
            You must be at least 18 years old and have the legal capacity to
            enter into these Terms. By using the Service, you represent and
            warrant that you meet these requirements.
          </p>

          <h2 className="fw-semibold mt-4">2. Account Registration</h2>
          <p>
            You are responsible for maintaining the confidentiality of your
            account credentials and for all activities under your account. You
            agree to provide accurate, complete, and current information during
            registration and to update such information promptly if it changes.
          </p>

          <h2 className="fw-semibold mt-4">3. Compliance, KYC, and AML</h2>
          <p>
            Nexora may require identity verification and other
            compliance checks to meet regulatory requirements. We may suspend or
            restrict your account if verification is incomplete or if we suspect
            unlawful activity.
          </p>

          <h2 className="fw-semibold mt-4">4. Risk Disclosure</h2>
          <p>
            Digital asset trading involves significant risk and may result in
            the loss of your funds. Prices can be highly volatile. You
            acknowledge that you understand these risks and that you are solely
            responsible for your trading decisions.
          </p>

          <h2 className="fw-semibold mt-4">
            5. Deposits, Withdrawals, and Fees
          </h2>
          <p>
            Fees, limits, and processing times may vary by asset and network
            conditions. You authorize us to deduct applicable fees from your
            transactions. You are responsible for ensuring withdrawal addresses
            are correct.
          </p>

          <h2 className="fw-semibold mt-4">6. Prohibited Activities</h2>
          <p>
            You agree not to use the Service for illegal activities, fraud,
            money laundering, market manipulation, or any activity that violates
            applicable laws or these Terms.
          </p>

          <h2 className="fw-semibold mt-4">7. Security</h2>
          <p>
            You are responsible for securing your devices and account. Notify us
            immediately if you believe your account has been compromised. We are
            not responsible for losses resulting from unauthorized access caused
            by your failure to secure your credentials.
          </p>

          <h2 className="fw-semibold mt-4">8. Intellectual Property</h2>
          <p>
            The Service and all associated content, trademarks, and logos are
            the property of Nexora or its licensors. You may not copy,
            modify, or distribute any part of the Service without our prior
            written consent.
          </p>

          <h2 className="fw-semibold mt-4">9. Third-Party Services</h2>
          <p>
            The Service may include links or integrations with third-party
            services. We do not control and are not responsible for the content
            or practices of third parties.
          </p>

          <h2 className="fw-semibold mt-4">10. Suspension and Termination</h2>
          <p>
            We may suspend, restrict, or terminate your access to the Service at
            any time for suspected violations of these Terms, legal obligations,
            or security reasons.
          </p>

          <h2 className="fw-semibold mt-4">11. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, Nexora will not be
            liable for any indirect, incidental, special, or consequential
            damages, including loss of profits, data, or goodwill, arising from
            your use of the Service.
          </p>

          <h2 className="fw-semibold mt-4">12. Indemnification</h2>
          <p>
            You agree to indemnify and hold harmless Nexora and its
            affiliates from any claims, damages, losses, or expenses arising
            from your use of the Service or violation of these Terms.
          </p>

          <h2 className="fw-semibold mt-4">13. Changes to These Terms</h2>
          <p>
            We may update these Terms from time to time. Continued use of the
            Service after changes become effective constitutes acceptance of the
            updated Terms.
          </p>

          <h2 className="fw-semibold mt-4">14. Contact</h2>
          <p className="mb-4">
            If you have questions about these Terms, please reach out via our{" "}
            <Link to="/Support" className="text-success text-decoration-none">
              Support
            </Link>{" "}
            page.
          </p>

          <p className="text-muted small">
            This document is provided for general information and does not
            constitute legal advice.
          </p>
        </div>
      </div>
    </>
  );
};

export default Terms;
