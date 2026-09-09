import { STATUS_CONFIG } from "../../components/StatusConstants";

function ApplicationHistoryList({ applicationHistory, onViewFile }) {
  if (applicationHistory.length === 0) return null;

  const formatDocumentType = (type = "") =>
    type
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="application-history-section">
      <div className="application-history-heading">
        <h4>Application History</h4>
        <p>Review documents from your previous educational assistance applications.</p>
      </div>

      <div className="application-history-list">
        {applicationHistory.map((app) => (
          <div className="application-history-card" key={app.id}>
            <div className="application-history-header">
              <div>
                <h5 className="application-history-year">
                  {app.configuration?.school_year ?? "—"}
                </h5>

                <div className="application-history-meta">
                  <span>{app.school_name || "—"}</span>
                  <span className="application-history-dot">•</span>
                  <span>
                    Submitted {app.submitted_at?.split("T")[0] ?? "—"}
                  </span>
                </div>
              </div>

              <span className="application-history-status">
                {STATUS_CONFIG[app.status]?.applicantLabel ?? app.status}
              </span>
            </div>

            <div className="application-history-doc-grid">
              {(app.documents ?? []).map((doc) => (
                <div className="application-history-doc-card" key={doc.id}>
                  <div className="application-history-doc-top">
                    <div>
                      <h6>{formatDocumentType(doc.document_type)}</h6>
                      <span className="application-history-doc-badge">
                        Submitted File
                      </span>
                    </div>

                    <div className="application-history-doc-icon">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </div>
                  </div>

                  <div
                    className="application-history-file-name"
                    title={doc.file_name}
                  >
                    {doc.file_name}
                  </div>

                  <button
                    type="button"
                    className="application-history-view-btn"
                    onClick={() => onViewFile(app.id, doc.id)}
                  >
                    View Document
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ApplicationHistoryList;