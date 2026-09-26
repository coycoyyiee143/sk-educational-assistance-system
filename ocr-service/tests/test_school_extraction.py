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


# ── Header cross-check ────────────────────────────────────────────────
#
# Regression tests for a real Registration Form: the declared school
# ("National University") matched via a boilerplate disclaimer sentence
# in the document BODY ("...National University Student Handbook...")
# while the actual HEADER confidently read "STI COLLEGE CALAMBA" -- a
# completely different, specific, known school. Because the
# declared-school match succeeded (even though it came from body text,
# not the header), extract_school() returned a pass immediately without
# ever checking whether the header itself showed something else. See
# AUTO_REUPLOAD_VERIFICATION_RULES.md.

def test_confident_different_school_in_header_overrides_body_match():
    header = block("STI COLLEGE CALAMBA", 0.95, y=50)  # inside the header region (0-25% of PAGE_H)
    body = block(
        "This is a National University Student Handbook disclaimer notice.",
        0.9, y=900,  # well outside the header region
    )
    res = extract_school([header, body], PAGE_W, PAGE_H, "National University")
    assert res.found is False
    assert res.metadata.get("detected_school") == "STI College Calamba"
    assert res.metadata.get("detected_confidence", 0.0) > 0.0


def test_declared_school_matching_in_header_itself_is_not_overridden():
    # The header cross-check only fires when the declared match did NOT
    # come from the header (method != "position") -- a genuine, correctly
    # header-matched declared school must still pass normally.
    header = block("National University", 0.95, y=50)
    res = extract_school([header], PAGE_W, PAGE_H, "National University")
    assert res.found is True


def test_declared_school_mentioned_only_in_body_text_is_not_enough():
    # A dedicated-strategy school (National University) only gets a
    # confident auto-pass via its own strong header-merge (position or
    # header_join) -- a bare mention of the declared school's name in body
    # text, with an illegible header, is no longer enough on its own.
    # Previously this DID auto-pass, purely because a full-page fallback
    # scan found the declared school's name anywhere on the page --
    # confirmed as a real false-positive risk on a DIFFERENT case (a
    # leftover watermark/stamp elsewhere on an SVCC page let a wrong-school
    # document pass institution_match outright). Losing this doesn't
    # auto-reject a genuine applicant: it falls through to a verifier-
    # routed "please confirm manually" case instead of a silent pass, the
    # same as any other genuinely ambiguous read.
    body = block(
        "This is a National University Student Handbook disclaimer notice.",
        0.9, y=900,
    )
    unrelated_header = block("Some illegible header text", 0.6, y=50)
    res = extract_school([unrelated_header, body], PAGE_W, PAGE_H, "National University")
    assert res.found is False
    assert res.metadata.get("detected_school") is None


def test_confident_unlisted_institution_in_header_overrides_body_match():
    # Regression: a real Registration Form whose header confidently read
    # "LAGUNA STATE POLYTECHNIC UNIVERSITY" -- a real school, but not one
    # on this system's known-schools roster -- while the body carried an
    # unrelated "...National University Student Handbook..." disclaimer.
    # The known-school-only cross-check above found nothing (LSPU isn't a
    # tracked school), so the declared match from the body text passed
    # unopposed. The header banner itself must still be enough to flag it,
    # even without recognizing which specific school it is.
    header = block("LAGUNA STATE POLYTECHNIC UNIVERSITY", 0.97, y=50)
    body = block(
        "National University Student Handbook. Disciplinary sanctions shall apply if violated.",
        0.96, y=900,
    )
    res = extract_school([header, body], PAGE_W, PAGE_H, "National University")
    assert res.found is False
    assert res.metadata.get("detected_school") == "Laguna State Polytechnic University"
    assert res.metadata.get("detected_confidence", 0.0) >= 0.85
