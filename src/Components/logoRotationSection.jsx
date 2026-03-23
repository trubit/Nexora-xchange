import Trusoncoins from "../assets/trusoncoins.png";
import "../styles/logoRotationSection.css";

// CTA section with rotating logo and signup button.
const logoRotatingSection = () => {
  return (
    <div className="rotating-section">
      <div className="rotating-orbit" aria-hidden="true" />
      <img src={Trusoncoins} alt="Truson Logo" className="rotating-logo" />
    </div>
  );
};

export default logoRotatingSection;
