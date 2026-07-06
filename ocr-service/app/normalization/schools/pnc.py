# app/normalization/schools/pnc.py
import re
from typing import Optional
from app.normalization.base_strategy import BaseSchoolStrategy

class PamantasanNgCabuyaoStrategy(BaseSchoolStrategy):
    """Custom parsing layer for PNC registrar declarations."""

    def extract_school_year(self, text: str, sy_format_hint: Optional[str] = None) -> Optional[str]:
        match = re.search(r"academic\s*year\s*(\d{4})\s*-\s*(\d{4})", text, re.IGNORECASE)
        if match:
            return f"{match.group(1)}-{match.group(2)}"
        return super().extract_school_year(text, sy_format_hint)