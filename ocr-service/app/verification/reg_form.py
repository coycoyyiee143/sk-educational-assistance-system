from app.extraction import parse_ocr_blocks, get_page_dimensions, extract_school_year
from app.verification.shared import CONFIDENCE_THRESHOLD, _pass, _flag, _check_name, _check_school
from app.template_checks import get_template_strategy
from app.template_checks.base_strategy import describe_score


def verify_registration_form(ocr_result, avg_confidence, first_name, middle_name, last_name, declared_school, configured_school_year, *args, **kwargs):
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

    # Template/layout consistency check — a lightweight forgery-prevention
    # signal, separate from identity/school/year field extraction above.
    # This does NOT confirm authenticity; it flags documents whose layout
    # deviates from the expected format for manual verifier review.
    template_strategy = get_template_strategy(declared_school, "registration_form")
    template_result = template_strategy.check(blocks)
    description = describe_score(template_result.score)

    if template_result.passed:
        checks["template_consistency"] = _pass("template_consistency", extracted=description, score=template_result.score)
    else:
        checks["template_consistency"] = _flag(
            "template_consistency",
            "; ".join(template_result.flags),
            extracted=description,
            score=template_result.score,
        )

    return {
        "document": "registration_form",
        "avg_confidence": avg_confidence,
        "checks": checks,
        "flagged": any(not c["passed"] for c in checks.values()),
        "flag_reason": "eligibility_issues" if any(not c["passed"] for c in checks.values()) else None
    }