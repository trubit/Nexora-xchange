import { Card, Col, Container, Row } from "react-bootstrap";
import mobilePng from "../../assets/mobilepng.png";

const AboutHighlightSection = () => {
  return (
    <section className="about-highlight">
      <Container fluid="xxl" className="about-highlight__container">
        <Card className="about-highlight__card">
          <Card.Body>
            <Row className="about-highlight__row align-items-center gx-lg-4 gx-xl-5 gy-0">
              <Col lg={4} className="about-highlight__image-col">
                <div className="about-highlight__image-wrap">
                  <img
                    src={mobilePng}
                    alt="Nexora mobile trading interface"
                    className="about-highlight__image"
                  />
                </div>
              </Col>
              <Col lg={8} className="about-highlight__text-col">
                <div className="about-highlight__copy">
                  <p className="about-highlight__text">
                    <span>Nexora</span> is a fast, secure, and
                    user-centric cryptocurrency trading platform built for the
                    next generation of digital finance. With robust identity
                    verification powered by Veriff and advanced wallet security
                    via Fireblocks, we ensure a seamless and compliant trading
                    experience. Our mission is to make digital asset trading
                    simple, secure, and accessible. We envision a future where
                    anyone can participate in the evolving FinTech landscape
                    through innovation, trust, and transparency.
                  </p>
                </div>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      </Container>
    </section>
  );
};

export default AboutHighlightSection;
