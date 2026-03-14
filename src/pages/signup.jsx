import { Link } from "react-router-dom";
import { Form, Button, Alert, Spinner, InputGroup } from "react-bootstrap";
import { Eye, EyeSlash } from "react-bootstrap-icons";
import "../styles/signup.css";
import useSignup from "../hooksJavascript/useSignup";
import AuthBranding from "../Components/authBranding";
import ToggleTheme from "../Components/toggleTheme";

const Signup = () => {
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
    setErrors,
    referralId,
    setReferralId,
  } = useSignup();

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center py-5 px-5 main-card">
      {/* Theme toggle button */}
      <ToggleTheme />
      <div
        className=" container d-flex flex-column flex-lg-row gap-5 align-items-lg-start 
      justify-content-center"
      >
        <AuthBranding />
        <div
          className=" d-flex align-items-center justify-content-center p-3 main-login-background  main-container-cards"
          style={{}}
        >
          <div
            className="card border-0 shadow-lg p-4 p-md-5 overflow-hidden "
            id="card-border"
            style={{}}
          >
            <h2 className="text-center fw-bold mb-2">Sign Up</h2>

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

            <Form onSubmit={handleSubmit}>
              {/* Email */}
              <Form.Group className="mb-3">
                <Form.Label className="fw-medium">Enter Email</Form.Label>
                <Form.Control
                  type="email"
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
              <Form.Group className="mb-3">
                <Form.Label className="fw-medium">Enter Password</Form.Label>
                <InputGroup size="md">
                  <Form.Control
                    type={showPassword ? "text" : "password"}
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
                    {showPassword ? <EyeSlash size={20} /> : <Eye size={20} />}
                  </InputGroup.Text>
                  <Form.Control.Feedback type="invalid">
                    {errors.password}
                  </Form.Control.Feedback>
                </InputGroup>
              </Form.Group>

              {/* Confirm Password */}
              <Form.Group className="mb-3">
                <Form.Label className="fw-medium">Confirm Password</Form.Label>
                <InputGroup size="md">
                  <Form.Control
                    type={showConfirmPassword ? "text" : "password"}
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
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
              <Form.Group className="mb-4">
                <Form.Label className="fw-medium">
                  Referral ID (Optional)
                </Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Enter referral ID if any"
                  value={referralId}
                  size="md"
                  onChange={(e) => setReferralId(e.target.value)}
                  disabled={isSubmitting}
                  className="form-control-email"
                />
              </Form.Group>

              {/* Terms checkbox */}
              <div className=" mb-4 mb-md-5">
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

              <div className="text-center mt-4 small ">
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
  );
};

export default Signup;
