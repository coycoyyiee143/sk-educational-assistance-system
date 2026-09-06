import re
from difflib import SequenceMatcher
from typing import List
from app.models import OcrBlock
from app.normalization.base_strategy import BaseSchoolStrategy

_INSTITUTION_KEYWORDS = {"UNIVERSITY", "OF", "PERPETUAL", "HELP", "SYSTEM", "DALTA"}
_COURSE_LINE_KEYWORDS = {"COLLEGE", "DEPARTMENT", "SCHOOL", "COURSE"}

_STUDENT_NO_PATTERN = re.compile(r'\d{2}-\d{4}-\d{3}')


def _text_has_keyword(text: str, keywords: set, fuzzy_threshold: float = 0.8) -> bool:
    """
    Whole-word match for short keywords (fuzzy matching a 2-3 letter
    word is too risky — easy to false-positive against unrelated short
    words). Longer keywords also get a fuzzy fallback, since OCR
    routinely misreads a single character in longer words — confirmed
    on a real sample: "PERPETUAL" read as "PERPETOAL" (O for U), which
    an exact match silently drops from the merge entirely.
    """
    words = re.findall(r'[A-Z]+', text.strip().upper())
    for word in words:
        for kw in keywords:
            if word == kw:
                return True
            if len(kw) >= 4 and SequenceMatcher(None, word, kw).ratio() >= fuzzy_threshold:
                return True
    return False


class UphsdStrategy(BaseSchoolStrategy):
    """
    UPHSD's school ID splits both the institution name header and the
    cardholder's name across multiple OCR lines. Pre-merges these
    specific groups into single synthetic blocks before generic
    extraction runs, so it only changes behavior when UPHSD is the
    declared school.
    """

    def preprocess_blocks(self, blocks: List[OcrBlock]) -> List[OcrBlock]:
        blocks = list(blocks)
        blocks = self._merge_institution_header(blocks)
        blocks = self._merge_bottom_name_lines(blocks)
        return blocks

    def _merge_institution_header(self, blocks: List[OcrBlock]) -> List[OcrBlock]:
        header_parts = [
            b for b in blocks
            if _text_has_keyword(b.text, _INSTITUTION_KEYWORDS)
        ]
        if len(header_parts) < 2:
            return blocks
        header_parts.sort(key=lambda b: b.y_center)
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

    def _merge_bottom_name_lines(self, blocks: List[OcrBlock]) -> List[OcrBlock]:
        anchor = next(
            (b for b in blocks if _STUDENT_NO_PATTERN.search(b.text)), None
        )
        if not anchor:
            return blocks

        def is_course_line(b: OcrBlock) -> bool:
            return _text_has_keyword(b.text, _COURSE_LINE_KEYWORDS)

        candidates = [
            b for b in blocks
            if b is not anchor
            and not is_course_line(b)
            and b.y_center >= anchor.y_center - anchor.height
        ]
        if len(candidates) < 2:
            return blocks

        candidates.sort(key=lambda b: b.y_center)
        candidates = candidates[-2:]

        merged_text = " ".join(b.text.strip() for b in candidates)
        avg_conf = sum(b.confidence for b in candidates) / len(candidates)
        merged_block = OcrBlock(
            text=merged_text,
            confidence=avg_conf,
            x_min=min(b.x_min for b in candidates),
            y_min=min(b.y_min for b in candidates),
            x_max=max(b.x_max for b in candidates),
            y_max=max(b.y_max for b in candidates),
        )
        remaining = [b for b in blocks if b not in candidates]
        remaining.append(merged_block)
        return remaining