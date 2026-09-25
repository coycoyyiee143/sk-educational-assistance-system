# app/extraction/school.py
from typing import List
from app.models import OcrBlock, ExtractionResult
from app.utils.spatial import get_blocks_in_region
from app.normalization.text_utils import fuzzy_match_school, combine_confidence, trim_to_match_window, normalize_name
from app.normalization import get_known_school_names

# Institution-name banners always contain one of these words in practice --
# used to recognize a confident header reading as SOME school's name even
# when that school isn't in our own known-schools roster (the applicant's
# declared-school dropdown). Confirmed on a real Registration Form where the
# header read "LAGUNA STATE POLYTECHNIC UNIVERSITY" -- a real, unrelated
# school that simply isn't one of the ~handful this system tracks -- so the
# known-school-only cross-check below never found it, and the declared
# school's match via an unrelated body disclaimer ("...National University
# Student Handbook...") passed unopposed.
_INSTITUTION_NAME_KEYWORDS = ("university", "college", "institute", "polytechnic", "academy")


def _looks_like_institution_name(text: str) -> bool:
    lowered = text.lower()
    return any(kw in lowered for kw in _INSTITUTION_NAME_KEYWORDS)


def _header_missing_declared_school_words(header_text: str, declared_school: str) -> bool:
    """
    True when the header text is missing at least one word of the
    declared school's official name -- a genuine header match should
    contain essentially the whole name verbatim (school headers don't
    abbreviate), so a missing word means this banner isn't reading as the
    declared school at all.

    Deliberately NOT reusing fuzzy_match_school()'s score here: that
    function's partial_ratio/token_sort_ratio blend is tuned to tolerate
    OCR noise on a genuine match, which also means it credits a
    completely different school highly whenever the two names happen to
    share a common generic word -- confirmed on the real bug this guards
    against, where "LAGUNA STATE POLYTECHNIC UNIVERSITY" scored 78.8
    against declared "National University" purely from sharing the word
    "UNIVERSITY", even though the schools are entirely unrelated.
    """
    declared_words = set(normalize_name(declared_school).split())
    header_words = set(normalize_name(header_text).split())
    return not declared_words.issubset(header_words)


def _find_school_match(header_region_blocks: List[OcrBlock], all_blocks: List[OcrBlock],
                        header_blocks_sorted: List[OcrBlock], school_name: str):
    """
    Runs the same 3-tier search (header region, then full-page scan, then
    incremental header-join) used to find `school_name` on the page.

    Returns (result, best_block): `result` is an ExtractionResult on a
    pass, else None. `best_block` is whichever header/full-scan block
    scored highest against `school_name` even if nothing passed --
    callers use it as the "closest guess" display value on failure.

    Shared by both the declared-school search and the "which OTHER
    school is this" fallback below, so both get the identical matching
    strategy rather than the fallback settling for whatever text
    happened to score best against a DIFFERENT school.
    """
    def score(text: str) -> float:
        return fuzzy_match_school(text, school_name)["score"]

    def passes(text: str) -> bool:
        return fuzzy_match_school(text, school_name)["passed"]

    best_block, best_score = None, 0

    def is_better(s, block):
        if s > best_score:
            return True
        if s == best_score and best_block and len(block.text) > len(best_block.text):
            return True
        return False

    for block in header_region_blocks:
        s = score(block.text)
        if is_better(s, block):
            best_score, best_block = s, block

    if best_score >= 85 and best_block and passes(best_block.text):
        combined = combine_confidence(best_block.confidence, best_score)
        trimmed = trim_to_match_window(best_block.text, school_name)
        return ExtractionResult(value=trimmed, raw=best_block.text, method="position", confidence=combined, context='found in header'), best_block

    for block in all_blocks:
        s = score(block.text)
        if is_better(s, block):
            best_score, best_block = s, block

    if best_score >= 85 and best_block and passes(best_block.text):
        combined = combine_confidence(best_block.confidence, best_score)
        trimmed = trim_to_match_window(best_block.text, school_name)
        return ExtractionResult(value=trimmed, raw=best_block.text, method="pattern_scan", confidence=combined, context='found via layout scan'), best_block

    if header_blocks_sorted:
        combined_blocks = []
        combined_text = ""
        combined_score = 0
        for block in header_blocks_sorted:
            combined_blocks.append(block)
            combined_text = " ".join(b.text for b in combined_blocks)
            combined_score = score(combined_text)
            if combined_score >= 85 and passes(combined_text):
                break

        if combined_score >= 85 and passes(combined_text):
            combined_confidence = sum(b.confidence for b in combined_blocks) / len(combined_blocks)
            combined = combine_confidence(combined_confidence, combined_score)
            trimmed = trim_to_match_window(combined_text, school_name)
            return ExtractionResult(
                value=trimmed, raw=combined_text, method="header_join",
                confidence=combined, context='found in header (multi-line)',
            ), best_block

    return None, best_block


def extract_school(blocks: List[OcrBlock], page_w: float, page_h: float, declared_school: str) -> ExtractionResult:
    header_region_blocks = get_blocks_in_region(blocks, page_w, page_h, "header")
    # School names are frequently split across multiple stacked OCR lines
    # -- e.g. a 3-line stylized logo reads as "Polytechnic" / "University"
    # / "of the Philippines" -- and scoring each line individually against
    # the FULL expected name means every lone fragment fails
    # fuzzy_match_school()'s length-ratio guard before any real comparison
    # happens. Join every block in the header region (top-to-bottom,
    # left-to-right reading order) as one combined candidate to catch that
    # case for schools with no dedicated strategy to pre-merge their
    # header.
    header_blocks_sorted = sorted(header_region_blocks, key=lambda b: (b.y_min, b.x_min))

    result, declared_best_block = _find_school_match(header_region_blocks, blocks, header_blocks_sorted, declared_school)

    # Even when the declared school matched, that match might have come
    # from body/boilerplate text (method != "position") rather than the
    # header itself -- e.g. a reused disclaimer paragraph mentioning the
    # declared school's name while the ACTUAL header confidently shows a
    # different, specific school entirely. Confirmed on a real
    # Registration Form edited to swap only its header for testing: the
    # declared school ("National University") matched via a "...National
    # University Student Handbook..." disclaimer elsewhere on the page,
    # while the real header confidently read "STI COLLEGE CALAMBA" --
    # completely missed, since the declared-school match already
    # succeeded and returned before anything ever checked the header
    # against any OTHER school. A genuinely wrong real-world upload would
    # show the true school in ITS header too (not just scattered body
    # text), so checking the header specifically -- the single most
    # authoritative position for a document's actual institution -- whenever
    # the declared match didn't itself come from there closes this gap
    # without needing a positional heuristic on where boilerplate usually
    # sits (fragile -- boilerplate can be anywhere, the header can't).
    if not result or result.method != "position":
        header_other_school = None
        header_other_result = None
        for other_school in get_known_school_names(exclude=declared_school):
            other_header_result, _ = _find_school_match(
                header_region_blocks, header_region_blocks, header_blocks_sorted, other_school
            )
            if other_header_result and (
                header_other_result is None or other_header_result.confidence > header_other_result.confidence
            ):
                header_other_school, header_other_result = other_school, other_header_result

        if header_other_school:
            return ExtractionResult(
                value=header_other_result.value, raw=header_other_result.raw,
                method="none", confidence=0.0, context='school mismatch', found=False,
                metadata={
                    "detected_school": header_other_school,
                    "detected_confidence": header_other_result.confidence,
                    # best_score is only ever read by callers when
                    # detected_school is absent -- kept at 0 rather than a
                    # misleading value derived from a different (0-1
                    # confidence, not 0-100 fuzzy score) scale.
                    "best_score": 0,
                },
            )

    # Nothing on the known-schools roster matched the header, but the
    # declared school DID match elsewhere (body text) -- the header can
    # still confidently show an institution name we simply don't
    # recognize (a real school we don't track). Deliberately scoped to
    # ONLY this case (result found, just not from the header) rather than
    # also the "nothing matched declared school at all" case below: that
    # case is handled by its own known-schools-only fallback further down
    # and must stay ambiguous/verifier-routed per this project's no-
    # fraud-judgment principle (see AUTO_REUPLOAD_VERIFICATION_RULES.md)
    # -- confirmed by a real UPHSD form whose header misread as "CALAMBA
    # SOUTHERN UNIVERSITY" (a garbled OCR read, not a real school) wrongly
    # tripping this same institution-keyword heuristic before this scoping
    # was added. Only the topmost header block is checked: that's the
    # banner position, not incidental header text like an address line or
    # "Office of the Registrar", which wouldn't contain an institution
    # keyword anyway.
    if result and result.method != "position" and header_blocks_sorted:
        top_header = header_blocks_sorted[0]
        if (
            top_header.confidence >= 0.85
            and _looks_like_institution_name(top_header.text)
            and _header_missing_declared_school_words(top_header.text, declared_school)
        ):
            return ExtractionResult(
                value=top_header.text, raw=top_header.text,
                method="none", confidence=0.0, context='school mismatch', found=False,
                metadata={
                    "detected_school": top_header.text.strip().title(),
                    "detected_confidence": top_header.confidence,
                    "best_score": 0,
                },
            )

    if result:
        return result

    # Nothing matched the declared school -- before giving up, check
    # whether the page actually matches a DIFFERENT known school, using
    # the identical 3-tier search rather than reusing whatever text
    # happened to score best against the declared school (that text is
    # picked for similarity to the WRONG school and can easily miss a
    # confident, clearly-different-school header entirely -- e.g. a
    # Registration Form's boilerplate consent paragraph mentioning
    # "University of the Philippines System" can outscore the actual
    # document header naming a completely different school). That's a
    # much more actionable signal than a bare "school mismatch" (mirrors
    # check_document_type()'s "this looks like a School ID, not a
    # Registration Form" treatment for the wrong document type).
    detected_school = None
    detected_result = None
    for other_school in get_known_school_names(exclude=declared_school):
        other_result, _ = _find_school_match(header_region_blocks, blocks, header_blocks_sorted, other_school)
        if other_result and (detected_result is None or other_result.confidence > detected_result.confidence):
            detected_school, detected_result = other_school, other_result

    # best_score lets callers (see _check_school's flag_reason wording)
    # distinguish "this text is genuinely close to the declared school,
    # just short of the pass bar" from "this is just whichever unrelated
    # text happened to score least-badly" -- declared_best_block is
    # whatever scored HIGHEST even when that's nowhere close, e.g. a
    # course-description line scoring ~38 purely from incidental shared
    # words like "of" (confirmed on a real PUP School ID where OCR missed
    # the header almost entirely). Without this, a caller has no way to
    # tell a near-miss from a coincidence and risks calling the latter
    # "text resembling" the school, which overstates how close it is.
    best_score = (
        fuzzy_match_school(declared_best_block.text, declared_school)["score"]
        if declared_best_block else 0
    )

    return ExtractionResult(
        value=declared_best_block.text if declared_best_block else None,
        raw=declared_best_block.text if declared_best_block else None,
        method="none", confidence=0.0, context='school mismatch', found=False,
        metadata={
            **({"detected_school": detected_school} if detected_school else {}),
            # Lets shared.py's _check_school_or_reupload() gate a confident
            # different-school detection the same way name_mismatch gates
            # on CONFIDENT_MISMATCH_THRESHOLD -- a detected_school alone
            # only means it passed its own 85 fuzzy-score threshold, not
            # that the underlying OCR read was itself reliable.
            **({"detected_confidence": detected_result.confidence} if detected_result else {}),
            "best_score": best_score,
        },
    )
