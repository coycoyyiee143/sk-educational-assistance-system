# app/normalization/schools/svcc.py
import re
from typing import List, Optional
from app.models import OcrBlock
from app.normalization.base_strategy import BaseSchoolStrategy

# Substrings that identify a block as part of the SVCC institution header,
# regardless of exact OCR line-splitting (observed splitting as "ST.VINCENT"
# on one line and "COLLEGE OF CABUYAO" on the next). Deliberately substring
# checks rather than an exact-match set (unlike PUP's approach) since SVCC's
# header wording varies more (with/without periods, "SAINT" vs "ST.") and a
# loose match is safer here than missing a real header line due to a small
# punctuation difference.
_HEADER_KEYWORDS = ["vincent", "cabuyao"]


class StVincentCabuyaoStrategy(BaseSchoolStrategy):
    """Custom formatting parsing layer dedicated to St. Vincent College of Cabuyao (SVCC)."""

    def preprocess_blocks(self, blocks: List[OcrBlock]) -> List[OcrBlock]:
        blocks = list(blocks)
        blocks = self._merge_institution_header(blocks)
        return blocks

    def _merge_institution_header(self, blocks: List[OcrBlock]) -> List[OcrBlock]:
        header_parts = [
            b for b in blocks
            if any(kw in b.text.lower() for kw in _HEADER_KEYWORDS)
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

    def extract_school_year(self, text: str, sy_format_hint: Optional[str] = None) -> Optional[str]:
        # SVCC prints a single year meaning the START of the AY range
        # (ex. "School Year: 2025" -> "2025-2026")
        match = re.search(r"\b(20\d{2})\b", text)
        if match:
            start_year = int(match.group(1))
            return f"{start_year}-{start_year + 1}"
        return super().extract_school_year(text, sy_format_hint)