# app/extraction/school.py
from typing import List
from app.models import OcrBlock, ExtractionResult
from app.utils.spatial import get_blocks_in_region
from app.normalization.text_utils import fuzzy_match_school, combine_confidence

def extract_school(blocks: List[OcrBlock], page_w: float, page_h: float, declared_school: str) -> ExtractionResult:
    def score_school(text: str) -> float:
        return fuzzy_match_school(text, declared_school)["score"]

    best_block, best_score = None, 0

    def is_better(score, block):
        # partial_ratio (used inside score_school) scores a short
        # fragment as a perfect match whenever it aligns cleanly against
        # a SUBSTRING of the target — so a truncated watermark fragment
        # like "san ng Cabuyao" scores identically to the real, complete
        # header text "Pamantasan ng Cabuyao" (both hit 100). On a
        # watermark-heavy document, that fragment can appear dozens of
        # times; the genuine header appears once. Without a tiebreaker,
        # whichever the loop happens to reach first wins — pure luck of
        # detection order, increasingly likely to be the wrong one as
        # watermark noise increases. Preferring the LONGER text on a tie
        # correctly favors the complete header over a truncated fragment.
        if score > best_score:
            return True
        if score == best_score and best_block and len(block.text) > len(best_block.text):
            return True
        return False

    for block in get_blocks_in_region(blocks, page_w, page_h, "header"):
        score = score_school(block.text)
        if is_better(score, block):
            best_score, best_block = score, block

    if best_score >= 85 and best_block:
        combined = combine_confidence(best_block.confidence, best_score)
        return ExtractionResult(value=best_block.text, raw=best_block.text, method="position", confidence=combined, context='found in header')

    for block in blocks:
        score = score_school(block.text)
        if is_better(score, block):
            best_score, best_block = score, block

    if best_score >= 85 and best_block:
        combined = combine_confidence(best_block.confidence, best_score)
        return ExtractionResult(value=best_block.text, raw=best_block.text, method="pattern_scan", confidence=combined, context='found via layout scan')

    # Last resort: no single block (including any school-strategy's own
    # preprocess-merged header block, e.g. PUP's _merge_institution_header)
    # passed on its own. School names are frequently split across multiple
    # stacked OCR lines -- e.g. a 3-line stylized logo reads as
    # "Polytechnic" / "University" / "of the Philippines" -- and scoring
    # each line individually against the FULL expected name means every
    # lone fragment fails fuzzy_match_school()'s length-ratio guard before
    # any real comparison happens. Join every block in the header region
    # (top-to-bottom, left-to-right reading order) as one combined
    # candidate to catch that case for schools with no dedicated strategy
    # to pre-merge their header. Tried LAST, not first: it joins ALL
    # header-region text indiscriminately (name, student no., term, AY,
    # etc. on a compact document where everything sits in the top 25%),
    # so a school-specific merged block or clean single line -- both
    # already tried above -- makes a much less noisy displayed value and
    # should always win when available.
    header_blocks = sorted(
        get_blocks_in_region(blocks, page_w, page_h, "header"),
        key=lambda b: (b.y_min, b.x_min),
    )
    if header_blocks:
        combined_text = " ".join(b.text for b in header_blocks)
        combined_score = score_school(combined_text)
        if combined_score >= 85:
            combined_confidence = sum(b.confidence for b in header_blocks) / len(header_blocks)
            combined = combine_confidence(combined_confidence, combined_score)
            return ExtractionResult(
                value=combined_text, raw=combined_text, method="header_join",
                confidence=combined, context='found in header (multi-line)',
            )

    return ExtractionResult(value=best_block.text if best_block else None, raw=best_block.text if best_block else None, method="none", confidence=0.0, context='school mismatch', found=False)