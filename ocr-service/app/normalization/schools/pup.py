import re
from typing import List
from app.models import OcrBlock
from app.normalization.base_strategy import BaseSchoolStrategy


# Header fragments genuinely part of "Polytechnic University of the Philippines"
# that PaddleOCR splits onto separate lines. The quoted slogan line and OCR
# noise (e.g. "eftf", "POP") are deliberately excluded by not being in this set.
_INSTITUTION_KEYWORDS = {"POLYTECHNIC", "UNIVERSITY", "OF", "THE", "PHILIPPINES", "PUP"}

# PUP's official student number format, e.g. "2023-00000-AB-0"
_STUDENT_NO_PATTERN = re.compile(r'\b\d{4}-\d{5}-[A-Z]{1,3}-\d\b')


class PupStrategy(BaseSchoolStrategy):
    """
    PUP's school ID splits both the institution name and the cardholder's name
    across multiple OCR lines (e.g. "POLYTECHNIC" / "UNIVERSITY" / "PHILIPPINES"
    as three separate blocks, and "JEAN GRAY B." / "HEMENEZ" as two). The
    generic single-block matchers never see enough text on any one line to
    pass the fuzzy-match threshold. This strategy pre-merges those specific
    groups into single synthetic blocks before generic extraction runs, so it
    only changes behavior when PUP is the declared school — every other
    school's extraction is untouched.
    """

    def preprocess_blocks(self, blocks: List[OcrBlock]) -> List[OcrBlock]:
        blocks = list(blocks)
        blocks = self._merge_institution_header(blocks)
        blocks = self._merge_name_above_student_number(blocks)
        return blocks

    def _merge_institution_header(self, blocks: List[OcrBlock]) -> List[OcrBlock]:
        header_parts = [
            b for b in blocks
            if b.text.strip().upper() in _INSTITUTION_KEYWORDS
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
        # PUP prints the name as up to two stacked lines directly above the
        # student number. Anchoring on the student number is reliable since
        # its format is fixed, unlike free-text names.
        anchor = next(
            (b for b in blocks if _STUDENT_NO_PATTERN.search(b.text)), None
        )
        if not anchor:
            return blocks

        line_height = anchor.height or 1
        candidates = [
            b for b in blocks
            if b is not anchor
            and b.y_center < anchor.y_center
            and (anchor.y_min - b.y_max) < line_height * 3
            and abs(b.x_min - anchor.x_min) < (anchor.x_max - anchor.x_min) * 2
        ]
        if not candidates:
            return blocks

        candidates.sort(key=lambda b: b.y_center)
        # Keep only the closest 1-2 lines directly above the anchor, in case
        # something further up (e.g. the photo area) also matched.
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