# app/extraction/semester.py
from typing import List
from app.models import OcrBlock, ExtractionResult
from app.utils.spatial import get_blocks_in_region
from app.normalization import get_strategy_for_school
from app.extraction.keyword_engine import extract_via_keyword
from app.extraction.blocks import extraction_failed

def extract_semester(blocks: List[OcrBlock], page_w: float, page_h: float, school_name: str = None) -> ExtractionResult:
    strategy = get_strategy_for_school(school_name)

    result = extract_via_keyword(blocks, "semester")

    if result:
        raw, context, matched_block = result
        normalized = strategy.extract_semester(raw)
        if normalized:
            return ExtractionResult(value=normalized, raw=raw, method="keyword", confidence=matched_block.confidence, context=f'found {context}')

    for block in get_blocks_in_region(blocks, page_w, page_h, "top_half"):
        normalized = strategy.extract_semester(block.text)

        if normalized:
            return ExtractionResult(value=normalized, raw=block.text, method="pattern_scan", confidence=block.confidence, context=f'pattern matched: "{block.text[:40]}"')

    return extraction_failed("semester", "no matching semester text isolated")