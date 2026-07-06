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