from app.extraction import parse_ocr_blocks, get_page_dimensions, extract_school_year, extract_semester
from app.verification.shared import CONFIDENCE_THRESHOLD, _pass, _flag, _check_name, _check_school

def verify_registration_form(ocr_result, avg_confidence, first_name, middle_name, last_name, declared_school, configured_school_year, configured_semester, *args, **kwargs):
    if avg_confidence < CONFIDENCE_THRESHOLD:
        return {"document": "registration_form", "low_confidence": True, "flagged": True}

    blocks = parse_ocr_blocks(ocr_result)
    page_w, page_h = get_page_dimensions(blocks)
    
    # Using explicit string keys allows Laravel to save readable names in your verification_checks table
    checks = {
        "identity_match": _check_name(blocks, page_w, page_h, first_name, middle_name, last_name),
        "institution_match": _check_school(blocks, page_w, page_h, declared_school)
    }

    sy_res = extract_school_year(blocks, page_w, page_h, declared_school, configured_school_year)
    if sy_res.found and sy_res.value == configured_school_year:
        checks["school_year_match"] = _pass("school_year_match", extracted=sy_res.raw, raw=sy_res.raw, context=sy_res.context, expected=configured_school_year)
    else:
        reason = "School year not found — possible watermark interference, please verify manually" if not sy_res.found else "School year mismatch"
        checks["school_year_match"] = _flag("school_year_match", reason, extracted=sy_res.raw, raw=sy_res.raw, expected=configured_school_year, context=sy_res.context)

    # Helper to turn "2nd Semester", "Second", or "2" all into just "2"
    def normalize_sem_val(val):
        v = str(val).lower()
        if "2" in v or "second" in v: return "2"
        if "1" in v or "first" in v: return "1"
        return v

    sem_res = extract_semester(blocks, page_w, page_h, declared_school)

    # Normalize both sides before checking equality
    if sem_res.found and normalize_sem_val(sem_res.value) == normalize_sem_val(configured_semester):
        checks["semester_match"] = _pass("semester_match", extracted=sem_res.raw, raw=sem_res.raw, context=sem_res.context, expected=configured_semester)
    else:
        reason = "Semester not found — possible watermark interference, please verify manually" if not sem_res.found else "Semester mismatch"
        checks["semester_match"] = _flag("semester_match", reason, extracted=sem_res.raw, raw=sem_res.raw, expected=configured_semester, context=sem_res.context)
    
    return {
        "document": "registration_form",
        "avg_confidence": avg_confidence,
        "checks": checks,
        "flagged": any(not c["passed"] for c in checks.values()),
        "flag_reason": "eligibility_issues" if any(not c["passed"] for c in checks.values()) else None
    }