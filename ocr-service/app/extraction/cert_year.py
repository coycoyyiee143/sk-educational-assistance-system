# app/extraction/cert_year.py
import re
from typing import List
from app.models import OcrBlock, ExtractionResult
from app.extraction.blocks import extraction_failed
from app.extraction.keyword_engine import extract_via_keyword

def extract_cert_year(blocks: List[OcrBlock]) -> ExtractionResult:
    """
    Extracts a 4-digit year (e.g. '2025') representing when the Voter's
    Certificate was issued. Voter's Certificates from COMELEC typically
    show the issuance date in two independent places:
      1. A "Date Issued" labeled field
      2. A free-text signing sentence
    Both are tried, in that order, before giving up — deliberately no
    blind whole-document year scan, since that risks matching an
    unrelated 4-digit number (birth year, precinct number, etc.) instead
    of the actual issuance year.

    The year regex uses a negative lookbehind instead of \\b before the
    digits, since OCR frequently drops the space between a preceding
    word and the year (e.g. "May2026"), which a strict word-boundary
    match would silently miss.
    """
    # 1. Labeled "Date Issued" field
    result = extract_via_keyword(blocks, "date_issued")
    if result:
        raw, context, value_block, label_block = result
        match = re.search(r'(?<!\d)(20\d{2})\b', raw)
        if match:
            combined_confidence = min(value_block.confidence, label_block.confidence)
            return ExtractionResult(value=match.group(1), raw=raw, method="keyword",
                                     confidence=combined_confidence, context=f'found {context}')

    # 2. Any line containing "issued" (covers the free-text signing
    #    sentence, and doubles as a fallback if the labeled field above
    #    somehow didn't match) — still anchored, not a blind scan.
    for block in blocks:
        if "issued" in block.text.lower():
            match = re.search(r'(?<!\d)(20\d{2})\b', block.text)
            if match:
                return ExtractionResult(value=match.group(1), raw=block.text, method="pattern_scan",
                                         confidence=block.confidence, context=f'found near "issued": "{block.text[:50]}"')

    return extraction_failed("cert_year", "No 'Date Issued' field or issuance sentence found on certificate")