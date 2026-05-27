import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./public/pages/Home";
import Requirements from "./public/pages/Requirements";
import Announcements from "./public/pages/Announcements";
import Events from "./public/pages/Events";
import Login from "./public/pages/Login";
import Register from "./public/pages/Register";

import AdminNavigation from "./admin/components/AdminNavigation";
import AdminDashboard from "./admin/pages/AdminDashboard";
import AdminUsers from "./admin/pages/AdminUsers";
import AdminSettings from "./admin/pages/AdminSettings";
import AdminSchedule from "./admin/pages/AdminSchedule";
import AdminAnnouncements from "./admin/pages/AdminAnnouncements.jsx";
import AdminEvents from "./admin/pages/AdminEvents.jsx";
import AdminReports from "./admin/pages/AdminReports.jsx";

import VerifierNavigation from "./verifier/components/VerifierNavigation.jsx";
import VerifierDashboard from "./verifier/pages/VerifierDashboard.jsx";


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/requirements" element={<Requirements />} />
        <Route path="/announcements" element={<Announcements />} />
        <Route path="/events" element={<Events />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/AdminNavigation" element={<AdminNavigation />} />
        <Route path="/AdminDashboard" element={<AdminDashboard />} />
        <Route path="/AdminUsers" element={<AdminUsers />} />
        <Route path="/AdminSettings" element={<AdminSettings />} />
        <Route path="/AdminSchedule" element={<AdminSchedule />} />
        <Route path="/AdminAnnouncements" element={<AdminAnnouncements />} />
        <Route path="/AdminEvents" element={<AdminEvents />} />
        <Route path="/AdminReports" element={<AdminReports />} />

        <Route path="/VerifierNavigation" element={<VerifierNavigation />} />
        <Route path="/VerifierDashboard" element={<VerifierDashboard />} />


      </Routes>
    </BrowserRouter>
  );
}

export default App;