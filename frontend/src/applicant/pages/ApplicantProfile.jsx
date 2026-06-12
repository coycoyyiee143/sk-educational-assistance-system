import { useState, useEffect } from "react";
import ApplicantNavigation from "../components/ApplicantNavigation";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

function ApplicantProfile() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    middleName: "",
    email: "",
    contact: "",
    dob: "",
    gender: "",
    civilStatus: "",
    barangay: "",
    city: "",
    province: "",
    houseNo: "",
    street: "",
    purok: "",
    guardianName: "",
    guardianContact: "",
    guardianRelationship: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/profile")
      .then((res) => {
        const u = res.data;
        const p = u.profile;
        setForm({
          firstName: u.first_name ?? "",
          lastName: u.last_name ?? "",
          middleName: u.middle_name ?? "",
          email: u.email ?? "",
          contact: u.mobile_number ?? "",
          dob: p?.birthdate ?? "",
          gender: p?.gender ?? "",
          civilStatus: p?.civil_status ?? "",
          barangay: p?.barangay ?? "",
          city: p?.city ?? "",
          province: p?.province ?? "",
          houseNo: p?.house_no ?? "",
          street: p?.street ?? "",
          purok: p?.purok ?? "",
          guardianName: p?.guardian_name ?? "",
          guardianContact: p?.guardian_contact ?? "",
          guardianRelationship: p?.guardian_relationship ?? "",
        });
      })
      .catch(() => setError("Failed to load profile."))
      .finally(() => setLoading(false));
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setSuccess("");
    setError("");
    setSaving(true);
    try {
      await api.put("/profile", {
        birthdate: form.dob,
        gender: form.gender.toLowerCase(),
        civil_status: form.civilStatus.toLowerCase(),
        house_no: form.houseNo,
        street: form.street,
        purok: form.purok,
        barangay: form.barangay,
        city: form.city,
        province: form.province,
        guardian_name: form.guardianName,
        guardian_relationship: form.guardianRelationship,
        guardian_contact: form.guardianContact,
      });
      setSuccess("Profile updated successfully.");
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors) {
        setError(Object.values(errors).flat().join(" "));
      } else {
        setError("Failed to save profile.");
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div>
        <ApplicantNavigation />
        <div className="d-flex justify-content-center align-items-center" style={{ height: "60vh" }}>
          <div className="spinner-border text-danger" role="status" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <ApplicantNavigation />

      <section className="profile-section">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-8">
              <div className="profile-card">

                <div className="profile-header">
                  <img src="/logo.png" alt="Profile Icon" className="profile-avatar" />
                  <h3>Applicant Profile</h3>
                  <p className="text-muted mb-0">
                    View and update your personal information for your educational assistance application.
                  </p>
                </div>

                {success && <div className="alert alert-success">{success}</div>}
                {error && <div className="alert alert-danger">{error}</div>}

                <form onSubmit={handleSubmit}>
                  <div className="row g-3">

                    <div className="col-md-6">
                      <label className="form-label">First Name</label>
                      <input className="form-control" value={form.firstName} disabled />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Last Name</label>
                      <input className="form-control" value={form.lastName} disabled />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Middle Name</label>
                      <input className="form-control" value={form.middleName} disabled />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Email Address</label>
                      <input type="email" className="form-control" value={form.email} disabled />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Contact Number</label>
                      <input className="form-control" value={form.contact} disabled />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Date of Birth</label>
                      <input type="date" className="form-control" value={form.dob} onChange={set("dob")} />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Gender</label>
                      <select className="form-select" value={form.gender} onChange={set("gender")}>
                        <option value="" disabled>Select gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Civil Status</label>
                      <select className="form-select" value={form.civilStatus} onChange={set("civilStatus")}>
                        <option value="" disabled>Select civil status</option>
                        <option value="single">Single</option>
                        <option value="married">Married</option>
                        <option value="widowed">Widowed</option>
                        <option value="separated">Separated</option>
                      </select>
                    </div>

                    <div className="col-md-4">
                      <label className="form-label">House No.</label>
                      <input className="form-control" placeholder="House No." value={form.houseNo} onChange={set("houseNo")} />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label">Street</label>
                      <input className="form-control" placeholder="Street" value={form.street} onChange={set("street")} />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label">Purok</label>
                      <input className="form-control" placeholder="Purok" value={form.purok} onChange={set("purok")} />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label">Barangay</label>
                      <input className="form-control" placeholder="Barangay" value={form.barangay} onChange={set("barangay")} />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label">City</label>
                      <input className="form-control" placeholder="City" value={form.city} onChange={set("city")} />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label">Province</label>
                      <input className="form-control" placeholder="Province" value={form.province} onChange={set("province")} />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label">Guardian Name</label>
                      <input className="form-control" placeholder="Guardian name" value={form.guardianName} onChange={set("guardianName")} />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label">Guardian Relationship</label>
                      <input className="form-control" placeholder="e.g. Mother" value={form.guardianRelationship} onChange={set("guardianRelationship")} />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label">Guardian Contact</label>
                      <input className="form-control" placeholder="Guardian contact" value={form.guardianContact} onChange={set("guardianContact")} />
                    </div>

                  </div>

                  <div className="mt-4 d-flex gap-2 justify-content-end">
                    <button type="submit" className="btn btn-save" disabled={saving}>
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </form>

              </div>
            </div>
          </div>
        </div>
      </section>

      <footer>
        <div className="container">
          <p className="mb-0">© 2026 Sangguniang Kabataan of Barangay Mamatid | Educational Assistance Application System</p>
        </div>
      </footer>
    </div>
  );
}

export default ApplicantProfile;