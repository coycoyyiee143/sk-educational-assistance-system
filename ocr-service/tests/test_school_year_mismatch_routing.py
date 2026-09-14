# tests/test_school_year_mismatch_routing.py
#
# Tests for the confident school-year-mismatch auto-reupload tier added
# to verify_registration_form. Mirrors cert_year_match's treatment on
# voter's certificates (confidence >= 0.9 triggers auto-reupload), but
# gated to a per-school allowlist (Pamantasan ng Cabuyao / University
# of Cabuyao, STI College Calamba) rather than the OCR method field.
#
# An earlier version of this gate used method == "keyword" (an actual
# label was found) instead of a school allowlist. That was WRONG and
# caught during testing: real PNC OCR reads often produce "Academic
# Year 2026-2027" as one continuous block with no colon, which
# extract_via_keyword can't split into label+value at all -- it falls
# through to the blind pattern_scan path even when the real label text
# is genuinely right there. Gating on method would have silently
# excluded the exact real-world case this feature was built for (see
# test_pnc_real_world_case_reproduced_exactly below). The corrected
# gate trusts specific schools' self-anchored regexes directly instead.
#
# See AUTO_REUPLOAD_VERIFICATION_RULES.md for the full per-school
# reasoning.

import pytest
from app.models import OcrBlock
from app.verification.reg_form import verify_registration_form
from app.extraction.school_year import extract_school_year


def block(text, conf=0.95, x=0, y=0, w=300, h=30):
    return OcrBlock(text=text, confidence=conf, x_min=x, y_min=y, x_max=x + w, y_max=y + h)


def make_ocr_result(blocks):
    # parse_ocr_blocks expects each item as [bbox, [text, confidence]],
    # matching PaddleOCR's own raw output shape -- bbox is a list of
    # four [x, y] corner points.
    result = []
    for b in blocks:
        bbox = [[b.x_min, b.y_min], [b.x_max, b.y_min], [b.x_max, b.y_max], [b.x_min, b.y_max]]
        result.append([bbox, [b.text, b.confidence]])
    return result


def make_blocks_with_year_in_top_half(year_line_block):
    # get_page_dimensions computes page height as max(b.y_max) across
    # ALL blocks -- so a block can only land in the "top_half" region
    # extract_school_year's fallback scans if something else defines a
    # bottom edge further down the page than it. A flat, evenly-spaced
    # block list with the target block last would make it always sit
    # exactly at the computed bottom edge, never in the top half,
    # regardless of its actual y value.
    return [
        block("Republic of the Philippines", 0.95, y=0),
        block("Pamantasan ng Cabuyao", 0.95, y=40),
        block("Registration Form", 0.95, y=80),
        block("Name: Juan Dela Cruz", 0.95, y=120),
        year_line_block,
        block("Office of the University Registrar", 0.9, y=800),  # pushes page_h down so the year block above lands in the top half
    ]


def test_pnc_real_world_case_reproduced_exactly():
    # This is the exact scenario that prompted the feature, reproduced
    # end to end through extract_school_year directly (matches the
    # real extracted_value seen in production). Confirms it resolves
    # via pattern_scan, NOT keyword -- proving the method-based gate
    # would have excluded it, and the school-allowlist gate is the
    # correct fix.
    blocks = [block("First Semester,Academic Year 2026-2027", 0.9097)]
    res = extract_school_year(blocks, 1000, 1400, "Pamantasan ng Cabuyao", "2025-2026")
    assert res.method == "pattern_scan"
    assert res.value == "2026-2027"
    assert res.confidence >= 0.9


def test_pnc_confident_mismatch_triggers_auto_reupload_end_to_end():
    # Full path through verify_registration_form itself, not just the
    # extraction layer -- confirms the actual short-circuit fires for
    # the real motivating case.
    blocks = make_blocks_with_year_in_top_half(
        block("First Semester,Academic Year 2026-2027", 0.9097, y=160)
    )
    result = verify_registration_form(
        ocr_result=make_ocr_result(blocks),
        avg_confidence=0.9,
        first_name="Juan", middle_name="", last_name="Dela Cruz",
        declared_school="Pamantasan ng Cabuyao",
        configured_school_year="2025-2026",
    )
    assert result["flag_reason"] == "auto_reupload"
    assert result["auto_reupload_category"] == "wrong_school_year"
    assert "2026-2027" in result["auto_reupload_reason"]
    assert "2025-2026" in result["auto_reupload_reason"]


def test_sti_calamba_confident_mismatch_also_triggers():
    blocks = make_blocks_with_year_in_top_half(
        block("Term Code: 2627/1T", 0.93, y=160)
    )
    result = verify_registration_form(
        ocr_result=make_ocr_result(blocks),
        avg_confidence=0.9,
        first_name="Juan", middle_name="", last_name="Dela Cruz",
        declared_school="STI College Calamba",
        configured_school_year="2025-2026",
    )
    assert result["flag_reason"] == "auto_reupload"
    assert result["auto_reupload_category"] == "wrong_school_year"


def test_pup_confident_mismatch_also_triggers():
    # PUP's real confirmed format: "A.Y.: 2025-2026 TERM: First
    # Semester" -- resolves via method=="keyword" (the colon after
    # "A.Y." makes it cleanly splittable) and the self-anchored
    # two-nearby-years base_strategy regex.
    blocks = make_blocks_with_year_in_top_half(
        block("A.Y.: 2026-2027 TERM: First Semester", 0.93, y=160)
    )
    result = verify_registration_form(
        ocr_result=make_ocr_result(blocks),
        avg_confidence=0.9,
        first_name="Juan", middle_name="", last_name="Dela Cruz",
        declared_school="PUP",
        configured_school_year="2025-2026",
    )
    assert result["flag_reason"] == "auto_reupload"
    assert result["auto_reupload_category"] == "wrong_school_year"


def test_pup_full_name_variant_also_triggers():
    # Both dropdown values ("PUP" and the full name) map to the same
    # strategy -- confirms the allowlist covers both spellings.
    blocks = make_blocks_with_year_in_top_half(
        block("A.Y.: 2026-2027 TERM: First Semester", 0.93, y=160)
    )
    result = verify_registration_form(
        ocr_result=make_ocr_result(blocks),
        avg_confidence=0.9,
        first_name="Juan", middle_name="", last_name="Dela Cruz",
        declared_school="Polytechnic University of the Philippines",
        configured_school_year="2025-2026",
    )
    assert result["flag_reason"] == "auto_reupload"
    assert result["auto_reupload_category"] == "wrong_school_year"


def test_svcc_mismatch_does_not_auto_reupload_stays_verifier_routed():
    # SVCC excluded from the allowlist -- its bare, unanchored regex
    # isn't trustworthy enough for auto-reupload yet. Must stay
    # verifier-routed (eligibility_issues), not auto_reupload.
    blocks = make_blocks_with_year_in_top_half(
        block("School Year: 2026", 0.92, y=160)
    )
    result = verify_registration_form(
        ocr_result=make_ocr_result(blocks),
        avg_confidence=0.9,
        first_name="Juan", middle_name="", last_name="Dela Cruz",
        declared_school="SVCC",
        configured_school_year="2025-2026",
    )
    assert result.get("flag_reason") != "auto_reupload"


def test_correct_matching_year_still_passes_normally():
    blocks = make_blocks_with_year_in_top_half(
        block("Academic Year 2025-2026", 0.95, y=160)
    )
    result = verify_registration_form(
        ocr_result=make_ocr_result(blocks),
        avg_confidence=0.9,
        first_name="Juan", middle_name="", last_name="Dela Cruz",
        declared_school="Pamantasan ng Cabuyao",
        configured_school_year="2025-2026",
    )
    assert result.get("flag_reason") != "auto_reupload"
    assert result["checks"]["school_year_match"]["passed"] is True


def test_low_confidence_mismatch_on_allowlisted_school_stays_verifier_routed():
    blocks = make_blocks_with_year_in_top_half(
        block("Academic Year 2026-2027", 0.5, y=160)
    )
    result = verify_registration_form(
        ocr_result=make_ocr_result(blocks),
        avg_confidence=0.9,
        first_name="Juan", middle_name="", last_name="Dela Cruz",
        declared_school="Pamantasan ng Cabuyao",
        configured_school_year="2025-2026",
    )
    assert result.get("flag_reason") != "auto_reupload"