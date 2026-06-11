import { useState } from "react";
import ApplicantNavigation from "../components/ApplicantNavigation";

const emptyForm = {
  firstName:       "",
  lastName:        "",
  middleName:      "",
  suffix:          "",
  email:           "",
  contact:         "",
  dob:             "",
  gender:          "",
  civilStatus:     "",
  barangay:        "Barangay Mamatid",
  address:         "",
  guardianName:    "",
  guardianContact: "",
};

function ApplicantProfile() {
  const [form, setForm] = useState(emptyForm);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function handleSubmit(e) {
    e.preventDefault();
    // TODO: connect to backend
    console.log("Saved profile:", form);
  }

  return (
    <div>
      <ApplicantNavigation />

      <section className="profile-section">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-8">
              <div className="profile-card">

                {/* Header */}
                <div className="profile-header">
                  <img src="/logo.png" alt="Profile Icon" className="profile-avatar" />
                  <h3>Applicant Profile</h3>
                  <p className="text-muted mb-0">
                    View and update your personal information for your educational assistance application.
                  </p>
                </div>

                <form onSubmit={handleSubmit}>
                  <div className="row g-3">

                    <div className="col-md-6">
                      <label className="form-label">First Name</label>
                      <input className="form-control" placeholder="Enter first name" value={form.firstName} onChange={set("firstName")} />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Last Name</label>
                      <input className="form-control" placeholder="Enter last name" value={form.lastName} onChange={set("lastName")} />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Middle Name</label>
                      <input className="form-control" placeholder="Enter middle name" value={form.middleName} onChange={set("middleName")} />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Suffix</label>
                      <input className="form-control" placeholder="Jr., Sr., III" value={form.suffix} onChange={set("suffix")} />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Email Address</label>
                      <input type="email" className="form-control" placeholder="Enter email address" value={form.email} onChange={set("email")} />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Contact Number</label>
                      <input className="form-control" placeholder="Enter contact number" value={form.contact} onChange={set("contact")} />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Date of Birth</label>
                      <input type="date" className="form-control" value={form.dob} onChange={set("dob")} />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Gender</label>
                      <select className="form-select" value={form.gender} onChange={set("gender")}>
                        <option value="" disabled>Select gender</option>
                        <option>Male</option>
                        <option>Female</option>
                        <option>Prefer not to say</option>
                      </select>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Civil Status</label>
                      <select className="form-select" value={form.civilStatus} onChange={set("civilStatus")}>
                        <option value="" disabled>Select civil status</option>
                        <option>Single</option>
                        <option>Married</option>
                        <option>Widowed</option>
                        <option>Separated</option>
                      </select>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Barangay</label>
                      <input className="form-control" value={form.barangay} onChange={set("barangay")} />
                    </div>

                    <div className="col-12">
                      <label className="form-label">Complete Address</label>
                      <textarea className="form-control" rows="3" placeholder="Enter complete address" value={form.address} onChange={set("address")} />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Parent/Guardian Name</label>
                      <input className="form-control" placeholder="Enter parent/guardian name" value={form.guardianName} onChange={set("guardianName")} />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Parent/Guardian Contact Number</label>
                      <input className="form-control" placeholder="Enter contact number" value={form.guardianContact} onChange={set("guardianContact")} />
                    </div>

                  </div>

                  <div className="mt-4 d-flex gap-2 justify-content-end">
                    <button type="button" className="btn btn-cancel" onClick={() => setForm(emptyForm)}>Cancel</button>
                    <button type="submit" className="btn btn-save">Save Changes</button>
                  </div>
                </form>

              </div>
            </div>
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

export default ApplicantProfile;