import { useState, useEffect } from "react";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import api from "../../services/api";

function formatDate(dateStr) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatDocType(type) {
    return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function DistributionBar({ label, count, max }) {
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

function VerificationOutcomesSection({ selectedConfigId }) {
    const [documentFailures, setDocumentFailures] = useState(null);
    const [claimingOutcomes, setClaimingOutcomes] = useState(null);
    const [trends, setTrends] = useState(null);
    const [submissionVsApproval, setSubmissionVsApproval] = useState(null);

    useEffect(() => {
        const params = selectedConfigId ? { config_id: selectedConfigId } : {};
        api.get("/admin/reports/document-failures", { params }).then((res) => setDocumentFailures(res.data)).catch(() => { });
        api.get("/admin/reports/claiming-outcomes", { params }).then((res) => setClaimingOutcomes(res.data)).catch(() => { });
        api.get("/admin/reports/submission-trends", { params }).then((res) => setTrends(res.data)).catch(() => { });
        api.get("/admin/reports/submission-vs-approval").then((res) => setSubmissionVsApproval(res.data)).catch(() => { });
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

    const claimCounts = claimingOutcomes?.counts ?? {};
    const claimRates = claimingOutcomes?.rates ?? {};
    const notClearedReasons = claimingOutcomes?.not_cleared_reasons ?? {};

    const reuploadFlagCounts = documentFailures?.reupload_flag_counts_by_document ?? {};
    const reuploadReasonsByDoc = documentFailures?.reupload_reasons_by_document ?? {};
    const automatedFailuresByDoc = documentFailures?.automated_check_failures_by_document ?? {};
    const maxReuploadFlags = Math.max(1, ...Object.values(reuploadFlagCounts));

    const weeklyTrend = trends?.weekly ?? [];
    const maxWeeklyCount = Math.max(1, ...weeklyTrend.map((w) => w.total));

    return (
        <>
            {/* Document Verification Issues */}
            <div className="page-card">
                <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                    <h4 className="sub-title">
                        Document Verification Issues
                        {documentFailures?.config && <span className="text-muted fw-normal" style={{ fontSize: "14px" }}>{" "}— {documentFailures.config.school_year}</span>}
                    </h4>
                    <button type="button" className="btn btn-sm btn-outline-custom"
                        onClick={() => handlePdfExport("/admin/reports/document-failures/pdf", "document-failure-breakdown")}>
                        Export PDF
                    </button>
                </div>
                <div className="info-box">
                    Which document most often causes a re-upload request, and which automated checks fail most often per document type.
                </div>
                {Object.keys(reuploadFlagCounts).length === 0 && Object.keys(automatedFailuresByDoc).length === 0 ? (
                    <div className="alert alert-info mb-0">No document flags recorded for the selected period.</div>
                ) : (
                    <>
                        {Object.keys(reuploadFlagCounts).length > 0 && (
                            <>
                                <h6 className="text-muted text-uppercase small fw-bold mb-2">Re-upload Requests by Document</h6>
                                {Object.entries(reuploadFlagCounts).map(([docType, count]) => (
                                    <DistributionBar key={docType} label={formatDocType(docType)} count={count} max={maxReuploadFlags} />
                                ))}
                            </>
                        )}
                        {Object.entries(reuploadReasonsByDoc).map(([docType, reasons]) => (
                            <div className="mt-3" key={docType}>
                                <h6 className="text-muted small fw-bold mb-2">{formatDocType(docType)} — Reasons</h6>
                                <div className="table-responsive">
                                    <table className="table table-sm table-bordered mb-0">
                                        <thead><tr><th>Reason</th><th style={{ width: "80px" }}>Count</th></tr></thead>
                                        <tbody>
                                            {Object.entries(reasons).sort((a, b) => b[1] - a[1]).map(([reason, count]) => (
                                                <tr key={reason}><td>{reason}</td><td>{count}</td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                        {Object.keys(automatedFailuresByDoc).length > 0 && (
                            <div className="mt-4">
                                <h6 className="text-muted text-uppercase small fw-bold mb-2">Automated OCR Check Failures</h6>
                                <div className="table-responsive">
                                    <table className="table table-sm table-bordered mb-0">
                                        <thead><tr><th>Document</th><th>Check</th><th style={{ width: "80px" }}>Failures</th></tr></thead>
                                        <tbody>
                                            {Object.entries(automatedFailuresByDoc).flatMap(([docType, checks]) =>
                                                Object.entries(checks).map(([checkName, count]) => (
                                                    <tr key={`${docType}-${checkName}`}>
                                                        <td>{formatDocType(docType)}</td><td><code className="small">{checkName}</code></td><td>{count}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Claiming Day Outcomes */}
            <div className="page-card">
                <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                    <h4 className="sub-title">
                        Claiming Day Outcomes
                        {claimingOutcomes?.config && <span className="text-muted fw-normal" style={{ fontSize: "14px" }}>{" "}— {claimingOutcomes.config.school_year}</span>}
                    </h4>
                    <button type="button" className="btn btn-sm btn-outline-custom"
                        onClick={() => handlePdfExport("/admin/reports/claiming-outcomes/pdf", "claiming-outcome-summary")}>
                        Export PDF
                    </button>
                </div>
                {!claimingOutcomes?.config || claimCounts.total === 0 ? (
                    <div className="alert alert-info mb-0">No claiming data available for the selected period.</div>
                ) : (
                    <>
                        <div className="row g-4 mb-3">
                            <div className="col-md-3"><div className="summary-card"><h2>{claimCounts.claimed}</h2><p>Claimed ({claimRates.claimed_rate}%)</p></div></div>
                            <div className="col-md-3"><div className="summary-card"><h2>{claimCounts.not_cleared}</h2><p>Not Cleared ({claimRates.not_cleared_rate}%)</p></div></div>
                            <div className="col-md-3"><div className="summary-card"><h2>{claimCounts.unclaimed}</h2><p>Unclaimed ({claimRates.unclaimed_rate}%)</p></div></div>
                            <div className="col-md-3"><div className="summary-card"><h2>{claimCounts.pending}</h2><p>Awaiting Claiming</p></div></div>
                        </div>
                        {Object.keys(notClearedReasons).length > 0 && (
                            <>
                                <h6 className="text-muted text-uppercase small fw-bold mb-2">Not Cleared — Common Reasons</h6>
                                {Object.entries(notClearedReasons).map(([reason, count]) => (
                                    <DistributionBar key={reason} label={reason} count={count} max={Math.max(...Object.values(notClearedReasons))} />
                                ))}
                            </>
                        )}
                    </>
                )}
            </div>

            {/* Submission & Approval History */}
            <div className="page-card">
                <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                    <h4 className="sub-title">Submission &amp; Approval History</h4>
                    <button type="button" className="btn btn-sm btn-outline-custom"
                        onClick={() => handlePdfExport("/admin/reports/submission-vs-approval/pdf", "submission-vs-approval-trend")}>
                        Export PDF
                    </button>
                </div>
                <div className="info-box">
                    Approved vs. rejected outcomes per period, shown against total submitted. "Rejected"
                    includes applications that failed at document review or later, at claiming day
                    (Not Cleared) — both are effectively rejections, just discovered at different stages.
                    This is the data used in Budget Forecast's approval-rate calculation.
                </div>
                {!submissionVsApproval?.trend?.length ? (
                    <div className="alert alert-info mb-0">No application period data available yet.</div>
                ) : (
                    submissionVsApproval.trend.map((row) => {
                        const total = row.total_submitted || 1;
                        const approvedPct = (row.approved / total) * 100;
                        const rejectedPct = (row.rejected / total) * 100;
                        return (
                            <div key={row.config_id} className="mb-3">
                                <div className="d-flex justify-content-between small mb-1">
                                    <span className="fw-semibold">{row.school_year}</span>
                                    <span className="text-muted">
                                        {row.approved} approved / {row.rejected} rejected / {row.total_submitted} total
                                    </span>
                                </div>
                                <div className="progress" style={{ height: "22px", backgroundColor: "#e9ecef" }}>
                                    <div className="progress-bar bg-primary" style={{ width: `${approvedPct}%` }} title={`Approved: ${row.approved}`} />
                                    <div className="progress-bar bg-danger" style={{ width: `${rejectedPct}%` }} title={`Rejected: ${row.rejected}`} />
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

        </>
    );
}

export default VerificationOutcomesSection;