import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import Footer from "../../components/Footer";

export default function ForgotPassword() {
  const navigate = useNavigate();

  const [step, setStep] = useState("email");

  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);

  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] =
    useState(false);

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const inputRefs = useRef([]);

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  function getCode() {
    return digits.join("");
  }

  function handleDigitChange(index, value) {
    const clean = value.replace(/\D/g, "").slice(-1);

    const next = [...digits];
    next[index] = clean;

    setDigits(next);
    setError("");

    if (clean && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleDigitKeyDown(index, e) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }

    if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }

    if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(e) {
    e.preventDefault();

    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);

    if (!pasted) return;

    const next = ["", "", "", "", "", ""];

    pasted.split("").forEach((digit, index) => {
      next[index] = digit;
    });

    setDigits(next);
    setError("");

    const focusIndex = Math.min(pasted.length, 6) - 1;
    inputRefs.current[focusIndex]?.focus();
  }

  async function handleSendCode(e) {
    e.preventDefault();

    clearMessages();

    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);

    try {
      const res = await api.post("/password/forgot", {
        email: cleanEmail,
      });

      setSuccess(
        res.data?.message ||
          "A password reset code has been sent to your email."
      );

      setStep("code");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to send the password reset code. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleResendCode() {
    clearMessages();

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    setResending(true);

    try {
      const res = await api.post("/password/forgot", {
        email: email.trim(),
      });

      setSuccess(
        res.data?.message ||
          "A new password reset code has been sent to your email."
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to resend the reset code. Please try again."
      );
    } finally {
      setResending(false);
    }
  }

  async function handleVerifyCode(e) {
    e.preventDefault();

    clearMessages();

    const code = getCode();

    if (code.length !== 6) {
      setError("Please enter all 6 digits.");
      return;
    }

    setLoading(true);

    try {
      const res = await api.post("/password/verify-code", {
        email: email.trim(),
        code,
      });

      setSuccess(
        res.data?.message || "Code verified successfully."
      );

      setStep("reset");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Invalid or expired reset code. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();

    clearMessages();

    if (!password) {
      setError("Please enter your new password.");
      return;
    }

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (password !== passwordConfirmation) {
      setError("Password confirmation does not match.");
      return;
    }

    const code = getCode();

    setLoading(true);

    try {
      const res = await api.post("/password/reset", {
        email: email.trim(),
        code,
        password,
        password_confirmation: passwordConfirmation,
      });

      setSuccess(
        res.data?.message ||
          "Your password has been reset successfully."
      );

      setStep("success");
    } catch (err) {
      const errors = err.response?.data?.errors;

      if (errors) {
        setError(Object.values(errors).flat().join(" "));
      } else {
        setError(
          err.response?.data?.message ||
            "Unable to reset your password. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <nav className="navbar navbar-expand-lg sticky-top navbar-custom">
        <div className="container">
          <a className="navbar-brand navbar-brand-custom" href="/">
            <img src="/icons/sk-logo.jpg" alt="SK Logo" />

            <div className="brand-text">
              <h5>SK Barangay Mamatid</h5>
              <span>Educational Assistance System</span>
            </div>
          </a>
        </div>
      </nav>

      <main
        className="py-5"
        style={{
          minHeight: "calc(100vh - 80px)",
          background: "#f5f6f8",
        }}
      >
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-xl-5 col-lg-6 col-md-8">
              <div
                className="card card-custom border-0"
                style={{
                  borderRadius: "18px",
                  boxShadow: "0 10px 35px rgba(0,0,0,0.08)",
                  overflow: "hidden",
                }}
              >
                <div className="p-4 p-md-5">
                  <div className="text-center mb-3">
                    <img
                      src="/icons/sk-logo.jpg"
                      alt="SK Barangay Mamatid"
                      style={{
                        width: "68px",
                        height: "68px",
                        objectFit: "contain",
                      }}
                    />
                  </div>

                  {step === "email" && (
                    <>
                      <div className="text-center mb-4">
                        <h3
                          className="mb-2"
                          style={{
                            fontFamily: "'Hanken Grotesk', sans-serif",
                            fontWeight: 700,
                            color: "#222",
                          }}
                        >
                          Forgot Password?
                        </h3>

                        <p
                          className="text-muted mb-0"
                          style={{
                            fontSize: "14px",
                            lineHeight: 1.6,
                          }}
                        >
                          No worries. Enter the email address associated with
                          your account and we'll send you a verification code.
                        </p>
                      </div>

                      {error && (
                        <div
                          className="alert alert-danger py-2 px-3"
                          style={{
                            borderRadius: "9px",
                            fontSize: "13px",
                          }}
                        >
                          {error}
                        </div>
                      )}

                      <form onSubmit={handleSendCode}>
                        <div className="mb-4">
                          <label
                            className="form-label"
                            style={{
                              fontSize: "13px",
                              fontWeight: 600,
                              color: "#444",
                            }}
                          >
                            Email Address
                          </label>

                          <input
                            type="email"
                            className="form-control"
                            value={email}
                            onChange={(e) => {
                              setEmail(e.target.value);
                              setError("");
                            }}
                            placeholder="Enter your email address"
                            autoComplete="email"
                            style={{
                              minHeight: "50px",
                              borderRadius: "10px",
                              fontSize: "14px",
                            }}
                          />
                        </div>

                        <button
                          type="submit"
                          className="btn w-100 d-flex align-items-center justify-content-center gap-2"
                          disabled={loading}
                          style={{
                            minHeight: "48px",
                            background: "#b71c1c",
                            border: "none",
                            borderRadius: "10px",
                            color: "#fff",
                            fontSize: "14px",
                            fontWeight: 600,
                            boxShadow: "0 4px 12px rgba(183,28,28,0.18)",
                          }}
                        >
                          {loading ? (
                            <>
                              <span
                                className="spinner-border spinner-border-sm"
                                role="status"
                              />
                              Sending...
                            </>
                          ) : (
                            <>
                              Send Reset Code
                              <span>→</span>
                            </>
                          )}
                        </button>
                      </form>
                    </>
                  )}

                  {step === "code" && (
                    <>
                      <div className="text-center mb-4">
                        <h3
                          className="mb-2"
                          style={{
                            fontFamily: "'Hanken Grotesk', sans-serif",
                            fontWeight: 700,
                            color: "#222",
                          }}
                        >
                          Check Your Email
                        </h3>

                        <p
                          className="text-muted mb-1"
                          style={{ fontSize: "14px" }}
                        >
                          Enter the 6-digit password reset code sent to
                        </p>

                        <strong
                          style={{
                            fontSize: "14px",
                            color: "#333",
                          }}
                        >
                          {email}
                        </strong>
                      </div>

                      {success && (
                        <div
                          className="alert alert-success py-2 px-3"
                          style={{
                            borderRadius: "9px",
                            fontSize: "13px",
                          }}
                        >
                          {success}
                        </div>
                      )}

                      {error && (
                        <div
                          className="alert alert-danger py-2 px-3"
                          style={{
                            borderRadius: "9px",
                            fontSize: "13px",
                          }}
                        >
                          {error}
                        </div>
                      )}

                      <form onSubmit={handleVerifyCode}>
                        <div
                          className="d-flex justify-content-center gap-2 mb-4"
                          onPaste={handlePaste}
                        >
                          {digits.map((digit, index) => (
                            <input
                              key={index}
                              ref={(el) => {
                                inputRefs.current[index] = el;
                              }}
                              type="text"
                              inputMode="numeric"
                              maxLength={1}
                              value={digit}
                              onChange={(e) =>
                                handleDigitChange(index, e.target.value)
                              }
                              onKeyDown={(e) =>
                                handleDigitKeyDown(index, e)
                              }
                              autoComplete={
                                index === 0 ? "one-time-code" : "off"
                              }
                              className="form-control text-center"
                              style={{
                                width: "50px",
                                height: "56px",
                                padding: 0,
                                borderRadius: "9px",
                                fontSize: "21px",
                                fontWeight: 700,
                              }}
                            />
                          ))}
                        </div>

                        <button
                          type="submit"
                          className="btn w-100 d-flex align-items-center justify-content-center gap-2"
                          disabled={loading}
                          style={{
                            minHeight: "48px",
                            background: "#b71c1c",
                            border: "none",
                            borderRadius: "10px",
                            color: "#fff",
                            fontSize: "14px",
                            fontWeight: 600,
                          }}
                        >
                          {loading ? (
                            <>
                              <span
                                className="spinner-border spinner-border-sm"
                                role="status"
                              />
                              Verifying...
                            </>
                          ) : (
                            <>
                              Verify Code
                              <span>→</span>
                            </>
                          )}
                        </button>
                      </form>

                      <div className="text-center mt-4">
                        <span
                          className="text-muted"
                          style={{ fontSize: "13px" }}
                        >
                          Didn't receive the code?{" "}
                        </span>

                        <button
                          type="button"
                          className="btn p-0 align-baseline"
                          disabled={resending}
                          onClick={handleResendCode}
                          style={{
                            border: "none",
                            color: "#b71c1c",
                            background: "transparent",
                            fontSize: "13px",
                            fontWeight: 700,
                          }}
                        >
                          {resending ? "Sending..." : "Resend code"}
                        </button>
                      </div>

                      <div className="text-center mt-3">
                        <button
                          type="button"
                          className="btn p-0"
                          onClick={() => {
                            clearMessages();
                            setDigits(["", "", "", "", "", ""]);
                            setStep("email");
                          }}
                          style={{
                            border: "none",
                            background: "transparent",
                            color: "#777",
                            fontSize: "12px",
                            fontWeight: 600,
                          }}
                        >
                          ← Use another email address
                        </button>
                      </div>
                    </>
                  )}

                  {step === "reset" && (
                    <>
                      <div className="text-center mb-4">
                        <h3
                          className="mb-2"
                          style={{
                            fontFamily: "'Hanken Grotesk', sans-serif",
                            fontWeight: 700,
                            color: "#222",
                          }}
                        >
                          Create New Password
                        </h3>

                        <p
                          className="text-muted mb-0"
                          style={{
                            fontSize: "14px",
                            lineHeight: 1.6,
                          }}
                        >
                          Choose a new password for your account.
                        </p>
                      </div>

                      {error && (
                        <div
                          className="alert alert-danger py-2 px-3"
                          style={{
                            borderRadius: "9px",
                            fontSize: "13px",
                          }}
                        >
                          {error}
                        </div>
                      )}

                      <form onSubmit={handleResetPassword}>
                        <div className="mb-3">
                          <label
                            className="form-label"
                            style={{
                              fontSize: "13px",
                              fontWeight: 600,
                            }}
                          >
                            New Password
                          </label>

                          <div className="position-relative">
                            <input
                              type={showPassword ? "text" : "password"}
                              className="form-control"
                              value={password}
                              onChange={(e) => {
                                setPassword(e.target.value);
                                setError("");
                              }}
                              placeholder="Enter new password"
                              autoComplete="new-password"
                              style={{
                                minHeight: "50px",
                                borderRadius: "10px",
                                paddingRight: "48px",
                              }}
                            />

                            <button
                              type="button"
                              onClick={() =>
                                setShowPassword((current) => !current)
                              }
                              style={{
                                position: "absolute",
                                right: "14px",
                                top: "50%",
                                transform: "translateY(-50%)",
                                border: "none",
                                background: "transparent",
                                color: "#888",
                              }}
                            >
                              {showPassword ? "Hide" : "Show"}
                            </button>
                          </div>
                        </div>

                        <div className="mb-4">
                          <label
                            className="form-label"
                            style={{
                              fontSize: "13px",
                              fontWeight: 600,
                            }}
                          >
                            Confirm New Password
                          </label>

                          <div className="position-relative">
                            <input
                              type={
                                showPasswordConfirmation ? "text" : "password"
                              }
                              className="form-control"
                              value={passwordConfirmation}
                              onChange={(e) => {
                                setPasswordConfirmation(e.target.value);
                                setError("");
                              }}
                              placeholder="Confirm new password"
                              autoComplete="new-password"
                              style={{
                                minHeight: "50px",
                                borderRadius: "10px",
                                paddingRight: "48px",
                              }}
                            />

                            <button
                              type="button"
                              onClick={() =>
                                setShowPasswordConfirmation(
                                  (current) => !current
                                )
                              }
                              style={{
                                position: "absolute",
                                right: "14px",
                                top: "50%",
                                transform: "translateY(-50%)",
                                border: "none",
                                background: "transparent",
                                color: "#888",
                              }}
                            >
                              {showPasswordConfirmation ? "Hide" : "Show"}
                            </button>
                          </div>
                        </div>

                        <button
                          type="submit"
                          className="btn w-100 d-flex align-items-center justify-content-center gap-2"
                          disabled={loading}
                          style={{
                            minHeight: "48px",
                            background: "#b71c1c",
                            border: "none",
                            borderRadius: "10px",
                            color: "#fff",
                            fontWeight: 600,
                            fontSize: "14px",
                          }}
                        >
                          {loading ? (
                            <>
                              <span
                                className="spinner-border spinner-border-sm"
                                role="status"
                              />
                              Resetting...
                            </>
                          ) : (
                            "Reset Password"
                          )}
                        </button>
                      </form>
                    </>
                  )}

                  {step === "success" && (
                    <div className="text-center">
                      <div
                        className="d-flex align-items-center justify-content-center mx-auto mb-3"
                        style={{
                          width: "68px",
                          height: "68px",
                          borderRadius: "50%",
                          background: "#e8f5e9",
                          color: "#2e7d32",
                        }}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{
                            width: "31px",
                            height: "31px",
                          }}
                        >
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      </div>

                      <h3
                        className="mb-2"
                        style={{
                          fontWeight: 700,
                          color: "#222",
                        }}
                      >
                        Password Reset!
                      </h3>

                      <p
                        className="text-muted mb-4"
                        style={{
                          fontSize: "14px",
                          lineHeight: 1.6,
                        }}
                      >
                        Your password has been changed successfully. You can now
                        log in using your new password.
                      </p>

                      <button
                        type="button"
                        className="btn w-100"
                        onClick={() => navigate("/login")}
                        style={{
                          minHeight: "48px",
                          background: "#b71c1c",
                          color: "#fff",
                          border: "none",
                          borderRadius: "10px",
                          fontSize: "14px",
                          fontWeight: 600,
                        }}
                      >
                        Back to Login
                      </button>
                    </div>
                  )}

                  {step !== "success" && (
                    <div
                      className="text-center mt-4 pt-3"
                      style={{
                        borderTop: "1px solid #eeeeee",
                      }}
                    >
                      <button
                        type="button"
                        className="btn p-0"
                        onClick={() => navigate("/login")}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "#b71c1c",
                          fontSize: "13px",
                          fontWeight: 700,
                        }}
                      >
                        ← Back to Login
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}