import { useState, useEffect } from "react";
import AdminNavigation from "../components/AdminNavigation";
import ApplicantRecordsSection from "../components/ApplicantRecordsSection";
import ApplicantProfileSection from "../components/ApplicantProfileSection";
import VerificationOutcomesSection from "../components/VerificationOutcomesSection";
import BudgetPlanningSection from "../components/BudgetPlanningSection";
import api from "../../services/api";

function AdminReports() {
  const [periods, setPeriods] = useState([]);
  const [selectedConfigId, setSelectedConfigId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/admin/reports/periods")
      .then((res) => {
        setPeriods(res.data);
        const active = res.data.find((p) => p.is_active);
        setSelectedConfigId(active ? String(active.id) : (res.data[0] ? String(res.data[0].id) : ""));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <AdminNavigation />
        <div className="d-flex justify-content-center align-items-center" style={{ height: "60vh" }}>
          <div className="spinner-border text-danger" role="status" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <AdminNavigation />
      <section className="page-section">
        <div className="container">

          <div className="page-card">
            <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
              <div>
                <h3 className="section-title mb-2">Reports</h3>
                <p className="text-muted mb-0">
                  Applicant statistics, verification outcomes, and budget planning tools for the
                  educational assistance program.
                </p>
              </div>
              <div style={{ minWidth: "220px" }}>
                <label className="form-label small text-muted mb-1">Viewing Period</label>
                <select className="form-select" value={selectedConfigId} onChange={(e) => setSelectedConfigId(e.target.value)}>
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>{p.school_year}{p.is_active ? " (Active)" : ""}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <ApplicantRecordsSection selectedConfigId={selectedConfigId} />
          <ApplicantProfileSection selectedConfigId={selectedConfigId} />
          <VerificationOutcomesSection selectedConfigId={selectedConfigId} />
          <BudgetPlanningSection />

        </div>
      </section>
      <footer>
        <div className="container">
          <p className="mb-0">© 2026 Sangguniang Kabataan of Barangay Mamatid | Admin Panel</p>
        </div>
      </footer>
    </div>
  );
}

export default AdminReports;