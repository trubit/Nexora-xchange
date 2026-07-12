import NexoraLogo from "../common/NexoraLogo";
import "../../styles/authBranding.css";

// Left-side branding panel for auth screens.
const AuthBranding = () => {
  return (
    <div className="d-none d-md-flex auth-branding-container flex-column align-items-center justify-content-center">
      <div className="text-center logo-setup">
        <div className="d-flex justify-content-center mb-4">
          <NexoraLogo size={72} variant="icon" />
        </div>

        <div className="d-flex justify-content-center mb-5">
          <NexoraLogo size={36} variant="full" />
        </div>

        <div>
          <p className="mb-0 welcome-message">
            The Next Era of Digital Exchange
          </p>
          <p className="text-center mt-4 small welcome-messages">
            Secure · Fast · Global
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthBranding;
