import { useState, useEffect } from "react";
import AdminNavigation from "../components/AdminNavigation";
import api from "../../services/api";

const emptyLane = () => ({
  lane_name: "",
  control_number_from: "",
  control_number_to: "",
  batch: "morning",
  claiming_date: "",
});

const emptyForm = {
  location: "Barangay Mamatid Hall",
  morning_start: "07:00",
  morning_end: "12:00",
  afternoon_start: "13:00",
  afternoon_end: "17:00",
  grace_period_date: "",
};

function AdminSchedule() {
  const [config, setConfig] = useState(null);
  const [approvedCount, setApprovedCount] = useState(0);
  const [schedule, setSchedule] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [lanes, setLanes] = useState([emptyLane()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

          setLanes(sched.lanes?.length > 0
            ? sched.lanes.map(l => ({
              lane_name: l.lane_name,
              control_number_from: l.control_number_from,
              control_number_to: l.control_number_to,
              batch: l.batch,
              claiming_date: l.claiming_date,
            }))
            : [emptyLane()]);
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

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function setLane(index, key, value) {
    setLanes((prev) => prev.map((l, i) => i === index ? { ...l, [key]: value } : l));
  }

  function addLane() {
    setLanes((prev) => [...prev, emptyLane()]);
  }

  function removeLane(index) {
    setLanes((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (lanes.length === 0) {
      setError("Please add at least one lane.");
      return;
    }

    setSaving(true);
    try {
      const res = await api.post("/admin/claiming-schedule", { ...form, lanes });
      setSchedule(res.data.schedule);
      setSuccess("Schedule saved successfully.");
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
    } catch (err) {
      setError(err.response?.data?.message || "Failed to publish schedule.");
    } finally {
      setPublishing(false);
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
                  <div className="alert alert-success mb-0">
                    This schedule was published on {new Date(schedule.published_at).toLocaleString()}. It can no longer be edited.
                  </div>
                </div>
              )}

              <div className="page-card">
                <h4 className="sub-title">Create Claiming Schedule</h4>
                <div className="info-box">
                  Lanes are assigned based on the numeric portion of each applicant's control number
                  (e.g. SK-2026-0001 falls under control number 0001).
                </div>

                <form onSubmit={handleSubmit}>
                  <fieldset disabled={isPublished}>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label">Claiming Location</label>
                        <input type="text" className="form-control" value={form.location} onChange={set("location")} required />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Grace Period Date</label>
                        <input type="date" className="form-control" value={form.grace_period_date} onChange={set("grace_period_date")} />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Morning Batch Time</label>
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
                        <label className="form-label">Afternoon Batch Time</label>
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
                    <h5 className="sub-title mb-3" style={{ fontSize: "18px" }}>Lane Control Number Range</h5>

                    <div className="table-responsive">
                      <table className="table table-bordered align-middle">
                        <thead>
                          <tr>
                            <th>Lane Name</th>
                            <th>Control Number From</th>
                            <th>Control Number To</th>
                            <th>Batch</th>
                            <th>Claiming Date</th>
                            {!isPublished && <th></th>}
                          </tr>
                        </thead>
                        <tbody>
                          {lanes.map((lane, i) => (
                            <tr key={i}>
                              <td>
                                <input type="text" className="form-control" placeholder={`Lane ${i + 1}`} value={lane.lane_name} onChange={(e) => setLane(i, "lane_name", e.target.value)} required />
                              </td>
                              <td>
                                <input type="text" className="form-control" placeholder="0001" value={lane.control_number_from} onChange={(e) => setLane(i, "control_number_from", e.target.value)} required />
                              </td>
                              <td>
                                <input type="text" className="form-control" placeholder="0100" value={lane.control_number_to} onChange={(e) => setLane(i, "control_number_to", e.target.value)} required />
                              </td>
                              <td>
                                <select className="form-select" value={lane.batch} onChange={(e) => setLane(i, "batch", e.target.value)}>
                                  <option value="morning">Morning</option>
                                  <option value="afternoon">Afternoon</option>
                                </select>
                              </td>
                              <td>
                                <input type="date" className="form-control" value={lane.claiming_date} onChange={(e) => setLane(i, "claiming_date", e.target.value)} required />
                              </td>
                              {!isPublished && (
                                <td>
                                  <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => removeLane(i)} disabled={lanes.length === 1}>
                                    Remove
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {!isPublished && (
                      <button type="button" className="btn btn-outline-custom btn-sm mb-3" onClick={addLane}>
                        + Add Lane
                      </button>
                    )}
                  </fieldset>

                  {!isPublished && (
                    <div className="mt-4 d-flex justify-content-end gap-2 flex-wrap">
                      <button type="submit" className="btn btn-custom" disabled={saving}>
                        {saving ? "Saving..." : "Save Schedule"}
                      </button>
                    </div>
                  )}
                </form>
              </div>

              {schedule && (
                <div className="page-card">
                  <h4 className="sub-title">Generated Lane Lists</h4>
                  <div className="table-responsive">
                    <table className="table table-bordered table-striped align-middle">
                      <thead>
                        <tr>
                          <th>Lane</th>
                          <th>Batch</th>
                          <th>Date</th>
                          <th>Control Number Range</th>
                          <th>Assigned Applicants</th>
                        </tr>
                      </thead>
                      <tbody>
                        {schedule.lanes?.map((lane) => (
                          <tr key={lane.id}>
                            <td>{lane.lane_name}</td>
                            <td>{lane.batch === "morning" ? "Morning" : "Afternoon"}</td>
                            <td>{lane.claiming_date}</td>
                            <td>{lane.control_number_from} - {lane.control_number_to}</td>
                            <td>{lane.assignments_count ?? 0}</td>
                          </tr>
                        ))}
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