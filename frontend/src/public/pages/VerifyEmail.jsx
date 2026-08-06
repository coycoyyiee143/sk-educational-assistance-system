import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../services/api";
import Footer from "../../components/Footer";


export default function VerifyEmail() {
    const { id, hash } = useParams();
    const [status, setStatus] = useState("verifying");
    const [message, setMessage] = useState("Verifying your email address...");
    const [countdown, setCountdown] = useState(3);
    const navigate = useNavigate();

    // Fallback "verify by code" form state
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [codeSubmitting, setCodeSubmitting] = useState(false);
    const [codeError, setCodeError] = useState("");

    useEffect(() => {
        api.post(`/email/verify/${id}/${hash}`)
            .then((res) => {
                setStatus("success");
                setMessage(res.data.message || "Email verified successfully!");
            })
            .catch((err) => {
                setStatus("error");
                setMessage(err.response?.data?.message || "Verification failed. The link may be invalid or expired.");
            });
    }, [id, hash]);

    // Only starts counting down once verification succeeds
    useEffect(() => {
        if (status !== "success") return;

        if (countdown === 0) {
            navigate("/login");
            return;
        }

        const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [status, countdown, navigate]);

    async function handleCodeSubmit(e) {
        e.preventDefault();
        setCodeError("");
        setCodeSubmitting(true);
        try {
            const res = await api.post("/email/verify-by-code", { email, code });
            setStatus("success");
            setMessage(res.data.message || "Email verified successfully!");
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
                                <img src="/logo.png" alt="logo" style={{ width: "80px", marginBottom: "10px" }} />

                                {status === "verifying" && (
                                    <>
                                        <div className="spinner-border text-danger mb-3" role="status" />
                                        <h4>Verifying your email...</h4>
                                        <p className="text-muted">Please wait a moment.</p>
                                    </>
                                )}

                                {status === "success" && (
                                    <>
                                        <div className="text-success mb-3" style={{ fontSize: "48px" }}>✓</div>
                                        <h4 className="text-success">
                                            {message === "Email already verified." ? "Already Verified" : "Email Verified!"}
                                        </h4>
                                        <p className="text-muted">{message}</p>
                                        <p className="text-muted small">
                                            Redirecting to login in {countdown} second{countdown !== 1 ? "s" : ""}...
                                        </p>
                                        <a href="/login" className="btn btn-custom mt-2">Go to Login</a>
                                    </>
                                )}

                                {status === "error" && (
                                    <>
                                        <div className="text-danger mb-3" style={{ fontSize: "48px" }}>✕</div>
                                        <h4 className="text-danger">Verification Failed</h4>
                                        <p className="text-muted">{message}</p>

                                        <hr className="my-3" />

                                        <p className="text-muted small mb-2">
                                            Opened this email on a different device? Enter your email and the
                                            6-digit code sent to your inbox instead.
                                        </p>

                                        {codeError && <div className="alert alert-danger py-2">{codeError}</div>}

                                        <form onSubmit={handleCodeSubmit} className="text-start">
                                            <div className="mb-2">
                                                <label className="form-label small">Email</label>
                                                <input
                                                    type="email"
                                                    className="form-control"
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    required
                                                />
                                            </div>
                                            <div className="mb-3">
                                                <label className="form-label small">6-Digit Code</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    value={code}
                                                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                                    maxLength={6}
                                                    inputMode="numeric"
                                                    placeholder="123456"
                                                    required
                                                />
                                            </div>
                                            <button type="submit" className="btn btn-custom w-100" disabled={codeSubmitting}>
                                                {codeSubmitting ? "Verifying..." : "Verify with Code"}
                                            </button>
                                        </form>

                                        <a href="/login" className="btn btn-outline-custom mt-3">Go to Login</a>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </>
    );
}