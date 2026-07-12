import React from "react";
import { Container, Row, Col } from "react-bootstrap";
import "../../styles/BottomBar.css";

const BottomBar = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bottom-bar">
      <div className="bottom-bar-glow" />
      <Container>
        <Row>
          <Col xs={12} className="text-center">
            <p className="bottom-bar-text">
              <span className="copyright-symbol">&copy;</span> {currentYear} All
              rights reserved -{" "}
              <span className="brand-accent">Nexora</span>
            </p>
          </Col>
        </Row>
      </Container>
    </footer>
  );
};

export default BottomBar;
