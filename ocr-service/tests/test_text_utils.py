# tests/test_text_utils.py
#
# Unit tests for app.normalization.text_utils — pure string normalization
# and fuzzy-matching helpers shared across name/school extraction.

import pytest

from app.normalization.text_utils import (
    clean_text,
    normalize_name,
    fix_ocr_symbols,
    fuzzy_match_name,
    reinsert_name_spacing,
    fuzzy_match_school,
    combine_confidence,
)


# ── clean_text() ─────────────────────────────────────────────────────

def test_clean_text_collapses_whitespace_and_trims():
    assert clean_text("  Juan   Dela   Cruz  ") == "Juan Dela Cruz"


def test_clean_text_collapses_newlines_and_tabs():
    assert clean_text("Juan\n\tDela\tCruz") == "Juan Dela Cruz"


# ── normalize_name() ─────────────────────────────────────────────────

def test_normalize_name_uppercases_and_strips_punctuation():
    assert normalize_name("Juan, Dela Cruz.") == "JUAN DELA CRUZ"


def test_normalize_name_collapses_internal_whitespace():
    assert normalize_name("Juan    Dela  Cruz") == "JUAN DELA CRUZ"


# ── fix_ocr_symbols() ─────────────────────────────────────────────────

def test_fix_ocr_symbols_corrects_ordinal_misreads():
    assert fix_ocr_symbols("Ist Year") == "1st Year"
    assert fix_ocr_symbols("Znd Semester") == "2nd Semester"
    assert fix_ocr_symbols("Zrd Floor") == "3rd Floor"


def test_fix_ocr_symbols_is_case_insensitive():
    assert fix_ocr_symbols("IST year") == "1st year"


def test_fix_ocr_symbols_leaves_unrelated_text_untouched():
    assert fix_ocr_symbols("First Year BSIT") == "First Year BSIT"


# ── fuzzy_match_name() ───────────────────────────────────────────────

def test_fuzzy_match_name_exact_match_passes():
    result = fuzzy_match_name("Juan Reyes Dela Cruz", "Juan", "Reyes", "Dela Cruz")
    assert result["passed"] is True
    assert result["score"] == pytest.approx(100.0)


def test_fuzzy_match_name_reordered_surname_first_passes():
    result = fuzzy_match_name("Dela Cruz, Juan Reyes", "Juan", "Reyes", "Dela Cruz")
    assert result["passed"] is True


def test_fuzzy_match_name_middle_initial_only_passes():
    result = fuzzy_match_name("Juan R. Dela Cruz", "Juan", "Reyes", "Dela Cruz")
    assert result["passed"] is True


def test_fuzzy_match_name_no_middle_name_given_still_matches():
    result = fuzzy_match_name("Juan Dela Cruz", "Juan", "", "Dela Cruz")
    assert result["passed"] is True


def test_fuzzy_match_name_empty_extracted_fails():
    result = fuzzy_match_name("", "Juan", "Reyes", "Dela Cruz")
    assert result == {"score": 0, "passed": False}


def test_fuzzy_match_name_none_extracted_fails():
    result = fuzzy_match_name(None, "Juan", "Reyes", "Dela Cruz")
    assert result == {"score": 0, "passed": False}


def test_fuzzy_match_name_completely_different_name_fails():
    result = fuzzy_match_name("Pedro Santos Garcia", "Juan", "Reyes", "Dela Cruz")
    assert result["passed"] is False


def test_fuzzy_match_name_requires_both_first_and_last_present_independently():
    # High aggregate similarity isn't enough -- first AND last name must
    # each independently appear as a strong substring match (the
    # identity-bypass guard).
    result = fuzzy_match_name("Juan Reyes Santos", "Juan", "Reyes", "Dela Cruz")
    assert result["passed"] is False


def test_fuzzy_match_name_custom_threshold():
    result = fuzzy_match_name("Juann Dela Cruz", "Juan", "Reyes", "Dela Cruz", threshold=99)
    assert result["passed"] is False


# ── reinsert_name_spacing() ─────────────────────────────────────────────

def test_reinsert_name_spacing_already_spaced_left_untouched():
    raw = "Juan Dela Cruz"
    assert reinsert_name_spacing(raw, "Juan", "", "Dela Cruz") == raw


def test_reinsert_name_spacing_splits_glued_first_last():
    result = reinsert_name_spacing("JUANDELACRUZ", "Juan", "", "Dela Cruz")
    assert result == "JUAN DELA CRUZ"


def test_reinsert_name_spacing_empty_string_returns_as_is():
    assert reinsert_name_spacing("", "Juan", "", "Dela Cruz") == ""


def test_reinsert_name_spacing_none_returns_as_is():
    assert reinsert_name_spacing(None, "Juan", "", "Dela Cruz") is None


def test_reinsert_name_spacing_no_alignment_leaves_raw_untouched():
    # letters don't line up with any candidate arrangement (different
    # person entirely) -- no confident guess, raw kept as-is
    result = reinsert_name_spacing("PEDROSANTOSGARCIA", "Juan", "", "Dela Cruz")
    assert result == "PEDROSANTOSGARCIA"


# ── fuzzy_match_school() ────────────────────────────────────────────────

def test_fuzzy_match_school_exact_match_passes():
    result = fuzzy_match_school("Pamantasan ng Cabuyao", "Pamantasan ng Cabuyao")
    assert result["passed"] is True


def test_fuzzy_match_school_single_word_substring_rejected():
    # guards against a bare generic institutional word (shared across many
    # schools) matching as a perfect substring
    result = fuzzy_match_school("Pamantasan", "Pamantasan ng Cabuyao")
    assert result["passed"] is False
    assert result["score"] == 0


def test_fuzzy_match_school_minor_ocr_typo_still_passes():
    result = fuzzy_match_school("Pamantasan ng Cabupao", "Pamantasan ng Cabuyao")
    assert result["passed"] is True


def test_fuzzy_match_school_empty_extracted_fails():
    assert fuzzy_match_school("", "Pamantasan ng Cabuyao") == {"score": 0, "passed": False}


def test_fuzzy_match_school_empty_expected_fails():
    assert fuzzy_match_school("Pamantasan ng Cabuyao", "") == {"score": 0, "passed": False}


def test_fuzzy_match_school_completely_different_school_fails():
    result = fuzzy_match_school("St. Vincent College of Cabuyao", "Pamantasan ng Cabuyao")
    assert result["passed"] is False


# ── combine_confidence() ────────────────────────────────────────────────

def test_combine_confidence_weights_as_documented():
    # 0.4 * ocr + 0.6 * (similarity/100)
    result = combine_confidence(1.0, 100.0)
    assert result == pytest.approx(1.0)


def test_combine_confidence_zero_inputs():
    assert combine_confidence(0.0, 0.0) == pytest.approx(0.0)


def test_combine_confidence_mixed_values():
    result = combine_confidence(0.5, 90.0)
    expected = round((0.5 * 0.4) + (0.9 * 0.6), 4)
    assert result == pytest.approx(expected)


def test_combine_confidence_custom_weights():
    result = combine_confidence(0.8, 80.0, weight_ocr=0.5, weight_similarity=0.5)
    expected = round((0.8 * 0.5) + (0.8 * 0.5), 4)
    assert result == pytest.approx(expected)
