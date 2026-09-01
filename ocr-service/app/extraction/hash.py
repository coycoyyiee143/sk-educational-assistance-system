# app/extraction/hash.py
import re
from typing import List
from app.models import OcrBlock, ExtractionResult
from app.extraction.blocks import extraction_failed

# Genuine COMELEC certificates print a compound line like
# "HASH:70e6a1b2c3d4,VERSION:VRSLocalv6.0.10.4" — HASH and VERSION are
# two separate colon-delimited fields glued together with a comma, not
# a single "Label: Value" line. Captures only up to the comma boundary.
HASH_LINE_PATTERN = re.compile(r'hash\s*:\s*([A-Za-z0-9]{6,})', re.IGNORECASE)

def extract_document_hash(blocks: List[OcrBlock]) -> ExtractionResult:
    for block in blocks:
        match = HASH_LINE_PATTERN.search(block.text)
        if match:
            candidate = match.group(1)
            return ExtractionResult(value=candidate, raw=block.text, method="pattern_scan",
                                     confidence=block.confidence, context=f'found in: "{block.text}"')

    return extraction_failed(
        "document_hash",
        "HASH verification marker not found — please ensure the full page, including the bottom margin, is captured.",
        metadata={"auto_reupload": True},
    )