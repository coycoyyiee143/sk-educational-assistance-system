import React, { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import GuestRoute from "./components/GuestRoute";
import { useAuth } from "./context/AuthContext";

// Grouped into one chunk per role via webpackChunkName — once a user's
// role-chunk is fetched, navigating between their own pages (e.g. sidebar
// clicks) needs no further network round trips. Split per-page instead of
// per-role used to force a fresh chunk fetch on every navigation, which is
// costly on the high-latency/packet-loss network path this app is served over.
const Home = lazy(() => import(/* webpackChunkName: "public" */ "./public/pages/Home"));
const Requirements = lazy(() => import(/* webpackChunkName: "public" */ "./public/pages/Requirements"));
const Announcements = lazy(() => import(/* webpackChunkName: "public" */ "./public/pages/Announcements"));
const Events = lazy(() => import(/* webpackChunkName: "public" */ "./public/pages/Events"));
const Login = lazy(() => import(/* webpackChunkName: "public" */ "./public/pages/Login"));
const Register = lazy(() => import(/* webpackChunkName: "public" */ "./public/pages/Register"));
const VerifyEmail = lazy(() => import(/* webpackChunkName: "public" */ "./public/pages/VerifyEmail.jsx"));
const VerifyEmailNotice = lazy(() => import(/* webpackChunkName: "public" */ "./public/pages/VerifyEmailNotice"));
const ForgotPassword = lazy(() => import(/* webpackChunkName: "public" */ "./public/pages/ForgotPassword"));
const PersonnelSetup = lazy(() => import(/* webpackChunkName: "public" */ "./public/pages/PersonnelSetup"));
const NotFound = lazy(() => import(/* webpackChunkName: "public" */ "./public/pages/NotFound"));

const AdminDashboard = lazy(() => import(/* webpackChunkName: "admin" */ "./admin/pages/AdminDashboard"));
const AdminUsers = lazy(() => import(/* webpackChunkName: "admin" */ "./admin/pages/AdminUsers"));
const AdminSettings = lazy(() => import(/* webpackChunkName: "admin" */ "./admin/pages/AdminSettings"));
const AdminSchedule = lazy(() => import(/* webpackChunkName: "admin" */ "./admin/pages/AdminSchedule"));
const AdminAnnouncements = lazy(() => import(/* webpackChunkName: "admin" */ "./admin/pages/AdminAnnouncements.jsx"));
const AdminEvents = lazy(() => import(/* webpackChunkName: "admin" */ "./admin/pages/AdminEvents.jsx"));
const AdminReports = lazy(() => import(/* webpackChunkName: "admin" */ "./admin/pages/AdminReports.jsx"));
const AdminBudgetPlanning = lazy(() => import(/* webpackChunkName: "admin" */ "./admin/pages/AdminBudgetPlanning.jsx"));
const AdminMasterActivityLog = lazy(() => import(/* webpackChunkName: "admin" */ "./admin/pages/AdminMasterActivityLog"));
const AdminSystemMaintenance = lazy(() => import(/* webpackChunkName: "admin" */ "./admin/pages/AdminSystemMaintenance.jsx"));

const VerifierDashboard = lazy(() => import(/* webpackChunkName: "verifier" */ "./verifier/pages/VerifierDashboard.jsx"));
const VerifierApplicationList = lazy(() => import(/* webpackChunkName: "verifier" */ "./verifier/pages/VerifierApplicationList.jsx"));
const VerifierApplicationReview = lazy(() => import(/* webpackChunkName: "verifier" */ "./verifier/pages/VerifierApplicationReview.jsx"));
const VerifierVerificationAction = lazy(() => import(/* webpackChunkName: "verifier" */ "./verifier/pages/VerifierVerificationAction.jsx"));
const VerifierClaiming = lazy(() => import(/* webpackChunkName: "verifier" */ "./verifier/pages/VerifierClaiming.jsx"));
const VerifierProfile = lazy(() => import(/* webpackChunkName: "verifier" */ "./verifier/pages/VerifierProfile.jsx"));
const VerifierWaitlist = lazy(() => import(/* webpackChunkName: "verifier" */ "./verifier/pages/VerifierWaitlist.jsx"));

const ApplicantDashboard = lazy(() => import(/* webpackChunkName: "applicant" */ "./applicant/pages/ApplicantDashboard.jsx"));
const ApplicantProfile = lazy(() => import(/* webpackChunkName: "applicant" */ "./applicant/pages/ApplicantProfile.jsx"));
const ApplicantSubmission = lazy(() => import(/* webpackChunkName: "applicant" */ "./applicant/pages/ApplicantSubmission.jsx"));
const ApplicantStatus = lazy(() => import(/* webpackChunkName: "applicant" */ "./applicant/pages/ApplicantStatus.jsx"));
const ApplicantClaimingSchedule = lazy(() => import(/* webpackChunkName: "applicant" */ "./applicant/pages/ApplicantClaimingSchedule.jsx"));

function FullScreenSpinner() {
  return (
    <div className="d-flex justify-content-center align-items-center" style={{ height: "100vh" }}>
      <div className="spinner-border text-danger" role="status">
        <span className="visually-hidden">Loading...</span>
      </div>
    </div>
  );
}

function App() {
  const { loading } = useAuth();

  // Gated here, once, above <Routes> — every route below (each wrapped
  // in its own ProtectedRoute/GuestRoute) mounts fresh on every in-app
  // navigation, so checking `loading` inside those instead of here used
  // to re-flash this same full-screen spinner on every sidebar click,
  // not just on the app's actual first load.
  if (loading) {
    return <FullScreenSpinner />;
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<FullScreenSpinner />}>
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
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
