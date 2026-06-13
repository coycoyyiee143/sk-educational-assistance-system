import re
from typing import Optional
from app.core.normalizers import fix_ocr_symbols

class BaseSchoolStrategy:
    """Fallback validation processor using general document layout assumptions."""

    def extract_school_year(self, text: str, configured_year: Optional[str] = None) -> Optional[str]:
        if not text:
            return None

        # Standard check layout structure: 2024-2025
        match = re.search(r'(20\d{2})[^0-9]*(20\d{2})', text)
        if match:
            return f"{match.group(1)}-{match.group(2)}"

        # Short check layout structure: 2024-25
        match = re.search(r'(20\d{2})[-/](\d{2})\b', text)
        if match:
            return f"{match.group(1)}-20{match.group(2)}"

        # Single structural field mapping fallback (relies on configuration presets)
        match = re.search(r'\b(20\d{2})\b', text)
        if match and configured_year:
            single = match.group(1)
            if configured_year == "single_year_as_start":
                return f"{single}-{int(single)+1}"
            elif configured_year == "single_year_as_end":
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

    def format_semester(self, value: str) -> str:
        """Format stored semester value back to document format for verification."""
        v = str(value).strip().lower()
        if v in ('1', '1st', 'first'):
            return '1'
        elif v in ('2', '2nd', 'second'):
            return '2'
        return value