import { useState, useEffect } from "react";
import AdminNavigation from "../components/AdminNavigation";
import api from "../../services/api";

function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const emptyForm = {
  school_year: "",
  open_date: "",
  close_date: "",
  slot_limit: "",
  is_unlimited: false,
  is_active: false,
};

function AdminSettings() {
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState(emptyForm);
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
            open_date: active.open_date,
            close_date: active.close_date,
            slot_limit: active.slot_limit ?? "",
            is_unlimited: active.is_unlimited,
            is_active: active.is_active,
          });
        }
      })
      .catch(() => setError("Failed to load current settings."))
      .finally(() => setLoading(false));
  }, []);

  // Once the opening date has passed, core parameters (school year, open
  // date, slot limit, unlimited toggle) are locked server-side. Mirror
  // that here so the form clearly reflects what's actually editable.
  const hasStarted = config?.open_date
    ? new Date() >= new Date(config.open_date)
    : false;

  // Warn (don't block) if the admin tries to reactivate a period that's
  // already at capacity — reactivating alone won't let new applicants in
  // unless the slot limit is also raised.
  const isAtCapacity =
    config && !config.is_unlimited && config.slots_filled >= config.slot_limit;

  const set = (k) => (e) =>
    setForm((f) => ({
      ...f,
      [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const payload = {
        ...form,
        open_date: form.open_date ? `${form.open_date.slice(0, 10)} 00:00:00` : "",
        close_date: form.close_date ? `${form.close_date.slice(0, 10)} 23:59:59` : "",
        slot_limit: form.is_unlimited ? null : form.slot_limit,
      };
      let response;
      if (config) {
        response = await api.put(`/admin/application-configs/${config.id}`, payload);
      } else {
        response = await api.post("/application-config", payload);
      }
      const updated = response.data.config;
      setConfig(updated);
      setForm({
        school_year: updated.school_year,
        open_date: updated.open_date,
        close_date: updated.close_date,
        slot_limit: updated.slot_limit ?? "",
        is_unlimited: updated.is_unlimited,
        is_active: updated.is_active,
      });
      setSuccess("Settings saved successfully.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  const currentSettings = config
    ? [
      ["School Year", config.school_year],
      ["Application Status", config.is_active ? "Open" : "Closed"],
      ["Opening Date", formatDateTime(config.open_date)],
      ["Closing Date", formatDateTime(config.close_date)],
      ["Slot Availability", config.is_unlimited ? "Unlimited" : "Limited"],
      [
        "Number of Available Slots",
        config.is_unlimited
          ? `Unlimited (${config.slots_filled} applied so far)`
          : `${config.slot_limit - config.slots_filled} remaining of ${config.slot_limit}`,
      ],
    ]
    : [];

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

            {hasStarted && (
              <div className="alert alert-warning">
                <strong>This application period has already started.</strong>{" "}
                School Year, Opening Date, Number of Available Slots, and the
                Unlimited Slots toggle can no longer be changed to protect
                data integrity for applicants who have already applied.
                Closing Date and Active status can still be updated.
              </div>
            )}

            {/* Capacity warning when trying to reactivate an already-full period */}
            {form.is_active && isAtCapacity && (
              <div className="alert alert-warning">
                This period is already at capacity ({config.slots_filled}/{config.slot_limit} slots filled).
                Reactivating it will not allow new applicants to apply unless you also increase the slot limit.
              </div>
            )}

            {success && <div className="alert alert-success">{success}</div>}
            {error && <div className="alert alert-danger">{error}</div>}

            {loading ? (
              <div className="spinner-border text-danger" />
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">School Year</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. 2026 - 2027"
                      value={form.school_year}
                      onChange={set("school_year")}
                      disabled={hasStarted}
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Application Opening Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={form.open_date ? form.open_date.slice(0, 10) : ""}
                      onChange={set("open_date")}
                      disabled={hasStarted}
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Application Closing Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={form.close_date ? form.close_date.slice(0, 10) : ""}
                      onChange={set("close_date")}
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Number of Available Slots</label>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="e.g. 2000"
                      value={form.slot_limit}
                      onChange={set("slot_limit")}
                      disabled={form.is_unlimited || hasStarted}
                      required={!form.is_unlimited}
                      min={1}
                    />
                  </div>
                  <div className="col-md-6 d-flex align-items-center mt-4">
                    <div className="form-check">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id="isUnlimited"
                        checked={form.is_unlimited}
                        onChange={set("is_unlimited")}
                        disabled={hasStarted}
                      />
                      <label className="form-check-label" htmlFor="isUnlimited">
                        Unlimited Slots (no cap during application period)
                      </label>
                    </div>
                  </div>
                  <div className="col-md-6 d-flex align-items-center mt-4">
                    <div className="form-check">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id="isActive"
                        checked={form.is_active}
                        onChange={set("is_active")}
                      />
                      <label className="form-check-label" htmlFor="isActive">
                        Set as Active Application Period
                      </label>
                    </div>
                  </div>
                </div>
                <div className="mt-4 d-flex justify-content-end gap-2">
                  <button type="button" className="btn btn-secondary" onClick={() => setForm(emptyForm)}>
                    Clear
                  </button>
                  <button type="submit" className="btn btn-custom" disabled={saving}>
                    {saving ? "Saving..." : "Save Settings"}
                  </button>
                </div>
              </form>
            )}
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
                  {config ? (
                    currentSettings.map(([setting, value]) => (
                      <tr key={setting}>
                        <td>{setting}</td>
                        <td>{value}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} className="text-muted">No application period configured yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
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