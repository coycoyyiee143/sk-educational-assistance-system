import { useState, useEffect } from "react";
import ApplicantNavigation from "../components/ApplicantNavigation";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

function ApplicantProfile() {
  const { user, login, token } = useAuth();
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
    guardianFirstName: "",
    guardianMiddleName: "",
    guardianLastName: "",
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
          dob: p?.birthdate?.split("T")[0] ?? "",
          gender: p?.gender ?? "",
          civilStatus: p?.civil_status ?? "",
          barangay: p?.barangay ?? "",
          city: p?.city ?? "",
          province: p?.province ?? "",
          houseNo: p?.house_no ?? "",
          street: p?.street ?? "",
          purok: p?.purok ?? "",
          guardianFirstName: p?.guardian_first_name ?? "",
          guardianMiddleName: p?.guardian_middle_name ?? "",
          guardianLastName: p?.guardian_last_name ?? "",
          guardianContact: p?.guardian_contact ?? "",
          guardianRelationship: p?.guardian_relationship ?? "",
        });
      })
      .catch(() => setError("Failed to load profile."))
      .finally(() => setLoading(false));
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function computeAge(dobString) {
    if (!dobString) return null;
    const dob = new Date(dobString);
    if (isNaN(dob)) return null;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
  }
  const age = computeAge(form.dob);
  const isMinor = age !== null && age < 18;

  async function handleSubmit(e) {
    e.preventDefault();
    setSuccess("");
    setError("");

    // Contact number is now required, same as First/Last Name
    if (!form.firstName.trim() || !form.lastName.trim() || !form.contact.trim()) {
      setError("First Name, Last Name, and Contact Number cannot be empty.");
      return;
    }

    setSaving(true);
    try {
      // Account info (name, contact) is a separate endpoint from profile info
      const accountRes = await api.put("/user/profile", {
        first_name: form.firstName,
        last_name: form.lastName,
        middle_name: form.middleName,
        mobile_number: form.contact,
      });

      // Refresh the cached user in AuthContext so "Welcome back, X" and
      // other name displays update immediately without needing to re-login
      login(accountRes.data.user, token)



      // Only send profile fields that actually have a value, so partial
      // edits (e.g. just fixing the barangay) don't require filling everything
      const profilePayload = {};
      if (form.dob) profilePayload.birthdate = form.dob;
      if (form.gender) profilePayload.gender = form.gender.toLowerCase();
      if (form.civilStatus) profilePayload.civil_status = form.civilStatus.toLowerCase();
      if (form.houseNo) profilePayload.house_no = form.houseNo;
      if (form.street) profilePayload.street = form.street;
      if (form.purok) profilePayload.purok = form.purok;
      if (form.barangay) profilePayload.barangay = form.barangay;
      if (form.city) profilePayload.city = form.city;
      if (form.province) profilePayload.province = form.province;
      if (form.guardianFirstName) profilePayload.guardian_first_name = form.guardianFirstName;
      if (form.guardianMiddleName) profilePayload.guardian_middle_name = form.guardianMiddleName;
      if (form.guardianLastName) profilePayload.guardian_last_name = form.guardianLastName;
      if (form.guardianRelationship) profilePayload.guardian_relationship = form.guardianRelationship;
      if (form.guardianContact) profilePayload.guardian_contact = form.guardianContact;

      if (Object.keys(profilePayload).length > 0) {
        await api.put("/profile", profilePayload);
      }

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
                      <input className="form-control" value={form.firstName} onChange={set("firstName")} required />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Last Name</label>
                      <input className="form-control" value={form.lastName} onChange={set("lastName")} required />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Middle Name</label>
                      <input className="form-control" value={form.middleName} onChange={set("middleName")} />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Email Address</label>
                      <input type="email" className="form-control" value={form.email} disabled />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Contact Number</label>
                      <input className="form-control" value={form.contact} onChange={set("contact")} required />
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

                    <div className="col-12 mt-2">
                      <hr />
                      <h6 className="text-muted">Parent / Guardian Information</h6>
                      <p className="form-text mb-2">
                        {isMinor
                          ? "As a minor applicant, this must be the parent or guardian whose Voter's Certificate you will submit. Enter their name exactly as it appears on that certificate."
                          : "Only required if you are a minor applicant. If provided, enter the name exactly as it appears on their Voter's Certificate."}
                      </p>
                    </div>

                    <div className="col-md-4">
                      <label className="form-label">Guardian First Name</label>
                      <input className="form-control" placeholder="First Name" value={form.guardianFirstName} onChange={set("guardianFirstName")} />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label">Guardian Middle Name</label>
                      <input className="form-control" placeholder="Middle Name" value={form.guardianMiddleName} onChange={set("guardianMiddleName")} />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label">Guardian Last Name</label>
                      <input className="form-control" placeholder="Last Name" value={form.guardianLastName} onChange={set("guardianLastName")} />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Guardian Relationship</label>
                      <input className="form-control" placeholder="e.g. Mother" value={form.guardianRelationship} onChange={set("guardianRelationship")} />
                    </div>

                    <div className="col-md-6">
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