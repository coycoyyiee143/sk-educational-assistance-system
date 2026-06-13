from app.postprocessing import parse_ocr_blocks, get_page_dimensions, extract_barangay
from app.verification.shared import CONFIDENCE_THRESHOLD, _pass, _flag, _check_name

def verify_voters_certificate(ocr_result, avg_confidence, first_name, middle_name, last_name, *args, **kwargs):
    if avg_confidence < CONFIDENCE_THRESHOLD:
        return {"document": "voters_certificate", "low_confidence": True, "flagged": True}

    blocks = parse_ocr_blocks(ocr_result)
    page_w, page_h = get_page_dimensions(blocks)

    # Name check
    name_check = _check_name(blocks, page_w, page_h, first_name, middle_name, last_name)

    # Barangay check
    brgy_res = extract_barangay(blocks)
    if brgy_res.found and brgy_res.value == "Mamatid":
        residency_check = _pass("residency_geofence", extracted=brgy_res.value, raw=brgy_res.raw, context=brgy_res.context, expected="Mamatid")
    else:
        reason = brgy_res.context if brgy_res.context else "Barangay Mamatid not found in document"
        residency_check = _flag("residency_geofence", reason, extracted=brgy_res.value, raw=brgy_res.raw, expected="Mamatid", context=brgy_res.context)

    checks = {
        "identity_match":        name_check,
        "residency_geofence":    residency_check,
    }

    return {
        "document":    "voters_certificate",
        "avg_confidence": avg_confidence,
        "checks":      checks,
        "flagged":     any(not c["passed"] for c in checks.values()),
        "flag_reason": "eligibility_issues" if any(not c["passed"] for c in checks.values()) else None,
    }