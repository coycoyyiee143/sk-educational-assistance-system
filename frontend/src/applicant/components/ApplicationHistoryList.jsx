import { STATUS_CONFIG } from "../../components/StatusConstants";

function ApplicationHistoryList({ applicationHistory, onViewFile }) {
    if (applicationHistory.length === 0) return null;

    return (
        <div className="sub-card mt-4">
            <h5>Application History</h5>
            {applicationHistory.map((app) => (
                <div className="border rounded p-3 mb-3" key={app.id}>
                    <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                        <div>
                            <strong>{app.configuration?.school_year ?? "—"}</strong>
                            <div className="text-muted small">
                                {app.school_name} | Submitted {app.submitted_at?.split("T")[0] ?? "—"}
                            </div>
                        </div>
                        <span className="badge bg-secondary">{STATUS_CONFIG[app.status]?.applicantLabel ?? app.status}</span>
                    </div>
                    <div className="row g-2 mt-2">
                        {(app.documents ?? []).map((doc) => (
                            <div className="col-md-4" key={doc.id}>
                                <div className="d-flex justify-content-between align-items-center border rounded p-2">
                                    <span className="small text-truncate" title={doc.file_name}>
                                        {doc.document_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                                        <br />
                                        <span className="text-muted">{doc.file_name}</span>
                                    </span>
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary btn-sm ms-2"
                                        onClick={() => onViewFile(app.id, doc.id)}
                                    >
                                        View
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

export default ApplicationHistoryList;