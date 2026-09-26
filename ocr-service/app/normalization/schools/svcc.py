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
        candidates = [
            b for b in blocks
            if any(kw in b.text.lower() for kw in _HEADER_KEYWORDS)
        ]
        if len(candidates) < 2:
            return blocks

        candidates.sort(key=lambda b: b.y_center)

        # Only merge a CONTIGUOUS run of lines starting at the topmost match
        # -- a genuine split header ("ST.VINCENT" / "COLLEGE OF CABUYAO") is
        # always two lines stacked directly on top of each other near the
        # top of the page. Without this, any other "cabuyao"/"vincent" match
        # ANYWHERE on the page (a decorative watermark ribbon mid-page, an
        # enrollment stamp near the bottom -- both real, confirmed template
        # artifacts on these scans) gets glued onto the header string too.
        # Confirmed as a real false-negative on a genuine wrong-school test
        # image: the page's actual header read "UNIVERSITY OF CABUYAO" (a
        # different, real school), but a leftover SVCC watermark/stamp
        # elsewhere on the page also matched "cabuyao", and merging it in
        # made the combined string contain "ST.VINCENT COLLEGE OF CABUYAO"
        # as a literal substring -- passing institution_match for the WRONG
        # declared school instead of flagging the mismatch it should have.
        header_parts = [candidates[0]]
        for block in candidates[1:]:
            prev = header_parts[-1]
            gap = block.y_min - prev.y_max
            line_height = max(prev.height, block.height, 1)
            if gap > line_height * 1.5:
                break
            header_parts.append(block)

        if len(header_parts) < 2:
            return blocks

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
        #
        # \b requires a word-boundary on BOTH sides -- fine on the left
        # (preceded by ":"/whitespace), but the right side breaks when
        # OCR runs the year straight into the next word with no space,
        # e.g. "2022Semester:1ST" (confirmed on a real SVCC sample after
        # a header-region OCR retry recovered this line: no space
        # survived between the year and "Semester"). Both '2' and 'S'
        # are \w characters, so \b never matches between them and the
        # whole regex silently fails to find a year that's plainly
        # there. (?!\d) only blocks matching part of a LONGER run of
        # digits (e.g. never grab "2022" out of "20225"), without caring
        # what non-digit character (or none) follows.
        match = re.search(r"\b(20\d{2})(?!\d)", text)
        if match:
            start_year = int(match.group(1))
            return f"{start_year}-{start_year + 1}"
        return super().extract_school_year(text, sy_format_hint)