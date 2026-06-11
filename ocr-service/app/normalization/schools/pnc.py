# app/normalization/schools/pnc.py
import re
from typing import Optional
from app.normalization.base_strategy import BaseSchoolStrategy

class PamantasanNgCabuyaoStrategy(BaseSchoolStrategy):
    """Custom parsing layer for PNC registrar declarations."""

    def extract_school_year(self, text: str, configured_year: Optional[str] = None) -> Optional[str]:
        # Targets: "Academic Year 20XX-20XX"
        match = re.search(r"academic\s*year\s*(\d{4})\s*-\s*(\d{4})", text, re.IGNORECASE)
        if match:
            return f"{match.group(1)}-{match.group(2)}"
        # Fallback to base heuristics if standard header format is missing
        return super().extract_school_year(text, configured_year)

    def extract_semester(self, text: str) -> Optional[str]:
        # Targets: "Second Semester" or "1st Semester"
        t_lower = text.lower()
        if re.search(r"\b(1st|first)\s*semester\b", t_lower):
            return "1"
        if re.search(r"\b(2nd|second)\s*semester\b", t_lower):
            return "2"
        return super().extract_semester(text)