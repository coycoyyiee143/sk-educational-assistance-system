# app/normalization/schools/uplb.py
import re
from typing import Optional
from app.normalization.base_strategy import BaseSchoolStrategy


class UplbStrategy(BaseSchoolStrategy):
    """
    Custom parsing layer for UPLB's 'TERM & SY' table, where the 'SY'
    label and its '20XX-20XX' value sit in separate cells (so they land
    a few words apart once OCR blocks are joined into one string) --
    unlike PNC/CDC's inline 'keyword <year>' phrasing.
    """

    def extract_school_year(self, text: str, sy_format_hint: Optional[str] = None) -> Optional[str]:
        match = re.search(r"\bsy\b[\s\S]{0,60}?(\d{4})\s*-\s*(\d{4})", text, re.IGNORECASE)
        if match:
            return f"{match.group(1)}-{match.group(2)}"
        return super().extract_school_year(text, sy_format_hint)
