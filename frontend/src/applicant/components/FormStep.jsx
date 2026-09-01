import { useEffect, useRef, useState } from "react";
import { SCHOOLS, COURSES, YEAR_LEVELS } from "../constants/schoolsAndCourses";

function FormStep({ form, setForm, onSubmit, loading, draftSaved, onSaveDraft, applicationId, periodStatus, onCancel }) {
    const [otherCourse, setOtherCourse] = useState("");
    const [courseSearch, setCourseSearch] = useState("");
    const [courseDropdownOpen, setCourseDropdownOpen] = useState(false);
    const [showOtherCourseInput, setShowOtherCourseInput] = useState(false);
    const otherCourseInputRef = useRef(null);
    const [schoolSearch, setSchoolSearch] = useState("");
    const [schoolDropdownOpen, setSchoolDropdownOpen] = useState(false);
    const [yearLevelDropdownOpen, setYearLevelDropdownOpen] = useState(false);

    const filteredSchools = SCHOOLS.filter((s) =>
        s.toLowerCase().includes(schoolSearch.toLowerCase())
    );
    const filteredCourses = COURSES.filter(
        (c) => c !== "Other" && c.toLowerCase().includes(courseSearch.toLowerCase())
    );

    useEffect(() => {
        if (showOtherCourseInput && otherCourseInputRef.current) {
            otherCourseInputRef.current.focus();
        }
    }, [showOtherCourseInput]);

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    return (
        <form onSubmit={onSubmit}>
            <div className="row g-4">
                <div className="col-12">
                    <div className="sub-card">
                        <h5>Educational Information</h5>
                        <div className="alert alert-warning py-2 mb-3">
                            <strong>Important:</strong> Make sure the details you input match exactly how they appear
                            on your Registration Form. This is used to verify your document.
                        </div>
                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <label className="form-label">
                                    School Name <span className="text-danger">*</span>
                                </label>
                                <div style={{ position: "relative" }}>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="Search or select your school"
                                        value={schoolDropdownOpen ? schoolSearch : form.schoolName}
                                        onFocus={() => {
                                            setSchoolDropdownOpen(true);
                                            setSchoolSearch("");
                                        }}
                                        onChange={(e) => {
                                            setSchoolSearch(e.target.value);
                                            setSchoolDropdownOpen(true);
                                        }}
                                        onBlur={() => {
                                            setTimeout(() => setSchoolDropdownOpen(false), 150);
                                        }}
                                        required={!form.schoolName}
                                        autoComplete="off"
                                    />
                                    {schoolDropdownOpen && (
                                        <div
                                            className="border rounded bg-white shadow-sm"
                                            style={{
                                                position: "absolute",
                                                top: "100%",
                                                left: 0,
                                                right: 0,
                                                zIndex: 20,
                                                maxHeight: "220px",
                                                overflowY: "auto",
                                                marginTop: "2px",
                                            }}
                                        >
                                            {filteredSchools.length === 0 ? (
                                                <div className="px-3 py-2 text-muted small">No matching school found.</div>
                                            ) : (
                                                filteredSchools.map((s) => (
                                                    <div
                                                        key={s}
                                                        className="px-3 py-2"
                                                        style={{ cursor: "pointer" }}
                                                        onMouseDown={() => {
                                                            setForm((f) => ({ ...f, schoolName: s }));
                                                            setSchoolDropdownOpen(false);
                                                            setSchoolSearch("");
                                                        }}
                                                        onMouseEnter={(e) => (e.currentTarget.style.background = "#fff3f3")}
                                                        onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                                                    >
                                                        {s}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="form-text">
                                    Select the school as it appears on your Registration Form.
                                </div>
                            </div>
                            <div className="col-md-6 mb-3">
                                <label className="form-label">
                                    Year Level <span className="text-danger">*</span>
                                </label>
                                <div style={{ position: "relative" }}>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="Select year level"
                                        value={form.yearLevel}
                                        readOnly
                                        onFocus={() => setYearLevelDropdownOpen(true)}
                                        onBlur={() => {
                                            setTimeout(() => setYearLevelDropdownOpen(false), 150);
                                        }}
                                        required={!form.yearLevel}
                                        style={{ cursor: "pointer", backgroundColor: "#fff" }}
                                    />
                                    {yearLevelDropdownOpen && (
                                        <div
                                            className="border rounded bg-white shadow-sm"
                                            style={{
                                                position: "absolute",
                                                top: "100%",
                                                left: 0,
                                                right: 0,
                                                zIndex: 20,
                                                marginTop: "2px",
                                            }}
                                        >
                                            {YEAR_LEVELS.map((y) => (
                                                <div
                                                    key={y}
                                                    className="px-3 py-2"
                                                    style={{ cursor: "pointer" }}
                                                    onMouseDown={() => {
                                                        setForm((f) => ({ ...f, yearLevel: y }));
                                                        setYearLevelDropdownOpen(false);
                                                    }}
                                                    onMouseEnter={(e) => (e.currentTarget.style.background = "#fff3f3")}
                                                    onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                                                >
                                                    {y}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="col-md-6 mb-3">
                                <label className="form-label">
                                    Course / Program <span className="text-danger">*</span>
                                </label>
                                <div style={{ position: "relative" }}>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="Search or select your course"
                                        value={courseDropdownOpen ? courseSearch : showOtherCourseInput ? "Other" : form.course}
                                        onFocus={() => {
                                            setCourseDropdownOpen(true);
                                            setCourseSearch("");
                                        }}
                                        onChange={(e) => {
                                            setCourseSearch(e.target.value);
                                            setCourseDropdownOpen(true);
                                        }}
                                        onBlur={() => {
                                            setTimeout(() => setCourseDropdownOpen(false), 150);
                                        }}
                                        required={!form.course}
                                        autoComplete="off"
                                    />
                                    {courseDropdownOpen && (
                                        <div
                                            className="border rounded bg-white shadow-sm"
                                            style={{
                                                position: "absolute",
                                                top: "100%",
                                                left: 0,
                                                right: 0,
                                                zIndex: 20,
                                                maxHeight: "220px",
                                                overflowY: "auto",
                                                marginTop: "2px",
                                            }}
                                        >
                                            {filteredCourses.length === 0 && courseSearch !== "" ? (
                                                <div className="px-3 py-2 text-muted small">No matching course found.</div>
                                            ) : (
                                                filteredCourses.map((c) => (
                                                    <div
                                                        key={c}
                                                        className="px-3 py-2"
                                                        style={{ cursor: "pointer" }}
                                                        onMouseDown={() => {
                                                            setShowOtherCourseInput(false);
                                                            setForm((f) => ({ ...f, course: c }));
                                                            setCourseDropdownOpen(false);
                                                            setCourseSearch("");
                                                        }}
                                                        onMouseEnter={(e) => (e.currentTarget.style.background = "#fff3f3")}
                                                        onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                                                    >
                                                        {c}
                                                    </div>
                                                ))
                                            )}
                                            <div
                                                className="px-3 py-2 border-top fw-semibold"
                                                style={{ cursor: "pointer" }}
                                                onMouseDown={() => {
                                                    setShowOtherCourseInput(true);
                                                    setForm((f) => ({ ...f, course: otherCourse }));
                                                    setCourseDropdownOpen(false);
                                                    setCourseSearch("");
                                                }}
                                                onMouseEnter={(e) => (e.currentTarget.style.background = "#fff3f3")}
                                                onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                                            >
                                                Other
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {showOtherCourseInput && (
                                    <div className="mt-2">
                                        <input
                                            ref={otherCourseInputRef}
                                            className="form-control"
                                            placeholder="e.g. BS Information Technology"
                                            value={otherCourse}
                                            onChange={(e) => {
                                                setOtherCourse(e.target.value);
                                                setForm((f) => ({ ...f, course: e.target.value }));
                                            }}
                                            required
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="d-flex justify-content-end align-items-center gap-2 mt-4">
                {draftSaved && <span className="text-success small me-auto">Draft saved.</span>}
                {onCancel && (
                    <button type="button" className="btn btn-secondary-custom" onClick={onCancel} disabled={loading}>
                        ← Back
                    </button>
                )}
                {!applicationId && (
                    <button type="button" className="btn btn-secondary-custom" onClick={onSaveDraft}>
                        Save Draft
                    </button>
                )}
                <button
                    type="submit"
                    className="btn btn-submit"
                    disabled={loading || periodStatus === "scheduled" || periodStatus === "closed"}
                >
                    {loading ? "Submitting..." : "Next: Upload Documents"}
                </button>
            </div>
        </form>
    );
}

export default FormStep;