import { useEffect, useState } from "react";
import { Alert, Button, Container, Spinner } from "react-bootstrap";
import { Link, useSearchParams } from "react-router-dom";

const API_BASE_URL =
  import.meta.env.VITE_TRUSON_API_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000";

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Verifying your email...");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setMessage("Missing verification token.");
      return;
    }

    const verify = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/auth/verify?token=${encodeURIComponent(token)}`
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "Verification failed.");
        }
        setStatus("success");
        setMessage(data.message || "Email verified successfully.");
      } catch (error) {
        setStatus("error");
        setMessage(error.message || "Verification failed.");
      }
    };

    verify();
  }, [searchParams]);

  return (
    <div className="min-vh-100 d-flex align-items-center bg-dark text-white">
      <Container className="py-5">
        {status === "loading" && (
          <div className="text-center">
            <Spinner animation="border" className="mb-3" />
            <p>{message}</p>
          </div>
        )}

        {status !== "loading" && (
          <Alert variant={status === "success" ? "success" : "danger"}>
            {message}
          </Alert>
        )}

        <div className="mt-4 d-flex flex-wrap gap-3">
          <Button as={Link} to="/login" variant="success">
            Go to Login
          </Button>
          <Button as={Link} to="/" variant="outline-light">
            Back to Home
          </Button>
        </div>
      </Container>
    </div>
  );
};

export default VerifyEmail;
