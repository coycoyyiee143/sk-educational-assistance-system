import { useState, useEffect } from "react";
import api from "../../services/api";

function formatDateTime(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DisbursementReportSection({ selectedConfigId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!selectedConfigId) return;
    setLoading(true);
    setError("");
    api.get("/admin/reports/disbursement", { params: { config_id: selectedConfigId } })
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || "Failed to load disbursement report."))
      .finally(() => setLoading(false));
  }, [selectedConfigId]);

  async function handleDownloadPdf() {
    setDownloading(true);
    try {
      const res = await api.get("/admin/reports/disbursement/pdf", {
        params: { config_id: selectedConfigId },
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "disbursement-report.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to download PDF.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="page-card">
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
        <div>
          <h4 className="sub-title mb-1">Disbursement Report</h4>
          <p className="text-muted small mb-0">
            Final list of applicants who received their educational assistance, along with the
            verifier who processed the disbursement.
          </p>
        </div>
        <button
          className="btn btn-outline-custom btn-sm"
          onClick={handleDownloadPdf}
          disabled={downloading || loading || !data?.entries?.length}
        >
          {downloading ? "Generating..." : "Download PDF"}
        </button>
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      {loading ? (
        <div className="d-flex justify-content-center py-4">
          <div className="spinner-border text-danger" role="status" />
        </div>
      ) : (
        <>
          <div className="table-responsive">
            <table className="table table-bordered table-striped align-middle">
              <thead>
                <tr>
                  <th>Control Number</th>
                  <th>Applicant Name</th>
                  <th>School</th>
                  <th>Lane</th>
                  <th>Claiming Date</th>
                  <th>Disbursed By</th>
                  <th>Disbursed At</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {!data?.entries?.length ? (
                  <tr>
                    <td colSpan={8} className="text-center text-muted py-3">
                      No disbursements recorded for this period.
                    </td>
                  </tr>
                ) : (
                  data.entries.map((entry, i) => (
                    <tr key={i}>
                      <td>{entry.control_number ?? "—"}</td>
                      <td>{entry.applicant_name}</td>
                      <td>{entry.school_name}</td>
                      <td>{entry.lane_name ?? "—"}</td>
                      <td>{entry.claiming_date ?? "—"}</td>
                      <td>{entry.verifier_name ?? "—"}</td>
                      <td>{formatDateTime(entry.verified_at)}</td>
                      <td>₱{Number(entry.amount).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {data?.entries?.length > 0 && (
            <div className="summary-card mt-2" style={{ maxWidth: "320px" }}>
              <h6>Summary</h6>
              <p className="mb-1"><strong>Total Disbursed:</strong> {data.total_disbursed} applicant(s)</p>
              <p className="mb-0"><strong>Total Amount:</strong> ₱{Number(data.total_amount).toLocaleString()}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default DisbursementReportSection;