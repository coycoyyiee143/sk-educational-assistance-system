import { useState } from "react";
import AdminNavigation from "../components/AdminNavigation";

// ── Static display data ───────────────────────────────────────────────────────

const currentSettings = [
  ["School Year", "2026 - 2027"],
  ["Application Status", "Open"],
  ["Opening Date", "April 1, 2026"],
  ["Closing Date", "April 15, 2026"],
  ["Slot Availability", "Limited"],
  ["Number of Available Slots", "100"],
];

const requiredDocuments = [
  "School ID",
  "Certificate of Enrollment / Registration Form",
  "Barangay Certificate / Proof of Residency",
  "Birth Certificate",
  "2x2 Picture",
];

const eligibilityRules = [
  "Applicant must be a resident of Barangay Mamatid.",
  "Applicant must be currently enrolled.",
  "Applicant must submit complete requirements.",
  "Applicant must apply within the official application period.",
];

// ── Initial form state ────────────────────────────────────────────────────────

const emptyForm = {
  schoolYear: "",
  appStatus: "",
  openingDate: "",
  closingDate: "",
  slotAvailability: "",
  slotCount: "",
};

// ── Component ─────────────────────────────────────────────────────────────────

function AdminSettings() {
  const [form, setForm] = useState(emptyForm);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function handleSubmit(e) {
    e.preventDefault();
    console.log("Saved settings:", form);
  }

  return (
    <div>
      <AdminNavigation />

      <section className="page-section">
        <div className="container">

          {/* Header */}
          <div className="page-card">
            <h3 className="section-title mb-2">Application Settings</h3>
            <p className="text-muted mb-0">
              Configure the application period, school year, applicant slot availability, and other important settings for the educational assistance program.
            </p>
          </div>

          {/* Program Configuration Form */}
          <div className="page-card">
            <h4 className="sub-title">Program Configuration</h4>

            <div className="info-box">
              These settings control the availability and basic parameters of the educational assistance application process.
            </div>

            <form onSubmit={handleSubmit}>
              <div className="row g-3">

                <div className="col-md-6">
                  <label className="form-label">School Year</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. 2026 - 2027"
                    value={form.schoolYear}
                    onChange={set("schoolYear")}
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label">Application Status</label>
                  <select className="form-select" value={form.appStatus} onChange={set("appStatus")}>
                    <option value="" disabled>Select application status</option>
                    <option>Open</option>
                    <option>Closed</option>
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label">Application Opening Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={form.openingDate}
                    onChange={set("openingDate")}
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label">Application Closing Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={form.closingDate}
                    onChange={set("closingDate")}
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label">Slot Availability</label>
                  <select className="form-select" value={form.slotAvailability} onChange={set("slotAvailability")}>
                    <option value="" disabled>Select slot type</option>
                    <option>Unlimited</option>
                    <option>Limited</option>
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label">Number of Available Slots</label>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="Enter number of slots"
                    value={form.slotCount}
                    onChange={set("slotCount")}
                  />
                </div>

              </div>

              <div className="mt-4 d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-secondary" onClick={() => setForm(emptyForm)}>Clear</button>
                <button type="submit" className="btn btn-custom">Save Settings</button>
              </div>
            </form>
          </div>

          {/* Current Settings Table */}
          <div className="page-card">
            <h4 className="sub-title">Current Application Settings</h4>

            <div className="table-responsive">
              <table className="table table-bordered table-striped align-middle">
                <thead>
                  <tr>
                    <th>Setting</th>
                    <th>Current Value</th>
                  </tr>
                </thead>
                <tbody>
                  {currentSettings.map(([setting, value]) => (
                    <tr key={setting}>
                      <td>{setting}</td>
                      <td>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Documents & Eligibility */}
          <div className="page-card">
            <h4 className="sub-title">Required Documents and Eligibility Rules</h4>

            <div className="info-box">
              The following list represents the current requirements and eligibility conditions used by the system during application processing.
            </div>

            <div className="row g-4">
              <div className="col-md-6">
                <h6 className="mb-3" style={{ color: "#b71c1c" }}>Required Documents</h6>
                <ul className="mb-0">
                  {requiredDocuments.map((doc) => <li key={doc}>{doc}</li>)}
                </ul>
              </div>

              <div className="col-md-6">
                <h6 className="mb-3" style={{ color: "#b71c1c" }}>Eligibility Rules</h6>
                <ul className="mb-0">
                  {eligibilityRules.map((rule) => <li key={rule}>{rule}</li>)}
                </ul>
              </div>
            </div>
          </div>

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