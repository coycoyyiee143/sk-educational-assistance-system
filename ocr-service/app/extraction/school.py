# app/extraction/school.py
from typing import List
from app.models import OcrBlock, ExtractionResult
from app.utils.spatial import get_blocks_in_region
from app.normalization.text_utils import fuzzy_match_school, combine_confidence, trim_to_match_window
from app.normalization import get_known_school_names

def extract_school(blocks: List[OcrBlock], page_w: float, page_h: float, declared_school: str) -> ExtractionResult:
    def score_school(text: str) -> float:
        return fuzzy_match_school(text, declared_school)["score"]

    # fuzzy_match_school() computes its OWN pass/fail via "passed", which
    # additionally requires the expected name's distinguishing word (e.g.
    # "LOS"/"BANOS" for UPLB) to actually appear in the extracted text --
    # not just a high aggregate score. Every ">= 85" check below used to
    # look at score_school()'s raw score alone, silently bypassing that
    # guard entirely. Confirmed as a real false positive, not
    # hypothetical: a genuine PUP School ID scanned for a UPLB-declared
    # applicant (Nicole Marquez, case 191) scored 85.29 in aggregate
    # against "University of the Philippines Los Baños" -- purely from
    # sharing "University of the Philippines" -- and passed
    # institution_match outright, despite the ID literally naming a
    # different university and containing neither "Los" nor "Baños"
    # anywhere. fuzzy_match_school() itself already said passed=False for
    # this exact text; extract_school() just wasn't listening.
    def passes_school(text: str) -> bool:
        return fuzzy_match_school(text, declared_school)["passed"]

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

    if best_score >= 85 and best_block and passes_school(best_block.text):
        combined = combine_confidence(best_block.confidence, best_score)
        trimmed = trim_to_match_window(best_block.text, declared_school)
        return ExtractionResult(value=trimmed, raw=best_block.text, method="position", confidence=combined, context='found in header')

    for block in blocks:
        score = score_school(block.text)
        if is_better(score, block):
            best_score, best_block = score, block

    if best_score >= 85 and best_block and passes_school(best_block.text):
        combined = combine_confidence(best_block.confidence, best_score)
        trimmed = trim_to_match_window(best_block.text, declared_school)
        return ExtractionResult(value=trimmed, raw=best_block.text, method="pattern_scan", confidence=combined, context='found via layout scan')

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
        # Built up incrementally, one block at a time, stopping the
        # instant the joined-so-far text already scores a match --
        # rather than joining every header block first and scoring once
        # at the end. A compact multi-line logo (the case this exists
        # for) only needs 2-3 blocks before it scores >=85; blindly
        # joining the REST of the header region afterward (student
        # number, form title, a whole consent paragraph on some
        # templates) only adds noise to the displayed value for no
        # matching benefit. Confirmed on a real UPLB Registration Form:
        # the university name matched within the first few header
        # blocks, but the old join-everything-first approach kept going
        # and swept in the entire admission-consent paragraph, producing
        # an "extracted" value hundreds of characters past what actually
        # mattered.
        combined_blocks = []
        combined_text = ""
        combined_score = 0
        for block in header_blocks:
            combined_blocks.append(block)
            combined_text = " ".join(b.text for b in combined_blocks)
            combined_score = score_school(combined_text)
            if combined_score >= 85 and passes_school(combined_text):
                break

        if combined_score >= 85 and passes_school(combined_text):
            combined_confidence = sum(b.confidence for b in combined_blocks) / len(combined_blocks)
            combined = combine_confidence(combined_confidence, combined_score)
            trimmed = trim_to_match_window(combined_text, declared_school)
            return ExtractionResult(
                value=trimmed, raw=combined_text, method="header_join",
                confidence=combined, context='found in header (multi-line)',
            )

    # Nothing matched the declared school -- before giving up, check
    # whether the header text actually matches a DIFFERENT known school.
    # That's a much more actionable signal than a bare "school mismatch"
    # (mirrors check_document_type()'s "this looks like a School ID, not
    # a Registration Form" treatment for the wrong document type).
    # Reuses whatever candidate text scored highest against the declared
    # school above -- the same text is the best guess for what's
    # actually printed on the header, regardless of which school it
    # turns out to belong to.
    candidate_text = best_block.text if best_block else None
    if header_blocks and combined_text and len(combined_text) > len(candidate_text or ""):
        candidate_text = combined_text

    detected_school = None
    if candidate_text:
        best_other_score = 0
        for other_school in get_known_school_names(exclude=declared_school):
            match = fuzzy_match_school(candidate_text, other_school)
            if match["passed"] and match["score"] > best_other_score:
                detected_school, best_other_score = other_school, match["score"]

    return ExtractionResult(
        value=best_block.text if best_block else None, raw=best_block.text if best_block else None,
        method="none", confidence=0.0, context='school mismatch', found=False,
        metadata={"detected_school": detected_school} if detected_school else {},
    )