import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../services/api";
import Footer from "../../components/Footer";
import { useAuth } from "../../context/AuthContext";

// Public page — the person clicking their email link is NOT logged in.
// Handles both first-time account setup and admin-initiated resets;
// the backend response copy differs slightly but this page's shape is
// the same either way (validate token -> show name -> set password).
export default function PersonnelSetup() {
    const { token } = useParams();
    const navigate = useNavigate();
    // Renamed to avoid colliding with the URL `token` above — this is
    // whatever auth token (if any) is currently active in this browser,
    // completely unrelated to the setup-link token.
    const { token: activeAuthToken, logout } = useAuth();

    // "checking" -> "invalid" | "form" -> "success"
    const [status, setStatus] = useState("checking");
    const [firstName, setFirstName] = useState("");
    const [invalidMessage, setInvalidMessage] = useState("");

    const [password, setPassword] = useState("");
    const [passwordConfirmation, setPasswordConfirmation] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [errorList, setErrorList] = useState([]);

    useEffect(() => {
        api.get(`/personnel/setup/${token}`)
            .then((res) => {
                setFirstName(res.data.first_name);
                setStatus("form");
            })
            .catch((err) => {
                setInvalidMessage(
                    err.response?.data?.message ||
                    "This link is invalid or has expired. Contact your SK admin for a new one."
                );
                setStatus("invalid");
            });
    }, [token]);

    const hasLength = password.length >= 8;
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");
        setErrorList([]);

        const passwordRule = /^(?=.*[a-z])(?=.*\d).{8,}$/;
        if (!passwordRule.test(password)) {
            setError("Password must be at least 8 characters, with a lowercase letter and a number.");
            return;
        }

        if (password !== passwordConfirmation) {
            setError("Passwords do not match.");
            return;
        }

        setLoading(true);

        try {
            await api.post(`/personnel/setup/${token}`, {
                password,
                password_confirmation: passwordConfirmation,
            });

            setStatus("success");

            // If someone happens to be logged in on this browser (e.g. they
            // opened this setup link from their own active session), clear
            // that session now — it has nothing to do with the account just
            // activated here, and leaving it active would bounce the next
            // /login straight to their old dashboard instead of showing the
            // login form for the newly-activated account.
            if (activeAuthToken) {
                try {
                    await api.post("/logout"); // invalidate server-side too
                } catch {
                    // ignore — token may already be invalid/expired, doesn't
                    // matter here, we're clearing local state regardless
                }
                logout();
            }
        } catch (err) {
            const errors = err.response?.data?.errors;

            if (errors) {
                const messages = Object.values(errors).flat();
                if (messages.length > 1) {
                    setErrorList(messages);
                } else {
                    setError(messages[0]);
                }
            } else {
                setError(err.response?.data?.message || "Unable to set your password. Please try again.");
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
                style={{ minHeight: "calc(100vh - 80px)", background: "#f5f6f8" }}
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
                                            style={{ width: "68px", height: "68px", objectFit: "contain" }}
                                        />
                                    </div>

                                    {status === "checking" && (
                                        <div className="text-center py-4">
                                            <div className="spinner-border text-danger" role="status" />
                                            <p className="text-muted mt-3 mb-0" style={{ fontSize: "14px" }}>
                                                Checking your link...
                                            </p>
                                        </div>
                                    )}

                                    {status === "invalid" && (
                                        <div className="text-center">
                                            <div
                                                className="d-flex align-items-center justify-content-center mx-auto mb-3"
                                                style={{
                                                    width: "68px",
                                                    height: "68px",
                                                    borderRadius: "50%",
                                                    background: "#fdecea",
                                                    color: "#b71c1c",
                                                }}
                                            >
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "30px", height: "30px" }}>
                                                    <circle cx="12" cy="12" r="10" />
                                                    <line x1="12" y1="8" x2="12" y2="12" />
                                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                                </svg>
                                            </div>

                                            <h3 className="mb-2" style={{ fontWeight: 700, color: "#222" }}>
                                                Link Invalid or Expired
                                            </h3>

                                            <p className="text-muted mb-4" style={{ fontSize: "14px", lineHeight: 1.6 }}>
                                                {invalidMessage}
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

                                    {status === "form" && (
                                        <>
                                            <div className="text-center mb-4">
                                                <h3 className="mb-2" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontWeight: 700, color: "#222" }}>
                                                    Welcome, {firstName}
                                                </h3>
                                                <p className="text-muted mb-0" style={{ fontSize: "14px", lineHeight: 1.6 }}>
                                                    Set your password to activate your account.
                                                </p>
                                            </div>

                                            {error && (
                                                <div className="alert alert-danger py-2 px-3" style={{ borderRadius: "9px", fontSize: "13px" }}>
                                                    {error}
                                                </div>
                                            )}

                                            {errorList.length > 0 && (
                                                <div className="alert alert-danger" style={{ borderRadius: "9px", padding: "14px 16px" }}>
                                                    <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "6px", color: "#842029" }}>
                                                        Your password needs a few changes
                                                    </div>
                                                    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                                                        {errorList.map((msg, i) => (
                                                            <li
                                                                key={i}
                                                                style={{
                                                                    display: "flex",
                                                                    alignItems: "flex-start",
                                                                    gap: "8px",
                                                                    padding: "5px 0",
                                                                    borderBottom: i < errorList.length - 1 ? "1px solid rgba(0,0,0,0.08)" : "none",
                                                                }}
                                                            >
                                                                <span style={{ color: "#dc3545", fontWeight: 700, flexShrink: 0 }}>✕</span>
                                                                <span style={{ fontSize: "13px" }}>{msg}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            <form onSubmit={handleSubmit}>
                                                <div className="mb-3">
                                                    <label className="form-label" style={{ fontSize: "13px", fontWeight: 600 }}>
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
                                                                setErrorList([]);
                                                            }}
                                                            placeholder="Enter your password"
                                                            autoComplete="new-password"
                                                            style={{ minHeight: "50px", borderRadius: "10px", paddingRight: "48px" }}
                                                            autoFocus
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowPassword((c) => !c)}
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

                                                    <div style={{ marginTop: "10px", padding: "10px 12px", background: "#f8f9fa", borderRadius: "8px" }}>
                                                        <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.03em", color: "#888", display: "block", marginBottom: "6px" }}>
                                                            PASSWORD REQUIREMENTS
                                                        </span>
                                                        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", color: hasLength ? "#218c46" : "#666" }}>
                                                            <span>{hasLength ? "✓" : "○"}</span>
                                                            <span>At least 8 characters</span>
                                                        </div>
                                                        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", color: hasLowercase ? "#218c46" : "#666" }}>
                                                            <span>{hasLowercase ? "✓" : "○"}</span>
                                                            <span>A lowercase letter</span>
                                                        </div>
                                                        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", color: hasNumber ? "#218c46" : "#666" }}>
                                                            <span>{hasNumber ? "✓" : "○"}</span>
                                                            <span>At least one number</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="mb-4">
                                                    <label className="form-label" style={{ fontSize: "13px", fontWeight: 600 }}>
                                                        Confirm Password
                                                    </label>

                                                    <div className="position-relative">
                                                        <input
                                                            type={showPasswordConfirmation ? "text" : "password"}
                                                            className="form-control"
                                                            value={passwordConfirmation}
                                                            onChange={(e) => {
                                                                setPasswordConfirmation(e.target.value);
                                                                setError("");
                                                                setErrorList([]);
                                                            }}
                                                            placeholder="Confirm your password"
                                                            autoComplete="new-password"
                                                            style={{ minHeight: "50px", borderRadius: "10px", paddingRight: "48px" }}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowPasswordConfirmation((c) => !c)}
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

                                                    {passwordConfirmation && (
                                                        password === passwordConfirmation ? (
                                                            <span style={{ fontSize: "12.5px", color: "#218c46", marginTop: "6px", display: "inline-block" }}>
                                                                ✓ Passwords match
                                                            </span>
                                                        ) : (
                                                            <span style={{ fontSize: "12.5px", color: "#dc3545", marginTop: "6px", display: "inline-block" }}>
                                                                ✕ Passwords do not match
                                                            </span>
                                                        )
                                                    )}
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
                                                            <span className="spinner-border spinner-border-sm" role="status" />
                                                            Setting Password...
                                                        </>
                                                    ) : (
                                                        "Set Password & Activate Account"
                                                    )}
                                                </button>
                                            </form>
                                        </>
                                    )}

                                    {status === "success" && (
                                        <div className="text-center">
                                            <div
                                                className="d-flex align-items-center justify-content-center mx-auto mb-3"
                                                style={{ width: "68px", height: "68px", borderRadius: "50%", background: "#e8f5e9", color: "#2e7d32" }}
                                            >
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "31px", height: "31px" }}>
                                                    <path d="M20 6L9 17l-5-5" />
                                                </svg>
                                            </div>

                                            <h3 className="mb-2" style={{ fontWeight: 700, color: "#222" }}>
                                                Account Activated!
                                            </h3>

                                            <p className="text-muted mb-4" style={{ fontSize: "14px", lineHeight: 1.6 }}>
                                                Your password has been set. You can now log in — you'll also
                                                be asked to set up your authenticator app on first login.
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
                                                Go to Login
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