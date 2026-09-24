# app/extraction/school_year.py
import re
from typing import List, Optional
from app.models import OcrBlock, ExtractionResult
from app.utils.spatial import get_blocks_in_region
from app.normalization import get_strategy_for_school
from app.normalization.text_utils import fix_ocr_symbols
from app.extraction.keyword_engine import extract_via_keyword
from app.extraction.blocks import extraction_failed


def _trim_to_year_window(text: str, padding: int = 10, max_length: int = 25) -> str:
    """
    Returns just a small window around the matched year, instead of the
    entire source block -- confirmed on a real UPHSD Registration Form
    where a successful match's `raw` was an entire table row
    ("1st 2025 - 2026 Encod689857 234111083", 38 characters), when only
    "2025 - 2026" within it actually mattered. Mirrors why
    trim_to_match_window() exists for school/name matching, but that
    helper is fuzzy-alignment-based (built for comparing two text strings)
    and doesn't apply here -- a school year is found via a fixed regex
    shape, not a similarity score, so a plain regex search for the same
    shape is the right tool.

    max_length is deliberately tight (not, say, 60) -- the real reported
    case above is only 38 characters and still needed trimming; a looser
    bound would have left it untouched. Padding stays small too so a
    clean short match (e.g. a bare "2025-2026") passes through unchanged
    (the ±10 window already covers the whole thing) while a genuinely
    noisy one gets cut down to just the year and its immediate neighbors.

    Falls back to returning `text` unchanged on anything already short, or
    if (unexpectedly) no year-shaped substring can be found in it.
    """
    if not text or len(text) <= max_length:
        return text
    match = re.search(r'20\d{2}[^0-9]{0,5}20\d{2}', text) or re.search(r'20\d{2}', text)
    if not match:
        return text
    start = max(0, match.start() - padding)
    end = min(len(text), match.end() + padding)
    return text[start:end]

# How many of the label's own line-heights to search vertically when its
# nearest-block guess didn't pan out (see _find_year_near_label below).
# Wide enough to reach a value 2-3 rows away in a cramped enrollment-form
# table (the real case this exists for), narrow enough to stay a "this
# specific label's vicinity" search rather than degrading into scanning
# unrelated, distant parts of the page.
_NEARBY_ROW_SPAN = 4


def _find_year_near_label(blocks: List[OcrBlock], label_block: OcrBlock, strategy, configured_year: Optional[str]):
    """
    Rescue path for when extract_via_keyword found the RIGHT label but the
    WRONG value -- confirmed on a real UPHSD Registration Form where
    "Sch.Yr." was correctly found, but "Ref.No." (an unrelated neighboring
    label, not the year) was the nearest "block to the right" and got
    returned instead; the actual "2025-2026" sat two rows further down.

    Deliberately scoped to a vertical window around the LABEL itself
    (ranked by closeness) rather than widening the search to the whole
    page/region: this only rescues a genuine near-miss right around where
    we already know the field lives, so it can't accidentally pick up an
    unrelated year-shaped number somewhere else in a long document (a
    birthdate, another table's date column, etc).
    """
    line_height = label_block.height or 1
    max_y_diff = line_height * _NEARBY_ROW_SPAN

    candidates = sorted(
        (b for b in blocks if b is not label_block and abs(b.y_center - label_block.y_center) <= max_y_diff),
        key=lambda b: abs(b.y_center - label_block.y_center),
    )

    for block in candidates:
        normalized = strategy.extract_school_year(fix_ocr_symbols(block.text), configured_year)
        if normalized:
            return block, normalized

    return None, None


def extract_school_year(blocks: List[OcrBlock], page_w: float, page_h: float,
                       school_name: str = None, configured_year: str = None) -> ExtractionResult:
    strategy = get_strategy_for_school(school_name)

    result = extract_via_keyword(blocks, "school_year")

    if result:
        raw, context, value_block, label_block = result
        # fix_ocr_symbols corrects ordinal misreads (e.g. "Ist Semester"
        # -> "1st Semester") that can sit right next to the SY value on
        # the same labeled line/cell -- applied before the strategy's
        # own regex runs, not after, so every school strategy benefits
        # uniformly instead of each one having to remember to call it.
        normalized = strategy.extract_school_year(fix_ocr_symbols(raw), configured_year)
        if normalized:
            combined_confidence = min(value_block.confidence, label_block.confidence)
            return ExtractionResult(value=normalized, raw=_trim_to_year_window(raw), method="keyword", confidence=combined_confidence, context=f'found {context}')

        nearby_block, nearby_normalized = _find_year_near_label(blocks, label_block, strategy, configured_year)
        if nearby_normalized:
            combined_confidence = min(nearby_block.confidence, label_block.confidence)
            return ExtractionResult(
                value=nearby_normalized, raw=_trim_to_year_window(nearby_block.text), method="keyword_nearby",
                confidence=combined_confidence, context=f'found near "{label_block.text.strip()}"',
            )

    for block in get_blocks_in_region(blocks, page_w, page_h, "top_half"):
        normalized = strategy.extract_school_year(fix_ocr_symbols(block.text), configured_year)

        if normalized:
            return ExtractionResult(value=normalized, raw=_trim_to_year_window(block.text), method="pattern_scan", confidence=block.confidence, context=f'pattern matched: "{block.text[:40]}"')

    return extraction_failed("school_year", "no matching school year format found")