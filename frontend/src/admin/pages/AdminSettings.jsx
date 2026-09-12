import { useState, useEffect } from "react";
import AdminNavigation from "../components/AdminNavigation";
import api from "../../services/api";
import PanelFooter from "../../components/PanelFooter";

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

const emptyForm = {
  school_year: "",
  open_date: "",
  close_date: "",
  slot_limit: "",
  is_unlimited: false,
  assistance_amount: "2000",
};

function AdminSettings() {
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showStartNewModal, setShowStartNewModal] = useState(false);

  // Extend Application Period — the ONLY way close_date changes now
  // (ApplicationConfigurationController::extend()). Separate from the
  // main settings form/modal entirely.
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [extendDate, setExtendDate] = useState("");
  const [extending, setExtending] = useState(false);
  const [extendError, setExtendError] = useState("");

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
    return !hasStarted;
  }

  function startNewPeriod() {
    setShowStartNewModal(true);
  }

  function confirmStartNewPeriod() {
    setShowStartNewModal(false);
    setConfig(null);
    setForm(emptyForm);
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
    setExtendError("");
    // Default the picker to the day after the current closing date, so
    // it never opens already invalid against the after: rule.
    const current = config?.close_date ? new Date(config.close_date) : new Date();
    current.setDate(current.getDate() + 1);
    setExtendDate(current.toISOString().slice(0, 10));
    setShowExtendModal(true);
  }

  async function handleExtend() {
    if (!config || !extendDate) return;
    setExtending(true);
    setExtendError("");
    try {
      const res = await api.post(`/admin/application-configs/${config.id}/extend`, {
        close_date: extendDate,
      });
      setConfig(res.data.config);
      setForm((f) => ({ ...f, close_date: res.data.config.close_date }));
      setShowExtendModal(false);
      setSuccess("Application period extended.");
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
        // close_date is locked here — always sent back UNCHANGED. The
        // backend rejects this form outright if it differs from what's
        // on record; extending it only ever happens through
        // handleExtend() above. Formatted the same way it's displayed
        // (date only, midnight) so the equality check on the backend
        // doesn't get tripped up by a stray time component.
        close_date: config?.close_date ? config.close_date.slice(0, 10) + " 23:59:59" : "",
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

  const settingIcons = {
    "School Year": (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    "Application Status": (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="6" width="22" height="12" rx="6" />
        <circle cx="8" cy="12" r="3" />
      </svg>
    ),
    "Opening Date": (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <path d="M9 16l2 2 4-4" />
      </svg>
    ),
    "Closing Date": (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="9.5" y1="14.5" x2="14.5" y2="19.5" />
        <line x1="14.5" y1="14.5" x2="9.5" y2="19.5" />
      </svg>
    ),
    "Slot Availability": (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="6" x2="20" y2="6" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="18" x2="20" y2="18" />
        <circle cx="8" cy="6" r="1.5" fill="currentColor" />
        <circle cx="16" cy="12" r="1.5" fill="currentColor" />
        <circle cx="10" cy="18" r="1.5" fill="currentColor" />
      </svg>
    ),
    "Number of Available Slots": (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  };
  const settingIconColors = {
    "School Year": "gray",
    "Application Status": "red",
    "Opening Date": "blue",
    "Closing Date": "blue",
    "Slot Availability": "orange",
    "Number of Available Slots": "red",
  };

  function statusBadgeClass(value) {
    if (typeof value !== "string") return "settings-value-badge settings-value-badge-gray";
    if (value === "Open" || value === "Unlimited") return "settings-value-badge settings-value-badge-green";
    if (value === "Closed" || value === "Limited") return "settings-value-badge settings-value-badge-red";
    return "settings-value-badge settings-value-badge-gray";
  }

  return (
    <div className="admin-layout">
      <AdminNavigation />
      <div className="admin-main">
        <div className="admin-topbar">
          <div className="admin-topbar-user">
            <div className="admin-topbar-user-text">
              <span className="admin-topbar-user-name">Admin User</span>
              <span className="admin-topbar-user-role">Sangguniang Kabataan</span>
            </div>
            <div className="admin-topbar-avatar"></div>
          </div>
        </div>

        <section className="page-section">
          <div className="container-fluid">

            <div className="page-card">
              <h3 className="section-title mb-2">Application Settings</h3>
              <p className="text-muted mb-0">
                Configure the application period, school year, applicant slot availability, and other important settings for the educational assistance program.
              </p>
            </div>

            <div className="page-card">
              <h4 className="sub-title sub-title-dark">Program Configuration</h4>
              <div className="visibility-notice">
                <div className="visibility-notice-icon">!</div>
                <div className="visibility-notice-body">
                  <strong className="visibility-notice-title">Program Configuration Notice</strong>
                  <p className="visibility-notice-text">
                    These settings control the availability and basic parameters of the educational assistance application process.
                  </p>
                </div>
              </div>

              {config && (
                <div className="alert alert-info">
                  <strong>Closing Date is locked here.</strong>{" "}
                  Use the "Extend Application Period" action below to move it later — it can never be edited
                  through this form, whether or not the period has started.
                </div>
              )}

              {hasStarted && !hasClosed && (
                <div className="alert alert-warning">
                  <strong>This application period has already started.</strong>{" "}
                  School Year, Opening Date, Number of Available Slots, Slot Type, and Assistance Amount
                  can no longer be changed to protect data integrity for applicants who have already applied.
                </div>
              )}

              {hasClosed && (
                <div className="settings-warning-box d-flex justify-content-between align-items-center flex-wrap gap-2">
                  <div>
                    <strong>This application period has closed.</strong>{" "}
                    Applicants can no longer submit new applications. Extend the
                    Closing Date below to reopen submissions under this same
                    period, or start a new period entirely for a different
                    school year.
                  </div>
                  <button
                    type="button"
                    className="table-toolbar-btn admin-settings-blue-btn flex-shrink-0"
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
                <div className="text-center py-4"><div className="spinner-border text-danger" role="status" /></div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <div className="settings-split-card">
                    <div className="settings-split-col">
                      <h6 className="settings-split-title">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        Application Period
                      </h6>
                      <div className="row g-3">
                        <div className="col-12">
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
                        <div className="col-md-6">
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
                        <div className="col-md-6">
                          <label className="form-label">Closing Date</label>
                          <input
                            type="date"
                            className="form-control"
                            value={form.close_date ? form.close_date.slice(0, 10) : ""}
                            disabled
                            readOnly
                          />
                          <div className="form-text">
                            Locked — use "Extend Application Period" below to change it.
                          </div>
                        </div>
                      </div>
                      <div className="form-text mt-2">
                        Applications are only accepted between the Opening and Closing Dates.
                      </div>
                    </div>
                    <div className="settings-split-col settings-split-col-border">
                      <h6 className="settings-split-title">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        Slot Capacity
                      </h6>
                      <div className="row g-3">
                        <div className="col-12">
                          <label className="form-label d-block">Slot Type</label>
                          <div className="btn-group admin-settings-slot-toggle" role="group">
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
                            <label className="btn" htmlFor="slotLimited">
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
                            <label className="btn" htmlFor="slotUnlimited">
                              Unlimited
                            </label>
                          </div>
                        </div>
                        <div className="col-12">
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
                            <div className="settings-slot-stepper">
                              <button
                                type="button"
                                className="settings-slot-stepper-btn"
                                onClick={() =>
                                  setForm((f) => ({ ...f, slot_limit: Math.max(1, (Number(f.slot_limit) || 1) - 1) }))
                                }
                                disabled={hasStarted}
                                aria-label="Decrease slots"
                              >
                                −
                              </button>
                              <input
                                type="number"
                                className="settings-slot-stepper-input"
                                placeholder="e.g. 2000"
                                value={form.slot_limit}
                                onChange={set("slot_limit")}
                                disabled={hasStarted}
                                required
                                min={1}
                              />
                              <button
                                type="button"
                                className="settings-slot-stepper-btn"
                                onClick={() =>
                                  setForm((f) => ({ ...f, slot_limit: (Number(f.slot_limit) || 0) + 1 }))
                                }
                                disabled={hasStarted}
                                aria-label="Increase slots"
                              >
                                +
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="d-flex justify-content-end gap-2">
                    <button type="button" className="btn btn-clear-dark" onClick={() => setForm(emptyForm)}>
                      Clear
                    </button>
                    <button type="submit" className="btn btn-save-green" disabled={saving}>
                      {saving ? "Saving..." : "Save Settings"}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {config && !config.closed_at && (
              <div className="page-card">
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                  <div>
                    <h4 className="sub-title sub-title-dark mb-1">Extend Application Period</h4>
                    <p className="text-muted small mb-0">
                      Move the Closing Date later. Blocked if it would collide with an already-scheduled
                      claiming date or Grace Period start — reschedule those first if needed.
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

            <div className="page-card">
              <h4 className="sub-title sub-title-dark">Current Application Settings</h4>
              <div className="table-responsive">
                <table className="table table-bordered table-striped align-middle announcement-table settings-value-table">
                  <colgroup>
                    <col style={{ width: "50%" }} />
                    <col style={{ width: "50%" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Setting</th>
                      <th>Current Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={2} className="text-center py-4">
                          <div className="spinner-border text-danger" role="status" />
                        </td>
                      </tr>
                    ) : config ? (
                      currentSettings.map(([setting, value]) => (
                        <tr key={setting}>
                          <td>
                            <span className="settings-value-row">
                              <span className={`settings-value-row-icon-circle settings-value-row-icon-circle-${settingIconColors[setting]}`}>
                                {settingIcons[setting]}
                              </span>
                              {setting}
                            </span>
                          </td>
                          <td>
                            {setting === "Application Status" ? (
                              <span className={statusBadgeClass(value)}>{value}</span>
                            ) : setting === "Slot Availability" ? (
                              <span className="settings-value-badge settings-value-badge-red">{value}</span>
                            ) : (
                              value
                            )}
                          </td>
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
                    <h4 className="sub-title sub-title-dark mb-1">Close This Period</h4>
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
        <PanelFooter />
      </div>

      {showConfirmModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content edit-announcement-modal">
              <div className="modal-header">
                <h5 className="modal-title">Confirm Application Period Settings</h5>
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
                  Closing Date is never editable here — use "Extend Application Period" instead.
                </p>
              </div>
              <div className="d-flex justify-content-end gap-2 p-3 border-top">
                <button
                  type="button"
                  className="btn btn-clear-dark"
                  onClick={() => setShowConfirmModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-save-green"
                  onClick={saveSettings}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Confirm & Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showExtendModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content edit-announcement-modal">
              <div className="modal-header">
                <h5 className="modal-title">Extend Application Period</h5>
              </div>
              <div className="p-4">
                <p className="mb-2 text-muted small">
                  Current Closing Date: <strong>{formatDateTime(config?.close_date)}</strong>
                </p>
                <label className="form-label">New Closing Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={extendDate}
                  min={config?.close_date ? new Date(new Date(config.close_date).getTime() + 86400000).toISOString().slice(0, 10) : undefined}
                  onChange={(e) => setExtendDate(e.target.value)}
                />
                {extendError && <div className="alert alert-danger mt-3 mb-0">{extendError}</div>}
              </div>
              <div className="d-flex justify-content-end gap-2 p-3 border-top">
                <button
                  type="button"
                  className="btn btn-clear-dark"
                  onClick={() => setShowExtendModal(false)}
                  disabled={extending}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-save-green"
                  onClick={handleExtend}
                  disabled={extending || !extendDate}
                >
                  {extending ? "Extending..." : "Confirm Extension"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showStartNewModal && (
        <div className="feedback-popup-backdrop">
          <div className="feedback-popup feedback-popup-error feedback-popup-wide">
            <div className="feedback-popup-icon-wrap">
              <span className="feedback-popup-icon">!</span>
            </div>
            <h4 className="feedback-popup-title">Start New Application Period</h4>
            <p className="feedback-popup-message">
              This will clear the form below so you can set up a new
              application period. The current period's data will remain
              saved and accessible in your records — it will not be
              deleted or altered.
            </p>
            <div className="feedback-popup-confirm-actions">
              <button
                type="button"
                className="feedback-popup-cancel"
                onClick={() => setShowStartNewModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="feedback-popup-proceed"
                onClick={confirmStartNewPeriod}
              >
                Start New Period
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminSettings;