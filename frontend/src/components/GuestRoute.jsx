import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Opposite of ProtectedRoute: blocks routes meant for logged-OUT users
// (Login, Register) from a user who's already signed in. Sends them to
// their role's dashboard instead of showing the login/register form.
const GuestRoute = ({ children }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ height: "100vh" }}>
                <div className="spinner-border text-danger" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    if (user) {
        if (user.role === "sk_admin") return <Navigate to="/AdminDashboard" replace />;
        if (user.role === "sk_verifier") return <Navigate to="/VerifierDashboard" replace />;
        return <Navigate to="/ApplicantDashboard" replace />;
    }

    return children;
};

export default GuestRoute;