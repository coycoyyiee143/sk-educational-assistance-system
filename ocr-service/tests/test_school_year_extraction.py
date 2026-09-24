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


def test_wrong_neighbor_rescued_by_nearby_label_search():
    # Regression test for a real UPHSD Registration Form: "Sch.Yr." reads
    # as its own label block, but the unrelated "Ref.No." label -- not the
    # actual year -- sits immediately to its right in OCR read order, so
    # extract_via_keyword's label-pairing grabs the wrong text. The real
    # value sits two rows further down instead -- close enough to the
    # label to be found by a scoped, local search around it, without
    # widening the search to the whole page/region (which would risk
    # matching an unrelated year-shaped number elsewhere in the document).
    blocks = [
        block("Sch.Yr.", x_min=100, y_min=1200, x_max=200, y_max=1230, conf=0.95),
        block("Ref.No.", x_min=210, y_min=1200, x_max=310, y_max=1230, conf=0.97),
        block("1st", x_min=100, y_min=1240, x_max=150, y_max=1270, conf=0.83),
        block("2025-2026", x_min=100, y_min=1280, x_max=250, y_max=1310, conf=0.99),
    ]
    result = extract_school_year(
        blocks, 1000, 2000,
        school_name="University of Perpetual Help System DALTA",
        configured_year="2025-2026",
    )
    assert result.found is True
    assert result.value == "2025-2026"
    assert result.method == "keyword_nearby"


def test_wrong_neighbor_not_rescued_when_year_is_far_away():
    # The nearby-label rescue must stay scoped -- a year-shaped number far
    # down the page (well outside the label's own vicinity) should NOT be
    # picked up just because the naive neighbor-guess failed; that would
    # reopen the false-positive risk a whole-page scan would have had.
    blocks = [
        block("Sch.Yr.", x_min=100, y_min=100, x_max=200, y_max=130, conf=0.95),
        block("Ref.No.", x_min=210, y_min=100, x_max=310, y_max=130, conf=0.97),
        block("2019-2020", x_min=100, y_min=1800, x_max=250, y_max=1830, conf=0.99),
    ]
    result = extract_school_year(
        blocks, 1000, 2000,
        school_name="University of Perpetual Help System DALTA",
        configured_year="2025-2026",
    )
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


def test_raw_value_trimmed_to_year_window_not_full_block():
    # Real UPHSD Registration Form shape: the matched block's raw text
    # runs on well past the year itself (a reference number, an
    # encoding id, ...). `value` must still be the clean parsed year, but
    # `raw` (what a verifier sees as "extracted value") should be a short
    # window around the year, not the whole block.
    long_block = block("Sem 1st 2025 - 2026 Time Ref.No. Encod689857 Room 234111083 Amount")
    result = extract_school_year([long_block], 1000, 1000)
    assert result.found is True
    assert result.value == "2025-2026"
    assert result.raw != long_block.text
    assert len(result.raw) < len(long_block.text)
    assert "2025" in result.raw and "2026" in result.raw
    assert "234111083" not in result.raw


def test_short_raw_value_left_unchanged():
    # Already short -- trimming must be a no-op, not force a truncation.
    # extract_via_keyword's inline colon-split returns just "2025-2026"
    # as the raw value here (the part after "School Year:"), which is
    # already well under the trim threshold.
    labeled = block("School Year: 2025-2026")
    result = extract_school_year([labeled], 1000, 1000)
    assert result.raw == "2025-2026"
