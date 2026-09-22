# app/extraction/blocks.py
from typing import List, Tuple, Dict
from app.models import OcrBlock, ExtractionResult
from app.normalization.text_utils import clean_text

def extraction_failed(field_name: str, reason: str, metadata: Dict = None) -> ExtractionResult:
    return ExtractionResult(
        value=None, raw=None, method="none",
        confidence=0.0, context=reason, found=False,
        metadata=metadata or {}
    )

def parse_ocr_blocks(ocr_result: list) -> List[OcrBlock]:
    blocks = []
    for item in ocr_result:
        if isinstance(item, dict):
            bbox = item.get("bbox", [])
            text = clean_text(item.get("text", ""))
            confidence = item.get("confidence", 0.0)
        else:
            bbox = item[0]
            text = clean_text(item[1][0])
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