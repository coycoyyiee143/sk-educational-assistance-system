# tests/test_school_year_extraction.py
#
# Unit tests for app.extraction.school_year — resolves a school year via
# the labeled "School Year" field first (routed through the school's own
# normalization strategy), then falls back to a top-half pattern scan.

import pytest

from app.models import OcrBlock
from app.extraction.school_year import extract_school_year


def block(text, x_min=0, y_min=0, x_max=200, y_max=20, conf=0.9):
    return OcrBlock(text=text, confidence=conf, x_min=x_min, y_min=y_min, x_max=x_max, y_max=y_max)


def test_extracts_via_labeled_field_generic_school():
    labeled = block("School Year: 2025-2026")
    result = extract_school_year([labeled], 1000, 1000)
    assert result.found is True
    assert result.value == "2025-2026"
    assert result.method == "keyword"


def test_falls_back_to_top_half_pattern_scan_when_no_label():
    # no "School Year" label anywhere, but a 20xx-20xx pattern sits in
    # the top half of the page
    header = block("S.Y. 2025-2026", x_min=0, y_min=0, x_max=200, y_max=20)
    result = extract_school_year([header], 1000, 1000)
    assert result.found is True
    assert result.value == "2025-2026"
    assert result.method == "pattern_scan"


def test_bottom_half_text_ignored_by_fallback_scan():
    footer = block("2025-2026", x_min=0, y_min=900, x_max=200, y_max=920)
    result = extract_school_year([footer], 1000, 1000)
    assert result.found is False


def test_no_school_year_anywhere_fails():
    blocks = [block("Juan Dela Cruz"), block("BSIT-3A")]
    result = extract_school_year(blocks, 1000, 1000)
    assert result.found is False
    assert result.method == "none"


def test_uses_school_specific_strategy_for_pnc():
    labeled = block("School Year: academic year 2024-2025")
    result = extract_school_year([labeled], 1000, 1000, school_name="Pamantasan ng Cabuyao")
    assert result.found is True
    assert result.value == "2024-2025"


def test_uses_school_specific_strategy_for_svcc_single_year():
    labeled = block("School Year: 2025")
    result = extract_school_year([labeled], 1000, 1000, school_name="SVCC")
    assert result.found is True
    assert result.value == "2025-2026"


def test_unregistered_school_uses_base_strategy():
    labeled = block("School Year: 2025-2026")
    result = extract_school_year([labeled], 1000, 1000, school_name="Some Unknown School")
    assert result.found is True
    assert result.value == "2025-2026"


def test_configured_year_hint_passed_through_to_strategy():
    # single-year value only resolves with a format hint (base strategy
    # behavior) -- exercised via extract_school_year's configured_year param
    labeled = block("School Year: 2025")
    result = extract_school_year([labeled], 1000, 1000, configured_year="single_year_as_start")
    assert result.found is True
    assert result.value == "2025-2026"
