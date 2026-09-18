# tests/test_name_extraction.py
#
# Unit tests for app.extraction.name — extract_stacked_name_fields,
# extract_adjacent_name_lines, and the top-level extract_name() dispatch
# through its keyword / stacked / single-block / adjacent-lines /
# label-anchored-no-match / position / pattern-scan fallback chain.

import pytest

from app.models import OcrBlock
from app.extraction.name import (
    extract_stacked_name_fields,
    extract_adjacent_name_lines,
    extract_name,
)


def block(text, x_min=0, y_min=0, x_max=200, y_max=20, conf=0.9):
    return OcrBlock(text=text, confidence=conf, x_min=x_min, y_min=y_min, x_max=x_max, y_max=y_max)


FN, MN, LN = "Juan", "Reyes", "Dela Cruz"


# ── extract_stacked_name_fields() ─────────────────────────────────────

def test_extract_stacked_name_fields_joins_data_above_labels():
    blocks = [
        block("Juan"),
        block("Dela Cruz"),
        block("Last Name"),
        block("First Name"),
    ]
    result = extract_stacked_name_fields(blocks)
    assert result is not None
    joined_text, context, used_blocks = result
    assert "Juan" in joined_text
    assert "Dela Cruz" in joined_text
    assert "stacked" in context


def test_extract_stacked_name_fields_excludes_noise_lines():
    blocks = [
        block("Student Information"),
        block("Juan"),
        block("1234567890123"),  # 10+ digit run treated as noise (ID number)
        block("Dela Cruz"),
        block("Last Name"),
    ]
    result = extract_stacked_name_fields(blocks)
    assert result is not None
    joined_text, _, _ = result
    assert "Student Information" not in joined_text
    assert "1234567890123" not in joined_text


def test_extract_stacked_name_fields_no_label_returns_none():
    blocks = [block("Juan"), block("Dela Cruz")]
    assert extract_stacked_name_fields(blocks) is None


def test_extract_stacked_name_fields_only_looks_within_five_blocks_above():
    far_name = block("Juan")
    filler = [block(f"filler {i}") for i in range(6)]
    label = block("First Name")
    blocks = [far_name] + filler + [label]
    result = extract_stacked_name_fields(blocks)
    # far_name is more than 5 blocks above base_idx, so it's excluded
    if result:
        joined_text, _, _ = result
        assert "Juan" not in joined_text


# ── extract_adjacent_name_lines() ──────────────────────────────────────

def test_extract_adjacent_name_lines_joins_two_stacked_unlabeled_lines():
    surname = block("DELA CRUZ", x_min=0, y_min=0, x_max=200, y_max=20)
    given = block("JUAN REYES", x_min=0, y_min=25, x_max=200, y_max=45)
    blocks = [surname, given]
    result = extract_adjacent_name_lines(blocks, FN, MN, LN)
    assert result is not None
    joined_text, context, used_blocks = result
    assert "DELA CRUZ" in joined_text
    assert "JUAN REYES" in joined_text


def test_extract_adjacent_name_lines_skips_noise_label_between_lines():
    surname = block("DELA CRUZ", x_min=0, y_min=0, x_max=200, y_max=20)
    noise = block("Sex", x_min=0, y_min=25, x_max=200, y_max=45)
    given = block("JUAN REYES", x_min=0, y_min=50, x_max=200, y_max=70)
    blocks = [surname, noise, given]
    result = extract_adjacent_name_lines(blocks, FN, MN, LN, noise_labels=["sex", "civil status", "age"])
    assert result is not None
    joined_text, _, _ = result
    assert "Sex" not in joined_text
    assert "DELA CRUZ" in joined_text and "JUAN REYES" in joined_text


def test_extract_adjacent_name_lines_no_match_returns_none():
    blocks = [block("Completely unrelated line one"), block("Completely unrelated line two", y_min=25, y_max=45)]
    result = extract_adjacent_name_lines(blocks, FN, MN, LN)
    assert result is None


# ── extract_name() dispatch chain ───────────────────────────────────────

def test_extract_name_via_keyword_label_right():
    label = block("Name", x_min=0, x_max=100, y_min=0, y_max=20)
    value = block("Juan Reyes Dela Cruz", x_min=110, x_max=350, y_min=0, y_max=20)
    result = extract_name([label, value], 1000, 1000, FN, MN, LN)
    assert result.found is True
    assert result.method == "keyword"
    assert "Juan" in result.value


def test_extract_name_via_keyword_inline_colon():
    label = block("Name: Juan Reyes Dela Cruz", x_min=0, x_max=300, y_min=0, y_max=20)
    result = extract_name([label], 1000, 1000, FN, MN, LN)
    assert result.found is True
    assert result.method == "keyword"


def test_extract_name_single_block_matches_without_label():
    b = block("Juan Reyes Dela Cruz")
    result = extract_name([b], 1000, 1000, FN, MN, LN)
    assert result.found is True
    assert result.method == "single_block"


def test_extract_name_adjacent_lines_fallback():
    surname = block("DELA CRUZ", x_min=0, y_min=0, x_max=200, y_max=20)
    given = block("JUAN REYES", x_min=0, y_min=25, x_max=200, y_max=45)
    result = extract_name([surname, given], 1000, 1000, FN, MN, LN)
    assert result.found is True
    assert result.method == "adjacent_lines"


def test_extract_name_label_anchored_no_match_when_name_field_present_but_wrong_person():
    label = block("Name", x_min=0, x_max=100, y_min=0, y_max=20)
    value = block("Pedro Santos Garcia", x_min=110, x_max=350, y_min=0, y_max=20)
    result = extract_name([label, value], 1000, 1000, FN, MN, LN)
    assert result.found is False
    assert result.method == "label_anchored_no_match"
    assert "Pedro" in result.value


def test_extract_name_no_match_anywhere_returns_none_method():
    blocks = [block("UniFAST Grantee: Yes"), block("Some other unrelated text")]
    result = extract_name(blocks, 1000, 1000, FN, MN, LN)
    assert result.found is False
    assert result.method in ("none", "label_anchored_no_match")


def test_extract_name_empty_blocks_returns_no_match():
    result = extract_name([], 1000, 1000, FN, MN, LN)
    assert result.found is False
    assert result.value is None
    assert result.method == "none"


def test_extract_name_spacing_reinsertion_only_applied_on_a_found_result():
    # extract_name() only runs reinsert_name_spacing() when a confident
    # match was already found -- an unspaced glued name that doesn't clear
    # the fuzzy-match threshold on its own stays unmatched, not "fixed up"
    # into a false-positive match.
    true_name = f"{FN} {MN} {LN}".upper()
    glued_text = true_name.replace(" ", "")
    b = block(glued_text)
    result = extract_name([b], 1000, 1000, FN, MN, LN)
    assert result.found is False
