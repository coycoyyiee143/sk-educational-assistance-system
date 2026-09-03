# app/verification/reg_form.py
from app.extraction import parse_ocr_blocks, get_page_dimensions, extract_school_year
from app.verification.shared import CONFIDENCE_THRESHOLD, _pass, _flag, _check_name, _check_school
from app.upload_checks.document_type_check import check_document_type
from app.upload_checks.image_quality_check import check_image_quality
from app.template_checks import get_template_strategy
from app.template_checks.base_strategy import describe_score


def verify_registration_form(ocr_result, avg_confidence, first_name, middle_name, last_name, declared_school, configured_school_year,
                              image_path=None, *args, **kwargs):
    # Upload check 1: image quality too low to reliably read at all —
    # either OCR itself reported low average confidence, OR a direct
    # Laplacian-variance sharpness measurement flags it as too blurry.
    sharpness_result = check_image_quality(image_path) if image_path else None
    if avg_confidence < CONFIDENCE_THRESHOLD or (sharpness_result and not sharpness_result.passed):
        if sharpness_result and not sharpness_result.passed:
            reason = "Image appears blurry — please retake or rescan with better focus and steady hands."
        else:
            reason = "Image quality too low to read reliably — please retake or rescan with better lighting and focus."
        return {
            "document": "registration_form",
            "low_confidence": True,
            "flagged": True,
            "flag_reason": "auto_reupload",
            "auto_reupload_category": "low_quality",
            "auto_reupload_reason": reason,
        }

    blocks = parse_ocr_blocks(ocr_result)
    page_w, page_h = get_page_dimensions(blocks)

    type_mismatch = check_document_type(blocks, "registration_form", image_path=image_path)
    if type_mismatch:
        return {
            "document": "registration_form",
            "flagged": True,
            "flag_reason": "auto_reupload",
            "auto_reupload_category": "wrong_document_type",
            "auto_reupload_reason": type_mismatch["reason"],
        }

    checks = {
        "identity_match": _check_name(blocks, page_w, page_h, first_name, middle_name, last_name),
        "institution_match": _check_school(blocks, page_w, page_h, declared_school)
    }
    sy_res = extract_school_year(blocks, page_w, page_h, declared_school, configured_school_year)
    if sy_res.found and sy_res.value == configured_school_year:
        checks["school_year_match"] = _pass("school_year_match", extracted=sy_res.raw, raw=sy_res.raw, context=sy_res.context, expected=configured_school_year)
    else:
        # Same reasoning as cert_year_match — a value mismatch is
        # genuinely ambiguous (could be an honest mistake), stays
        # verifier-routed, NOT auto-reupload.
        reason = "School year not found — possible watermark interference, please verify manually" if not sy_res.found else "School year mismatch"
        checks["school_year_match"] = _flag("school_year_match", reason, extracted=sy_res.raw, raw=sy_res.raw, expected=configured_school_year, context=sy_res.context)

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