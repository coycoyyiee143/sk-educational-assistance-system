import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../services/api";

export default function VerifyEmail() {
    const { id, hash } = useParams();
    const [status, setStatus] = useState("verifying");
    const [message, setMessage] = useState("Verifying your email address...");
    const [countdown, setCountdown] = useState(3);
    const navigate = useNavigate();

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
                                        <h4 className="text-success">Email Verified!</h4>
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
                                        <a href="/login" className="btn btn-custom mt-2">Go to Login</a>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <footer>
                <div className="container text-center">
                    <p className="mb-0">© 2026 Sangguniang Kabataan of Barangay Mamatid | Educational Assistance System</p>
                </div>
            </footer>
        </>
    );
}