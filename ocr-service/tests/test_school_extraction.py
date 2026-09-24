# tests/test_school_extraction.py
#
# Tests for extract_school()'s failure-path metadata -- specifically
# `detected_confidence`, added alongside the institution_mismatch
# auto-reupload tier (see shared.py::_check_school_or_reupload) so a
# caller can tell a genuinely confident different-school detection from
# one that merely passed the 85-similarity threshold on a weak OCR read.

import pytest
from app.models import OcrBlock
from app.extraction.school import extract_school

PAGE_W, PAGE_H = 1000.0, 1400.0


def block(text, confidence, x=100, y=100, w=400, h=30):
    return OcrBlock(text=text, confidence=confidence, x_min=x, y_min=y, x_max=x + w, y_max=y + h)


def test_detected_confidence_populated_when_other_school_found():
    blocks = [block("Pamantasan ng Cabuyao", 0.95)]
    res = extract_school(blocks, PAGE_W, PAGE_H, "Polytechnic University of the Philippines")
    assert res.found is False
    assert res.metadata.get("detected_school") == "Pamantasan ng Cabuyao"
    assert res.metadata.get("detected_confidence", 0.0) > 0.0


def test_detected_confidence_absent_when_nothing_matches():
    blocks = [block("Some unrelated boilerplate text", 0.9)]
    res = extract_school(blocks, PAGE_W, PAGE_H, "Polytechnic University of the Philippines")
    assert res.found is False
    assert res.metadata.get("detected_school") is None
    assert res.metadata.get("detected_confidence", 0.0) == 0.0
