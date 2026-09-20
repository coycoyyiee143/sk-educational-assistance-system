# app/normalization/schools/cdc.py
import re
from typing import Optional
from app.normalization.base_strategy import BaseSchoolStrategy


class CalambaDoctorsCollegeStrategy(BaseSchoolStrategy):
    """Custom parsing layer for CDC's '1st/2nd Semester AY 20XX - 20XX' format."""

    def extract_school_year(self, text: str, sy_format_hint: Optional[str] = None) -> Optional[str]:
        match = re.search(r"\bay\s*(\d{4})\s*-\s*(\d{4})\b", text, re.IGNORECASE)
        if match:
            return f"{match.group(1)}-{match.group(2)}"
        return super().extract_school_year(text, sy_format_hint)
