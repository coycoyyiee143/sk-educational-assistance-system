# app/verification/school_id.py
from app.extraction import parse_ocr_blocks, get_page_dimensions
from app.verification.shared import CONFIDENCE_THRESHOLD, _pass, _flag, _check_name, _check_school
from app.upload_checks.document_type_check import check_document_type
from app.upload_checks.image_quality_check import check_image_quality
from app.normalization import get_strategy_for_school
from app.template_checks import get_template_strategy
from app.template_checks.base_strategy import describe_score


def verify_school_id(ocr_result, avg_confidence, first_name, middle_name, last_name, declared_school,
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
            "document": "school_id",
            "low_confidence": True,
            "flagged": True,
            "flag_reason": "auto_reupload",
            "auto_reupload_category": "low_quality",
            "auto_reupload_reason": reason,
        }

    blocks = parse_ocr_blocks(ocr_result)
    page_w, page_h = get_page_dimensions(blocks)

    type_mismatch = check_document_type(blocks, "school_id", image_path=image_path)
    if type_mismatch:
        return {
            "document": "school_id",
            "flagged": True,
            "flag_reason": "auto_reupload",
            "auto_reupload_category": "wrong_document_type",
            "auto_reupload_reason": type_mismatch["reason"],
        }

    strategy = get_strategy_for_school(declared_school)
    blocks = strategy.preprocess_blocks(blocks)

    name_check = _check_name(blocks, page_w, page_h, first_name, middle_name, last_name)
    institution_check = _check_school(blocks, page_w, page_h, declared_school)
    checks = {
        "identity_match":    name_check,
        "institution_match": institution_check,
    }

    template_strategy = get_template_strategy(declared_school, "school_id")
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
        "document": "school_id",
        "avg_confidence": avg_confidence,
        "checks": checks,
        "flagged": any(not c["passed"] for c in checks.values()),
        "flag_reason": "eligibility_issues" if any(not c["passed"] for c in checks.values()) else None,
    }