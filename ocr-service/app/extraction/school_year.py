# app/extraction/school_year.py
from typing import List
from app.models import OcrBlock, ExtractionResult
from app.utils.spatial import get_blocks_in_region
from app.normalization import get_strategy_for_school
from app.extraction.keyword_engine import extract_via_keyword
from app.extraction.blocks import extraction_failed

def extract_school_year(blocks: List[OcrBlock], page_w: float, page_h: float,
                       school_name: str = None, configured_year: str = None) -> ExtractionResult:
    strategy = get_strategy_for_school(school_name)

    result = extract_via_keyword(blocks, "school_year")

    if result:
        raw, context, value_block, label_block = result
        normalized = strategy.extract_school_year(raw, configured_year)
        if normalized:
            combined_confidence = min(value_block.confidence, label_block.confidence)
            return ExtractionResult(value=normalized, raw=raw, method="keyword", confidence=combined_confidence, context=f'found {context}')

    for block in get_blocks_in_region(blocks, page_w, page_h, "top_half"):
        normalized = strategy.extract_school_year(block.text, configured_year)

        if normalized:
            return ExtractionResult(value=normalized, raw=block.text, method="pattern_scan", confidence=block.confidence, context=f'pattern matched: "{block.text[:40]}"')

    return extraction_failed("school_year", "no matching school year format found")