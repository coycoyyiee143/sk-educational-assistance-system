from app.extraction import parse_ocr_blocks, get_page_dimensions, extract_barangay, extract_cert_year
from app.verification.shared import CONFIDENCE_THRESHOLD, _pass, _flag, _check_name

def verify_voters_certificate(ocr_result, avg_confidence, first_name, middle_name, last_name,
                               enforce_cert_year=False, configured_cert_year=None,
                               is_minor=False,
                               guardian_first_name=None, guardian_middle_name=None, guardian_last_name=None,
                               *args, **kwargs):
    if avg_confidence < CONFIDENCE_THRESHOLD:
        return {"document": "voters_certificate", "low_confidence": True, "flagged": True}

    blocks = parse_ocr_blocks(ocr_result)
    page_w, page_h = get_page_dimensions(blocks)

    # For minor applicants, the Voter's Certificate belongs to the parent/
    # guardian on file, not the applicant — so identity_match checks the
    # OCR'd name against the guardian's name from the profile instead of the
    # applicant's own name. This is deliberately kept as a single swap on
    # who we're checking against, not a separate check, so downstream
    # reporting (which document/reason causes flags) stays consistent
    # regardless of applicant age.
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
    if brgy_res.found and brgy_res.value == "Mamatid":
        residency_check = _pass("residency_geofence", extracted=brgy_res.value, raw=brgy_res.raw, context=brgy_res.context, expected="Mamatid")
    else:
        reason = brgy_res.context if brgy_res.context else "Barangay Mamatid not found in document"
        residency_check = _flag("residency_geofence", reason, extracted=brgy_res.value, raw=brgy_res.raw, expected="Mamatid", context=brgy_res.context)

    checks["residency_geofence"] = residency_check

    # Cert year enforced unconditionally, every cycle. Not admin-configurable.
    cert_year_res = extract_cert_year(blocks)
    cert_year_display = cert_year_res.value if cert_year_res.found else None

    if enforce_cert_year and configured_cert_year:
        if cert_year_res.found and cert_year_res.value == str(configured_cert_year):
            checks["cert_year_match"] = _pass("cert_year_match", extracted=cert_year_res.value, raw=cert_year_res.raw, context=cert_year_res.context, expected=str(configured_cert_year))
        else:
            reason = "Certificate year not found — please verify manually" if not cert_year_res.found else "Certificate year does not match current cycle"
            checks["cert_year_match"] = _flag("cert_year_match", reason, extracted=cert_year_res.value, raw=cert_year_res.raw, expected=str(configured_cert_year), context=cert_year_res.context)

    return {
        "document":            "voters_certificate",
        "avg_confidence":      avg_confidence,
        "checks":              checks,
        "cert_year_extracted": cert_year_display,
        "is_minor":            is_minor,
        "flagged":             any(not c["passed"] for c in checks.values()),
        "flag_reason":         "eligibility_issues" if any(not c["passed"] for c in checks.values()) else None,
    }