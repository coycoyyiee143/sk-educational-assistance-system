import { Link } from "react-router-dom";
import VerifierNavigation from "../components/VerifierNavigation";

// ── Data ──────────────────────────────────────────────────────────────────────

const applicantInfo = [
  ["Application ID",  "SK-EA-2026-00125"],
  ["Applicant Name",  "Juan Dela Cruz"],
  ["Submission Date", "April 10, 2026"],
  ["Contact Number",  "0912-345-6789"],
  ["Email Address",   "juandelacruz@email.com"],
  ["Address",         "Barangay Mamatid, Cabuyao, Laguna"],
];

const educationalInfo = [
  ["School Name",        "Pamantasan ng Cabuyao"],
  ["Educational Level",  "College"],
  ["Course",             "BS Information Technology"],
  ["Year Level",         "3rd Year"],
  ["Student ID Number",  "2023-00125"],
];

const ocrResults = [
  { document: "School ID",                 result: "Student name and ID detected",                    status: "Passed"  },
  { document: "Certificate of Enrollment", result: "Text partially readable. Verification uncertain.", status: "Flagged" },
  { document: "Voter's Certificate",       result: "Resident information not detected",               status: "Failed"  },
];

const uploadedDocs = [
  { label: "School ID",                 filename: "school-id.pdf" },
  { label: "Certificate of Enrollment", filename: "enrollment.pdf" },
  { label: "Voter's Certificate",       filename: "voters-certificate.pdf" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function OcrBadge({ status }) {
  const map = {
    Passed:  "bg-success",
    Flagged: "bg-warning text-dark",
    Failed:  "bg-danger",
  };
  return <span className={`badge ${map[status] ?? ""}`}>{status}</span>;
}

function InfoTable({ rows }) {
  return (
    <table className="table table-bordered info-table">
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label}>
            <th>{label}</th>
            <td>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

function VerifierApplicationReview() {
  return (
    <div>
      <VerifierNavigation />

      <section className="page-section">
        <div className="container">

          {/* Header */}
          <div className="page-card">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <h3 className="section-title mb-2">Application Review</h3>
                <p className="text-muted mb-0">Review the submitted application and uploaded documents.</p>
              </div>
              <span className="status-badge">Flagged for Review</span>
            </div>
          </div>

          {/* Applicant Information */}
          <div className="page-card">
            <h4 className="section-title">Applicant Information</h4>
            <InfoTable rows={applicantInfo} />
          </div>

          {/* Educational Information */}
          <div className="page-card">
            <h4 className="section-title">Educational Information</h4>
            <InfoTable rows={educationalInfo} />
          </div>

          {/* OCR Results */}
          <div className="page-card">
            <h4 className="section-title">System OCR Verification Result</h4>
            <div className="table-responsive">
              <table className="table table-bordered align-middle">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>OCR Result</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ocrResults.map((row) => (
                    <tr key={row.document}>
                      <td>{row.document}</td>
                      <td>{row.result}</td>
                      <td><OcrBadge status={row.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Uploaded Documents */}
          <div className="page-card">
            <h4 className="section-title">Uploaded Documents</h4>

            <div className="row g-3">
              {uploadedDocs.map((doc) => (
                <div className="col-md-4" key={doc.label}>
                  <div className="doc-card">
                    <h6>{doc.label}</h6>
                    <p className="text-muted">{doc.filename}</p>
                    <button className="btn btn-outline-custom btn-sm">View Document</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 text-end">
              <Link to="/VerifierVerificationAction" className="btn btn-custom">
                Proceed to Verification Action
              </Link>
            </div>
          </div>

        </div>
      </section>

      <footer>
        <div className="container">
          <p className="mb-0">© 2026 Sangguniang Kabataan of Barangay Mamatid | Verifier Panel</p>
        </div>
      </footer>
    </div>
  );
}

export default VerifierApplicationReview;