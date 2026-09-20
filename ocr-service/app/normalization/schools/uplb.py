# app/normalization/schools/uplb.py
import re
from difflib import SequenceMatcher
from typing import List, Optional
from app.models import OcrBlock
from app.normalization.base_strategy import BaseSchoolStrategy

# Longer, distinctive words only -- short ones like "OF"/"THE" are left
# out since fuzzy-matching short words is too risky (easy false-positive
# against unrelated short words), matching the same caution UPHSD's
# strategy already takes.
_INSTITUTION_KEYWORDS = {"UNIVERSITY", "PHILIPPINES", "BANOS", "BAÑOS"}


def _text_has_keyword(text: str, keywords: set, fuzzy_threshold: float = 0.75) -> bool:
    """
    Whole-word fuzzy match, tolerant of OCR truncation -- confirmed on a
    real UPLB ID sample where the Oblation statue graphic behind the
    header text cuts through "University", leaving a bare "Univers"
    fragment that an exact-match/typo-fuzzy check wouldn't confidently
    catch.
    """
    words = re.findall(r'[A-ZÑ]+', text.strip().upper())
    for word in words:
        for kw in keywords:
            if word == kw:
                return True
            if len(word) >= 4 and SequenceMatcher(None, word, kw).ratio() >= fuzzy_threshold:
                return True
    return False


class UplbStrategy(BaseSchoolStrategy):
    """
    Custom parsing layer for UPLB's 'TERM & SY' table, where the 'SY'
    label and its '20XX-20XX' value sit in separate cells (so they land
    a few words apart once OCR blocks are joined into one string) --
    unlike PNC/CDC's inline 'keyword <year>' phrasing.

    UPLB's ID also splits its institution header text across multiple
    OCR blocks -- confirmed on a real sample: "University of the
    Philippines" split into "Univers" / "y of the Philippines" (the
    Oblation statue graphic behind the text obscures the middle
    characters), with "LOS BAÑOS" landing as a separate block below. This
    isn't cosmetic: extract_school() scores each block's text
    independently against the full declared school name, and rejects any
    single block under 75% of that name's length as a guard against
    false-positive short fragments -- so without merging, institution_match
    fails outright for every UPLB ID, since no individual fragment is
    long enough alone. Merging is safe even if it also sweeps in
    unrelated single-word fragments from the seal graphic (e.g. "OF",
    "THE") -- confirmed the resulting merged text still scores well above
    threshold, since the fuzzy match ignores word order.
    """

    def preprocess_blocks(self, blocks: List[OcrBlock]) -> List[OcrBlock]:
        blocks = list(blocks)
        blocks = self._merge_institution_header(blocks)
        return blocks

    def _merge_institution_header(self, blocks: List[OcrBlock]) -> List[OcrBlock]:
        header_parts = [
            b for b in blocks
            if _text_has_keyword(b.text, _INSTITUTION_KEYWORDS)
        ]
        if len(header_parts) < 2:
            return blocks

        header_parts.sort(key=lambda b: (b.y_center, b.x_min))
        merged_text = " ".join(b.text.strip() for b in header_parts)
        avg_conf = sum(b.confidence for b in header_parts) / len(header_parts)

        merged_block = OcrBlock(
            text=merged_text,
            confidence=avg_conf,
            x_min=min(b.x_min for b in header_parts),
            y_min=min(b.y_min for b in header_parts),
            x_max=max(b.x_max for b in header_parts),
            y_max=max(b.y_max for b in header_parts),
        )
        remaining = [b for b in blocks if b not in header_parts]
        remaining.append(merged_block)
        return remaining

    def extract_school_year(self, text: str, sy_format_hint: Optional[str] = None) -> Optional[str]:
        match = re.search(r"\bsy\b[\s\S]{0,60}?(\d{4})\s*-\s*(\d{4})", text, re.IGNORECASE)
        if match:
            return f"{match.group(1)}-{match.group(2)}"
        return super().extract_school_year(text, sy_format_hint)
