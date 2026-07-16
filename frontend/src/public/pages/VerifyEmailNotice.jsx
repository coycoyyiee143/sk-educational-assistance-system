import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../../services/api";
import Footer from "../../components/Footer";


export default function VerifyEmailNotice() {
    const location = useLocation();
    const email = location.state?.email ?? "";
    const [resending, setResending] = useState(false);
    const [resendMsg, setResendMsg] = useState("");
    const [resendError, setResendError] = useState("");

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
                        <div className="col-md-6">
                            <div className="card card-custom p-4 text-center">
                                <img src="/logo.png" alt="logo" style={{ width: "80px", marginBottom: "10px" }} />

                                <div style={{ fontSize: "52px" }}>📧</div>
                                <h3 className="text-danger mt-2">Check Your Email</h3>
                                <p className="text-muted">
                                    We sent a verification link to <strong>{email || "your email address"}</strong>.
                                    Click the link in the email to verify your account before logging in.
                                </p>

                                <div className="alert alert-warning py-2 mt-2">
                                    <strong>Note:</strong> If you don't see the email, check your spam or junk folder.
                                </div>

                                {resendMsg && <div className="alert alert-success">{resendMsg}</div>}
                                {resendError && <div className="alert alert-danger">{resendError}</div>}

                                <hr />

                                <p className="text-muted small">Didn't receive the email?</p>
                                <button
                                    className="btn btn-custom"
                                    onClick={handleResend}
                                    disabled={resending}
                                >
                                    {resending ? "Resending..." : "Resend Verification Email"}
                                </button>

                                <p className="mt-3 small">
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