import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./public/pages/Home";
import Requirements from "./public/pages/Requirements";
import Announcements from "./public/pages/Announcements";
import Events from "./public/pages/Events";
import Login from "./public/pages/Login";
import Register from "./public/pages/Register";

import AdminDashboard from "./admin/pages/AdminDashboard";
import AdminUsers from "./admin/pages/AdminUsers";
import AdminSettings from "./admin/pages/AdminSettings";
import AdminSchedule from "./admin/pages/AdminSchedule";
import AdminAnnouncements from "./admin/pages/AdminAnnouncements.jsx";
import AdminEvents from "./admin/pages/AdminEvents.jsx";
import AdminReports from "./admin/pages/AdminReports.jsx";

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

        {/* Admin */}
        <Route path="/AdminDashboard" element={<AdminDashboard />} />
        <Route path="/AdminUsers" element={<AdminUsers />} />
        <Route path="/AdminSettings" element={<AdminSettings />} />
        <Route path="/AdminSchedule" element={<AdminSchedule />} />
        <Route path="/AdminAnnouncements" element={<AdminAnnouncements />} />
        <Route path="/AdminEvents" element={<AdminEvents />} />
        <Route path="/AdminReports" element={<AdminReports />} />

        {/* Verifier */}
        <Route path="/VerifierDashboard" element={<VerifierDashboard />} />
        <Route path="/VerifierApplicationList" element={<VerifierApplicationList />} />
        <Route path="/VerifierApplicationReview" element={<VerifierApplicationReview />} />
        <Route path="/VerifierVerificationAction" element={<VerifierVerificationAction />} />
        <Route path="/VerifierClaiming" element={<VerifierClaiming />} />
        <Route path="/VerifierProfile" element={<VerifierProfile />} />

        {/* Applicant */}
        <Route path="/ApplicantDashboard" element={<ApplicantDashboard />} />
        <Route path="/ApplicantProfile" element={<ApplicantProfile />} />
        <Route path="/ApplicantSubmission" element={<ApplicantSubmission />} />
        <Route path="/ApplicantStatus" element={<ApplicantStatus />} />
        <Route path="/ApplicantClaimingSchedule" element={<ApplicantClaimingSchedule />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;