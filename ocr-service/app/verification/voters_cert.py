# app/verification/voters_cert.py
from app.extraction import parse_ocr_blocks, get_page_dimensions, extract_barangay, extract_cert_year
from app.verification.shared import CONFIDENCE_THRESHOLD, RAW_FIELD_CONFIDENCE_FLOOR, _pass, _flag, _check_name
from app.upload_checks.document_type_check import check_document_type
from app.upload_checks.image_quality_check import check_image_quality
from app.template_checks import get_template_strategy
from app.template_checks.base_strategy import describe_score

def verify_voters_certificate(ocr_result, avg_confidence, first_name, middle_name, last_name,
                               enforce_cert_year=False, configured_cert_year=None,
                               is_minor=False,
                               guardian_first_name=None, guardian_middle_name=None, guardian_last_name=None,
                               declared_school=None,
                               image_path=None,
                               *args, **kwargs):
    
    # Upload check 1: image quality too low to reliably read at all —
    # either OCR itself reported low average confidence, OR a direct
    # Laplacian-variance sharpness measurement flags it as too blurry.
    # Either signal alone is enough to trigger; they catch overlapping
    # but not identical cases (bad lighting/angle vs. genuine blur).
    sharpness_result = check_image_quality(image_path) if image_path else None
    if avg_confidence < CONFIDENCE_THRESHOLD or (sharpness_result and not sharpness_result.passed):
        if sharpness_result and not sharpness_result.passed:
            reason = "Image appears blurry — please retake or rescan with better focus and steady hands."
        else:
            reason = "Image quality too low to read reliably — please retake or rescan with better lighting and focus."
        return {
            "document": "voters_certificate",
            "low_confidence": True,
            "flagged": True,
            "flag_reason": "auto_reupload",
            "auto_reupload_category": "low_quality",
            "auto_reupload_reason": reason,
        }

    blocks = parse_ocr_blocks(ocr_result)
    page_w, page_h = get_page_dimensions(blocks)

    # Upload check 2: wrong document type entirely.
    type_mismatch = check_document_type(blocks, "voters_certificate", image_path=image_path)
    if type_mismatch:
        return {
            "document": "voters_certificate",
            "flagged": True,
            "flag_reason": "auto_reupload",
            "auto_reupload_category": "wrong_document_type",
            "auto_reupload_reason": type_mismatch["reason"],
        }

    # Upload check 3: certificate year clearly, confidently wrong —
    # checked BEFORE the rest of the field extraction below, since this
    # is unambiguous enough to short-circuit the same way as a type
    # mismatch. Only fires when the OCR read is confident (>=90%); a
    # low-confidence or entirely-not-found year stays verifier-routed
    # further down, since that's genuinely ambiguous, not a clear-cut
    # "system is certain" case. Registration Form's school_year_match
    # deliberately does NOT get this same treatment — its extraction
    # involves interpreting multiple format variants and is documented
    # as watermark-interference-prone, so a confident-looking read there
    # is less trustworthy than it is here.
    if enforce_cert_year and configured_cert_year:
        cert_year_res = extract_cert_year(blocks)
        if cert_year_res.found and cert_year_res.value != str(configured_cert_year) and cert_year_res.confidence >= 0.9:
            return {
                "document": "voters_certificate",
                "flagged": True,
                "flag_reason": "auto_reupload",
                "auto_reupload_category": "wrong_cert_year",
                "auto_reupload_reason": f"The Voter's Certificate you uploaded shows {cert_year_res.value}, but this cycle requires {configured_cert_year}. Please request a current certificate from COMELEC and upload it here.",
            }

    # Full verification below.
    if is_minor:
        if not (guardian_first_name and guardian_last_name):
            checks = {
                "identity_match": _flag(
                    "identity_match",
                    "Applicant is a minor but no guardian name is on file — please complete guardian information in your profile.",
                    expected=None,
                )
            }
        else:
            name_check = _check_name(blocks, page_w, page_h, guardian_first_name, guardian_middle_name or "", guardian_last_name)
            checks = {"identity_match": name_check}
    else:
        name_check = _check_name(blocks, page_w, page_h, first_name, middle_name, last_name)
        checks = {"identity_match": name_check}

    brgy_res = extract_barangay(blocks)
    if brgy_res.found and brgy_res.value == "Mamatid" and brgy_res.confidence >= RAW_FIELD_CONFIDENCE_FLOOR:
        residency_check = _pass("residency_geofence", extracted=brgy_res.value, raw=brgy_res.raw, context=brgy_res.context, expected="Mamatid")
    elif brgy_res.found and brgy_res.value == "Mamatid":
        # Matched "Mamatid" by text, but the OCR read was weak — this is
        # a residency-eligibility gate, worth a human look rather than
        # trusting a shaky read outright.
        residency_check = _flag(
            "residency_geofence",
            f"Barangay matched Mamatid, but the OCR read itself was low-confidence ({brgy_res.confidence:.2f}) — please verify manually.",
            extracted=brgy_res.value, raw=brgy_res.raw, expected="Mamatid", context=brgy_res.context,
        )
    else:
        reason = brgy_res.context if brgy_res.context else "Barangay Mamatid not found in document"
        residency_check = _flag("residency_geofence", reason, extracted=brgy_res.value, raw=brgy_res.raw, expected="Mamatid", context=brgy_res.context, metadata=brgy_res.metadata)

    checks["residency_geofence"] = residency_check

    cert_year_res = extract_cert_year(blocks)
    cert_year_display = cert_year_res.value if cert_year_res.found else None

    if enforce_cert_year and configured_cert_year:
        if cert_year_res.found and cert_year_res.value == str(configured_cert_year) and cert_year_res.confidence >= RAW_FIELD_CONFIDENCE_FLOOR:
            checks["cert_year_match"] = _pass("cert_year_match", extracted=cert_year_res.value, raw=cert_year_res.raw, context=cert_year_res.context, expected=str(configured_cert_year))
        elif cert_year_res.found and cert_year_res.value == str(configured_cert_year):
            checks["cert_year_match"] = _flag(
                "cert_year_match",
                f"Certificate year matched, but the OCR read itself was low-confidence ({cert_year_res.confidence:.2f}) — please verify manually.",
                extracted=cert_year_res.value, raw=cert_year_res.raw, expected=str(configured_cert_year), context=cert_year_res.context,
            )
        else:
            # Only reachable here for the LOW-confidence/not-found case —
            # the high-confidence mismatch already short-circuited above.
            reason = "Certificate year not found — please verify manually" if not cert_year_res.found else "Certificate year does not match current cycle (low confidence read — please verify manually)"
            checks["cert_year_match"] = _flag("cert_year_match", reason, extracted=cert_year_res.value, raw=cert_year_res.raw, expected=str(configured_cert_year), context=cert_year_res.context)

    template_strategy = get_template_strategy(declared_school, "voters_certificate")
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
        "document":            "voters_certificate",
        "avg_confidence":      avg_confidence,
        "checks":              checks,
        "cert_year_extracted": cert_year_display,
        "is_minor":            is_minor,
        "flagged":             any(not c["passed"] for c in checks.values()),
        "flag_reason":         "eligibility_issues" if any(not c["passed"] for c in checks.values()) else None,
    }