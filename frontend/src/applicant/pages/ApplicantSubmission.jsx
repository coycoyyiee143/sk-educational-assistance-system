import { useState } from "react";
import ApplicantNavigation from "../components/ApplicantNavigation";

// ── Data ──────────────────────────────────────────────────────────────────────

const educationLevels = ["Senior High School", "College", "Vocational", "Graduate School"];
const yearLevels      = ["Grade 11", "Grade 12", "1st Year", "2nd Year", "3rd Year", "4th Year"];

const uploadFields = [
  { key: "enrollment", label: "Certificate of Enrollment / Registration Form" },
  { key: "schoolId",   label: "School ID" },
  { key: "voters",     label: "Voter's Certificate" },
];

const emptyForm = {
  schoolName:  "",
  schoolAddr:  "",
  edLevel:     "",
  course:      "",
  yearLevel:   "",
  studentId:   "",
};

// ── Component ─────────────────────────────────────────────────────────────────

function ApplicantSubmission() {
  const [form, setForm] = useState(emptyForm);
  const [files, setFiles] = useState({ enrollment: null, schoolId: null, voters: null });

  const set    = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setFile = (k) => (e) => setFiles((f) => ({ ...f, [k]: e.target.files[0] ?? null }));

  function handleSubmit(e) {
    e.preventDefault();
    // TODO: connect to backend
    console.log("Submitted:", { form, files });
  }

  function handleClear() {
    setForm(emptyForm);
    setFiles({ enrollment: null, schoolId: null, voters: null });
  }

  return (
    <div>
      <ApplicantNavigation />

      <section className="page-section">
        <div className="container">
          <div className="page-card">

            <h3 className="section-title">Application Submission</h3>
            <p className="text-muted mb-4">
              Complete the educational information and upload the required supporting documents for verification.
            </p>

            <form onSubmit={handleSubmit}>
              <div className="row g-4">

                {/* Educational Information */}
                <div className="col-12">
                  <div className="sub-card">
                    <h5>Educational Information</h5>

                    <div className="row">
                      <div className="col-md-6 mb-3">
                        <label className="form-label">School Name</label>
                        <input className="form-control" placeholder="Enter school name" value={form.schoolName} onChange={set("schoolName")} />
                      </div>

                      <div className="col-md-6 mb-3">
                        <label className="form-label">School Address</label>
                        <input className="form-control" placeholder="Enter school address" value={form.schoolAddr} onChange={set("schoolAddr")} />
                      </div>

                      <div className="col-md-6 mb-3">
                        <label className="form-label">Educational Level</label>
                        <select className="form-select" value={form.edLevel} onChange={set("edLevel")}>
                          <option value="" disabled>Select level</option>
                          {educationLevels.map((l) => <option key={l}>{l}</option>)}
                        </select>
                      </div>

                      <div className="col-md-6 mb-3">
                        <label className="form-label">Course / Strand</label>
                        <input className="form-control" placeholder="Enter course or strand" value={form.course} onChange={set("course")} />
                      </div>

                      <div className="col-md-6 mb-3">
                        <label className="form-label">Year Level</label>
                        <select className="form-select" value={form.yearLevel} onChange={set("yearLevel")}>
                          <option value="" disabled>Select year level</option>
                          {yearLevels.map((y) => <option key={y}>{y}</option>)}
                        </select>
                      </div>

                      <div className="col-md-6 mb-3">
                        <label className="form-label">Student ID Number</label>
                        <input className="form-control" placeholder="Enter student ID number" value={form.studentId} onChange={set("studentId")} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Document Upload */}
                <div className="col-12">
                  <div className="sub-card">
                    <h5>Required Document Upload</h5>

                    <div className="row g-3">
                      {uploadFields.map((field) => (
                        <div className="col-md-4" key={field.key}>
                          <div className="upload-box">
                            <label className="form-label">{field.label}</label>
                            <input
                              type="file"
                              className="form-control"
                              accept=".jpg,.jpeg,.png,.pdf"
                              onChange={setFile(field.key)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3">
                      <small className="text-muted">
                        Please upload clear and readable files only. Supported file types: JPG, PNG, PDF.
                      </small>
                    </div>
                  </div>
                </div>

              </div>

              <div className="d-flex justify-content-end gap-2 mt-4">
                <button type="button" className="btn btn-secondary-custom" onClick={handleClear}>Clear Form</button>
                <button type="submit" className="btn btn-submit">Submit Application</button>
              </div>
            </form>

          </div>
        </div>
      </section>

      <footer>
        <div className="container">
          <p className="mb-0">
            © 2026 Sangguniang Kabataan of Barangay Mamatid | Educational Assistance Application System
          </p>
        </div>
      </footer>
    </div>
  );
}

export default ApplicantSubmission;