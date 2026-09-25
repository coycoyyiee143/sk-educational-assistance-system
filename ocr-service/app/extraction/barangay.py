# app/extraction/barangay.py
import re
from typing import List
from app.models import OcrBlock, ExtractionResult
from app.extraction.keyword_engine import extract_via_keyword
from app.extraction.blocks import extraction_failed

# Words that plausibly indicate a block is actually talking about an
# address/residence, not a name, a signature line, or anything else
# that happens to contain a barangay-shaped word. Used ONLY by the
# fallback whole-page scan below (see _residency_context_present).
_RESIDENCY_CONTEXT_WORDS = ("resid", "address", "brgy", "barangay")

# The specific label words that legitimately end up glued directly onto
# a value with no separator (e.g. "BarangayPULO", "BarangayMamatid") --
# a real, common OCR artifact on this document type, not a hypothetical.
# Used only to retry a failed word-boundary check once with the label
# stripped off the front; see _contains_word.
_LABEL_PREFIX_RE = re.compile(r'^(?:barangay|brgy\.?)')


def _contains_word(text_lower: str, word: str) -> bool:
    """
    Word-boundary match, NOT a bare substring check. A bare `word in
    text_lower` check lets a short Filipino barangay name that happens
    to also be a substring of an unrelated word trigger a false match
    -- concretely, "sala" (Brgy. Sala) is a literal substring of real
    Filipino surnames like "Salazar" and "Salas". Fixed by requiring
    the match to be its own word, not a fragment of one.

    One deliberate exception: if the plain word-boundary check fails,
    retry once with a leading "barangay"/"brgy" label prefix stripped
    off the text. OCR frequently glues the label directly onto its own
    value with no space at all (e.g. "BarangayPULO") -- \\b can't find a
    boundary in the middle of an unbroken run of letters, so a genuine,
    confidently-labeled value would otherwise fall through to "not
    captured cleanly" instead of being read at all. This is narrower
    than reverting to a bare substring check: it only fires right after
    the label word itself, so it doesn't reopen the "sala" inside
    "Salazar" false-positive this function exists to prevent.
    """
    if re.search(rf'\b{re.escape(word)}\b', text_lower):
        return True
    stripped = _LABEL_PREFIX_RE.sub('', text_lower, count=1)
    if stripped != text_lower:
        return re.search(rf'\b{re.escape(word)}\b', stripped) is not None
    return False


# Confirmed on real Voter's Certificates: the barangay/residence field
# always sits between ~25% and ~48% down the page. Unlike a school-specific
# Registration Form (layout varies per school, no single "right" region),
# a Voter's Certificate is one fixed national COMELEC template, so this is
# a meaningful, reusable signal. Generous margin on both sides (10%-65%)
# to tolerate real scan/skew variance without being so wide it stops
# excluding the class of bug this exists for: a stray "Mamatid"/barangay
# mention buried in unrelated footer/disclaimer text near the bottom of
# the page (confirmed on the institution-name equivalent of this exact
# bug -- see AUTO_REUPLOAD_VERIFICATION_RULES.md). A gamed/forged document
# that prints "Barangay: Mamatid" somewhere off in a footer, hoping to
# slip past a bare text search, no longer counts unless it's actually
# printed where COMELEC's real form puts it.
_RESIDENCY_REGION = (0.10, 0.65)


def _in_residency_region(block: OcrBlock, page_h: float) -> bool:
    if not page_h:
        return True  # can't judge position without a page height -- don't block on it
    y_center = (block.y_min + block.y_max) / 2
    return _RESIDENCY_REGION[0] <= (y_center / page_h) <= _RESIDENCY_REGION[1]


def _municipal_context_present(blocks: List[OcrBlock], page_h: float) -> bool:
    """
    Combines with _in_residency_region rather than replacing it: position
    alone only says "this text is roughly where the address should be" --
    it says nothing about whether the SURROUNDING content actually reads
    like a Cabuyao, Laguna address at all. Confirmed on 3 real Voter's
    Certificates that "Cabuyao"/"Laguna" always appears SOMEWHERE within
    the same residency region as the barangay line (not necessarily
    adjacent to it -- the "Barangay:" label and the fuller "Residence: ...
    City of Cabuyao, Laguna" line are often separate blocks a fair
    distance apart), so this checks the whole region rather than requiring
    tight proximity to the specific matched block. Skipped entirely (True)
    when page_h isn't available, same as _in_residency_region.
    """
    if not page_h:
        return True
    for b in blocks:
        if not _in_residency_region(b, page_h):
            continue
        t = b.text.lower()
        if _contains_word(t, "cabuyao") or _contains_word(t, "laguna"):
            return True
    return False


def _residency_context_present(text_lower: str) -> bool:
    """
    Whether this block plausibly represents address/residency
    information at all, as opposed to a name, a signature line, a
    watermark, or any other text that happens to contain a
    barangay-shaped word.

    Why this exists: word-boundary matching (_contains_word) only
    prevents ACCIDENTAL substring collisions like "sala" inside
    "salamat" or "Salazar". It does nothing about a barangay name
    landing as a genuine, correctly-matched WHOLE WORD in the wrong
    kind of field -- e.g. the certifying Election Officer's own
    surname literally being "Salazar" or "Salas" (real, common Filipino
    surnames), printed in a signature block like "Certified by: Atty.
    Maria Salazar, Election Officer". That block has nothing to do with
    the applicant's residency, but a blind whole-page word scan can't
    tell the difference on its own. And unlike a random unlucky
    coincidence, this specific failure mode is systematic: whichever
    officer is assigned to sign certificates for an area would trigger
    it on EVERY certificate they sign, for as long as they hold that
    post -- not a rare one-off edge case.

    This check is intentionally cheap and permissive (looking for any
    of a few residency-related words anywhere in the same block) rather
    than a strict field-position rule, since there's no reliable
    spatial "this is the address region" signal available here the way
    there is for e.g. header-anchored school-name extraction. It's a
    coarse filter, not a precise one -- see the docstring on
    extract_barangay's fallback loop for what this does and doesn't
    protect against.
    """
    return any(w in text_lower for w in _RESIDENCY_CONTEXT_WORDS)


def extract_barangay(blocks: List[OcrBlock], page_h: float = None) -> ExtractionResult:
    """
    Extract barangay data. Triggers Suggested Disapproval with bounding box
    metadata if a contrasting local Laguna barangay layout is read.

    page_h is optional (defaults to no position check at all, for any
    caller/test that doesn't have it handy) but should be passed whenever
    available -- see _in_residency_region for why it matters: without it,
    a barangay name mentioned ANYWHERE on the page (a disclaimer, a
    footer, unrelated boilerplate) would count exactly the same as a
    genuine residency field.
    """
    # Cabuyao, Laguna's full 18 barangays -- confirmed missing "Casile" on
    # a real Voter's Certificate (label "Barangay" / value "CASILE" both
    # read cleanly, but with no entry to match against it fell all the way
    # through to a generic "not captured cleanly" instead of flagging the
    # contradiction). Filled in the rest of the real list at the same time
    # rather than waiting to hit each remaining gap one at a time.
    known_laguna_barangays = [
        "banlic", "pulo", "sala", "niugan", "san isidro", "marinig",
        "diezmo", "gulod", "baclaran", "mamatid", "bigaa", "butong",
        "casile", "banay-banay", "pittland", "bagumbayan",
        "poblacion uno", "poblacion dos", "poblacion tres",
    ]

    result = extract_via_keyword(blocks, "barangay")

    # Combined with _in_residency_region below: position says "roughly
    # the right place", this says "the surrounding content actually reads
    # like a Cabuyao, Laguna address" -- computed once, reused by every
    # match branch below. See _municipal_context_present's docstring.
    municipal_context_ok = _municipal_context_present(blocks, page_h)

    # A genuine "Barangay:" LABEL is a strong signal on its own, but not
    # an unconditional one -- a forged/edited document could print
    # "Barangay: Mamatid" anywhere, including somewhere far from where
    # COMELEC's real form ever puts it, specifically to slip past a bare
    # text search. Requiring the label to actually sit where it should,
    # AND that "Cabuyao"/"Laguna" genuinely appears somewhere in that same
    # region, closes that gap the same way the unanchored fallback below
    # needs to.
    if result and _in_residency_region(result[2], page_h) and municipal_context_ok:
        raw, context, target_block, label_block = result
        raw_lower = raw.lower()
        combined_confidence = min(target_block.confidence, label_block.confidence)

        # Plain substring check here, NOT _contains_word -- an OCR read
        # can glue "Barangay" and "Mamatid" into one token with no space
        # (e.g. "BarangayMamatid"), which a \b word-boundary match can't
        # see. Safe to stay loose here since this is the POSITIVE match:
        # worst case of a false hit is a wrong residency pass, not an
        # accusatory flag -- unlike the contradiction path below, which
        # still needs the stricter word-boundary check.
        if "mamatid" in raw_lower:
            return ExtractionResult(value="Mamatid", raw=raw, method="keyword", confidence=combined_confidence, context=f'found {context}')

        for brgy in known_laguna_barangays:
            if brgy != "mamatid" and _contains_word(raw_lower, brgy):
                # value/raw carry the actually-detected barangay (not None,
                # which extraction_failed() would otherwise force) so a
                # verifier sees "Banlic" in EXTRACTED VALUE instead of
                # "not extracted" -- the flag_reason already names it, but
                # that shouldn't be the ONLY place it shows up.
                return ExtractionResult(
                    value=brgy.title(), raw=raw, method="keyword", confidence=combined_confidence,
                    context=f"Contradiction: Detected Brgy. {brgy.title()} on the document, not the declared Mamatid.",
                    found=False,
                    metadata={"flag": "SUGGESTED_DISAPPROVAL", "bbox": [target_block.x_min, target_block.y_min, target_block.x_max, target_block.y_max]}
                )

    # Fallback: no "Barangay" label found anywhere on the page at all.
    # Restricted to the expected residency region from here on -- without
    # it, a "Mamatid"/barangay mention ANYWHERE on the page (a disclaimer,
    # a footer, unrelated boilerplate) would count exactly the same as a
    # genuine residency field. Confirmed necessary on the institution-name
    # equivalent of this exact bug (see AUTO_REUPLOAD_VERIFICATION_RULES.md)
    # -- a full-page match with no positional check let a wrong document
    # pass simply because the right words appeared somewhere unrelated.
    # Flagging a CONTRADICTION additionally requires the matching block to
    # also look like it's actually about residency (see
    # _residency_context_present) -- without that, a name, signature, or
    # any other unrelated text block in the region could still trigger an
    # accusatory false flag.
    for block in blocks:
        if not _in_residency_region(block, page_h) or not municipal_context_ok:
            continue
        txt_lower = block.text.lower()

        # Same reasoning as the anchored-match branch above: stay loose
        # (plain substring) for the positive Mamatid match so a glued
        # OCR token like "BarangayMamatid" still counts.
        if "mamatid" in txt_lower:
            return ExtractionResult(value="Mamatid", raw=block.text, method="pattern_scan", confidence=block.confidence, context=f'found in: "{block.text}"')

        if not _residency_context_present(txt_lower):
            continue

        for brgy in known_laguna_barangays:
            if brgy != "mamatid" and _contains_word(txt_lower, brgy):
                # See the anchored-match branch above for why value/raw
                # carry the detected barangay instead of None here.
                return ExtractionResult(
                    value=brgy.title(), raw=block.text, method="pattern_scan", confidence=block.confidence,
                    context=f"Contradiction: Detected Brgy. {brgy.title()} on the document, not the declared Mamatid.",
                    found=False,
                    metadata={"flag": "SUGGESTED_DISAPPROVAL", "bbox": [block.x_min, block.y_min, block.x_max, block.y_max]}
                )

    # Last-resort fallback: a genuine barangay name appearing as its own
    # whole word in TWO OR MORE separate blocks, independently, is a much
    # stronger signal than the single-block context-word gate above
    # requires -- an unrelated coincidental whole-word match (the "officer
    # surname" false-positive class _residency_context_present() guards
    # against) is very unlikely to repeat across more than one distinct
    # block on the same page purely by chance. This specifically rescues
    # documents where BOTH the "Barangay:" label AND the nearby context
    # word are independently garbled by OCR in different, unrelated ways
    # -- confirmed on a real Voter's Certificate reading "Rranguy" (label,
    # too corrupted even for the fuzzy label fallback in keyword_engine.py)
    # and "Resldence" (context word, typo'd, so _residency_context_present
    # never matches it either) while the actual barangay name "MARINIG"
    # still came through cleanly -- twice, in two unrelated places
    # (once next to the garbled label, once in the address block).
    # Still restricted to the residency region -- otherwise a forged
    # document could just repeat the target barangay name twice in a
    # footer/disclaimer to slip past the region gate above via THIS tier
    # instead, defeating the point of adding it to the other two.
    match_blocks = {}
    for block in blocks:
        if not _in_residency_region(block, page_h) or not municipal_context_ok:
            continue
        txt_lower = block.text.lower()
        if "mamatid" in txt_lower:
            continue
        for brgy in known_laguna_barangays:
            if brgy != "mamatid" and _contains_word(txt_lower, brgy):
                match_blocks.setdefault(brgy, []).append(block)

    for brgy, matching in match_blocks.items():
        if len(matching) >= 2:
            anchor = matching[0]
            return ExtractionResult(
                value=brgy.title(), raw=anchor.text, method="pattern_scan", confidence=anchor.confidence,
                context=f"Contradiction: Detected Brgy. {brgy.title()} on the document, not the declared Mamatid.",
                found=False,
                metadata={"flag": "SUGGESTED_DISAPPROVAL", "bbox": [anchor.x_min, anchor.y_min, anchor.x_max, anchor.y_max]}
            )

    return extraction_failed("barangay", "Barangay text line not captured cleanly")