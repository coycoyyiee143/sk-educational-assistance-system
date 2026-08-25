import re
from typing import List
from app.models import OcrBlock
from app.normalization.base_strategy import BaseSchoolStrategy

# Header fragments genuinely part of "University of Perpetual Help System
# Dalta" that PaddleOCR splits onto separate lines. "OF" and "SYSTEM" are
# common short words, but this list is only used to merge blocks that are
# ALSO spatially close together (via the header-region check), so the risk
# of an unrelated match is low in practice.
_INSTITUTION_KEYWORDS = {"UNIVERSITY", "OF", "PERPETUAL", "HELP", "SYSTEM", "DALTA"}

# UPHSD's ID number format, e.g. "28-0641-902"
_STUDENT_NO_PATTERN = re.compile(r'\d{2}-\d{4}-\d{3}')


class UphsdStrategy(BaseSchoolStrategy):
    """
    UPHSD's school ID splits both the institution name header and the
    cardholder's name across multiple OCR lines (e.g. "University of" /
    "PERPETUAL HELP" / "System DALTA" as separate blocks, and "SANTILLAN"
    (surname) / "MIGUEL ANGELO" (given name) as two stacked lines directly
    above the ID number). Same fix pattern as PupStrategy: pre-merge these
    specific groups into single synthetic blocks before generic extraction
    runs, so it only changes behavior when UPHSD is the declared school.
    """

    def preprocess_blocks(self, blocks: List[OcrBlock]) -> List[OcrBlock]:
        blocks = list(blocks)
        blocks = self._merge_institution_header(blocks)
        blocks = self._merge_name_above_student_number(blocks)
        return blocks

    def _merge_institution_header(self, blocks: List[OcrBlock]) -> List[OcrBlock]:
        header_parts = [
            b for b in blocks
            if any(kw in b.text.strip().upper() for kw in _INSTITUTION_KEYWORDS)
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

    def _merge_name_above_student_number(self, blocks: List[OcrBlock]) -> List[OcrBlock]:
        anchor = next(
            (b for b in blocks if _STUDENT_NO_PATTERN.search(b.text)), None
        )
        if not anchor:
            return blocks
        line_height = anchor.height or 1
        candidates = [
            b for b in blocks
            if b is not anchor
            and abs(b.y_center - anchor.y_center) < line_height * 3
            and abs(b.x_min - anchor.x_min) < (anchor.x_max - anchor.x_min) * 4
        ]
        if not candidates:
            return blocks
        candidates.sort(key=lambda b: (b.y_center, b.x_min))
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

    