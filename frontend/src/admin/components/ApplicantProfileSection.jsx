import { useState, useEffect } from "react";
import api from "../../services/api";

function CategoryBar({ label, count, percentage, max }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="profile-category-item">
      <div className="profile-category-row">
        <span>{label}</span>
        <span>{count} · {percentage ?? 0}%</span>
      </div>
      <div className="profile-category-progress">
        <div className="profile-category-progress-bar" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
function ProfileHeaderIcon({ type }) {
  if (type === "school") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
        <path d="M3 9.5L12 5l9 4.5L12 14 3 9.5z" strokeLinejoin="round" />
        <path d="M6.5 11.3V16l5.5 3 5.5-3v-4.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21 10v5" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "age") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
        <circle cx="12" cy="8" r="3" />
        <path d="M6.5 19c.6-3.7 2.6-5.5 5.5-5.5s4.9 1.8 5.5 5.5" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <path d="M12 21s6-5.2 6-11a6 6 0 10-12 0c0 5.8 6 11 6 11z" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.2" />
    </svg>
  );
}
function PdfExportIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <path d="M12 4v10" strokeLinecap="round" />
      <path d="M8.5 10.5L12 14l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 15v3.5A1.5 1.5 0 006.5 20h11a1.5 1.5 0 001.5-1.5V15" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ViewAllButton({ text = "View All Records", onClick }) {
  return (
    <button type="button" className="report-history-view-link" onClick={onClick}>
      <span>{text}</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
        <path d="M5 12h14M14 7l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
function ApplicantProfileSection({ selectedConfigId, section }) {
  const [distribution, setDistribution] = useState(null);
  const [ageDistribution, setAgeDistribution] = useState(null);
  const [sectionLoading, setSectionLoading] = useState(true);
  const [schoolProgramModalOpen, setSchoolProgramModalOpen] = useState(false);
  const [schoolProgramPage, setSchoolProgramPage] = useState(1);
  const [yearAgeModalOpen, setYearAgeModalOpen] = useState(false);
  const [purokPhaseModalOpen, setPurokPhaseModalOpen] = useState(false);
  const [purokPhasePage, setPurokPhasePage] = useState(1);
  const schoolProgramPerPage = 5;
  const purokPhasePerPage = 5;

  useEffect(() => {
    setSectionLoading(true);
    const params = selectedConfigId ? { config_id: selectedConfigId } : {};
    Promise.all([
      api.get("/admin/reports/applicant-distribution", { params }).then((res) => setDistribution(res.data)).catch(() => {}),
      api.get("/admin/reports/age-distribution", { params }).then((res) => setAgeDistribution(res.data)).catch(() => {})
    ]).finally(() => setSectionLoading(false));
  }, [selectedConfigId]);

  useEffect(() => {
    setSchoolProgramPage(1);
    setPurokPhasePage(1);
    setYearAgeModalOpen(false);
    setPurokPhaseModalOpen(false);
  }, [selectedConfigId]);

  async function handlePdfExport(endpoint, filenamePrefix) {
    try {
      const params = selectedConfigId ? { config_id: selectedConfigId } : {};
      const res = await api.get(endpoint, { params, responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {}
  }

  const bySchool = distribution?.by_school ?? [];
  const byCourse = distribution?.by_course ?? [];
  const byYearLevel = distribution?.by_year_level ?? [];
  const byPurok = distribution?.by_purok ?? [];
  const visibleSchools = bySchool.slice(0, 2);
  const visibleCourses = byCourse.slice(0, 2);
  const visiblePurok = byPurok.slice(0, 3);
  const phaseRecords = byPurok.filter((r) => r.purok_type === "phase");
  const purokRecords = byPurok.filter((r) => r.purok_type === "purok" || r.purok_type === "unspecified");
  const yearLevelOrder = ["1st Year", "3rd Year", "2nd Year", "4th Year"];
  const visibleYearLevels = yearLevelOrder.map((yearLevel) => {
    const found = byYearLevel.find((r) => r.year_level === yearLevel);
    return found ?? { year_level: yearLevel, total: 0, percentage: 0 };
  });
  const maxSchoolCount = Math.max(1, ...bySchool.map((r) => r.total));
  const maxCourseCount = Math.max(1, ...byCourse.map((r) => r.total));
  const maxYearLevelCount = Math.max(1, ...byYearLevel.map((r) => r.total));
  const maxPurokCount = Math.max(1, ...byPurok.map((r) => r.total));
  const maxPhaseCount = Math.max(1, ...phaseRecords.map((r) => r.total));
  const maxModalPurokCount = Math.max(1, ...purokRecords.map((r) => r.total));
  const schoolProgramTotalRecords = Math.max(bySchool.length, byCourse.length);
  const schoolProgramTotalPages = Math.max(1, Math.ceil(schoolProgramTotalRecords / schoolProgramPerPage));
  const schoolProgramStart = (schoolProgramPage - 1) * schoolProgramPerPage;
  const schoolProgramEnd = schoolProgramStart + schoolProgramPerPage;
  const modalSchools = bySchool.slice(schoolProgramStart, schoolProgramEnd);
  const modalCourses = byCourse.slice(schoolProgramStart, schoolProgramEnd);
  const purokPhaseTotalRecords = Math.max(phaseRecords.length, purokRecords.length);
  const purokPhaseTotalPages = Math.max(1, Math.ceil(purokPhaseTotalRecords / purokPhasePerPage));
  const purokPhaseStart = (purokPhasePage - 1) * purokPhasePerPage;
  const purokPhaseEnd = purokPhaseStart + purokPhasePerPage;
  const modalPhases = phaseRecords.slice(purokPhaseStart, purokPhaseEnd);
  const modalPuroks = purokRecords.slice(purokPhaseStart, purokPhaseEnd);
  const ageCounts = ageDistribution?.counts ?? {};
  const ageRates = ageDistribution?.rates ?? {};
  const ageCards = [
    { key: "minor", value: ageCounts.minor ?? 0, label: `Minor (${ageRates.minor_rate ?? 0}%)` },
    { key: "adult", value: ageCounts.adult ?? 0, label: `Adult (${ageRates.adult_rate ?? 0}%)` }
  ];

  if (ageCounts.unknown > 0) ageCards.push({ key: "unknown", value: ageCounts.unknown, label: `Unknown (${ageRates.unknown_rate ?? 0}%)` });

  function formatPurokLabel(row) {
    if (row.purok_type === "unspecified") return "Unspecified";
    return `${row.purok_type.charAt(0).toUpperCase() + row.purok_type.slice(1)} ${row.purok}`;
  }
  function openSchoolProgramModal() {
    setSchoolProgramPage(1);
    setSchoolProgramModalOpen(true);
  }
  function closeSchoolProgramModal() {
    setSchoolProgramModalOpen(false);
  }
  function openYearAgeModal() {
    setYearAgeModalOpen(true);
  }
  function closeYearAgeModal() {
    setYearAgeModalOpen(false);
  }
  function openPurokPhaseModal() {
    setPurokPhasePage(1);
    setPurokPhaseModalOpen(true);
  }
  function closePurokPhaseModal() {
    setPurokPhaseModalOpen(false);
  }

  if (sectionLoading) {
    return (
      <div className="applicant-profile-card applicant-profile-card-loading">
        <div className="d-flex justify-content-center align-items-center h-100">
          <div className="spinner-border text-danger" role="status" />
        </div>
      </div>
    );
  }

  if (section === "school") {
    return (
      <>
        <div className="applicant-profile-card school-program-card">
          <div className="applicant-profile-card-header">
            <div className="applicant-profile-heading">
              <span className="applicant-profile-header-icon"><ProfileHeaderIcon type="school" /></span>
              <div>
                <h4 className="applicant-profile-card-title">School &amp; Program</h4>
                {distribution?.config && <span className="applicant-profile-cycle">Cycle {distribution.config.school_year}</span>}
              </div>
            </div>
            <button type="button" className="applicant-profile-export-btn" title="Export PDF" aria-label="Export School and Program PDF" onClick={() => handlePdfExport("/admin/reports/school-program/pdf", "applicant-school-program")}><PdfExportIcon /></button>
          </div>
          <div className="applicant-profile-card-body">
            {!distribution?.config || bySchool.length === 0 ? <div className="applicant-profile-empty">No applicant data available for the selected period.</div> : (
              <>
                <div className="applicant-profile-section">
                  <h6 className="applicant-profile-label">School</h6>
                  {visibleSchools.map((r) => <CategoryBar key={r.school_name} label={r.school_name} count={r.total} percentage={r.percentage} max={maxSchoolCount} />)}
                </div>
                <div className="applicant-profile-section">
                  <h6 className="applicant-profile-label">Program</h6>
                  {visibleCourses.length === 0 ? <div className="applicant-profile-empty">No data available.</div> : visibleCourses.map((r) => <CategoryBar key={r.course} label={r.course} count={r.total} percentage={r.percentage} max={maxCourseCount} />)}
                </div>
              </>
            )}
          </div>
          <div className="applicant-profile-card-footer">
            <span className="applicant-profile-footer-info">Showing {visibleSchools.length} of {bySchool.length} schools · {visibleCourses.length} of {byCourse.length} programs</span>
            <ViewAllButton onClick={openSchoolProgramModal} />
          </div>
        </div>
        {schoolProgramModalOpen && (
          <div className="report-history-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && closeSchoolProgramModal()}>
            <div className="report-history-modal" role="dialog" aria-modal="true" aria-labelledby="school-program-modal-title">
              <div className="report-history-modal-header">
                <div className="report-history-modal-title-group">
                  <span className="report-history-modal-icon"><ProfileHeaderIcon type="school" /></span>
                  <div>
                    <h4 id="school-program-modal-title">School &amp; Program Records</h4>
                    <p>Schools and degree programs for the selected application cycle.</p>
                  </div>
                </div>
                <div className="d-flex align-items-center gap-3">
                  <button type="button" className="report-records-export-btn" onClick={() => handlePdfExport("/admin/reports/school-program/pdf", "applicant-school-program")}>Export PDF</button>
                  <button type="button" className="report-history-modal-close" aria-label="Close" onClick={closeSchoolProgramModal}>×</button>
                </div>
              </div>
              <div className="report-history-modal-body">
                <div className="row g-4">
                  <div className="col-12 col-md-6">
                    <h6 className="applicant-profile-label mb-3">Schools &amp; Universities</h6>
                    {modalSchools.length === 0 ? <div className="applicant-profile-empty">No school data available.</div> : modalSchools.map((r) => <CategoryBar key={r.school_name} label={r.school_name} count={r.total} percentage={r.percentage} max={maxSchoolCount} />)}
                  </div>
                  <div className="col-12 col-md-6">
                    <h6 className="applicant-profile-label mb-3">Degree Programs &amp; Majors</h6>
                    {modalCourses.length === 0 ? <div className="applicant-profile-empty">No program data available.</div> : modalCourses.map((r) => <CategoryBar key={r.course} label={r.course} count={r.total} percentage={r.percentage} max={maxCourseCount} />)}
                  </div>
                </div>
              </div>
              <div className="report-modal-footer">
                <div className="report-modal-footer-top">
                  <span className="report-history-pagination-info">Showing {schoolProgramTotalRecords === 0 ? 0 : schoolProgramStart + 1}–{Math.min(schoolProgramEnd, schoolProgramTotalRecords)} of {schoolProgramTotalRecords} records</span>
                  <div className="report-history-pagination-controls">
                    <button type="button" className="report-history-pagination-arrow" disabled={schoolProgramPage === 1} onClick={() => setSchoolProgramPage((page) => Math.max(1, page - 1))}>‹</button>
                    {Array.from({ length: schoolProgramTotalPages }, (_, index) => index + 1).map((page) => (
                      <button key={page} type="button" className={`report-history-pagination-page ${page === schoolProgramPage ? "report-history-pagination-page-active" : ""}`} onClick={() => setSchoolProgramPage(page)}>{page}</button>
                    ))}
                    <button type="button" className="report-history-pagination-arrow" disabled={schoolProgramPage === schoolProgramTotalPages} onClick={() => setSchoolProgramPage((page) => Math.min(schoolProgramTotalPages, page + 1))}>›</button>
                  </div>
                </div>
                <div className="report-modal-footer-bottom">
                  <button type="button" className="year-age-modal-done-btn" onClick={closeSchoolProgramModal}>Close</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  if (section === "age") {
    return (
      <>
        <div className="applicant-profile-card year-age-card">
          <div className="applicant-profile-card-header">
            <div className="applicant-profile-heading">
              <span className="applicant-profile-header-icon"><ProfileHeaderIcon type="age" /></span>
              <div>
                <h4 className="applicant-profile-card-title">Year Level &amp; Age</h4>
                {ageDistribution?.config && <span className="applicant-profile-cycle">Cycle {ageDistribution.config.school_year}</span>}
              </div>
            </div>
            <button type="button" className="applicant-profile-export-btn" title="Export PDF" aria-label="Export Year Level and Age PDF" onClick={() => handlePdfExport("/admin/reports/year-level-age/pdf", "applicant-year-level-age")}><PdfExportIcon /></button>
          </div>
          <div className="applicant-profile-card-body">
            <div className="applicant-profile-section">
              <h6 className="applicant-profile-label">Year Level</h6>
              <div className="applicant-profile-year-grid">
                {visibleYearLevels.map((r) => <CategoryBar key={r.year_level} label={r.year_level} count={r.total} percentage={r.percentage} max={maxYearLevelCount} />)}
              </div>
            </div>
            <div className="applicant-profile-section">
              <h6 className="applicant-profile-label">Age (Minor vs. Adult)</h6>
              {ageCounts.total > 0 ? (
                <div className={`applicant-profile-age-grid ${ageCards.length === 3 ? "applicant-profile-age-grid-three" : ""}`}>
                  {ageCards.map((c) => (
                    <div className="applicant-profile-age-card" key={c.key}>
                      <strong>{c.value}</strong>
                      <span>{c.label}</span>
                    </div>
                  ))}
                </div>
              ) : <div className="applicant-profile-empty">No data available.</div>}
            </div>
          </div>
          <div className="applicant-profile-card-footer">
            <span className="applicant-profile-footer-info">Showing 4 year levels</span>
            <ViewAllButton onClick={openYearAgeModal} />
          </div>
        </div>
        {yearAgeModalOpen && (
          <div className="year-age-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && closeYearAgeModal()}>
            <div className="year-age-modal" role="dialog" aria-modal="true" aria-labelledby="year-age-modal-title">
              <div className="year-age-modal-header">
                <div className="year-age-modal-title-group">
                  <span className="year-age-modal-icon"><ProfileHeaderIcon type="age" /></span>
                  <div>
                    <h4 id="year-age-modal-title">Year Level &amp; Age</h4>
                    <p>Year level and age distribution for the selected application cycle.</p>
                  </div>
                </div>
                <div className="year-age-modal-header-actions">
                  <button type="button" className="report-records-export-btn" onClick={() => handlePdfExport("/admin/reports/year-level-age/pdf", "applicant-year-level-age")}>Export PDF</button>
                  <button type="button" className="year-age-modal-close" aria-label="Close" onClick={closeYearAgeModal}>×</button>
                </div>
              </div>
              <div className="year-age-modal-body">
                <div className="year-age-modal-content">
                  <div className="applicant-profile-section">
                    <h6 className="applicant-profile-label">Year Level</h6>
                    <div className="applicant-profile-year-grid">
                      {visibleYearLevels.map((r) => <CategoryBar key={r.year_level} label={r.year_level} count={r.total} percentage={r.percentage} max={maxYearLevelCount} />)}
                    </div>
                  </div>
                  <div className="applicant-profile-section">
                    <h6 className="applicant-profile-label">Age (Minor vs. Adult)</h6>
                    {ageCounts.total > 0 ? (
                      <div className={`applicant-profile-age-grid ${ageCards.length === 3 ? "applicant-profile-age-grid-three" : ""}`}>
                        {ageCards.map((c) => (
                          <div className="applicant-profile-age-card" key={c.key}>
                            <strong>{c.value}</strong>
                            <span>{c.label}</span>
                          </div>
                        ))}
                      </div>
                    ) : <div className="applicant-profile-empty">No data available.</div>}
                  </div>
                </div>
              </div>
              <div className="year-age-modal-footer">
                <span className="year-age-modal-footer-info">Showing 4 year levels</span>
                <button type="button" className="year-age-modal-done-btn" onClick={closeYearAgeModal}>Close</button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  if (section === "purok") {
    return (
      <>
        <div className="applicant-profile-card purok-phase-card">
          <div className="applicant-profile-card-header">
            <div className="applicant-profile-heading">
              <span className="applicant-profile-header-icon"><ProfileHeaderIcon type="location" /></span>
              <div>
                <h4 className="applicant-profile-card-title">Purok / Phase</h4>
                {distribution?.config && <span className="applicant-profile-cycle">Cycle {distribution.config.school_year}</span>}
              </div>
            </div>
            <button type="button" className="applicant-profile-export-btn" title="Export PDF" aria-label="Export Purok and Phase PDF" onClick={() => handlePdfExport("/admin/reports/purok-phase/pdf", "applicant-purok-phase")}><PdfExportIcon /></button>
          </div>
          <div className="applicant-profile-card-body">
            <div className="applicant-profile-section">
              <h6 className="applicant-profile-label">Purok / Phase</h6>
              {visiblePurok.length === 0 ? <div className="applicant-profile-empty">No applicant data available for the selected period.</div> : visiblePurok.map((r) => <CategoryBar key={`${r.purok_type}-${r.purok}`} label={formatPurokLabel(r)} count={r.total} percentage={r.percentage} max={maxPurokCount} />)}
            </div>
            <div className="purok-residency-note">
              <div className="purok-residency-note-top">
                <span className="purok-residency-check"><CheckIcon /></span>
                <strong>Brgy. Mamatid</strong>
                <span className="purok-residency-badge">Verified Residency</span>
              </div>
              <p>Barangay Mamatid is the only eligible residency location.</p>
            </div>
          </div>
          <div className="applicant-profile-card-footer purok-phase-footer">
            <span className="applicant-profile-footer-info">Showing {visiblePurok.length} of {byPurok.length} purok / phase records</span>
            <ViewAllButton onClick={openPurokPhaseModal} />
          </div>
        </div>
        {purokPhaseModalOpen && (
          <div className="report-history-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && closePurokPhaseModal()}>
            <div className="report-history-modal" role="dialog" aria-modal="true" aria-labelledby="purok-phase-modal-title">
              <div className="report-history-modal-header">
                <div className="report-history-modal-title-group">
                  <span className="report-history-modal-icon"><ProfileHeaderIcon type="location" /></span>
                  <div>
                    <h4 id="purok-phase-modal-title">Purok / Phase Records</h4>
                    <p>Purok and phase distribution for the selected application cycle.</p>
                  </div>
                </div>
                <div className="d-flex align-items-center gap-3">
                  <button type="button" className="report-records-export-btn" onClick={() => handlePdfExport("/admin/reports/purok-phase/pdf", "applicant-purok-phase")}>Export PDF</button>
                  <button type="button" className="report-history-modal-close" aria-label="Close" onClick={closePurokPhaseModal}>×</button>
                </div>
              </div>
              <div className="report-history-modal-body">
                <div className="row g-4">
                  <div className="col-12 col-md-6">
                    <h6 className="applicant-profile-label mb-3">Phase</h6>
                    {modalPhases.length === 0 ? <div className="applicant-profile-empty">No phase data available.</div> : modalPhases.map((r) => <CategoryBar key={`phase-${r.purok}`} label={formatPurokLabel(r)} count={r.total} percentage={r.percentage} max={maxPhaseCount} />)}
                  </div>
                  <div className="col-12 col-md-6">
                    <h6 className="applicant-profile-label mb-3">Purok</h6>
                    {modalPuroks.length === 0 ? <div className="applicant-profile-empty">No purok data available.</div> : modalPuroks.map((r) => <CategoryBar key={`${r.purok_type}-${r.purok}`} label={formatPurokLabel(r)} count={r.total} percentage={r.percentage} max={maxModalPurokCount} />)}
                  </div>
                </div>
              </div>
              <div className="report-modal-footer">
                <div className="report-modal-footer-top">
                  <span className="report-history-pagination-info">Showing {purokPhaseTotalRecords === 0 ? 0 : purokPhaseStart + 1}–{Math.min(purokPhaseEnd, purokPhaseTotalRecords)} of {purokPhaseTotalRecords} records</span>
                  <div className="report-history-pagination-controls">
                    <button type="button" className="report-history-pagination-arrow" disabled={purokPhasePage === 1} onClick={() => setPurokPhasePage((page) => Math.max(1, page - 1))}>‹</button>
                    {Array.from({ length: purokPhaseTotalPages }, (_, index) => index + 1).map((page) => (
                      <button key={page} type="button" className={`report-history-pagination-page ${page === purokPhasePage ? "report-history-pagination-page-active" : ""}`} onClick={() => setPurokPhasePage(page)}>{page}</button>
                    ))}
                    <button type="button" className="report-history-pagination-arrow" disabled={purokPhasePage === purokPhaseTotalPages} onClick={() => setPurokPhasePage((page) => Math.min(purokPhaseTotalPages, page + 1))}>›</button>
                  </div>
                </div>
                <div className="report-modal-footer-bottom">
                  <button type="button" className="year-age-modal-done-btn" onClick={closePurokPhaseModal}>Close</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }
  return null;
}

export default ApplicantProfileSection;