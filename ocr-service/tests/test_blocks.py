# tests/test_blocks.py
#
# Unit tests for app.extraction.blocks — pure helpers for turning raw OCR
# engine output into OcrBlock objects, plus the shared extraction_failed()
# result constructor and page-dimension inference.

import pytest

from app.models import OcrBlock, ExtractionResult
from app.extraction.blocks import extraction_failed, parse_ocr_blocks, get_page_dimensions


# ── extraction_failed() ───────────────────────────────────────────────

def test_extraction_failed_returns_not_found_result():
    result = extraction_failed("school_year", "no matching format found")
    assert isinstance(result, ExtractionResult)
    assert result.found is False
    assert result.value is None
    assert result.raw is None
    assert result.method == "none"
    assert result.confidence == 0.0
    assert result.context == "no matching format found"
    assert result.metadata == {}


def test_extraction_failed_carries_optional_metadata():
    result = extraction_failed("name", "not found", metadata={"attempted": ["keyword", "stacked"]})
    assert result.metadata == {"attempted": ["keyword", "stacked"]}


# ── parse_ocr_blocks() ──────────────────────────────────────────────────

def test_parse_ocr_blocks_from_dict_format():
    ocr_result = [
        {"bbox": [[0, 0], [50, 0], [50, 20], [0, 20]], "text": "  Hello  ", "confidence": 0.91},
    ]
    blocks = parse_ocr_blocks(ocr_result)
    assert len(blocks) == 1
    b = blocks[0]
    assert b.text == "Hello"
    assert b.confidence == pytest.approx(0.91)
    assert b.x_min == 0 and b.x_max == 50
    assert b.y_min == 0 and b.y_max == 20


def test_parse_ocr_blocks_from_tuple_format():
    ocr_result = [
        ([[10, 10], [60, 10], [60, 30], [10, 30]], ("Some Text", 0.75)),
    ]
    blocks = parse_ocr_blocks(ocr_result)
    assert len(blocks) == 1
    b = blocks[0]
    assert b.text == "Some Text"
    assert b.confidence == pytest.approx(0.75)
    assert b.x_min == 10 and b.x_max == 60
    assert b.y_min == 10 and b.y_max == 30


def test_parse_ocr_blocks_skips_empty_text():
    ocr_result = [
        {"bbox": [[0, 0], [10, 0], [10, 10], [0, 10]], "text": "   ", "confidence": 0.5},
        {"bbox": [[0, 0], [10, 0], [10, 10], [0, 10]], "text": "Real", "confidence": 0.5},
    ]
    blocks = parse_ocr_blocks(ocr_result)
    assert len(blocks) == 1
    assert blocks[0].text == "Real"


def test_parse_ocr_blocks_empty_list_returns_empty():
    assert parse_ocr_blocks([]) == []


def test_parse_ocr_blocks_computes_bbox_extents_from_unordered_points():
    # bbox points aren't necessarily given in a fixed corner order —
    # x_min/x_max/y_min/y_max should be the true extents regardless.
    ocr_result = [
        {"bbox": [[30, 40], [5, 100], [80, 2], [12, 12]], "text": "X", "confidence": 1.0},
    ]
    b = parse_ocr_blocks(ocr_result)[0]
    assert b.x_min == 5 and b.x_max == 80
    assert b.y_min == 2 and b.y_max == 100


# ── get_page_dimensions() ────────────────────────────────────────────────

def test_get_page_dimensions_empty_blocks_returns_default():
    assert get_page_dimensions([]) == (1000, 1000)


def test_get_page_dimensions_uses_max_extents():
    blocks = [
        OcrBlock(text="a", confidence=1.0, x_min=0, y_min=0, x_max=100, y_max=50),
        OcrBlock(text="b", confidence=1.0, x_min=10, y_min=10, x_max=300, y_max=20),
    ]
    assert get_page_dimensions(blocks) == (300, 50)
