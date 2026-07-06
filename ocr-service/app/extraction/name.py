# app/extraction/name.py
import re
from typing import List, Tuple, Optional
from app.models import OcrBlock, ExtractionResult
from app.utils.spatial import get_blocks_in_region
from app.normalization.text_utils import fuzzy_match_name, combine_confidence
from app.extraction.keyword_engine import extract_via_keyword

def extract_stacked_name_fields(blocks: List[OcrBlock]) -> Optional[Tuple[str, str, List[OcrBlock]]]:
    last_name_idx, first_name_idx = -1, -1
    for i, b in enumerate(blocks):
        t = b.text.lower()
        if re.search(r'\blast\s*name\b', t): last_name_idx = i
        if re.search(r'\bfirst\s*name\b', t): first_name_idx = i

    if last_name_idx != -1 or first_name_idx != -1:
        base_idx = max(last_name_idx, first_name_idx)
        blocks_above = blocks[max(0, base_idx - 5):base_idx]
        clean_blocks = []

        for b in blocks_above:
            t_lower = b.text.lower()
            if re.search(r'(student|information|year\s*level|level|\d{10,})', t_lower): continue
            if re.search(r'\b(last|first|middle)\s*name\b', t_lower): continue
            if len(b.text) > 2: clean_blocks.append(b)

        if clean_blocks:
            joined_text = " ".join(b.text for b in clean_blocks)
            return joined_text, "stacked labels below data", clean_blocks
        
    return None

def extract_name(blocks: List[OcrBlock], page_w: float, page_h: float,
                 first_name: str, middle_name: str, last_name: str) -> ExtractionResult:
    
    def score_text(text: str) -> float:
        return fuzzy_match_name(text, first_name, middle_name, last_name)["score"]

    result = extract_via_keyword(blocks, "name")
    
    if result:
        raw, context, matched_block = result
        score = score_text(raw)

        if score >= 85:
            combined = combine_confidence(matched_block.confidence, score)
            return ExtractionResult(value=raw, raw=raw, method="keyword", confidence=combined, context=f'found {context}')

    stacked = extract_stacked_name_fields(blocks)

    if stacked:
        raw, context, blocks_used = stacked
        score = score_text(raw)
        if score >= 85:
            avg_conf = sum(b.confidence for b in blocks_used) / len(blocks_used)
            combined = combine_confidence(avg_conf, score)
            return ExtractionResult(value=raw, raw=raw, method="stacked_labels", confidence=combined, context=f'found {context}')

    best_block, best_score = None, 0

    for block in get_blocks_in_region(blocks, page_w, page_h, "top_half"):
        score = score_text(block.text)
        if score > best_score:
            best_score, best_block = score, block

    if best_score >= 85 and best_block:
        combined = combine_confidence(best_block.confidence, best_score)
        return ExtractionResult(value=best_block.text, raw=best_block.text, method="position", confidence=combined, context='found in top half')

    all_best_block, all_best_score = None, 0

    for block in blocks:
        score = score_text(block.text)
        if score > all_best_score:
            all_best_score, all_best_block = score, block

    if all_best_score >= 85 and all_best_block:
        combined = combine_confidence(all_best_block.confidence, all_best_score)
        return ExtractionResult(value=all_best_block.text, raw=all_best_block.text, method="pattern_scan", confidence=combined, context='found via fallback scan')

    best = all_best_block or best_block
    return ExtractionResult(value=best.text if best else None, raw=best.text if best else None, method="none", confidence=0.0, context='no confident match', found=False)