import { useState } from "react";
import { httpClient } from "../services/httpClient";
import { Container, Row, Col, Form, Button } from "react-bootstrap";
import { Link } from "react-router-dom";
import NavigationSection from "../Components/layout/NavigationSection";
import BottomBar from "../Components/layout/BottomBar";
import "../styles/contact.css";

import emailIcon from "../assets/email.png";
import customerServiceIcon from "../assets/customer service.png";
import secureIcon from "../assets/secure.png";

const Contact = () => {
  const supportEmail = "nexora@gmail.com";
  const supportEmailComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(supportEmail)}`;

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    subject: "",
    message: "",
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [focusedField, setFocusedField] = useState(null);

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.fullName.trim()) newErrors.fullName = "Full name is required";
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!isValidEmail(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }
    if (!formData.message.trim()) newErrors.message = "Message is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    setSubmitStatus(null);
    try {
      const response = await httpClient.post("/api/contact-us", {
        fullName: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        subject: formData.subject.trim() || "Contact Form Enquiry",
        message: formData.message.trim(),
      });
      if (response.data.success) {
        setSubmitStatus("success");
        setFormData({ fullName: "", email: "", subject: "", message: "" });
        setErrors({});
        setTimeout(() => setSubmitStatus(null), 5000);
      }
    } catch (error) {
      setSubmitStatus("error");
      console.error("Form submission error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="tx-contact-page">
      <div className="tx-contact-glow tx-contact-glow--left"></div>
      <div className="tx-contact-glow tx-contact-glow--right"></div>
      <div className="tx-contact-accent-1"></div>
      <div className="tx-contact-accent-2"></div>

      <section className="contact-hero">
        <Container fluid="xxl">
          <Row className="justify-content-center">
            <Col lg={10} xl={8} className="text-center">
              <span className="contact-eyebrow">Contact Support</span>
              <h1 className="contact-title">
                Get in touch with our <span className="tx-highlight">expert team</span>
              </h1>
              <p className="contact-subtitle">
                Have questions or need assistance with your trading journey?
                Our dedicated support team is available around the clock to ensure
                your experience remains seamless and secure.
              </p>
            </Col>
          </Row>
        </Container>
      </section>

      <section className="contact-main-content">
        <Container fluid="xxl">
          <div className="contact-shell-premium">
            <Row className="g-0">
              <Col lg={5} className="contact-info-col">
                <div className="contact-info-wrapper">
                  <div className="info-header">
                    <h2 className="info-main-title">Contact Information</h2>
                    <p className="info-sub-text">
                      Choose your preferred method of communication. We aim to
                      respond to all inquiries within 2 hours.
                    </p>
                  </div>
                  <div className="info-channels">
                    <div className="info-channel-card">
                      <div className="channel-icon-box">
                        <img src={emailIcon} alt="Email" />
                      </div>
                      <div className="channel-details">
                        <h3>Email Enquiries</h3>
                        <a href={supportEmailComposeUrl} target="_blank" rel="noopener noreferrer" className="channel-link">
                          {supportEmail}
                        </a>
                        <p>General support and account inquiries</p>
                      </div>
                    </div>
                    <div className="info-channel-card">
                      <div className="channel-icon-box">
                        <img src={customerServiceIcon} alt="Support" />
                      </div>
                      <div className="channel-details">
                        <h3>Live Assistance</h3>
                        <p className="channel-status"><span className="status-dot"></span> Online Now</p>
                        <p>Available 24/7 via our trading dashboard</p>
                      </div>
                    </div>
                    <div className="info-channel-card">
                      <div className="channel-icon-box">
                        <img src={secureIcon} alt="Security" />
                      </div>
                      <div className="channel-details">
                        <h3>Secure Channel</h3>
                        <p>Encrypted communication for sensitive data</p>
                      </div>
                    </div>
                  </div>
                  <div className="contact-trust-badges">
                    <div className="trust-badge">
                      <span className="badge-icon">⚡</span>
                      <span>Fast Execution</span>
                    </div>
                    <div className="trust-badge">
                      <span className="badge-icon">🔒</span>
                      <span>End-to-End Encryption</span>
                    </div>
                  </div>
                </div>
              </Col>

              <Col lg={7} className="contact-form-col">
                <div className="contact-form-wrapper">
                  <div className="form-header">
                    <h2>Send us a Message</h2>
                    <p>Fill out the form below and we'll get back to you shortly.</p>
                  </div>
                  <Form onSubmit={handleSubmit} className="premium-contact-form">
                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-4" controlId="fullName">
                          <Form.Label>Full Name</Form.Label>
                          <div className="premium-input-wrapper">
                            <Form.Control
                              type="text" name="fullName" placeholder="e.g. John Doe"
                              value={formData.fullName} onChange={handleInputChange}
                              onFocus={() => setFocusedField("fullName")} onBlur={() => setFocusedField(null)}
                              className={`${errors.fullName ? "is-invalid" : ""} ${focusedField === "fullName" ? "focused" : ""}`}
                              disabled={isSubmitting}
                            />
                            {errors.fullName && <Form.Control.Feedback type="invalid">{errors.fullName}</Form.Control.Feedback>}
                          </div>
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group className="mb-4" controlId="email">
                          <Form.Label>Email Address</Form.Label>
                          <div className="premium-input-wrapper">
                            <Form.Control
                              type="email" name="email" placeholder="e.g. john@example.com"
                              value={formData.email} onChange={handleInputChange}
                              onFocus={() => setFocusedField("email")} onBlur={() => setFocusedField(null)}
                              className={`${errors.email ? "is-invalid" : ""} ${focusedField === "email" ? "focused" : ""}`}
                              disabled={isSubmitting}
                            />
                            {errors.email && <Form.Control.Feedback type="invalid">{errors.email}</Form.Control.Feedback>}
                          </div>
                        </Form.Group>
                      </Col>
                    </Row>
                    <Form.Group className="mb-4" controlId="subject">
                      <Form.Label>Subject (Optional)</Form.Label>
                      <div className="premium-input-wrapper">
                        <Form.Control
                          type="text" name="subject" placeholder="How can we help you today?"
                          value={formData.subject} onChange={handleInputChange}
                          onFocus={() => setFocusedField("subject")} onBlur={() => setFocusedField(null)}
                          className={focusedField === "subject" ? "focused" : ""}
                          disabled={isSubmitting}
                        />
                      </div>
                    </Form.Group>
                    <Form.Group className="mb-4" controlId="message">
                      <Form.Label>Your Message</Form.Label>
                      <div className="premium-input-wrapper">
                        <Form.Control
                          as="textarea" name="message" rows={5} placeholder="Describe your inquiry in detail..."
                          value={formData.message} onChange={handleInputChange}
                          onFocus={() => setFocusedField("message")} onBlur={() => setFocusedField(null)}
                          className={`${errors.message ? "is-invalid" : ""} ${focusedField === "message" ? "focused" : ""}`}
                          disabled={isSubmitting}
                        />
                        {errors.message && <Form.Control.Feedback type="invalid">{errors.message}</Form.Control.Feedback>}
                      </div>
                    </Form.Group>
                    <div className="form-action-area">
                      <Button type="submit" variant="success" className={`submit-premium-btn ${isSubmitting ? "loading" : ""}`} disabled={isSubmitting}>
                        {isSubmitting ? (
                          <><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Sending...</>
                        ) : (
                          <><span>Send Message</span><span className="btn-icon">→</span></>
                        )}
                      </Button>
                      {submitStatus === "success" && (
                        <div className="submit-status success">
                          <span className="status-icon">✓</span>
                          <span>Message sent successfully! We'll be in touch soon.</span>
                        </div>
                      )}
                      {submitStatus === "error" && (
                        <div className="submit-status error">
                          <span className="status-icon">⚠</span>
                          <span>Failed to send. Please try again or email us directly.</span>
                        </div>
                      )}
                    </div>
                  </Form>
                </div>
              </Col>
            </Row>
          </div>
        </Container>
      </section>

      <section className="support-categories">
        <Container fluid="xxl">
          <div className="section-header text-center">
            <h2 className="categories-title">Specialized Departments</h2>
            <p className="categories-subtitle">For faster processing, choose a specific category for your inquiry.</p>
          </div>
          <Row className="g-4">
            <Col md={4}>
              <div className="support-cat-card">
                <div className="cat-icon">🛠️</div>
                <h3>Technical Support</h3>
                <p>Platform issues, API integrations, and trading execution queries.</p>
                <Link to="/#faqs" className="cat-link">View Documentation →</Link>
              </div>
            </Col>
            <Col md={4}>
              <div className="support-cat-card">
                <div className="cat-icon">🛡️</div>
                <h3>Security &amp; Privacy</h3>
                <p>Account verification, KYC, and security-related concerns.</p>
                <Link to="/compliance-policy" className="cat-link">Review Policies →</Link>
              </div>
            </Col>
            <Col md={4}>
              <div className="support-cat-card">
                <div className="cat-icon">💼</div>
                <h3>Institutional</h3>
                <p>Partnership opportunities and high-volume corporate accounts.</p>
                <a href={supportEmailComposeUrl} target="_blank" rel="noopener noreferrer" className="cat-link">
                  Contact Relations →
                </a>
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      <NavigationSection />
      <BottomBar />
    </div>
  );
};

export default Contact;
