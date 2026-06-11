import { useState } from "react";
import AdminNavigation from "../components/AdminNavigation";

// ── Static data ───────────────────────────────────────────────────────────────

const initialLanes = [
  { lane: "Lane 1", from: "0001", to: "0100", batch: "Morning",   date: "2026-05-20" },
  { lane: "Lane 2", from: "0101", to: "0200", batch: "Afternoon", date: "2026-05-20" },
  { lane: "Lane 3", from: "0201", to: "0300", batch: "Morning",   date: "2026-05-21" },
  { lane: "Lane 4", from: "0301", to: "0400", batch: "Afternoon", date: "2026-05-21" },
];

const laneLists = [
  { lane: "Lane 1", batch: "Morning",   date: "May 20, 2026", range: "0001 - 0100", count: 100 },
  { lane: "Lane 2", batch: "Afternoon", date: "May 20, 2026", range: "0101 - 0200", count: 100 },
  { lane: "Lane 3", batch: "Morning",   date: "May 21, 2026", range: "0201 - 0300", count: 100 },
  { lane: "Lane 4", batch: "Afternoon", date: "May 21, 2026", range: "0301 - 0400", count: 20  },
];

const summaryItems = [
  { label: "Total Approved Applicants", value: "320" },
  { label: "Total Lanes",               value: "4" },
  { label: "Claiming Dates",            value: "May 20–21, 2026" },
  { label: "Grace Period Date",         value: "May 23, 2026" },
];

const emptyForm = {
  date1: "2026-05-20",
  date2: "2026-05-21",
  morningStart: "07:00",
  morningEnd: "12:00",
  afternoonStart: "13:00",
  afternoonEnd: "17:00",
  location: "Barangay Mamatid Hall",
  gracePeriod: "2026-05-23",
};

// ── Component ─────────────────────────────────────────────────────────────────

function AdminSchedule() {
  const [hasApproved] = useState(true); // toggle to false to show notice state
  const [form, setForm] = useState(emptyForm);
  const [lanes, setLanes] = useState(initialLanes);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function setLane(index, key, value) {
    setLanes((prev) => prev.map((l, i) => i === index ? { ...l, [key]: value } : l));
  }

  function handleSubmit(e) {
    e.preventDefault();
    // TODO: connect to backend
    console.log("Schedule saved:", { form, lanes });
  }

  return (
    <div>
      <AdminNavigation />

      <section className="page-section">
        <div className="container">

          {/* Header */}
          <div className="page-card">
            <h3 className="section-title mb-2">Claiming Schedule Management</h3>
            <p className="text-muted mb-0">
              Set the claiming dates, batches, lane assignments, and grace period for approved applicants with assigned control numbers.
            </p>
          </div>

          {/* Approved Applicant Check */}
          <div className="page-card">
            <h4 className="sub-title">Approved Applicant Check</h4>
            {hasApproved ? (
              <div className="success-box">
                The system found approved applicants with assigned control numbers. You may now configure the claiming schedule.
              </div>
            ) : (
              <div className="notice-box">
                No approved applicants with assigned control numbers were found. Claiming schedule setup is not yet available.
              </div>
            )}
          </div>

          {/* Create Claiming Schedule */}
          <div className="page-card">
            <h4 className="sub-title">Create Claiming Schedule</h4>

            <div className="info-box">
              Configure the claiming schedule carefully. The system will validate the date, lane ranges, batch setup, and grace period before saving.
            </div>

            <form onSubmit={handleSubmit}>
              <div className="row g-3">

                <div className="col-md-6">
                  <label className="form-label">Claiming Date 1</label>
                  <input type="date" className="form-control" value={form.date1} onChange={set("date1")} />
                </div>

                <div className="col-md-6">
                  <label className="form-label">Claiming Date 2</label>
                  <input type="date" className="form-control" value={form.date2} onChange={set("date2")} />
                </div>

                <div className="col-md-6">
                  <label className="form-label">Morning Batch Time</label>
                  <div className="row g-2">
                    <div className="col-6">
                      <input type="time" className="form-control" value={form.morningStart} onChange={set("morningStart")} />
                    </div>
                    <div className="col-6">
                      <input type="time" className="form-control" value={form.morningEnd} onChange={set("morningEnd")} />
                    </div>
                  </div>
                  <small className="text-muted">Default morning batch: 7:00 AM to 12:00 PM</small>
                </div>

                <div className="col-md-6">
                  <label className="form-label">Afternoon Batch Time</label>
                  <div className="row g-2">
                    <div className="col-6">
                      <input type="time" className="form-control" value={form.afternoonStart} onChange={set("afternoonStart")} />
                    </div>
                    <div className="col-6">
                      <input type="time" className="form-control" value={form.afternoonEnd} onChange={set("afternoonEnd")} />
                    </div>
                  </div>
                  <small className="text-muted">Default afternoon batch: 1:00 PM to 5:00 PM</small>
                </div>

                <div className="col-md-6">
                  <label className="form-label">Claiming Location</label>
                  <input type="text" className="form-control" value={form.location} onChange={set("location")} />
                </div>

                <div className="col-md-6">
                  <label className="form-label">Grace Period Date</label>
                  <input type="date" className="form-control" value={form.gracePeriod} onChange={set("gracePeriod")} />
                </div>

              </div>

              <hr className="my-4" />

              <h5 className="sub-title mb-3" style={{ fontSize: "18px" }}>Lane Control Number Range</h5>

              <div className="table-responsive">
                <table className="table table-bordered align-middle">
                  <thead>
                    <tr>
                      <th>Lane</th>
                      <th>Control Number From</th>
                      <th>Control Number To</th>
                      <th>Batch</th>
                      <th>Claiming Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lanes.map((lane, i) => (
                      <tr key={lane.lane}>
                        <td>{lane.lane}</td>
                        <td>
                          <input
                            type="text"
                            className="form-control"
                            value={lane.from}
                            onChange={(e) => setLane(i, "from", e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-control"
                            value={lane.to}
                            onChange={(e) => setLane(i, "to", e.target.value)}
                          />
                        </td>
                        <td>
                          <select
                            className="form-select"
                            value={lane.batch}
                            onChange={(e) => setLane(i, "batch", e.target.value)}
                          >
                            <option>Morning</option>
                            <option>Afternoon</option>
                          </select>
                        </td>
                        <td>
                          <input
                            type="date"
                            className="form-control"
                            value={lane.date}
                            onChange={(e) => setLane(i, "date", e.target.value)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 d-flex justify-content-end gap-2 flex-wrap">
                <button type="button" className="btn btn-secondary" onClick={() => { setForm(emptyForm); setLanes(initialLanes); }}>Clear</button>
                <button type="submit" className="btn btn-custom">Save Schedule</button>
              </div>
            </form>
          </div>

          {/* Schedule Summary */}
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

          {/* Generated Lane Lists */}
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
                    <th>Printable List</th>
                  </tr>
                </thead>
                <tbody>
                  {laneLists.map((row) => (
                    <tr key={row.lane}>
                      <td>{row.lane}</td>
                      <td>{row.batch}</td>
                      <td>{row.date}</td>
                      <td>{row.range}</td>
                      <td>{row.count}</td>
                      <td>
                        <button className="btn btn-outline-custom btn-sm">Print Lane List</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 d-flex justify-content-end gap-2 flex-wrap">
              <button className="btn btn-outline-custom">Review Schedule</button>
              <button className="btn btn-custom">Publish Schedule</button>
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

export default AdminSchedule;