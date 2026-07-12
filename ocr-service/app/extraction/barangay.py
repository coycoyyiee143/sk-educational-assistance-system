# app/extraction/barangay.py
from typing import List
from app.models import OcrBlock, ExtractionResult
from app.extraction.keyword_engine import extract_via_keyword
from app.extraction.blocks import extraction_failed

def extract_barangay(blocks: List[OcrBlock]) -> ExtractionResult:
    """
    Extract barangay data. Triggers Suggested Disapproval with bounding box
    metadata if a contrasting local Laguna barangay layout is read.
    """
    known_laguna_barangays = [
        "banlic", "pulo", "sala", "niugan", "san isidro", "marinig",
        "diezmo", "gulod", "baclaran", "mamatid", "bigaa", "butong"
    ]

    result = extract_via_keyword(blocks, "barangay")

    if result:
        raw, context, target_block = result
        raw_lower = raw.lower()

        if 'mamatid' in raw_lower:
            return ExtractionResult(value="Mamatid", raw=raw, method="keyword", confidence=target_block.confidence, context=f'found {context}')
        
        for brgy in known_laguna_barangays:
            if brgy != "mamatid" and brgy in raw_lower:
                return extraction_failed(
                    "barangay",
                    f"Contradiction: Detected residency layout pointing to Brgy. {brgy.title()}.",
                    metadata={"flag": "SUGGESTED_DISAPPROVAL", "bbox": [target_block.x_min, target_block.y_min, target_block.x_max, target_block.y_max]}
                )

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