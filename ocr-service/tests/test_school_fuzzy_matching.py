# tests/test_school_fuzzy_matching.py
#
# Regression tests for a false-positive bug found in fuzzy_match_school:
# a bare generic institutional word (e.g. "Pamantasan", shared by
# several real Philippine universities -- Pamantasan ng Lungsod ng
# Maynila, ng Pasig, ng Cabuyao, etc.) was scoring a perfect 100 via
# rapidfuzz's partial_ratio against a full expected school name, since
# it's a literal substring. The existing length guard (extracted must
# be at least half of expected's length) didn't catch this for
# "Pamantasan ng Cabuyao" specifically because 10 chars is exactly half
# of its 21-character length -- not strictly less than half, so the
# guard didn't trigger. Fixed by tightening the guard to 0.75 of
# expected's length. See AUTO_REUPLOAD_VERIFICATION_RULES.md.

import pytest
from app.normalization.text_utils import fuzzy_match_school


def test_bare_generic_institutional_word_does_not_pass():
    # The exact reported bug: "Pamantasan" alone must NOT pass against
    # "Pamantasan ng Cabuyao" -- it's a generic word shared by multiple
    # real universities, not a distinguishing match.
    result = fuzzy_match_school("Pamantasan", "Pamantasan ng Cabuyao")
    assert result["passed"] is False


def test_bare_generic_word_does_not_falsely_pass_against_other_schools_either():
    # Same generic-word problem would apply to any other
    # "Pamantasan ng X" school -- confirms this isn't specific to one
    # declared_school value.
    result = fuzzy_match_school("Pamantasan", "Pamantasan ng Lungsod ng Pasig")
    assert result["passed"] is False


def test_full_wrong_school_name_correctly_fails():
    # A genuinely different, complete school name (not just a
    # truncated generic word) must still correctly fail -- this was
    # already working before the fix and must keep working.
    result = fuzzy_match_school("Pamantasan ng Lungsod ng Pasig", "Pamantasan ng Cabuyao")
    assert result["passed"] is False


def test_one_letter_typo_on_full_name_still_passes():
    # The fix must not be so strict it breaks legitimate OCR noise
    # tolerance on an otherwise-complete, correct read.
    result = fuzzy_match_school("Pamantasan ng Cabupao", "Pamantasan ng Cabuyao")
    assert result["passed"] is True


def test_exact_match_passes():
    result = fuzzy_match_school("PAMANTASAN NG CABUYAO", "Pamantasan ng Cabuyao")
    assert result["passed"] is True


def test_legitimate_longer_official_name_variant_still_passes():
    # A genuinely more complete/formal reading of the same school
    # (extra words, not fewer) must not be penalized by the guard --
    # it only blocks reads that are TOO SHORT relative to expected.
    result = fuzzy_match_school("Pamantasan ng Cabuyao University", "Pamantasan ng Cabuyao")
    assert result["passed"] is True