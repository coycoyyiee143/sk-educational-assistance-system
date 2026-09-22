import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Opposite of ProtectedRoute: blocks routes meant for logged-OUT users
// (Login, Register) from a user who's already signed in. Sends them to
// their role's dashboard instead of showing the login/register form.
const GuestRoute = ({ children }) => {
    // See ProtectedRoute.jsx — `loading` is gated once in App.js, above
    // <Routes>, so it isn't re-checked here on every route mount.
    const { user } = useAuth();

    if (user) {
        if (user.role === "sk_admin" || user.role === "superadmin") return <Navigate to="/AdminDashboard" replace />;
        if (user.role === "it_support") return <Navigate to="/AdminUsers" replace />;
        if (user.role === "sk_verifier") return <Navigate to="/VerifierDashboard" replace />;
        return <Navigate to="/ApplicantDashboard" replace />;
    }

    return children;
};

export default GuestRoute;