# app/extraction/cert_year.py
import re
from typing import List
from app.models import OcrBlock, ExtractionResult
from app.extraction.blocks import extraction_failed

def extract_cert_year(blocks: List[OcrBlock]) -> ExtractionResult:
    """
    Extracts a bare 4-digit year (e.g. '2025') from a Voter's Certificate.
    No day/month parsing — SK's own posted requirements don't consistently
    specify a year for this document (unlike School ID, which always does),
    so this stays informational by default rather than a hard date check.
    """
    for block in blocks:
        match = re.search(r'\b(20\d{2})\b', block.text)
        if match:
            return ExtractionResult(value=match.group(1), raw=block.text, method="pattern_scan",
                                     confidence=block.confidence, context=f'year found in: "{block.text[:50]}"')
    return extraction_failed("cert_year", "No year found on certificate")