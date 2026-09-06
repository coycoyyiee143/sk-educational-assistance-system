import { useState, useEffect } from "react";
import ApplicantNavigation from "../components/ApplicantNavigation";
import PanelFooter from "../../components/PanelFooter";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

function ApplicantProfile() {
  const { login, token } = useAuth();

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    middleName: "",
    email: "",
    contact: "",
    dob: "",
    gender: "",
    civilStatus: "",

    barangay: "Mamatid",
    city: "Cabuyao",
    province: "Laguna",

    houseNo: "",
    street: "",
    purokType: "",
    purok: "",

    guardianFirstName: "",
    guardianMiddleName: "",
    guardianLastName: "",
    guardianContact: "",
    guardianRelationship: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showSavedPopup, setShowSavedPopup] = useState(false);
  const [savedCountdown, setSavedCountdown] = useState(10);

  const [error, setError] = useState("");

  const [faceStatus, setFaceStatus] = useState(null);
  const [facePhotoUrl, setFacePhotoUrl] = useState(null);
  const [facePhotoLoading, setFacePhotoLoading] = useState(true);

  useEffect(() => {
    api
      .get("/profile")
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

          barangay: "Mamatid",
          city: "Cabuyao",
          province: "Laguna",

          houseNo: p?.house_no ?? "",
          street: p?.street ?? "",
          purokType: p?.purok_type ?? "",
          purok: p?.purok ?? "",

          guardianFirstName: p?.guardian_first_name ?? "",
          guardianMiddleName: p?.guardian_middle_name ?? "",
          guardianLastName: p?.guardian_last_name ?? "",
          guardianContact: p?.guardian_contact ?? "",
          guardianRelationship: p?.guardian_relationship ?? "",
        });
      })
      .catch(() => {
        setError("Failed to load profile.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    let objectUrl = null;

    api
      .get("/face-verification")
      .then((res) => {
        setFaceStatus(res.data.status);

        if (res.data.photo_url) {
          return api.get(res.data.photo_url, {
            responseType: "blob",
          });
        }

        return null;
      })
      .then((photoRes) => {
        if (photoRes) {
          objectUrl = URL.createObjectURL(photoRes.data);
          setFacePhotoUrl(objectUrl);
        }
      })
      .catch(() => {
        setFaceStatus("not_started");
      })
      .finally(() => {
        setFacePhotoLoading(false);
      });

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, []);

  useEffect(() => {
    if (!showSavedPopup) return;

    setSavedCountdown(10);

    const tick = setInterval(() => {
      setSavedCountdown((count) =>
        count <= 1 ? 0 : count - 1
      );
    }, 1000);

    const dismiss = setTimeout(() => {
      setShowSavedPopup(false);
    }, 10000);

    return () => {
      clearInterval(tick);
      clearTimeout(dismiss);
    };
  }, [showSavedPopup]);

  const set = (key) => (e) => {
    setForm((prev) => ({
      ...prev,
      [key]: e.target.value,
    }));
  };

  async function handleSubmit(e) {
    e.preventDefault();

    setError("");

    const requiredValues = [
      form.firstName,
      form.lastName,
      form.contact,
      form.dob,
      form.gender,
      form.houseNo,
      form.street,
      form.purokType,
      form.purok,
    ];

    const hasEmptyRequiredField = requiredValues.some(
      (value) => !String(value ?? "").trim()
    );

    if (hasEmptyRequiredField) {
      setError(
        "Please complete all required fields marked with an asterisk (*)."
      );
      return;
    }

    setSaving(true);

    try {
      const accountRes = await api.put("/user/profile", {
        first_name: form.firstName,
        last_name: form.lastName,
        middle_name: form.middleName || null,
        mobile_number: form.contact,
      });

      login(accountRes.data.user, token);

      const profilePayload = {
        birthdate: form.dob,

        gender: form.gender.toLowerCase(),

        civil_status: form.civilStatus
          ? form.civilStatus.toLowerCase()
          : null,

        house_no: form.houseNo,
        street: form.street,
        purok_type: form.purokType,
        purok: form.purok,

        barangay: "Mamatid",
        city: "Cabuyao",
        province: "Laguna",

        guardian_first_name:
          form.guardianFirstName || null,

        guardian_middle_name:
          form.guardianMiddleName || null,

        guardian_last_name:
          form.guardianLastName || null,

        guardian_relationship:
          form.guardianRelationship || null,

        guardian_contact:
          form.guardianContact || null,
      };

      await api.put("/profile", profilePayload);

      setShowSavedPopup(true);
    } catch (err) {
      const errors = err.response?.data?.errors;

      if (errors) {
        setError(
          Object.values(errors)
            .flat()
            .join(" ")
        );
      } else {
        setError(
          err.response?.data?.message ||
            "Failed to save profile."
        );
      }
    } finally {
      setSaving(false);
    }
  }

  const FACE_STATUS_LABEL = {
    verified: {
      text: "Verified",
      className: "badge bg-success",
    },

    failed: {
      text: "Verification Failed",
      className: "badge bg-danger",
    },

    pending: {
      text: "Pending",
      className: "badge bg-warning text-dark",
    },

    not_started: {
      text: "Not Verified",
      className: "badge bg-secondary",
    },
  };

  const faceStatusInfo =
    FACE_STATUS_LABEL[faceStatus] || null;

  const RequiredMark = () => (
    <span className="required-asterisk">*</span>
  );

  return (
    <div className="applicant-layout">
      <ApplicantNavigation />

      <div className="applicant-main">
        <div className="applicant-topbar">
          <div className="applicant-topbar-user">
            <div className="applicant-topbar-avatar"></div>
          </div>
        </div>

        <section className="page-section">
          <div className="container-fluid">

            <div className="applicant-dashboard-header">
              <h3 className="applicant-dashboard-title">
                Applicant Profile
              </h3>

              <p className="applicant-dashboard-desc">
                View and update your personal information for your
                educational assistance application.
              </p>
            </div>

            <div className="page-card">
              {loading ? (
                <div className="d-flex justify-content-center align-items-center py-5">
                  <div
                    className="spinner-border text-danger"
                    role="status"
                  />
                </div>
              ) : (
                <>
                  <div
                    className="d-flex align-items-center gap-3 mb-4 p-3"
                    style={{
                      background: "#fff8f8",
                      borderRadius: "14px",
                    }}
                  >
                    {facePhotoLoading ? (
                      <div
                        className="d-flex align-items-center justify-content-center"
                        style={{
                          width: "76px",
                          height: "76px",
                          borderRadius: "50%",
                          border: "3px solid #b71c1c",
                          background: "#fff",
                          flexShrink: 0,
                        }}
                      >
                        <div
                          className="spinner-border spinner-border-sm text-danger"
                          role="status"
                        />
                      </div>
                    ) : (
                      <img
                        src={facePhotoUrl || "/logo.png"}
                        alt={
                          facePhotoUrl
                            ? "Your registered photo"
                            : "Profile Icon"
                        }
                        style={{
                          width: "76px",
                          height: "76px",
                          borderRadius: "50%",
                          objectFit: facePhotoUrl
                            ? "cover"
                            : "contain",
                          border: "3px solid #b71c1c",
                          padding: facePhotoUrl
                            ? "0"
                            : "8px",
                          background: "#fff",
                          flexShrink: 0,
                        }}
                      />
                    )}

                    <div>
                      <h5
                        className="mb-1"
                        style={{
                          fontWeight: 700,
                        }}
                      >
                        {form.firstName} {form.lastName}
                      </h5>

                      {faceStatusInfo && (
                        <span
                          className={
                            faceStatusInfo.className
                          }
                        >
                          {faceStatusInfo.text}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-muted small mb-3">
                    Fields marked with{" "}
                    <RequiredMark /> are required.
                  </p>

                  {error && (
                    <div className="error-box">
                      {error}
                    </div>
                  )}

                  <form onSubmit={handleSubmit}>
                    <div className="row g-3">

                      {/* FIRST NAME */}
                      <div className="col-md-6">
                        <label className="form-label">
                          First Name <RequiredMark />
                        </label>

                        <input
                          className="form-control"
                          value={form.firstName}
                          onChange={set("firstName")}
                          required
                        />
                      </div>

                      {/* LAST NAME */}
                      <div className="col-md-6">
                        <label className="form-label">
                          Last Name <RequiredMark />
                        </label>

                        <input
                          className="form-control"
                          value={form.lastName}
                          onChange={set("lastName")}
                          required
                        />
                      </div>

                      {/* MIDDLE NAME */}
                      <div className="col-md-6">
                        <label className="form-label">
                          Middle Name
                        </label>

                        <input
                          className="form-control"
                          placeholder="Middle Name"
                          value={form.middleName}
                          onChange={set("middleName")}
                        />

                        <div className="form-text">
                          Optional — leave blank if you do not have a middle name.
                        </div>
                      </div>

                      {/* EMAIL */}
                      <div className="col-md-6">
                        <label className="form-label">
                          Email Address
                        </label>

                        <input
                          type="email"
                          className="form-control"
                          value={form.email}
                          disabled
                        />

                        <div className="form-text">
                          Your account email cannot be changed here.
                        </div>
                      </div>

                      {/* CONTACT */}
                      <div className="col-md-6">
                        <label className="form-label">
                          Contact Number <RequiredMark />
                        </label>

                        <input
                          className="form-control"
                          value={form.contact}
                          onChange={set("contact")}
                          required
                        />
                      </div>

                      {/* DATE OF BIRTH */}
                      <div className="col-md-6">
                        <label className="form-label">
                          Date of Birth <RequiredMark />
                        </label>

                        <input
                          type="date"
                          className="form-control"
                          value={form.dob}
                          onChange={set("dob")}
                          required
                        />
                      </div>

                      {/* GENDER */}
                      <div className="col-md-6">
                        <label className="form-label">
                          Gender <RequiredMark />
                        </label>

                        <select
                          className="form-select"
                          value={form.gender}
                          onChange={set("gender")}
                          required
                        >
                          <option value="" disabled>
                            Select gender
                          </option>

                          <option value="male">
                            Male
                          </option>

                          <option value="female">
                            Female
                          </option>

                          <option value="other">
                            Other
                          </option>
                        </select>
                      </div>

                      {/* CIVIL STATUS */}
                      <div className="col-md-6">
                        <label className="form-label">
                          Civil Status
                        </label>

                        <select
                          className="form-select"
                          value={form.civilStatus}
                          onChange={set("civilStatus")}
                        >
                          <option value="">
                            Select civil status
                          </option>

                          <option value="single">
                            Single
                          </option>

                          <option value="married">
                            Married
                          </option>

                          <option value="widowed">
                            Widowed
                          </option>

                          <option value="separated">
                            Separated
                          </option>
                        </select>

                        <div className="form-text">
                          Optional.
                        </div>
                      </div>

                      {/* HOUSE NO */}
                      <div className="col-md-4">
                        <label className="form-label">
                          House No. <RequiredMark />
                        </label>

                        <input
                          className="form-control"
                          placeholder="House No."
                          value={form.houseNo}
                          onChange={set("houseNo")}
                          required
                        />
                      </div>

                      {/* STREET */}
                      <div className="col-md-4">
                        <label className="form-label">
                          Street <RequiredMark />
                        </label>

                        <input
                          className="form-control"
                          placeholder="Street"
                          value={form.street}
                          onChange={set("street")}
                          required
                        />
                      </div>

                      {/* PUROK / PHASE */}
                      <div className="col-md-2">
                        <label className="form-label">
                          Purok/Phase <RequiredMark />
                        </label>

                        <select
                          className="form-select"
                          value={form.purokType}
                          onChange={set("purokType")}
                          required
                        >
                          <option value="" disabled>
                            Select
                          </option>

                          <option value="purok">
                            Purok
                          </option>

                          <option value="phase">
                            Phase
                          </option>
                        </select>
                      </div>

                      {/* NUMBER */}
                      <div className="col-md-2">
                        <label className="form-label">
                          Number <RequiredMark />
                        </label>

                        <input
                          className="form-control"
                          placeholder="e.g. 2"
                          value={form.purok}
                          onChange={set("purok")}
                          required
                        />
                      </div>

                      {/* BARANGAY */}
                      <div className="col-md-4">
                        <label className="form-label">
                          Barangay
                        </label>

                        <input
                          className="form-control"
                          value="Mamatid"
                          readOnly
                        />
                      </div>

                      {/* CITY */}
                      <div className="col-md-4">
                        <label className="form-label">
                          City
                        </label>

                        <input
                          className="form-control"
                          value="Cabuyao"
                          readOnly
                        />
                      </div>

                      {/* PROVINCE */}
                      <div className="col-md-4">
                        <label className="form-label">
                          Province
                        </label>

                        <input
                          className="form-control"
                          value="Laguna"
                          readOnly
                        />
                      </div>

                      {/* PARENT / GUARDIAN */}
                      <div className="col-12 mt-2">
                        <hr />

                        <h6 className="text-muted">
                          Parent / Guardian Information
                        </h6>

                        <p className="form-text mb-2">
                          Optional — if provided, please enter the parent or
                          guardian information exactly as it appears on their
                          supporting documents.
                        </p>
                      </div>

                      {/* GUARDIAN FIRST NAME */}
                      <div className="col-md-4">
                        <label className="form-label">
                          Guardian First Name
                        </label>

                        <input
                          className="form-control"
                          placeholder="First Name"
                          value={form.guardianFirstName}
                          onChange={set("guardianFirstName")}
                        />
                      </div>

                      {/* GUARDIAN MIDDLE NAME */}
                      <div className="col-md-4">
                        <label className="form-label">
                          Guardian Middle Name
                        </label>

                        <input
                          className="form-control"
                          placeholder="Middle Name"
                          value={form.guardianMiddleName}
                          onChange={set("guardianMiddleName")}
                        />

                        <div className="form-text">
                          Leave blank if the parent or guardian has no middle name.
                        </div>
                      </div>

                      {/* GUARDIAN LAST NAME */}
                      <div className="col-md-4">
                        <label className="form-label">
                          Guardian Last Name
                        </label>

                        <input
                          className="form-control"
                          placeholder="Last Name"
                          value={form.guardianLastName}
                          onChange={set("guardianLastName")}
                        />
                      </div>

                      {/* GUARDIAN RELATIONSHIP */}
                      <div className="col-md-6">
                        <label className="form-label">
                          Guardian Relationship
                        </label>

                        <input
                          className="form-control"
                          placeholder="e.g. Mother"
                          value={form.guardianRelationship}
                          onChange={set("guardianRelationship")}
                        />
                      </div>

                      {/* GUARDIAN CONTACT */}
                      <div className="col-md-6">
                        <label className="form-label">
                          Guardian Contact
                        </label>

                        <input
                          className="form-control"
                          placeholder="Guardian contact"
                          value={form.guardianContact}
                          onChange={set("guardianContact")}
                        />
                      </div>

                    </div>

                    <div className="mt-4 d-flex gap-2 justify-content-end">
                      <button
                        type="submit"
                        className="btn btn-save-green"
                        disabled={saving}
                      >
                        {saving
                          ? "Saving..."
                          : "Save Changes"}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>

          </div>
        </section>

        <PanelFooter />
      </div>

      {showSavedPopup && (
        <div className="verifier-password-feedback-backdrop">
          <div className="verifier-password-feedback verifier-password-feedback-success">

            <div className="verifier-password-feedback-icon-wrap">
              <span className="verifier-password-feedback-icon">
                ✓
              </span>
            </div>

            <h4 className="verifier-password-feedback-title">
              Profile Updated
            </h4>

            <p className="verifier-password-feedback-message">
              Your profile information has been saved successfully.
            </p>

            <button
              type="button"
              className="verifier-password-feedback-dismiss"
              onClick={() => setShowSavedPopup(false)}
            >
              <span>Dismiss</span>

              <span className="verifier-password-feedback-arrow">
                →
              </span>

              <span className="verifier-password-feedback-timer">
                {savedCountdown}s
              </span>
            </button>

          </div>
        </div>
      )}
    </div>
  );
}

export default ApplicantProfile;