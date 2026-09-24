import re
from difflib import SequenceMatcher
from typing import List
from app.models import OcrBlock
from app.normalization.base_strategy import BaseSchoolStrategy
from app.utils.spatial import get_blocks_in_region

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
        # Scoped to the header region ONLY -- confirmed on a real UPHSD
        # School ID that scanning the WHOLE page for these keywords
        # wrongly swept in an unrelated "The Perpetualite" mention
        # (a newsletter/motto reference) further down the card, merging
        # it into the institution header. Same bug, same fix as UPLB's
        # _merge_institution_header (see uplb.py). page_w/page_h are
        # computed from these blocks directly rather than imported from
        # app.extraction, to avoid a circular import with
        # app.normalization's own package init.
        if not blocks:
            return blocks
        page_w = max(b.x_max for b in blocks)
        page_h = max(b.y_max for b in blocks)
        header_region = get_blocks_in_region(blocks, page_w, page_h, "header")

        header_parts = [
            b for b in header_region
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

        # Upper bound confirmed against a real UPHSD School ID
        # (test_uphsd_bottom_name_merge_keeps_surname_when_given_name_splits_in_two):
        # the surname/given-name rows span up to ~3.3x anchor.height below
        # the student number, so 4x leaves margin without being so loose it
        # sweeps in unrelated content further down. Without ANY upper bound
        # here, this swept up virtually the entire rest of a Registration
        # Form below the same student-number-shaped pattern (which also
        # appears there) -- confirmed merging 150+ blocks, including the
        # whole subject/grades table, into one 2000+ character block that
        # then broke identity/school-year/institution extraction alike. A
        # School ID has nothing meaningful below the name, so this bound is
        # a no-op there.
        candidates = [
            b for b in blocks
            if b is not anchor
            and not is_course_line(b)
            and anchor.y_center - anchor.height <= b.y_center <= anchor.y_center + anchor.height * 4
        ]
        if len(candidates) < 2:
            return blocks

        # Reading order: top-to-bottom by row, left-to-right within a row.
        # A row can hold MORE than one block -- e.g. a two-word given name
        # ("NATHAN" / "GABRIEL") printed as two separate side-by-side OCR
        # blocks on the same line below the surname. Taking a fixed
        # "last 2 blocks" here (the previous approach) silently dropped
        # the surname whenever the given-name row itself split into 2+
        # blocks, since sorting by y_center alone put both given-name
        # blocks after the surname and the slice kept only the tail.
        candidates.sort(key=lambda b: b.y_center)
        rows: List[List[OcrBlock]] = []
        for b in candidates:
            if rows and (b.y_center - rows[-1][-1].y_center) <= rows[-1][-1].height * 0.8:
                rows[-1].append(b)
            else:
                rows.append([b])
        for row in rows:
            row.sort(key=lambda b: b.x_min)
        candidates = [b for row in rows for b in row]

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