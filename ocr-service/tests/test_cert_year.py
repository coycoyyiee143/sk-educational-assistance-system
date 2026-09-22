# tests/test_cert_year.py
#
# Unit tests for app.extraction.cert_year — extracting the issuance year
# of a Voter's Certification via a labeled "Date Issued" field first,
# falling back to a free-text sentence containing "issued".

import pytest

from app.models import OcrBlock
from app.extraction.cert_year import extract_cert_year


def block(text, conf=0.9):
    return OcrBlock(text=text, confidence=conf, x_min=0, y_min=0, x_max=200, y_max=20)


def test_extracts_year_from_labeled_date_issued_field():
    labeled = block("Date Issued: 2025-06-14")
    result = extract_cert_year([labeled])
    assert result.found is True
    assert result.value == "2025"
    assert result.method == "keyword"


def test_labeled_field_confidence_is_min_of_label_and_value_blocks():
    label = block("Date Issued", conf=0.6)
    value = block("2025", conf=0.95)
    # place value to the right of the label so keyword_engine resolves it
    label.x_min, label.x_max, label.y_min, label.y_max = 0, 100, 0, 20
    value.x_min, value.x_max, value.y_min, value.y_max = 110, 160, 0, 20
    result = extract_cert_year([label, value])
    assert result.found is True
    assert result.value == "2025"
    assert result.confidence == pytest.approx(0.6)


def test_falls_back_to_free_text_issued_sentence():
    sentence = block("This certification is issued this 14th day of May 2026 in Cabuyao.")
    result = extract_cert_year([sentence])
    assert result.found is True
    assert result.value == "2026"
    assert result.method == "pattern_scan"
    assert "issued" in result.context


def test_year_regex_tolerates_missing_space_before_year():
    # OCR frequently drops the space between a word and the year
    sentence = block("issued last May2026 at Cabuyao")
    result = extract_cert_year([sentence])
    assert result.found is True
    assert result.value == "2026"


def test_no_date_issued_or_issued_sentence_fails():
    blocks = [block("Voter's Certification"), block("Juan Dela Cruz")]
    result = extract_cert_year(blocks)
    assert result.found is False
    assert result.value is None
    assert result.method == "none"


def test_labeled_field_without_valid_year_falls_through_to_issued_scan():
    # "Date Issued" label present but its resolved value has no 4-digit
    # 20xx year in it (e.g. OCR garbled it) -- should not crash, should
    # fall through to the "issued" line scan.
    label = block("Date Issued: N/A")
    fallback = block("Certificate issued 2024 at the Cabuyao COMELEC office")
    result = extract_cert_year([label, fallback])
    assert result.found is True
    assert result.value == "2024"
    assert result.method == "pattern_scan"


def test_does_not_match_non_20xx_years():
    sentence = block("issued in 1998")
    result = extract_cert_year([sentence])
    assert result.found is False
