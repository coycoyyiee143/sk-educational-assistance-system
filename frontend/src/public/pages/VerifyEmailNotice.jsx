import React, { useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../../services/api";
import Footer from "../../components/Footer";

export default function VerifyEmailNotice() {
    const location = useLocation();
    const navigate = useNavigate();
    const email = location.state?.email ?? "";

    const [showLinkView, setShowLinkView] = useState(false);

    const [resending, setResending] = useState(false);
    const [resendMsg, setResendMsg] = useState("");
    const [resendError, setResendError] = useState("");

    const [codeEmail] = useState(email);
    const [digits, setDigits] = useState(["", "", "", "", "", ""]);
    const [codeSubmitting, setCodeSubmitting] = useState(false);
    const [codeError, setCodeError] = useState("");
    const [codeSuccess, setCodeSuccess] = useState("");
    const inputRefs = useRef([]);

    function handleDigitChange(index, value) {
        const clean = value.replace(/\D/g, "").slice(-1);
        const next = [...digits];
        next[index] = clean;
        setDigits(next);

        if (clean && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    }

    function handleDigitKeyDown(index, e) {
        if (e.key === "Backspace" && !digits[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    }

    function handlePaste(e) {
        const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
        if (pasted.length === 6) {
            setDigits(pasted.split(""));
            inputRefs.current[5]?.focus();
        }
        e.preventDefault();
    }

    async function handleResend() {
        if (!email) {
            setResendError("Could not determine your email. Please register again.");
            return;
        }
        setResending(true);
        setResendMsg("");
        setResendError("");
        try {
            await api.post("/email/resend", { email });
            setResendMsg("Verification email resent! Please check your inbox.");
        } catch (err) {
            setResendError(err.response?.data?.message || "Failed to resend. Please try again.");
        } finally {
            setResending(false);
        }
    }

    async function handleCodeSubmit(e) {
        e.preventDefault();
        setCodeError("");
        setCodeSuccess("");

        const code = digits.join("");
        if (code.length !== 6) {
            setCodeError("Please enter all 6 digits.");
            return;
        }

        setCodeSubmitting(true);
        try {
            const res = await api.post("/email/verify-by-code", { email: codeEmail, code });
            setCodeSuccess(res.data.message || "Email verified successfully!");
            setTimeout(() => navigate("/login"), 2000);
        } catch (err) {
            setCodeError(err.response?.data?.message || "Invalid or expired code. Please try again.");
        } finally {
            setCodeSubmitting(false);
        }
    }

    return (
        <>
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

            <section className="py-5">
                <div className="container">
                    <div className="row justify-content-center">
                        <div className="col-md-5">
                            <div className="card card-custom p-4 text-center">
                                <img src="/logo.png" alt="logo" style={{ width: "60px", margin: "0 auto 10px" }} />
                                <div style={{ fontSize: "40px" }}>📧</div>
                                <h3 className="text-danger mt-2 mb-2">Check Your Email</h3>

                                {!showLinkView && (
                                    <p className="text-muted mb-2">
                                        A code was sent to <strong>{email || "your email address"}</strong>
                                    </p>
                                )}

                                {showLinkView && (
                                    <p className="text-muted mb-2">
                                        We sent a verification link to <strong>{email || "your email address"}</strong>
                                    </p>
                                )}

                                <button
                                    type="button"
                                    className="btn btn-link p-0 mb-3"
                                    style={{ color: "#b71c1c", fontWeight: 600, textDecoration: "none" }}
                                    onClick={() => setShowLinkView(!showLinkView)}
                                >
                                    {showLinkView ? "Switch to Code Verification" : "Switch to Link Verification"}
                                </button>

                                <hr className="mb-4" />

                                {/* Link verification view */}
                                {showLinkView && (
                                    <div className="text-start">
                                        <p className="text-muted small mb-3 text-center">
                                            Open your inbox and click the verification button in the email
                                            to activate your account.
                                        </p>

                                        <div className="alert alert-warning py-2 mb-3">
                                            <strong>Note:</strong> If you don't see the email, check your spam
                                            or junk folder.
                                        </div>

                                        {resendMsg && <div className="alert alert-success py-2">{resendMsg}</div>}
                                        {resendError && <div className="alert alert-danger py-2">{resendError}</div>}

                                        <button
                                            className="btn btn-custom w-100"
                                            onClick={handleResend}
                                            disabled={resending}
                                        >
                                            {resending ? "Resending..." : "Resend Verification Email"}
                                        </button>
                                    </div>
                                )}

                                {/* Code verification view */}
                                {!showLinkView && (
                                    <div>
                                

                                        {codeSuccess && <div className="alert alert-success py-2">{codeSuccess}</div>}
                                        {codeError && <div className="alert alert-danger py-2">{codeError}</div>}
                                        {resendMsg && <div className="alert alert-success py-2">{resendMsg}</div>}
                                        {resendError && <div className="alert alert-danger py-2">{resendError}</div>}

                                        <form onSubmit={handleCodeSubmit}>
                                            <div className="d-flex justify-content-center gap-2 mb-3">
                                                {digits.map((d, i) => (
                                                    <input
                                                        key={i}
                                                        ref={(el) => (inputRefs.current[i] = el)}
                                                        type="text"
                                                        inputMode="numeric"
                                                        maxLength={1}
                                                        value={d}
                                                        onChange={(e) => handleDigitChange(i, e.target.value)}
                                                        onKeyDown={(e) => handleDigitKeyDown(i, e)}
                                                        onPaste={i === 0 ? handlePaste : undefined}
                                                        className="form-control text-center"
                                                        style={{
                                                            width: "44px",
                                                            height: "52px",
                                                            fontSize: "22px",
                                                            fontWeight: 600,
                                                            padding: 0,
                                                        }}
                                                    />
                                                ))}
                                            </div>


                                            <button type="submit" className="btn btn-custom w-100" disabled={codeSubmitting}>
                                                {codeSubmitting ? "Verifying..." : "Verify"}
                                            </button>
                                        </form>

                                        <p className="text-muted small mt-3 mb-1">Didn't receive a code?</p>
                                        <button
                                            type="button"
                                            className="btn btn-outline-custom w-100"
                                            onClick={handleResend}
                                            disabled={resending}
                                        >
                                            {resending ? "Resending..." : "Resend Code"}
                                        </button>
                                    </div>
                                )}
                                <p className="mt-4 mb-0 small">
                                    Already verified? <a href="/login">Login here</a>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </>
    );
}