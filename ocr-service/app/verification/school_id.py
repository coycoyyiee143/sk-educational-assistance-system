from app.extraction import parse_ocr_blocks, get_page_dimensions
from app.verification.shared import CONFIDENCE_THRESHOLD, _pass, _flag, _check_name, _check_school
from app.normalization import get_strategy_for_school

def verify_school_id(ocr_result, avg_confidence, first_name, middle_name, last_name, declared_school, *args, **kwargs):
    if avg_confidence < CONFIDENCE_THRESHOLD:
        return {"document": "school_id", "low_confidence": True, "flagged": True}

    blocks = parse_ocr_blocks(ocr_result)
    page_w, page_h = get_page_dimensions(blocks)

    # School-specific pre-merge (e.g. PUP splits its name/institution text
    # across multiple OCR lines). No-op for schools without a custom strategy.
    strategy = get_strategy_for_school(declared_school)
    blocks = strategy.preprocess_blocks(blocks)

    name_check = _check_name(blocks, page_w, page_h, first_name, middle_name, last_name)
    institution_check = _check_school(blocks, page_w, page_h, declared_school)

    checks = {
        "identity_match":    name_check,
        "institution_match": institution_check,
    }

    return {
        "document": "school_id",
        "avg_confidence": avg_confidence,
        "checks": checks,
        "flagged": any(not c["passed"] for c in checks.values()),
        "flag_reason": "eligibility_issues" if any(not c["passed"] for c in checks.values()) else None,
    }