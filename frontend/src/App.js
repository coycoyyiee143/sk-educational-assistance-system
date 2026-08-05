import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";

import Home from "./public/pages/Home";
import Requirements from "./public/pages/Requirements";
import Announcements from "./public/pages/Announcements";
import Events from "./public/pages/Events";
import Login from "./public/pages/Login";
import Register from "./public/pages/Register";
import VerifyEmail from "./public/pages/VerifyEmail.jsx";
import VerifyEmailNotice from "./public/pages/VerifyEmailNotice";

import AdminDashboard from "./admin/pages/AdminDashboard";
import AdminUsers from "./admin/pages/AdminUsers";
import AdminSettings from "./admin/pages/AdminSettings";
import AdminSchedule from "./admin/pages/AdminSchedule";
import AdminAnnouncements from "./admin/pages/AdminAnnouncements.jsx";
import AdminEvents from "./admin/pages/AdminEvents.jsx";
import AdminReports from "./admin/pages/AdminReports.jsx";
import AdminBudgetPlanning from "./admin/pages/AdminBudgetPlanning.jsx";
import AdminMasterActivityLog from "./admin/pages/AdminMasterActivityLog";

import VerifierDashboard from "./verifier/pages/VerifierDashboard.jsx";
import VerifierApplicationList from "./verifier/pages/VerifierApplicationList.jsx";
import VerifierApplicationReview from "./verifier/pages/VerifierApplicationReview.jsx";
import VerifierVerificationAction from "./verifier/pages/VerifierVerificationAction.jsx";
import VerifierClaiming from "./verifier/pages/VerifierClaiming.jsx";
import VerifierProfile from "./verifier/pages/VerifierProfile.jsx";


import ApplicantDashboard from "./applicant/pages/ApplicantDashboard.jsx";
import ApplicantProfile from "./applicant/pages/ApplicantProfile.jsx";
import ApplicantSubmission from "./applicant/pages/ApplicantSubmission.jsx";
import ApplicantStatus from "./applicant/pages/ApplicantStatus.jsx";
import ApplicantClaimingSchedule from "./applicant/pages/ApplicantClaimingSchedule.jsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Public */}
        <Route path="/" element={<Home />} />
        <Route path="/requirements" element={<Requirements />} />
        <Route path="/announcements" element={<Announcements />} />
        <Route path="/events" element={<Events />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email/:id/:hash" element={<VerifyEmail />} />
        <Route path="/verify-email-notice" element={<VerifyEmailNotice />} />

        {/* Admin */}
        <Route path="/AdminDashboard" element={
          <ProtectedRoute allowedRoles={["sk_admin"]}>
            <AdminDashboard />
          </ProtectedRoute>
        } />
        <Route path="/AdminUsers" element={
          <ProtectedRoute allowedRoles={["sk_admin"]}>
            <AdminUsers />
          </ProtectedRoute>
        } />
        <Route path="/AdminSettings" element={
          <ProtectedRoute allowedRoles={["sk_admin"]}>
            <AdminSettings />
          </ProtectedRoute>
        } />
        <Route path="/AdminSchedule" element={
          <ProtectedRoute allowedRoles={["sk_admin"]}>
            <AdminSchedule />
          </ProtectedRoute>
        } />
        <Route path="/AdminAnnouncements" element={
          <ProtectedRoute allowedRoles={["sk_admin"]}>
            <AdminAnnouncements />
          </ProtectedRoute>
        } />
        <Route path="/AdminEvents" element={
          <ProtectedRoute allowedRoles={["sk_admin"]}>
            <AdminEvents />
          </ProtectedRoute>
        } />
        <Route path="/AdminReports" element={
          <ProtectedRoute allowedRoles={["sk_admin"]}>
            <AdminReports />
          </ProtectedRoute>
        } />
        <Route path="/AdminBudgetPlanning" element={
          <ProtectedRoute allowedRoles={["sk_admin"]}>
            <AdminBudgetPlanning />
          </ProtectedRoute>
        } />

        <Route path="/AdminMasterActivityLog" element={
          <ProtectedRoute allowedRoles={["sk_admin"]}>
            <AdminMasterActivityLog />
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

      </Routes>
    </BrowserRouter>
  );
}

export default App;