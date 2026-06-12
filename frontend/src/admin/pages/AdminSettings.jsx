import { useState, useEffect } from "react";
import AdminNavigation from "../components/AdminNavigation";
import api from "../../services/api";

const SEMESTERS = ["1st Semester", "2nd Semester", "Summer"];

function AdminSettings() {
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState({
    school_year: "",
    semester: "",
    open_date: "",
    close_date: "",
    total_slots: "",
    is_active: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/admin/application-configs")
      .then((res) => {
        const active = res.data.find((c) => c.is_active) ?? res.data[0] ?? null;
        if (active) {
          setConfig(active);
          setForm({
            school_year: active.school_year,
            semester: active.semester,
            open_date: active.open_date,
            close_date: active.close_date,
            total_slots: active.total_slots,
            is_active: active.is_active,
          });
        }
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  const set = (k) => (e) => setForm((f) => ({
    ...f,
    [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value
  }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      if (config) {
        await api.put(`/admin/application-configs/${config.id}`, form);
      } else {
        await api.post("/application-config", form);
      }
      setSuccess("Settings saved successfully.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <AdminNavigation />
      <section className="page-section">
        <div className="container">

          <div className="page-card">
            <h3 className="section-title mb-2">Application Settings</h3>
            <p className="text-muted mb-0">Configure the application period and slot availability.</p>
          </div>

          <div className="page-card">
            <h4 className="sub-title">Program Configuration</h4>

            {success && <div className="alert alert-success">{success}</div>}
            {error && <div className="alert alert-danger">{error}</div>}

            {loading ? (
              <div className="spinner-border text-danger" />
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">School Year</label>
                    <input className="form-control" placeholder="e.g. 2025-2026" value={form.school_year} onChange={set("school_year")} required />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Semester</label>
                    <select className="form-select" value={form.semester} onChange={set("semester")} required>
                      <option value="" disabled>Select semester</option>
                      {SEMESTERS.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Opening Date</label>
                    <input type="date" className="form-control" value={form.open_date} onChange={set("open_date")} required />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Closing Date</label>
                    <input type="date" className="form-control" value={form.close_date} onChange={set("close_date")} required />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Total Slots</label>
                    <input type="number" className="form-control" placeholder="e.g. 2000" value={form.total_slots} onChange={set("total_slots")} required />
                  </div>
                  <div className="col-md-6 d-flex align-items-center mt-4">
                    <div className="form-check">
                      <input type="checkbox" className="form-check-input" id="isActive" checked={form.is_active} onChange={set("is_active")} />
                      <label className="form-check-label" htmlFor="isActive">
                        Set as Active Application Period
                      </label>
                    </div>
                  </div>
                </div>
                <div className="mt-4 d-flex justify-content-end gap-2">
                  <button type="submit" className="btn btn-custom" disabled={saving}>
                    {saving ? "Saving..." : "Save Settings"}
                  </button>
                </div>
              </form>
            )}
          </div>

          {config && (
            <div className="page-card">
              <h4 className="sub-title">Current Application Settings</h4>
              <table className="table table-bordered table-striped">
                <thead><tr><th>Setting</th><th>Value</th></tr></thead>
                <tbody>
                  {[
                    ["School Year", config.school_year],
                    ["Semester", config.semester],
                    ["Opening Date", config.open_date],
                    ["Closing Date", config.close_date],
                    ["Total Slots", config.total_slots],
                    ["Used Slots", config.used_slots],
                    ["Status", config.is_active ? "Active" : "Inactive"],
                  ].map(([k, v]) => (
                    <tr key={k}><td>{k}</td><td>{v}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

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

export default AdminSettings;