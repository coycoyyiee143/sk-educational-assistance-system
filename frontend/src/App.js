import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import GuestRoute from "./components/GuestRoute";
import { useAuth } from "./context/AuthContext";

import Home from "./public/pages/Home";
import Requirements from "./public/pages/Requirements";
import Announcements from "./public/pages/Announcements";
import Events from "./public/pages/Events";
import Login from "./public/pages/Login";
import Register from "./public/pages/Register";
import VerifyEmail from "./public/pages/VerifyEmail.jsx";
import VerifyEmailNotice from "./public/pages/VerifyEmailNotice";
import ForgotPassword from "./public/pages/ForgotPassword";
import PersonnelSetup from "./public/pages/PersonnelSetup";
import NotFound from "./public/pages/NotFound";

import AdminDashboard from "./admin/pages/AdminDashboard";
import AdminUsers from "./admin/pages/AdminUsers";
import AdminSettings from "./admin/pages/AdminSettings";
import AdminSchedule from "./admin/pages/AdminSchedule";
import AdminAnnouncements from "./admin/pages/AdminAnnouncements.jsx";
import AdminEvents from "./admin/pages/AdminEvents.jsx";
import AdminReports from "./admin/pages/AdminReports.jsx";
import AdminBudgetPlanning from "./admin/pages/AdminBudgetPlanning.jsx";
import AdminMasterActivityLog from "./admin/pages/AdminMasterActivityLog";
import AdminSystemMaintenance from "./admin/pages/AdminSystemMaintenance.jsx";

import VerifierDashboard from "./verifier/pages/VerifierDashboard.jsx";
import VerifierApplicationList from "./verifier/pages/VerifierApplicationList.jsx";
import VerifierApplicationReview from "./verifier/pages/VerifierApplicationReview.jsx";
import VerifierVerificationAction from "./verifier/pages/VerifierVerificationAction.jsx";
import VerifierClaiming from "./verifier/pages/VerifierClaiming.jsx";
import VerifierProfile from "./verifier/pages/VerifierProfile.jsx";
import VerifierWaitlist from "./verifier/pages/VerifierWaitlist.jsx";

import ApplicantDashboard from "./applicant/pages/ApplicantDashboard.jsx";
import ApplicantProfile from "./applicant/pages/ApplicantProfile.jsx";
import ApplicantSubmission from "./applicant/pages/ApplicantSubmission.jsx";
import ApplicantStatus from "./applicant/pages/ApplicantStatus.jsx";
import ApplicantClaimingSchedule from "./applicant/pages/ApplicantClaimingSchedule.jsx";


function App() {
  const { loading } = useAuth();

  // Gated here, once, above <Routes> — every route below (each wrapped
  // in its own ProtectedRoute/GuestRoute) mounts fresh on every in-app
  // navigation, so checking `loading` inside those instead of here used
  // to re-flash this same full-screen spinner on every sidebar click,
  // not just on the app's actual first load.
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: "100vh" }}>
        <div className="spinner-border text-danger" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>

        {/* Public */}
        <Route path="/" element={
          <GuestRoute><Home /></GuestRoute>
        } />
        <Route path="/requirements" element={
          <GuestRoute><Requirements /></GuestRoute>
        } />
        <Route path="/announcements" element={
          <GuestRoute><Announcements /></GuestRoute>
        } />
        <Route path="/events" element={
          <GuestRoute><Events /></GuestRoute>
        } />
        <Route path="/login" element={
          <GuestRoute><Login /></GuestRoute>
        } />
        <Route path="/register" element={
          <GuestRoute><Register /></GuestRoute>
        } />
        <Route path="/verify-email/:id/:hash" element={<VerifyEmail />} />
        <Route path="/verify-email-notice" element={<VerifyEmailNotice />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/personnel/setup/:token" element={<PersonnelSetup />} />

        {/* Admin */}
        <Route path="/AdminDashboard" element={
          <ProtectedRoute allowedRoles={["superadmin", "sk_admin"]}>
            <AdminDashboard />
          </ProtectedRoute>
        } />
        <Route path="/AdminUsers" element={
          <ProtectedRoute allowedRoles={["superadmin", "it_support"]}>
            <AdminUsers />
          </ProtectedRoute>
        } />
        <Route path="/AdminSettings" element={
          <ProtectedRoute allowedRoles={["superadmin", "sk_admin"]}>
            <AdminSettings />
          </ProtectedRoute>
        } />
        <Route path="/AdminSchedule" element={
          <ProtectedRoute allowedRoles={["superadmin", "sk_admin"]}>
            <AdminSchedule />
          </ProtectedRoute>
        } />
        <Route path="/AdminAnnouncements" element={
          <ProtectedRoute allowedRoles={["superadmin", "sk_admin"]}>
            <AdminAnnouncements />
          </ProtectedRoute>
        } />
        <Route path="/AdminEvents" element={
          <ProtectedRoute allowedRoles={["superadmin", "sk_admin"]}>
            <AdminEvents />
          </ProtectedRoute>
        } />
        <Route path="/AdminReports" element={
          <ProtectedRoute allowedRoles={["superadmin", "sk_admin"]}>
            <AdminReports />
          </ProtectedRoute>
        } />
        <Route path="/AdminBudgetPlanning" element={
          <ProtectedRoute allowedRoles={["superadmin"]}>
            <AdminBudgetPlanning />
          </ProtectedRoute>
        } />

        <Route path="/AdminMasterActivityLog" element={
          <ProtectedRoute allowedRoles={["superadmin"]}>
            <AdminMasterActivityLog />
          </ProtectedRoute>
        } />

        <Route path="/AdminSystemMaintenance" element={
          <ProtectedRoute allowedRoles={["superadmin", "it_support"]}>
            <AdminSystemMaintenance />
          </ProtectedRoute>
        } />

        {/* Verifier */}
        <Route path="/VerifierDashboard" element={
          <ProtectedRoute allowedRoles={["sk_verifier"]}>
            <VerifierDashboard />
          </ProtectedRoute>
        } />
        <Route path="/VerifierApplicationList" element={
          <ProtectedRoute allowedRoles={["sk_verifier"]}>
            <VerifierApplicationList />
          </ProtectedRoute>
        } />
        <Route path="/VerifierApplicationReview/:id" element={
          <ProtectedRoute allowedRoles={["sk_verifier"]}>
            <VerifierApplicationReview />
          </ProtectedRoute>
        } />
        <Route path="/VerifierVerificationAction/:id" element={
          <ProtectedRoute allowedRoles={["sk_verifier"]}>
            <VerifierVerificationAction />
          </ProtectedRoute>
        } />
        <Route path="/VerifierClaiming" element={
          <ProtectedRoute allowedRoles={["sk_verifier"]}>
            <VerifierClaiming />
          </ProtectedRoute>
        } />
        <Route path="/VerifierProfile" element={
          <ProtectedRoute allowedRoles={["sk_verifier"]}>
            <VerifierProfile />
          </ProtectedRoute>
        } />
        <Route path="/VerifierWaitlist" element={
          <ProtectedRoute allowedRoles={["sk_verifier"]}>
            <VerifierWaitlist />
          </ProtectedRoute>
        } />


        {/* Applicant */}
        <Route path="/ApplicantDashboard" element={
          <ProtectedRoute allowedRoles={["applicant"]}>
            <ApplicantDashboard />
          </ProtectedRoute>
        } />
        <Route path="/ApplicantProfile" element={
          <ProtectedRoute allowedRoles={["applicant"]}>
            <ApplicantProfile />
          </ProtectedRoute>
        } />
        <Route path="/ApplicantSubmission" element={
          <ProtectedRoute allowedRoles={["applicant"]}>
            <ApplicantSubmission />
          </ProtectedRoute>
        } />
        <Route path="/ApplicantStatus" element={
          <ProtectedRoute allowedRoles={["applicant"]}>
            <ApplicantStatus />
          </ProtectedRoute>
        } />
        <Route path="/ApplicantClaimingSchedule" element={
          <ProtectedRoute allowedRoles={["applicant"]}>
            <ApplicantClaimingSchedule />
          </ProtectedRoute>
        } />

        {/* Catch-all */}
        <Route path="*" element={<NotFound />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
