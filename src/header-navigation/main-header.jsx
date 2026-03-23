import { useState } from "react";
import { Navbar, Container, Nav, Button } from "react-bootstrap";
import { NavLink } from "react-router-dom";
import LangCurrencyModal from "../Lang&Currency/LangCurrencyModal";
import "../styles/header.css";

// Primary site header/navigation bar.
const MainHeader = () => {
  const [expanded, setExpanded] = useState(false);
  return (
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
              to="/"
              className="fw-medium"
              onClick={() => setExpanded(false)}
            >
              Home
            </Nav.Link>
            <Nav.Link
              as={NavLink}
              to="/arbitrage"
              className="fw-medium"
              onClick={() => setExpanded(false)}
            >
              Arbitrage
            </Nav.Link>
            <Nav.Link
              as={NavLink}
              to="/trade"
              className="fw-medium"
              onClick={() => setExpanded(false)}
            >
              Trade
            </Nav.Link>
            <Nav.Link
              as={NavLink}
              to="/subscription"
              className="fw-medium"
              onClick={() => setExpanded(false)}
            >
              Subscription
            </Nav.Link>
            <Nav.Link
              as={NavLink}
              to="/contact"
              className="fw-medium"
              onClick={() => setExpanded(false)}
            >
              Contact
            </Nav.Link>
          </Nav>
          <Nav className="d-flex flex-column flex-lg-row gap-3">
            <LangCurrencyModal />
            <Button
              variant="outline-light"
              size="md"
              as={NavLink}
              to="/login"
              className="px-4 fw-medium"
              onClick={() => setExpanded(false)}
            >
              Log in
            </Button>
            <Button
              variant="success"
              size="md"
              as={NavLink}
              to="/signup"
              className="px-4 fw-medium button-nav"
              style={{}}
              onClick={() => setExpanded(false)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                fill="currentColor"
                className="bi bi-person"
                viewBox="0 0 16 16"
              >
                <path
                  d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6m2-3a2 
                  2 0 1 1-4 0 2 2 0 0 1 4 0m4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4
                  6 3 6 4m-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 
                  10 8 10s-3.516.68-4.168 1.332c-.678.678-.83 1.418-.832 1.664z"
                />
              </svg>
              Sign up
            </Button>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default MainHeader;
