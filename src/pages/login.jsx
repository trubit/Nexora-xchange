import { useEffect } from "react";
import ToggleTheme from "../Components/toggleTheme";
import {
  Card,
  Form,
  Button,
  InputGroup,
  Alert,
  Spinner,
} from "react-bootstrap";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeSlash } from "react-bootstrap-icons";
import AuthBranding from "../Components/authBranding";
import GoogleAuthButton from "../Components/GoogleAuthButton";
import "../styles/login.css";
import useLogin from "../hooksJavascript/useLogin";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  // All login logic lives in the hook (state + submit handler).
  const {
    email,
    setEmail,
    password,
    setPassword,
    showPassword,
    success,
    setSuccess,
    error,
    setError,
    isLoading,
    handleLogin,
    togglePasswordVisibility,
  } = useLogin();

  // Handle Google OAuth redirect with token in query string.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get("token");
    if (token) {
      localStorage.setItem("token", token);
      setSuccess("Signed in with Google.");
      setError("");
      if (window?.history?.replaceState) {
        window.history.replaceState(null, "", location.pathname);
      }
    }
  }, [location.pathname, location.search, setError, setSuccess]);

  return (
    <div className="position-relative min-vh-100 auth-shell py-4">
      {/* Theme toggle button */}
      <ToggleTheme />
      <div className="container d-flex flex-column flex-lg-row gap-4 align-items-lg-start justify-content-center auth-stack">
        <AuthBranding />

        <div className="d-flex align-items-center justify-content-center p-3 main-login-background">
          <div className="login-background">
            {/* Card */}

            <Card
              className="border-0 shadow-xl overflow-hidden "
              id="form-login"
            >
              <Card.Body className="p-3 p-md-4">
                <h3 className="text-center fw-bold mb-1 auth-title">Log in</h3>
                <p className="text-center mb-3 auth-subtitle">
                  Welcome back! Login with your Email
                </p>

                {error && (
                  <Alert variant="danger" dismissible>
                    {error}
                  </Alert>
                )}
                {success && <Alert variant="success">{success}</Alert>}

                <div className="auth-social-block compact-gap">
                  <GoogleAuthButton
                    action="signin"
                    onSuccess={() => {
                      setSuccess("Signed in with Google.");
                      setError("");
                      navigate("/Dashboard");
                    }}
                    onError={(message) => {
                      setError(message);
                    }}
                    disabled={isLoading}
                  />
                  <div className="auth-divider">or continue with email</div>
                </div>

                {/* Submit calls handleLogin, which hits /api/auth/login */}
                <Form onSubmit={handleLogin}>
                <Form.Group className="mb-2" controlId="login-email">
                  <Form.Label className="fw-medium ">
                    Email address
                  </Form.Label>
                  <Form.Control
                    type="email"
                    name="email"
                    placeholder="name@example.com"
                    value={email}
                    size="md"
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                      className="form-control-email"
                      style={{}}
                    />
                  </Form.Group>

                <Form.Group className="mb-2" controlId="login-password">
                  <Form.Label className="fw-medium ">Password</Form.Label>
                  <InputGroup size="md">
                    <Form.Control
                      type={showPassword ? "text" : "password"}
                      name="password"
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
                    className="d-flex justify-content-between align-items-center mb-3 
                flex-wrap gap-3"
                  >
                    <Form.Check
                      type="checkbox"
                      id="login-remember"
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

                  <div className="text-center mt-3 small ">
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
