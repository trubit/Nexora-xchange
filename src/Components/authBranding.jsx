import mainLogo from "../assets/mainLogo.png";
import "../styles/authBranding.css";

// Left-side branding panel for auth screens.
const AuthBranding = () => {
  return (
    <div className="d-none d-md-flex auth-branding-container flex-column align-items-center justify-content-center">
      <div className="text-center logo-setup">
        <h2 className="fw-bold mb-4 login-text">TrusonXchanger</h2>

        <div
          className="d-flex justify-content-center mb-5"
          style={{ marginTop: "-2rem" }}
        >
          <img src={mainLogo} alt="TrusonXchanger Logo" className="img-logo" />
        </div>

        <div>
          <p className="mb-0 welcome-message">
            Welcome to the Truson Exchange of Opportunities!
          </p>
          <p className="text-center mt-4 small welcome-messages">
            Secure - Fast - Global!
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthBranding;
