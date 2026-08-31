import { useState, useEffect } from "react";
import api from "../../services/api";

function CategoryBar({ label, count, percentage, max }) {
    const pct = max > 0 ? Math.round((count / max) * 100) : 0;
    return (
        <div className="mb-2">
            <div className="d-flex justify-content-between small mb-1">
                <span>{label}</span>
                <span className="text-muted">{count} · {percentage ?? 0}%</span>
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
    const [sectionLoading, setSectionLoading] = useState(true);

    useEffect(() => {
        setSectionLoading(true);
        const params = selectedConfigId ? { config_id: selectedConfigId } : {};
        Promise.all([
            api.get("/admin/reports/applicant-distribution", { params }).then((res) => setDistribution(res.data)).catch(() => { }),
            api.get("/admin/reports/age-distribution", { params }).then((res) => setAgeDistribution(res.data)).catch(() => { }),
        ]).finally(() => setSectionLoading(false));
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
    const byPurok = distribution?.by_purok ?? [];
    const maxSchoolCount = Math.max(1, ...bySchool.map((r) => r.total));
    const maxCourseCount = Math.max(1, ...byCourse.map((r) => r.total));
    const maxYearLevelCount = Math.max(1, ...byYearLevel.map((r) => r.total));
    const maxPurokCount = Math.max(1, ...byPurok.map((r) => r.total));

    const ageCounts = ageDistribution?.counts ?? {};
    const ageRates = ageDistribution?.rates ?? {};
    const ageCards = [
        { key: "minor", value: ageCounts.minor, label: `Minor (${ageRates.minor_rate}%)` },
        { key: "adult", value: ageCounts.adult, label: `Adult (${ageRates.adult_rate}%)` },
    ];
    if (ageCounts.unknown > 0) {
        ageCards.push({ key: "unknown", value: ageCounts.unknown, label: `Unknown (${ageRates.unknown_rate}%)` });
    }

    const ageColClass = ageCards.length === 3 ? "col-md-4" : "col-md-6";

    if (sectionLoading) {
        return (
            <div className="page-card">
                <h4 className="sub-title">Applicant Profile</h4>
                <div className="d-flex justify-content-center align-items-center py-5">
                    <div className="spinner-border text-danger" role="status" />
                </div>
            </div>
        );
    }

    return (
        <>
            {/* School & Program */}
            <div className="page-card">
                <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                    <h4 className="sub-title">
                        Applicant Profile — School &amp; Program
                        {distribution?.config && <span className="text-muted fw-normal" style={{ fontSize: "14px" }}>{" "}— {distribution.config.school_year}</span>}
                    </h4>
                    <button type="button" className="btn btn-sm btn-outline-custom"
                        onClick={() => handlePdfExport("/admin/reports/school-program/pdf", "applicant-school-program")}>
                        Export PDF
                    </button>
                </div>
                {(!distribution?.config || bySchool.length === 0) ? (
                    <div className="alert alert-info mb-0">No applicant data available for the selected period.</div>
                ) : (
                    <div className="row g-4">
                        <div className="col-md-6">
                            <h6 className="text-muted text-uppercase small fw-bold mb-2">School</h6>
                            {bySchool.map((r) => (
                                <CategoryBar
                                    key={r.school_name}
                                    label={r.school_name}
                                    count={r.total}
                                    percentage={r.percentage}
                                    max={maxSchoolCount}
                                />
                            ))}
                        </div>
                        <div className="col-md-6">
                            <h6 className="text-muted text-uppercase small fw-bold mb-2">Program</h6>
                            {byCourse.map((r) => (
                                <CategoryBar
                                    key={r.course}
                                    label={r.course}
                                    count={r.total}
                                    percentage={r.percentage}
                                    max={maxCourseCount}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Year Level & Age */}
            <div className="page-card">
                <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                    <h4 className="sub-title">
                        Applicant Profile — Year Level &amp; Age
                        {ageDistribution?.config && <span className="text-muted fw-normal" style={{ fontSize: "14px" }}>{" "}— {ageDistribution.config.school_year}</span>}
                    </h4>
                    <button type="button" className="btn btn-sm btn-outline-custom"
                        onClick={() => handlePdfExport("/admin/reports/year-level-age/pdf", "applicant-year-level-age")}>
                        Export PDF
                    </button>
                </div>
                <div className="row g-4">
                    <div className="col-md-6">
                        <h6 className="text-muted text-uppercase small fw-bold mb-2">Year Level</h6>
                        {byYearLevel.length === 0 ? (
                            <div className="text-muted small">No data available.</div>
                        ) : (
                            byYearLevel.map((r) => (
                                <CategoryBar
                                    key={r.year_level}
                                    label={r.year_level}
                                    count={r.total}
                                    percentage={r.percentage}
                                    max={maxYearLevelCount}
                                />
                            ))
                        )}
                    </div>
                    <div className="col-md-6">
                        <h6 className="text-muted text-uppercase small fw-bold mb-2">Age (Minor vs. Adult)</h6>
                        {ageCounts.total > 0 ? (
                            <div className="row g-3">
                                {ageCards.map((c) => (
                                    <div className={ageColClass} key={c.key}>
                                        <div className="summary-card">
                                            <h2>{c.value}</h2>
                                            <p>{c.label}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-muted small">No data available.</div>
                        )}
                                        </div>
                </div>
            </div>
            {/* Purok / Phase */}
            <div className="page-card">
                <h4 className="sub-title">
                    Applicant Profile — Purok / Phase
                    {distribution?.config && <span className="text-muted fw-normal" style={{ fontSize: "14px" }}>{" "}— {distribution.config.school_year}</span>}
                </h4>
                {byPurok.length === 0 ? (
                    <div className="alert alert-info mb-0">No applicant data available for the selected period.</div>
                ) : (
                    byPurok.map((r) => (
                        <CategoryBar
                            key={`${r.purok_type}-${r.purok}`}
                            label={r.purok_type === "unspecified" ? "Unspecified" : `${r.purok_type.charAt(0).toUpperCase() + r.purok_type.slice(1)} ${r.purok}`}
                            count={r.total}
                            percentage={r.percentage}
                            max={maxPurokCount}
                        />
                    ))
                )}
            </div>
        </>
    );
}


export default ApplicantProfileSection;