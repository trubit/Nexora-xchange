import ToggleTheme from "../Components/toggleTheme";
import {
  Card,
  Form,
  Button,
  InputGroup,
  Alert,
  Spinner,
} from "react-bootstrap";
import { Link } from "react-router-dom";
import { Eye, EyeSlash } from "react-bootstrap-icons";
import AuthBranding from "../Components/authBranding";
import "../styles/login.css";
import useLogin from "../hooksJavascript/useLogin";

const Login = () => {
  // All logic is now in the hooksjavascript
  const {
    email,
    setEmail,
    password,
    setPassword,
    showPassword,
    success,
    error,
    isLoading,
    handleLogin,
    togglePasswordVisibility,
    needsVerification,
    resendMessage,
    isResending,
    handleResendVerification,
  } = useLogin();

  return (
    <div className="position-relative min-vh-100  ">
      {/* Theme toggle button */}
      <ToggleTheme />
      <div
        className=" container d-flex flex-column flex-lg-row gap-5 align-items-lg-start 
      justify-content-center"
      >
        <AuthBranding />

        <div className="d-flex align-items-center justify-content-center p-3 main-login-background">
          <div className="login-background">
            {/* Card */}

            <Card
              className="border-0 shadow-xl overflow-hidden "
              id="form-login"
              style={{}}
            >
              <Card.Body className="p-4 p-md-5">
                <h3 className="text-center fw-bold mb-2">Log in</h3>
                <p className="text-center mb-4 mb-md-5">
                  Welcome back! Login with your Email
                </p>

                {error && (
                  <Alert variant="danger" dismissible>
                    {error}
                  </Alert>
                )}
                {needsVerification && (
                  <Alert variant="warning">
                    Please verify your email before logging in.
                    <div className="mt-3 d-grid gap-2">
                      <Button
                        variant="outline-light"
                        size="sm"
                        onClick={handleResendVerification}
                        disabled={isResending}
                      >
                        {isResending ? "Sending..." : "Resend verification email"}
                      </Button>
                      {resendMessage ? (
                        <div className="small text-dark">{resendMessage}</div>
                      ) : null}
                    </div>
                  </Alert>
                )}
                {success && <Alert variant="success">{success}</Alert>}

                <Form onSubmit={handleLogin}>
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-medium ">
                      Email address
                    </Form.Label>
                    <Form.Control
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      size="md"
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      className="form-control-email"
                      style={{}}
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label className="fw-medium ">Password</Form.Label>
                    <InputGroup size="md">
                      <Form.Control
                        type={showPassword ? "text" : "password"}
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isLoading}
                        className="border-end-0 form-control-password"
                        style={{}}
                      />

                      <InputGroup.Text
                        className="input-group-text"
                        style={{}}
                        onClick={togglePasswordVisibility}
                      >
                        {showPassword ? (
                          <EyeSlash size={20} />
                        ) : (
                          <Eye size={20} />
                        )}
                      </InputGroup.Text>
                    </InputGroup>
                  </Form.Group>

                  <div
                    className="d-flex justify-content-between align-items-center mb-4 
                flex-wrap gap-3"
                  >
                    <Form.Check
                      type="checkbox"
                      label={<span className=" small">Remember me</span>}
                    />
                    <Link
                      to="/forgot-password"
                      className="text-success small fw-medium text-decoration-none"
                    >
                      Forgot Password?
                    </Link>
                  </div>

                  <Button
                    variant="success"
                    size="lg"
                    className="w-100 fw-bold button-form"
                    type="submit"
                    disabled={isLoading}
                    style={{}}
                  >
                    {isLoading ? (
                      <>
                        <Spinner
                          as="span"
                          animation="border"
                          size="sm"
                          className="me-2"
                        />
                        Logging in...
                      </>
                    ) : (
                      "Login"
                    )}
                  </Button>

                  <div className="text-center mt-4 small ">
                    No account yet? &nbsp;&nbsp;
                    <Link
                      to="/signup"
                      className="text-success fw-medium text-decoration-none "
                    >
                      Sign up for free
                    </Link>
                  </div>
                </Form>
              </Card.Body>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
