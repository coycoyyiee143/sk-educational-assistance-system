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


# STI's own School ID card structurally never prints the word "College"
# at all -- it's a two-line logo reading "STI" over "CALAMBA", not an OCR
# miss on an otherwise-present header word. Without a shorter accepted
# match name for this school (see sti_calamba.py's match_target_names),
# fuzzy_match_school()'s 0.75 length-ratio guard blocks even a perfectly-
# read "STI"/"CALAMBA" header from ever matching the full declared name
# "STI College Calamba", misflagging every genuine STI School ID.
def test_sti_school_id_header_without_college_word_still_matches():
    sti_line1 = block("STI", 0.95, y=50)
    sti_line2 = block("CALAMBA", 0.95, y=90)
    res = extract_school([sti_line1, sti_line2], PAGE_W, PAGE_H, "STI College Calamba")
    assert res.found is True


def test_declared_school_matching_in_header_itself_is_not_overridden():
    # The header cross-check only fires when the declared match did NOT
    # come from the header (method != "position") -- a genuine, correctly
    # header-matched declared school must still pass normally.
    header = block("National University", 0.95, y=50)
    res = extract_school([header], PAGE_W, PAGE_H, "National University")
    assert res.found is True


def test_declared_school_mentioned_only_in_body_text_is_not_enough():
    # A school with a real HEADER-MERGE strategy (PUP -- see pup.py's
    # _merge_institution_header) only gets a confident auto-pass via that
    # strong header-merge (position or header_join) -- a bare mention of
    # the declared school's name in body text, with an illegible header,
    # is no longer enough on its own. Previously this DID auto-pass,
    # purely because a full-page fallback scan found the declared
    # school's name anywhere on the page -- confirmed as a real
    # false-positive risk on a DIFFERENT case (a leftover watermark/stamp
    # elsewhere on an SVCC page let a wrong-school document pass
    # institution_match outright). Losing this doesn't auto-reject a
    # genuine applicant: it falls through to a verifier-routed "please
    # confirm manually" case instead of a silent pass, the same as any
    # other genuinely ambiguous read.
    #
    # NOT National University here on purpose -- NU has NO
    # preprocess_blocks/header-merge override (only extract_school_year),
    # so it correctly keeps the full-page fallback (see
    # _full_page_scan_blocks's "has_header_merge" check) and this
    # scenario legitimately SHOULD still pass for NU.
    #
    # Uses the "PUP" acronym, not PUP's full name -- the full name
    # ("Polytechnic University of the Philippines") literally contains
    # the separate registered alias "University of the Philippines" as a
    # substring, which the OTHER-school search then legitimately detects
    # on its own; that's a different (correct) behavior than what this
    # test means to isolate.
    body = block(
        "This is a PUP Student Handbook disclaimer notice.",
        0.9, y=900,
    )
    unrelated_header = block("Some illegible header text", 0.6, y=50)
    res = extract_school([unrelated_header, body], PAGE_W, PAGE_H, "Polytechnic University of the Philippines")
    assert res.found is False
    assert res.metadata.get("detected_school") is None


def test_school_with_no_header_merge_still_gets_body_text_fallback():
    # Companion to the PUP test above -- a school with NO header-merge
    # strategy (NU only overrides extract_school_year, never
    # preprocess_blocks) has no strong header-only path to fall back on,
    # so it correctly KEEPS the full-page fallback scan. The same
    # scenario that must fail for PUP (a header-merge school) must still
    # pass here, or NU loses real matches on genuinely correct uploads
    # for no protective benefit.
    body = block(
        "This is a National University Student Handbook disclaimer notice.",
        0.9, y=900,
    )
    unrelated_header = block("Some illegible header text", 0.6, y=50)
    res = extract_school([unrelated_header, body], PAGE_W, PAGE_H, "National University")
    assert res.found is True


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


def test_incomplete_read_of_declared_school_itself_is_not_reported_as_a_different_school():
    # Regression: a real PUP School ID where OCR simply never detected the
    # "UNIVERSITY" line of the split institution header (a detection miss,
    # not a misread) -- the header banner alone read "POLYTECHNIC OF THE
    # PHILIPPINES," missing a declared-school word, which used to be
    # treated as proof of a DIFFERENT school and reported back to the
    # applicant as "appears to be Polytechnic Of The Philippines instead,"
    # even though every word in that banner belongs to their own, correctly
    # declared school and nothing on the page contradicts it.
    #
    # Uses a school with no dedicated header-merge strategy (so the
    # declared match can succeed from elsewhere on the page, giving
    # result.method != "position" -- the same condition a genuine
    # wrong-school header would also produce) purely to isolate this guard
    # from PUP's own header-merge/full-page-restriction behavior, which is
    # covered separately in test_school_normalization.py.
    incomplete_header = block("University Santo", 0.97, y=50)
    full_name_elsewhere = block("University of Santo Tomas enrollment form", 0.9, y=900)
    res = extract_school(
        [incomplete_header, full_name_elsewhere], PAGE_W, PAGE_H,
        "University of Santo Tomas",
    )
    assert res.found is True
    assert res.metadata.get("detected_school") is None
