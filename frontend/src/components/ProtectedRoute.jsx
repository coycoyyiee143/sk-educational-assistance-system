import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ children, allowedRoles }) => {
    // `loading` (the one-time "have we checked localStorage for a saved
    // session yet" flag) is gated once in App.js, above <Routes> — this
    // component mounts fresh on every route switch, so checking it here
    // too would flash this route's own loading screen on every single
    // in-app navigation instead of just once on the initial page load.
    const { user } = useAuth();

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        // Redirect to their correct dashboard if they access wrong role's page
        if (user.role === "sk_admin" || user.role === "superadmin") return <Navigate to="/AdminDashboard" replace />;
        if (user.role === "it_support") return <Navigate to="/AdminUsers" replace />;
        if (user.role === "sk_verifier") return <Navigate to="/VerifierDashboard" replace />;
        return <Navigate to="/ApplicantDashboard" replace />;
    }

    return children;
};

export default ProtectedRoute;