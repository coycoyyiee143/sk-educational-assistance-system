# app/verification/reg_form.py
from app.extraction import parse_ocr_blocks, get_page_dimensions, extract_school_year
from app.verification.shared import CONFIDENCE_THRESHOLD, RAW_FIELD_CONFIDENCE_FLOOR, _pass, _flag, _check_name_or_reupload, _check_school_or_reupload
from app.upload_checks.document_type_check import check_document_type
from app.upload_checks.image_quality_check import check_image_quality
from app.upload_checks.skew_check import check_skew
from app.normalization import get_strategy_for_school
from app.template_checks import get_template_strategy
from app.template_checks.base_strategy import describe_score


def verify_registration_form(ocr_result, avg_confidence, first_name, middle_name, last_name, declared_school, configured_school_year,
                              image_path=None, debug=False, *args, **kwargs):
    # debug=True is for panel/demo use only (see routes.py) -- it keeps
    # every gate BELOW this point from short-circuiting, so the full
    # eligibility checks still run and get returned alongside whatever
    # gate(s) would have auto-rejected the upload in production. Never
    # set by the real applicant-facing upload flow. The blur/skew gate
    # right below is NOT covered by this -- an unreadable image produces
    # meaningless extraction results regardless of debug mode, so it
    # always short-circuits.
    gate_failures = []
    # Upload check 1: image quality too low to reliably read at all —
    # either OCR itself reported low average confidence, OR a direct
    # Laplacian-variance sharpness measurement flags it as too blurry,
    # OR the page is tilted too far to read reliably. Same signals,
    # applied the same way, as School ID and Voter's Certificate — see
    # app/upload_checks/.
    sharpness_result = check_image_quality(image_path) if image_path else None
    skew_result = check_skew(image_path) if image_path else None
    if (
        avg_confidence < CONFIDENCE_THRESHOLD
        or (sharpness_result and not sharpness_result.passed)
        or (skew_result and not skew_result.passed)
    ):
        if sharpness_result and not sharpness_result.passed:
            reason = "Image appears blurry — please retake or rescan with better focus and steady hands."
        elif skew_result and not skew_result.passed:
            reason = "Your document is tilted too much to read reliably — please retake it held flat and facing the camera."
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

    # Apply the same per-school block-merging normalization School ID
    # already gets (see school_id.py) -- e.g. PUP/UPLB/SVCC/UPHSD split
    # their institution header across multiple OCR lines on their School
    # IDs, and Registration Forms print the same institution name in the
    # same style. Previously only School ID called this, so
    # institution_match on a Registration Form from one of these schools
    # fell back entirely on extract_school()'s noisier generic
    # last-resort header_join. Safe to apply unconditionally: it's a
    # no-op for schools with no matching header text on this document.
    strategy = get_strategy_for_school(declared_school)
    blocks = strategy.preprocess_blocks(blocks)

    type_mismatch = check_document_type(blocks, "registration_form", image_path=image_path)
    if type_mismatch:
        gate_result = {
            "document": "registration_form",
            "flagged": True,
            "flag_reason": "auto_reupload",
            "auto_reupload_category": "wrong_document_type",
            "auto_reupload_reason": type_mismatch["reason"],
        }
        if not debug:
            return gate_result
        gate_failures.append(gate_result)

    # Name not detected anywhere on the page at all — same reasoning as
    # School ID and Voter's Cert: even reg form templates that print the
    # name with no "Name:" label still print the name TEXT itself
    # somewhere on the page, and extract_name()'s blind fallback scan
    # looks at every block regardless of whether a label was found. A
    # true zero-match here means something's wrong with the upload
    # (wrong file, cropped, obscured) rather than a genuine eligibility
    # question for a verifier.
    name_tag, name_result = _check_name_or_reupload(blocks, page_w, page_h, first_name, middle_name, last_name)
    if name_tag == "auto_reupload":
        gate_result = {
            "document": "registration_form",
            "flagged": True,
            "flag_reason": "auto_reupload",
            "auto_reupload_category": name_result["category"],
            "auto_reupload_reason": name_result["reason"],
        }
        if not debug:
            return gate_result
        gate_failures.append(gate_result)
        expected_name = f"{first_name} {middle_name} {last_name}".strip()
        name_result = _flag("identity_match", name_result["reason"], expected=expected_name)

    institution_tag, institution_result = _check_school_or_reupload(blocks, page_w, page_h, declared_school)
    if institution_tag == "auto_reupload":
        gate_result = {
            "document": "registration_form",
            "flagged": True,
            "flag_reason": "auto_reupload",
            "auto_reupload_category": institution_result["category"],
            "auto_reupload_reason": institution_result["reason"],
        }
        if not debug:
            return gate_result
        gate_failures.append(gate_result)
        institution_result = _flag("institution_match", institution_result["reason"], expected=declared_school)

    checks = {
        "identity_match": name_result,
        "institution_match": institution_result,
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
        gate_result = {
            "document": "registration_form",
            "flagged": True,
            "flag_reason": "auto_reupload",
            "auto_reupload_category": "wrong_school_year",
            "auto_reupload_reason": f"The registration form you uploaded shows school year {sy_res.value}, but this cycle requires {configured_school_year}. Please upload a registration form for the correct school year.",
        }
        if not debug:
            return gate_result
        gate_failures.append(gate_result)

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
        if not sy_res.found:
            reason = "School year not found — possible watermark interference, please verify manually."
        elif sy_res.confidence >= RAW_FIELD_CONFIDENCE_FLOOR:
            # Confident read, but it genuinely isn't the configured cycle —
            # say what was actually detected, same as cert_year_match/
            # school_match, instead of a bare "mismatch".
            reason = f"Detected school year is {sy_res.value}, but this cycle requires {configured_school_year}."
        else:
            reason = f"Detected school year appears to be {sy_res.value} (low-confidence read, {sy_res.confidence:.2f}) — please verify manually against the required {configured_school_year}."
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

    has_check_failure = any(not c["passed"] for c in checks.values())
    result = {
        "document": "registration_form",
        "avg_confidence": avg_confidence,
        "checks": checks,
        "flagged": has_check_failure or bool(gate_failures),
        "flag_reason": "eligibility_issues" if has_check_failure else ("would_auto_reupload" if gate_failures else None),
    }
    if gate_failures:
        result["would_auto_reupload"] = gate_failures
    return result