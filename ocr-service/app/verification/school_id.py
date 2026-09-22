# app/verification/school_id.py
from app.extraction import parse_ocr_blocks, get_page_dimensions
from app.verification.shared import CONFIDENCE_THRESHOLD, _pass, _flag, _check_name_or_reupload, _check_school
from app.upload_checks.image_quality_check import check_image_quality
from app.upload_checks.skew_check import check_skew
from app.utils.spatial import get_blocks_in_region
from app.normalization import get_strategy_for_school
from app.template_checks import get_template_strategy
from app.template_checks.base_strategy import describe_score


def verify_school_id(ocr_result, avg_confidence, first_name, middle_name, last_name, declared_school,
                      image_path=None, *args, **kwargs):
    blocks = parse_ocr_blocks(ocr_result)
    page_w, page_h = get_page_dimensions(blocks)

    # Upload check 1: image quality too low to reliably read at all —
    # either OCR itself reported low average confidence, OR a direct
    # Laplacian-variance sharpness measurement flags it as too blurry,
    # OR the institution header specifically read poorly even though the
    # document-wide average looks fine.
    #
    # The whole-document average can stay comfortably high while the
    # header alone was badly misread — confirmed on a real PUP ID: overall
    # avg_confidence 0.835 (pulled up by clean fields like the student
    # number and name at 0.98-1.0), while the header lines themselves sat
    # at 0.63-0.82, producing OCR text like "Polxrsod" for "Polytechnic".
    # institution_match then fails downstream, but that reads to an
    # applicant as an unexplained "school mismatch" rather than the real,
    # fixable problem — the header just needs a clearer photo. Checking
    # the header region's own average confidence catches that specific
    # case and routes it to reupload with an actionable reason instead.
    header_blocks = get_blocks_in_region(blocks, page_w, page_h, "header")
    header_confidence = (
        sum(b.confidence for b in header_blocks) / len(header_blocks)
        if header_blocks else None
    )
    header_too_low = header_confidence is not None and header_confidence < CONFIDENCE_THRESHOLD

    sharpness_result = check_image_quality(image_path) if image_path else None
    skew_result = check_skew(image_path) if image_path else None
    if (
        avg_confidence < CONFIDENCE_THRESHOLD or header_too_low
        or (sharpness_result and not sharpness_result.passed)
        or (skew_result and not skew_result.passed)
    ):
        if sharpness_result and not sharpness_result.passed:
            reason = "Image appears blurry — please retake or rescan with better focus and steady hands."
        elif skew_result and not skew_result.passed:
            reason = "Your ID is tilted too much to read reliably — please retake it held flat and facing the camera."
        elif header_too_low:
            reason = "The school name on your ID wasn't clear enough to read reliably — please retake with better lighting and make sure the top of the ID is in focus."
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

    strategy = get_strategy_for_school(declared_school)
    blocks = strategy.preprocess_blocks(blocks)

    # Name not detected anywhere on the page at all — even School ID
    # layouts that print the name with no "Name:" label still print the
    # name TEXT itself somewhere on the ID, and extract_name()'s blind
    # fallback scan checks every block regardless of whether a label
    # was found. A true zero-match here means something's wrong with
    # the upload itself (wrong file, cropped, obscured) rather than a
    # genuine eligibility question for a verifier. Same treatment as
    # Registration Form and Voter's Certificate — see
    # app/verification/shared.py::_check_name_or_reupload.
    name_tag, name_result = _check_name_or_reupload(blocks, page_w, page_h, first_name, middle_name, last_name)
    if name_tag == "auto_reupload":
        return {
            "document": "school_id",
            "flagged": True,
            "flag_reason": "auto_reupload",
            "auto_reupload_category": name_result["category"],
            "auto_reupload_reason": name_result["reason"],
        }

    institution_check = _check_school(blocks, page_w, page_h, declared_school)
    checks = {
        "identity_match":    name_result,
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