import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Form,
  InputGroup,
  Spinner,
} from "react-bootstrap";
import { Eye, EyeSlash } from "react-bootstrap-icons";
import { Link, useLocation, useNavigate } from "react-router-dom";
import GoogleAuthButton from "../Components/auth/GoogleAuthButton";
import useLogin from "../hooks/useLogin";
import { authService } from "../services/authService";
import { useAuthStore } from "../store/authStore";
import "../styles/login.css";

const REMEMBER_EMAIL_KEY = "tx_remember_email";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
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
    needsVerification,
    handleLogin,
    togglePasswordVisibility,
  } = useLogin();

  const setGoogleSession = useAuthStore((s) => s.setGoogleSession);

  const [rememberMe, setRememberMe] = useState(() => Boolean(email));
  const [touched, setTouched] = useState({
    email: false,
    password: false,
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const oauthCode = params.get("code");
    const redirectPath = params.get("redirect") || "/Dashboard";
    const googleStatus = params.get("google");
    const googleError = params.get("error");
    const googleReason = params.get("reason");
    const googleDesc = params.get("desc");
    let shouldCleanQuery = false;

    if (googleStatus === "signup_success") {
      setSuccess("Google sign-up completed. Please sign in.");
      setError("");
      shouldCleanQuery = true;
    }

    if (googleError === "google_failed") {
      const reasonMap = {
        access_denied: "Google sign-in was cancelled or denied.",
        invalid_grant:
          "Google sign-in session expired or is invalid. Please try again.",
        unauthorized_client:
          "Google OAuth client is not authorised for this flow.",
        redirect_uri_mismatch:
          "Google redirect URI mismatch. Update OAuth redirect URI in Google Cloud console.",
        missing_code:
          "Google did not return an authorisation code. Please try again.",
        missing_id_token:
          "Google did not return a valid ID token. Please try again.",
      };

      const mapped = googleReason ? reasonMap[googleReason] : "";
      const extra = googleDesc ? ` (${googleDesc})` : "";
      setError(
        mapped ||
          `Google authentication failed. Please try again.${extra}`,
      );
      setSuccess("");
      shouldCleanQuery = true;
    }
    if (googleError === "google_not_configured") {
      setError("Google sign-in is not configured on the server.");
      setSuccess("");
      shouldCleanQuery = true;
    }

    if (!oauthCode) {
      if (shouldCleanQuery && window?.history?.replaceState) {
        window.history.replaceState(null, "", location.pathname);
      }
      return;
    }

    // Google redirect flow: exchange the one-time code for a JWT via the API.
    // The code is short-lived (60 s) and single-use — the JWT never appears in
    // the URL itself, so it cannot leak into server logs or Referer headers.
    let cancelled = false;
    const completeGoogleSession = async () => {
      if (window?.history?.replaceState) {
        window.history.replaceState(null, "", location.pathname);
      }
      try {
        const { token } = await authService.exchangeOAuthCode(oauthCode);
        if (cancelled) return;
        localStorage.setItem("token", token);
        const meData = await authService.getMe();
        if (cancelled) return;
        const user = meData?.user;
        if (!user) throw new Error("No user data returned from /api/auth/me");
        setGoogleSession({ token, user });
        setSuccess("Signed in with Google.");
        setError("");
        navigate(redirectPath);
      } catch {
        if (cancelled) return;
        localStorage.removeItem("token");
        setError("Google sign-in could not be verified. Please try again.");
        setSuccess("");
      }
    };

    completeGoogleSession();
    return () => { cancelled = true; };
  }, [location.pathname, location.search, navigate, setError, setSuccess, setGoogleSession]);

  useEffect(() => {
    if (!success) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSuccess("");
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [setSuccess, success]);

  const validation = useMemo(() => {
    const next = {
      email: "",
      password: "",
    };

    if (!email.trim()) {
      next.email = "Email is required.";
    } else if (!/\S+@\S+\.\S+/.test(email.trim())) {
      next.email = "Enter a valid email address.";
    }

    if (!password) {
      next.password = "Password is required.";
    }

    return next;
  }, [email, password]);

  const isFormValid =
    !validation.email &&
    !validation.password &&
    email.trim().length > 0 &&
    password.length > 0;

  const onSubmit = async (event) => {
    if (!isFormValid) {
      event.preventDefault();
      setTouched({
        email: true,
        password: true,
      });
      return;
    }

    if (rememberMe) {
      localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
    } else {
      localStorage.removeItem(REMEMBER_EMAIL_KEY);
    }

    await handleLogin(event);
  };

  return (
    <section className="tx-login-page">
      <div className="tx-login-bg" aria-hidden="true" />
      <main className="tx-login-main">
        <article className="tx-login-card" aria-labelledby="tx-login-title">
          <header className="tx-login-head">
            <h1 id="tx-login-title">Welcome Back to TrusonXchanger</h1>
            <p>
              Secure access to your digital asset trading account
            </p>
          </header>

          {error && (
            <Alert variant="danger" className="tx-login-alert">
              <div>{error}</div>
              {needsVerification && (
                <Link to="/verify-email" className="tx-login-alert-link">
                  Resend verification code
                </Link>
              )}
            </Alert>
          )}
          {success && <Alert variant="success" className="tx-login-alert">{success}</Alert>}

          <div className="tx-login-google">
            <GoogleAuthButton
              action="signin"
              onSuccess={(payload) => {
                if (payload?.token && payload?.user) {
                  setGoogleSession(payload);
                }
                setSuccess("Signed in with Google.");
                setError("");
                navigate("/Dashboard");
              }}
              onError={(message) => {
                setError(message);
              }}
              disabled={isLoading}
            />
          </div>

          <div className="tx-login-divider" role="presentation">
            <span>or sign in with email</span>
          </div>

          <Form onSubmit={onSubmit} noValidate>
            <Form.Group className="tx-login-group" controlId="tx-login-email">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                name="email"
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
                onChange={(event) => setEmail(event.target.value)}
                isInvalid={touched.email && Boolean(validation.email)}
                disabled={isLoading}
              />
              <Form.Control.Feedback type="invalid">
                {validation.email}
              </Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="tx-login-group" controlId="tx-login-password">
              <Form.Label>Password</Form.Label>
              <InputGroup>
                <Form.Control
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onBlur={() =>
                    setTouched((prev) => ({ ...prev, password: true }))
                  }
                  onChange={(event) => setPassword(event.target.value)}
                  isInvalid={touched.password && Boolean(validation.password)}
                  disabled={isLoading}
                />
                <Button
                  type="button"
                  variant="outline-secondary"
                  onClick={togglePasswordVisibility}
                  className="tx-login-password-toggle"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  disabled={isLoading}
                >
                  {showPassword ? <EyeSlash size={17} /> : <Eye size={17} />}
                </Button>
                <Form.Control.Feedback type="invalid">
                  {validation.password}
                </Form.Control.Feedback>
              </InputGroup>
            </Form.Group>

            <div className="tx-login-row">
              <Form.Check
                id="tx-login-remember"
                label="Remember me"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                disabled={isLoading}
              />
              <Link to="/forgot-password" className="tx-login-link">
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              className="tx-login-submit"
              disabled={!isFormValid || isLoading}
            >
              {isLoading ? (
                <>
                  <Spinner
                    as="span"
                    animation="border"
                    size="sm"
                    className="me-2"
                  />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </Form>

          <p className="tx-login-footer">
            Don&apos;t have an account?{" "}
            <Link to="/signup">Create one</Link>
          </p>
        </article>
      </main>
    </section>
  );
};

export default Login;
