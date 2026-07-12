import { useMemo, useState } from "react";
import { Alert, Button, Form, InputGroup, Spinner } from "react-bootstrap";
import { Eye, EyeSlash } from "react-bootstrap-icons";
import { Link, useNavigate } from "react-router-dom";
import GoogleAuthButton from "../Components/auth/GoogleAuthButton";
import { registerUser } from "../services/api/auth";
import "../styles/signup.css";

const getPasswordStrength = (value) => {
  if (!value) {
    return { label: "Weak", score: 0 };
  }

  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;

  if (score <= 1) return { label: "Weak", score: 1 };
  if (score <= 3) return { label: "Medium", score: 2 };
  return { label: "Strong", score: 3 };
};

const Signup = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    email: "",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
    referralCode: "",
    acceptTerms: false,
    marketingConsent: false,
  });
  const [touched, setTouched] = useState({});
  const [generalError, setGeneralError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordStrength = useMemo(
    () => getPasswordStrength(form.password),
    [form.password],
  );

  const validation = useMemo(() => {
    const next = {};

    if (!form.fullName.trim()) {
      next.fullName = "Full name is required.";
    } else if (form.fullName.trim().length < 2) {
      next.fullName = "Full name must be at least 2 characters.";
    }

    if (!form.username.trim()) {
      next.username = "Username is required.";
    } else if (!/^[a-zA-Z0-9_]{3,20}$/.test(form.username.trim())) {
      next.username =
        "Use 3-20 characters with letters, numbers, or underscore.";
    }

    if (!form.email.trim()) {
      next.email = "Email is required.";
    } else if (!/\S+@\S+\.\S+/.test(form.email.trim())) {
      next.email = "Enter a valid email address.";
    }

    if (!form.phoneNumber.trim()) {
      next.phoneNumber = "Phone number is required.";
    } else if (!/^\+?[0-9()\-\s]{7,20}$/.test(form.phoneNumber.trim())) {
      next.phoneNumber = "Enter a valid phone number.";
    }

    if (!form.password) {
      next.password = "Password is required.";
    } else if (form.password.length < 8) {
      next.password = "Password must be at least 8 characters.";
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_])/.test(form.password)) {
      next.password =
        "Use upper/lowercase letters, a number, and a symbol.";
    }

    if (!form.confirmPassword) {
      next.confirmPassword = "Please confirm your password.";
    } else if (form.password !== form.confirmPassword) {
      next.confirmPassword = "Passwords do not match.";
    }

    if (!form.acceptTerms) {
      next.acceptTerms = "You must accept the Terms and Conditions.";
    }

    return next;
  }, [form]);

  const isFormValid = Object.keys(validation).length === 0;

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const markTouched = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setGeneralError("");
    setSuccessMessage("");

    if (!isFormValid) {
      setTouched({
        fullName: true,
        username: true,
        email: true,
        phoneNumber: true,
        password: true,
        confirmPassword: true,
        acceptTerms: true,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = await registerUser({
        name: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phoneNumber.trim(),
        password: form.password,
        referralId: form.referralCode.trim() || undefined,
      });

      setSuccessMessage(
        payload.message || "Account created successfully. Redirecting...",
      );

      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      setGeneralError(err.message || "Registration failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="tx-signup-page">
      <div className="tx-signup-bg" aria-hidden="true" />
      <main className="tx-signup-main">
        <article className="tx-signup-card" aria-labelledby="tx-signup-title">
          <header className="tx-signup-head">
            <h1 id="tx-signup-title">Create Your Nexora Account</h1>
            <p>Join a secure and global digital trading ecosystem</p>
          </header>

          {generalError && (
            <Alert variant="danger" className="tx-signup-alert">
              {generalError}
            </Alert>
          )}

          {successMessage && (
            <Alert variant="success" className="tx-signup-alert">
              {successMessage}
            </Alert>
          )}

          <div className="tx-signup-google">
            <GoogleAuthButton
              action="signup"
              referralId={form.referralCode}
              onSuccess={() => navigate("/login")}
              onError={(message) => setGeneralError(message)}
              disabled={isSubmitting}
            />
          </div>

          <div className="tx-signup-divider" role="presentation">
            <span>or create account with email</span>
          </div>

          <Form onSubmit={onSubmit} noValidate>
            <div className="tx-signup-grid">
              <Form.Group className="tx-signup-group" controlId="tx-signup-full-name">
                <Form.Label>Full Name</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Enter your full name"
                  value={form.fullName}
                  onBlur={() => markTouched("fullName")}
                  onChange={(event) => setField("fullName", event.target.value)}
                  isInvalid={touched.fullName && Boolean(validation.fullName)}
                  disabled={isSubmitting}
                />
                <Form.Control.Feedback type="invalid">
                  {validation.fullName}
                </Form.Control.Feedback>
              </Form.Group>

              <Form.Group className="tx-signup-group" controlId="tx-signup-username">
                <Form.Label>Username</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Choose a username"
                  value={form.username}
                  onBlur={() => markTouched("username")}
                  onChange={(event) => setField("username", event.target.value)}
                  isInvalid={touched.username && Boolean(validation.username)}
                  disabled={isSubmitting}
                />
                <Form.Control.Feedback type="invalid">
                  {validation.username}
                </Form.Control.Feedback>
              </Form.Group>

              <Form.Group className="tx-signup-group" controlId="tx-signup-email">
                <Form.Label>Email</Form.Label>
                <Form.Control
                  type="email"
                  placeholder="name@example.com"
                  autoComplete="email"
                  value={form.email}
                  onBlur={() => markTouched("email")}
                  onChange={(event) => setField("email", event.target.value)}
                  isInvalid={touched.email && Boolean(validation.email)}
                  disabled={isSubmitting}
                />
                <Form.Control.Feedback type="invalid">
                  {validation.email}
                </Form.Control.Feedback>
              </Form.Group>

              <Form.Group className="tx-signup-group" controlId="tx-signup-phone">
                <Form.Label>Phone Number</Form.Label>
                <Form.Control
                  type="tel"
                  placeholder="+234 000 000 0000"
                  autoComplete="tel"
                  value={form.phoneNumber}
                  onBlur={() => markTouched("phoneNumber")}
                  onChange={(event) => setField("phoneNumber", event.target.value)}
                  isInvalid={touched.phoneNumber && Boolean(validation.phoneNumber)}
                  disabled={isSubmitting}
                />
                <Form.Control.Feedback type="invalid">
                  {validation.phoneNumber}
                </Form.Control.Feedback>
              </Form.Group>

              <Form.Group className="tx-signup-group" controlId="tx-signup-password">
                <Form.Label>Password</Form.Label>
                <InputGroup hasValidation>
                  <Form.Control
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a secure password"
                    autoComplete="new-password"
                    value={form.password}
                    onBlur={() => markTouched("password")}
                    onChange={(event) => setField("password", event.target.value)}
                    isInvalid={touched.password && Boolean(validation.password)}
                    disabled={isSubmitting}
                  />
                  <Button
                    type="button"
                    variant="outline-secondary"
                    className="tx-signup-password-toggle"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    disabled={isSubmitting}
                  >
                    {showPassword ? <EyeSlash size={17} /> : <Eye size={17} />}
                  </Button>
                  <Form.Control.Feedback type="invalid">
                    {validation.password}
                  </Form.Control.Feedback>
                </InputGroup>

                <div className="tx-signup-strength" aria-live="polite">
                  <div className="tx-signup-strength-bar">
                    <span
                      className={`tx-signup-strength-fill tx-signup-strength-${passwordStrength.score}`}
                    />
                  </div>
                  <span className="tx-signup-strength-label">
                    Password strength: {passwordStrength.label}
                  </span>
                </div>
              </Form.Group>

              <Form.Group className="tx-signup-group" controlId="tx-signup-confirm-password">
                <Form.Label>Confirm Password</Form.Label>
                <InputGroup hasValidation>
                  <Form.Control
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    value={form.confirmPassword}
                    onBlur={() => markTouched("confirmPassword")}
                    onChange={(event) =>
                      setField("confirmPassword", event.target.value)
                    }
                    isInvalid={
                      touched.confirmPassword && Boolean(validation.confirmPassword)
                    }
                    disabled={isSubmitting}
                  />
                  <Button
                    type="button"
                    variant="outline-secondary"
                    className="tx-signup-password-toggle"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={
                      showConfirmPassword ? "Hide confirm password" : "Show confirm password"
                    }
                    disabled={isSubmitting}
                  >
                    {showConfirmPassword ? (
                      <EyeSlash size={17} />
                    ) : (
                      <Eye size={17} />
                    )}
                  </Button>
                  <Form.Control.Feedback type="invalid">
                    {validation.confirmPassword}
                  </Form.Control.Feedback>
                </InputGroup>
              </Form.Group>
            </div>

            <Form.Group className="tx-signup-group" controlId="tx-signup-referral">
              <Form.Label>Referral Code (Optional)</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter referral code"
                value={form.referralCode}
                onChange={(event) => setField("referralCode", event.target.value)}
                disabled={isSubmitting}
              />
            </Form.Group>

            <div className="tx-signup-checks">
              <Form.Check
                id="tx-signup-terms"
                checked={form.acceptTerms}
                onChange={(event) => {
                  setField("acceptTerms", event.target.checked);
                  markTouched("acceptTerms");
                }}
                label={(
                  <>
                    I agree to the{" "}
                    <Link to="/terms" className="tx-signup-link-inline">
                      Terms &amp; Conditions
                    </Link>
                  </>
                )}
                disabled={isSubmitting}
                isInvalid={touched.acceptTerms && Boolean(validation.acceptTerms)}
              />
              {touched.acceptTerms && validation.acceptTerms && (
                <p className="tx-signup-check-error">{validation.acceptTerms}</p>
              )}

              <Form.Check
                id="tx-signup-marketing"
                checked={form.marketingConsent}
                onChange={(event) =>
                  setField("marketingConsent", event.target.checked)
                }
                label="I would like to receive market updates and product announcements."
                disabled={isSubmitting}
              />
            </div>

            <Button
              type="submit"
              className="tx-signup-submit"
              disabled={isSubmitting || !isFormValid}
            >
              {isSubmitting ? (
                <>
                  <Spinner
                    as="span"
                    animation="border"
                    size="sm"
                    className="me-2"
                  />
                  Creating account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </Form>

          <p className="tx-signup-footer">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </article>
      </main>
    </section>
  );
};

export default Signup;
