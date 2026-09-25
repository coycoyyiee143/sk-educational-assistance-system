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


def test_mamatid_matches_even_when_ocr_glues_it_to_adjacent_word():
    # Regression: the word-boundary fix above (_contains_word) was
    # briefly applied to the Mamatid POSITIVE match too, which broke
    # detection whenever OCR read "Barangay" and "Mamatid" as one glued
    # token with no space -- a real, common OCR artifact on scanned
    # certs, not a hypothetical. \b can't find a boundary in the middle
    # of an unbroken run of letters, so genuine residents stopped being
    # detected. The positive match must stay a plain substring check.
    blocks = [block("BarangayMamatid, Cabuyao City, Laguna")]
    result = extract_barangay(blocks)
    assert result.found is True
    assert result.value == "Mamatid"


def test_contradiction_still_fires_when_label_glued_to_a_different_barangay():
    # Regression from a real Voter's Certification: OCR read the label
    # and value as one glued token, "BarangayPULO" (no space, no
    # colon), for an applicant actually registered in Brgy. Pulo. This
    # defeats find_label_block's right/below/above lookup (there's no
    # separate value block to find), so extract_via_keyword returns
    # None and the whole-page fallback takes over -- where the same
    # glued token also defeated the word-boundary check on "pulo" for
    # the same reason "BarangayMamatid" defeated it on "mamatid" above.
    # Must still correctly flag the contradiction, not fall through to
    # a generic "not captured cleanly".
    blocks = [block("BarangayPULO")]
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


def test_brangay_ocr_typo_label_still_recognized():
    # Regression test for a real Voter's Certificate: the label read as
    # "Brangay" (missing the first "a"), which didn't match any keyword
    # in FIELD_KEYWORDS["barangay"] at all -- not a wrong VALUE read, the
    # LABEL itself went unrecognized, so extract_via_keyword returned
    # nothing and the whole check fell through to the generic "not
    # captured cleanly" instead of the specific contradiction, even
    # though the value line (":MARINIG") was read cleanly right below it.
    # Caught by find_label_block's generic fuzzy fallback (see
    # keyword_engine.py), not a hardcoded "brangay" entry -- see the next
    # test for a different typo hitting the same mechanism.
    label = OcrBlock(text="Brangay", confidence=0.81, x_min=0, y_min=0, x_max=100, y_max=20)
    value = OcrBlock(text=":MARINIG", confidence=0.93, x_min=0, y_min=25, x_max=100, y_max=45)
    result = extract_barangay([label, value])
    assert result.found is False
    assert result.value == "Marinig"
    assert result.metadata.get("flag") == "SUGGESTED_DISAPPROVAL"
    assert "Marinig" in result.context


def test_fuzzy_label_fallback_generalizes_to_other_typos():
    # Confirms the fallback is genuinely generic -- catches a DIFFERENT
    # single-letter OCR typo ("Barnagay", a transposition) without
    # needing its own dedicated FIELD_KEYWORDS entry the way "brangay"
    # would have needed before this fallback existed.
    label = OcrBlock(text="Barnagay", confidence=0.85, x_min=0, y_min=0, x_max=100, y_max=20)
    value = OcrBlock(text=":PULO", confidence=0.9, x_min=0, y_min=25, x_max=100, y_max=45)
    result = extract_barangay([label, value])
    assert result.found is False
    assert result.value == "Pulo"
    assert result.metadata.get("flag") == "SUGGESTED_DISAPPROVAL"


def test_contradiction_populates_value_not_just_context():
    # A SUGGESTED_DISAPPROVAL contradiction used to leave value/raw as
    # None (via extraction_failed()), so a verifier saw "not extracted"
    # in the EXTRACTED VALUE column even though the flag_reason clearly
    # named the detected barangay -- confusing, since the information
    # was right there just not surfaced in the right field. The detected
    # barangay must now show up as `value` too, on both the
    # "Barangay:"-labeled path and the unanchored whole-page fallback.
    labeled = [block("Barangay: Banlic, Cabuyao, Laguna")]
    result = extract_barangay(labeled)
    assert result.found is False
    assert result.value == "Banlic"

    unanchored = [block("Address: Purok 3, Brgy. Banlic, Cabuyao")]
    result2 = extract_barangay(unanchored)
    assert result2.found is False
    assert result2.value == "Banlic"


def test_casile_recognized_as_a_known_barangay():
    # Regression test for a real Voter's Certificate: label "Barangay"
    # and value "CASILE" both read cleanly, but "Casile" (a real Cabuyao,
    # Laguna barangay) was missing from known_laguna_barangays entirely,
    # so it fell all the way through to a generic "not captured cleanly"
    # instead of flagging the contradiction -- unlike e.g. "Butong",
    # which was already in the list and worked correctly.
    label = OcrBlock(text="Barangay", confidence=0.99, x_min=0, y_min=0, x_max=100, y_max=20)
    value = OcrBlock(text=":CASILE", confidence=0.92, x_min=0, y_min=25, x_max=100, y_max=45)
    result = extract_barangay([label, value])
    assert result.found is False
    assert result.value == "Casile"
    assert result.metadata.get("flag") == "SUGGESTED_DISAPPROVAL"


def test_contradiction_reason_does_not_mention_layout():
    # The flag_reason previously said "Detected residency layout pointing
    # to Brgy. X" -- "layout" was misleading (this is a text match, not a
    # layout/positional analysis) and has been dropped from the wording.
    blocks = [block("Barangay: Banlic, Cabuyao, Laguna")]
    result = extract_barangay(blocks)
    assert "layout" not in result.context.lower()
    assert "Banlic" in result.context


def test_repeated_barangay_rescued_when_label_and_context_both_garbled():
    # Regression test for a real Voter's Certificate: the label OCR'd as
    # "Rranguy" (too corrupted even for the fuzzy label fallback in
    # keyword_engine.py) and the residency context word OCR'd as
    # "Resldence" (typo'd, so _residency_context_present never matches
    # it either) -- both the labeled path AND the single-block context-
    # gated fallback miss this document entirely. But "MARINIG" itself
    # was read cleanly in TWO separate, independent blocks (once next to
    # the garbled label, once in the address block) -- that repetition
    # is itself a strong enough signal to flag the contradiction without
    # needing a context word in the same block.
    blocks = [
        OcrBlock(text="Rranguy", confidence=0.68, x_min=0, y_min=0, x_max=100, y_max=20),
        OcrBlock(text=":MARINIG", confidence=0.93, x_min=0, y_min=25, x_max=100, y_max=45),
        OcrBlock(text="Resldence", confidence=0.78, x_min=0, y_min=200, x_max=100, y_max=220),
        OcrBlock(text=": B53 L35 P5", confidence=0.99, x_min=0, y_min=225, x_max=100, y_max=245),
        OcrBlock(text="MARINIG", confidence=0.998, x_min=0, y_min=250, x_max=100, y_max=270),
        OcrBlock(text="CITY OF CABUYAO", confidence=0.99, x_min=0, y_min=275, x_max=100, y_max=295),
    ]
    result = extract_barangay(blocks)
    assert result.found is False
    assert result.value == "Marinig"
    assert result.metadata.get("flag") == "SUGGESTED_DISAPPROVAL"


def test_single_incidental_whole_word_still_not_flagged():
    # The repeated-match fallback must still require 2+ SEPARATE blocks --
    # a single genuine whole-word match with no residency context (e.g.
    # an officer's surname happening to be a real barangay name) must
    # stay unflagged, same as before this fallback existed.
    blocks = [block("Certified by: Atty. Juan Pulo, Election Officer")]
    result = extract_barangay(blocks)
    assert result.found is False
    assert result.metadata.get("flag") != "SUGGESTED_DISAPPROVAL"


# ── Residency region gate ──────────────────────────────────────────────
#
# Regression tests for the same class of bug found on institution
# matching (see AUTO_REUPLOAD_VERIFICATION_RULES.md): a bare "does this
# text appear ANYWHERE on the page" check is gameable -- a wrong/forged
# document could print "Mamatid" or "Barangay: Mamatid" somewhere with no
# real connection to the applicant's actual address (a stray footer line,
# a disclaimer, deliberately inserted boilerplate) and still pass. Since a
# Voter's Certificate is one fixed national COMELEC template (unlike a
# school-specific Registration Form), the residency field reliably sits
# in the same region -- confirmed at 21%-48% down the page on 3 real
# samples. page_h=1000 below puts the "region" at y=100-650 (10%-65%).

def block_at(text, y_center, page_h=1000, conf=0.95):
    half = 10
    return OcrBlock(text=text, confidence=conf, x_min=0, y_min=y_center - half, x_max=200, y_max=y_center + half)


def test_mamatid_outside_region_does_not_count_as_positive_match():
    # "Mamatid" printed far down the page (e.g. a footer/disclaimer) must
    # NOT count the same as a genuine residency field.
    far_footer = block_at("Mamatid mentioned here for no real reason", y_center=900)
    result = extract_barangay([far_footer], page_h=1000)
    assert result.found is False
    assert result.value != "Mamatid"


def test_mamatid_inside_region_still_counts():
    in_region = block_at("Barangay Mamatid City of Cabuyao", y_center=300)
    result = extract_barangay([in_region], page_h=1000)
    assert result.found is True
    assert result.value == "Mamatid"


def test_contradiction_outside_region_does_not_flag():
    far_footer = block_at("Address: Brgy. Banlic, Cabuyao, Laguna", y_center=920)
    result = extract_barangay([far_footer], page_h=1000)
    assert result.metadata.get("flag") != "SUGGESTED_DISAPPROVAL"


def test_contradiction_inside_region_still_flags():
    in_region = block_at("Address: Brgy. Banlic, Cabuyao, Laguna", y_center=300)
    result = extract_barangay([in_region], page_h=1000)
    assert result.found is False
    assert result.value == "Banlic"
    assert result.metadata.get("flag") == "SUGGESTED_DISAPPROVAL"


def test_repeated_match_tier_requires_both_occurrences_in_region():
    # Regression guard for a gaming attempt: repeating the target barangay
    # name once in-region and once far outside it must NOT be enough --
    # otherwise a forger could bypass the region gate above simply by
    # adding a second, off-region mention.
    in_region = block_at("Marinig", y_center=300)
    out_of_region = block_at("Marinig", y_center=950)
    result = extract_barangay([in_region, out_of_region], page_h=1000)
    assert result.metadata.get("flag") != "SUGGESTED_DISAPPROVAL"


def test_repeated_match_tier_still_works_when_both_in_region():
    # Confirms the real "Rranguy"/garbled-context rescue (see
    # test_repeated_barangay_rescued_when_label_and_context_both_garbled)
    # still works now that it's also region- AND municipal-context-gated --
    # real y-positions from that actual document (page height 3331):
    # "Rranguy"/"MARINIG" at 21%, "Resldence"/"MARINIG" at 31-32%, and
    # "CITY OF CABUYAO"/"LAGUNA" immediately after at 33-35%.
    label = block_at("Rranguy", y_center=214)
    value = block_at(":MARINIG", y_center=214)
    context = block_at("Resldence", y_center=311)
    value2 = block_at("MARINIG", y_center=322)
    city = block_at("CITY OF CABUYAO", y_center=335)
    province = block_at("LAGUNA", y_center=346)
    result = extract_barangay([label, value, context, value2, city, province], page_h=1000)
    assert result.found is False
    assert result.value == "Marinig"
    assert result.metadata.get("flag") == "SUGGESTED_DISAPPROVAL"


def test_no_page_h_provided_skips_region_check():
    # page_h is optional -- callers/tests that don't pass it get the old,
    # unrestricted behavior rather than an error.
    far_footer = block_at("Mamatid mentioned here", y_center=900)
    result = extract_barangay([far_footer])
    assert result.found is True
    assert result.value == "Mamatid"


def test_mamatid_in_region_without_cabuyao_laguna_anywhere_does_not_count():
    # Position alone isn't enough -- a lone "Mamatid" mention in the right
    # VERTICAL band but with no "Cabuyao"/"Laguna" anywhere in that same
    # region doesn't read like a genuine Cabuyao, Laguna address at all.
    # Combines with the region gate rather than replacing it (see
    # _municipal_context_present).
    lone_mention = block_at("Mamatid was mentioned in passing", y_center=300)
    result = extract_barangay([lone_mention], page_h=1000)
    assert result.found is False
    assert result.value != "Mamatid"