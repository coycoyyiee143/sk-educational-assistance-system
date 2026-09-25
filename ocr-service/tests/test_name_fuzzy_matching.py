# tests/test_name_fuzzy_matching.py
#
# Regression tests for two related bugs found together on a real PUP
# School ID reading "DELA ROSA,ELA MARIE RODRIGEZ" for an applicant whose
# actual registered surname is "Dela Rosario":
#
# 1. normalize_name() deleted commas outright instead of replacing them
#    with a space, so a "Last,First" OCR read with no space after the
#    comma ("ROSA,ELA") glued into one word ("ROSAELA"). Fixed by
#    replacing commas with a space specifically (every other punctuation
#    mark still gets deleted, unchanged).
#
# 2. Even after the space was restored, _component_present() STILL
#    incorrectly passed -- rapidfuzz's partial_ratio scores a large
#    matching PREFIX highly even when the rest of `target` is completely
#    missing, since "Rosa" (9 chars incl. "Dela ") is a literal prefix of
#    "Rosario" (12 chars). Fixed by additionally requiring the matched
#    alignment window to cover most (>=80%) of target's own length, not
#    just a prefix of it.
#
# See AUTO_REUPLOAD_VERIFICATION_RULES.md's false-positive class notes
# (the "Pamantasan" school-name bug is the same underlying pattern).

import pytest
from app.normalization.text_utils import normalize_name, fuzzy_match_name, _component_present


def test_normalize_name_inserts_space_at_comma_not_deletes_it():
    assert normalize_name("DELA ROSA,ELA MARIE") == "DELA ROSA ELA MARIE"


def test_normalize_name_still_deletes_other_punctuation():
    # Periods still collapse to nothing, e.g. abbreviations like "Sch.Yr."
    # staying one token elsewhere in the codebase relies on this.
    assert normalize_name("A.Y. 2025") == "AY 2025"


def test_prefix_surname_does_not_falsely_pass():
    # The exact reported bug: a surname that's a strict prefix of the
    # expected one ("Dela Rosa" vs "Dela Rosario") must NOT pass, even
    # though the shared prefix alone is long enough to clear a raw
    # partial_ratio threshold.
    result = fuzzy_match_name(
        "DELA ROSA,ELA MARIE RODRIGEZ", "Ela Marie", "Rodrigez", "Dela Rosario"
    )
    assert result["passed"] is False


def test_genuine_full_surname_still_passes():
    result = fuzzy_match_name(
        "DELA ROSARIO,ELA MARIE RODRIGEZ", "Ela Marie", "Rodrigez", "Dela Rosario"
    )
    assert result["passed"] is True


def test_minor_ocr_typo_within_full_surname_still_passes():
    # A single-character misread WITHIN the full-length surname (not a
    # truncation) must still tolerate the existing >=85 similarity bar.
    result = fuzzy_match_name(
        "DELA ROSARLO,ELA MARIE RODRIGEZ", "Ela Marie", "Rodrigez", "Dela Rosario"
    )
    assert result["passed"] is True


def test_component_present_rejects_prefix_only_match():
    assert _component_present("DELA ROSARIO", "DELA ROSA ELA MARIE RODRIGEZ") is False


def test_component_present_accepts_full_length_match():
    assert _component_present("DELA ROSARIO", "DELA ROSARIO ELA MARIE RODRIGEZ") is True


def test_component_present_short_target_unaffected():
    # Targets <=6 chars use a completely different (edit-distance) branch
    # -- confirm this fix didn't touch that path.
    assert _component_present("PANA", "JUAN PANA DELA CRUZ") is True
    assert _component_present("PANA", "JUAN PARA DELA CRUZ") is True  # 1-edit tolerance
    assert _component_present("PANA", "JUAN XYZW DELA CRUZ") is False
