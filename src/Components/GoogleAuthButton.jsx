import { useCallback, useEffect, useRef, useState } from "react";
import { Spinner } from "react-bootstrap";
import { googleAuth } from "../api/auth";

const GoogleAuthButton = ({
  action = "signin",
  onSuccess,
  onError,
  referralId = "",
  disabled = false,
}) => {
  // Reference to the div where Google renders its official button.
  const buttonRef = useRef(null);
  // Avoid showing the missing-config message more than once.
  const warnedRef = useRef(false);
  // Track when the Google Identity script has loaded.
  const [isReady, setIsReady] = useState(false);
  // Ensure Google Identity is initialized only once.
  const hasInitializedRef = useRef(false);
  // Track when we are exchanging the token with our backend.
  const [isLoading, setIsLoading] = useState(false);
  // Track if we're on a narrow mobile screen (to shorten the Google button text).
  const [isNarrowScreen, setIsNarrowScreen] = useState(false);
  // Friendly message when Google client ID is missing.
  const [configMessage, setConfigMessage] = useState("");
  // Responsive width for the official Google button.
  const [buttonWidth, setButtonWidth] = useState(320);
  // Frontend Google OAuth client ID (from .env).
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const hasValidClientId =
    typeof clientId === "string" &&
    clientId.trim().endsWith(".apps.googleusercontent.com");

  // Called by Google after the user approves the popup.
  const handleCredentialResponse = useCallback(
    async (response) => {
      // Google did not return a credential (user closed popup).
      if (!response?.credential) {
        onError?.("Google sign-in was cancelled. Please try again.");
        return;
      }

      setIsLoading(true);
      try {
        // Send the Google ID token to our backend for verification.
        const extraPayload =
          referralId && action === "signup"
            ? { referralId: referralId.trim() }
            : {};
        const payload = await googleAuth(response.credential, extraPayload);
        // Persist session so the app stays logged in on refresh (sign-in only).
        if (action !== "signup") {
          localStorage.setItem("token", payload.token);
          localStorage.setItem("user", JSON.stringify(payload.user));
        }
        onSuccess?.(payload);
      } catch (err) {
        onError?.(err.message || "Google authentication failed.");
      } finally {
        setIsLoading(false);
      }
    },
    [action, onError, onSuccess, referralId],
  );

  // Wait for the Google Identity script to load.
  useEffect(() => {
    // If client ID is missing, show a helpful message.
    if (!clientId || !hasValidClientId) {
      if (!warnedRef.current) {
        setConfigMessage(
          "Missing or invalid Google client ID. Add a valid VITE_GOOGLE_CLIENT_ID to your root .env file.",
        );
        warnedRef.current = true;
      }
      return;
    }

    // If the Google script is already ready, mark as ready.
    if (window.google?.accounts?.id) {
      setIsReady(true);
      return;
    }

    // Poll until the script becomes available.
    const interval = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(interval);
        setIsReady(true);
      }
    }, 250);

    return () => clearInterval(interval);
  }, [clientId]);

  // Watch small-screen breakpoint so we can shorten the official button text.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 420px)");
    const updateMatch = () => setIsNarrowScreen(mediaQuery.matches);

    updateMatch();
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", updateMatch);
      return () => mediaQuery.removeEventListener("change", updateMatch);
    }

    mediaQuery.addListener(updateMatch);
    return () => mediaQuery.removeListener(updateMatch);
  }, []);

  // Keep the Google button width in sync with container size.
  useEffect(() => {
    if (!buttonRef.current) {
      return;
    }

    const updateWidth = () => {
      const width = buttonRef.current?.clientWidth || 0;
      if (width > 0) {
        const maxWidth = isNarrowScreen ? 300 : 360;
        const clamped = Math.min(maxWidth, width);
        setButtonWidth(clamped);
      }
    };

    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }

    const observer = new ResizeObserver(updateWidth);
    observer.observe(buttonRef.current);
    return () => observer.disconnect();
  }, [isNarrowScreen]);

  // Initialize and render the official Google button.
  useEffect(() => {
    if (
      !isReady ||
      !buttonRef.current ||
      disabled ||
      isLoading ||
      !clientId ||
      !hasValidClientId
    ) {
      return;
    }

    // Initialize Google Identity Services only once.
    if (!hasInitializedRef.current) {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
        ux_mode: "popup",
      });
      hasInitializedRef.current = true;
    }

    buttonRef.current.innerHTML = "";
    // Render the Google button into our div.
    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: "outline",
      size: "large",
      shape: "pill",
      width: buttonWidth,
      text:
        action === "signup"
          ? isNarrowScreen
            ? "continue_with"
            : "signup_with"
          : isNarrowScreen
            ? "signin"
            : "signin_with",
    });
  }, [
    action,
    buttonWidth,
    clientId,
    disabled,
    handleCredentialResponse,
    isNarrowScreen,
    isLoading,
    isReady,
  ]);

  return (
    <div
      className="google-auth-wrapper"
      aria-label={action === "signup" ? "Sign up with Google" : "Sign in with Google"}
    >
      <div
        className="google-auth-card"
        role="button"
        tabIndex={0}
        aria-label={action === "signup" ? "Sign up with Google" : "Sign in with Google"}
      >
        <div className="google-auth-card-header">
          <span className="google-auth-pill">Secure</span>
          <span className="google-auth-title">
            {action === "signup" ? "Create account with Google" : "Continue with Google"}
          </span>
        </div>
        {clientId && isReady && hasValidClientId ? (
          // Real Google button (renders inside this div).
          <div
            className="google-button-shell"
            ref={buttonRef}
            aria-label={action === "signup" ? "Sign up with Google" : "Sign in with Google"}
          />
        ) : (
          // Fallback button shown while Google script loads or when missing config.
          <button
            className="google-auth-button"
            type="button"
            disabled
            aria-disabled="true"
            aria-label={action === "signup" ? "Sign up with Google" : "Sign in with Google"}
          >
            <span className="google-auth-icon">G</span>
            {action === "signup" ? "Sign up with Google" : "Sign in with Google"}
          </button>
        )}
      </div>
      {isLoading && (
        <div className="google-auth-loading small text-muted">
          <Spinner animation="border" size="sm" className="me-2" />
          Connecting to Google...
        </div>
      )}
      {configMessage && (
        <div className="google-auth-fallback small text-muted">
          {configMessage}
        </div>
      )}
    </div>
  );
};

export default GoogleAuthButton;
