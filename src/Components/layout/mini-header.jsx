import { useState } from "react";
import { Navbar, Container, Nav, Button } from "react-bootstrap";
import { NavLink } from "react-router-dom";
import LangCurrencyModal from "../common/LangCurrencyModal";
import NexoraLogo from "../common/NexoraLogo";
import "bootstrap-icons/font/bootstrap-icons.css";
import "../../styles/mini-header.css";

// Compact header used on blog/update pages.
const MiniHeader = ({ showBreadcrumb = true }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <Navbar
        expanded={expanded}
        onToggle={(nextExpanded) => setExpanded(nextExpanded)}
        collapseOnSelect
        sticky="top"
        variant="dark"
        expand="lg"
        className="tx-mini-header"
      >
        <Container fluid="lg" className="tx-mini-header-inner">
          <Navbar.Brand
            as={NavLink}
            to="/"
            className="tx-mini-brand"
          >
            <NexoraLogo size={28} />
          </Navbar.Brand>

          <Navbar.Toggle
            aria-controls="responsive-navbar-nav"
            className="tx-mini-toggler"
          />
          <Navbar.Collapse id="responsive-navbar-nav">
            <Nav className="me-auto mb-2 mb-lg-0 tx-mini-nav">
              <Nav.Link
                as={NavLink}
                to="/Spot"
                className="tx-mini-link"
                onClick={() => setExpanded(false)}
              >
                Spot
              </Nav.Link>
              <Nav.Link
                as={NavLink}
                to="/Futures"
                className="tx-mini-link"
                onClick={() => setExpanded(false)}
              >
                Futures
              </Nav.Link>
              <Nav.Link
                as={NavLink}
                to="/Support"
                className="tx-mini-link"
                onClick={() => setExpanded(false)}
              >
                Support
              </Nav.Link>
            </Nav>
            <Nav className="d-flex flex-column flex-lg-row gap-2 gap-lg-3 tx-mini-actions">
              <LangCurrencyModal />

              <Button
                variant="success"
                size="md"
                as={NavLink}
                to="/login"
                className="tx-mini-login-btn"
                onClick={() => setExpanded(false)}
              >
                Log in
              </Button>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      {showBreadcrumb && (
        <div className="tx-mini-breadcrumb">
          <Container fluid="lg">
            <Nav className="align-items-center">
              <Nav.Link
                as={NavLink}
                to="/Blogs"
                className="tx-mini-breadcrumb-link"
                onClick={() => setExpanded(false)}
              >
                <i
                  className="bi bi-chevron-left tx-mini-breadcrumb-icon"
                  aria-hidden="true"
                />
                <span>Blogs</span>
              </Nav.Link>
            </Nav>
          </Container>
        </div>
      )}
    </>
  );
};

export default MiniHeader;
