import re
from typing import List
from rapidfuzz import fuzz
from app.models import OcrBlock
from app.normalization.base_strategy import BaseSchoolStrategy
from app.utils.spatial import get_blocks_in_region


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
        # Scoped to the header region ONLY -- scanning the WHOLE page for
        # these keywords risks sweeping in a stray, unrelated match further
        # down the page (e.g. a subject/body line that happens to contain
        # "OF" or "THE") into the institution header. Same bug, same fix as
        # UPHSD's and UPLB's _merge_institution_header. page_w/page_h are
        # computed from these blocks directly rather than imported from
        # app.extraction, to avoid a circular import with app.normalization's
        # own package init.
        if not blocks:
            return blocks
        page_w = max(b.x_max for b in blocks)
        page_h = max(b.y_max for b in blocks)
        header_region = get_blocks_in_region(blocks, page_w, page_h, "header")

        header_parts = [b for b in header_region if self._is_institution_keyword(b.text)]
        if len(header_parts) < 2:
            return blocks

        header_parts.sort(key=lambda b: b.y_center)
        words = [b.text.strip() for b in header_parts]

        # PUP's official name always has "of the" between "University" and
        # "Philippines" -- but that connector is printed in a much smaller
        # subscript font under the 3 big logo lines, and PaddleOCR often
        # fails to detect it as a block AT ALL (not garbled -- just never
        # produced), even on an otherwise decent, in-focus photo. Once
        # we're confident this IS a PUP header (>=2 of its distinctive
        # words matched above), splice the missing connector back in
        # rather than let its mere absence drag an otherwise-correct
        # header below fuzzy_match_school()'s pass threshold -- confirmed
        # on a real PUP ID where "POLYTECHNIC UNIVERSITY PHILIPPINES"
        # (every real word correct) scored only 79.3 without "of the",
        # short of the required 85, purely because that one small line
        # was never detected.
        has_of = any(w.strip().upper() == "OF" for w in words)
        has_the = any(w.strip().upper() == "THE" for w in words)
        if not has_of and not has_the:
            insert_at = next(
                (i for i, w in enumerate(words) if w.strip().upper() == "PHILIPPINES"),
                len(words),
            )
            words.insert(insert_at, "of the")

        merged_text = " ".join(words)
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

    def _is_institution_keyword(self, text: str) -> bool:
        cleaned = text.strip().upper()
        if cleaned in _INSTITUTION_KEYWORDS:
            return True
        # Tolerate simple OCR spacing artifacts on the longer, distinctive
        # keywords only -- confirmed on a real PUP ID reading "POLYTECHNIC"
        # as "P OLYTECHNIC" (letters all correct, spurious space). Short
        # filler words like "OF"/"THE" are excluded here since a fuzzy
        # match against a 2-3 letter word is meaningless -- almost any
        # short OCR noise scores high against them.
        no_space = cleaned.replace(" ", "")
        return any(
            len(kw) >= 8 and fuzz.ratio(no_space, kw) >= 90
            for kw in _INSTITUTION_KEYWORDS
        )

    def _contains_institution_wording(self, text: str) -> bool:
        """
        True if ANY word in `text` is one of PUP's distinctive institution
        keywords -- unlike _is_institution_keyword() (which tests whether
        the WHOLE block text IS a single keyword fragment, for OCR lines
        already split word-by-word), this checks a full, unsplit line
        (e.g. "POLYTECHNIC UNIVERSITY OF THE PHILIPPINES") for containing
        that wording anywhere in it.
        """
        words = re.findall(r"[A-Za-z]+", text.upper())
        return any(w in _INSTITUTION_KEYWORDS for w in words if len(w) >= 4)

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
            # A compact Certificate of Registration slip can pack the
            # institution header, the name, and other short label lines
            # (e.g. "A.Y.:", "TERM:") all within this same loose distance
            # window -- if those other lines fail the x-proximity check
            # above, the header can end up as one of only 2 remaining
            # candidates and get merged straight into the "name," producing
            # "POLYTECHNIC UNIVERSITY OF THE PHILIPPINES PASCUAL, ELLA MAE
            # C." as a single extracted name/school value (confirmed on a
            # real PUP Registration Form). A genuine name line never
            # contains the institution's own wording, so excluding any
            # candidate that does is a direct, targeted guard against this
            # regardless of the exact geometry involved. Uses
            # _contains_institution_wording() (whole-line, substring-aware)
            # rather than _is_institution_keyword() (single isolated
            # keyword fragment) since the header here is already one
            # complete, unsplit OCR line by this point.
            and not self._contains_institution_wording(b.text)
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