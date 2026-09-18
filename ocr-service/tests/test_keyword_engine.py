# tests/test_keyword_engine.py
#
# Unit tests for app.extraction.keyword_engine — label-block lookup and
# label -> value resolution (inline, right, below, above) used across
# every field extractor.

import pytest

from app.models import OcrBlock
from app.extraction.keyword_engine import find_label_block, extract_via_keyword


def block(text, x_min=0, y_min=0, x_max=100, y_max=20, conf=0.9):
    return OcrBlock(text=text, confidence=conf, x_min=x_min, y_min=y_min, x_max=x_max, y_max=y_max)


# ── find_label_block() ────────────────────────────────────────────────

def test_find_label_block_matches_exact_keyword():
    b = block("School Year")
    assert find_label_block([b], "school_year") is b


def test_find_label_block_matches_keyword_as_substring_for_long_keywords():
    b = block("Academic Year 2025")
    assert find_label_block([b], "school_year") is b


def test_find_label_block_uses_word_boundary_for_short_keywords():
    # "sy" is a 2-char keyword -> must match whole word, not substring
    non_match = block("easy come easy go")
    result = find_label_block([non_match], "school_year")
    assert result is None


def test_find_label_block_short_keyword_matches_whole_word():
    b = block("sy 2025-2026")
    assert find_label_block([b], "school_year") is b


def test_find_label_block_prefers_specific_keyword_over_generic_fallback():
    # date_issued keywords: "date issued" before generic "issued"
    generic = block("Signed and issued this day")
    specific = block("Date Issued: 2025")
    result = find_label_block([generic, specific], "date_issued")
    assert result is specific


def test_find_label_block_falls_back_to_generic_keyword_when_specific_absent():
    generic = block("This certificate was issued in Cabuyao")
    result = find_label_block([generic], "date_issued")
    assert result is generic


def test_find_label_block_unknown_field_returns_none():
    b = block("Whatever")
    assert find_label_block([b], "not_a_real_field") is None


def test_find_label_block_no_match_returns_none():
    b = block("Completely unrelated text")
    assert find_label_block([b], "barangay") is None


def test_find_label_block_strips_trailing_colon():
    b = block("Barangay:")
    assert find_label_block([b], "barangay") is b


# ── extract_via_keyword() ───────────────────────────────────────────────

def test_extract_via_keyword_returns_none_when_label_not_found():
    blocks = [block("Nothing relevant here")]
    assert extract_via_keyword(blocks, "barangay") is None


def test_extract_via_keyword_inline_colon_value():
    label = block("School Year: 2025-2026")
    result = extract_via_keyword([label], "school_year")
    assert result is not None
    value, context, value_block, label_block = result
    assert value == "2025-2026"
    assert "inline" in context
    assert value_block is label_block is label


def test_extract_via_keyword_inline_colon_with_too_short_value_falls_through_to_right():
    # value after colon is just 1 char (not "> 1"), so inline branch
    # should not use it and should fall through to spatial lookup
    label = block("School Year: 2", x_min=0, x_max=150, y_min=0, y_max=20)
    right = block("2025-2026", x_min=160, x_max=260, y_min=0, y_max=20)
    result = extract_via_keyword([label, right], "school_year")
    value, context, value_block, label_block = result
    assert value == "2025-2026"
    assert "to the right" in context


def test_extract_via_keyword_value_to_the_right():
    label = block("Barangay", x_min=0, x_max=100, y_min=0, y_max=20)
    value = block("Mamatid", x_min=110, x_max=200, y_min=0, y_max=20)
    result = extract_via_keyword([label, value], "barangay")
    val, context, value_block, label_block = result
    assert val == "Mamatid"
    assert "to the right" in context
    assert value_block is value
    assert label_block is label


def test_extract_via_keyword_value_below():
    label = block("Barangay", x_min=0, x_max=100, y_min=0, y_max=20)
    value = block("Mamatid", x_min=0, x_max=100, y_min=25, y_max=45)
    result = extract_via_keyword([label, value], "barangay")
    val, context, value_block, label_block = result
    assert val == "Mamatid"
    assert "below" in context
    assert value_block is value


def test_extract_via_keyword_value_above_when_no_right_or_below():
    label = block("Barangay", x_min=0, x_max=100, y_min=40, y_max=60)
    value = block("Mamatid", x_min=0, x_max=100, y_min=0, y_max=20)
    result = extract_via_keyword([label, value], "barangay")
    val, context, value_block, label_block = result
    assert val == "Mamatid"
    assert "above" in context
    assert value_block is value


def test_extract_via_keyword_returns_none_when_no_value_found_anywhere():
    label = block("Barangay", x_min=0, x_max=100, y_min=0, y_max=20)
    result = extract_via_keyword([label], "barangay")
    assert result is None


def test_extract_via_keyword_ignores_single_char_right_value():
    label = block("Barangay", x_min=0, x_max=100, y_min=0, y_max=20)
    trivial = block(":", x_min=110, x_max=115, y_min=0, y_max=20)
    result = extract_via_keyword([label, trivial], "barangay")
    assert result is None
