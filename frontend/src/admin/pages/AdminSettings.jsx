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

function generateSchoolYearOptions() {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear - 5; y <= currentYear + 20; y++) {
    years.push(`${y}-${y + 1}`);
  }
  return years;
}

const SCHOOL_YEAR_OPTIONS = generateSchoolYearOptions();

// Local datetime-local-compatible "now" string, e.g. "2026-09-07T14:30" —
// used as the default Opening Date so admin doesn't have to manually
// find today's date every time they set up a new period. Built from
// local date parts (not toISOString(), which is UTC and could show the
// wrong calendar day depending on timezone).
function nowForDatetimeLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultSchoolYear() {
  const y = new Date().getFullYear();
  return `${y}-${y + 1}`;
}

function emptyFormDefaults() {
  return {
    school_year: defaultSchoolYear(),
    open_date: nowForDatetimeLocal(),
    close_date: "",
    slot_limit: "",
    is_unlimited: false,
    assistance_amount: "2000",
  };
}


function AdminSettings() {
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState(emptyFormDefaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [extending, setExtending] = useState(false);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [extendDate, setExtendDate] = useState("");
  const [extendError, setExtendError] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showStartNewModal, setShowStartNewModal] = useState(false);

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
            assistance_amount: String(active.assistance_amount ?? 2000),
          });
        }
      })
      .catch(() => setError("Failed to load current settings."))
      .finally(() => setLoading(false));
  }, []);

  const hasStarted = config?.open_date
    ? new Date() >= new Date(config.open_date)
    : false;

  const hasClosed = config?.close_date
    ? new Date() > new Date(config.close_date)
    : false;

  const isAtCapacity =
    config && !config.is_unlimited && config.slots_filled >= config.slot_limit;

  const set = (k) => (e) =>
    setForm((f) => ({
      ...f,
      [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  function needsConfirmation() {
    // Show confirmation any time you're about to save a period that hasn't
    // started yet — regardless of which specific field changed. Simpler and
    // more predictable than diffing individual fields, which was the source
    // of the inconsistent behavior.
    return !hasStarted;
  }

  function startNewPeriod() {
    setShowStartNewModal(true);
  }

  function confirmStartNewPeriod() {
    setShowStartNewModal(false);
    setConfig(null);
    setForm(emptyFormDefaults());
    setSuccess("");
    setError("");
  }

  async function handleClosePeriod() {
    if (!config) return;
    if (!window.confirm(
      "Close this application period? This will mark every remaining waitlisted applicant as not selected, and cannot be undone."
    )) return;
    setClosing(true);
    setError("");
    setSuccess("");
    try {
      const res = await api.post(`/admin/application-configs/${config.id}/close`);
      setSuccess(res.data.message);
      setConfig((prev) => ({ ...prev, closed_at: res.data.config.closed_at }));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to close period.");
    } finally {
      setClosing(false);
    }
  }

  function openExtendModal() {
    // Pre-fill with the day right after the current closing date, so
    // the admin usually just needs to pick how much further to push it,
    // not start from scratch.
    if (config?.close_date) {
      const next = new Date(config.close_date);
      next.setDate(next.getDate() + 1);
      const pad = (n) => String(n).padStart(2, "0");
      setExtendDate(`${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`);
    }
    setExtendError("");
    setShowExtendModal(true);
  }

  async function handleExtendPeriod() {
    if (!config || !extendDate) return;
    setExtending(true);
    setExtendError("");
    try {
      const res = await api.post(`/admin/application-configs/${config.id}/extend`, {
        close_date: `${extendDate} 23:59:59`,
      });
      setConfig(res.data.config);
      setForm((f) => ({ ...f, close_date: res.data.config.close_date }));
      setShowExtendModal(false);
      setSuccess(res.data.message);
    } catch (err) {
      setExtendError(err.response?.data?.message || "Failed to extend application period.");
    } finally {
      setExtending(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (form.open_date && form.close_date) {
      const openTime = new Date(form.open_date).getTime();
      const closeTime = new Date(`${form.close_date.slice(0, 10)}T23:59:59`).getTime();
      if (closeTime <= openTime) {
        setError("Closing Date must be after the Opening Date.");
        return;
      }
    }
    if (needsConfirmation()) {
      setShowConfirmModal(true);
      return;
    }
    saveSettings();
  }

  async function saveSettings() {
    setShowConfirmModal(false);
    setSaving(true);
    try {
      const payload = {
        ...form,
        is_active: true,
        open_date: form.open_date ? `${form.open_date.slice(0, 10)} ${form.open_date.slice(11, 16)}:00` : "",
        close_date: form.close_date ? `${form.close_date.slice(0, 10)} 23:59:59` : "",
        slot_limit: form.is_unlimited ? null : form.slot_limit,
        assistance_amount: form.assistance_amount,
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
        assistance_amount: String(updated.assistance_amount ?? 2000),
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
      [
        "Application Status",
        !config.is_active
          ? "Superseded"
          : hasClosed
            ? "Closed"
            : hasStarted
              ? "Open"
              : `Scheduled — opens ${formatDateTime(config.open_date)}`,
      ],
      ["Opening Date", formatDateTime(config.open_date)],
      ["Closing Date", formatDateTime(config.close_date)],
      ["Slot Availability", config.is_unlimited ? "Unlimited" : "Limited"],
      [
        "Number of Available Slots",
        config.is_unlimited
          ? `Unlimited (${config.slots_filled} applied so far)`
          : `${config.slot_limit - config.slots_filled} remaining of ${config.slot_limit}`,
      ],
      ["Assistance Amount per Applicant", `₱${Number(config.assistance_amount ?? 2000).toLocaleString()}`],
    ]
    : [];

  return (
    <div>
      <AdminNavigation />
      <section className="page-section">
        <div className="container">

          <div className="page-card">
            <h3 className="section-title mb-2">Application Settings</h3>
            <p className="text-muted mb-0">
              Configure the application period, school year, applicant slot availability, and other important settings for the educational assistance program.
            </p>
          </div>

          <div className="page-card">
            <h4 className="sub-title">Program Configuration</h4>
            <div className="info-box">
              These settings control the availability and basic parameters of the educational assistance application process.
            </div>

            {hasStarted && !hasClosed && (
              <div className="alert alert-warning">
                <strong>This application period has already started.</strong>{" "}
                School Year, Opening Date, Number of Available Slots, Slot
                Type, and Assistance Amount can no longer be changed to
                protect data integrity for applicants who have already
                applied. Use "Extend Application Period" below if you need to change the Closing Date.
              </div>
            )}

            {hasClosed && (
              <div className="alert alert-warning d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div>
                  <strong>This application period has closed.</strong>{" "}
                  Applicants can no longer submit new applications. Extend the
                  Closing Date below to reopen submissions under this same
                  period, or start a new period entirely for a different
                  school year.
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger flex-shrink-0"
                  onClick={startNewPeriod}
                >
                  Start New Application Period
                </button>
              </div>
            )}

            {isAtCapacity && (
              <div className="alert alert-warning">
                This period is already at capacity ({config.slots_filled}/{config.slot_limit} slots filled).
                No new applicants can be accepted unless you increase the slot limit.
              </div>
            )}

            {success && <div className="alert alert-success">{success}</div>}
            {error && <div className="alert alert-danger">{error}</div>}

            {loading ? (
              <div className="spinner-border text-danger" />
            ) : (
              <form onSubmit={handleSubmit}>
                {/* Application Period */}
                <div className="mb-4 p-3 border rounded">
                  <h6 className="text-muted text-uppercase small fw-bold mb-3">Application Period</h6>
                  <div className="row g-3">
                    <div className="col-md-4">
                      <label className="form-label">School Year</label>
                      <select
                        className="form-select"
                        value={form.school_year}
                        onChange={set("school_year")}
                        disabled={hasStarted}
                        required
                      >
                        <option value="" disabled>Select school year</option>
                        {SCHOOL_YEAR_OPTIONS.map((sy) => (
                          <option key={sy} value={sy}>{sy}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Opening Date &amp; Time</label>
                      <input
                        type="datetime-local"
                        className="form-control"
                        value={form.open_date ? form.open_date.slice(0, 16) : ""}
                        onChange={set("open_date")}
                        disabled={hasStarted}
                        required
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Closing Date</label>
                      <input
                        type="date"
                        className="form-control"
                        value={form.close_date ? form.close_date.slice(0, 10) : ""}
                        onChange={set("close_date")}
                        disabled={!!config}
                        required={!config}
                      />
                      {config && (
                        <div className="form-text">
                          Locked once a period exists — use "Extend Application Period" below to push this date later.
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="form-text mt-2">
                    Applications are only accepted between the Opening and Closing Dates.
                  </div>
                </div>

                {/* Slot Capacity */}
                <div className="mb-4 p-3 border rounded">
                  <h6 className="text-muted text-uppercase small fw-bold mb-3">Slot Capacity</h6>
                  <div className="row g-3 align-items-end">
                    <div className="col-md-6">
                      <label className="form-label d-block">Slot Type</label>
                      <div className="btn-group" role="group">
                        <input
                          type="radio"
                          className="btn-check"
                          name="slotType"
                          id="slotLimited"
                          autoComplete="off"
                          checked={!form.is_unlimited}
                          onChange={() =>
                            setForm((f) => ({ ...f, is_unlimited: false, slot_limit: "" }))
                          }
                          disabled={hasStarted}
                        />
                        <label className="btn btn-outline-danger" htmlFor="slotLimited">
                          Limited
                        </label>
                        <input
                          type="radio"
                          className="btn-check"
                          name="slotType"
                          id="slotUnlimited"
                          autoComplete="off"
                          checked={form.is_unlimited}
                          onChange={() =>
                            setForm((f) => ({ ...f, is_unlimited: true, slot_limit: "" }))
                          }
                          disabled={hasStarted}
                        />
                        <label className="btn btn-outline-danger" htmlFor="slotUnlimited">
                          Unlimited
                        </label>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Number of Available Slots</label>
                      {form.is_unlimited ? (
                        <input
                          type="text"
                          className="form-control"
                          value="No limit — unlimited slots"
                          disabled
                          readOnly
                        />
                      ) : (
                        <input
                          type="number"
                          className="form-control"
                          placeholder="e.g. 2000"
                          value={form.slot_limit}
                          onChange={set("slot_limit")}
                          disabled={hasStarted}
                          required
                          min={1}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Assistance Amount */}
                <div className="mb-4 p-3 border rounded">
                  <h6 className="text-muted text-uppercase small fw-bold mb-3">Assistance Amount</h6>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Amount per Applicant (₱)</label>
                      <div className="input-group">
                        <span className="input-group-text">₱</span>
                        <input
                          type="number"
                          className="form-control"
                          placeholder="e.g. 2000"
                          value={form.assistance_amount}
                          onChange={set("assistance_amount")}
                          disabled={hasStarted}
                          required
                          min={0}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="form-text mt-2">
                    Used for budget reports and disbursement calculations. Once
                    this period opens, this amount is locked — changing it later
                    only affects future periods, not this one.
                  </div>
                </div>

                <div className="d-flex justify-content-end gap-2">
                  <button type="button" className="btn btn-secondary" onClick={() => setForm(emptyFormDefaults())}>
                    Clear
                  </button>
                  <button type="submit" className="btn btn-custom" disabled={saving}>
                    {saving ? "Saving..." : "Save Settings"}
                  </button>
                </div>
              </form>
            )}
          </div>

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

          {config && !config.closed_at && (
            <div className="page-card">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                <div>
                  <h4 className="sub-title mb-1">Extend Application Period</h4>
                  <p className="text-muted small mb-0">
                    Push the Closing Date later — for example, if turnout has been low and the SK wants to give
                    applicants more time. This is the only way to change the Closing Date once a period exists;
                    it can only move later, never earlier.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-outline-custom"
                  onClick={openExtendModal}
                >
                  Extend Closing Date
                </button>
              </div>
            </div>
          )}

          {config && !config.closed_at && (
            <div className="page-card">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                <div>
                  <h4 className="sub-title mb-1">Close This Period</h4>
                  <p className="text-muted small mb-0">
                    Marks this period as fully settled. Any remaining waitlisted applicants will be
                    finalized as "not selected." Only available once the grace period has ended.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-outline-danger"
                  onClick={handleClosePeriod}
                  disabled={closing}
                >
                  {closing ? "Closing..." : "Close Period"}
                </button>
              </div>
            </div>
          )}

          {config?.closed_at && (
            <div className="page-card">
              <div className="alert alert-secondary mb-0">
                This period was closed on {formatDateTime(config.closed_at)}.
              </div>
            </div>
          )}

        </div>
      </section>

      {/* Confirmation Modal — replaces window.confirm() */}
      {showConfirmModal && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center"
          style={{ background: "rgba(0,0,0,0.5)", zIndex: 1055 }}
        >
          <div
            className="bg-white rounded shadow"
            style={{ maxWidth: "480px", width: "90%" }}
          >
            <div className="modal-header p-3 rounded-top">
              <h5 className="mb-0">Confirm Application Period Settings</h5>
            </div>
            <div className="p-4">
              <p className="mb-2">
                Once this period opens on its scheduled <strong>Opening Date</strong>,
                the following can no longer be changed:
              </p>
              <ul className="mb-3">
                <li>School Year</li>
                <li>Opening Date</li>
                <li>Number of Available Slots</li>
                <li>Slot Type (Limited / Unlimited)</li>
                <li>Assistance Amount per Applicant</li>
              </ul>
              <p className="mb-0 text-muted small">
                Closing Date is locked once saved — use the separate "Extend Application Period" action later if you need to push it back.
              </p>
            </div>
            <div className="d-flex justify-content-end gap-2 p-3 border-top">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowConfirmModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-custom"
                onClick={saveSettings}
                disabled={saving}
              >
                {saving ? "Saving..." : "Confirm & Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal — Start New Application Period */}
      {showStartNewModal && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center"
          style={{ background: "rgba(0,0,0,0.5)", zIndex: 1055 }}
        >
          <div
            className="bg-white rounded shadow"
            style={{ maxWidth: "480px", width: "90%" }}
          >
            <div className="modal-header p-3 rounded-top">
              <h5 className="mb-0">Start New Application Period</h5>
            </div>
            <div className="p-4">
              <p className="mb-0">
                This will clear the form below so you can set up a new
                application period. The current period's data will remain
                saved and accessible in your records — it will not be
                deleted or altered.
              </p>
            </div>
            <div className="d-flex justify-content-end gap-2 p-3 border-top">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowStartNewModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-custom"
                onClick={confirmStartNewPeriod}
              >
                Start New Period
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extend Application Period Modal */}
      {showExtendModal && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center"
          style={{ background: "rgba(0,0,0,0.5)", zIndex: 1055 }}
        >
          <div
            className="bg-white rounded shadow"
            style={{ maxWidth: "480px", width: "90%" }}
          >
            <div className="modal-header p-3 rounded-top">
              <h5 className="mb-0">Extend Application Period</h5>
            </div>
            <div className="p-4">
              <p className="mb-3">
                Current Closing Date: <strong>{formatDateTime(config?.close_date)}</strong>
              </p>
              <label className="form-label">New Closing Date</label>
              <input
                type="date"
                className="form-control"
                value={extendDate}
                onChange={(e) => setExtendDate(e.target.value)}
                min={config?.close_date ? config.close_date.slice(0, 10) : undefined}
                required
              />
              <div className="form-text">Must be later than the current closing date.</div>
              {extendError && <div className="alert alert-danger mt-3 mb-0">{extendError}</div>}
            </div>
            <div className="d-flex justify-content-end gap-2 p-3 border-top">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowExtendModal(false)}
                disabled={extending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-custom"
                onClick={handleExtendPeriod}
                disabled={extending || !extendDate}
              >
                {extending ? "Extending..." : "Confirm Extension"}
              </button>
            </div>
          </div>
        </div>
      )}

      <footer>
        <div className="container">
          <p className="mb-0">© 2026 Sangguniang Kabataan of Barangay Mamatid | Admin Panel</p>
        </div>
      </footer>
    </div>
  );
}

export default AdminSettings;