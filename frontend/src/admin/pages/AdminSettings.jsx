import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AdminNavigation from "../components/AdminNavigation";
import AdminTopbarUser from "../components/AdminTopbarUser";
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

// Covers a couple of years back (setting up a slightly-delayed period,
// or just referencing a recent one) through a handful ahead (planning
// room), without the original 26-year span (current -5 to +20) that was
// mostly dead weight to scroll through. `extraYear` keeps whatever's
// already saved on a loaded config in the list even if it falls outside
// this window, so editing an older period never leaves the <select>
// without a match for its own current value.
function generateSchoolYearOptions(extraYear) {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear - 2; y <= currentYear + 3; y++) {
    years.push(`${y}-${y + 1}`);
  }
  if (extraYear && !years.includes(extraYear)) {
    years.unshift(extraYear);
  }
  return years;
}

function nowDateTimeLocal() {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

// NOT toISOString().slice(0, 10) — that formats in UTC, which rolls local
// midnight back to the previous calendar day in any timezone ahead of UTC
// (e.g. Asia/Manila, UTC+8) — see AdminSchedule.jsx's own version of this
// exact helper. Backend requires close_date strictly after open_date, so
// the day right after is the earliest valid default.
function nextDayStr(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Pre-selects the common case (setting up this year's period) so the
// admin doesn't have to hunt for it in a 25-year dropdown — still just a
// default, not a restriction, since picking a future year to plan ahead
// is a perfectly normal, deliberate choice that needs no extra guarding.
function defaultSchoolYear() {
  const currentYear = new Date().getFullYear();
  return `${currentYear}-${currentYear + 1}`;
}

// Carries the previous period's slot count forward as a starting point
// (most periods don't change scale year to year) instead of leaving the
// admin to retype it from scratch; falls back to 1000 when there's no
// prior period to reference at all (a fresh deployment, or the prior one
// was unlimited and has nothing reusable here).
function emptyForm(lastSlotLimit) {
  return {
    school_year: defaultSchoolYear(),
    open_date: nowDateTimeLocal(),
    close_date: "",
    slot_limit: lastSlotLimit || 1000,
    is_unlimited: false,
    assistance_amount: "2000",
  };
}

function AdminSettings() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showStartNewModal, setShowStartNewModal] = useState(false);

  // Extend Application Period — the ONLY way close_date changes once a
  // config exists (ApplicationConfigurationController::extend()).
  // Separate from the main settings form/modal entirely.
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [extendDate, setExtendDate] = useState("");
  const [extending, setExtending] = useState(false);
  const [extendError, setExtendError] = useState("");
  const [showClosePeriodModal, setShowClosePeriodModal] = useState(false);
  // Scoped to the Close Period modal itself, same as extendError above —
  // the shared `error` state renders at the top of the page, far from
  // this button/modal near the bottom, so a failure there was easy to
  // miss entirely.
  const [closePeriodError, setClosePeriodError] = useState("");
  // Offered after the two events applicants have no other way of hearing
  // about: a brand new period opening, or the deadline they're relying on
  // moving later. { title, category, content } for the prefilled
  // announcement, or null.
  const [announceNudge, setAnnounceNudge] = useState(null);

  function goAnnounce() {
    const prefill = announceNudge;
    setAnnounceNudge(null);
    navigate("/AdminAnnouncements", { state: { prefill } });
  }

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

  // Fetched only to derive the claiming phase shown alongside Application
  // Period Status below — "Closed — Deadline Passed" on its own doesn't tell an
  // admin whether Scheduled Claiming or Late Claiming is actually
  // underway right now. 404s (no active config, or none set up yet) are
  // expected and silently ignored — this is a nice-to-have annotation,
  // not something worth surfacing as a page error.
  const [claimingSchedule, setClaimingSchedule] = useState(null);
  useEffect(() => {
    api.get("/admin/claiming-schedule")
      .then((res) => setClaimingSchedule(res.data.schedule ?? null))
      .catch(() => setClaimingSchedule(null));
  }, []);

  const claimingPhase = (() => {
    if (!claimingSchedule) return null;
    if (!claimingSchedule.is_active) return "Schedule not yet activated";

    // NOT toISOString().slice(0, 10) — that formats in UTC, which rolls
    // local midnight back to the previous calendar day in any timezone
    // ahead of UTC (e.g. Asia/Manila, UTC+8). See AdminSchedule.jsx's own
    // version of this same helper.
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const { late_claiming_date, late_claiming_end_date } = claimingSchedule;

    if (late_claiming_date && today >= late_claiming_date && today <= late_claiming_end_date) {
      return "Late Claiming open";
    }
    if (late_claiming_end_date && today > late_claiming_end_date) {
      return "Late Claiming ended";
    }
    return "Scheduled Claiming";
  })();

  const schoolYearOptions = generateSchoolYearOptions(config?.school_year);

  const hasStarted = config?.open_date
    ? new Date() >= new Date(config.open_date)
    : false;
  const hasClosed = config?.close_date
    ? new Date() > new Date(config.close_date)
    : false;
  const isAtCapacity =
    config && !config.closed_at && !config.is_unlimited && config.slots_filled >= config.slot_limit;

  // Close Date is only free-editable before a config exists at all (first
  // time setting up a period). Once a config record exists, it's locked
  // here for good — "Extend Application Period" below is the only path.
  const closeDateLocked = !!config;

  const set = (k) => (e) =>
    setForm((f) => ({
      ...f,
      [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  // Defaults Closing Date to the day after Opening Date while setting up
  // a brand new period — only fills it in while it's still blank, so
  // this never overwrites a date the admin already picked (matches the
  // same "default once, don't clobber a manual choice" pattern
  // AdminSchedule.jsx uses for its own date defaults). No-op once a
  // config exists, since Closing Date is locked by then anyway.
  useEffect(() => {
    if (closeDateLocked || !form.open_date) return;
    setForm((f) => {
      if (f.close_date) return f;
      return { ...f, close_date: nextDayStr(f.open_date.slice(0, 10)) };
    });
  }, [form.open_date, closeDateLocked]);

  function needsConfirmation() {
    return !hasStarted;
  }

  function startNewPeriod() {
    setShowStartNewModal(true);
  }

  function confirmStartNewPeriod() {
    setShowStartNewModal(false);
    // Read before clearing config below — carries the just-closed
    // period's slot count forward as the new form's starting point.
    setForm(emptyForm(config?.slot_limit));
    setConfig(null);
    setSuccess("");
    setError("");
  }

  async function handleClosePeriod() {
    if (!config) return;
    setClosing(true);
    setClosePeriodError("");
    setSuccess("");
    try {
      const res = await api.post(`/admin/application-configs/${config.id}/close`);
      setSuccess(res.data.message);
      setConfig((prev) => ({ ...prev, closed_at: res.data.config.closed_at }));
      setShowClosePeriodModal(false);
    } catch (err) {
      setClosePeriodError(err.response?.data?.message || "Failed to close period.");
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
        // Matches saveSettings()'s own convention (close_date + " 23:59:59")
        // — without this, the deadline silently lands at midnight/start of
        // day instead of end of day, cutting the extension short by a full
        // day of the date the admin actually picked.
        close_date: `${extendDate} 23:59:59`,
      });
      setConfig(res.data.config);
      setForm((f) => ({ ...f, close_date: res.data.config.close_date }));
      setShowExtendModal(false);
      setSuccess("Application period extended.");
      setAnnounceNudge({
        title: "Application Deadline Extended",
        category: "Schedule Update",
        content: `The application deadline for school year ${res.data.config.school_year} has been extended to ${formatDateTime(res.data.config.close_date)}. Please take note of this change.`,
      });
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
        // Close Date is only ever taken from the form on FIRST creation
        // (no config yet). Once a config exists it's locked to what's
        // already on record — always sent back UNCHANGED — and the
        // backend rejects this form outright if it differs. Extending
        // it later only ever happens through handleExtend() above.
        // Formatted the same way it's displayed (date only, midnight)
        // so the equality check on the backend doesn't get tripped up
        // by a stray time component.
        close_date: config
          ? config.close_date.slice(0, 10) + " 23:59:59"
          : (form.close_date ? form.close_date.slice(0, 10) + " 23:59:59" : ""),
        slot_limit: form.is_unlimited ? null : form.slot_limit,
        assistance_amount: form.assistance_amount,
      };
      const isNewPeriod = !config;
      let response;
      if (config) {
        response = await api.put(`/admin/application-configs/${config.id}`, payload);
      } else {
        response = await api.post("/application-config", payload);
      }
      const updated = response.data.config;
      setConfig(updated);
      if (isNewPeriod) {
        setAnnounceNudge({
          title: `Applications Now Open for School Year ${updated.school_year}`,
          category: "Educational Assistance",
          content: `Applications for the educational assistance program (school year ${updated.school_year}) are now open, from ${formatDateTime(updated.open_date)} to ${formatDateTime(updated.close_date)}.`,
        });
      }
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
        "Application Period Status",
        !config.is_active
          ? "Superseded"
          : config.closed_at
            ? "Closed"
            : hasClosed 
              ? "Closed — Deadline Passed"
              : hasStarted
                ? "Open"
                : `Scheduled — opens ${formatDateTime(config.open_date)}`,
      ],
      ["Opening Date", formatDateTime(config.open_date)],
      ["Closing Date", formatDateTime(config.close_date)],
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
    "Application Period Status": (
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
    "Number of Available Slots": (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    "Assistance Amount per Applicant": (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M14.5 9a2.5 2.5 0 0 0-2.5-1.5c-1.5 0-2.5 1-2.5 2s1 1.7 2.5 2 2.5 1 2.5 2-1 2-2.5 2A2.5 2.5 0 0 1 9.5 14" />
        <line x1="12" y1="6" x2="12" y2="18" />
      </svg>
    ),
  };
  const settingIconColors = {
    "School Year": "gray",
    "Application Period Status": "red",
    "Opening Date": "blue",
    "Closing Date": "blue",
    "Assistance Amount per Applicant": "green",
    "Number of Available Slots": "red",
  };

  function statusBadgeClass(value) {
    if (typeof value !== "string") return "settings-value-badge settings-value-badge-gray";
    if (value === "Open" || value === "Unlimited") return "settings-value-badge settings-value-badge-green";
    if (value.startsWith("Closed") || value === "Limited") return "settings-value-badge settings-value-badge-red";
    return "settings-value-badge settings-value-badge-gray";
  }

  return (
    <div className="admin-layout">
      <AdminNavigation
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      <div className="admin-main">
        <div className="admin-topbar">
          <AdminTopbarUser onMenuOpen={() => setMobileMenuOpen(true)} />
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
              <h4 className="sub-title sub-title-dark">Application Period Settings</h4>

              {hasStarted && !hasClosed && !config?.closed_at && (
                <div className="schedule-notice schedule-notice-yellow mb-3">
                  <div className="schedule-notice-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 9v4" />
                      <path d="M12 17h.01" />
                      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                    </svg>
                  </div>
                  <div>
                    <strong>This period is already open.</strong> School Year, Opening Date, Slot settings,
                    and Assistance Amount are locked to protect data integrity for applicants who've already
                    applied.
                  </div>
                </div>
              )}

              {hasClosed && !config?.closed_at && (
                <div className="schedule-notice schedule-notice-yellow mb-3">
                  <div className="schedule-notice-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 9v4" />
                      <path d="M12 17h.01" />
                      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                    </svg>
                  </div>
                  <div>
                    <strong>The closing date has passed, but this period hasn't been officially closed yet.</strong>{" "}
                    Applicants can no longer submit new applications. Extend the Closing Date below to reopen
                    submissions — this warning clears once the period is officially closed.
                  </div>
                </div>
              )}

              {config?.closed_at && (
                <div className="schedule-notice schedule-notice-yellow mb-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
                  <div className="d-flex align-items-start gap-3">
                    <div className="schedule-notice-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 9v4" />
                        <path d="M12 17h.01" />
                        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                      </svg>
                    </div>
                    <div>
                      <strong>This application period has closed.</strong> Applicants can no longer submit new
                      applications, and this period can no longer be extended or reopened — it's a final,
                      settled state. Start a new application period for a different school year when ready.
                    </div>
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
                <div className="schedule-notice schedule-notice-yellow mb-3">
                  <div className="schedule-notice-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 9v4" />
                      <path d="M12 17h.01" />
                      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                    </svg>
                  </div>
                  <div>
                    <strong>This period is at capacity</strong> ({config.slots_filled}/{config.slot_limit} slots
                    filled) — no new applicants can be accepted unless you increase the slot limit.
                  </div>
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
                            {schoolYearOptions.map((sy) => (
                              <option key={sy} value={sy}>{sy}</option>
                            ))}
                          </select>
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Opening Date &amp; Time</label>
                          <input
                            type="datetime-local"
                            className="form-control"
                            // <input type="datetime-local"> requires a
                            // literal "T" separator to accept a value —
                            // the backend serializes dates as "YYYY-MM-DD
                            // HH:mm:ss" (space, see
                            // ApplicationConfiguration::serializeDate()),
                            // so an existing period's open_date silently
                            // rendered as a blank field without this.
                            value={form.open_date ? form.open_date.slice(0, 16).replace(" ", "T") : ""}
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
                            value={
                              closeDateLocked
                                ? (config?.close_date ? config.close_date.slice(0, 10) : "")
                                : (form.close_date ? form.close_date.slice(0, 10) : "")
                            }
                            onChange={closeDateLocked ? undefined : set("close_date")}
                            disabled={closeDateLocked}
                            readOnly={closeDateLocked}
                            min={form.open_date ? form.open_date.slice(0, 10) : undefined}
                            required={!closeDateLocked}
                          />
                          <div className="form-text">
                            {closeDateLocked
                              ? 'Ends 11:59 PM. Locked — use "Extend Application Period" below to change it.'
                              : 'Ends 11:59 PM. Set once — use "Extend Application Period" later to move it.'}
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
                          <label className="form-label">Number of Available Slots</label>
                          {form.is_unlimited ? (
                            // Only reachable when editing an existing period
                            // that was already saved as unlimited before
                            // this option was removed — there's no longer
                            // any way to set a NEW period to unlimited.
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

                      <h6 className="settings-split-title mt-4">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="9" />
                          <path d="M14.5 9a2.5 2.5 0 0 0-2.5-1.5c-1.5 0-2.5 1-2.5 2s1 1.7 2.5 2 2.5 1 2.5 2-1 2-2.5 2A2.5 2.5 0 0 1 9.5 14" />
                          <line x1="12" y1="6" x2="12" y2="18" />
                        </svg>
                        Assistance Amount
                      </h6>
                      <div className="row g-3">
                        <div className="col-12">
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
                        Used for budget reports and disbursement calculations. Locked once this period opens.
                      </div>
                    </div>
                  </div>
                  <div className="d-flex justify-content-end gap-2">
                    {/* Only makes sense for a brand new, never-saved period —
                        Closing Date reads from `config`, not `form`, once a
                        config exists (see closeDateLocked below), so
                        resetting `form` here would leave Closing Date
                        showing the old saved value while everything else
                        went blank, and a subsequent save would PUT those
                        blanked-out defaults onto the EXISTING record
                        instead of doing anything resembling "starting
                        over". */}
                    {!config && (
                      <button type="button" className="btn btn-clear-dark" onClick={() => setForm(emptyForm())}>
                        Clear
                      </button>
                    )}
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
                      claiming date or Late Claiming start — reschedule those first if needed.
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
                      <th>Value</th>
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
                            {setting === "Application Period Status" ? (
                              <>
                                <span className={statusBadgeClass(value)}>{value}</span>
                                {claimingPhase && (
                                  <div className="text-muted small mt-1">{claimingPhase}</div>
                                )}
                              </>
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
                      finalized as "not selected." Only available once Late Claiming has ended.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline-danger"
                    onClick={() => {
                      setClosePeriodError("");
                      setShowClosePeriodModal(true);
                    }}
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
                  <li>Assistance Amount per Applicant</li>
                </ul>
                <p className="mb-0 text-muted small">
                  Closing Date is never editable here once saved — use "Extend Application Period" instead.
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
                <div className="form-text">Submissions will close at 11:59 PM on this date.</div>
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

      {showClosePeriodModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content edit-announcement-modal">
              <div className="modal-header">
                <h5 className="modal-title">Close This Period?</h5>
              </div>
              <div className="p-4">
                <p className="mb-0">
                  This will mark every remaining waitlisted applicant as not
                  selected. This cannot be undone.
                </p>
                {closePeriodError && <div className="alert alert-danger mt-3 mb-0">{closePeriodError}</div>}
              </div>
              <div className="d-flex justify-content-end gap-2 p-3 border-top">
                <button
                  type="button"
                  className="btn btn-clear-dark"
                  onClick={() => setShowClosePeriodModal(false)}
                  disabled={closing}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleClosePeriod}
                  disabled={closing}
                >
                  {closing ? "Closing..." : "Yes, Close Period"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {announceNudge && (
        <div className="feedback-popup-backdrop">
          <div className="feedback-popup feedback-popup-success">
            <div className="feedback-popup-icon-wrap">
              <span className="feedback-popup-icon">✓</span>
            </div>
            <h4 className="feedback-popup-title">{announceNudge.title}</h4>
            <p className="feedback-popup-message">
              Applicants aren't notified of this automatically. Want to post an
              announcement about it?
            </p>
            <div className="feedback-popup-confirm-actions">
              <button
                type="button"
                className="feedback-popup-cancel"
                onClick={() => setAnnounceNudge(null)}
              >
                Not Now
              </button>
              <button
                type="button"
                className="feedback-popup-proceed"
                onClick={goAnnounce}
              >
                Create Announcement
              </button>
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