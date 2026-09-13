# app/verification/reg_form.py
from app.extraction import parse_ocr_blocks, get_page_dimensions, extract_school_year
from app.verification.shared import CONFIDENCE_THRESHOLD, RAW_FIELD_CONFIDENCE_FLOOR, _pass, _flag, _check_name_or_reupload, _check_school
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

    # Confident name mismatch: a "Name" field was found and read
    # reliably, but it isn't this applicant — most likely an honest
    # mistaken upload. Short-circuits the same way as wrong_document_type
    # above, BEFORE building the rest of the checks dict, so the
    # applicant gets one clear reupload prompt instead of a full
    # eligibility_issues report on a document that isn't even theirs.
    name_tag, name_result = _check_name_or_reupload(blocks, page_w, page_h, first_name, middle_name, last_name)
    if name_tag == "auto_reupload":
        return {
            "document": "registration_form",
            "flagged": True,
            "flag_reason": "auto_reupload",
            "auto_reupload_category": name_result["category"],
            "auto_reupload_reason": name_result["reason"],
        }

    checks = {
        "identity_match": name_result,
        "institution_match": _check_school(blocks, page_w, page_h, declared_school)
    }

    sy_res = extract_school_year(blocks, page_w, page_h, declared_school, configured_school_year)

    # Confident school-year mismatch: short-circuits the same way as
    # wrong_cert_year on the voter's certificate. Gated to schools whose
    # per-school extraction regex is self-anchored to an actual
    # phrase/format, not schools relying on a bare, unanchored number
    # match.
    #
    # IMPORTANT: this is NOT gated on ExtractionResult.method
    # ("keyword" vs "pattern_scan") -- that was tried first and found to
    # be wrong. Real PNC OCR reads often produce "Academic Year
    # 2026-2027" as ONE block with no colon and no separate adjacent
    # value block, so extract_via_keyword can't parse a label/value
    # split out of it at all -- it falls through to the blind top_half
    # scan (method == "pattern_scan") even when the actual label text
    # genuinely is right there. Gating on method would have silently
    # excluded this exact real-world case. What actually makes a match
    # trustworthy here is the PER-SCHOOL REGEX itself:
    #   - PNC/University of Cabuyao: r"academic\s*year\s*(\d{4})-(\d{4})"
    #     requires the literal phrase immediately before the numbers.
    #   - STI College Calamba: r"(\d{2})(\d{2})\s*/\s*([12])t" requires
    #     the specific term-code format.
    # Both are self-validating regardless of which OCR block or
    # detection path found them. SVCC's regex (bare r"\b(20\d{2})\b",
    # no phrase anchor at all) and PUP/UPHSD's base_strategy fallback
    # are excluded until independently verified -- see
    # AUTO_REUPLOAD_VERIFICATION_RULES.md for the school-by-school
    # reasoning and a separately-found bug in the base_strategy hint
    # parameter that affects PUP/UPHSD.
    # PUP added after confirming its real format ("A.Y.: 2025-2026
    # TERM: First Semester") resolves via method=="keyword" (the colon
    # after "A.Y." lets extract_via_keyword cleanly split label from
    # value, unlike PNC's colonless "Academic Year 2026-2027") AND
    # hits base_strategy's self-anchored two-nearby-years regex --
    # genuinely trustworthy, not just assumed. See
    # AUTO_REUPLOAD_VERIFICATION_RULES.md.
    _SCHOOL_YEAR_AUTO_REUPLOAD_SCHOOLS = {
        "Pamantasan ng Cabuyao", "University of Cabuyao", "STI College Calamba",
        "Polytechnic University of the Philippines", "PUP",
    }
    if (
        declared_school in _SCHOOL_YEAR_AUTO_REUPLOAD_SCHOOLS
        and sy_res.found
        and sy_res.value != configured_school_year
        and sy_res.confidence >= 0.9
    ):
        return {
            "document": "registration_form",
            "flagged": True,
            "flag_reason": "auto_reupload",
            "auto_reupload_category": "wrong_school_year",
            "auto_reupload_reason": f"The registration form you uploaded shows school year {sy_res.value}, but this cycle requires {configured_school_year}. Please upload a registration form for the correct school year.",
        }

    if sy_res.found and sy_res.value == configured_school_year and sy_res.confidence >= RAW_FIELD_CONFIDENCE_FLOOR:
        checks["school_year_match"] = _pass("school_year_match", extracted=sy_res.raw, raw=sy_res.raw, context=sy_res.context, expected=configured_school_year)
    elif sy_res.found and sy_res.value == configured_school_year:
        # Text matched, but the OCR read behind it was too weak to trust
        # outright — could be a coincidental/lucky partial read on a
        # genuinely blurry field. Route to a verifier instead of
        # auto-passing.
        checks["school_year_match"] = _flag(
            "school_year_match",
            f"School year matched, but the OCR read itself was low-confidence ({sy_res.confidence:.2f}) — please verify manually.",
            extracted=sy_res.raw, raw=sy_res.raw, expected=configured_school_year, context=sy_res.context,
        )
    else:
        # Reachable here for: not found at all, a mismatch on a school
        # not in the auto-reupload allowlist above, or below the 0.9
        # confidence bar even on an allowlisted school. Genuinely
        # ambiguous either way — stays verifier-routed, not auto-reupload.
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