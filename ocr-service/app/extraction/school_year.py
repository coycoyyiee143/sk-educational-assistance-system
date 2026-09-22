# app/extraction/school_year.py
from typing import List
from app.models import OcrBlock, ExtractionResult
from app.utils.spatial import get_blocks_in_region
from app.normalization import get_strategy_for_school
from app.normalization.text_utils import fix_ocr_symbols
from app.extraction.keyword_engine import extract_via_keyword
from app.extraction.blocks import extraction_failed

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
            return ExtractionResult(value=normalized, raw=raw, method="keyword", confidence=combined_confidence, context=f'found {context}')

    for block in get_blocks_in_region(blocks, page_w, page_h, "top_half"):
        normalized = strategy.extract_school_year(fix_ocr_symbols(block.text), configured_year)

        if normalized:
            return ExtractionResult(value=normalized, raw=block.text, method="pattern_scan", confidence=block.confidence, context=f'pattern matched: "{block.text[:40]}"')

    return extraction_failed("school_year", "no matching school year format found")