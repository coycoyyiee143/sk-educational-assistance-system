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

function DisbursementReportSection({ selectedConfigId, onReady }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!selectedConfigId) {
      setLoading(false);
      onReady?.();
      return;
    }

    setLoading(true);
    setError("");

    api
      .get("/admin/reports/disbursement", {
        params: {
          config_id: selectedConfigId,
        },
      })
      .then((res) => {
        setData(res.data);
      })
      .catch((err) => {
        setError(
          err.response?.data?.message ||
            "Failed to load disbursement report."
        );
      })
      .finally(() => {
        setLoading(false);
        onReady?.();
      });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConfigId]);

  async function handleDownloadPdf() {
    setDownloading(true);

    try {
      const res = await api.get(
        "/admin/reports/disbursement/pdf",
        {
          params: {
            config_id: selectedConfigId,
          },
          responseType: "blob",
        }
      );

      const url = URL.createObjectURL(res.data);

      const a = document.createElement("a");
      a.href = url;

      a.download = `disbursement-report-${
        data?.config?.school_year ??
        new Date().toISOString().slice(0, 10)
      }.pdf`;

      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to download PDF.");
    } finally {
      setDownloading(false);
    }
  }

  const entries = data?.entries ?? [];
  const totalDisbursed = data?.total_disbursed ?? 0;
  const totalAmount = data?.total_amount ?? 0;

  return (
    <div className="page-card disbursement-report-card">

      {/* =====================================================
          HEADER
      ====================================================== */}

      <div className="disbursement-report-header">

        <div className="disbursement-report-heading">

          <h4 className="sub-title mb-1">
            Disbursement Report

            {data?.config?.school_year && (
              <span className="disbursement-school-year">
                — {data.config.school_year}
              </span>
            )}
          </h4>

          <p className="text-muted small mb-0">
            Final list of applicants who received their educational
            assistance, along with the verifier who processed the
            disbursement.
          </p>

        </div>


        <button
          type="button"
          className="btn btn-outline-custom btn-sm disbursement-download-btn"
          onClick={handleDownloadPdf}
          disabled={
            downloading ||
            loading ||
            entries.length === 0
          }
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3v12" />
            <path d="m7 10 5 5 5-5" />
            <path d="M5 21h14" />
          </svg>

          {downloading
            ? "Generating..."
            : "Download PDF"}
        </button>

      </div>


      {/* =====================================================
          ERROR
      ====================================================== */}

      {error && (
        <div className="alert alert-danger py-2 mb-3">
          {error}
        </div>
      )}


      {/* =====================================================
          LOADING
      ====================================================== */}

      {loading ? (

        <div className="d-flex justify-content-center py-5">
          <div
            className="spinner-border text-danger"
            role="status"
          />
        </div>

      ) : (

        <>

          {/* =================================================
              SUMMARY
          ================================================== */}

          {entries.length > 0 && (

            <div className="disbursement-summary">

              {/* TOTAL DISBURSED */}

              <div className="disbursement-summary-item">

                <div className="disbursement-summary-icon">

                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M8 6h13" />
                    <path d="M8 12h13" />
                    <path d="M8 18h13" />
                    <path d="M3 6h.01" />
                    <path d="M3 12h.01" />
                    <path d="M3 18h.01" />
                  </svg>

                </div>

                <div>

                  <div className="disbursement-summary-label">
                    Total Disbursed
                  </div>

                  <div className="disbursement-summary-value">

                    {totalDisbursed}

                    <span>
                      {" "}applicant(s)
                    </span>

                  </div>

                </div>

              </div>


              {/* TOTAL AMOUNT */}

              <div className="disbursement-summary-item">

                <div className="disbursement-summary-icon amount">

                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect
                      x="3"
                      y="5"
                      width="18"
                      height="14"
                      rx="2"
                    />
                    <path d="M3 10h18" />
                    <path d="M7 15h3" />
                  </svg>

                </div>

                <div>

                  <div className="disbursement-summary-label">
                    Total Amount
                  </div>

                  <div className="disbursement-summary-value amount">
                    ₱
                    {Number(totalAmount).toLocaleString()}
                  </div>

                </div>

              </div>

            </div>

          )}


          {/* =================================================
              TABLE
          ================================================== */}

          <div className="table-responsive table-scroll">

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

                {entries.length === 0 ? (

                  <tr>
                    <td
                      colSpan={8}
                      className="disbursement-empty-state"
                    >
                      No disbursements recorded for this period.
                    </td>
                  </tr>

                ) : (

                  entries.map((entry, index) => (

                    <tr key={index}>

                      <td>
                        {entry.control_number ?? "—"}
                      </td>

                      <td className="disbursement-applicant-name">
                        {entry.applicant_name}
                      </td>

                      <td>
                        {entry.school_name}
                      </td>

                      <td>
                        {entry.lane_name ?? "—"}
                      </td>

                      <td>
                        {entry.claiming_date ?? "—"}
                      </td>

                      <td>
                        {entry.verifier_name ?? "—"}
                      </td>

                      <td>
                        {formatDateTime(
                          entry.verified_at
                        )}
                      </td>

                      <td className="disbursement-amount">
                        ₱
                        {Number(
                          entry.amount ?? 0
                        ).toLocaleString()}
                      </td>

                    </tr>

                  ))

                )}

              </tbody>

            </table>

          </div>

        </>

      )}

    </div>
  );
}

export default DisbursementReportSection;