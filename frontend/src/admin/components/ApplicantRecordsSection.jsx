import { useState, useEffect } from "react";
import api from "../../services/api";

const reportTypes = ["All Applications", "Approved Students", "Rejected Applications", "Pending Applications"];
const applicantTypes = ["All Applicants", "Minor", "Adult"];
const yearLevelOptions = ["All Year Levels", "1st Year", "2nd Year", "3rd Year", "4th Year"];

const emptyFilter = {
    type: "All Applications", from: "", to: "",
    school_name: "All Schools", course: "All Courses",
    year_level: "All Year Levels", applicant_type: "All Applicants",
};

const APPROVED_SET = ["approved", "claimed", "not_cleared", "unclaimed"];
const PENDING_SET = ["pending_prescreening", "for_review", "reupload_requested"];

function StatusBadge({ status }) {
    let cls = "badge-review";

    if (status === "rejected") cls = "badge-rejected";
    else if (APPROVED_SET.includes(status)) cls = "badge-approved";
    else if (PENDING_SET.includes(status)) cls = "badge-review";

    return <span className={cls}>{status.replace(/_/g, " ")}</span>;
}

function formatDate(dateStr) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function ApplicantRecordsSection({ selectedConfigId }) {
    const [summary, setSummary] = useState(null);
    const [filterOptions, setFilterOptions] = useState({ schools: [], courses: [] });
    const [filter, setFilter] = useState(emptyFilter);
    const [preview, setPreview] = useState([]);
    const [previewing, setPreviewing] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        api.get("/admin/reports/filter-options").then((res) => setFilterOptions(res.data)).catch(() => { });
    }, []);

    useEffect(() => {
        const params = selectedConfigId ? { config_id: selectedConfigId } : {};

        api.get("/admin/reports/summary", { params }).then((res) => setSummary(res.data)).catch(() => { });

        // Was missing `params` entirely — the initial preview always showed
        // every application ever submitted, regardless of selected period,
        // until the admin manually clicked "Preview."
        api.get("/admin/reports/applications", { params }).then((res) => setPreview(res.data)).catch(() => { });
    }, [selectedConfigId]);

    const set = (k) => (e) => setFilter((f) => ({ ...f, [k]: e.target.value }));

    function buildParams() {
        const params = {};

        if (filter.type !== "All Applications") params.type = filter.type;
        if (filter.from) params.from = filter.from;
        if (filter.to) params.to = filter.to;
        if (filter.school_name !== "All Schools") params.school_name = filter.school_name;
        if (filter.course !== "All Courses") params.course = filter.course;
        if (filter.year_level !== "All Year Levels") params.year_level = filter.year_level;
        if (filter.applicant_type !== "All Applicants") params.applicant_type = filter.applicant_type.toLowerCase();

        // Same gap as the initial load above — Preview/Export never scoped
        // to the selected period without this.
        if (selectedConfigId) params.config_id = selectedConfigId;

        return params;
    }

    async function handlePreview(e) {
        e.preventDefault();
        setError("");
        setPreviewing(true);

        try {
            const res = await api.get("/admin/reports/applications", { params: buildParams() });
            setPreview(res.data);
        } catch {
            setError("Failed to generate preview.");
        } finally {
            setPreviewing(false);
        }
    }

    async function handleExport() {
        setError("");
        setExporting(true);

        try {
            const res = await api.get("/admin/reports/export", { params: buildParams(), responseType: "blob" });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement("a");

            link.href = url;
            link.setAttribute("download", `applicant-records-${new Date().toISOString().slice(0, 10)}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch {
            setError("Failed to export report.");
        } finally {
            setExporting(false);
        }
    }

    const stats = summary?.summary ?? {};
    const rates = summary?.rates ?? {};

    return (
        <>
            {error && <div className="alert alert-danger">{error}</div>}

            {/* Application Overview — By Status */}
            <div className="page-card">
                <h4 className="sub-title">
                    Application Overview — By Status
                    {summary?.config && <span className="text-muted fw-normal" style={{ fontSize: "14px" }}>{" "}— {summary.config.school_year}</span>}
                </h4>

                {!summary?.config ? (
                    <div className="alert alert-info mb-0">No data for the selected period.</div>
                ) : (
                    <div className="row g-4">
                        <div className="col-md-3"><div className="summary-card"><h2>{stats.total_applicants}</h2><p>Total Applicants</p></div></div>
                        <div className="col-md-3"><div className="summary-card"><h2>{stats.pending_applications}</h2><p>Pending</p></div></div>
                        <div className="col-md-3"><div className="summary-card"><h2>{stats.approved_applications}</h2><p>Approved</p></div></div>
                        <div className="col-md-3"><div className="summary-card"><h2>{stats.rejected_applications}</h2><p>Rejected</p></div></div>
                    </div>
                )}
            </div>

            {/* Application Overview — By Rate */}
            <div className="page-card">
                <h4 className="sub-title">
                    Application Overview — By Rate
                    {summary?.config && <span className="text-muted fw-normal" style={{ fontSize: "14px" }}>{" "}— {summary.config.school_year}</span>}
                </h4>

                {!summary?.config ? (
                    <div className="alert alert-info mb-0">No data for the selected period.</div>
                ) : (
                    <div className="row g-4">
                        <div className="col-md-4"><div className="summary-card"><h2>{rates.approval_rate ?? 0}%</h2><p>Approval Rate</p></div></div>
                        <div className="col-md-4"><div className="summary-card"><h2>{rates.rejection_rate ?? 0}%</h2><p>Rejection Rate</p></div></div>
                        <div className="col-md-4"><div className="summary-card"><h2>{rates.under_review_rate ?? 0}%</h2><p>Under Review</p></div></div>
                    </div>
                )}
            </div>

            {/* Applicant Records — filter/export tool */}
            <div className="page-card">
                <h4 className="sub-title">Applicant Records</h4>

                <div className="info-box">
                    Filter and preview individual applicant records, or export them as a CSV file for documentation and record-keeping purposes.
                </div>

                <form onSubmit={handlePreview}>
                    <div className="row g-3">
                        <div className="col-md-3">
                            <label className="form-label">Status</label>
                            <select className="form-select" value={filter.type} onChange={set("type")}>
                                {reportTypes.map((t) => <option key={t}>{t}</option>)}
                            </select>
                        </div>

                        <div className="col-md-3">
                            <label className="form-label">School</label>
                            <select className="form-select" value={filter.school_name} onChange={set("school_name")}>
                                <option>All Schools</option>
                                {filterOptions.schools.map((s) => <option key={s}>{s}</option>)}
                            </select>
                        </div>

                        <div className="col-md-3">
                            <label className="form-label">Course / Program</label>
                            <select className="form-select" value={filter.course} onChange={set("course")}>
                                <option>All Courses</option>
                                {filterOptions.courses.map((c) => <option key={c}>{c}</option>)}
                            </select>
                        </div>

                        <div className="col-md-3">
                            <label className="form-label">Year Level</label>
                            <select className="form-select" value={filter.year_level} onChange={set("year_level")}>
                                {yearLevelOptions.map((y) => <option key={y}>{y}</option>)}
                            </select>
                        </div>

                        <div className="col-md-3">
                            <label className="form-label">Applicant Type</label>
                            <select className="form-select" value={filter.applicant_type} onChange={set("applicant_type")}>
                                {applicantTypes.map((t) => <option key={t}>{t}</option>)}
                            </select>
                        </div>

                        <div className="col-md-3">
                            <label className="form-label">From Date</label>
                            <input type="date" className="form-control" value={filter.from} onChange={set("from")} />
                        </div>

                        <div className="col-md-3">
                            <label className="form-label">To Date</label>
                            <input type="date" className="form-control" value={filter.to} onChange={set("to")} />
                        </div>
                    </div>

                    <div className="mt-4 d-flex justify-content-end gap-2">
                        <button type="submit" className="btn btn-secondary" disabled={previewing}>{previewing ? "Loading..." : "Preview"}</button>
                        <button type="button" className="btn btn-custom" onClick={handleExport} disabled={exporting}>{exporting ? "Exporting..." : "Export CSV"}</button>
                    </div>
                </form>
            </div>

            <div className="page-card">
                <h4 className="sub-title">Record Preview</h4>

                <div className="table-responsive" style={{ maxHeight: "420px", overflowY: "auto" }}>
                    <table className="table table-bordered table-striped align-middle mb-0">
                        <thead style={{ position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
                            <tr>
                                <th>Application ID</th><th>Control Number</th><th>Applicant Name</th>
                                <th>Submission Date</th><th>Status</th><th>School</th><th>Course / Strand</th><th>Year Level</th>
                            </tr>
                        </thead>

                        <tbody>
                            {preview.map((r) => (
                                <tr key={r.id}>
                                    <td>APP-{r.id}</td>
                                    <td>{r.control_number ?? "—"}</td>
                                    <td>{r.name}</td>
                                    <td>{formatDate(r.submitted_at)}</td>
                                    <td><StatusBadge status={r.status} /></td>
                                    <td>{r.school_name}</td>
                                    <td>{r.course}</td>
                                    <td>{r.year_level}</td>
                                </tr>
                            ))}

                            {preview.length === 0 && (
                                <tr><td colSpan="8" className="text-center text-muted">No records found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}

export default ApplicantRecordsSection;