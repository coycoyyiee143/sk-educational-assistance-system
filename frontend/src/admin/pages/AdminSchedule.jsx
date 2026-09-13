import { useState, useEffect, useCallback } from "react";
import AdminNavigation from "../components/AdminNavigation";
import api from "../../services/api";
import PanelFooter from "../../components/PanelFooter";

const emptyForm = {
  location: "Barangay Mamatid Hall",
  morning_start: "07:00",
  morning_end: "12:00",
  afternoon_start: "13:00",
  afternoon_end: "17:00",
  grace_period_date: "",
  grace_period_end_date: "",
};

const emptySessionLane = () => ({ lane_name: "", capacity: "" });
const emptyDay = () => ({
  date: "",
  morning: { enabled: true, lanes: [emptySessionLane()] },
  afternoon: { enabled: true, lanes: [emptySessionLane()] },
});

function groupLanesIntoDays(lanesArr) {
  if (!lanesArr || lanesArr.length === 0) return [emptyDay()];
  const map = {};
  lanesArr
    .filter((l) => l.lane_name !== "Grace Period Claiming")
    .forEach((l) => {
      if (!map[l.claiming_date]) {
        map[l.claiming_date] = {
          date: l.claiming_date,
          morning: { enabled: false, lanes: [] },
          afternoon: { enabled: false, lanes: [] },
        };
      }
      map[l.claiming_date][l.batch].enabled = true;
      map[l.claiming_date][l.batch].lanes.push({
        lane_name: l.lane_name,
        capacity: l.capacity ?? "",
      });
    });
  const days = Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  return days.length > 0 ? days : [emptyDay()];
}

function serializeLanes(days) {
  const lanes = [];
  days.forEach((day, dayIdx) => {
    ["morning", "afternoon"].forEach((session) => {
      if (!day[session].enabled) return;
      day[session].lanes.forEach((lane, laneIdx) => {
        lanes.push({
          lane_name: lane.lane_name.trim() || `Day ${dayIdx + 1} ${session === "morning" ? "AM" : "PM"} Lane ${laneIdx + 1}`,
          // Capacity is required now — no more "blank = auto-split",
          // since there's no fixed applicant pool to split at save time
          // under real-time assignment. Default to 1 if left blank so
          // the request doesn't fail validation outright; the admin
          // should set a real number.
          capacity: lane.capacity ? Number(lane.capacity) : 1,
          batch: session,
          claiming_date: day.date,
        });
      });
    });
  });
  return lanes;
}

function nextDayStr(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function formatDateRange(dates) {
  const unique = [...new Set(dates.filter(Boolean))].sort();
  if (unique.length === 0) return "—";
  if (unique.length === 1) return unique[0];
  return `${unique[0]} to ${unique[unique.length - 1]}`;
}

function AdminSchedule() {
  const [config, setConfig] = useState(null);
  const [approvedCount, setApprovedCount] = useState(0);
  const [unassignedApprovedCount, setUnassignedApprovedCount] = useState(0);
  const [schedule, setSchedule] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [days, setDays] = useState([emptyDay()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lanePage, setLanePage] = useState(1);
  const lanePerPage = 10;
  const [gracePeriodList, setGracePeriodList] = useState(null);
  const [loadingGracePeriodList, setLoadingGracePeriodList] = useState(false);

  const loadGracePeriodClaimingList = useCallback(() => {
    setLoadingGracePeriodList(true);
    api.get("/admin/reports/grace-period-claiming-list")
      .then((res) => setGracePeriodList(res.data))
      .catch(() => setGracePeriodList(null))
      .finally(() => setLoadingGracePeriodList(false));
  }, []);

  const loadSchedule = useCallback((silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    return api.get("/admin/claiming-schedule")
      .then((res) => {
        setConfig(res.data.config);
        setApprovedCount(res.data.approved_count);
        setUnassignedApprovedCount(res.data.unassigned_approved_count ?? 0);
        const sched = res.data.schedule;
        setSchedule(sched);
        if (sched) {
          setForm({
            location: sched.location,
            morning_start: sched.morning_start?.slice(0, 5) ?? "07:00",
            morning_end: sched.morning_end?.slice(0, 5) ?? "12:00",
            afternoon_start: sched.afternoon_start?.slice(0, 5) ?? "13:00",
            afternoon_end: sched.afternoon_end?.slice(0, 5) ?? "17:00",
            grace_period_date: sched.grace_period_date ?? "",
            grace_period_end_date: sched.grace_period_end_date ?? "",
          });
          setDays(groupLanesIntoDays(sched.lanes));
          if (sched.grace_period_date) {
            loadGracePeriodClaimingList();
          }
        }
      })
      .catch((err) => {
        if (err.response?.status !== 404) {
          setError("Failed to load schedule data.");
        } else {
          setConfig(null);
        }
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, [loadGracePeriodClaimingList]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function setDayDate(dayIndex, value) {
    setDays((prev) => prev.map((d, i) => i === dayIndex ? { ...d, date: value } : d));
  }

  function toggleSession(dayIndex, session) {
    setDays((prev) => prev.map((d, i) => {
      if (i !== dayIndex) return d;
      return { ...d, [session]: { ...d[session], enabled: !d[session].enabled } };
    }));
  }

  function addDay() {
    setDays((prev) => [...prev, emptyDay()]);
  }

  function removeDay(dayIndex) {
    setDays((prev) => prev.filter((_, i) => i !== dayIndex));
  }

  function addLane(dayIndex, session) {
    setDays((prev) => prev.map((d, i) => {
      if (i !== dayIndex) return d;
      return { ...d, [session]: { ...d[session], lanes: [...d[session].lanes, emptySessionLane()] } };
    }));
  }

  function removeLane(dayIndex, session, laneIndex) {
    setDays((prev) => prev.map((d, i) => {
      if (i !== dayIndex) return d;
      return { ...d, [session]: { ...d[session], lanes: d[session].lanes.filter((_, li) => li !== laneIndex) } };
    }));
  }

  function setLaneField(dayIndex, session, laneIndex, key, value) {
    setDays((prev) => prev.map((d, i) => {
      if (i !== dayIndex) return d;
      return {
        ...d,
        [session]: {
          ...d[session],
          lanes: d[session].lanes.map((l, li) => li === laneIndex ? { ...l, [key]: value } : l),
        },
      };
    }));
  }

  function handleReset() {
    setForm(emptyForm);
    setDays([emptyDay()]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (days.length === 0) {
      setError("Please add at least one claiming day.");
      return;
    }
    for (const day of days) {
      if (!day.date) {
        setError("Please set a date for every claiming day.");
        return;
      }
      if (!day.morning.enabled && !day.afternoon.enabled) {
        setError(`${day.date} needs at least one active session (morning or afternoon).`);
        return;
      }
      for (const session of ["morning", "afternoon"]) {
        if (day[session].enabled && day[session].lanes.length === 0) {
          setError(`Add at least one lane to the ${session} session on ${day.date}.`);
          return;
        }
        if (day[session].enabled && day[session].lanes.some((l) => !l.capacity || Number(l.capacity) < 1)) {
          setError(`Every lane needs a capacity of at least 1 — check the ${session} session on ${day.date}.`);
          return;
        }
      }
    }
    const lanes = serializeLanes(days);
    setSaving(true);
    try {
      const res = await api.post("/admin/claiming-schedule", { ...form, lanes });
      setSchedule(res.data.schedule);
      setSuccess("Schedule saved. Activate it below to start assigning approved applicants to lanes in real time.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save schedule.");
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate() {
    if (!schedule) return;
    if (!window.confirm("Activate this claiming schedule? From this point on, every newly-approved applicant is assigned to a lane and notified automatically, and lane setup can no longer be edited.")) return;
    setActivating(true);
    setError("");
    setSuccess("");
    try {
      const res = await api.post(`/admin/claiming-schedule/${schedule.id}/activate`);
      setSuccess(res.data.message);
      setSchedule(res.data.schedule);
      loadSchedule(true);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to activate schedule.");
    } finally {
      setActivating(false);
    }
  }

  async function handlePrint(laneId) {
    // Opened synchronously (before the await) so popup blockers don't
    // treat this as an unsolicited new-tab open — the fetch fills it in.
    const printWindow = window.open("", "_blank");
    try {
      const res = await api.get(`/admin/claiming-schedule/lanes/${laneId}/printable/pdf`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      if (printWindow) {
        printWindow.location.href = url;
      }
      // Not revoking the object URL here — the new tab's PDF viewer needs
      // it to stay valid while the user is looking at / printing from it.
    } catch (err) {
      if (printWindow) printWindow.close();
      setError("Failed to generate printable list.");
    }
  }

  async function handleGracePeriodClaimingListExport() {
    try {
      const res = await api.get("/admin/reports/grace-period-claiming-list/pdf", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `grace-period-claiming-list-${new Date().toISOString().slice(0, 10)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError("Failed to generate grace period claiming list.");
    }
  }

  const isActive = schedule?.is_active;
  const hasApproved = approvedCount > 0;
  const totalLanesCount = days.reduce((sum, d) =>
    sum + (d.morning.enabled ? d.morning.lanes.length : 0) + (d.afternoon.enabled ? d.afternoon.lanes.length : 0), 0);
  const claimingDates = days.map(d => d.date).filter(Boolean);
  const latestClaimingDateStr = claimingDates.length > 0
    ? claimingDates.slice().sort().slice(-1)[0]
    : null;
  const summaryItems = schedule ? [
    { label: "Total Approved Applicants", value: approvedCount },
    { label: "Awaiting a Lane", value: unassignedApprovedCount },
    { label: "Total Lanes", value: totalLanesCount },
    { label: "Claiming Dates", value: formatDateRange(claimingDates) },
    {
      label: "Grace Period",
      value: form.grace_period_date
        ? (form.grace_period_end_date
          ? `${form.grace_period_date} to ${form.grace_period_end_date}`
          : form.grace_period_date)
        : "Not set",
    },
  ] : [];

  // Under real-time assignment, "the lanes" is just schedule.lanes with
  // its live assignments_count — there's no separate preview snapshot to
  // reconcile against, since applicants land on a lane the moment
  // they're approved, not at some future publish step.
  const displayedLanes = (schedule?.lanes ?? []).filter((l) => l.lane_name !== "Grace Period Claiming");
  const laneTotalPages = Math.max(1, Math.ceil(displayedLanes.length / lanePerPage));
  const lanePageStart = (lanePage - 1) * lanePerPage;
  const pagedLanes = displayedLanes.slice(lanePageStart, lanePageStart + lanePerPage);

  function goToLanePage(page) {
    if (page < 1 || page > laneTotalPages) return;
    setLanePage(page);
  }

  function getLanePageNumbers() {
    const pages = [];
    const maxVisible = 5;
    if (laneTotalPages <= maxVisible) {
      for (let i = 1; i <= laneTotalPages; i++) pages.push(i);
      return pages;
    }
    pages.push(1);
    if (lanePage > 3) pages.push("...");
    const start = Math.max(2, lanePage - 1);
    const end = Math.min(laneTotalPages - 1, lanePage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (lanePage < laneTotalPages - 2) pages.push("...");
    pages.push(laneTotalPages);
    return pages;
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
              <h3 className="section-title mb-2">Claiming Schedule Management</h3>
              <p className="text-muted mb-0">
                Set the claiming dates, batches, lane capacities, and grace period. Once activated, approved
                applicants are assigned to a lane and notified automatically, in real time, as they're approved —
                no separate publish step.
              </p>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <div className="page-card">
              <h4 className="sub-title sub-title-dark">Schedule Summary</h4>
              {loading ? (
                <div className="text-center py-4"><div className="spinner-border text-danger" role="status" /></div>
              ) : !config ? (
                <div className="notice-box">No active application period found. Set up an application configuration first.</div>
              ) : (
                <>
                  {hasApproved ? (
                    <div className="schedule-notice schedule-notice-green">
                      <div className="schedule-notice-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      </div>
                      <div>
                        {approvedCount} approved applicant(s) with assigned control numbers for {config.school_year}.
                        {isActive && unassignedApprovedCount > 0 && (
                          <> {unassignedApprovedCount} of them are still waiting on a lane (every lane was full when they were approved) — they'll be picked up automatically once room opens or you add more lanes.</>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="notice-box">
                      No approved applicants with assigned control numbers were found yet. You may still prepare the schedule, but activation won't assign anyone until applicants get approved.
                    </div>
                  )}
                  {isActive && (
                    <div className="schedule-notice schedule-notice-yellow mt-3">
                      <div className="schedule-notice-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      </div>
                      <div>
                        <strong>This schedule was activated on {new Date(schedule.activated_at).toLocaleString()}.</strong> Lane setup can no longer be edited — applicants are being assigned to it in real time.
                      </div>
                    </div>
                  )}
                  {schedule && (
                    // row-cols instead of a fixed col-md-3: Bootstrap divides
                    // the row evenly by however many columns are set at each
                    // breakpoint, so 5 cards wrap 3+2 (or however many fit)
                    // instead of 4 filling a row and stranding the 5th alone.
                    <div className="row g-3 mt-3 row-cols-2 row-cols-md-3 row-cols-lg-5">
                      {summaryItems.map(({ label, value }) => (
                        <div className="col" key={label}>
                          <div className="schedule-summary-card">
                            <h6 className="schedule-summary-label">{label}</h6>
                            <p className="schedule-summary-value">{value}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {(loading || config) && (
              <div className="page-card">
                <h4 className="sub-title sub-title-dark">Create Claiming Schedule</h4>
                <div className="visibility-notice">
                  <div className="visibility-notice-icon">!</div>
                  <div className="visibility-notice-body">
                    <strong className="visibility-notice-title">Schedule Setup Notice</strong>
                    <p className="visibility-notice-text">
                      Add a card for each claiming day, toggle which sessions run that day (turn one off if you're
                      only doing mornings or afternoons), and add a lane for each verifier or station handling that
                      session. Every lane needs a real capacity — lanes fill in order (this lane's date, then the
                      next), and once one lane is full, newly-approved applicants move to the next.
                    </p>
                  </div>
                </div>

                {loading ? (
                  <div className="text-center py-4"><div className="spinner-border text-danger" role="status" /></div>
                ) : (
                  <form onSubmit={handleSubmit}>
                    <fieldset disabled={isActive}>
                      <div className="row g-3 mb-4">
                        <div className="col-md-6">
                          <label className="form-label">Claiming Location</label>
                          <input type="text" className="form-control" value={form.location} onChange={set("location")} required />
                        </div>
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Default Morning Session Time</label>
                            <div className="row g-2">
                              <div className="col-6">
                                <input type="time" className="form-control" value={form.morning_start} onChange={set("morning_start")} />
                              </div>
                              <div className="col-6">
                                <input type="time" className="form-control" value={form.morning_end} onChange={set("morning_end")} />
                              </div>
                            </div>
                          </div>
                          <div>
                            <label className="form-label">Default Afternoon Session Time</label>
                            <div className="row g-2">
                              <div className="col-6">
                                <input type="time" className="form-control" value={form.afternoon_start} onChange={set("afternoon_start")} />
                              </div>
                              <div className="col-6">
                                <input type="time" className="form-control" value={form.afternoon_end} onChange={set("afternoon_end")} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <hr className="my-4" />
                      <h5 className="sub-title sub-title-dark mb-3" style={{ fontSize: "18px" }}>Claiming Days</h5>

                      {days.map((day, dayIdx) => (
                        <div className="sub-card schedule-day-card mb-3" key={dayIdx}>
                          <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                            <h6 className="sub-title-dark mb-0">Claiming Day {dayIdx + 1}</h6>
                            {!isActive && days.length > 1 && (
                              <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => removeDay(dayIdx)}>
                                Remove Day
                              </button>
                            )}
                          </div>

                          <div className="row g-3 mb-3">
                            <div className="col-md-4">
                              <label className="form-label">Date</label>
                              <input
                                type="date"
                                className="form-control"
                                value={day.date}
                                onChange={(e) => setDayDate(dayIdx, e.target.value)}
                                required
                              />
                              {config?.close_date && (
                                <div className="form-text">Must be after {config.close_date.slice(0, 10)}</div>
                              )}
                            </div>
                          </div>

                          {["morning", "afternoon"].map((session) => (
                            <div className="mb-3" key={session}>
                              <div className="form-check form-switch mb-2">
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  id={`day-${dayIdx}-${session}`}
                                  checked={day[session].enabled}
                                  onChange={() => toggleSession(dayIdx, session)}
                                />
                                <label className="form-check-label fw-semibold" htmlFor={`day-${dayIdx}-${session}`}>
                                  {session === "morning"
                                    ? `Morning Session (${form.morning_start} – ${form.morning_end})`
                                    : `Afternoon Session (${form.afternoon_start} – ${form.afternoon_end})`}
                                </label>
                              </div>

                              {day[session].enabled && (
                                <div className="table-responsive">
                                  <table className="table table-sm table-bordered align-middle mb-2 announcement-table">
                                    <thead>
                                      <tr>
                                        <th>Lane / Station Name (optional)</th>
                                        <th style={{ width: "220px" }}>Capacity *</th>
                                        {!isActive && <th style={{ width: "90px" }}></th>}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {day[session].lanes.map((lane, laneIdx) => (
                                        <tr key={laneIdx}>
                                          <td>
                                            <input
                                              type="text"
                                              className="form-control form-control-sm"
                                              placeholder={`Day ${dayIdx + 1} ${session === "morning" ? "AM" : "PM"} Lane ${laneIdx + 1}`}
                                              value={lane.lane_name}
                                              onChange={(e) => setLaneField(dayIdx, session, laneIdx, "lane_name", e.target.value)}
                                            />
                                          </td>
                                          <td>
                                            <input
                                              type="number"
                                              min="1"
                                              className="form-control form-control-sm"
                                              placeholder="Required"
                                              value={lane.capacity}
                                              onChange={(e) => setLaneField(dayIdx, session, laneIdx, "capacity", e.target.value)}
                                              required
                                            />
                                          </td>
                                          {!isActive && (
                                            <td>
                                              <button
                                                type="button"
                                                className="btn btn-outline-danger btn-sm"
                                                onClick={() => removeLane(dayIdx, session, laneIdx)}
                                                disabled={day[session].lanes.length === 1}
                                              >
                                                Remove
                                              </button>
                                            </td>
                                          )}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>

                                  {!isActive && (
                                    <button
                                      type="button"
                                      className="btn btn-outline-custom btn-sm"
                                      onClick={() => addLane(dayIdx, session)}
                                    >
                                      + Add Lane
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}

                      {!isActive && (
                        <button type="button" className="btn btn-outline-custom btn-sm mb-3" onClick={addDay}>
                          + Add Claiming Day
                        </button>
                      )}

                      <hr className="my-4" />
                      <h5 className="sub-title sub-title-dark mb-3" style={{ fontSize: "18px" }}>Grace Period</h5>

                      <div className="visibility-notice visibility-notice-compact mb-3">
                        <div className="visibility-notice-icon">!</div>
                        <div className="visibility-notice-body">
                          <p className="visibility-notice-text mb-0">
                            A second chance for applicants who missed their claiming day, and for anyone
                            promoted from the waitlist after this schedule was set up. Leave both dates blank
                            if this period won't have one.
                          </p>
                        </div>
                      </div>

                      <div className="row g-3 mb-3">
                        <div className="col-md-6">
                          <label className="form-label">Start Date</label>
                          <input
                            type="date"
                            className="form-control"
                            value={form.grace_period_date}
                            onChange={set("grace_period_date")}
                            min={latestClaimingDateStr ? nextDayStr(latestClaimingDateStr) : undefined}
                          />
                          {latestClaimingDateStr ? (
                            <div className="form-text">
                              Must be after {latestClaimingDateStr} — the latest claiming date entered above.
                            </div>
                          ) : (
                            <div className="form-text">
                              Enter at least one claiming day above first.
                            </div>
                          )}
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">End Date</label>
                          <input
                            type="date"
                            className="form-control"
                            value={form.grace_period_end_date}
                            onChange={set("grace_period_end_date")}
                            min={form.grace_period_date || undefined}
                          />
                        </div>
                      </div>
                    </fieldset>

                    {!isActive && (
                      <div className="mt-4 d-flex justify-content-end gap-2 flex-wrap">
                        <button type="button" className="btn btn-secondary" onClick={handleReset}>
                          Clear
                        </button>
                        <button type="submit" className="btn btn-custom" disabled={saving}>
                          {saving ? "Saving..." : "Save Schedule"}
                        </button>
                      </div>
                    )}
                  </form>
                )}
              </div>
            )}

            {!loading && schedule && (
              <div className="page-card">
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                  <h4 className="sub-title sub-title-dark mb-0">
                    {isActive ? "Lane Lists (live)" : "Planned Lanes"}
                  </h4>
                  <button className="btn btn-outline-custom btn-sm" onClick={() => loadSchedule(true)} disabled={refreshing}>
                    {refreshing ? "Refreshing..." : "Refresh"}
                  </button>
                </div>

                {!isActive && (
                  <div className="info-box mt-2">
                    Nobody is assigned yet — activate the schedule below to start assigning approved applicants to
                    these lanes automatically, in the order lanes are listed here.
                  </div>
                )}

                <div className="table-responsive mt-3">
                  <table className="table table-bordered table-striped align-middle announcement-table" style={{ tableLayout: "fixed" }}>
                    <colgroup>
                      <col style={{ width: "16%" }} />
                      <col style={{ width: "12%" }} />
                      <col style={{ width: "14%" }} />
                      <col style={{ width: "10%" }} />
                      <col style={{ width: "22%" }} />
                      <col style={{ width: "16%" }} />
                      {isActive && <col style={{ width: "10%" }} />}
                    </colgroup>

                    <thead>
                      <tr>
                        <th>Lane</th>
                        <th>Batch</th>
                        <th>Date</th>
                        <th>Capacity</th>
                        <th>Control Number Range</th>
                        <th>Assigned Applicants</th>
                        {isActive && <th>Print</th>}
                      </tr>
                    </thead>

                    <tbody>
                      {pagedLanes.map((lane) => (
                        <tr key={lane.id}>
                          <td>{lane.lane_name}</td>
                          <td>{lane.batch === "morning" ? "Morning" : "Afternoon"}</td>
                          <td>{lane.claiming_date}</td>
                          <td>{lane.capacity ?? "—"}</td>
                          <td>{lane.control_number_range ?? "—"}</td>
                          <td>
                            {lane.assignments_count ?? 0}
                            {lane.capacity ? ` / ${lane.capacity}` : ""}
                          </td>
                          {isActive && (
                            <td>
                              <button
                                className="icon-btn icon-btn-green"
                                onClick={() => handlePrint(lane.id)}
                                title="Print Lane List"
                                aria-label="Print Lane List"
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="6 9 6 2 18 2 18 9" />
                                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                                  <rect x="6" y="14" width="12" height="8" />
                                </svg>
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                      {pagedLanes.length === 0 && (
                        <tr>
                          <td colSpan={isActive ? 7 : 6} className="text-muted">
                            No lanes configured yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {displayedLanes.length > 0 && (
                  <div className="table-pagination-bar">
                    <span className="table-pagination-info">
                      Showing {lanePageStart + 1}–{Math.min(lanePageStart + lanePerPage, displayedLanes.length)} of {displayedLanes.length} lanes
                    </span>
                    <div className="table-pagination-controls">
                      <button
                        className="table-pagination-arrow"
                        onClick={() => goToLanePage(lanePage - 1)}
                        disabled={lanePage === 1}
                        aria-label="Previous page"
                      >
                        ‹
                      </button>

                      {getLanePageNumbers().map((page, idx) =>
                        page === "..." ? (
                          <span key={`ellipsis-${idx}`} className="table-pagination-ellipsis">…</span>
                        ) : (
                          <button
                            key={page}
                            className={`table-pagination-page ${page === lanePage ? "table-pagination-page-active" : ""}`}
                            onClick={() => goToLanePage(page)}
                          >
                            {page}
                          </button>
                        )
                      )}

                      <button
                        className="table-pagination-arrow"
                        onClick={() => goToLanePage(lanePage + 1)}
                        disabled={lanePage === laneTotalPages}
                        aria-label="Next page"
                      >
                        ›
                      </button>
                    </div>
                  </div>
                )}

                {!isActive && (
                  <>
                    <div className="mt-4 d-flex justify-content-end gap-2 flex-wrap">
                      <button className="btn btn-custom" onClick={handleActivate} disabled={activating}>
                        {activating ? "Activating..." : "Activate Schedule"}
                      </button>
                    </div>
                    <p className="text-muted small mt-2 mb-0 text-end">
                      Activating assigns any already-approved applicants immediately, then keeps assigning new
                      approvals automatically as verifiers process them.
                    </p>
                  </>
                )}
              </div>
            )}

            {schedule?.grace_period_date && (
              <div className="page-card">
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                  <h4 className="sub-title sub-title-dark mb-0">Grace Period Claiming List</h4>
                  <div className="d-flex gap-2">
                    <button
                      className="btn btn-outline-custom btn-sm"
                      onClick={loadGracePeriodClaimingList}
                      disabled={loadingGracePeriodList}
                    >
                      {loadingGracePeriodList ? "Loading..." : "Refresh"}
                    </button>
                    <button type="button" className="btn btn-custom btn-sm" onClick={handleGracePeriodClaimingListExport}>
                      Print List
                    </button>
                  </div>
                </div>
                <p className="text-muted small mb-3">
                  Everyone expected during grace period — original no-shows still eligible to retry, plus any applicants newly promoted from the waitlist. Updates live as claim statuses and promotions change.
                </p>
                <div className="table-responsive">
                  <table className="table table-bordered table-striped align-middle announcement-table">
                    <thead>
                      <tr>
                        <th style={{ width: "40px" }}>#</th>
                        <th>Control Number</th>
                        <th>Applicant Name</th>
                        <th style={{ width: "140px" }}>Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gracePeriodList?.entries?.length > 0 ? (
                        gracePeriodList.entries.map((entry, i) => (
                          <tr key={`${entry.control_number}-${i}`}>
                            <td>{i + 1}</td>
                            <td>{entry.control_number}</td>
                            <td>{entry.name}</td>
                            <td>{entry.type}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="text-muted">
                            {loadingGracePeriodList ? "Loading..." : "No applicants expected during grace period for this period."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        </section>

        <PanelFooter />
      </div>
    </div>
  );
}

export default AdminSchedule;