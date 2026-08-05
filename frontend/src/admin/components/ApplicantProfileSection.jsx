import { useState, useEffect } from "react";
import api from "../../services/api";

function CategoryBar({ label, count, max }) {
    const pct = max > 0 ? Math.round((count / max) * 100) : 0;
    return (
        <div className="mb-2">
            <div className="d-flex justify-content-between small mb-1">
                <span>{label}</span>
                <span className="text-muted">{count}</span>
            </div>
            <div className="progress" style={{ height: "8px" }}>
                <div className="progress-bar bg-danger" role="progressbar" style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

function ApplicantProfileSection({ selectedConfigId }) {
    const [distribution, setDistribution] = useState(null);
    const [ageDistribution, setAgeDistribution] = useState(null);

    useEffect(() => {
        const params = selectedConfigId ? { config_id: selectedConfigId } : {};
        api.get("/admin/reports/applicant-distribution", { params }).then((res) => setDistribution(res.data)).catch(() => { });
        api.get("/admin/reports/age-distribution", { params }).then((res) => setAgeDistribution(res.data)).catch(() => { });
    }, [selectedConfigId]);

    async function handlePdfExport(endpoint, filenamePrefix) {
        try {
            const params = selectedConfigId ? { config_id: selectedConfigId } : {};
            const res = await api.get(endpoint, { params, responseType: "blob" });
            const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch { }
    }

    const bySchool = distribution?.by_school ?? [];
    const byCourse = distribution?.by_course ?? [];
    const byYearLevel = distribution?.by_year_level ?? [];
    const maxSchoolCount = Math.max(1, ...bySchool.map((r) => r.total));
    const maxCourseCount = Math.max(1, ...byCourse.map((r) => r.total));
    const maxYearLevelCount = Math.max(1, ...byYearLevel.map((r) => r.total));

    const ageCounts = ageDistribution?.counts ?? {};
    const ageRates = ageDistribution?.rates ?? {};

    // Build the age cards as a list first so column width can adapt to
    // however many actually apply — avoids leaving empty space on the
    // right when "unknown" is zero (the common case).
    const ageCards = [
        { key: "minor", value: ageCounts.minor, label: `Minor (${ageRates.minor_rate}%)` },
        { key: "adult", value: ageCounts.adult, label: `Adult (${ageRates.adult_rate}%)` },
    ];
    if (ageCounts.unknown > 0) {
        ageCards.push({ key: "unknown", value: ageCounts.unknown, label: `Unknown (${ageRates.unknown_rate}%)` });
    }
    const ageColClass = ageCards.length === 3 ? "col-md-4" : "col-md-6";

    return (
        <div className="page-card">
            <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                <h4 className="sub-title">
                    Applicant Profile
                    {distribution?.config && <span className="text-muted fw-normal" style={{ fontSize: "14px" }}>{" "}— {distribution.config.school_year}</span>}
                </h4>
                <div className="d-flex gap-2">
                    <button type="button" className="btn btn-sm btn-outline-custom"
                        onClick={() => handlePdfExport("/admin/reports/applicant-distribution/pdf", "applicant-academic-breakdown")}>
                        Export Academic Breakdown PDF
                    </button>
                    <button type="button" className="btn btn-sm btn-outline-custom"
                        onClick={() => handlePdfExport("/admin/reports/age-distribution/pdf", "applicant-age-breakdown")}>
                        Export Age Breakdown PDF
                    </button>
                </div>
            </div>
            <div className="info-box">
                Who's applying — broken down by school, course, year level, and minor/adult status.
            </div>

            {(!distribution?.config || bySchool.length === 0) ? (
                <div className="alert alert-info mb-0">No applicant data available for the selected period.</div>
            ) : (
                <>
                    <div className="row g-4 mb-4">
                        <div className="col-md-4">
                            <h6 className="text-muted text-uppercase small fw-bold mb-2">School</h6>
                            {bySchool.map((r) => <CategoryBar key={r.school_name} label={r.school_name} count={r.total} max={maxSchoolCount} />)}
                        </div>
                        <div className="col-md-4">
                            <h6 className="text-muted text-uppercase small fw-bold mb-2">Course</h6>
                            {byCourse.map((r) => <CategoryBar key={r.course} label={r.course} count={r.total} max={maxCourseCount} />)}
                        </div>
                        <div className="col-md-4">
                            <h6 className="text-muted text-uppercase small fw-bold mb-2">Year Level</h6>
                            {byYearLevel.map((r) => <CategoryBar key={r.year_level} label={r.year_level} count={r.total} max={maxYearLevelCount} />)}
                        </div>
                    </div>

                    {ageCounts.total > 0 && (
                        <>
                            <h6 className="text-muted text-uppercase small fw-bold mb-2">Age (Minor vs. Adult)</h6>
                            <div className="row g-4">
                                {ageCards.map((c) => (
                                    <div className={ageColClass} key={c.key}>
                                        <div className="summary-card">
                                            <h2>{c.value}</h2>
                                            <p>{c.label}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
}

export default ApplicantProfileSection;