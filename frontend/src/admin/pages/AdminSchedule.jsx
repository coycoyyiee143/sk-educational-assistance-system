import { useState, useEffect } from "react";
import AdminNavigation from "../components/AdminNavigation";
import api from "../../services/api";

const emptyForm = {
  location: "Barangay Mamatid Hall",
  morning_start: "07:00",
  morning_end: "12:00",
  afternoon_start: "13:00",
  afternoon_end: "17:00",
  grace_period_date: "",
};

const emptySessionLane = () => ({ lane_name: "", capacity: "" });

const emptyDay = () => ({
  date: "",
  morning: { enabled: true, lanes: [emptySessionLane()] },
  afternoon: { enabled: true, lanes: [emptySessionLane()] },
});

// Reconstructs the day/session/lane builder shape from the flat lanes array
// returned by the API (claiming_date + batch + lane_name + capacity per row).
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

// Flattens the day/session/lane builder back into the lanes array the API expects.
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
  const [schedule, setSchedule] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [days, setDays] = useState([emptyDay()]);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => { loadSchedule(); }, []);

  function loadSchedule() {
    setLoading(true);
    api.get("/admin/claiming-schedule")
      .then((res) => {
        setConfig(res.data.config);
        setApprovedCount(res.data.approved_count);
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
          });
          setDays(groupLanesIntoDays(sched.lanes));
          if (!sched.is_published) {
            loadPreview(sched.id);
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
      .finally(() => setLoading(false));
  }

  function loadPreview(scheduleId) {
    setPreviewing(true);
    api.get(`/admin/claiming-schedule/${scheduleId}/preview`)
      .then((res) => setPreview(res.data))
      .catch(() => setPreview(null))
      .finally(() => setPreviewing(false));
  }

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

    const lanes = serializeLanes(days);
    setSaving(true);
    try {
      const res = await api.post("/admin/claiming-schedule", { ...form, lanes });
      setSchedule(res.data.schedule);
      setSuccess("Schedule saved. Review the previewed lane assignments below before publishing.");
      await loadPreview(res.data.schedule.id);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save schedule.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!schedule) return;
    if (!window.confirm("Publish this claiming schedule? Approved applicants will be notified and the schedule can no longer be edited.")) return;
    setPublishing(true);
    setError("");
    setSuccess("");
    try {
      const res = await api.post(`/admin/claiming-schedule/${schedule.id}/publish`);
      setSuccess(res.data.message);
      setSchedule(res.data.schedule);
      setPreview(null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to publish schedule.");
    } finally {
      setPublishing(false);
    }
  }

  async function handlePrint(laneId, laneName) {
    try {
      const res = await api.get(`/admin/claiming-schedule/lanes/${laneId}/printable`);
      const { applicants, batch, claiming_date } = res.data;
      const rows = applicants.map((a, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${a.control_number}</td>
          <td>${a.name}</td>
          <td></td>
        </tr>
      `).join("");
      const html = `
        <html>
          <head>
            <title>${laneName} — Claiming List</title>
            <style>
              body { font-family: Arial, sans-serif; color: #222; padding: 24px; }
              h2 { color: #b71c1c; margin-bottom: 4px; }
              p { margin-top: 0; color: #555; }
              table { width: 100%; border-collapse: collapse; margin-top: 16px; }
              th, td { border: 1px solid #333; padding: 8px; text-align: left; font-size: 14px; }
              thead { background: #b71c1c; color: white; }
              td:last-child, th:last-child { width: 220px; }
            </style>
          </head>
          <body>
            <h2>${laneName} — Claiming List</h2>
            <p>Batch: ${batch === "morning" ? "Morning" : "Afternoon"} &nbsp;|&nbsp; Date: ${claiming_date}</p>
            <table>
              <thead>
                <tr><th>#</th><th>Control Number</th><th>Applicant Name</th><th>Signature</th></tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </body>
        </html>
      `;
      const printWindow = window.open("", "_blank");
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    } catch (err) {
      setError("Failed to generate printable list.");
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

  const isPublished = schedule?.is_published;
  const hasApproved = approvedCount > 0;

  const totalLanesCount = days.reduce((sum, d) =>
    sum + (d.morning.enabled ? d.morning.lanes.length : 0) + (d.afternoon.enabled ? d.afternoon.lanes.length : 0), 0);
  const claimingDates = days.map(d => d.date).filter(Boolean);

  const summaryItems = schedule ? [
    { label: "Total Approved Applicants", value: approvedCount },
    { label: "Total Lanes", value: totalLanesCount },
    { label: "Claiming Dates", value: formatDateRange(claimingDates) },
    { label: "Grace Period Date", value: form.grace_period_date || "Not set" },
  ] : [];

  return (
    <div>
      <AdminNavigation />
      <section className="page-section">
        <div className="container">
          <div className="page-card">
            <h3 className="section-title mb-2">Claiming Schedule Management</h3>
            <p className="text-muted mb-0">
              Set the claiming dates, batches, lane assignments, and grace period for approved applicants with assigned control numbers.
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
                <h4 className="sub-title">Approved Applicant Check</h4>
                {hasApproved ? (
                  <div className="success-box">
                    The system found {approvedCount} approved applicant(s) with assigned control numbers for {config.school_year}. You may now configure the claiming schedule.
                  </div>
                ) : (
                  <div className="notice-box">
                    No approved applicants with assigned control numbers were found yet. You may still prepare the schedule, but it cannot be published until applicants are approved.
                  </div>
                )}
              </div>

              {isPublished && (
                <div className="page-card">
                  <div className="success-box mb-0">
                    This schedule was published on {new Date(schedule.published_at).toLocaleString()}. It can no longer be edited.
                  </div>
                </div>
              )}

              <div className="page-card">
                <h4 className="sub-title">Create Claiming Schedule</h4>
                <div className="info-box">
                  Add a card for each claiming day, toggle which sessions run that day (turn one off if you're
                  only doing mornings or afternoons), and add a lane for each verifier or station handling that
                  session. Leave a lane's capacity blank to auto-split whatever applicants remain among the
                  blank-capacity lanes in that session.
                </div>
                <form onSubmit={handleSubmit}>
                  <fieldset disabled={isPublished}>
                    <div className="row g-3 mb-4">
                      <div className="col-md-6">
                        <label className="form-label">Claiming Location</label>
                        <input type="text" className="form-control" value={form.location} onChange={set("location")} required />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Grace Period Date</label>
                        <input type="date" className="form-control" value={form.grace_period_date} onChange={set("grace_period_date")} />
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
                          {!isPublished && days.length > 1 && (
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
                                      {!isPublished && <th style={{ width: "90px" }}></th>}
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
                                            placeholder="Auto-split"
                                            value={lane.capacity}
                                            onChange={(e) => setLaneField(dayIdx, session, laneIdx, "capacity", e.target.value)}
                                          />
                                        </td>
                                        {!isPublished && (
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
                                {!isPublished && (
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

                    {!isPublished && (
                      <button type="button" className="btn btn-outline-custom btn-sm mb-3" onClick={addDay}>
                        + Add Claiming Day
                      </button>
                    )}
                  </fieldset>

                  {!isPublished && (
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
                      {isPublished ? "Generated Lane Lists" : "Previewed Lane Assignments"}
                    </h4>
                    {!isPublished && (
                      <button className="btn btn-outline-custom btn-sm" onClick={() => loadPreview(schedule.id)} disabled={previewing}>
                        {previewing ? "Calculating..." : "Refresh Preview"}
                      </button>
                    )}
                  </div>
                  {!isPublished && (
                    <div className="info-box mt-2">
                      These counts are computed live from currently approved applicants but are not final until you publish.
                      Adjust lane capacities above and save again if the split doesn't look right.
                    </div>
                  )}
                  <div className="table-responsive mt-3">
                    <table className="table table-bordered table-striped align-middle">
                      <thead>
                        <tr>
                          <th>Lane</th>
                          <th>Batch</th>
                          <th>Date</th>
                          <th>Capacity</th>
                          <th>Control Number Range</th>
                          <th>Assigned Applicants</th>
                          {isPublished && <th>Printable List</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {isPublished ? (
                          schedule.lanes?.map((lane) => (
                            <tr key={lane.id}>
                              <td>{lane.lane_name}</td>
                              <td>{lane.batch === "morning" ? "Morning" : "Afternoon"}</td>
                              <td>{lane.claiming_date}</td>
                              <td>{lane.capacity ?? "Auto"}</td>
                              <td>{lane.control_number_range ?? "—"}</td>
                              <td>{lane.assignments_count ?? 0}</td>
                              <td>
                                <button className="btn btn-outline-custom btn-sm" onClick={() => handlePrint(lane.id, lane.lane_name)}>
                                  Print Lane List
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : preview ? (
                          preview.lanes.map((lane) => (
                            <tr key={lane.id}>
                              <td>{lane.lane_name}</td>
                              <td>{lane.batch === "morning" ? "Morning" : "Afternoon"}</td>
                              <td>{lane.claiming_date}</td>
                              <td>{lane.capacity ?? "Auto"}</td>
                              <td>{lane.control_number_range ?? "—"}</td>
                              <td>{lane.assigned_count}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="text-muted">
                              {previewing ? "Calculating preview..." : "Save the schedule to see a preview of lane assignments."}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {!isPublished && (
                    <>
                      <div className="mt-4 d-flex justify-content-end gap-2 flex-wrap">
                        <button className="btn btn-custom" onClick={handlePublish} disabled={publishing || !hasApproved}>
                          {publishing ? "Publishing..." : "Publish Schedule"}
                        </button>
                      </div>
                      {!hasApproved && (
                        <p className="text-muted small mt-2 mb-0 text-end">
                          Publishing is disabled until there are approved applicants.
                        </p>
                      )}
                    </>
                  )}
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