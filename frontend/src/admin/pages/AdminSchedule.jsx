import { useState, useEffect, useCallback } from "react";
import AdminNavigation from "../components/AdminNavigation";
import api from "../../services/api";

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
  lanesArr.forEach((l) => {
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
  return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
}

function serializeLanes(days) {
  const lanes = [];
  days.forEach((day, dayIdx) => {
    ["morning", "afternoon"].forEach((session) => {
      if (!day[session].enabled) return;
      day[session].lanes.forEach((lane, laneIdx) => {
        lanes.push({
          lane_name: lane.lane_name.trim() || `Day ${dayIdx + 1} ${session === "morning" ? "AM" : "PM"} Lane ${laneIdx + 1}`,
          capacity: lane.capacity ? Number(lane.capacity) : null,
          batch: session,
          claiming_date: day.date,
        });
      });
    });
  });
  return lanes;
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
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
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
    if (!silent) setLoading(true);
    api.get("/admin/claiming-schedule")
      .then((res) => {
        setConfig(res.data.config);
        setApprovedCount(res.data.approved_count);
        setUnassignedApprovedCount(res.data.unassigned_approved_count ?? 0);
        const sched = res.data.schedule;
        setSchedule(sched);
        if (sched && !silent) {
          // Only repopulate the editable form/day state on a real page
          // load — a silent background refresh shouldn't touch it (the
          // form is disabled once active anyway, but there's no reason
          // to re-run this on every poll tick).
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
        if (!silent) {
          if (err.response?.status !== 404) {
            setError("Failed to load schedule data.");
          } else {
            setConfig(null);
          }
        }
        // Silent refreshes fail quietly — a dropped poll tick isn't worth
        // surfacing an error banner over; the next tick (or the manual
        // Refresh button) will just try again.
      })
      .finally(() => {
        if (!silent) setLoading(false);
      });
  }, [loadGracePeriodClaimingList]);

  useEffect(() => {
    loadSchedule(false);
  }, [loadSchedule]);

  // Once a schedule is active, applicants get assigned to lanes the
  // moment they're approved elsewhere in the app (Verifier review) —
  // there's no action happening on this page while that occurs. Poll
  // periodically, silently, so the fill counts below stay current
  // without the admin having to manually refresh, and without the
  // whole page flashing back to a loading spinner every tick.
  useEffect(() => {
    if (!schedule?.is_active) return;
    const interval = setInterval(() => {
      loadSchedule(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [schedule?.is_active, loadSchedule]);

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
      }
    }
    // Claiming can never happen while applications are still being
    // accepted, or exactly on closing day itself — every claiming date
    // must fall strictly after the application period's Closing Date.
    // Mirrors the same check AdminScheduleController::store() enforces
    // server-side; this just catches the mistake before the round-trip.
    if (config?.close_date) {
      const closeDateOnly = config.close_date.slice(0, 10);
      const tooEarly = days.find((d) => d.date && d.date <= closeDateOnly);
      if (tooEarly) {
        setError(`Claiming date ${tooEarly.date} must be after the application period's Closing Date (${closeDateOnly}).`);
        return;
      }
    }
    // Grace Period only makes sense after every claiming day has already
    // happened — it can't start before or during the regular claiming
    // schedule.
    if (form.grace_period_date) {
      const latestClaimingDate = days.reduce((latest, d) => (d.date && d.date > latest ? d.date : latest), "");
      if (latestClaimingDate && form.grace_period_date <= latestClaimingDate) {
        setError(`Grace Period must start after every claiming date. Latest claiming date is ${latestClaimingDate}.`);
        return;
      }
    }
    const lanes = serializeLanes(days);
    setSaving(true);
    try {
      const res = await api.post("/admin/claiming-schedule", { ...form, lanes });
      setSchedule(res.data.schedule);
      setSuccess("Schedule saved. Activate it below when you're ready to start assigning approved applicants to lanes.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save schedule.");
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate() {
    if (!schedule) return;
    if (!window.confirm(
      "Activate this claiming schedule? From this point on, every applicant a verifier approves will be assigned to a lane and notified automatically. Lane setup can no longer be edited after this."
    )) return;
    setActivating(true);
    setError("");
    setSuccess("");
    try {
      const res = await api.post(`/admin/claiming-schedule/${schedule.id}/activate`);
      setSuccess(res.data.message);
      setSchedule(res.data.schedule);
      loadSchedule();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to activate schedule.");
    } finally {
      setActivating(false);
    }
  }

  async function handlePrint(laneId, laneName) {
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

  const isActive = schedule?.is_active;
  const hasApproved = approvedCount > 0;
  const totalLanesCount = days.reduce((sum, d) =>
    sum + (d.morning.enabled ? d.morning.lanes.length : 0) + (d.afternoon.enabled ? d.afternoon.lanes.length : 0), 0);
  const claimingDates = days.map(d => d.date).filter(Boolean);
  const regularLanes = (schedule?.lanes ?? []).filter((lane) => lane.lane_name !== "Grace Period Claiming");
  // Earliest a claiming day is allowed to be: the day after the
  // application period's Closing Date. Used as each day date input's
  // min= so the browser blocks an invalid pick up front.
  const earliestClaimingDate = (() => {
    if (!config?.close_date) return undefined;
    const d = new Date(config.close_date.slice(0, 10) + "T00:00:00");
    d.setDate(d.getDate() + 1);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  })();
  // Earliest a Grace Period is allowed to start: the day after the
  // latest claiming date entered, or the day after the application
  // period's Closing Date if no claiming days have been added yet.
  // Used as the date input's min= so the browser itself blocks an
  // invalid pick before the form is even submitted.
  const latestClaimingDateStr = days.reduce((latest, d) => (d.date && d.date > latest ? d.date : latest), "");
  const earliestGracePeriodStart = (() => {
    const base = latestClaimingDateStr || config?.close_date?.slice(0, 10);
    if (!base) return undefined;
    const d = new Date(base + "T00:00:00");
    d.setDate(d.getDate() + 1);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  })();
  const summaryItems = schedule ? [
    { label: "Total Approved Applicants", value: approvedCount },
    { label: "Waiting for a Lane", value: unassignedApprovedCount },
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

  return (
    <div>
      <AdminNavigation />
      <section className="page-section">
        <div className="container">
          <div className="page-card">
            <h3 className="section-title mb-2">Claiming Schedule Management</h3>
            <p className="text-muted mb-0">
              Set the claiming dates, batches, lanes, and grace period. Once activated, approved
              applicants are assigned to a lane and notified automatically, in real time, as they're
              approved — there's no separate step to "release" the schedule afterward.
            </p>
          </div>
          {error && <div className="alert alert-danger">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}
          {!config ? (
            <div className="page-card">
              <div className="notice-box">No active application period found. Set up an application configuration first.</div>
            </div>
          ) : (
            <>
              <div className="page-card">
                <h4 className="sub-title">Application Period</h4>
                <div className="row g-3">
                  <div className="col-md-4">
                    <div className="summary-card">
                      <h6>School Year</h6>
                      <p className="mb-0 fs-5">{config.school_year}</p>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="summary-card">
                      <h6>Opening Date</h6>
                      <p className="mb-0 fs-5">{new Date(config.open_date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="summary-card">
                      <h6>Closing Date</h6>
                      <p className="mb-0 fs-5">{new Date(config.close_date).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
                <div className="info-box mt-3">
                  Applications are only accepted between these two dates. Every claiming date you pick below
                  must fall <strong>after {new Date(config.close_date).toLocaleDateString()}</strong> — claiming
                  can't happen while the SK is still accepting new applications, since verifiers need time to
                  review whatever comes in right up to the deadline first.
                </div>
              </div>
              <div className="page-card">
                <h4 className="sub-title">Approved Applicant Check</h4>
                {hasApproved ? (
                  <div className="success-box">
                    The system found {approvedCount} approved applicant(s) with assigned control numbers for {config.school_year}.
                    {isActive && unassignedApprovedCount > 0 && (
                      <> {unassignedApprovedCount} of them are currently waiting for a lane to open up (every lane is full right now) — they'll be assigned automatically as soon as room frees up.</>
                    )}
                  </div>
                ) : (
                  <div className="notice-box">
                    No approved applicants with assigned control numbers yet. You can still prepare and
                    activate the schedule now — the first applicant approved afterward will be assigned automatically.
                  </div>
                )}
              </div>
              {isActive && (
                <div className="page-card">
                  <div className="success-box mb-0">
                    This schedule was activated on {new Date(schedule.activated_at).toLocaleString()}. Lane
                    setup can no longer be edited. Approved applicants are being assigned to lanes automatically.
                  </div>
                </div>
              )}
              <div className="page-card">
                <h4 className="sub-title">Create Claiming Schedule</h4>
                <div className="info-box">
                  Add a card for each claiming day, toggle which sessions run that day (turn one off if you're
                  only doing mornings or afternoons), and add a lane for each verifier or station handling that
                  session. Every lane needs a capacity. Lanes fill in order — Lane 1 completely before Lane 2
                  starts, and so on — since applicants are assigned the moment they're approved, not split evenly
                  after the fact. Every claiming date must be after {new Date(config.close_date).toLocaleDateString()}
                  {" "}(see Application Period above).
                </div>
                <form onSubmit={handleSubmit}>
                  <fieldset disabled={isActive}>
                    <div className="row g-3 mb-4">
                      <div className="col-md-6">
                        <label className="form-label">Claiming Location</label>
                        <input type="text" className="form-control" value={form.location} onChange={set("location")} required />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Grace Period (Date Range)</label>
                        <div className="info-box mb-2 small">
                          <strong>What Grace Period is:</strong> a second, unscheduled chance to claim, for two
                          groups only — (1) approved applicants who missed their assigned claiming lane/date, and
                          (2) applicants promoted from the waitlist after a slot opened up too late to fit them
                          into the regular schedule. It runs on the shared "Grace Period Claiming" lane instead of
                          a dated lane, always starts after every regular claiming date above, and requires face
                          verification before anyone can be marked Claimed. Leave both dates blank if this period
                          won't have one.
                        </div>
                        <div className="row g-2">
                          <div className="col-6">
                            <input
                              type="date"
                              className="form-control"
                              value={form.grace_period_date}
                              onChange={set("grace_period_date")}
                              min={earliestGracePeriodStart}
                              placeholder="Start date"
                            />
                          </div>
                          <div className="col-6">
                            <input
                              type="date"
                              className="form-control"
                              value={form.grace_period_end_date}
                              onChange={set("grace_period_end_date")}
                              min={form.grace_period_date || earliestGracePeriodStart}
                              placeholder="End date"
                            />
                          </div>
                        </div>
                        <div className="form-text">
                          Must start after every claiming date above{latestClaimingDateStr ? ` (earliest allowed: ${earliestGracePeriodStart})` : ""}. Applicants eligible for grace period may claim on any weekday within this range.
                        </div>
                      </div>
                      <div className="col-md-6">
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
                      <div className="col-md-6">
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
                    <hr className="my-4" />
                    <h5 className="sub-title mb-3" style={{ fontSize: "18px" }}>Claiming Days</h5>
                    {days.map((day, dayIdx) => (
                      <div className="sub-card mb-3" key={dayIdx}>
                        <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                          <h6 className="mb-0" style={{ color: "#b71c1c" }}>Claiming Day {dayIdx + 1}</h6>
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
                              min={earliestClaimingDate}
                              required
                            />
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
                                <table className="table table-sm table-bordered align-middle mb-2">
                                  <thead>
                                    <tr>
                                      <th>Lane / Station Name</th>
                                      <th style={{ width: "220px" }}>Capacity</th>
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
                                            placeholder={`Lane ${laneIdx + 1}`}
                                            value={lane.lane_name}
                                            onChange={(e) => setLaneField(dayIdx, session, laneIdx, "lane_name", e.target.value)}
                                            required
                                          />
                                        </td>
                                        <td>
                                          <input
                                            type="number"
                                            min="1"
                                            className="form-control form-control-sm"
                                            placeholder="e.g. 150"
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
              </div>
              {schedule && (
                <div className="page-card">
                  <h4 className="sub-title">Schedule Summary</h4>
                  <div className="row g-3">
                    {summaryItems.map(({ label, value }) => (
                      <div className="col-md-3" key={label}>
                        <div className="summary-card">
                          <h6>{label}</h6>
                          <p className="mb-0 fs-5">{value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {schedule && (
                <div className="page-card">
                  <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <h4 className="sub-title mb-0">
                      {isActive ? "Lane Fill Status" : "Lanes (not active yet)"}
                    </h4>
                    {isActive && (
                      <button className="btn btn-outline-custom btn-sm" onClick={() => loadSchedule(true)}>
                        Refresh
                      </button>
                    )}
                  </div>
                  {isActive && (
                    <div className="info-box mt-2">
                      Updates automatically every 30 seconds while this page is open, or click Refresh for the latest count right now — neither reloads the page.
                    </div>
                  )}
                  <div className="table-responsive mt-3 table-scroll">
                    <table className="table table-bordered table-striped align-middle">
                      <thead>
                        <tr>
                          <th>Lane</th>
                          <th>Batch</th>
                          <th>Date</th>
                          <th>Capacity</th>
                          <th>Filled</th>
                          <th>Status</th>
                          {isActive && <th>Printable List</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {regularLanes.length > 0 ? (
                          regularLanes.map((lane) => {
                            const filled = lane.assignments_count ?? 0;
                            const isFull = lane.capacity != null && filled >= lane.capacity;
                            return (
                              <tr key={lane.id}>
                                <td>{lane.lane_name}</td>
                                <td>{lane.batch === "morning" ? "Morning" : "Afternoon"}</td>
                                <td>{lane.claiming_date}</td>
                                <td>{lane.capacity}</td>
                                <td>{filled} / {lane.capacity}</td>
                                <td>
                                  {isFull ? (
                                    <span className="badge bg-danger">Full</span>
                                  ) : isActive ? (
                                    <span className="badge bg-success">Open</span>
                                  ) : (
                                    <span className="badge bg-secondary">Not active</span>
                                  )}
                                </td>
                                {isActive && (
                                  <td>
                                    <button
                                      className="btn btn-outline-custom btn-sm"
                                      onClick={() => handlePrint(lane.id, lane.lane_name)}
                                      disabled={filled === 0}
                                    >
                                      Print Lane List
                                    </button>
                                  </td>
                                )}
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={7} className="text-muted">
                              Save the schedule above to add lanes.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {!isActive && (
                    <>
                      <div className="mt-4 d-flex justify-content-end gap-2 flex-wrap">
                        <button className="btn btn-custom" onClick={handleActivate} disabled={activating || regularLanes.length === 0}>
                          {activating ? "Activating..." : "Activate Schedule"}
                        </button>
                      </div>
                      {regularLanes.length === 0 && (
                        <p className="text-muted small mt-2 mb-0 text-end">
                          Save the schedule with at least one lane before activating.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
              {schedule?.grace_period_date && (
                <div className="page-card">
                  <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <h4 className="sub-title mb-0">Grace Period Claiming List</h4>
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
                  <div className="table-responsive table-scroll">
                    <table className="table table-bordered table-striped align-middle">
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
            </>
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

export default AdminSchedule;