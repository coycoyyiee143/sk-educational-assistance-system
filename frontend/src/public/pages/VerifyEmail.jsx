import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../services/api";
import Footer from "../../components/Footer";

export default function VerifyEmail() {
  const { id, hash } = useParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState("verifying");
  const [message, setMessage] = useState("Verifying your email address...");
  const [countdown, setCountdown] = useState(3);

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSubmitting, setCodeSubmitting] = useState(false);
  const [codeError, setCodeError] = useState("");

  useEffect(() => {
    // Prevent requests like:
    // /email/verify/undefined/undefined
    if (!id || !hash) {
      setStatus("error");
      setMessage(
        "This verification link is incomplete or invalid. You may verify your email using the 6-digit code instead."
      );
      return;
    }

    setStatus("verifying");
    setMessage("Verifying your email address...");

    api
      .post(`/email/verify/${id}/${hash}`)
      .then((res) => {
        setStatus("success");
        setMessage(
          res.data.message || "Email verified successfully!"
        );
      })
      .catch((err) => {
        setStatus("error");
        setMessage(
          err.response?.data?.message ||
            "Verification failed. The link may be invalid or expired."
        );
      });
  }, [id, hash]);

  useEffect(() => {
    if (status !== "success") return;

    if (countdown === 0) {
      navigate("/login");
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((count) => count - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [status, countdown, navigate]);

  async function handleCodeSubmit(e) {
    e.preventDefault();

    setCodeError("");

    if (code.length !== 6) {
      setCodeError("Please enter the complete 6-digit verification code.");
      return;
    }

    setCodeSubmitting(true);

    try {
      const res = await api.post("/email/verify-by-code", {
        email,
        code,
      });

      setCountdown(3);
      setStatus("success");
      setMessage(
        res.data.message || "Email verified successfully!"
      );
    } catch (err) {
      setCodeError(
        err.response?.data?.message ||
          "Invalid or expired code. Please try again."
      );
    } finally {
      setCodeSubmitting(false);
    }
  }

  return (
    <>
      <nav className="navbar navbar-expand-lg sticky-top navbar-custom">
        <div className="container">
          <a
            className="navbar-brand navbar-brand-custom"
            href="/"
          >
            <img
              src="/icons/sk-logo.jpg"
              alt="SK Logo"
            />

            <div className="brand-text">
              <h5>SK Barangay Mamatid</h5>
              <span>
                Educational Assistance System
              </span>
            </div>
          </a>
        </div>
      </nav>

      <main className="verify-email-page">
        <div className="container">
          <div className="verify-email-wrapper">
            <div className="verify-email-card">

              <div className="verify-email-logo">
                <img
                  src="/icons/sk-logo.jpg"
                  alt="SK Mamatid Logo"
                />
              </div>

              {status === "verifying" && (
                <div className="verify-email-state">
                  <div className="verify-email-icon verify-email-icon-loading">
                    <div
                      className="spinner-border"
                      role="status"
                    />
                  </div>

                  <h2>
                    Verifying Your Email
                  </h2>

                  <p>
                    Please wait while we confirm your email address.
                  </p>

                  <div className="verify-email-processing">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              )}

              {status === "success" && (
                <div className="verify-email-state">
                  <div className="verify-email-icon verify-email-icon-success">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </div>

                  <div className="verify-email-status-badge verify-email-status-success">
                    Verified
                  </div>

                  <h2>
                    {message === "Email already verified."
                      ? "Already Verified"
                      : "Email Verified!"}
                  </h2>

                  <p>
                    {message}
                  </p>

                  <div className="verify-email-redirect-box">
                    <div className="verify-email-redirect-icon">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="9"
                        />
                        <path d="M12 7v5l3 2" />
                      </svg>
                    </div>

                    <div>
                      <strong>
                        Redirecting to login
                      </strong>

                      <span>
                        You will be redirected in{" "}
                        {countdown} second
                        {countdown !== 1 ? "s" : ""}.
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="verify-email-primary-btn"
                    onClick={() => navigate("/login")}
                  >
                    Go to Login
                    <span>→</span>
                  </button>
                </div>
              )}

              {status === "error" && (
                <div className="verify-email-state">
                  <div className="verify-email-icon verify-email-icon-error">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M18 6L6 18" />
                      <path d="M6 6l12 12" />
                    </svg>
                  </div>

                  <div className="verify-email-status-badge verify-email-status-error">
                    Verification Failed
                  </div>

                  <h2>
                    We Couldn't Verify This Link
                  </h2>

                  <p>
                    {message}
                  </p>

                  <div className="verify-email-divider">
                    <span>
                      Try another method
                    </span>
                  </div>

                  <div className="verify-email-alt-heading">
                    <div className="verify-email-alt-icon">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect
                          x="3"
                          y="5"
                          width="18"
                          height="14"
                          rx="2"
                        />
                        <path d="M3 7l9 6 9-6" />
                      </svg>
                    </div>

                    <div>
                      <h5>
                        Verify using your code
                      </h5>

                      <p>
                        Enter the email address used during registration
                        and the 6-digit code sent to your inbox.
                      </p>
                    </div>
                  </div>

                  {codeError && (
                    <div className="verify-email-error-box">
                      <div className="verify-email-error-box-icon">
                        !
                      </div>

                      <span>
                        {codeError}
                      </span>
                    </div>
                  )}

                  <form
                    onSubmit={handleCodeSubmit}
                    className="verify-email-form"
                  >
                    <div className="verify-email-field">
                      <label>
                        Email Address
                      </label>

                      <div className="verify-email-input-wrap">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect
                            x="3"
                            y="5"
                            width="18"
                            height="14"
                            rx="2"
                          />
                          <path d="M3 7l9 6 9-6" />
                        </svg>

                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Enter your email"
                          autoComplete="email"
                          required
                        />
                      </div>
                    </div>

                    <div className="verify-email-field">
                      <label>
                        6-Digit Verification Code
                      </label>

                      <div className="verify-email-code-input">
                        <input
                          type="text"
                          value={code}
                          onChange={(e) =>
                            setCode(
                              e.target.value
                                .replace(/\D/g, "")
                                .slice(0, 6)
                            )
                          }
                          maxLength={6}
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          placeholder="000000"
                          required
                        />

                        <span>
                          {code.length}/6
                        </span>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="verify-email-primary-btn"
                      disabled={codeSubmitting}
                    >
                      {codeSubmitting ? (
                        <>
                          <span
                            className="spinner-border spinner-border-sm"
                            role="status"
                          />
                          Verifying...
                        </>
                      ) : (
                        <>
                          Verify Email
                          <span>→</span>
                        </>
                      )}
                    </button>
                  </form>

                  <button
                    type="button"
                    className="verify-email-secondary-btn"
                    onClick={() => navigate("/login")}
                  >
                    Back to Login
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}