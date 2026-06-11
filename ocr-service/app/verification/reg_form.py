# app/verification/reg_form.py
from app.postprocessing import parse_ocr_blocks, get_page_dimensions, extract_school_year, extract_semester
from app.verification.shared import CONFIDENCE_THRESHOLD, _pass, _flag, _check_name, _check_school

def verify_registration_form(ocr_result, avg_confidence, first_name, middle_name, last_name, declared_school, configured_school_year, configured_semester):
    if avg_confidence < CONFIDENCE_THRESHOLD:
        return {"document": "registration_form", "low_confidence": True, "flagged": True}

    blocks = parse_ocr_blocks(ocr_result)
    page_w, page_h = get_page_dimensions(blocks)
    checks = [
        _check_name(blocks, page_w, page_h, first_name, middle_name, last_name),
        _check_school(blocks, page_w, page_h, declared_school)
    ]

    sy_res = extract_school_year(blocks, page_w, page_h, declared_school, configured_school_year)
    if sy_res.found and sy_res.value == configured_school_year:
        checks.append(_pass("school_year_match", extracted=sy_res.value, raw=sy_res.raw, context=sy_res.context))
    else:
        reason = "School year not found — possible watermark interference, please verify manually" if not sy_res.found else "School year mismatch"
        checks.append(_flag("school_year_match", reason, extracted=sy_res.value, raw=sy_res.raw, expected=configured_school_year, context=sy_res.context))

    sem_res = extract_semester(blocks, page_w, page_h, declared_school)
    if sem_res.found and sem_res.value == configured_semester:
        checks.append(_pass("semester_match", extracted=sem_res.value, raw=sem_res.raw, context=sem_res.context))
    else:
        reason = "Semester not found — possible watermark interference, please verify manually" if not sem_res.found else "Semester mismatch"
        checks.append(_flag("semester_match", reason, extracted=sem_res.value, raw=sem_res.raw, expected=configured_semester, context=sem_res.context))

    return {
        "document": "registration_form",
        "avg_confidence": avg_confidence,
        "checks": checks,
        "flagged": any(not c["passed"] for c in checks),
        "flag_reason": "eligibility_issues" if any(not c["passed"] for c in checks) else None
    }