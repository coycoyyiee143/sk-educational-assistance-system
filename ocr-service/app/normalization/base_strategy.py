import re
from typing import Optional
from app.normalization.text_utils import fix_ocr_symbols

class BaseSchoolStrategy:
    """Fallback validation processor using general document layout assumptions."""

    def extract_school_year(self, text: str, sy_format_hint: Optional[str] = None) -> Optional[str]:
        if not text:
            return None

        match = re.search(r'(20\d{2})[^0-9]*(20\d{2})', text)
        if match:
            return f"{match.group(1)}-{match.group(2)}"

        match = re.search(r'(20\d{2})[-/](\d{2})\b', text)
        if match:
            return f"{match.group(1)}-20{match.group(2)}"

        match = re.search(r'\b(20\d{2})\b', text)
        if match and sy_format_hint:
            single = match.group(1)
            if sy_format_hint == "single_year_as_start":
                return f"{single}-{int(single)+1}"
            elif sy_format_hint == "single_year_as_end":
                return f"{int(single)-1}-{single}"

        return None

    def extract_semester(self, text: str) -> Optional[str]:
        if not text:
            return None
        text = fix_ocr_symbols(text)
        t = text.lower().strip()

        first_patterns = [
            r'\b1st\b', r'\bfirst\b', r'\bsem\s*[\-:]?\s*1\b',
            r'\bsemester\s*[\-:]?\s*1\b', r'\b1\s*st\s*sem', r'\bsemester\s*i\b'
        ]
        second_patterns = [
            r'\b2nd\b', r'\bsecond\b', r'\bsem\s*[\-:]?\s*2\b',
            r'\bsemester\s*[\-:]?\s*2\b', r'\b2\s*nd\s*sem', r'\bsemester\s*ii\b'
        ]

        for p in first_patterns:
            if re.search(p, t):
                return '1'
        for p in second_patterns:
            if re.search(p, t):
                return '2'
        return None