# app/extraction/keyword_engine.py
import re
from typing import List, Tuple, Optional
from app.models import OcrBlock
from app.utils.spatial import get_block_to_right, get_block_below, get_block_above

FIELD_KEYWORDS = {
    "name": ["student name", "name of student", "name", "name of voter", "voter's name", "voters name", "apellido"],
    # Ordered longest/most-distinctive first on purpose (see
    # find_label_block's docstring) -- confirmed on a real UPHSD
    # Registration Form where this list's OLD order let the 2-letter "sy"
    # keyword match a standalone "SY" inside "ARAAS SY" (garbled OCR noise
    # near the page's logo/motto area) before ever reaching the actual
    # "Sch.Yr." label further down, locking the whole field onto the wrong
    # block. "s.y."/"a.y."/"ay"/"sy" are short enough to coincidentally
    # match noise or unrelated text, so they're tried last, only once every
    # longer, more specific label has already had its chance.
    "school_year": ["school year sem", "school year", "academic year", "sch. yr.", "sch yr", "s.y.", "a.y.", "ay", "sy"],
    "barangay": ["barangay", "brgy", "brgy.", "precinct"],
    "date_issued": ["date issued", "date of issuance", "issuance date", "issued"],
}

def find_label_block(blocks: List[OcrBlock], field_name: str) -> Optional[OcrBlock]:
    """
    Tries each keyword, in priority order, across every block before
    falling back to the next keyword. This matters because keyword lists
    are ordered specific-to-generic (e.g. "date issued" before the bare
    "issued" fallback) — scanning block-by-block first would let a weak,
    generic keyword match an early but irrelevant block (e.g. a free-text
    sentence containing "issued") before ever reaching the actual
    labeled field later in the document.
    """
    keywords = FIELD_KEYWORDS.get(field_name, [])

    for kw in keywords:
        # Whitespace-insensitive fallback for abbreviated, period-heavy
        # labels -- confirmed on a real UPHSD Registration Form reading
        # "Sch.Yr." with no space before "Yr.", which the space-containing
        # "sch. yr." keyword entry never matched at all (not a wrong-value
        # problem -- the label itself was never found, so this field fell
        # straight through to the page-wide fallback scan). Comparing with
        # spaces stripped from both sides catches that without having to
        # enumerate every spacing permutation of every abbreviation.
        kw_nospace = kw.replace(' ', '')
        for block in blocks:
            t = block.text.lower().strip().rstrip(':').strip()
            t_nospace = t.replace(' ', '')
            if t == kw or (len(kw) > 3 and (kw in t or kw_nospace in t_nospace)):
                return block
            if len(kw) <= 3 and re.search(r'\b' + re.escape(kw) + r'\b', t):
                return block
    return None

def extract_via_keyword(blocks: List[OcrBlock], field_name: str) -> Optional[Tuple[str, str, OcrBlock, OcrBlock]]:
    """
    Returns (value, context, value_block, label_block).

    value_block and label_block are the SAME block when the label and
    value sit on one line together (e.g. "School Year: 2025-2026") — in
    that case there's only one block's OCR confidence to trust, so
    value_block == label_block on purpose (not a bug, not a separate
    read). They differ when the value lives on a different block than
    its label ("School Year:" on one line, "2025-2026" to its right or
    on the line below) — a real, common case on scanned/photographed
    forms. Callers should combine both confidences (e.g. take the
    minimum) rather than only trusting the value block's confidence:
    a sharp value sitting next to a blurred, misread label is still a
    field the system isn't actually sure it identified correctly.
    """
    label_block = find_label_block(blocks, field_name)

    if not label_block:
        return None
    
    label_text = label_block.text

    if ':' in label_text:
        parts = label_text.split(':', 1)
        value = parts[1].strip()
        if value and len(value) > 1:
            return value, f'inline after "{parts[0].strip()}"', label_block, label_block
        
    right = get_block_to_right(blocks, label_block)

    if right and len(right.text.strip()) > 1:
        return right.text, f'to the right of "{label_text.strip()}"', right, label_block
    
    below = get_block_below(blocks, label_block)

    if below and len(below.text.strip()) > 1:
        return below.text, f'below "{label_text.strip()}"', below, label_block
    
    above = get_block_above(blocks, label_block)

    if above and len(above.text.strip()) > 1:
        return above.text, f'above "{label_text.strip()}"', above, label_block
    
    return None