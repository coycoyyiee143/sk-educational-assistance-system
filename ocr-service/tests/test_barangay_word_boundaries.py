# tests/test_barangay_word_boundaries.py
#
# Regression tests for a false-positive bug in extract_barangay: a bare
# substring check let "sala" (Brgy. Sala) match inside "salamat"
# ("thank you") -- an extremely common closing phrase on Philippine
# official documents. A genuine Mamatid resident whose document has no
# explicit "Barangay:" label (falls through to the whole-page scan)
# and happens to include a routine "Salamat po" line anywhere on the
# page would get a false SUGGESTED_DISAPPROVAL flag pointing to the
# wrong barangay. Fixed with word-boundary matching. See
# AUTO_REUPLOAD_VERIFICATION_RULES.md.

import pytest
from app.models import OcrBlock
from app.extraction.barangay import extract_barangay


def block(text, conf=0.95):
    return OcrBlock(text=text, confidence=conf, x_min=0, y_min=0, x_max=100, y_max=20)


def test_salamat_does_not_falsely_trigger_sala_contradiction():
    # Originally written with a Tagalog courtesy phrase as the trigger.
    # That premise was checked against actual COMELEC documentation
    # afterward and found wrong -- a real Voter's Certification is a
    # formal English-only document, so this phrase wouldn't realistically
    # appear on one. Kept as a test anyway since it's still a valid
    # word-boundary check, but see test_surname_does_not_falsely_trigger_
    # sala_contradiction below for the actual realistic scenario.
    blocks = [
        block("Republic of the Philippines"),
        block("Salamat po sa inyong pagtitiwala"),
        block("Residing at Mamatid, Cabuyao, Laguna"),
    ]
    result = extract_barangay(blocks)
    assert result.found is True
    assert result.value == "Mamatid"
    assert result.metadata.get("flag") != "SUGGESTED_DISAPPROVAL"


def test_surname_does_not_falsely_trigger_sala_contradiction():
    # The actual realistic trigger: "sala" is a literal substring of
    # real Filipino surnames (Salazar, Salas), which can appear on an
    # all-English certificate as the Election Officer's printed name,
    # a witness's name, or the voter's own surname -- no Tagalog text
    # involved at all.
    blocks = [
        block("Republic of the Philippines"),
        block("Certified by: Atty. Maria Salazar, Election Officer"),
        block("Residing at Mamatid, Cabuyao, Laguna"),
    ]
    result = extract_barangay(blocks)
    assert result.found is True
    assert result.value == "Mamatid"
    assert result.metadata.get("flag") != "SUGGESTED_DISAPPROVAL"


def test_genuine_different_barangay_still_correctly_flagged():
    # Must not overcorrect -- an ACTUAL mention of a different real
    # barangay (as its own word, not a fragment) must still trigger
    # the contradiction flag exactly as before.
    blocks = [block("Residing at Brgy. Sala, Cabuyao, Laguna")]
    result = extract_barangay(blocks)
    assert result.found is False
    assert result.metadata.get("flag") == "SUGGESTED_DISAPPROVAL"
    assert "Sala" in result.context


def test_mamatid_still_matches_normally():
    blocks = [block("Barangay Mamatid, Cabuyao City, Laguna")]
    result = extract_barangay(blocks)
    assert result.found is True
    assert result.value == "Mamatid"


def test_labeled_field_path_also_immune_to_the_same_bug():
    # The bug could theoretically also hit the labeled extract_via_keyword
    # branch if a barangay-labeled value's captured raw text happened to
    # include "salamat" nearby -- confirms the fix covers both branches,
    # not just the whole-page fallback.
    blocks = [block("Barangay: Salamat Village")]  # contrived, but exercises the labeled branch
    result = extract_barangay(blocks)
    # Should NOT match "Sala" here -- "Salamat" is one word, "Sala" is not
    # a standalone word within it.
    if not result.found:
        assert result.metadata.get("flag") != "SUGGESTED_DISAPPROVAL"


def test_whole_word_barangay_match_in_name_context_does_not_falsely_flag():
    # Deeper issue than word-boundary matching alone: a barangay name
    # can appear as a genuine, correctly-matched WHOLE WORD in a name
    # or signature block that has nothing to do with residency. No
    # Mamatid mention anywhere and no residency-context words near the
    # "Pulo" match -- must fall through to "not captured cleanly"
    # (verifier-routed), NOT a false accusatory contradiction.
    blocks = [
        block("Republic of the Philippines"),
        block("Election Officer: Juan dela Pulo"),
    ]
    result = extract_barangay(blocks)
    assert result.found is False
    assert result.metadata.get("flag") != "SUGGESTED_DISAPPROVAL"


def test_whole_word_barangay_match_with_residency_context_still_flags():
    # Same word, but genuinely in a residency-context block this time
    # -- the contradiction should still correctly fire. Confirms the
    # context filter doesn't overcorrect into never flagging anything.
    blocks = [
        block("Republic of the Philippines"),
        block("Residing at Pulo, Cabuyao, Laguna"),
    ]
    result = extract_barangay(blocks)
    assert result.found is False
    assert result.metadata.get("flag") == "SUGGESTED_DISAPPROVAL"
    assert "Pulo" in result.context


def test_san_isidro_multiword_barangay_still_works():
    # Confirms word-boundary matching works correctly for a two-word
    # barangay name too, not just single-word ones.
    blocks = [block("Residing at San Isidro, Cabuyao, Laguna")]
    result = extract_barangay(blocks)
    assert result.found is False
    assert "San Isidro" in result.context