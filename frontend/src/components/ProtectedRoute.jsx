import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ children, allowedRoles }) => {
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

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        // Redirect to their correct dashboard if they access wrong role's page
        if (user.role === "sk_admin") return <Navigate to="/AdminDashboard" replace />;
        if (user.role === "sk_verifier") return <Navigate to="/VerifierDashboard" replace />;
        return <Navigate to="/ApplicantDashboard" replace />;
    }

    return children;
};

export default ProtectedRoute;