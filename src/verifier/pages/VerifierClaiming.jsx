import { useState } from "react";
import VerifierNavigation from "../components/VerifierNavigation";

// ── Data ──────────────────────────────────────────────────────────────────────

const applicantDetails = [
  ["Application ID",    "SK-EA-2026-00125"],
  ["Control Number",    "0108"],
  ["Applicant Name",    "Juan Dela Cruz"],
  ["School Name",       "Pamantasan ng Cabuyao"],
  ["Educational Level", "College"],
  ["Course / Strand",   "Bachelor of Science in Information Technology"],
  ["Year Level",        "3rd Year"],
  ["Student ID Number", "2023-00125"],
  ["Claiming Date",     "May 20, 2026"],
  ["Batch",             "Morning (7:00 AM - 12:00 PM)"],
];

const uploadedDocs = [
  { label: "Certificate of Enrollment / Registration Form", filename: "certificate-of-enrollment.pdf" },
  { label: "School ID",                                     filename: "school-id.jpg" },
  { label: "Voter's Certificate",                           filename: "voters-certificate.pdf" },
];

const physicalDocs = [
  { id: "doc1", label: "Certificate of Enrollment / Registration Form" },
  { id: "doc2", label: "School ID" },
  { id: "doc3", label: "Voter's Certificate" },
];

// ── Component ─────────────────────────────────────────────────────────────────

function VerifierClaiming() {
  const [controlNo, setControlNo] = useState("");
  const [applicantName, setApplicantName] = useState("");
  const [checkedDocs, setCheckedDocs] = useState(["doc1", "doc2", "doc3"]);

  function toggleDoc(id) {
    setCheckedDocs((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  }

  function handleSearch(e) {
    e.preventDefault();
    // TODO: connect to backend
    console.log("Searching:", { controlNo, applicantName });
  }

  function handleClaimAction(action) {
    // TODO: connect to backend
    console.log("Claiming action:", action);
  }

  return (
    <div>
      <VerifierNavigation />

      <section className="page-section">
        <div className="container">

          {/* Header */}
          <div className="content-card">
            <h3 className="section-title mb-2">Claiming Approved Application</h3>
            <p className="text-muted mb-0">
              Search the approved applicant, check the physical documents, and update the final claiming status.
            </p>
          </div>

          {/* Search */}
          <div className="content-card">
            <h4>Search Applicant</h4>
            <div className="search-box">
              <div className="row g-3 align-items-end">
                <div className="col-md-5">
                  <label className="form-label">Control Number</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter control number"
                    value={controlNo}
                    onChange={(e) => setControlNo(e.target.value)}
                  />
                </div>
                <div className="col-md-5">
                  <label className="form-label">Applicant Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter applicant name"
                    value={applicantName}
                    onChange={(e) => setApplicantName(e.target.value)}
                  />
                </div>
                <div className="col-md-2 d-grid">
                  <button className="btn btn-custom" onClick={handleSearch}>Search</button>
                </div>
              </div>
            </div>
          </div>

          {/* Applicant Details */}
          <div className="content-card">
            <h4>Applicant Details</h4>
            <div className="table-responsive">
              <table className="table table-bordered info-table align-middle">
                <tbody>
                  {applicantDetails.map(([label, value]) => (
                    <tr key={label}>
                      <th>{label}</th>
                      <td>{value}</td>
                    </tr>
                  ))}
                  <tr>
                    <th>Lane</th>
                    <td><span className="lane-badge">Lane 2</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Uploaded Documents */}
          <div className="content-card">
            <h4>Uploaded Documents</h4>
            <div className="row g-3">
              {uploadedDocs.map((doc) => (
                <div className="col-md-4" key={doc.label}>
                  <div className="doc-check">
                    <h6>{doc.label}</h6>
                    <p className="text-muted">{doc.filename}</p>
                    <button className="btn btn-outline-custom btn-sm">View File</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Physical Document Check */}
          <div className="content-card">
            <h4>Physical Document Check</h4>
            <div className="row g-3">
              {physicalDocs.map((doc) => (
                <div className="col-md-4" key={doc.id}>
                  <div className="doc-check">
                    <h6>{doc.label}</h6>
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={doc.id}
                        checked={checkedDocs.includes(doc.id)}
                        onChange={() => toggleDoc(doc.id)}
                      />
                      <label className="form-check-label" htmlFor={doc.id}>
                        Presented and matched
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="note-box mt-4">
              The verifier only checks if the physical documents match the approved application record before updating the final claiming status.
            </div>
          </div>

          {/* Claiming Action */}
          <div className="content-card">
            <h4>Claiming Action</h4>

            <div className="alert alert-light border">
              After checking the physical documents, select the appropriate action for the applicant.
            </div>

            <div className="d-flex gap-2 justify-content-end flex-wrap">
              <button className="btn btn-success"          onClick={() => handleClaimAction("Claimed")}>Mark as Claimed</button>
              <button className="btn btn-danger"           onClick={() => handleClaimAction("Not Cleared")}>Mark as Not Cleared</button>
              <button className="btn btn-warning text-dark" onClick={() => handleClaimAction("Unclaimed")}>Mark as Unclaimed</button>
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

export default VerifierClaiming;