import { Link, useNavigate } from "react-router-dom";
import { Form, Button, Alert, Spinner, InputGroup } from "react-bootstrap";
import { Eye, EyeSlash } from "react-bootstrap-icons";
import "../styles/signup.css";
import useSignup from "../hooksJavascript/useSignup";
import AuthBranding from "../Components/authBranding";
import ToggleTheme from "../Components/toggleTheme";
import GoogleAuthButton from "../Components/GoogleAuthButton";

const Signup = () => {
  const navigate = useNavigate();
  // All signup state + validation live in the hook.
  const {
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    successMessage,
    isSubmitting,
    handleSubmit,
    errors,

    referralId,
    setReferralId,
    setErrors,
  } = useSignup();

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center py-4 px-4 main-card auth-shell">
      {/* Theme toggle button */}
      <ToggleTheme />
      <div className="container d-flex flex-column flex-lg-row gap-4 align-items-lg-start justify-content-center auth-stack">
        <AuthBranding />
        <div className="d-flex align-items-center justify-content-center p-3 main-login-background  main-container-cards">
          <div className="login-background">
            <div
              className="card border-0 shadow-lg p-3 p-md-4 overflow-hidden "
              id="card-border"
            >
              <h2 className="text-center fw-bold mb-1 auth-title">Sign Up</h2>

              {errors.general && (
                <Alert variant="danger" className="mb-3">
                  {errors.general}
                </Alert>
              )}

              {successMessage && (
                <Alert variant="success" className="mb-4">
                  {successMessage}
                </Alert>
              )}

              <div className="auth-social-block compact-gap mt-2">
                <GoogleAuthButton
                  action="signup"
                  referralId={referralId}
                  onSuccess={() => {
                    setErrors({});
                    navigate("/login");
                  }}
                  onError={(message) => {
                    setErrors({ general: message });
                  }}
                  disabled={isSubmitting}
                />
                <div className="auth-divider">
                  or create an account with email
                </div>
              </div>

              {/* Submit calls handleSubmit, which posts to /api/auth/register */}
              <Form onSubmit={handleSubmit}>
                {/* Email */}
                <Form.Group className="mb-2" controlId="signup-email">
                  <Form.Label className="fw-medium">Enter Email</Form.Label>
                  <Form.Control
                    type="email"
                    name="email"
                    placeholder="Enter your email"
                    value={email}
                    size="md"
                    onChange={(e) => setEmail(e.target.value)}
                    isInvalid={!!errors.email}
                    disabled={isSubmitting}
                    className="form-control-email"
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.email}
                  </Form.Control.Feedback>
                </Form.Group>

                {/* Password */}
                <Form.Group className="mb-2" controlId="signup-password">
                  <Form.Label className="fw-medium">Enter Password</Form.Label>
                  <InputGroup size="md">
                    <Form.Control
                      type={showPassword ? "text" : "password"}
                      name="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      isInvalid={!!errors.password}
                      disabled={isSubmitting}
                      className="border-end-0 form-control-password"
                    />
                    <InputGroup.Text
                      className="input-group-text"
                      variant="outline-secondary"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isSubmitting}
                    >
                      {showPassword ? (
                        <EyeSlash size={20} />
                      ) : (
                        <Eye size={20} />
                      )}
                    </InputGroup.Text>
                    <Form.Control.Feedback type="invalid">
                      {errors.password}
                    </Form.Control.Feedback>
                  </InputGroup>
                </Form.Group>

                {/* Confirm Password */}
                <Form.Group className="mb-2" controlId="signup-confirm-password">
                  <Form.Label className="fw-medium">
                    Confirm Password
                  </Form.Label>
                  <InputGroup size="md">
                    <Form.Control
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      placeholder="Confirm your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      isInvalid={!!errors.confirmPassword}
                      disabled={isSubmitting}
                      className="border-end-0 form-control-password"
                    />
                    <InputGroup.Text
                      variant="outline-secondary"
                      className="input-group-text"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      disabled={isSubmitting}
                    >
                      {showConfirmPassword ? (
                        <EyeSlash size={20} />
                      ) : (
                        <Eye size={20} />
                      )}
                    </InputGroup.Text>
                    <Form.Control.Feedback type="invalid">
                      {errors.confirmPassword}
                    </Form.Control.Feedback>
                  </InputGroup>
                </Form.Group>

                {/* Referral ID (optional) */}
                <Form.Group className="mb-3" controlId="signup-referral-id">
                  <Form.Label className="fw-medium">
                    Referral ID (Optional)
                  </Form.Label>
                  <Form.Control
                    type="text"
                    name="referralId"
                    placeholder="Enter referral ID if any"
                    value={referralId}
                    size="md"
                    onChange={(e) => setReferralId(e.target.value)}
                    disabled={isSubmitting}
                    className="form-control-email"
                  />
                </Form.Group>

                {/* Terms checkbox */}
                <div className=" mb-3 auth-terms">
                  <Form.Check
                    type="checkbox"
                    id="terms"
                    label={
                      <>
                        By signing up, you confirm that you are over 18 years of
                        age and have read our{" "}
                        <Link
                          to="/terms"
                          className="text-success text-decoration-none"
                        >
                          Terms and Conditions
                        </Link>
                      </>
                    }
                    required
                    disabled={isSubmitting}
                  />
                </div>

                {/* Submit */}
                <Button
                  variant="success"
                  size="lg"
                  type="submit"
                  className="w-100 fw-bold button-form"
                  disabled={isSubmitting}
                  style={{}}
                >
                  {isSubmitting ? (
                    <>
                      <Spinner
                        as="span"
                        animation="border"
                        size="sm"
                        className="me-2"
                      />
                      Signing Up...
                    </>
                  ) : (
                    "Signup"
                  )}
                </Button>

                <div className="text-center mt-3 small ">
                  Already have an account? &nbsp;&nbsp;
                  <Link
                    to="/login"
                    className="text-success fw-medium text-decoration-none "
                  >
                    Login
                  </Link>
                </div>
              </Form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
