import { useState } from "react";
import { Navbar, Container, Nav, Button } from "react-bootstrap";
import { NavLink } from "react-router-dom";
import LangCurrencyModal from "../Lang&Currency/LangCurrencyModal";

import "bootstrap-icons/font/bootstrap-icons.css";
import "../styles/mini-header.css";

// Compact header used on blog/update pages.
const MiniHeader = ({ showBreadcrumb = true }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <Navbar
        expanded={expanded}
        onToggle={(nextExpanded) => setExpanded(nextExpanded)}
        collapseOnSelect
        bg="dark"
        sticky="top"
        variant="dark"
        expand="lg"
        className="py-3 shadow-sm nav-header"
        style={{}}
      >
        <Container fluid="lg">
          <Navbar.Brand
            as={NavLink}
            to="/"
            className="fs-3 fw-bold container-nav"
            style={{}}
          >
            TrusonXchanger
          </Navbar.Brand>

          {/* this is for hamburger button*/}
          <Navbar.Toggle aria-controls="responsive-navbar-nav" />
          <Navbar.Collapse id="responsive-navbar-nav">
            <Nav className="me-auto mb-2 mb-lg-0">
              <Nav.Link
                as={NavLink}
                to="/Spot"
                className="fw-medium nav-instant-green"
                onClick={() => setExpanded(false)}
              >
                Spot
              </Nav.Link>
              <Nav.Link
                as={NavLink}
                to="/Futures"
                className="fw-medium nav-instant-green"
                onClick={() => setExpanded(false)}
              >
                Futures
              </Nav.Link>
              <Nav.Link
                as={NavLink}
                to="/Support"
                className="fw-medium nav-instant-green"
                onClick={() => setExpanded(false)}
              >
                Support
              </Nav.Link>
            </Nav>
            {/* Right side items */}
            <Nav className="d-flex flex-column flex-lg-row gap-3">
              <LangCurrencyModal />

              <Button
                variant="success"
                size="md"
                as={NavLink}
                to="/login"
                className="px-4 fw-medium"
                onClick={() => setExpanded(false)}
              >
                Login
              </Button>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      {showBreadcrumb && (
        <div
          className="bg-secondary border-top border-secondary py-2"
          style={{}}
        >
          <Container fluid>
            <Nav className="align-items-center gap-3">
              <Nav.Link
                as={NavLink}
                to="/Blogs"
                className="fw-medium text-white text-decoration-none d-flex align-items-center gap-2"
                onClick={() => setExpanded(false)}
              >
                <i className="bi bi-chevron-left fs-5 text-white nav-instant-green"></i>
                <span className="fw-bold fs-5 text-white nav-instant-green">
                  Blogs
                </span>
              </Nav.Link>
            </Nav>
          </Container>
        </div>
      )}
    </>
  );
};

export default MiniHeader;
