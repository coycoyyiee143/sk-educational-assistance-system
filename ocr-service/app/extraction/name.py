# app/extraction/name.py
import re
from typing import List, Tuple, Optional
from app.models import OcrBlock, ExtractionResult
from app.utils.spatial import get_blocks_in_region, get_block_below
from app.normalization.text_utils import fuzzy_match_name, combine_confidence, reinsert_name_spacing
from app.extraction.keyword_engine import extract_via_keyword

# Field labels observed sitting between name-related lines on real Voter's
# Certification samples (e.g. "Sex" appearing directly between a surname
# line and a given-name line). Extend this list as new interposed labels
# turn up on other real documents/layouts.
NAME_AREA_NOISE_LABELS = ["sex", "civil status", "age"]

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

def extract_adjacent_name_lines(blocks: List[OcrBlock],
                                 first_name: str, middle_name: str, last_name: str,
                                 noise_labels: Optional[List[str]] = None,
                                 max_skip: int = 2) -> Optional[Tuple[str, str, List[OcrBlock]]]:
    """
    Handles names split across two (or more) separate, unlabeled OCR
    lines — e.g. surname on one line, given name on the next. Tries
    BOTH the spatial get_block_below() walk AND a simple next-in-list-
    order walk independently for each base block, scores both
    candidates, and keeps whichever pairing scores higher — rather than
    trusting spatial lookup whenever it returns anything at all, which
    previously locked in a wrong/unrelated spatial match even when the
    correct pairing was simply the next line in raw list order.
    """
    noise_labels = noise_labels or []
    best_pair, best_score = None, 0

    def is_noise_text(text: str) -> bool:
        t = text.lower().strip()
        return any(re.search(r'\b' + re.escape(n) + r'\b', t) for n in noise_labels)

    def walk_spatial(start_idx: int):
        current = blocks[start_idx]
        joined = [blocks[start_idx]]
        hops = 0
        while hops <= max_skip:
            nxt = get_block_below(blocks, current)
            if not nxt:
                return None
            if is_noise_text(nxt.text):
                current = nxt
                hops += 1
                continue
            joined.append(nxt)
            return joined

    def walk_list_order(start_idx: int):
        joined = [blocks[start_idx]]
        list_idx = start_idx
        hops = 0
        while hops <= max_skip:
            list_idx += 1
            if list_idx >= len(blocks):
                return None
            nxt = blocks[list_idx]
            if is_noise_text(nxt.text):
                hops += 1
                continue
            joined.append(nxt)
            return joined

    for i in range(len(blocks)):
        for candidate_blocks in (walk_spatial(i), walk_list_order(i)):
            if not candidate_blocks:
                continue
            joined_text = " ".join(b.text for b in candidate_blocks)
            match_result = fuzzy_match_name(joined_text, first_name, middle_name, last_name)
            score = match_result["score"] if match_result["passed"] else 0
            if score > best_score or (score == best_score and best_pair and len(joined_text) > len(best_pair[0])):
                best_score, best_pair = score, (joined_text, candidate_blocks)

    if best_pair and best_score >= 85:
        joined_text, joined_blocks = best_pair
        return joined_text, "adjacent lines (spatial/list-order walk)", joined_blocks
    return None

def extract_name(blocks: List[OcrBlock], page_w: float, page_h: float,
                 first_name: str, middle_name: str, last_name: str) -> ExtractionResult:
    result = _extract_name_impl(blocks, page_w, page_h, first_name, middle_name, last_name)
    if result.found and result.value:
        cleaned = reinsert_name_spacing(result.value, first_name, middle_name, last_name)
        if cleaned != result.value:
            result.value = cleaned
    return result

def _extract_name_impl(blocks: List[OcrBlock], page_w: float, page_h: float,
                 first_name: str, middle_name: str, last_name: str) -> ExtractionResult:
    
    def score_text(text: str) -> float:
        # IMPORTANT: fuzzy_match_name can return a high "score" number
        # while still setting "passed": False (e.g. when first/last name
        # aren't independently present — see the identity-bypass fix in
        # text_utils.py). Every caller below only checks "score >= 85",
        # so score_text must fold "passed" into the number itself
        # (0 when not passed) or that security gate is silently bypassed.
        result = fuzzy_match_name(text, first_name, middle_name, last_name)
        return result["score"] if result["passed"] else 0

    # Best name-LABEL-anchored candidate seen so far, kept regardless of
    # whether it matches this applicant. If nothing ends up confidently
    # matching, this is shown instead of falling back to a blind
    # page-wide scan for "whatever scored highest" -- that scan can
    # surface unrelated form text (e.g. "UniFAST Grantee:Yes") that
    # happens to score decently, which is misleading to a verifier
    # trying to see whose name is actually on the document.
    detected_candidate = None  # (text, confidence)

    result = extract_via_keyword(blocks, "name")
    
    if result:
        raw, context, value_block, label_block = result
        conf = min(value_block.confidence, label_block.confidence)
        detected_candidate = (raw, conf)
        score = score_text(raw)

        if score >= 85:
            combined = combine_confidence(conf, score)
            return ExtractionResult(value=raw, raw=raw, method="keyword", confidence=combined, context=f'found {context}')

    stacked = extract_stacked_name_fields(blocks)

    if stacked:
        raw, context, blocks_used = stacked
        avg_conf = sum(b.confidence for b in blocks_used) / len(blocks_used)
        if detected_candidate is None:
            detected_candidate = (raw, avg_conf)
        score = score_text(raw)
        if score >= 85:
            combined = combine_confidence(avg_conf, score)
            return ExtractionResult(value=raw, raw=raw, method="stacked_labels", confidence=combined, context=f'found {context}')

    # Try every block ALONE before attempting to join any two lines
    # together. A single block that already scores well on its own
    # (e.g. a name-merging preprocess step already combined it upstream)
    # should win outright — joining it with an unrelated neighboring
    # fragment can only make the match worse, never better, and risks
    # contaminating an already-correct result with garbage text.
    single_best_block, single_best_score = None, 0
    for block in blocks:
        score = score_text(block.text)
        if score > single_best_score or (score == single_best_score and single_best_block and len(block.text) > len(single_best_block.text)):
            single_best_score, single_best_block = score, block

    if single_best_score >= 85 and single_best_block:
        combined = combine_confidence(single_best_block.confidence, single_best_score)
        return ExtractionResult(value=single_best_block.text, raw=single_best_block.text, method="single_block", confidence=combined, context='found as a single block')

    adjacent = extract_adjacent_name_lines(blocks, first_name, middle_name, last_name,
                                            noise_labels=NAME_AREA_NOISE_LABELS)

    if adjacent:
        raw, context, blocks_used = adjacent
        score = score_text(raw)
        avg_conf = sum(b.confidence for b in blocks_used) / len(blocks_used)
        combined = combine_confidence(avg_conf, score)
        return ExtractionResult(value=raw, raw=raw, method="adjacent_lines", confidence=combined, context=f'found {context}')

    # No confident match anywhere. If a name-label-anchored candidate was
    # found earlier (even though it didn't match this applicant),
    # surface THAT instead of falling back to a blind page-wide scan —
    # it's what actually sits next to a "Name" field on the document,
    # so it tells a verifier whose form this really is.
    if detected_candidate:
        text, conf = detected_candidate
        return ExtractionResult(value=text, raw=text, method="label_anchored_no_match", confidence=0.0,
                                 context='found a name field, but it does not match the applicant', found=False)

    # Truly nothing label-anchored was found at all (no "Name" field
    # detected anywhere) — last resort only, kept for documents whose
    # layout doesn't have a clear name label at all.
    best_block, best_score = None, 0

    for block in get_blocks_in_region(blocks, page_w, page_h, "top_half"):
        score = score_text(block.text)
        if score > best_score or (score == best_score and best_block and len(block.text) > len(best_block.text)):
            best_score, best_block = score, block

    if best_score >= 85 and best_block:
        combined = combine_confidence(best_block.confidence, best_score)
        return ExtractionResult(value=best_block.text, raw=best_block.text, method="position", confidence=combined, context='found in top half')

    all_best_block, all_best_score = None, 0

    for block in blocks:
        score = score_text(block.text)
        if score > all_best_score or (score == all_best_score and all_best_block and len(block.text) > len(all_best_block.text)):
            all_best_score, all_best_block = score, block

    if all_best_score >= 85 and all_best_block:
        combined = combine_confidence(all_best_block.confidence, all_best_score)
        return ExtractionResult(value=all_best_block.text, raw=all_best_block.text, method="pattern_scan", confidence=combined, context='found via fallback scan')

    best = all_best_block or best_block
    return ExtractionResult(value=best.text if best else None, raw=best.text if best else None, method="none", confidence=0.0, context='no confident match', found=False)