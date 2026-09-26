# tests/test_institution_mismatch_routing.py
#
# Tests for the confident institution-mismatch auto-reupload tier added
# to _check_school_or_reupload. Mirrors test_name_mismatch_routing.py's
# structure -- these are unit tests against the DECISION logic (confident
# different-school mismatch vs. ambiguous vs. pass), built from hand-made
# OcrBlock objects rather than real PaddleOCR output.
#
# Deliberately does NOT add a "nothing found at all" auto-reupload tier
# the way name has name_not_detected -- see
# test_no_confident_match_stays_ambiguous_not_auto_reupload below, which
# reproduces the real motivating case (a genuinely ambiguous OCR misread)
# that must keep going to a verifier.

import pytest
from app.models import OcrBlock
from app.verification.shared import (
    _check_school_or_reupload,
    CONFIDENT_MISMATCH_THRESHOLD,
)

PAGE_W, PAGE_H = 1000.0, 1400.0


def make_block(text, confidence, x=100, y=100, w=400, h=30):
    return OcrBlock(text=text, confidence=confidence, x_min=x, y_min=y, x_max=x + w, y_max=y + h)


def test_confident_match_passes():
    blocks = [make_block("Polytechnic University of the Philippines", 0.95)]
    tag, result = _check_school_or_reupload(blocks, PAGE_W, PAGE_H, "Polytechnic University of the Philippines")
    assert tag == "check"
    assert result["passed"] is True


def test_expected_display_override_replaces_declared_school_in_result():
    # school_id.py passes STI's shorter card-printed form ("STI Calamba")
    # as expected_display, since the actual ID never prints "College" --
    # showing the full declared name next to a genuinely correct match
    # would read as a mismatch to a verifier. Only the DISPLAYED expected
    # value should change; matching itself still runs against the full
    # declared name.
    blocks = [make_block("STI", 0.95), make_block("CALAMBA", 0.95, y=140)]
    tag, result = _check_school_or_reupload(
        blocks, PAGE_W, PAGE_H, "STI College Calamba", expected_display="STI Calamba",
    )
    assert tag == "check"
    assert result["passed"] is True
    assert result["expected"] == "STI Calamba"


def test_confident_different_school_triggers_auto_reupload():
    # Declared school is PUP, but the page's header confidently reads as
    # a DIFFERENT known, registered school at high OCR confidence.
    blocks = [make_block("Pamantasan ng Cabuyao", 0.95)]
    tag, result = _check_school_or_reupload(blocks, PAGE_W, PAGE_H, "Polytechnic University of the Philippines")
    assert tag == "auto_reupload"
    assert result["category"] == "institution_mismatch"
    assert "reason" in result and len(result["reason"]) > 0


def test_low_confidence_different_school_stays_ambiguous():
    # Same different-school text, genuinely passes its own fuzzy-match
    # threshold, but the OCR read itself was weak -- the BLENDED
    # confidence (40% OCR + 60% similarity) lands below
    # CONFIDENT_MISMATCH_THRESHOLD even though similarity alone is high.
    # Must NOT auto-reupload; could be a bad scan of the right document.
    blocks = [make_block("Pamantasan ng Cabuyao", 0.3)]
    tag, result = _check_school_or_reupload(blocks, PAGE_W, PAGE_H, "Polytechnic University of the Philippines")
    assert tag == "check"
    assert result["passed"] is False


def test_no_confident_match_stays_ambiguous_not_auto_reupload():
    # Regression test for the real motivating case: a UPHSD Registration
    # Form whose header OCR'd as "CALAMBA SOUTHERN UNIVERSITY" -- high
    # confidence, but not a confident match to any KNOWN school (declared
    # or otherwise), and not "nothing at all" either. The system can't
    # tell a misread of the right document from an actually-wrong upload
    # here, so this must stay verifier-routed, never auto-reupload.
    blocks = [
        make_block("CALAMBA SOUTHERN UNIVERSITY", 0.996),
        make_block("The Perpetualite: Called to Perfection", 0.97),
    ]
    tag, result = _check_school_or_reupload(
        blocks, PAGE_W, PAGE_H, "University of Perpetual Help System DALTA"
    )
    assert tag == "check"
    assert result["passed"] is False


def test_confident_mismatch_threshold_is_inclusive_boundary():
    # Right at the threshold should still count as confident (>=, not >).
    # combine_confidence(ocr, 100) = ocr*0.4 + 1.0*0.6, so solving for the
    # OCR confidence that makes the blend land exactly on the threshold:
    # ocr = (CONFIDENT_MISMATCH_THRESHOLD - 0.6) / 0.4
    ocr_confidence = (CONFIDENT_MISMATCH_THRESHOLD - 0.6) / 0.4
    blocks = [make_block("Pamantasan ng Cabuyao", ocr_confidence)]
    tag, result = _check_school_or_reupload(blocks, PAGE_W, PAGE_H, "Polytechnic University of the Philippines")
    assert tag == "auto_reupload"
