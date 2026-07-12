import { Col, Container, Row } from "react-bootstrap";
import mainLogo from "../assets/mainLogo.png";
import AboutHighlightSection from "../Components/common/AboutHighlightSection";
import VisionMissionSection from "../Components/common/VisionMissionSection";
import CoreValues from "../Components/common/CoreValues";
import NewsletterSection from "../Components/home/NewsletterSection";
import NavigationSection from "../Components/layout/NavigationSection";
import BottomBar from "../Components/layout/BottomBar";
import "../styles/about.css";

const About = () => {
  return (
    <>
      <section className="about-hero">
        <div className="about-hero__bg-wrap" aria-hidden="true">
          <img
            src={mainLogo}
            alt=""
            className="about-hero__bg-logo about-hero__bg-logo--one"
          />
          <img
            src={mainLogo}
            alt=""
            className="about-hero__bg-logo about-hero__bg-logo--two"
          />
        </div>

        <Container fluid="xxl" className="about-hero__container">
          <Row className="justify-content-center">
            <Col xs={12} lg={11} className="text-center about-hero__content">
              <img
                src={mainLogo}
                alt="Nexora"
                className="about-hero__top-logo"
              />
              <p className="about-hero__brand">Nexora</p>
              <h1 className="about-hero__headline">
                Beyond Trading. Shaping The Future Of FinTech.
              </h1>
            </Col>
          </Row>
        </Container>
      </section>
      <AboutHighlightSection />
      <VisionMissionSection />
      <CoreValues />
      <NewsletterSection />
      <NavigationSection />
      <BottomBar />
    </>
  );
};

export default About;
