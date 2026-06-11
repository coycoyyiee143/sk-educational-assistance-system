# app/postprocessing.py
import re
from typing import List, Tuple, Optional, Dict

from app.core.models import OcrBlock, ExtractionResult
from app.utils.spatial import get_blocks_in_region, get_block_to_right, get_block_below, get_block_above
from app.core.normalizers import fuzzy_match_name, fuzzy_match_school
from app.normalization import get_strategy_for_school

# ── Extraction Failure Helper ───────────────────────────────────────

def extraction_failed(field_name: str, reason: str, metadata: Dict = None) -> ExtractionResult:
    return ExtractionResult(
        value=None, raw=None, method="none",
        confidence=0.0, context=reason, found=False,
        metadata=metadata or {}
    )

# ── Block Parsing ───────────────────────────────────────────────────

def parse_ocr_blocks(ocr_result: list) -> List[OcrBlock]:
    blocks = []
    for item in ocr_result:
        if isinstance(item, dict):
            bbox = item.get("bbox", [])
            text = item.get("text", "").strip()
            confidence = item.get("confidence", 0.0)
        else:
            bbox = item[0]
            text = item[1][0].strip()
            confidence = item[1][1]

        if not text:
            continue

        xs = [p[0] for p in bbox]
        ys = [p[1] for p in bbox]
        
        blocks.append(OcrBlock(
            text=text, confidence=float(confidence),
            x_min=min(xs), y_min=min(ys),
            x_max=max(xs), y_max=max(ys)
        ))
    return blocks


def get_page_dimensions(blocks: List[OcrBlock]) -> Tuple[float, float]:
    if not blocks:
        return 1000, 1000
    return max(b.x_max for b in blocks), max(b.y_max for b in blocks)

# ── Keyword Extraction Engine ───────────────────────────────────────

FIELD_KEYWORDS = {
    "name": ["student name", "name of student", "name", "name of voter", "voter's name", "voters name", "apellido", "user"],
    "school_year": ["school year", "s.y.", "sy", "academic year", "a.y.", "ay", "sch. yr.", "sch yr", "school year sem"],
    "semester": ["semester", "sem", "term", "school year sem"],
    "barangay": ["barangay", "brgy", "brgy.", "precinct"]
}

def find_label_block(blocks: List[OcrBlock], field_name: str) -> Optional[OcrBlock]:
    keywords = FIELD_KEYWORDS.get(field_name, [])
    for block in blocks:
        t = block.text.lower().strip().rstrip(':').strip()
        for kw in keywords:
            if t == kw or (len(kw) > 3 and kw in t):
                return block
            if len(kw) <= 3 and re.search(r'\b' + re.escape(kw) + r'\b', t):
                return block
    return None


def extract_via_keyword(blocks: List[OcrBlock], field_name: str) -> Optional[Tuple[str, str, OcrBlock]]:
    label_block = find_label_block(blocks, field_name)
    if not label_block:
        return None

    label_text = label_block.text

    if ':' in label_text:
        parts = label_text.split(':', 1)
        value = parts[1].strip()
        if value and len(value) > 1:
            return value, f'inline after "{parts[0].strip()}"', label_block

    right = get_block_to_right(blocks, label_block)
    if right and len(right.text.strip()) > 1:
        return right.text, f'to the right of "{label_text.strip()}"', right

    below = get_block_below(blocks, label_block)
    if below and len(below.text.strip()) > 1:
        return below.text, f'below "{label_text.strip()}"', below

    above = get_block_above(blocks, label_block)
    if above and len(above.text.strip()) > 1:
        return above.text, f'above "{label_text.strip()}"', above

    return None

# ── Document Form Aggregations ─────────────────────────────────────

def extract_svcc_header_data(blocks: List[OcrBlock]) -> dict:
    result = {"sy": None, "sem": None}
    for block in blocks:
        text = block.text
        sy_match = re.search(r'school\s*year\s*[:\|]?\s*(20\d{2})', text, re.IGNORECASE)
        sem_match = re.search(r'semester\s*[:\|]?\s*(1st|2nd|1|2)', text, re.IGNORECASE)

        if sy_match:
            year = sy_match.group(1)
            result["sy"] = f"{year}-{int(year)+1}"
        if sem_match:
            sem_val = sem_match.group(1).lower()
            result["sem"] = "1" if sem_val in ("1", "1st") else "2"
        if result["sy"] and result["sem"]:
            break
    return result


def extract_stacked_name_fields(blocks: List[OcrBlock]) -> Optional[Tuple[str, str]]:
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
            if len(b.text) > 2: clean_blocks.append(b.text)

        if clean_blocks:
            return " ".join(clean_blocks), "stacked labels below data"
    return None

# ── Core Orchestrator Extraction Flows ─────────────────────────────

def extract_name(blocks: List[OcrBlock], page_w: float, page_h: float,
                 first_name: str, middle_name: str, last_name: str) -> ExtractionResult:
    
    def score_text(text: str) -> float:
        return fuzzy_match_name(text, first_name, middle_name, last_name)["score"]

    # Layer 2: Keyword match
    result = extract_via_keyword(blocks, "name")
    if result:
        raw, context, _ = result
        score = score_text(raw)
        if score >= 85:
            return ExtractionResult(value=raw, raw=raw, method="keyword", confidence=score, context=f'found {context}')

    # Layer 2.5: Stacked multi-line structures
    stacked = extract_stacked_name_fields(blocks)
    if stacked:
        raw, context = stacked
        score = score_text(raw)
        if score >= 85:
            return ExtractionResult(value=raw, raw=raw, method="stacked_labels", confidence=score, context=f'found {context}')

    # Layer 1: Positional search
    best_block, best_score = None, 0
    for block in get_blocks_in_region(blocks, page_w, page_h, "top_half"):
        score = score_text(block.text)
        if score > best_score:
            best_score, best_block = score, block

    if best_score >= 85 and best_block:
        return ExtractionResult(value=best_block.text, raw=best_block.text, method="position", confidence=best_score, context='found in top half')

    # Layer 3: Document-wide scanning fallback
    all_best_block, all_best_score = None, 0
    for block in blocks:
        score = score_text(block.text)
        if score > all_best_score:
            all_best_score, all_best_block = score, block

    if all_best_score >= 85 and all_best_block:
        return ExtractionResult(value=all_best_block.text, raw=all_best_block.text, method="pattern_scan", confidence=all_best_score, context='found via fallback scan')

    best = all_best_block or best_block
    return ExtractionResult(value=best.text if best else None, raw=best.text if best else None, method="none", confidence=all_best_score, context='no confident match', found=False)


def extract_school(blocks: List[OcrBlock], page_w: float, page_h: float, declared_school: str) -> ExtractionResult:
    def score_school(text: str) -> float:
        return fuzzy_match_school(text, declared_school)["score"]

    best_block, best_score = None, 0
    for block in get_blocks_in_region(blocks, page_w, page_h, "header"):
        score = score_school(block.text)
        if score > best_score:
            best_score, best_block = score, block

    if best_score >= 85 and best_block:
        return ExtractionResult(value=best_block.text, raw=best_block.text, method="position", confidence=best_score, context='found in header')

    for block in blocks:
        score = score_school(block.text)
        if score > best_score:
            best_score, best_block = score, block

    if best_score >= 85 and best_block:
        return ExtractionResult(value=best_block.text, raw=best_block.text, method="pattern_scan", confidence=best_score, context='found via layout scan')

    return ExtractionResult(value=best_block.text if best_block else None, raw=best_block.text if best_block else None, method="none", confidence=best_score, context='school mismatch', found=False)


def extract_school_year(blocks: List[OcrBlock], page_w: float, page_h: float,
                       school_name: str = None, configured_year: str = None) -> ExtractionResult:
    strategy = get_strategy_for_school(school_name)

    # Layer 2: Keyword search
    result = extract_via_keyword(blocks, "school_year")
    if result:
        raw, context, _ = result
        normalized = strategy.extract_school_year(raw, configured_year)
        if normalized:
            return ExtractionResult(value=normalized, raw=raw, method="keyword", confidence=1.0, context=f'found {context}')

    # Layer 3: Strategy pattern scanning
    for block in get_blocks_in_region(blocks, page_w, page_h, "top_half"):
        normalized = strategy.extract_school_year(block.text, configured_year)
        if normalized:
            return ExtractionResult(value=normalized, raw=block.text, method="pattern_scan", confidence=block.confidence, context=f'pattern matched: "{block.text[:40]}"')

    return extraction_failed("school_year", "no matching school year format found")


def extract_semester(blocks: List[OcrBlock], page_w: float, page_h: float, school_name: str = None) -> ExtractionResult:
    strategy = get_strategy_for_school(school_name)

    # Layer 2: Keyword search
    result = extract_via_keyword(blocks, "semester")
    if result:
        raw, context, _ = result
        normalized = strategy.extract_semester(raw)
        if normalized:
            return ExtractionResult(value=normalized, raw=raw, method="keyword", confidence=1.0, context=f'found {context}')

    # Layer 3: Strategy pattern scanning
    for block in get_blocks_in_region(blocks, page_w, page_h, "top_half"):
        normalized = strategy.extract_semester(block.text)
        if normalized:
            return ExtractionResult(value=normalized, raw=block.text, method="pattern_scan", confidence=block.confidence, context=f'pattern matched: "{block.text[:40]}"')

    return extraction_failed("semester", "no matching semester text isolated")


def extract_barangay(blocks: List[OcrBlock]) -> ExtractionResult:
    """
    Extract barangay data. Triggers Suggested Disapproval with bounding box 
    metadata if a contrasting local Laguna barangay layout is read.
    """
    known_laguna_barangays = [
        "banlic", "pulo", "sala", "niugan", "san isidro", "marinig", 
        "diezmo", "gulod", "baclaran", "mamatid", "bigaa", "butong"
    ]

    # Layer 2: Keyword search
    result = extract_via_keyword(blocks, "barangay")
    if result:
        raw, context, target_block = result
        raw_lower = raw.lower()
        if 'mamatid' in raw_lower:
            return ExtractionResult(value="Mamatid", raw=raw, method="keyword", confidence=1.0, context=f'found {context}')
        
        # Check for non-Mamatid neighboring records (Suggested Disapproval Trigger)
        for brgy in known_laguna_barangays:
            if brgy != "mamatid" and brgy in raw_lower:
                return extraction_failed(
                    "barangay", 
                    f"Contradiction: Detected residency layout pointing to Brgy. {brgy.title()}.",
                    metadata={"flag": "SUGGESTED_DISAPPROVAL", "bbox": [target_block.x_min, target_block.y_min, target_block.x_max, target_block.y_max]}
                )

    # Layer 3: Document-wide search fallback
    for block in blocks:
        txt_lower = block.text.lower()
        if 'mamatid' in txt_lower:
            return ExtractionResult(value="Mamatid", raw=block.text, method="pattern_scan", confidence=block.confidence, context=f'found in: "{block.text}"')
        
        for brgy in known_laguna_barangays:
            if brgy != "mamatid" and brgy in txt_lower:
                return extraction_failed(
                    "barangay", 
                    f"Contradiction: Detected residency layout pointing to Brgy. {brgy.title()}.",
                    metadata={"flag": "SUGGESTED_DISAPPROVAL", "bbox": [block.x_min, block.y_min, block.x_max, block.y_max]}
                )

    return extraction_failed("barangay", "Barangay text line not captured cleanly")