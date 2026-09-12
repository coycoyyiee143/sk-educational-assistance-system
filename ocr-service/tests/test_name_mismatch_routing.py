# tests/test_name_mismatch_routing.py
#
# NOTE: ocr-service doesn't currently have a pytest suite -- the
# existing test_*.py files at the repo root (test_blur.py,
# test_template.py, etc.) are manual scripts with hardcoded sample
# data, not assertions run by a test runner. This file introduces
# pytest for the OCR service. Run with `pytest` from ocr-service/
# after `pip install pytest --break-system-packages` in that venv.
#
# These are unit tests against shared._check_name_or_reupload directly
# -- they build OcrBlock objects by hand rather than running real
# PaddleOCR, so they test the DECISION logic (confident mismatch vs.
# ambiguous vs. pass), not OCR accuracy itself.

import pytest
from app.models import OcrBlock
from app.verification.shared import (
    _check_name_or_reupload,
    CONFIDENT_MISMATCH_THRESHOLD,
    NAME_SCHOOL_CONFIDENCE_FLOOR,
)

PAGE_W, PAGE_H = 1000.0, 1400.0


def make_block(text, confidence, x=100, y=100, w=300, h=30):
    return OcrBlock(text=text, confidence=confidence, x_min=x, y_min=y, x_max=x + w, y_max=y + h)


def test_confident_match_passes():
    # "Name:" label immediately followed inline by the applicant's own
    # name, read with high confidence.
    blocks = [make_block("Name: Juan Dela Cruz", 0.95)]
    tag, result = _check_name_or_reupload(blocks, PAGE_W, PAGE_H, "Juan", "", "Dela Cruz")
    assert tag == "check"
    assert result["passed"] is True


def test_confident_mismatch_triggers_auto_reupload():
    # "Name:" label found, read with high confidence, but it's clearly
    # someone else's name -- no amount of fallback scanning elsewhere
    # on the page will find "Juan Dela Cruz" here.
    blocks = [make_block("Name: Maria Santos", 0.95)]
    tag, result = _check_name_or_reupload(blocks, PAGE_W, PAGE_H, "Juan", "", "Dela Cruz")
    assert tag == "auto_reupload"
    assert result["category"] == "name_mismatch"
    assert "reason" in result and len(result["reason"]) > 0


def test_low_confidence_label_mismatch_stays_ambiguous():
    # Same wrong-looking name, but the OCR read of that label/value was
    # weak -- could be a bad scan of the applicant's real document,
    # not proof it's the wrong one. Must NOT auto-reupload.
    blocks = [make_block("Name: Maria Santos", CONFIDENT_MISMATCH_THRESHOLD - 0.1)]
    tag, result = _check_name_or_reupload(blocks, PAGE_W, PAGE_H, "Juan", "", "Dela Cruz")
    assert tag == "check"
    assert result["passed"] is False


def test_no_name_label_at_all_stays_ambiguous():
    # No "Name" field anywhere on the document -- genuinely nothing to
    # be confident about either way.
    blocks = [make_block("Republic of the Philippines", 0.95),
              make_block("Some unrelated form text", 0.9)]
    tag, result = _check_name_or_reupload(blocks, PAGE_W, PAGE_H, "Juan", "", "Dela Cruz")
    assert tag == "check"
    assert result["passed"] is False


def test_confident_mismatch_threshold_is_inclusive_boundary():
    # Right at the threshold should still count as confident (>=, not >).
    blocks = [make_block("Name: Maria Santos", CONFIDENT_MISMATCH_THRESHOLD)]
    tag, result = _check_name_or_reupload(blocks, PAGE_W, PAGE_H, "Juan", "", "Dela Cruz")
    assert tag == "auto_reupload"


def test_guardian_name_uses_same_function_same_rules():
    # voters_cert.py passes guardian names into this same function for
    # minor applicants -- confirms it works identically regardless of
    # whose name is being checked.
    blocks = [make_block("Name of Voter: Pedro Reyes", 0.95)]
    tag, result = _check_name_or_reupload(blocks, PAGE_W, PAGE_H, "Elena", "", "Santos")
    assert tag == "auto_reupload"
    assert result["category"] == "name_mismatch"


def test_typo_level_difference_does_not_auto_reupload():
    # A 1-letter OCR misread ("Juab" instead of "Juan") should still
    # pass via the existing fuzzy-match tolerance (>=85 similarity) --
    # this new tier only fires when NO fallback strategy finds the
    # applicant's name anywhere on the page at all, not on a near-miss.
    blocks = [make_block("Name: Juab Dela Cruz", 0.95)]
    tag, result = _check_name_or_reupload(blocks, PAGE_W, PAGE_H, "Juan", "", "Dela Cruz")
    assert tag == "check"
    assert result["passed"] is True