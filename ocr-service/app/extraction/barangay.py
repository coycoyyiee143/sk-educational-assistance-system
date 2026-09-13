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


def _contains_word(text_lower: str, word: str) -> bool:
    """
    Word-boundary match, NOT a bare substring check. A bare `word in
    text_lower` check lets a short Filipino barangay name that happens
    to also be a substring of an unrelated word trigger a false match
    -- concretely, "sala" (Brgy. Sala) is a literal substring of real
    Filipino surnames like "Salazar" and "Salas". Fixed by requiring
    the match to be its own word, not a fragment of one.

    Trade-off worth knowing: this can miss an OCR read that glued two
    words together with no space (e.g. "BarangayMamatid" as one token)
    -- \\b won't find a boundary in the middle of an unbroken run of
    letters. Judged an acceptable trade for the fallback path this is
    used in: a false SUGGESTED_DISAPPROVAL sends a legitimate
    applicant's document to a verifier under an accusatory-sounding
    flag it doesn't deserve, which is a worse outcome than an
    occasional missed match falling through to "not captured cleanly"
    (verifier-routed either way, just without the false accusation).
    """
    return re.search(rf'\b{re.escape(word)}\b', text_lower) is not None


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


def extract_barangay(blocks: List[OcrBlock]) -> ExtractionResult:
    """
    Extract barangay data. Triggers Suggested Disapproval with bounding box
    metadata if a contrasting local Laguna barangay layout is read.
    """
    known_laguna_barangays = [
        "banlic", "pulo", "sala", "niugan", "san isidro", "marinig",
        "diezmo", "gulod", "baclaran", "mamatid", "bigaa", "butong"
    ]

    result = extract_via_keyword(blocks, "barangay")

    if result:
        # Anchored to an actual "Barangay"-labeled field -- already
        # inherently residency-context, no additional filtering needed
        # here the way the unanchored fallback below needs it.
        raw, context, target_block, label_block = result
        raw_lower = raw.lower()
        combined_confidence = min(target_block.confidence, label_block.confidence)

        if _contains_word(raw_lower, "mamatid"):
            return ExtractionResult(value="Mamatid", raw=raw, method="keyword", confidence=combined_confidence, context=f'found {context}')
        
        for brgy in known_laguna_barangays:
            if brgy != "mamatid" and _contains_word(raw_lower, brgy):
                return extraction_failed(
                    "barangay",
                    f"Contradiction: Detected residency layout pointing to Brgy. {brgy.title()}.",
                    metadata={"flag": "SUGGESTED_DISAPPROVAL", "bbox": [target_block.x_min, target_block.y_min, target_block.x_max, target_block.y_max]}
                )

    # Fallback: no "Barangay" label found anywhere on the page at all.
    # Confirming "Mamatid" here is still allowed without extra context
    # -- if wrong, the worst case is a missed positive match (falls
    # through to "not captured cleanly" below, verifier-routed anyway).
    # But flagging a CONTRADICTION here requires the matching block to
    # also look like it's actually about residency (see
    # _residency_context_present) -- without that, a name, signature,
    # or any other unrelated text block could trigger an accusatory
    # false flag on a document that never said anything about the
    # applicant's address at all.
    for block in blocks:
        txt_lower = block.text.lower()

        if _contains_word(txt_lower, "mamatid"):
            return ExtractionResult(value="Mamatid", raw=block.text, method="pattern_scan", confidence=block.confidence, context=f'found in: "{block.text}"')

        if not _residency_context_present(txt_lower):
            continue

        for brgy in known_laguna_barangays:
            if brgy != "mamatid" and _contains_word(txt_lower, brgy):
                return extraction_failed(
                    "barangay",
                    f"Contradiction: Detected residency layout pointing to Brgy. {brgy.title()}.",
                    metadata={"flag": "SUGGESTED_DISAPPROVAL", "bbox": [block.x_min, block.y_min, block.x_max, block.y_max]}
                )
            
    return extraction_failed("barangay", "Barangay text line not captured cleanly")