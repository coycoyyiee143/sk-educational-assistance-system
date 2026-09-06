import React, { useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../../services/api";
import Footer from "../../components/Footer";

export default function VerifyEmailNotice() {
  const location = useLocation();
  const navigate = useNavigate();

  const email = location.state?.email ?? "";

  const [showLinkView, setShowLinkView] = useState(false);

  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [codeSubmitting, setCodeSubmitting] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [codeSuccess, setCodeSuccess] = useState("");

  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState("");
  const [resendError, setResendError] = useState("");

  const inputRefs = useRef([]);

  /* =========================
     OTP INPUT
  ========================= */

  function handleDigitChange(index, value) {
    const clean = value.replace(/\D/g, "").slice(-1);

    const nextDigits = [...digits];
    nextDigits[index] = clean;

    setDigits(nextDigits);
    setCodeError("");

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

    const nextDigits = ["", "", "", "", "", ""];

    pasted.split("").forEach((digit, index) => {
      nextDigits[index] = digit;
    });

    setDigits(nextDigits);
    setCodeError("");

    const focusIndex = Math.min(pasted.length, 6) - 1;
    inputRefs.current[focusIndex]?.focus();
  }

  /* =========================
     SWITCH VERIFICATION METHOD
  ========================= */

  function handleSwitchMethod() {
    setShowLinkView((current) => !current);

    setCodeError("");
    setCodeSuccess("");
    setResendMsg("");
    setResendError("");
  }

  /* =========================
     RESEND
  ========================= */

  async function handleResend() {
    if (!email) {
      setResendError(
        "Could not determine your email address. Please register again."
      );
      return;
    }

    setResending(true);
    setResendMsg("");
    setResendError("");
    setCodeError("");

    try {
      await api.post("/email/resend", { email });

      setResendMsg(
        showLinkView
          ? "A new verification email has been sent. Please check your inbox."
          : "A new verification code has been sent to your email."
      );
    } catch (err) {
      setResendError(
        err.response?.data?.message ||
          "Failed to resend the verification email. Please try again."
      );
    } finally {
      setResending(false);
    }
  }

  /* =========================
     VERIFY CODE
  ========================= */

  async function handleCodeSubmit(e) {
    e.preventDefault();

    setCodeError("");
    setCodeSuccess("");
    setResendMsg("");
    setResendError("");

    if (!email) {
      setCodeError(
        "Could not determine your email address. Please register again."
      );
      return;
    }

    const code = digits.join("");

    if (code.length !== 6) {
      setCodeError("Please enter all 6 digits.");
      return;
    }

    setCodeSubmitting(true);

    try {
      const res = await api.post("/email/verify-by-code", {
        email,
        code,
      });

      setCodeSuccess(
        res.data?.message || "Email verified successfully!"
      );

      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (err) {
      setCodeError(
        err.response?.data?.message ||
          "Invalid or expired verification code. Please try again."
      );
    } finally {
      setCodeSubmitting(false);
    }
  }

  return (
    <>
      {/* =========================
          NAVBAR
      ========================= */}

      <nav className="navbar navbar-expand-lg sticky-top navbar-custom">
        <div className="container">
          <a className="navbar-brand navbar-brand-custom" href="/">
            <img src="/logo.png" alt="SK Logo" />

            <div className="brand-text">
              <h5>SK Barangay Mamatid</h5>
              <span>Educational Assistance System</span>
            </div>
          </a>
        </div>
      </nav>

      {/* =========================
          PAGE
      ========================= */}

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
                  boxShadow: "0 10px 35px rgba(0, 0, 0, 0.08)",
                  overflow: "hidden",
                }}
              >
                <div className="p-4 p-md-5">

                  {/* LOGO */}

                  <div className="text-center mb-3">
                    <img
                      src="/logo.png"
                      alt="SK Barangay Mamatid"
                      style={{
                        width: "68px",
                        height: "68px",
                        objectFit: "contain",
                      }}
                    />
                  </div>

                  {/* EMAIL ICON */}

                  <div
                    className="d-flex align-items-center justify-content-center mx-auto mb-3"
                    style={{
                      width: "62px",
                      height: "62px",
                      borderRadius: "50%",
                      background: "#fcebec",
                      color: "#b71c1c",
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{
                        width: "29px",
                        height: "29px",
                      }}
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

                  {/* HEADER */}

                  <div className="text-center">
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
                      style={{
                        fontSize: "14px",
                        lineHeight: 1.6,
                      }}
                    >
                      {showLinkView
                        ? "We sent a verification link to"
                        : "We sent a 6-digit verification code to"}
                    </p>

                    <div
                      className="mb-3"
                      style={{
                        fontSize: "14px",
                        fontWeight: 700,
                        color: "#333",
                        wordBreak: "break-word",
                      }}
                    >
                      {email || "your email address"}
                    </div>

                    <button
                      type="button"
                      className="btn p-0"
                      onClick={handleSwitchMethod}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "#b71c1c",
                        fontSize: "13px",
                        fontWeight: 600,
                      }}
                    >
                      {showLinkView
                        ? "← Use verification code instead"
                        : "Prefer email link? Use verification link →"}
                    </button>
                  </div>

                  <hr
                    className="my-4"
                    style={{
                      opacity: 0.1,
                    }}
                  />

                  {/* =========================
                      FEEDBACK
                  ========================= */}

                  {codeSuccess && (
                    <div
                      className="alert alert-success py-2 px-3 mb-3"
                      style={{
                        fontSize: "13px",
                        borderRadius: "9px",
                      }}
                    >
                      {codeSuccess}
                    </div>
                  )}

                  {codeError && (
                    <div
                      className="alert alert-danger py-2 px-3 mb-3"
                      style={{
                        fontSize: "13px",
                        borderRadius: "9px",
                      }}
                    >
                      {codeError}
                    </div>
                  )}

                  {resendMsg && (
                    <div
                      className="alert alert-success py-2 px-3 mb-3"
                      style={{
                        fontSize: "13px",
                        borderRadius: "9px",
                      }}
                    >
                      {resendMsg}
                    </div>
                  )}

                  {resendError && (
                    <div
                      className="alert alert-danger py-2 px-3 mb-3"
                      style={{
                        fontSize: "13px",
                        borderRadius: "9px",
                      }}
                    >
                      {resendError}
                    </div>
                  )}

                  {/* =========================
                      CODE VERIFICATION
                  ========================= */}

                  {!showLinkView && (
                    <>
                      <form onSubmit={handleCodeSubmit}>
                        <label
                          className="d-block text-center mb-3"
                          style={{
                            color: "#555",
                            fontSize: "13px",
                            fontWeight: 600,
                          }}
                        >
                          Enter your verification code
                        </label>

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
                              autoComplete={
                                index === 0 ? "one-time-code" : "off"
                              }
                              value={digit}
                              onChange={(e) =>
                                handleDigitChange(index, e.target.value)
                              }
                              onKeyDown={(e) =>
                                handleDigitKeyDown(index, e)
                              }
                              aria-label={`Verification digit ${index + 1}`}
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

                        {/* PRIMARY BUTTON */}

                        <button
                          type="submit"
                          className="btn w-100 d-flex align-items-center justify-content-center gap-2"
                          disabled={codeSubmitting}
                          style={{
                            minHeight: "48px",
                            border: "none",
                            borderRadius: "10px",
                            background: "#b71c1c",
                            color: "#fff",
                            fontSize: "14px",
                            fontWeight: 600,
                            boxShadow:
                              "0 4px 12px rgba(183, 28, 28, 0.18)",
                          }}
                        >
                          {codeSubmitting ? (
                            <>
                              <span
                                className="spinner-border spinner-border-sm"
                                role="status"
                                aria-hidden="true"
                              />

                              Verifying...
                            </>
                          ) : (
                            <>
                              Verify Email

                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{
                                  width: "17px",
                                  height: "17px",
                                }}
                              >
                                <path d="M5 12h14" />
                                <path d="M13 6l6 6-6 6" />
                              </svg>
                            </>
                          )}
                        </button>
                      </form>

                      {/* RESEND CODE */}

                      <div className="text-center mt-4">
                        <span
                          className="text-muted"
                          style={{
                            fontSize: "13px",
                          }}
                        >
                          Didn't receive the code?{" "}
                        </span>

                        <button
                          type="button"
                          className="btn p-0 align-baseline"
                          onClick={handleResend}
                          disabled={resending}
                          style={{
                            border: "none",
                            background: "transparent",
                            color: "#b71c1c",
                            fontSize: "13px",
                            fontWeight: 700,
                          }}
                        >
                          {resending ? (
                            <>
                              <span
                                className="spinner-border spinner-border-sm me-1"
                                role="status"
                                aria-hidden="true"
                                style={{
                                  width: "11px",
                                  height: "11px",
                                }}
                              />

                              Sending...
                            </>
                          ) : (
                            "Resend code"
                          )}
                        </button>
                      </div>
                    </>
                  )}

                  {/* =========================
                      LINK VERIFICATION
                  ========================= */}

                  {showLinkView && (
                    <div>
                      <div
                        className="mb-4 p-3"
                        style={{
                          borderRadius: "10px",
                          border: "1px solid #f0dfac",
                          background: "#fff9e8",
                        }}
                      >
                        <div className="d-flex gap-3">
                          <div
                            className="d-flex align-items-center justify-content-center flex-shrink-0"
                            style={{
                              width: "32px",
                              height: "32px",
                              borderRadius: "50%",
                              background: "#fff1bd",
                              color: "#8a6500",
                              fontSize: "15px",
                              fontWeight: 700,
                            }}
                          >
                            !
                          </div>

                          <div>
                            <strong
                              className="d-block mb-1"
                              style={{
                                color: "#715500",
                                fontSize: "13px",
                              }}
                            >
                              Check your inbox
                            </strong>

                            <p
                              className="mb-0"
                              style={{
                                color: "#786535",
                                fontSize: "12px",
                                lineHeight: 1.6,
                              }}
                            >
                              Open the verification email and click the
                              verification button to activate your account.
                              If you can't find the email, check your spam or
                              junk folder.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* RESEND EMAIL BUTTON */}

                      <button
                        type="button"
                        className="btn w-100 d-flex align-items-center justify-content-center gap-2"
                        onClick={handleResend}
                        disabled={resending}
                        style={{
                          minHeight: "48px",
                          border: "none",
                          borderRadius: "10px",
                          background: "#b71c1c",
                          color: "#fff",
                          fontSize: "14px",
                          fontWeight: 600,
                          boxShadow:
                            "0 4px 12px rgba(183, 28, 28, 0.18)",
                        }}
                      >
                        {resending ? (
                          <>
                            <span
                              className="spinner-border spinner-border-sm"
                              role="status"
                              aria-hidden="true"
                            />

                            Resending...
                          </>
                        ) : (
                          <>
                            Resend Verification Email

                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              style={{
                                width: "17px",
                                height: "17px",
                              }}
                            >
                              <path d="M4 4v6h6" />
                              <path d="M20 20v-6h-6" />
                              <path d="M5.1 15a8 8 0 0 0 13.2 2" />
                              <path d="M18.9 9A8 8 0 0 0 5.7 7" />
                            </svg>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* =========================
                      LOGIN
                  ========================= */}

                  <div
                    className="text-center mt-4 pt-3"
                    style={{
                      borderTop: "1px solid #eeeeee",
                    }}
                  >
                    <span
                      className="text-muted"
                      style={{
                        fontSize: "13px",
                      }}
                    >
                      Already verified?{" "}
                    </span>

                    <button
                      type="button"
                      className="btn p-0 align-baseline"
                      onClick={() => navigate("/login")}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "#b71c1c",
                        fontSize: "13px",
                        fontWeight: 700,
                      }}
                    >
                      Login here
                    </button>
                  </div>

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